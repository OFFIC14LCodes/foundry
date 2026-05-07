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

interface CofounderInvitePreviewRow {
    team_id: string;
    business_name: string;
    created_at: string;
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

export interface CofounderTaskComment {
    id: string;
    task_id: string;
    user_id: string;
    content: string;
    created_at: string;
}

export interface CofounderDecision {
    id: string;
    workspace_id: string;
    created_by: string | null;
    source_message_id: string | null;
    title: string;
    description: string | null;
    options: string[] | null;
    chosen_option: string | null;
    rationale: string | null;
    decided_at: string | null;
    created_at: string;
}

export interface CofounderFileLink {
    id: string;
    workspace_id: string;
    user_id: string;
    label: string;
    url: string;
    created_at: string;
}

export interface CofounderEmailInvite {
    id: string;
    team_id: string;
    invited_by: string;
    invited_email: string;
    token: string;
    inviter_name: string;
    team_name: string;
    status: 'pending' | 'accepted' | 'declined';
    created_at: string;
    responded_at: string | null;
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
): Promise<CofounderTeam> {
    const { data: team, error } = await supabase
        .from('cofounder_teams')
        .insert({ business_name: businessName, owner_id: userId })
        .select()
        .single();

    if (error || !team) {
        throw new Error(error?.message || 'Failed to create team');
    }

    const { error: memberError } = await supabase.from('cofounder_members').insert({
        team_id: team.id,
        user_id: userId,
        role: 'Founder',
        display_name: displayName || 'Founder',
        invited_by: null,
        last_seen_at: new Date().toISOString(),
    });

    if (memberError) {
        await supabase.from('cofounder_teams').delete().eq('id', team.id);
        throw new Error(memberError.message || 'Failed to add you to the team');
    }

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
    const { data: preview, error: previewError } = await supabase.rpc(
        'get_cofounder_invite_by_token',
        { p_token: token }
    );

    const previewRow = Array.isArray(preview) ? preview[0] as CofounderInvitePreviewRow | undefined : null;
    if (previewRow?.team_id) {
        return {
            id: '',
            team_id: previewRow.team_id,
            token,
            created_by: '',
            created_at: previewRow.created_at,
            used_at: null,
            team: {
                id: previewRow.team_id,
                business_name: previewRow.business_name,
                owner_id: '',
                created_at: previewRow.created_at,
            },
        };
    }

    if (previewError) {
        console.warn('getInviteByToken rpc fallback:', previewError.message);
    }

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
    const { data: acceptedTeamId, error: acceptError } = await supabase.rpc(
        'accept_cofounder_invite',
        {
            p_token: token,
            p_display_name: displayName || 'Founder',
            p_role: role || 'Cofounder',
        }
    );

    if (!acceptError && acceptedTeamId) {
        return { success: true, teamId: acceptedTeamId as string };
    }

    if (acceptError) {
        console.warn('acceptInvite rpc fallback:', acceptError.message);
    }

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

// ── TASK COMMENTS ─────────────────────────────────────────────

export async function loadTaskComments(taskId: string): Promise<CofounderTaskComment[]> {
    const { data, error } = await supabase
        .from('cofounder_task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

    if (error) console.error('loadTaskComments error:', error.message);
    return (data as CofounderTaskComment[]) ?? [];
}

export async function addTaskComment(
    taskId: string,
    userId: string,
    content: string
): Promise<CofounderTaskComment | null> {
    const { data, error } = await supabase
        .from('cofounder_task_comments')
        .insert({ task_id: taskId, user_id: userId, content })
        .select()
        .single();

    if (error) console.error('addTaskComment error:', error.message);
    return (data as CofounderTaskComment) ?? null;
}

export async function deleteTaskComment(commentId: string): Promise<boolean> {
    const { error } = await supabase
        .from('cofounder_task_comments')
        .delete()
        .eq('id', commentId);

    if (error) { console.error('deleteTaskComment error:', error.message); return false; }
    return true;
}

// ── DECISIONS ─────────────────────────────────────────────────

export async function loadDecisions(teamId: string): Promise<CofounderDecision[]> {
    const { data, error } = await supabase
        .from('cofounder_decisions')
        .select('*')
        .eq('workspace_id', teamId)
        .order('created_at', { ascending: false });

    if (error) console.error('loadDecisions error:', error.message);
    return (data as CofounderDecision[]) ?? [];
}

export async function createDecision(
    decision: Omit<CofounderDecision, 'id' | 'created_at'>
): Promise<CofounderDecision | null> {
    const { data, error } = await supabase
        .from('cofounder_decisions')
        .insert(decision)
        .select()
        .single();

    if (error) console.error('createDecision error:', error.message);
    return (data as CofounderDecision) ?? null;
}

export async function updateDecision(
    id: string,
    updates: Partial<Pick<CofounderDecision, 'title' | 'description' | 'options' | 'chosen_option' | 'rationale' | 'decided_at'>>
): Promise<boolean> {
    const { error } = await supabase
        .from('cofounder_decisions')
        .update(updates)
        .eq('id', id);

    if (error) { console.error('updateDecision error:', error.message); return false; }
    return true;
}

export async function deleteDecision(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('cofounder_decisions')
        .delete()
        .eq('id', id);

    if (error) { console.error('deleteDecision error:', error.message); return false; }
    return true;
}

// ── FILE LINKS ────────────────────────────────────────────────

export async function loadFileLinks(teamId: string): Promise<CofounderFileLink[]> {
    const { data, error } = await supabase
        .from('cofounder_file_links')
        .select('*')
        .eq('workspace_id', teamId)
        .order('created_at', { ascending: false });

    if (error) console.error('loadFileLinks error:', error.message);
    return (data as CofounderFileLink[]) ?? [];
}

export async function addFileLink(
    teamId: string,
    userId: string,
    label: string,
    url: string
): Promise<CofounderFileLink | null> {
    const { data, error } = await supabase
        .from('cofounder_file_links')
        .insert({ workspace_id: teamId, user_id: userId, label, url })
        .select()
        .single();

    if (error) console.error('addFileLink error:', error.message);
    return (data as CofounderFileLink) ?? null;
}

export async function deleteFileLink(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('cofounder_file_links')
        .delete()
        .eq('id', id);

    if (error) { console.error('deleteFileLink error:', error.message); return false; }
    return true;
}

// ── EMAIL INVITES ─────────────────────────────────────────────

export async function getPendingEmailInvitesForUser(): Promise<CofounderEmailInvite[]> {
    const { data, error } = await supabase
        .from('cofounder_email_invites')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) console.error('getPendingEmailInvitesForUser error:', error.message);
    return (data as CofounderEmailInvite[]) ?? [];
}

export async function respondToEmailInvite(
    inviteId: string,
    status: 'accepted' | 'declined'
): Promise<boolean> {
    const { error } = await supabase
        .from('cofounder_email_invites')
        .update({ status, responded_at: new Date().toISOString() })
        .eq('id', inviteId);

    if (error) { console.error('respondToEmailInvite error:', error.message); return false; }
    return true;
}

export async function getSentEmailInvites(teamId: string): Promise<CofounderEmailInvite[]> {
    const { data, error } = await supabase
        .from('cofounder_email_invites')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

    if (error) console.error('getSentEmailInvites error:', error.message);
    return (data as CofounderEmailInvite[]) ?? [];
}
