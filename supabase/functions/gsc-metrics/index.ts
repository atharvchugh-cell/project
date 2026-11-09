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


const SITE = 'https://investmentsimulator.app/'
const GATEWAY = 'https://connector-gateway.lovable.dev/google_search_console'

async function gscPost(path: string, body: unknown) {
  const lk = Deno.env.get('LOVABLE_API_KEY')
  const ck = Deno.env.get('GOOGLE_SEARCH_CONSOLE_API_KEY')
  if (!lk || !ck) throw new Error('GSC connector not configured')
  const res = await fetch(`${GATEWAY}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lk}`,
      'X-Connection-Api-Key': ck,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const txt = await res.text()
  if (!res.ok) throw new Error(`GSC ${res.status}: ${txt.slice(0, 300)}`)
  return JSON.parse(txt)
}

function fmt(d: Date) { return d.toISOString().slice(0, 10) }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (!isAdmin(req)) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  try {
    const { days = 28, page } = await req.json().catch(() => ({}))
    const end = new Date()
    const start = new Date(); start.setDate(end.getDate() - Number(days))
    const siteEnc = encodeURIComponent(SITE)
    const baseBody: Record<string, unknown> = {
      startDate: fmt(start),
      endDate: fmt(end),
      rowLimit: 25,
    }
    if (page) {
      baseBody.dimensionFilterGroups = [{ filters: [{ dimension: 'page', operator: 'equals', expression: page }] }]
    }

    const [totals, byPage, byQuery] = await Promise.all([
      gscPost(`/webmasters/v3/sites/${siteEnc}/searchAnalytics/query`, { ...baseBody, dimensions: [] }),
      gscPost(`/webmasters/v3/sites/${siteEnc}/searchAnalytics/query`, { ...baseBody, dimensions: ['page'] }),
      gscPost(`/webmasters/v3/sites/${siteEnc}/searchAnalytics/query`, { ...baseBody, dimensions: ['query'] }),
    ])

    return new Response(JSON.stringify({
      ok: true,
      range: { start: baseBody.startDate, end: baseBody.endDate },
      totals: totals.rows?.[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      pages: byPage.rows ?? [],
      queries: byQuery.rows ?? [],
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
