import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

function isAdmin(req: Request): boolean {
  const code = Deno.env.get('ADMIN_CODE')
  const hdr = req.headers.get('x-admin-code')
  if (code && hdr && hdr === code) return true
  const auth = req.headers.get('Authorization') || ''
  const tok = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  // Exact match against the real server key; decoded claims are never trusted.
  const keys = [Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), ...(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '').split(/[\s,"{}:\[\]]+/)]
    .filter((k): k is string => !!k && k.length > 20)
  return !!tok && keys.includes(tok)
}

const ALERT_EMAIL = 'atharv.chugh@gmail.com'
const BASE = 'https://investmentsimulator.app'
const ROUTES = ['/', '/real-estate-game', '/guide']

interface Check {
  url: string
  ok: boolean
  message: string
}

async function checkRoute(path: string): Promise<Check[]> {
  const url = BASE + path
  const out: Check[] = []
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'RiseToRiches-SEO-Monitor/1.0' } })
    if (!res.ok) {
      out.push({ url, ok: false, message: `HTTP ${res.status} on ${path}` })
      return out
    }
    const html = await res.text()
    const checks: Array<[string, RegExp, string]> = [
      ['title', /<title>([^<]{10,70})<\/title>/i, `Missing or invalid <title> on ${path}`],
      ['description', /<meta\s+name=["']description["']\s+content=["'][^"']{50,170}["']/i, `Missing or invalid meta description on ${path}`],
      ['canonical', /<link\s+rel=["']canonical["']\s+href=["']https:\/\/[^"']+["']/i, `Missing canonical on ${path}`],
      ['og:title', /<meta\s+property=["']og:title["']\s+content=["'][^"']+["']/i, `Missing og:title on ${path}`],
      ['og:image', /<meta\s+property=["']og:image["']\s+content=["']https:\/\/[^"']+["']/i, `Missing og:image on ${path}`],
      ['twitter:card', /<meta\s+name=["']twitter:card["']\s+content=["']summary_large_image["']/i, `Missing twitter:card on ${path}`],
      ['twitter:image', /<meta\s+name=["']twitter:image["']\s+content=["']https:\/\/[^"']+["']/i, `Missing twitter:image on ${path}`],
      ['json-ld', /<script\s+type=["']application\/ld\+json["']/i, `Missing JSON-LD schema on ${path}`],
    ]
    for (const [, re, msg] of checks) {
      if (!re.test(html)) out.push({ url, ok: false, message: msg })
    }
  } catch (e) {
    out.push({ url, ok: false, message: `Fetch failed for ${path}: ${e instanceof Error ? e.message : String(e)}` })
  }
  return out
}

async function checkInfra(): Promise<Check[]> {
  const out: Check[] = []
  for (const path of ['/robots.txt', '/sitemap.xml']) {
    try {
      const res = await fetch(BASE + path)
      if (!res.ok) out.push({ url: BASE + path, ok: false, message: `${path} returned HTTP ${res.status}` })
    } catch (e) {
      out.push({ url: BASE + path, ok: false, message: `${path} unreachable: ${e instanceof Error ? e.message : String(e)}` })
    }
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (!isAdmin(req)) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  const all: Check[] = []
  for (const r of ROUTES) all.push(...(await checkRoute(r)))
  all.push(...(await checkInfra()))

  const issues = all.filter((c) => !c.ok).map((c) => c.message).sort()
  const issuesKey = issues.join('||')

  const { data: state } = await supabase
    .from('seo_monitor_state')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  const prevKey: string = state?.known_issues_key ?? ''
  const prevSet = new Set(prevKey ? prevKey.split('||') : [])
  const newIssues = issues.filter((i) => !prevSet.has(i))

  let emailSent = false
  if (newIssues.length > 0) {
    const { error: invokeErr } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'seo-alert',
        recipientEmail: ALERT_EMAIL,
        idempotencyKey: `seo-alert-${Date.now()}-${newIssues.length}`,
        templateData: { issues: newIssues, scanUrl: BASE, scannedAt: new Date().toISOString() },
      },
    })
    emailSent = !invokeErr
    if (invokeErr) console.error('seo-alert email failed', invokeErr)
  }

  await supabase
    .from('seo_monitor_state')
    .upsert({ id: 1, known_issues_key: issuesKey, last_issues: issues, last_checked_at: new Date().toISOString() })

  return new Response(JSON.stringify({
    ok: true,
    totalIssues: issues.length,
    newIssues,
    emailSent,
    checkedRoutes: ROUTES,
  }, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
