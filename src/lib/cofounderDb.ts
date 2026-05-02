import { supabase } from '../supabase';
import { recordMeaningfulActivity } from '../db';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface CofounderTeam {
    id: string;
    business_name: string;
    owner_id: string;
    created_at: string;
}

export interface CofounderMember {
    id: string;
    team_id: string;
    user_id: string;
    role: string;
    display_name: string;
    invited_by: string | null;
    joined_at: string;
    last_seen_at?: string | null;
}

export interface CofounderInvite {
    id: string;
    team_id: string;
    token: string;
    created_by: string;
    created_at: string;
    used_at: string | null;
}

export interface CofounderMessage {
    id: string;
    team_id: string;
    user_id: string | null;
    role: 'member' | 'forge';
    sender_name: string;
    sender_role: string;
    content: string;
    created_at: string;
}

export interface CofounderTask {
    id: string;
    team_id: string;
    created_by: string | null;
    assigned_to: string | null;
    title: string;
    description: string | null;
    status: 'todo' | 'in_progress' | 'done';
    priority: 'low' | 'normal' | 'high';
    due_date: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
}

// ── TEAM ──────────────────────────────────────────────────────

export async function getTeamForUser(userId: string): Promise<CofounderTeam | null> {
    const { data: memberRow } = await supabase
        .from('cofounder_members')
        .select('team_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

    if (!memberRow?.team_id) return null;

    const { data: team } = await supabase
        .from('cofounder_teams')
        .select('*')
        .eq('id', memberRow.team_id)
        .single();

    return (team as CofounderTeam) ?? null;
}

export async function createTeam(
    userId: string,
    businessName: string,
    displayName: string
): Promise<CofounderTeam | null> {
    const { data: team, error } = await supabase
        .from('cofounder_teams')
        .insert({ business_name: businessName, owner_id: userId })
        .select()
        .single();

    if (error || !team) { console.error('createTeam error:', error?.message); return null; }

    await supabase.from('cofounder_members').insert({
        team_id: team.id,
        user_id: userId,
        role: 'Founder',
        display_name: displayName,
        invited_by: null,
        last_seen_at: new Date().toISOString(),
    });

    return team as CofounderTeam;
}

// ── MEMBERS ───────────────────────────────────────────────────

export async function getTeamMembers(teamId: string): Promise<CofounderMember[]> {
    const { data, error } = await supabase
        .from('cofounder_members')
        .select('*')
        .eq('team_id', teamId)
        .order('joined_at', { ascending: true });

    if (error) console.error('getTeamMembers error:', error.message);
    return (data as CofounderMember[]) ?? [];
}

export async function updateMemberRole(
    memberId: string,
    userId: string,
    newRole: string
): Promise<boolean> {
    const { error } = await supabase
        .from('cofounder_members')
        .update({ role: newRole })
        .eq('id', memberId);

    if (error) { console.error('updateMemberRole error:', error.message); return false; }
    return true;
}

export async function removeMember(memberId: string): Promise<boolean> {
    const { error } = await supabase
        .from('cofounder_members')
        .delete()
        .eq('id', memberId);

    if (error) { console.error('removeMember error:', error.message); return false; }
    return true;
}

export async function updateMemberLastSeen(memberId: string): Promise<void> {
    await supabase
        .from('cofounder_members')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', memberId);
}

// ── INVITES ───────────────────────────────────────────────────

export async function createInvite(teamId: string, userId: string): Promise<CofounderInvite | null> {
    const { data, error } = await supabase
        .from('cofounder_invites')
        .insert({ team_id: teamId, created_by: userId })
        .select()
        .single();

    if (error) console.error('createInvite error:', error.message);
    return (data as CofounderInvite) ?? null;
}

export async function getActiveInviteForTeam(teamId: string): Promise<CofounderInvite | null> {
    const { data } = await supabase
        .from('cofounder_invites')
        .select('*')
        .eq('team_id', teamId)
        .is('used_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    return (data as CofounderInvite) ?? null;
}

export async function getInviteByToken(
    token: string
): Promise<(CofounderInvite & { team: CofounderTeam }) | null> {
    const { data: invite } = await supabase
        .from('cofounder_invites')
        .select('*')
        .eq('token', token)
        .is('used_at', null)
        .maybeSingle();

    if (!invite) return null;

    const { data: team } = await supabase
        .from('cofounder_teams')
        .select('*')
        .eq('id', (invite as CofounderInvite).team_id)
        .single();

    if (!team) return null;
    return { ...(invite as CofounderInvite), team: team as CofounderTeam };
}

export async function acceptInvite(
    token: string,
    userId: string,
    displayName: string,
    role: string = 'Cofounder'
): Promise<{ success: boolean; teamId?: string }> {
    const invite = await getInviteByToken(token);
    if (!invite) return { success: false };

    const { data: existing } = await supabase
        .from('cofounder_members')
        .select('id')
        .eq('team_id', invite.team_id)
        .eq('user_id', userId)
        .maybeSingle();

    if (!existing) {
        const { error } = await supabase.from('cofounder_members').insert({
            team_id: invite.team_id,
            user_id: userId,
            role,
            display_name: displayName,
            invited_by: invite.created_by,
            last_seen_at: new Date().toISOString(),
        });
        if (error) { console.error('acceptInvite error:', error.message); return { success: false }; }
    }

    // Invite remains reusable — multiple teammates can join with the same link
    return { success: true, teamId: invite.team_id };
}

export async function revokeInvite(inviteId: string): Promise<boolean> {
    const { error } = await supabase
        .from('cofounder_invites')
        .delete()
        .eq('id', inviteId);

    if (error) { console.error('revokeInvite error:', error.message); return false; }
    return true;
}

// ── MESSAGES ──────────────────────────────────────────────────

// Returns messages in chronological ASC order (newest `limit` messages).
// offset lets you page back through history: offset=0 is newest, offset=60 is the next older batch.
export async function loadCofounderMessages(
    teamId: string,
    limit = 60,
    offset = 0
): Promise<CofounderMessage[]> {
    const { data, error } = await supabase
        .from('cofounder_messages')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) console.error('loadCofounderMessages error:', error.message);
    return ((data ?? []) as CofounderMessage[]).reverse();
}

export async function sendCofounderMessage(
    teamId: string,
    userId: string | null,
    role: 'member' | 'forge',
    senderName: string,
    senderRole: string,
    content: string
): Promise<CofounderMessage | null> {
    const { data, error } = await supabase
        .from('cofounder_messages')
        .insert({ team_id: teamId, user_id: userId, role, sender_name: senderName, sender_role: senderRole, content })
        .select()
        .single();

    if (error) console.error('sendCofounderMessage error:', error.message);
    if (data && userId && role === 'member') {
        await recordMeaningfulActivity(userId, undefined, { force: true });
    }
    return (data as CofounderMessage) ?? null;
}

// Returns the most recent `limit` messages as plain text for Forge context injection.
// Ordered oldest-first so Forge reads the conversation in natural sequence.
export async function getRecentCofounderContext(teamId: string, limit = 20): Promise<string> {
    const msgs = await loadCofounderMessages(teamId, limit, 0);
    if (msgs.length === 0) return '';
    return msgs
        .map(m => `[${m.sender_name} (${m.sender_role})]: ${m.content}`)
        .join('\n');
}

// ── TASKS ─────────────────────────────────────────────────────

export async function loadCofounderTasks(teamId: string): Promise<CofounderTask[]> {
    const { data, error } = await supabase
        .from('cofounder_tasks')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

    if (error) console.error('loadCofounderTasks error:', error.message);
    return (data as CofounderTask[]) ?? [];
}

export async function createCofounderTask(
    task: Omit<CofounderTask, 'id' | 'created_at' | 'updated_at'>
): Promise<CofounderTask | null> {
    const { data, error } = await supabase
        .from('cofounder_tasks')
        .insert(task)
        .select()
        .single();

    if (error) console.error('createCofounderTask error:', error.message);
    return (data as CofounderTask) ?? null;
}

export async function updateCofounderTask(
    id: string,
    updates: Partial<Pick<CofounderTask, 'title' | 'description' | 'status' | 'priority' | 'due_date' | 'assigned_to' | 'completed_at'>>
): Promise<boolean> {
    const { error } = await supabase
        .from('cofounder_tasks')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) { console.error('updateCofounderTask error:', error.message); return false; }
    return true;
}

export async function deleteCofounderTask(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('cofounder_tasks')
        .delete()
        .eq('id', id);

    if (error) { console.error('deleteCofounderTask error:', error.message); return false; }
    return true;
}
