/**
 * FOUNDRY ADMIN DAILY SUMMARY
 *
 * Triggered as a Vercel cron job every day at 00:00 UTC (6:00 PM CST).
 * Sends a summary email to foundryandforge.app@gmail.com via Resend.
 *
 * Required environment variables (set in Vercel Dashboard → Settings → Environment Variables):
 *
 *   RESEND_API_KEY          — from resend.com dashboard after creating account and verifying domain.
 *                             Until you verify a sending domain, use Resend's test address
 *                             (onboarding@resend.dev) and update FROM_ADDRESS below.
 *                             Verify your domain at: resend.com/domains
 *
 *   ADMIN_CRON_SECRET       — any strong random string you generate. Vercel cron jobs send this
 *                             automatically as `Authorization: Bearer <value>`. Set the same value
 *                             in Vercel and it is never exposed to the client.
 *
 *   SUPABASE_SERVICE_ROLE_KEY — from Supabase Dashboard → Settings → API → service_role key.
 *                             This bypasses RLS so the cron can read all user data.
 *                             NEVER expose this key client-side.
 *
 *   SUPABASE_URL            — already set in Vercel as VITE_SUPABASE_URL. You can either:
 *                             (a) add SUPABASE_URL pointing to the same value, or
 *                             (b) this function reads VITE_SUPABASE_URL as a fallback.
 *
 *   STRIPE_SECRET_KEY       — already set in Vercel from existing billing setup.
 */

const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const { Resend } = require('resend');

// ── Config ────────────────────────────────────────────────────
const TO_ADDRESS = 'foundryandforge.app@gmail.com';
// Update FROM_ADDRESS once you verify a sending domain in Resend.
// Until then, Resend only allows sending to your own verified email in test mode.
const FROM_ADDRESS = 'Foundry <noreply@foundryandforge.app>';
const ADMIN_EMAIL = 'foundryandforge.app@gmail.com';

const STAGE_NAMES = { 1: 'Idea', 2: 'Plan', 3: 'Legal', 4: 'Finance', 5: 'Launch', 6: 'Grow' };

// ── Handler ───────────────────────────────────────────────────

export default async function handler(req, res) {
  // Vercel automatically sends Authorization: Bearer <CRON_SECRET> for cron invocations.
  // Also allow manual calls with the same secret for testing.
  const authHeader = req.headers['authorization'] ?? '';
  const secret = process.env.ADMIN_CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const resendKey = process.env.RESEND_API_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set' });
  }
  if (!resendKey) {
    return res.status(500).json({ error: 'RESEND_API_KEY not set' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey);
  const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2023-10-16' }) : null;
  const resend = new Resend(resendKey);

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const next7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // ── Gather all data in parallel ───────────────────────────────

  const [
    totalUsersRes,
    newSignupsRes,
    accessBreakdownRes,
    messages24hRes,
    docsRes,
    journalRes,
    briefingsRes,
    archiveSavesRes,
    topUsersRes,
    inactivePayingRes,
    stageDistributionRes,
  ] = await Promise.all([
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('profiles').select('id, name, email, created_at').gte('created_at', since24h).order('created_at', { ascending: false }),
    db.from('account_access').select('plan_type, subscription_status'),
    db.from('messages').select('user_id, created_at').gte('created_at', since24h),
    db.from('produced_documents').select('user_id, created_at').gte('created_at', since24h),
    db.from('journal_entries').select('id', { count: 'exact', head: true }).gte('created_at', since24h),
    db.from('briefings').select('id', { count: 'exact', head: true }).gte('created_at', since24h),
    db.from('daily_chat_summaries').select('id', { count: 'exact', head: true }).gte('created_at', since24h),
    db.from('messages').select('user_id').gte('created_at', since24h),
    db.from('profiles')
      .select('id, name, email, last_active_at')
      .lt('last_active_at', since7d)
      .not('last_active_at', 'is', null)
      .order('last_active_at', { ascending: true }),
    db.from('profiles').select('current_stage').not('current_stage', 'is', null),
  ]);

  const totalUsers = totalUsersRes.count ?? 0;
  const newSignups = newSignupsRes.data ?? [];
  const accessRows = accessBreakdownRes.data ?? [];
  const messages24h = messages24hRes.data ?? [];
  const docs24h = docsRes.data ?? [];
  const journalCount = journalRes.count ?? 0;
  const briefingsCount = briefingsRes.count ?? 0;
  const archiveSaves = archiveSavesRes.count ?? 0;
  const stageRows = stageDistributionRes.data ?? [];

  // Paid vs free
  const paidCount = accessRows.filter(r => r.subscription_status === 'active').length;
  const freeCount = accessRows.filter(r => !r.subscription_status || r.subscription_status === 'trial' || r.plan_type === 'free').length;

  // Top 5 active users by message volume
  const msgByUser = new Map();
  for (const m of messages24h) {
    msgByUser.set(m.user_id, (msgByUser.get(m.user_id) ?? 0) + 1);
  }
  const topUserIds = [...msgByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ id, count }));

  let topUserDetails = [];
  if (topUserIds.length > 0) {
    const { data: topProfiles } = await db
      .from('profiles')
      .select('id, name, email')
      .in('id', topUserIds.map(u => u.id));
    const profileMap = new Map((topProfiles ?? []).map(p => [p.id, p]));
    topUserDetails = topUserIds.map(u => ({
      ...u,
      name: profileMap.get(u.id)?.name ?? 'Unknown',
      email: profileMap.get(u.id)?.email ?? '',
    }));
  }

  // Inactive paying users (churn risk)
  const payingUserIds = new Set(
    accessRows.filter(r => r.subscription_status === 'active').map(r => r.user_id)
  );
  // Re-fetch with user_id so we can cross-reference
  const { data: accessWithIds } = await db
    .from('account_access')
    .select('user_id, subscription_status')
    .eq('subscription_status', 'active');
  const payingSet = new Set((accessWithIds ?? []).map(r => r.user_id));

  const inactivePayingUsers = (inactivePayingRes.data ?? [])
    .filter(u => payingSet.has(u.id))
    .slice(0, 5);

  // Stage distribution
  const stageDist = {};
  for (let i = 1; i <= 6; i++) stageDist[i] = 0;
  for (const row of stageRows) {
    const s = row.current_stage;
    if (s >= 1 && s <= 6) stageDist[s]++;
  }
  const avgStage = stageRows.length
    ? (stageRows.reduce((sum, r) => sum + (r.current_stage ?? 1), 0) / stageRows.length).toFixed(1)
    : 'N/A';

  // ── Stripe data ───────────────────────────────────────────────

  let renewalsSoon = [];
  let recentCancellations = [];
  let failedPayments = [];
  let stripeError = null;

  if (stripe) {
    try {
      // Upcoming renewals in 7 days — query billing_subscriptions in Supabase
      // (Stripe is not the source of truth; Supabase billing_subscriptions is)
      const { data: renewals } = await db
        .from('billing_subscriptions')
        .select('user_id, current_period_end, stripe_status')
        .eq('stripe_status', 'active')
        .gte('current_period_end', now.toISOString())
        .lte('current_period_end', next7d);

      if (renewals && renewals.length > 0) {
        const { data: renewalProfiles } = await db
          .from('profiles')
          .select('id, name, email')
          .in('id', renewals.map(r => r.user_id));
        const pMap = new Map((renewalProfiles ?? []).map(p => [p.id, p]));
        renewalsSoon = renewals.map(r => ({
          name: pMap.get(r.user_id)?.name ?? 'Unknown',
          email: pMap.get(r.user_id)?.email ?? '',
          renewsAt: r.current_period_end,
        }));
      }

      // Cancellations in last 24h — from Stripe directly for accuracy
      const canceledSubs = await stripe.subscriptions.list({
        status: 'canceled',
        limit: 50,
        created: { gte: Math.floor((now.getTime() - 24 * 60 * 60 * 1000) / 1000) },
      });

      for (const sub of canceledSubs.data) {
        const { data: billingRow } = await db
          .from('billing_subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', sub.id)
          .maybeSingle();
        if (billingRow) {
          const { data: profile } = await db
            .from('profiles')
            .select('name, email')
            .eq('id', billingRow.user_id)
            .maybeSingle();
          recentCancellations.push({
            name: profile?.name ?? 'Unknown',
            email: profile?.email ?? '',
          });
        }
      }

      // Failed payments in last 24h
      const failedInvoices = await stripe.invoices.list({
        status: 'open',
        limit: 50,
        created: { gte: Math.floor((now.getTime() - 24 * 60 * 60 * 1000) / 1000) },
      });
      failedPayments = failedInvoices.data
        .filter(inv => inv.attempt_count > 0 && !inv.paid)
        .map(inv => ({
          email: inv.customer_email ?? '',
          amount: `$${((inv.amount_due ?? 0) / 100).toFixed(2)}`,
        }));

    } catch (err) {
      stripeError = err.message;
    }
  }

  // ── Build email HTML ──────────────────────────────────────────

  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Chicago',
  });

  const html = buildEmailHtml({
    dateLabel,
    totalUsers,
    newSignups,
    paidCount,
    freeCount,
    messages24hCount: messages24h.length,
    docs24hCount: docs24h.length,
    journalCount,
    briefingsCount,
    archiveSaves,
    renewalsSoon,
    recentCancellations,
    failedPayments,
    stripeError,
    topUserDetails,
    inactivePayingUsers,
    avgStage,
    stageDist,
  });

  // ── Send email ────────────────────────────────────────────────

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: TO_ADDRESS,
      subject: `Foundry Daily — ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Chicago' })}`,
      html,
    });
    return res.status(200).json({ ok: true, date: dateLabel, totalUsers });
  } catch (err) {
    console.error('Resend error:', err);
    return res.status(500).json({ error: 'Failed to send email', detail: err.message });
  }
}

// ── Email HTML builder ────────────────────────────────────────

function buildEmailHtml({
  dateLabel, totalUsers, newSignups, paidCount, freeCount,
  messages24hCount, docs24hCount, journalCount, briefingsCount, archiveSaves,
  renewalsSoon, recentCancellations, failedPayments, stripeError,
  topUserDetails, inactivePayingUsers, avgStage, stageDist,
}) {
  const orange = '#E8622A';
  const bg = '#080809';
  const surface = '#0F0F11';
  const border = '#1E1E22';
  const textPrimary = '#F0EDE8';
  const textMuted = '#888';

  const section = (title, accentColor, content) => `
    <div style="margin-bottom:28px;">
      <div style="font-size:10px;color:${accentColor};letter-spacing:0.14em;text-transform:uppercase;margin-bottom:8px;font-family:Arial,sans-serif;">${title}</div>
      <div style="background:${surface};border:1px solid ${border};border-radius:14px;padding:20px;">
        ${content}
      </div>
    </div>`;

  const row = (label, value) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid ${border};">
      <span style="color:${textMuted};font-size:13px;font-family:Arial,sans-serif;">${label}</span>
      <span style="color:${textPrimary};font-size:13px;font-weight:600;font-family:Arial,sans-serif;">${value}</span>
    </div>`;

  const notTracked = `<span style="color:#555;font-style:italic;">Not yet tracked</span>`;

  // Stage distribution bar
  const totalForStage = Object.values(stageDist).reduce((a, b) => a + b, 0) || 1;
  const stageColors = { 1: '#F5A843', 2: '#63B3ED', 3: '#9F7AEA', 4: '#48BB78', 5: '#E8622A', 6: '#F5A843' };
  const stageBarRows = Object.entries(stageDist).map(([stage, count]) => {
    const pct = Math.round((count / totalForStage) * 100);
    const color = stageColors[stage] || orange;
    return `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="color:${textMuted};font-size:12px;font-family:Arial,sans-serif;">Stage ${stage} — ${STAGE_NAMES[stage]}</span>
          <span style="color:${textPrimary};font-size:12px;font-weight:600;font-family:Arial,sans-serif;">${count} users (${pct}%)</span>
        </div>
        <div style="height:6px;background:#1E1E22;border-radius:999px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${color};border-radius:999px;"></div>
        </div>
      </div>`;
  }).join('');

  const renewalsHtml = renewalsSoon.length
    ? renewalsSoon.map(r => `<div style="padding:6px 0;border-bottom:1px solid ${border};font-size:12px;color:${textMuted};font-family:Arial,sans-serif;">
        <span style="color:${textPrimary};font-weight:600;">${r.name}</span> — ${r.email}
        <span style="float:right;color:#63B3ED;">${new Date(r.renewsAt).toLocaleDateString('en-US', { month:'short',day:'numeric',year:'2-digit' })}</span>
      </div>`).join('')
    : `<div style="color:${textMuted};font-size:12px;font-family:Arial,sans-serif;">No renewals in the next 7 days.</div>`;

  const cancellationsHtml = recentCancellations.length
    ? recentCancellations.map(c => `<div style="padding:6px 0;border-bottom:1px solid ${border};font-size:12px;color:${textMuted};font-family:Arial,sans-serif;">
        <span style="color:${orange};font-weight:600;">${c.name}</span> — ${c.email}
      </div>`).join('')
    : `<div style="color:${textMuted};font-size:12px;font-family:Arial,sans-serif;">No cancellations in the last 24 hours.</div>`;

  const failedHtml = failedPayments.length
    ? failedPayments.map(f => `<div style="padding:6px 0;border-bottom:1px solid ${border};font-size:12px;color:${textMuted};font-family:Arial,sans-serif;">
        <span style="color:#F54443;">${f.email}</span>
        <span style="float:right;color:#F54443;">${f.amount}</span>
      </div>`).join('')
    : `<div style="color:${textMuted};font-size:12px;font-family:Arial,sans-serif;">No failed payments in the last 24 hours.</div>`;

  const topUsersHtml = topUserDetails.length
    ? topUserDetails.map((u, i) => `<div style="padding:6px 0;border-bottom:1px solid ${border};font-size:12px;color:${textMuted};font-family:Arial,sans-serif;">
        <span style="color:${textPrimary};font-weight:600;">#${i+1} ${u.name}</span> — ${u.email}
        <span style="float:right;color:${orange};">${u.count} msgs</span>
      </div>`).join('')
    : `<div style="color:${textMuted};font-size:12px;font-family:Arial,sans-serif;">No message activity in the last 24 hours.</div>`;

  const churnRiskHtml = inactivePayingUsers.length
    ? inactivePayingUsers.map(u => `<div style="padding:6px 0;border-bottom:1px solid ${border};font-size:12px;color:${textMuted};font-family:Arial,sans-serif;">
        <span style="color:#F5A843;font-weight:600;">${u.name ?? 'Unknown'}</span> — ${u.email ?? ''}
        <span style="float:right;color:#888;">Last active: ${u.last_active_at ? new Date(u.last_active_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : 'Never'}</span>
      </div>`).join('')
    : `<div style="color:${textMuted};font-size:12px;font-family:Arial,sans-serif;">No paying users inactive for 7+ days.</div>`;

  const newSignupsHtml = newSignups.length
    ? newSignups.map(u => `<div style="padding:4px 0;font-size:12px;color:${textMuted};font-family:Arial,sans-serif;">
        <span style="color:${textPrimary};font-weight:600;">${u.name ?? 'Unknown'}</span> — ${u.email ?? ''}
      </div>`).join('')
    : `<div style="color:${textMuted};font-size:12px;font-family:Arial,sans-serif;">No new signups in the last 24 hours.</div>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${bg};font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:32px;margin-bottom:8px;">🔥</div>
      <div style="font-size:22px;font-weight:700;color:${textPrimary};letter-spacing:-0.5px;">Foundry Daily</div>
      <div style="font-size:13px;color:${textMuted};margin-top:4px;">${dateLabel}</div>
      <div style="width:40px;height:2px;background:${orange};margin:16px auto 0;border-radius:999px;"></div>
    </div>

    ${section('Overview', orange, `
      ${row('Total registered users', totalUsers.toLocaleString())}
      ${row('Active paying subscribers', paidCount.toLocaleString())}
      ${row('Free / trial users', freeCount.toLocaleString())}
      ${row('New signups (last 24h)', newSignups.length)}
      ${newSignups.length > 0 ? `<div style="margin-top:12px;">${newSignupsHtml}</div>` : ''}
    `)}

    ${section('Usage — Last 24 Hours', '#63B3ED', `
      ${row('Forge messages sent', messages24hCount.toLocaleString())}
      ${row('Documents produced', docs24hCount.toLocaleString())}
      ${row('Journal entries written', journalCount.toLocaleString())}
      ${row('Briefings generated', briefingsCount.toLocaleString())}
      ${row('Archive saves', archiveSaves.toLocaleString())}
      ${row('Pitch practice sessions', notTracked)}
    `)}
    <!-- NOTE: Pitch practice sessions are not yet tracked in a separate table.
         To add this metric, create a pitch_sessions table with user_id and created_at,
         and insert a row at the start of each pitch session in PitchPracticeScreen.tsx. -->

    ${section('Subscriptions', '#48BB78', `
      ${stripeError ? `<div style="color:#F5A843;font-size:12px;margin-bottom:12px;font-family:Arial,sans-serif;">⚠ Stripe error: ${stripeError}</div>` : ''}
      <div style="font-size:11px;color:${textMuted};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;font-family:Arial,sans-serif;">Renewals in the next 7 days</div>
      ${renewalsHtml}
      <div style="font-size:11px;color:${textMuted};text-transform:uppercase;letter-spacing:0.1em;margin:16px 0 8px;font-family:Arial,sans-serif;">Cancellations (last 24h)</div>
      ${cancellationsHtml}
      <div style="font-size:11px;color:${textMuted};text-transform:uppercase;letter-spacing:0.1em;margin:16px 0 8px;font-family:Arial,sans-serif;">Failed payments (last 24h)</div>
      ${failedHtml}
    `)}

    ${section('Engagement', '#9B7FE8', `
      ${row('Average current stage', avgStage)}
      <div style="font-size:11px;color:${textMuted};text-transform:uppercase;letter-spacing:0.1em;margin:16px 0 8px;font-family:Arial,sans-serif;">Top 5 most active (last 24h)</div>
      ${topUsersHtml}
      <div style="font-size:11px;color:${textMuted};text-transform:uppercase;letter-spacing:0.1em;margin:16px 0 8px;font-family:Arial,sans-serif;">Churn risk — paying &amp; inactive 7+ days</div>
      ${churnRiskHtml}
    `)}

    ${section('Stage Distribution', '#F5A843', stageBarRows)}

    <!-- Footer -->
    <div style="text-align:center;margin-top:32px;padding-top:24px;border-top:1px solid ${border};">
      <div style="font-size:11px;color:#333;font-family:Arial,sans-serif;">Foundry Admin · Internal use only</div>
    </div>
  </div>
</body>
</html>`;
}
