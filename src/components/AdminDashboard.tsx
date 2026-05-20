import { useState, useEffect, useMemo } from 'react';
import { Icons } from '../icons';
import type {
    AdminUser,
    AdminNote,
} from '../lib/adminDb';
import {
    loadAdminUsers,
    loadAdminUser,
    loadAdminNotes,
    grantCompAccess,
    removeCompAccess,
    suspendUser,
    reactivateUser,
    revokeAccess,
    addAdminNote,
} from '../lib/adminDb';
import { loadAdminVaultUsage, type AdminVaultUsageSummary } from '../lib/adminVaultUsage';
import { subscriptionLabel, planLabel } from '../lib/accessGate';
import { hasAdminAccess, isOwnerRole, roleLabel } from '../lib/roles';

// ─────────────────────────────────────────────────────────────
// STATUS COLOURS
// ─────────────────────────────────────────────────────────────
const SUB_COLORS: Record<string, { bg: string; text: string }> = {
    trial:      { bg: 'rgba(142,160,181,0.13)',  text: 'var(--tekori-muted-text)' },
    active:     { bg: 'rgba(72,187,120,0.13)',  text: 'var(--color-success)' },
    past_due:   { bg: 'rgba(244,182,66,0.13)',  text: 'var(--tekori-amber)' },
    canceled:   { bg: 'rgba(216,155,43,0.13)',   text: 'var(--tekori-gold)' },
    incomplete: { bg: 'rgba(16,41,68,0.10)', text: 'var(--tekori-slate-navy)' },
    unpaid:     { bg: 'rgba(245,68,67,0.13)',   text: '#F54443' },
    comped:     { bg: 'rgba(16,41,68,0.10)', text: 'var(--tekori-slate-navy)' },
    gifted:     { bg: 'rgba(16,41,68,0.10)', text: 'var(--tekori-slate-navy)' },
    expired:    { bg: 'rgba(100,100,100,0.13)', text: 'var(--color-text-muted)' },
};

const ACCESS_COLORS: Record<string, { bg: string; text: string }> = {
    active:    { bg: 'rgba(72,187,120,0.13)',  text: 'var(--color-success)' },
    suspended: { bg: 'rgba(244,182,66,0.13)',  text: 'var(--tekori-amber)' },
    revoked:   { bg: 'rgba(245,68,67,0.13)',   text: '#F54443' },
};

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
    free:        { bg: 'rgba(7,26,47,0.05)', text: 'var(--color-text-muted)' },
    starter:     { bg: 'rgba(142,160,181,0.13)',  text: 'var(--tekori-muted-text)' },
    pro:         { bg: 'rgba(72,187,120,0.13)',  text: 'var(--color-success)' },
    enterprise:  { bg: 'rgba(244,182,66,0.13)',  text: 'var(--tekori-amber)' },
    family_comp: { bg: 'rgba(16,41,68,0.10)', text: 'var(--tekori-slate-navy)' },
    gifted:      { bg: 'rgba(16,41,68,0.10)', text: 'var(--tekori-slate-navy)' },
};

function colorFor(map: Record<string, { bg: string; text: string }>, key: string | null | undefined) {
    return map[key ?? ''] ?? { bg: 'rgba(7,26,47,0.05)', text: 'var(--color-text-muted)' };
}

function Badge({ label, colors }: { label: string; colors: { bg: string; text: string } }) {
    return (
        <span style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
            padding: '2px 8px', borderRadius: 20,
            background: colors.bg, color: colors.text,
            textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>
            {label}
        </span>
    );
}

function fmtDate(d: string | null | undefined) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function fmtDateTime(d: string | null | undefined) {
    if (!d) return 'Never';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────
// STATS BAR
// ─────────────────────────────────────────────────────────────
function StatsBar({ users }: { users: AdminUser[] }) {
    const stats = useMemo(() => {
        const total = users.length;
        const active = users.filter(u => u.access?.access_status === 'active' && u.access?.subscription_status === 'active').length;
        const trial = users.filter(u => u.access?.subscription_status === 'trial').length;
        const canceled = users.filter(u => u.access?.subscription_status === 'canceled').length;
        const suspended = users.filter(u => u.access?.access_status === 'suspended').length;
        const comped = users.filter(u => u.access?.is_family_comp || u.access?.subscription_status === 'comped' || u.access?.subscription_status === 'gifted').length;
        return { total, active, trial, canceled, suspended, comped };
    }, [users]);

    const items = [
        { label: 'Total', value: stats.total, color: 'var(--color-text-muted)' },
        { label: 'Active', value: stats.active, color: 'var(--color-success)' },
        { label: 'Trial', value: stats.trial, color: 'var(--tekori-muted-text)' },
        { label: 'Canceled', value: stats.canceled, color: 'var(--tekori-gold)' },
        { label: 'Suspended', value: stats.suspended, color: 'var(--tekori-amber)' },
        { label: 'Comped', value: stats.comped, color: 'var(--tekori-slate-navy)' },
    ];

    return (
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2, flexShrink: 0 }}>
            {items.map(item => (
                <div key={item.label} style={{
                    background: 'rgba(7,26,47,0.03)', border: '1px solid rgba(7,26,47,0.07)',
                    borderRadius: 10, padding: '8px 14px', textAlign: 'center', flexShrink: 0,
                }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: item.color, fontFamily: "var(--tekori-font-ui)" }}>
                        {item.value}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>
                        {item.label}
                    </div>
                </div>
            ))}
        </div>
    );
}

function VaultUsageBar({
    usage,
    loading,
    error,
}: {
    usage: AdminVaultUsageSummary | null;
    loading: boolean;
    error: string | null;
}) {
    if (loading) {
        return <div style={{ fontSize: 11, color: 'var(--color-text-soft)', marginTop: 10 }}>Loading vault usage...</div>;
    }

    if (error) {
        return <div style={{ fontSize: 11, color: '#A8705D', marginTop: 10 }}>{error}</div>;
    }

    if (!usage) return null;

    const items = [
        { label: 'Docs Produced', value: usage.documentsGenerated, color: 'var(--tekori-gold)' },
        { label: 'Vault Created', value: usage.vaultDocumentsCreated, color: 'var(--tekori-muted-text)' },
        { label: 'Uploads', value: usage.filesUploaded, color: 'var(--color-success)' },
        { label: 'Artifacts', value: usage.artifactsSaved, color: 'var(--tekori-amber)' },
        { label: 'Signature Requests', value: usage.signatureRequestsCreated, color: 'var(--tekori-slate-navy)' },
        { label: 'Completed', value: usage.documentsSignedCompleted, color: 'var(--color-success)' },
        { label: 'Wizard Runs', value: usage.needsWizardRuns, color: 'var(--tekori-gold)' },
    ];

    return (
        <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--color-text-soft)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
                Document Vault · Last {usage.windowHours} Hours
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
                {items.map(item => (
                    <div key={item.label} style={{
                        background: 'rgba(7,26,47,0.03)', border: '1px solid rgba(7,26,47,0.07)',
                        borderRadius: 10, padding: '8px 12px', textAlign: 'center', flexShrink: 0,
                    }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: item.color, fontFamily: "var(--tekori-font-ui)" }}>
                            {item.value}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
                            {item.label}
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 6 }}>
                Mock signatures completed: {usage.mockDocumentsSignedCompleted}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// USER ROW
// ─────────────────────────────────────────────────────────────
function UserRow({ user, onClick }: { user: AdminUser; onClick: () => void }) {
    const subStatus = user.access?.subscription_status;
    const accessStatus = user.access?.access_status ?? 'active';
    const plan = user.access?.plan_type ?? 'free';
    const initials = (user.name ?? user.email ?? '?').slice(0, 2).toUpperCase();

    return (
        <button
            onClick={onClick}
            style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', background: 'rgba(7,26,47,0.02)',
                border: '1px solid rgba(7,26,47,0.06)', borderRadius: 12,
                cursor: 'pointer', textAlign: 'left', marginBottom: 6,
                transition: 'background 0.15s', fontFamily: "var(--tekori-font-ui)",
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(7,26,47,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(7,26,47,0.02)'}
        >
            {/* Avatar */}
            <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(216,155,43,0.15)', border: '1px solid rgba(216,155,43,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: 'var(--tekori-gold)', fontWeight: 700,
            }}>
                {initials}
            </div>

            {/* Identity */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 500, marginBottom: 2 }}>
                    {user.name ?? '—'}{hasAdminAccess(user.role) && <span style={{ fontSize: 9, color: isOwnerRole(user.role) ? 'var(--tekori-gold)' : 'var(--tekori-amber)', marginLeft: 6, background: isOwnerRole(user.role) ? 'rgba(216,155,43,0.15)' : 'rgba(244,182,66,0.15)', padding: '1px 5px', borderRadius: 10 }}>{roleLabel(user.role).toUpperCase()}</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.email ?? '—'}
                </div>
            </div>

            {/* Badges */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <Badge label={planLabel(plan)} colors={colorFor(PLAN_COLORS, plan)} />
                    {subStatus && <Badge label={subscriptionLabel(subStatus)} colors={colorFor(SUB_COLORS, subStatus)} />}
                </div>
                {accessStatus !== 'active' && (
                    <Badge label={accessStatus.toUpperCase()} colors={colorFor(ACCESS_COLORS, accessStatus)} />
                )}
                <div style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>{fmtDate(user.created_at)}</div>
            </div>

            <span style={{ color: 'var(--color-text-muted)', fontSize: 12, flexShrink: 0 }}>›</span>
        </button>
    );
}

// ─────────────────────────────────────────────────────────────
// USER DETAIL PANEL
// ─────────────────────────────────────────────────────────────
function UserDetailPanel({
    user: initialUser,
    adminId,
    onClose,
    onUpdated,
}: {
    user: AdminUser;
    adminId: string;
    onClose: () => void;
    onUpdated: () => void;
}) {
    const [user, setUser] = useState(initialUser);
    const [notes, setNotes] = useState<AdminNote[]>([]);
    const [noteText, setNoteText] = useState('');
    const [expandedAction, setExpandedAction] = useState<string | null>(null);
    const [actionInput, setActionInput] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [actionMsg, setActionMsg] = useState('');
    const [savingNote, setSavingNote] = useState(false);

    useEffect(() => {
        loadAdminNotes(user.id).then(setNotes);
    }, [user.id]);

    const refresh = async () => {
        const fresh = await loadAdminUser(user.id);
        if (fresh) setUser(fresh);
        onUpdated();
    };

    const doAction = async (action: string) => {
        if (actionInput.trim().length < 8) {
            setActionMsg('A reason of at least 8 characters is required. For full controls, use Admin Operations.');
            return;
        }
        setActionLoading(true);
        setActionMsg('');
        let ok = false;
        switch (action) {
            case 'grant_comp':
                ok = await grantCompAccess(user.id, false, actionInput);
                break;
            case 'grant_family':
                ok = await grantCompAccess(user.id, true, actionInput || 'Family access');
                break;
            case 'remove_comp':
                ok = await removeCompAccess(user.id, actionInput);
                break;
            case 'suspend':
                ok = await suspendUser(user.id, actionInput);
                break;
            case 'reactivate':
                ok = await reactivateUser(user.id, actionInput);
                break;
            case 'revoke':
                ok = await revokeAccess(user.id, actionInput);
                break;
        }
        setActionLoading(false);
        if (ok) {
            setActionMsg('Done.');
            setExpandedAction(null);
            setActionInput('');
            await refresh();
            setTimeout(() => setActionMsg(''), 3000);
        } else {
            setActionMsg('Action failed. Check console.');
        }
    };

    const saveNote = async () => {
        if (!noteText.trim()) return;
        setSavingNote(true);
        await addAdminNote(user.id, adminId, noteText.trim());
        const refreshed = await loadAdminNotes(user.id);
        setNotes(refreshed);
        setNoteText('');
        setSavingNote(false);
    };

    const access = user.access;
    const billing = user.billing;
    const isComped = access?.is_family_comp || access?.subscription_status === 'comped' || access?.subscription_status === 'gifted';
    const isSuspended = access?.access_status === 'suspended';
    const isRevoked = access?.access_status === 'revoked';
    const isActive = access?.access_status === 'active';

    const card = { background: 'rgba(7,26,47,0.02)', border: '1px solid rgba(7,26,47,0.07)', borderRadius: 12, padding: '14px 16px', marginBottom: 12 } as const;
    const label = { fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 8 };
    const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(7,26,47,0.04)', fontSize: 12 } as const;
    const rowLast = { ...row, borderBottom: 'none' };
    const rowKey = { color: 'var(--color-text-soft)' };
    const rowVal = { color: 'rgba(16,32,51,0.74)' };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'var(--tekori-deep-navy)', zIndex: 110,
            fontFamily: "var(--tekori-font-ui)", color: 'var(--color-text)',
            display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease',
        }}>
            {/* Header */}
            <div style={{
                padding: 'max(14px, calc(10px + env(safe-area-inset-top))) 16px 12px',
                borderBottom: '1px solid rgba(7,26,47,0.07)',
                display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
                background: 'rgba(255,252,246,0.97)', backdropFilter: 'blur(12px)',
            }}>
                <button onClick={onClose} style={{
                    background: 'rgba(7,26,47,0.05)', border: '1px solid rgba(7,26,47,0.1)',
                    borderRadius: 8, padding: '7px 12px', color: 'rgba(16,32,51,0.74)', fontSize: 12, cursor: 'pointer',
                }}>
                    ←
                </button>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{user.name ?? user.email ?? 'Unknown'}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-soft)' }}>{user.email}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {access?.access_status && (
                        <Badge label={access.access_status} colors={colorFor(ACCESS_COLORS, access.access_status)} />
                    )}
                    {access?.subscription_status && (
                        <Badge label={subscriptionLabel(access.subscription_status)} colors={colorFor(SUB_COLORS, access.subscription_status)} />
                    )}
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16, paddingBottom: 32 }}>
                {actionMsg && (
                    <div style={{
                        background: 'rgba(72,187,120,0.1)', border: '1px solid rgba(72,187,120,0.25)',
                        borderRadius: 8, padding: '8px 14px', fontSize: 12, color: 'var(--color-success)',
                        marginBottom: 12, animation: 'fadeIn 0.2s ease',
                    }}>
                        {actionMsg}
                    </div>
                )}

                {/* Identity card */}
                <div style={card}>
                    <div style={label}>Identity</div>
                    <div style={row}><span style={rowKey}>Name</span><span style={rowVal}>{user.name ?? '—'}</span></div>
                    <div style={row}><span style={rowKey}>Email</span><span style={rowVal}>{user.email ?? '—'}</span></div>
                    <div style={row}><span style={rowKey}>Business</span><span style={rowVal}>{user.business_name ?? '—'}</span></div>
                    <div style={row}><span style={rowKey}>Joined</span><span style={rowVal}>{fmtDateTime(user.created_at)}</span></div>
                    <div style={rowLast}><span style={rowKey}>Last Active</span><span style={rowVal}>{fmtDateTime(user.last_active_at)}</span></div>
                </div>

                {/* Access & Plan card */}
                <div style={card}>
                    <div style={label}>Access & Plan</div>
                    <div style={row}>
                        <span style={rowKey}>Access</span>
                        <Badge label={access?.access_status ?? 'unknown'} colors={colorFor(ACCESS_COLORS, access?.access_status)} />
                    </div>
                    <div style={row}>
                        <span style={rowKey}>Plan</span>
                        <Badge label={planLabel(access?.plan_type)} colors={colorFor(PLAN_COLORS, access?.plan_type)} />
                    </div>
                    <div style={row}>
                        <span style={rowKey}>Subscription</span>
                        <Badge label={subscriptionLabel(access?.subscription_status)} colors={colorFor(SUB_COLORS, access?.subscription_status)} />
                    </div>
                    {access?.is_family_comp && (
                        <div style={row}><span style={rowKey}>Comp Reason</span><span style={rowVal}>{access.comp_reason ?? '—'}</span></div>
                    )}
                    {access?.canceled_at && (
                        <div style={row}><span style={rowKey}>Canceled</span><span style={rowVal}>{fmtDateTime(access.canceled_at)}</span></div>
                    )}
                    {access?.suspended_at && (
                        <div style={row}><span style={rowKey}>Suspended</span><span style={rowVal}>{fmtDateTime(access.suspended_at)}</span></div>
                    )}
                    {access?.suspension_reason && (
                        <div style={rowLast}><span style={rowKey}>Reason</span><span style={rowVal}>{access.suspension_reason}</span></div>
                    )}
                </div>

                {/* Billing card */}
                {(billing?.stripe_status || billing?.stripe_customer_id) && (
                    <div style={card}>
                        <div style={label}>Billing (Stripe)</div>
                        <div style={row}><span style={rowKey}>Stripe Status</span><span style={rowVal}>{billing?.stripe_status ?? '—'}</span></div>
                        <div style={row}><span style={rowKey}>Customer ID</span><span style={{ ...rowVal, fontSize: 10, fontFamily: 'monospace' }}>{billing?.stripe_customer_id ?? '—'}</span></div>
                        <div style={row}><span style={rowKey}>Sub ID</span><span style={{ ...rowVal, fontSize: 10, fontFamily: 'monospace' }}>{billing?.stripe_subscription_id ?? '—'}</span></div>
                        <div style={row}><span style={rowKey}>Period End</span><span style={rowVal}>{fmtDateTime(billing?.current_period_end)}</span></div>
                        <div style={rowLast}><span style={rowKey}>Cancel at End</span><span style={rowVal}>{billing?.cancel_at_period_end ? 'Yes' : 'No'}</span></div>
                    </div>
                )}

                {/* Actions card */}
                <div style={card}>
                    <div style={label}>Admin Actions</div>
                    <div style={{ fontSize: 11, color: 'var(--tekori-amber)', lineHeight: 1.55, marginBottom: 10 }}>
                        Legacy surface. These actions now use audited server routes, but Admin Operations is the primary control center.
                    </div>

                    {/* Grant comp / family */}
                    {!isComped && (
                        <ActionItem
                            id="grant_comp"
                            label="Grant Comp Access"
                            color="var(--tekori-slate-navy)"
                            expanded={expandedAction === 'grant_comp'}
                            onToggle={() => setExpandedAction(expandedAction === 'grant_comp' ? null : 'grant_comp')}
                            input={actionInput}
                            onInputChange={setActionInput}
                            inputPlaceholder="Reason for comp access"
                            loading={actionLoading}
                            onConfirm={() => doAction('grant_comp')}
                            confirmLabel="Grant Comp"
                        />
                    )}
                    {!isComped && (
                        <ActionItem
                            id="grant_family"
                            label="Mark as Family Access"
                            color="var(--tekori-slate-navy)"
                            expanded={expandedAction === 'grant_family'}
                            onToggle={() => setExpandedAction(expandedAction === 'grant_family' ? null : 'grant_family')}
                            input={actionInput}
                            onInputChange={setActionInput}
                            inputPlaceholder="Reason for family access"
                            loading={actionLoading}
                            onConfirm={() => doAction('grant_family')}
                            confirmLabel="Grant Family Access"
                        />
                    )}
                    {isComped && (
                        <ActionItem
                            id="remove_comp"
                            label="Remove Comp Access"
                            color="var(--tekori-amber)"
                            expanded={expandedAction === 'remove_comp'}
                            onToggle={() => setExpandedAction(expandedAction === 'remove_comp' ? null : 'remove_comp')}
                            input={actionInput}
                            onInputChange={setActionInput}
                            inputPlaceholder="Reason for removing comp access"
                            loading={actionLoading}
                            onConfirm={() => doAction('remove_comp')}
                            confirmLabel="Remove Comp"
                        />
                    )}
                    {isActive && !isSuspended && (
                        <ActionItem
                            id="suspend"
                            label="Suspend Account"
                            color="var(--tekori-amber)"
                            expanded={expandedAction === 'suspend'}
                            onToggle={() => setExpandedAction(expandedAction === 'suspend' ? null : 'suspend')}
                            input={actionInput}
                            onInputChange={setActionInput}
                            inputPlaceholder="Reason for suspension"
                            loading={actionLoading}
                            onConfirm={() => doAction('suspend')}
                            confirmLabel="Confirm Suspend"
                        />
                    )}
                    {isSuspended && (
                        <ActionItem
                            id="reactivate"
                            label="Reactivate Account"
                            color="var(--color-success)"
                            expanded={expandedAction === 'reactivate'}
                            onToggle={() => setExpandedAction(expandedAction === 'reactivate' ? null : 'reactivate')}
                            input={actionInput}
                            onInputChange={setActionInput}
                            inputPlaceholder="Reason for reactivation"
                            loading={actionLoading}
                            onConfirm={() => doAction('reactivate')}
                            confirmLabel="Confirm Reactivate"
                        />
                    )}
                    {!isRevoked && (
                        <ActionItem
                            id="revoke"
                            label="Revoke Access"
                            color="#F54443"
                            expanded={expandedAction === 'revoke'}
                            onToggle={() => setExpandedAction(expandedAction === 'revoke' ? null : 'revoke')}
                            input={actionInput}
                            onInputChange={setActionInput}
                            inputPlaceholder="Reason for revoking access"
                            loading={actionLoading}
                            onConfirm={() => doAction('revoke')}
                            confirmLabel="⚠ Permanently Revoke"
                            destructive
                        />
                    )}
                    {isRevoked && (
                        <ActionItem
                            id="reactivate"
                            label="Restore Access"
                            color="var(--color-success)"
                            expanded={expandedAction === 'reactivate'}
                            onToggle={() => setExpandedAction(expandedAction === 'reactivate' ? null : 'reactivate')}
                            input={actionInput}
                            onInputChange={setActionInput}
                            inputPlaceholder="Reason for restoring access"
                            loading={actionLoading}
                            onConfirm={() => doAction('reactivate')}
                            confirmLabel="Restore Access"
                        />
                    )}
                </div>

                {/* Notes card */}
                <div style={card}>
                    <div style={label}>Admin Notes</div>
                    <textarea
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        placeholder="Add an internal note (retention, discount offered, follow-up needed...)"
                        rows={3}
                        style={{
                            width: '100%', background: 'rgba(7,26,47,0.04)',
                            border: '1px solid rgba(7,26,47,0.1)', borderRadius: 8,
                            padding: '9px 12px', color: 'var(--color-text)', fontSize: 12,
                            fontFamily: "var(--tekori-font-ui)", lineHeight: 1.6,
                            resize: 'vertical', boxSizing: 'border-box', outline: 'none',
                        }}
                    />
                    <button
                        onClick={saveNote}
                        disabled={!noteText.trim() || savingNote}
                        style={{
                            marginTop: 8, padding: '8px 16px',
                            background: noteText.trim() ? 'rgba(216,155,43,0.15)' : 'rgba(7,26,47,0.03)',
                            border: noteText.trim() ? '1px solid rgba(216,155,43,0.3)' : '1px solid rgba(7,26,47,0.06)',
                            borderRadius: 8, color: noteText.trim() ? 'var(--tekori-gold)' : 'var(--color-text-muted)',
                            fontSize: 12, cursor: noteText.trim() ? 'pointer' : 'default', fontWeight: 500,
                        }}
                    >
                        {savingNote ? 'Saving...' : 'Save Note'}
                    </button>

                    {notes.length > 0 && (
                        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {notes.map(n => (
                                <div key={n.id} style={{
                                    background: 'rgba(7,26,47,0.02)', border: '1px solid rgba(7,26,47,0.05)',
                                    borderRadius: 8, padding: '9px 12px',
                                }}>
                                    <div style={{ fontSize: 11, color: 'rgba(16,32,51,0.74)', lineHeight: 1.6 }}>{n.note}</div>
                                    <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 4 }}>{fmtDateTime(n.created_at)}</div>
                                    {n.retention_status && (
                                        <Badge label={n.retention_status} colors={{ bg: 'rgba(244,182,66,0.1)', text: 'var(--tekori-amber)' }} />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Inline expandable action row
function ActionItem({
    label, color, expanded, onToggle,
    input, onInputChange, inputPlaceholder,
    loading, onConfirm, confirmLabel, noInput, destructive,
}: {
    id: string; label: string; color: string; expanded: boolean; onToggle: () => void;
    input?: string; onInputChange?: (v: string) => void; inputPlaceholder?: string;
    loading: boolean; onConfirm: () => void; confirmLabel: string;
    noInput?: boolean; destructive?: boolean;
}) {
    return (
        <div style={{ marginBottom: 8 }}>
            <button
                onClick={onToggle}
                style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8, textAlign: 'left',
                    background: expanded ? `color-mix(in srgb, ${color} 7%, transparent)` : 'rgba(7,26,47,0.03)',
                    border: expanded ? `1px solid color-mix(in srgb, ${color} 18%, transparent)` : '1px solid rgba(7,26,47,0.06)',
                    color: expanded ? color : 'rgba(16,32,51,0.74)', fontSize: 12, cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontFamily: "var(--tekori-font-ui)", transition: 'all 0.15s',
                }}
            >
                <span>{label}</span>
                <span style={{ fontSize: 10, color: expanded ? color : 'var(--color-text-muted)' }}>{expanded ? '▲' : '▼'}</span>
            </button>

            {expanded && (
                <div style={{
                    background: 'rgba(7,26,47,0.02)', border: `1px solid ${color}20`,
                    borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '10px 12px',
                    animation: 'fadeSlideUp 0.2s ease',
                }}>
                    {!noInput && (
                        <input
                            value={input ?? ''}
                            onChange={e => onInputChange?.(e.target.value)}
                            placeholder={inputPlaceholder}
                            style={{
                                width: '100%', background: 'rgba(7,26,47,0.04)',
                                border: '1px solid rgba(7,26,47,0.1)', borderRadius: 6,
                                padding: '8px 10px', color: 'var(--color-text)', fontSize: 12,
                                fontFamily: "var(--tekori-font-ui)", marginBottom: 8,
                                boxSizing: 'border-box', outline: 'none',
                            }}
                        />
                    )}
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        style={{
                            padding: '8px 16px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                            cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
                            background: destructive ? 'rgba(245,68,67,0.15)' : `color-mix(in srgb, ${color} 10%, transparent)`,
                            border: `1px solid ${destructive ? 'rgba(245,68,67,0.3)' : `${color}35`}`,
                            color: destructive ? '#F54443' : color,
                            fontFamily: "var(--tekori-font-ui)",
                        }}
                    >
                        {loading ? 'Working...' : confirmLabel}
                    </button>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// FILTER BAR
// ─────────────────────────────────────────────────────────────
const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'active_sub', label: 'Paying' },
    { key: 'trial', label: 'Trial' },
    { key: 'canceled', label: 'Canceled' },
    { key: 'suspended', label: 'Suspended' },
    { key: 'comped', label: 'Comped' },
    { key: 'past_due', label: 'Past Due' },
];

function applyFilter(users: AdminUser[], filter: string, search: string): AdminUser[] {
    let result = users;
    const q = search.toLowerCase().trim();
    if (q) {
        result = result.filter(u =>
            (u.name ?? '').toLowerCase().includes(q) ||
            (u.email ?? '').toLowerCase().includes(q) ||
            (u.business_name ?? '').toLowerCase().includes(q)
        );
    }
    switch (filter) {
        case 'active_sub': return result.filter(u => u.access?.subscription_status === 'active' && u.access?.access_status === 'active');
        case 'trial':      return result.filter(u => u.access?.subscription_status === 'trial');
        case 'canceled':   return result.filter(u => u.access?.subscription_status === 'canceled');
        case 'suspended':  return result.filter(u => u.access?.access_status === 'suspended');
        case 'comped':     return result.filter(u => u.access?.is_family_comp || u.access?.subscription_status === 'comped' || u.access?.subscription_status === 'gifted');
        case 'past_due':   return result.filter(u => u.access?.subscription_status === 'past_due' || u.access?.subscription_status === 'unpaid');
        default:           return result;
    }
}

// ─────────────────────────────────────────────────────────────
// MAIN ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────
interface Props {
    userId: string;
    onBack: () => void;
}

export default function AdminDashboard({ userId, onBack }: Props) {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [vaultUsage, setVaultUsage] = useState<AdminVaultUsageSummary | null>(null);
    const [vaultUsageLoading, setVaultUsageLoading] = useState(true);
    const [vaultUsageError, setVaultUsageError] = useState<string | null>(null);

    useEffect(() => {
        fetchUsers();
        fetchVaultUsage();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        const data = await loadAdminUsers();
        setUsers(data);
        setLoading(false);
    };

    const fetchVaultUsage = async () => {
        setVaultUsageLoading(true);
        setVaultUsageError(null);
        try {
            const data = await loadAdminVaultUsage();
            setVaultUsage(data);
        } catch (error) {
            setVaultUsageError(error instanceof Error ? error.message : 'Unable to load vault usage.');
        } finally {
            setVaultUsageLoading(false);
        }
    };

    const filtered = useMemo(() => applyFilter(users, filter, search), [users, filter, search]);

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'var(--tekori-deep-navy)', zIndex: 100,
            fontFamily: "var(--tekori-font-ui)", color: 'var(--color-text)',
            display: 'flex', flexDirection: 'column',
        }}>
            {/* Header */}
            <div style={{
                padding: 'max(14px, calc(10px + env(safe-area-inset-top))) 16px 12px',
                borderBottom: '1px solid rgba(7,26,47,0.07)',
                flexShrink: 0, background: 'rgba(255,252,246,0.97)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <button onClick={onBack} style={{
                        background: 'rgba(7,26,47,0.05)', border: '1px solid rgba(7,26,47,0.1)',
                        borderRadius: 8, padding: '7px 12px', color: 'rgba(16,32,51,0.74)', fontSize: 12, cursor: 'pointer',
                    }}>
                        ←
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icons.sidebar.admin size={16} />
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>Admin Dashboard</span>
                    </div>
                    {loading && <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 4 }}>Loading...</div>}
                </div>

                {/* Stats */}
                {!loading && <StatsBar users={users} />}
                <VaultUsageBar usage={vaultUsage} loading={vaultUsageLoading} error={vaultUsageError} />
            </div>

            {/* Filter + search */}
            <div style={{
                padding: '10px 16px 0', borderBottom: '1px solid rgba(7,26,47,0.06)',
                flexShrink: 0, background: 'var(--tekori-deep-navy)',
            }}>
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, email, or business..."
                    style={{
                        width: '100%', background: 'rgba(7,26,47,0.04)',
                        border: '1px solid rgba(7,26,47,0.1)', borderRadius: 10,
                        padding: '9px 14px', color: 'var(--color-text)', fontSize: 13,
                        fontFamily: "var(--tekori-font-ui)", outline: 'none',
                        boxSizing: 'border-box', marginBottom: 10,
                    }}
                />
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10 }}>
                    {FILTERS.map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            style={{
                                padding: '5px 13px', borderRadius: 20, fontSize: 11,
                                flexShrink: 0, cursor: 'pointer',
                                background: filter === f.key ? 'rgba(216,155,43,0.15)' : 'rgba(7,26,47,0.04)',
                                border: filter === f.key ? '1px solid rgba(216,155,43,0.35)' : '1px solid rgba(7,26,47,0.08)',
                                color: filter === f.key ? 'var(--tekori-gold)' : 'var(--color-text-muted)',
                                fontFamily: "var(--tekori-font-ui)", fontWeight: filter === f.key ? 600 : 400,
                                transition: 'all 0.15s',
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* User list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', paddingBottom: 32 }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)', fontSize: 13 }}>
                        Loading accounts...
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)', fontSize: 13 }}>
                        {search || filter !== 'all' ? 'No users match this filter.' : 'No users yet.'}
                    </div>
                ) : (
                    <>
                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 10, letterSpacing: '0.08em' }}>
                            {filtered.length} {filtered.length === 1 ? 'user' : 'users'}{filter !== 'all' || search ? ' (filtered)' : ''}
                        </div>
                        {filtered.map(u => (
                            <UserRow key={u.id} user={u} onClick={() => setSelectedUser(u)} />
                        ))}
                    </>
                )}
            </div>

            {/* User detail panel */}
            {selectedUser && (
                <UserDetailPanel
                    user={selectedUser}
                    adminId={userId}
                    onClose={() => setSelectedUser(null)}
                    onUpdated={fetchUsers}
                />
            )}
        </div>
    );
}
