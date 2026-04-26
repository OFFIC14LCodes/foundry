import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { FORGE_SYSTEM_PROMPT } from '../constants/prompts';
import { streamForgeAPI } from '../lib/forgeApi';
import { applyFoundryBookCitations, buildFoundryBookContext } from '../lib/foundryBook';
import { Icons } from '../icons';
import ForgeAvatar from './ForgeAvatar';
import { MessageActions } from './AnimatedChatText';
import MicButton from './MicButton';
import type {
    CofounderTeam,
    CofounderMember,
    CofounderMessage,
} from '../lib/cofounderDb';
import {
    getTeamForUser,
    createTeam,
    getTeamMembers,
    getActiveInviteForTeam,
    createInvite,
    loadCofounderMessages,
    sendCofounderMessage,
    acceptInvite,
    getInviteByToken,
} from '../lib/cofounderDb';

// ─────────────────────────────────────────────────────────────
// ROLE CONFIG
// ─────────────────────────────────────────────────────────────
const ROLE_OPTIONS = ['Cofounder', 'CEO', 'CTO', 'COO', 'Marketing Lead', 'Product Lead'];

const ROLE_COLORS: Record<string, string> = {
    Founder: '#E8622A',
    Cofounder: '#63B3ED',
    CEO: '#F5A843',
    CTO: '#48BB78',
    COO: '#9B7FE8',
    'Marketing Lead': '#F472B6',
    'Product Lead': '#38BDF8',
    Forge: '#C8A96E',
};

function roleColor(role: string): string {
    return ROLE_COLORS[role] ?? '#888';
}

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────
interface Props {
    userId: string;
    profile: any;
    onBack: () => void;
    onTeamChanged?: (teamId: string | null) => void;
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function CofounderModeScreen({ userId, profile, onBack, onTeamChanged }: Props) {
    const [team, setTeam] = useState<CofounderTeam | null>(null);
    const [members, setMembers] = useState<CofounderMember[]>([]);
    const [messages, setMessages] = useState<CofounderMessage[]>([]);
    const [currentMember, setCurrentMember] = useState<CofounderMember | null>(null);
    const [invite, setInvite] = useState<CofounderMessage | null>(null as any);

    const [dataLoading, setDataLoading] = useState(true);
    const [chatLoading, setChatLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [joining, setJoining] = useState(false);
    const [copied, setCopied] = useState(false);
    const [generatingInvite, setGeneratingInvite] = useState(false);

    const [activeTab, setActiveTab] = useState<'chat' | 'team'>('chat');
    const [input, setInput] = useState('');
    const [teamNameInput, setTeamNameInput] = useState(profile.businessName || profile.idea?.slice(0, 40) || '');

    // Invite acceptance — read token from URL on mount
    const [pendingToken] = useState<string | null>(() => new URLSearchParams(window.location.search).get('invite'));
    const [inviteInfo, setInviteInfo] = useState<{ teamName: string; teamId: string } | null>(null);
    const [joiningRole, setJoiningRole] = useState('Cofounder');

    // Invite state (kept separate from CofounderMessage type)
    const [activeInvite, setActiveInvite] = useState<{ id: string; token: string } | null>(null);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // ── Init ────────────────────────────────────────────────────

    useEffect(() => {
        initWorkspace();
    }, []);

    const initWorkspace = async () => {
        setDataLoading(true);

        if (pendingToken) {
            const inviteData = await getInviteByToken(pendingToken);
            if (inviteData) {
                const existing = await getTeamForUser(userId);
                if (!existing) {
                    setInviteInfo({ teamName: inviteData.team.business_name, teamId: inviteData.team_id });
                    setDataLoading(false);
                    return;
                }
                // Already on a team — load their current workspace
            }
        }

        const existingTeam = await getTeamForUser(userId);
        if (existingTeam) await loadWorkspace(existingTeam);
        setDataLoading(false);
    };

    const loadWorkspace = async (t: CofounderTeam) => {
        const [fetchedMembers, fetchedMessages, fetchedInvite] = await Promise.all([
            getTeamMembers(t.id),
            loadCofounderMessages(t.id),
            getActiveInviteForTeam(t.id),
        ]);
        setTeam(t);
        setMembers(fetchedMembers);
        setMessages(fetchedMessages);
        setCurrentMember(fetchedMembers.find(m => m.user_id === userId) ?? null);
        if (fetchedInvite) setActiveInvite({ id: fetchedInvite.id, token: fetchedInvite.token });
    };

    // ── Real-time subscription ───────────────────────────────────

    useEffect(() => {
        if (!team) return;

        const channel = supabase
            .channel(`cfchat:${team.id}`)
            .on(
                'postgres_changes' as any,
                { event: 'INSERT', schema: 'public', table: 'cofounder_messages', filter: `team_id=eq.${team.id}` },
                (payload: any) => {
                    setMessages(prev => {
                        if (prev.some(m => m.id === payload.new.id)) return prev;
                        return [...prev, payload.new as CofounderMessage];
                    });
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [team?.id]);

    // ── Scroll to bottom ─────────────────────────────────────────

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, chatLoading]);

    // ── Actions ──────────────────────────────────────────────────

    const handleCreateTeam = async () => {
        if (!teamNameInput.trim() || creating) return;
        setCreating(true);
        const newTeam = await createTeam(userId, teamNameInput.trim(), profile.name);
        if (newTeam) {
            await loadWorkspace(newTeam);
            onTeamChanged?.(newTeam.id);
        }
        setCreating(false);
    };

    const handleAcceptInvite = async () => {
        if (!pendingToken || !inviteInfo || joining) return;
        setJoining(true);
        const result = await acceptInvite(pendingToken, userId, profile.name, joiningRole);
        if (result.success) {
            window.history.replaceState({}, '', window.location.pathname);
            const t = await getTeamForUser(userId);
            if (t) {
                await loadWorkspace(t);
                onTeamChanged?.(t.id);
            }
            setInviteInfo(null);
        }
        setJoining(false);
    };

    const handleGetInviteLink = async () => {
        if (!team) return;
        setGeneratingInvite(true);

        let token = activeInvite?.token;
        if (!token) {
            const newInvite = await createInvite(team.id, userId);
            if (newInvite) {
                token = newInvite.token;
                setActiveInvite({ id: newInvite.id, token: newInvite.token });
            }
        }

        if (token) {
            const url = `${window.location.origin}${window.location.pathname}?invite=${token}`;
            try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
            } catch { /* clipboard blocked */ }
        }
        setGeneratingInvite(false);
    };

    const getInviteUrl = () =>
        activeInvite ? `${window.location.origin}${window.location.pathname}?invite=${activeInvite.token}` : '';

    const handleSend = async () => {
        if (!input.trim() || chatLoading || !team || !currentMember) return;
        const text = input.trim();
        setInput('');
        setActiveTab('chat');

        const optimisticId = `opt-${Date.now()}`;
        const optimistic: CofounderMessage = {
            id: optimisticId,
            team_id: team.id,
            user_id: userId,
            role: 'member',
            sender_name: currentMember.display_name,
            sender_role: currentMember.role,
            content: text,
            created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, optimistic]);

        const saved = await sendCofounderMessage(
            team.id, userId, 'member',
            currentMember.display_name, currentMember.role, text
        );
        if (saved) setMessages(prev => prev.map(m => m.id === optimisticId ? saved : m));

        if (/@forge/i.test(text)) {
            await handleForgeReply([...messages, optimistic]);
        }
    };

    const handleForgeReply = async (contextMessages: CofounderMessage[]) => {
        if (!team) return;
        setChatLoading(true);

        const placeholderId = `forge-${Date.now()}`;
        const placeholder: CofounderMessage = {
            id: placeholderId,
            team_id: team.id,
            user_id: null,
            role: 'forge',
            sender_name: 'Forge',
            sender_role: 'AI Partner',
            content: '',
            created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, placeholder]);

        const bookContext = buildFoundryBookContext(
            Number(profile.currentStage) || 1,
            contextMessages.slice(-8).map((message) => message.content),
            2
        );

        const teamCtx = [
            `You are responding in the shared team workspace chat for ${team.business_name}.`,
            ``,
            `Team:`,
            ...members.map(m => `- ${m.display_name} (${m.role})`),
            ``,
            `This is a group conversation between the founding team. You were mentioned with @forge. Respond as Forge — direct, useful, invested. No preamble. Get right to what matters for this team.`,
            ...(bookContext.context ? ['', bookContext.context] : []),
        ].join('\n');

        const apiMsgs = contextMessages.slice(-25).map(m => ({
            role: (m.role === 'forge' ? 'assistant' : 'user') as 'assistant' | 'user',
            content: m.role === 'member'
                ? `${m.sender_name} (${m.sender_role}): ${m.content}`
                : m.content,
        }));

        try {
            let fullReply = '';
            await streamForgeAPI(
                apiMsgs,
                FORGE_SYSTEM_PROMPT.replace('{CONTEXT}', teamCtx),
                (chunk) => {
                    fullReply = applyFoundryBookCitations(chunk, bookContext.matches).cleanText;
                    setMessages(prev => prev.map(m =>
                        m.id === placeholderId ? { ...m, content: fullReply } : m
                    ));
                }
            );

            if (fullReply) {
                const clean = fullReply
                    .replace(/\[COMPLETE:\s*\w+\]/g, '')
                    .replace(/\[ADVANCE_READY\]/g, '')
                    .trim();
                const savedForge = await sendCofounderMessage(
                    team.id, null, 'forge', 'Forge', 'AI Partner', clean
                );
                if (savedForge) {
                    setMessages(prev => prev.map(m => m.id === placeholderId ? savedForge : m));
                }
            }
        } catch (err) {
            console.error('Forge group chat error:', err);
            setMessages(prev => prev.filter(m => m.id !== placeholderId));
        }

        setChatLoading(false);
    };

    // ── Shared styles ────────────────────────────────────────────

    const card = {
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        padding: '14px 16px',
        marginBottom: 12,
    } as const;

    const btnPrimary = {
        background: 'linear-gradient(135deg, #E8622A, #c9521e)',
        border: 'none',
        borderRadius: 10,
        padding: '10px 20px',
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: "'Lora', Georgia, serif",
    } as const;

    const btnSecondary = {
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: '10px 20px',
        color: '#C8C4BE',
        fontSize: 13,
        cursor: 'pointer',
        fontFamily: "'Lora', Georgia, serif",
    } as const;

    // ── Loading ──────────────────────────────────────────────────

    if (dataLoading) {
        return (
            <div style={{
                position: 'fixed', inset: 0, background: '#080809',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16,
            }}>
                <Icons.sidebar.cofounder size={28} />
                <div style={{ fontSize: 12, color: '#444', fontFamily: "'Lora', Georgia, serif", letterSpacing: '0.08em' }}>
                    Loading workspace...
                </div>
            </div>
        );
    }

    // ── Invite acceptance ────────────────────────────────────────

    if (inviteInfo) {
        return (
            <div style={{
                position: 'fixed', inset: 0, background: '#080809', fontFamily: "'Lora', Georgia, serif",
                color: '#F0EDE8', display: 'flex', flexDirection: 'column',
            }}>
                <div style={{
                    padding: 'max(16px, calc(10px + env(safe-area-inset-top))) 16px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', gap: 12,
                }}>
                    <button onClick={onBack} style={{ ...btnSecondary, padding: '7px 14px', fontSize: 12 }}>← Back</button>
                    <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>
                        You've been invited
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 20, maxWidth: 500, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
                    <div style={{ animation: 'fadeSlideUp 0.4s ease', marginBottom: 28 }}>
                        <div style={{
                            width: 52, height: 52, borderRadius: 14,
                            background: 'rgba(232,98,42,0.1)', border: '1px solid rgba(232,98,42,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
                        }}>
                            <Icons.sidebar.cofounder size={24} />
                        </div>

                        <div style={{ fontSize: 22, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, marginBottom: 6 }}>
                            Join {inviteInfo.teamName}
                        </div>
                        <div style={{ fontSize: 13, color: '#666', fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', lineHeight: 1.6 }}>
                            You've been invited to collaborate on this business inside Foundry.
                            Your team will be able to chat together and bring Forge into shared discussions.
                        </div>
                    </div>

                    <div style={{ ...card, animation: 'fadeSlideUp 0.4s ease 0.1s both' }}>
                        <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                            Your Details
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>Display Name</div>
                            <div style={{
                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#F0EDE8',
                            }}>
                                {profile.name}
                            </div>
                        </div>

                        <div>
                            <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>Your Role</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {ROLE_OPTIONS.map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setJoiningRole(r)}
                                        style={{
                                            padding: '6px 14px', borderRadius: 20, fontSize: 12,
                                            border: joiningRole === r ? 'none' : '1px solid rgba(255,255,255,0.1)',
                                            background: joiningRole === r ? `${roleColor(r)}22` : 'transparent',
                                            color: joiningRole === r ? roleColor(r) : '#666',
                                            cursor: 'pointer',
                                            fontFamily: "'Lora', Georgia, serif",
                                            outline: joiningRole === r ? `1px solid ${roleColor(r)}55` : 'none',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleAcceptInvite}
                        disabled={joining}
                        style={{ ...btnPrimary, width: '100%', padding: '13px', fontSize: 14, opacity: joining ? 0.7 : 1 }}
                    >
                        {joining ? 'Joining...' : `Join as ${joiningRole}`}
                    </button>
                </div>
            </div>
        );
    }

    // ── No team yet — Setup ──────────────────────────────────────

    if (!team || !currentMember) {
        return (
            <div style={{
                position: 'fixed', inset: 0, background: '#080809', fontFamily: "'Lora', Georgia, serif",
                color: '#F0EDE8', display: 'flex', flexDirection: 'column',
            }}>
                <div style={{
                    padding: 'max(16px, calc(10px + env(safe-area-inset-top))) 16px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', gap: 12,
                }}>
                    <button onClick={onBack} style={{ ...btnSecondary, padding: '7px 14px', fontSize: 12 }}>← Back</button>
                    <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>
                        Cofounder Mode
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 20, maxWidth: 500, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
                    <div style={{ animation: 'fadeSlideUp 0.4s ease', marginBottom: 28 }}>
                        <div style={{
                            width: 52, height: 52, borderRadius: 14,
                            background: 'rgba(232,98,42,0.1)', border: '1px solid rgba(232,98,42,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
                        }}>
                            <Icons.sidebar.cofounder size={24} />
                        </div>

                        <div style={{ fontSize: 22, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, marginBottom: 8 }}>
                            Start Your Team Workspace
                        </div>
                        <div style={{ fontSize: 13, color: '#666', fontFamily: "'Lora', Georgia, serif", fontStyle: 'italic', lineHeight: 1.7 }}>
                            Cofounder Mode gives your founding team a shared workspace inside Foundry.
                            Chat together, bring Forge into group discussions, and share context across every
                            individual Forge conversation — so no one has to repeat what's already been decided.
                        </div>
                    </div>

                    <div style={{ ...card, animation: 'fadeSlideUp 0.4s ease 0.1s both' }}>
                        <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                            Team Name
                        </div>
                        <input
                            value={teamNameInput}
                            onChange={e => setTeamNameInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateTeam()}
                            placeholder="e.g. Acme Inc or your business name"
                            autoFocus
                            style={{
                                width: '100%', background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                                padding: '11px 14px', color: '#F0EDE8', fontSize: 14,
                                fontFamily: "'Lora', Georgia, serif", boxSizing: 'border-box',
                                outline: 'none',
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                            { icon: '💬', text: 'Shared team chat for your founding team' },
                            { icon: '⚡', text: 'Tag @forge in the chat to get Forge\'s take on any discussion' },
                            { icon: '🔗', text: 'Invite link to bring cofounders and team members in' },
                            { icon: '🧠', text: 'Forge carries your team context into individual conversations' },
                        ].map(({ icon, text }) => (
                            <div key={text} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '10px 12px', background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10,
                            }}>
                                <span style={{ fontSize: 15 }}>{icon}</span>
                                <span style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>{text}</span>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleCreateTeam}
                        disabled={creating || !teamNameInput.trim()}
                        style={{
                            ...btnPrimary, width: '100%', padding: '13px', fontSize: 14,
                            marginTop: 20, opacity: (creating || !teamNameInput.trim()) ? 0.5 : 1,
                        }}
                    >
                        {creating ? 'Creating...' : 'Create Team Workspace'}
                    </button>
                </div>
            </div>
        );
    }

    // ── Main Workspace ───────────────────────────────────────────

    const isOwner = team.owner_id === userId;
    const inviteUrl = getInviteUrl();

    return (
        <div style={{
            position: 'fixed', inset: 0, background: '#080809',
            fontFamily: "'Lora', Georgia, serif", color: '#F0EDE8',
            display: 'flex', flexDirection: 'column',
        }}>
            {/* Header */}
            <div style={{
                padding: 'max(14px, calc(10px + env(safe-area-inset-top))) 16px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
                background: 'rgba(8,8,9,0.95)', backdropFilter: 'blur(12px)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={onBack} style={{ ...btnSecondary, padding: '7px 12px', fontSize: 12 }}>←</button>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <Icons.sidebar.cofounder size={14} />
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#F0EDE8' }}>Cofounder Mode</span>
                        </div>
                        <div style={{ fontSize: 10, color: '#555', marginTop: 1, fontStyle: 'italic' }}>
                            {team.business_name}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {members.slice(0, 4).map((m, i) => (
                        <div
                            key={m.id}
                            title={`${m.display_name} · ${m.role}`}
                            style={{
                                width: 26, height: 26, borderRadius: '50%',
                                background: `${roleColor(m.role)}22`,
                                border: `1.5px solid ${roleColor(m.role)}55`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 10, color: roleColor(m.role), fontWeight: 700,
                                marginLeft: i > 0 ? -6 : 0,
                            }}
                        >
                            {m.display_name.charAt(0).toUpperCase()}
                        </div>
                    ))}
                    {members.length > 4 && (
                        <div style={{ fontSize: 10, color: '#555', marginLeft: 4 }}>
                            +{members.length - 4}
                        </div>
                    )}
                </div>
            </div>

            {/* Tab bar */}
            <div style={{
                display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: '#080809', flexShrink: 0,
            }}>
                {(['chat', 'team'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            flex: 1, padding: '11px 0', background: 'transparent', border: 'none',
                            borderBottom: activeTab === tab ? '2px solid #E8622A' : '2px solid transparent',
                            color: activeTab === tab ? '#F0EDE8' : '#555',
                            fontSize: 12, fontWeight: activeTab === tab ? 600 : 400,
                            cursor: 'pointer', transition: 'all 0.15s',
                            fontFamily: "'Lora', Georgia, serif",
                        }}
                    >
                        {tab === 'chat' ? 'Team Chat' : 'Team & Invite'}
                    </button>
                ))}
            </div>

            {/* ── TEAM TAB ── */}
            {activeTab === 'team' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 32 }}>
                    <div style={{ maxWidth: 560, margin: '0 auto' }}>

                        {/* Team roster */}
                        <div style={{ marginBottom: 8 }}>
                            <div style={{
                                fontSize: 10, color: '#444', textTransform: 'uppercase',
                                letterSpacing: '0.12em', marginBottom: 12,
                            }}>
                                Team · {members.length} {members.length === 1 ? 'Member' : 'Members'}
                            </div>

                            {members.map(member => {
                                const isTeamOwner = team.owner_id === member.user_id;
                                const isMe = member.user_id === userId;
                                const color = roleColor(member.role);

                                return (
                                    <div
                                        key={member.id}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '12px 14px', marginBottom: 8,
                                            background: isMe ? 'rgba(232,98,42,0.04)' : 'rgba(255,255,255,0.02)',
                                            border: isMe ? '1px solid rgba(232,98,42,0.15)' : '1px solid rgba(255,255,255,0.06)',
                                            borderRadius: 12, animation: 'fadeSlideUp 0.3s ease',
                                        }}
                                    >
                                        <div style={{
                                            width: 38, height: 38, borderRadius: '50%',
                                            background: `${color}18`, border: `1.5px solid ${color}40`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 15, color, fontWeight: 700, flexShrink: 0,
                                        }}>
                                            {member.display_name.charAt(0).toUpperCase()}
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: 13, fontWeight: 500, color: '#F0EDE8' }}>
                                                    {member.display_name}
                                                </span>
                                                {isMe && (
                                                    <span style={{
                                                        fontSize: 9, color: '#E8622A',
                                                        background: 'rgba(232,98,42,0.1)', border: '1px solid rgba(232,98,42,0.2)',
                                                        borderRadius: 20, padding: '1px 7px', lineHeight: 1.6,
                                                    }}>
                                                        You
                                                    </span>
                                                )}
                                                {isTeamOwner && (
                                                    <span style={{
                                                        fontSize: 9, color: '#F5A843',
                                                        background: 'rgba(245,168,67,0.1)', border: '1px solid rgba(245,168,67,0.2)',
                                                        borderRadius: 20, padding: '1px 7px', lineHeight: 1.6,
                                                    }}>
                                                        Owner
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                                                <div style={{
                                                    fontSize: 10, color,
                                                    background: `${color}14`, border: `1px solid ${color}30`,
                                                    borderRadius: 20, padding: '1px 8px',
                                                }}>
                                                    {member.role}
                                                </div>
                                                {member.invited_by && !isTeamOwner && (
                                                    <div style={{ fontSize: 10, color: '#444' }}>joined via invite</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Invite section */}
                        <div style={{
                            ...{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 16px' },
                            marginTop: 20, animation: 'fadeSlideUp 0.4s ease 0.1s both',
                        }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#F0EDE8', marginBottom: 6 }}>
                                Add to Your Team
                            </div>
                            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6, marginBottom: 14 }}>
                                Share this link with cofounders or team members. Anyone with the link can join this workspace.
                            </div>

                            {inviteUrl ? (
                                <div style={{ marginBottom: 12 }}>
                                    <div style={{
                                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: 8, padding: '9px 12px', fontSize: 11,
                                        color: '#666', wordBreak: 'break-all', lineHeight: 1.5,
                                        fontFamily: 'monospace', marginBottom: 10,
                                    }}>
                                        {inviteUrl}
                                    </div>
                                </div>
                            ) : null}

                            <button
                                onClick={handleGetInviteLink}
                                disabled={generatingInvite}
                                style={{
                                    ...btnPrimary,
                                    width: '100%', padding: '11px',
                                    background: copied
                                        ? 'linear-gradient(135deg, #48BB78, #38a869)'
                                        : 'linear-gradient(135deg, #E8622A, #c9521e)',
                                    opacity: generatingInvite ? 0.7 : 1,
                                    transition: 'background 0.3s',
                                }}
                            >
                                {generatingInvite
                                    ? 'Generating...'
                                    : copied
                                        ? '✓ Link Copied'
                                        : inviteUrl
                                            ? 'Copy Invite Link'
                                            : 'Generate & Copy Invite Link'}
                            </button>

                            <div style={{ fontSize: 10, color: '#444', textAlign: 'center', marginTop: 10 }}>
                                Forge will carry shared team context into each person's individual conversations.
                            </div>
                        </div>

                        {/* Role legend */}
                        <div style={{ marginTop: 20 }}>
                            <div style={{
                                fontSize: 10, color: '#333', textTransform: 'uppercase',
                                letterSpacing: '0.1em', marginBottom: 10,
                            }}>
                                Role Colours
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {Object.entries(ROLE_COLORS).filter(([r]) => r !== 'Forge').map(([role, color]) => (
                                    <div
                                        key={role}
                                        style={{
                                            fontSize: 10, color,
                                            background: `${color}12`, border: `1px solid ${color}25`,
                                            borderRadius: 20, padding: '2px 10px',
                                        }}
                                    >
                                        {role}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── CHAT TAB ── */}
            {activeTab === 'chat' && (
                <>
                    {/* Messages area */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 8px' }}>
                        <div style={{ maxWidth: 640, margin: '0 auto' }}>

                            {messages.length === 0 && (
                                <div style={{
                                    textAlign: 'center', padding: '40px 20px',
                                    animation: 'fadeIn 0.4s ease',
                                }}>
                                    <div style={{ fontSize: 28, marginBottom: 12 }}>💬</div>
                                    <div style={{
                                        fontSize: 14, fontFamily: "'Lora', Georgia, serif",
                                        color: '#666', lineHeight: 1.7,
                                    }}>
                                        This is your team's shared workspace.
                                    </div>
                                    <div style={{ fontSize: 12, color: '#444', marginTop: 6, lineHeight: 1.7 }}>
                                        Discuss anything here. Type <strong style={{ color: '#C8C4BE' }}>@forge</strong> to bring Forge into the conversation.
                                    </div>
                                </div>
                            )}

                            {messages.map(msg => (
                                <ChatMessage
                                    key={msg.id}
                                    msg={msg}
                                    isOwn={msg.user_id === userId}
                                />
                            ))}

                            {chatLoading && (
                                <div style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 10,
                                    padding: '6px 0', animation: 'fadeSlideUp 0.2s ease',
                                }}>
                                    <ForgeAvatar size={30} />
                                    <div style={{
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.07)',
                                        borderRadius: '4px 14px 14px 14px',
                                        padding: '10px 14px',
                                    }}>
                                        <div style={{
                                            display: 'flex', gap: 4, alignItems: 'center', height: 18,
                                        }}>
                                            {[0, 1, 2].map(i => (
                                                <div
                                                    key={i}
                                                    style={{
                                                        width: 5, height: 5, borderRadius: '50%',
                                                        background: '#555',
                                                        animation: `forgePulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={chatEndRef} />
                        </div>
                    </div>

                    {/* Input area */}
                    <div style={{
                        padding: '10px 16px max(16px, calc(12px + env(safe-area-inset-bottom)))',
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        background: 'rgba(8,8,9,0.97)', flexShrink: 0,
                    }}>
                        <div style={{ maxWidth: 640, margin: '0 auto' }}>
                            {/@forge/i.test(input) && (
                                <div style={{
                                    fontSize: 10, color: '#C8A96E',
                                    marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5,
                                }}>
                                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#C8A96E', display: 'inline-block' }} />
                                    Forge will respond to your team
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                                <div style={{
                                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                    background: `${roleColor(currentMember.role)}18`,
                                    border: `1.5px solid ${roleColor(currentMember.role)}40`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 11, color: roleColor(currentMember.role), fontWeight: 700,
                                    marginBottom: 2,
                                }}>
                                    {currentMember.display_name.charAt(0).toUpperCase()}
                                </div>
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    placeholder={`Message your team${members.length > 1 ? '' : ''} — type @forge to bring Forge in`}
                                    rows={1}
                                    style={{
                                        flex: 1, resize: 'none', background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                                        padding: '9px 12px', color: '#F0EDE8', fontSize: 13,
                                        fontFamily: "'Lora', Georgia, serif", lineHeight: 1.5,
                                        outline: 'none', maxHeight: 120, overflowY: 'auto',
                                    }}
                                />
                                <MicButton
                                    value={input}
                                    onChange={setInput}
                                    disabled={chatLoading}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || chatLoading}
                                    style={{
                                        ...btnPrimary, padding: '9px 16px', flexShrink: 0,
                                        opacity: (!input.trim() || chatLoading) ? 0.4 : 1,
                                        transition: 'opacity 0.15s',
                                        marginBottom: 0,
                                    }}
                                >
                                    Send
                                </button>
                            </div>
                            <div style={{ fontSize: 10, color: '#2b2b2b', textAlign: 'center' }}>
                                Forge is an AI. Always verify important information before acting on it.
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// CHAT MESSAGE COMPONENT
// ─────────────────────────────────────────────────────────────
function ChatMessage({ msg, isOwn }: { msg: CofounderMessage; isOwn: boolean }) {
    const isForge = msg.role === 'forge';
    const color = isForge ? '#C8A96E' : (ROLE_COLORS[msg.sender_role] ?? '#888');

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: isForge ? 'row' : 'column',
                alignItems: isForge ? 'flex-start' : undefined,
                gap: isForge ? 10 : 0,
                marginBottom: 14,
                animation: 'fadeSlideUp 0.2s ease',
            }}
        >
            {isForge ? (
                <>
                    <ForgeAvatar size={30} />
                    <div>
                        <div style={{
                            fontSize: 10, color: '#C8A96E', fontWeight: 600,
                            marginBottom: 5, letterSpacing: '0.04em',
                        }}>
                            Forge · AI Partner
                        </div>
                        <div style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: '4px 14px 14px 14px',
                            padding: '10px 14px', fontSize: 13,
                            fontFamily: "'Lora', Georgia, serif",
                            lineHeight: 1.75, color: '#D8D4CE', maxWidth: 480,
                        }}>
                            {renderMessageText(msg.content)}
                        </div>
                        <MessageActions text={msg.content} />
                    </div>
                </>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
                        flexDirection: isOwn ? 'row-reverse' : 'row',
                    }}>
                        <div style={{
                            width: 20, height: 20, borderRadius: '50%',
                            background: `${color}18`, border: `1.5px solid ${color}40`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, color, fontWeight: 700,
                        }}>
                            {msg.sender_name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 10, color: '#555' }}>{msg.sender_name}</span>
                        <span style={{
                            fontSize: 9, color,
                            background: `${color}12`, border: `1px solid ${color}25`,
                            borderRadius: 20, padding: '1px 7px',
                        }}>
                            {msg.sender_role}
                        </span>
                        {isOwn && <span style={{ fontSize: 9, color: '#333' }}>You</span>}
                    </div>
                    <div style={{
                        maxWidth: '75%', padding: '9px 13px', fontSize: 13,
                        fontFamily: "'Lora', Georgia, serif", lineHeight: 1.6, whiteSpace: 'pre-wrap',
                        borderRadius: isOwn ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                        background: isOwn
                            ? `linear-gradient(135deg, ${color}22, ${color}18)`
                            : 'rgba(255,255,255,0.04)',
                        border: isOwn
                            ? `1px solid ${color}35`
                            : '1px solid rgba(255,255,255,0.07)',
                        color: '#D8D4CE',
                    }}>
                        {msg.content}
                    </div>
                </div>
            )}
        </div>
    );
}

// Light markdown: bold **text**
function renderMessageText(text: string) {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} style={{ color: '#F0EDE8', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
        }
        // Handle paragraph breaks
        const lines = part.split('\n\n');
        return lines.map((line, j) => (
            <span key={`${i}-${j}`}>
                {j > 0 && <><br /><br /></>}
                {line}
            </span>
        ));
    });
}
