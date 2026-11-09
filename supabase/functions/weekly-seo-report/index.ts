import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const ALERT_EMAIL = 'atharv.chugh@gmail.com'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (!isAdmin(req)) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const [seoRes, ogRes, gscRes] = await Promise.allSettled([
    supabase.functions.invoke('seo-monitor', { body: {} }),
    supabase.functions.invoke('og-image-audit', { body: {} }),
    supabase.functions.invoke('gsc-metrics', { body: { days: 7 } }),
  ])

  const seo = seoRes.status === 'fulfilled' ? seoRes.value.data : { error: String(seoRes.reason) }
  const og = ogRes.status === 'fulfilled' ? ogRes.value.data : { error: String(ogRes.reason) }
  const gsc = gscRes.status === 'fulfilled' ? gscRes.value.data : { error: String(gscRes.reason) }

  const summary = {
    week: new Date().toISOString().slice(0, 10),
    seoIssues: seo?.totalIssues ?? 0,
    ogIssues: og?.totalIssues ?? 0,
    gscClicks: gsc?.totals?.clicks ?? 0,
    gscImpressions: gsc?.totals?.impressions ?? 0,
    gscCtr: gsc?.totals?.ctr ?? 0,
    gscPosition: gsc?.totals?.position ?? 0,
  }

  const { error } = await supabase.functions.invoke('send-transactional-email', {
    body: {
      templateName: 'seo-alert',
      recipientEmail: ALERT_EMAIL,
      idempotencyKey: `weekly-seo-${summary.week}`,
      templateData: {
        issues: [
          `Weekly SEO report — ${summary.week}`,
          `GSC (7d): ${summary.gscClicks} clicks, ${summary.gscImpressions} impressions, CTR ${(summary.gscCtr * 100).toFixed(2)}%, avg pos ${summary.gscPosition.toFixed(1)}`,
          `SEO monitor issues: ${summary.seoIssues}`,
          `OG/Twitter image issues: ${summary.ogIssues}`,
          ...(seo?.issues ?? []).slice(0, 10),
        ],
        scanUrl: 'https://investmentsimulator.app',
        scannedAt: new Date().toISOString(),
      },
    },
  })

  return new Response(JSON.stringify({ ok: !error, summary, emailError: error?.message }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
