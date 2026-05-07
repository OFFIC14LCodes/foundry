-- cofounder_email_invites
-- Tracks per-email invitations sent by team owners.
-- Allows in-app Hub notifications for existing Foundry users.

CREATE TABLE IF NOT EXISTS cofounder_email_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES cofounder_teams(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invited_email TEXT NOT NULL,
    token TEXT NOT NULL,
    inviter_name TEXT NOT NULL DEFAULT '',
    team_name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS cofounder_email_invites_team_idx ON cofounder_email_invites(team_id);
CREATE INDEX IF NOT EXISTS cofounder_email_invites_email_idx ON cofounder_email_invites(lower(invited_email));
CREATE INDEX IF NOT EXISTS cofounder_email_invites_status_idx ON cofounder_email_invites(status);

ALTER TABLE cofounder_email_invites ENABLE ROW LEVEL SECURITY;

-- Team owner can fully manage invites they sent
CREATE POLICY owner_manage_email_invites ON cofounder_email_invites
    FOR ALL
    USING (invited_by = auth.uid());

-- Invitee can see pending invites addressed to their email
CREATE POLICY invitee_view_own_invites ON cofounder_email_invites
    FOR SELECT
    USING (lower(invited_email) = lower(auth.email()));

-- Invitee can update status (accept / decline)
CREATE POLICY invitee_respond_to_invite ON cofounder_email_invites
    FOR UPDATE
    USING (lower(invited_email) = lower(auth.email()))
    WITH CHECK (lower(invited_email) = lower(auth.email()));
