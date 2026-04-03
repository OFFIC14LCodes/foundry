import { supabase } from '../supabase';
import { recordMeaningfulActivity } from '../db';

// ─────────────────────────────────────────────────────────────
// COFOUNDER MODE — Database Layer
//
// Required Supabase tables (run in SQL editor):
//
// create table cofounder_teams (
//   id uuid primary key default gen_random_uuid(),
//   business_name text not null,
//   owner_id uuid references auth.users(id),
//   created_at timestamptz default now()
// );
//
// create table cofounder_members (
//   id uuid primary key default gen_random_uuid(),
//   team_id uuid references cofounder_teams(id) on delete cascade,
//   user_id uuid references auth.users(id),
//   role text not null default 'Cofounder',
//   display_name text not null,
//   invited_by uuid references auth.users(id),
//   joined_at timestamptz default now()
// );
//
// create table cofounder_invites (
//   id uuid primary key default gen_random_uuid(),
//   team_id uuid references cofounder_teams(id) on delete cascade,
//   token text unique not null default gen_random_uuid()::text,
//   created_by uuid references auth.users(id),
//   created_at timestamptz default now(),
//   used_at timestamptz
// );
//
// create table cofounder_messages (
//   id uuid primary key default gen_random_uuid(),
//   team_id uuid references cofounder_teams(id) on delete cascade,
//   user_id uuid,
//   role text not null,        -- 'member' | 'forge'
//   sender_name text not null,
//   sender_role text not null default '',
//   content text not null,
//   created_at timestamptz default now()
// );
//
// Enable Row Level Security as needed for your deployment.
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

    // Check if already a member
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
        });
        if (error) { console.error('acceptInvite error:', error.message); return { success: false }; }
    }

    // Invites remain reusable — multiple teammates can join with the same link
    return { success: true, teamId: invite.team_id };
}

// ── MESSAGES ──────────────────────────────────────────────────

export async function loadCofounderMessages(teamId: string, limit = 60): Promise<CofounderMessage[]> {
    const { data, error } = await supabase
        .from('cofounder_messages')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: true })
        .limit(limit);

    if (error) console.error('loadCofounderMessages error:', error.message);
    return (data as CofounderMessage[]) ?? [];
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

// Fetches recent team chat formatted as plain text for Forge context injection.
export async function getRecentCofounderContext(teamId: string, limit = 20): Promise<string> {
    const msgs = await loadCofounderMessages(teamId, limit);
    if (msgs.length === 0) return '';
    return msgs
        .map(m => `[${m.sender_name} (${m.sender_role})]: ${m.content}`)
        .join('\n');
}
