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

const BASE = 'https://investmentsimulator.app'
const ROUTES = [
  { path: '/', label: 'Home' },
  { path: '/real-estate-game', label: 'Real Estate Game' },
  { path: '/guide', label: "Beginner's Guide" },
]

interface RouteReport {
  path: string
  label: string
  status: number
  ogImage?: string
  ogImageAlt?: string
  ogImageWidth?: string
  ogImageHeight?: string
  twitterImage?: string
  twitterImageAlt?: string
  twitterCard?: string
  imageReachable?: boolean
  imageContentType?: string
  imageBytes?: number
  issues: string[]
}

function pick(html: string, re: RegExp): string | undefined {
  const m = html.match(re); return m?.[1]
}

async function audit(path: string, label: string): Promise<RouteReport> {
  const url = BASE + path
  const r: RouteReport = { path, label, status: 0, issues: [] }
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'RiseToRiches-OG-Audit/1.0' } })
    r.status = res.status
    if (!res.ok) { r.issues.push(`HTTP ${res.status}`); return r }
    const html = await res.text()
    r.ogImage = pick(html, /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
    r.ogImageAlt = pick(html, /<meta\s+property=["']og:image:alt["']\s+content=["']([^"']+)["']/i)
    r.ogImageWidth = pick(html, /<meta\s+property=["']og:image:width["']\s+content=["']([^"']+)["']/i)
    r.ogImageHeight = pick(html, /<meta\s+property=["']og:image:height["']\s+content=["']([^"']+)["']/i)
    r.twitterImage = pick(html, /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i)
    r.twitterImageAlt = pick(html, /<meta\s+name=["']twitter:image:alt["']\s+content=["']([^"']+)["']/i)
    r.twitterCard = pick(html, /<meta\s+name=["']twitter:card["']\s+content=["']([^"']+)["']/i)

    if (!r.ogImage) r.issues.push('Missing og:image')
    else if (!/^https:\/\//.test(r.ogImage)) r.issues.push('og:image must be absolute https URL')
    if (!r.ogImageAlt) r.issues.push('Missing og:image:alt')
    if (!r.ogImageWidth || !r.ogImageHeight) r.issues.push('Missing og:image:width/height')
    if (!r.twitterImage) r.issues.push('Missing twitter:image')
    if (r.twitterCard !== 'summary_large_image') r.issues.push('twitter:card should be summary_large_image')
    if (r.ogImage && r.twitterImage && r.ogImage !== r.twitterImage) r.issues.push('og:image and twitter:image differ')

    if (r.ogImage) {
      try {
        const ir = await fetch(r.ogImage, { method: 'HEAD' })
        r.imageReachable = ir.ok
        r.imageContentType = ir.headers.get('content-type') ?? undefined
        const len = ir.headers.get('content-length')
        r.imageBytes = len ? Number(len) : undefined
        if (!ir.ok) r.issues.push(`og:image not reachable (HTTP ${ir.status})`)
        else if (r.imageContentType && !/^image\//.test(r.imageContentType)) r.issues.push(`og:image content-type not image/* (${r.imageContentType})`)
        else if (r.imageBytes && r.imageBytes > 5_000_000) r.issues.push(`og:image too large (${r.imageBytes} bytes)`)
      } catch (e) {
        r.imageReachable = false
        r.issues.push(`og:image fetch failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  } catch (e) {
    r.issues.push(`Route fetch failed: ${e instanceof Error ? e.message : String(e)}`)
  }
  return r
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (!isAdmin(req)) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  const reports = await Promise.all(ROUTES.map((r) => audit(r.path, r.label)))
  const totalIssues = reports.reduce((s, r) => s + r.issues.length, 0)
  return new Response(JSON.stringify({ ok: true, scannedAt: new Date().toISOString(), totalIssues, reports }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
