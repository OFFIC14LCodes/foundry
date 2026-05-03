import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabase';
import { FORGE_SYSTEM_PROMPT } from '../constants/prompts';
import { streamForgeAPI } from '../lib/forgeApi';
import { applyFoundryBookCitations, buildFoundryBookContext } from '../lib/foundryBook';
import { Icons } from '../icons';
import ForgeAvatar from './ForgeAvatar';
import { MessageActions } from './AnimatedChatText';
import MicButton from './MicButton';
import type { CofounderTeam, CofounderMember, CofounderMessage, CofounderTask, CofounderTaskComment, CofounderDecision, CofounderFileLink } from '../lib/cofounderDb';
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
    updateMemberRole,
    removeMember,
    revokeInvite,
    updateMemberLastSeen,
    loadCofounderTasks,
    createCofounderTask,
    updateCofounderTask,
    deleteCofounderTask,
    loadTaskComments,
    addTaskComment,
    deleteTaskComment,
    loadDecisions,
    createDecision,
    deleteDecision,
    loadFileLinks,
    addFileLink,
    deleteFileLink,
} from '../lib/cofounderDb';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type LocalMessage = CofounderMessage & { failed?: boolean };
type TaskFilter = 'all' | 'mine' | 'todo' | 'inprogress' | 'done';
type TabId = 'chat' | 'tasks' | 'decisions' | 'files' | 'team';

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
// HELPERS
// ─────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatMessageDate(iso: string): string {
    const d = new Date(iso);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (d >= today) return 'Today';
    if (d >= yesterday) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function sameDay(a: string, b: string): boolean {
    return new Date(a).toDateString() === new Date(b).toDateString();
}

function getPresence(member: CofounderMember): 'active' | 'today' | 'away' | null {
    if (!member.last_seen_at) return null;
    const now = new Date();
    const lastSeen = new Date(member.last_seen_at);
    const mins = (now.getTime() - lastSeen.getTime()) / 60000;
    if (mins <= 2) return 'active';
    if (now.toDateString() === lastSeen.toDateString()) return 'today';
    return 'away';
}

function presenceDotColor(p: 'active' | 'today' | 'away'): string {
    if (p === 'active') return '#48BB78';
    if (p === 'today') return '#F5A843';
    return '#444';
}

function isOverdue(dueDate: string | null): boolean {
    if (!dueDate) return false;
    return new Date(dueDate + 'T23:59:59') < new Date();
}

function formatDueDate(dueDate: string | null): string | null {
    if (!dueDate) return null;
    return new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function nextStatus(s: string): CofounderTask['status'] {
    if (s === 'todo') return 'in_progress';
    if (s === 'in_progress') return 'done';
    return 'todo';
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
    // ── Core data ────────────────────────────────────────────────
    const [team, setTeam] = useState<CofounderTeam | null>(null);
    const [members, setMembers] = useState<CofounderMember[]>([]);
    const [messages, setMessages] = useState<LocalMessage[]>([]);
    const [currentMember, setCurrentMember] = useState<CofounderMember | null>(null);
    const [tasks, setTasks] = useState<CofounderTask[]>([]);

    // ── Loading states ───────────────────────────────────────────
    const [dataLoading, setDataLoading] = useState(true);
    const [chatLoading, setChatLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [joining, setJoining] = useState(false);
    const [copied, setCopied] = useState(false);
    const [generatingInvite, setGeneratingInvite] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [savingTask, setSavingTask] = useState(false);

    // ── Pagination ───────────────────────────────────────────────
    const [messageOffset, setMessageOffset] = useState(60);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);

    // ── Navigation ───────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState<TabId>('chat');

    // ── Input ────────────────────────────────────────────────────
    const [input, setInput] = useState('');
    const [teamNameInput, setTeamNameInput] = useState(profile.businessName || profile.idea?.slice(0, 40) || '');

    // ── Invite acceptance ────────────────────────────────────────
    const [pendingToken] = useState<string | null>(() => new URLSearchParams(window.location.search).get('invite'));
    const [inviteInfo, setInviteInfo] = useState<{ teamName: string; teamId: string } | null>(null);
    const [joiningRole, setJoiningRole] = useState('Cofounder');
    const [activeInvite, setActiveInvite] = useState<{ id: string; token: string } | null>(null);

    // ── Error states ─────────────────────────────────────────────
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [createTeamError, setCreateTeamError] = useState<string | null>(null);

    // ── Role editing ─────────────────────────────────────────────
    const [editingRoleFor, setEditingRoleFor] = useState<string | null>(null);

    // ── Confirmations ────────────────────────────────────────────
    const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [confirmRevokeInvite, setConfirmRevokeInvite] = useState(false);

    // ── Tasks ────────────────────────────────────────────────────
    const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
    const [addTaskOpen, setAddTaskOpen] = useState(false);
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
    const [editingDescription, setEditingDescription] = useState('');
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDescription, setNewTaskDescription] = useState('');
    const [newTaskAssignedTo, setNewTaskAssignedTo] = useState<string | null>(null);
    const [newTaskPriority, setNewTaskPriority] = useState<CofounderTask['priority']>('normal');
    const [newTaskDueDate, setNewTaskDueDate] = useState('');

    // ── Task comments ────────────────────────────────────────────
    const [taskComments, setTaskComments] = useState<Record<string, CofounderTaskComment[]>>({});
    const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
    const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});

    // ── Decisions ────────────────────────────────────────────────
    const [decisions, setDecisions] = useState<CofounderDecision[]>([]);
    const [addDecisionOpen, setAddDecisionOpen] = useState(false);
    const [expandedDecisionId, setExpandedDecisionId] = useState<string | null>(null);
    const [decisionFromMsg, setDecisionFromMsg] = useState<LocalMessage | null>(null);
    const [newDecisionTitle, setNewDecisionTitle] = useState('');
    const [newDecisionDescription, setNewDecisionDescription] = useState('');
    const [newDecisionOptions, setNewDecisionOptions] = useState('');
    const [newDecisionChosen, setNewDecisionChosen] = useState('');
    const [newDecisionRationale, setNewDecisionRationale] = useState('');
    const [savingDecision, setSavingDecision] = useState(false);

    // ── File links ───────────────────────────────────────────────
    const [fileLinks, setFileLinks] = useState<CofounderFileLink[]>([]);
    const [addFileOpen, setAddFileOpen] = useState(false);
    const [newFileLabel, setNewFileLabel] = useState('');
    const [newFileUrl, setNewFileUrl] = useState('');
    const [savingFile, setSavingFile] = useState(false);

    // ── Message hover (timestamps) ───────────────────────────────
    const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

    // ── Refs ─────────────────────────────────────────────────────
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isPrependingRef = useRef(false);

    // ── Init ────────────────────────────────────────────────────

    useEffect(() => { initWorkspace(); }, []);

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
            }
        }

        const existingTeam = await getTeamForUser(userId);
        if (existingTeam) await loadWorkspace(existingTeam);
        setDataLoading(false);
    };

    const loadWorkspace = async (t: CofounderTeam) => {
        const [fetchedMembers, fetchedMessages, fetchedInvite, fetchedTasks, fetchedDecisions, fetchedFiles] = await Promise.all([
            getTeamMembers(t.id),
            loadCofounderMessages(t.id, 60, 0),
            getActiveInviteForTeam(t.id),
            loadCofounderTasks(t.id),
            loadDecisions(t.id),
            loadFileLinks(t.id),
        ]);
        setTeam(t);
        setMembers(fetchedMembers);
        setMessages(fetchedMessages);
        setTasks(fetchedTasks);
        setDecisions(fetchedDecisions);
        setFileLinks(fetchedFiles);
        setHasMoreMessages(fetchedMessages.length === 60);
        setMessageOffset(60);
        setCurrentMember(fetchedMembers.find(m => m.user_id === userId) ?? null);
        if (fetchedInvite) setActiveInvite({ id: fetchedInvite.id, token: fetchedInvite.token });
    };

    // ── Presence heartbeat (update last_seen_at every 60s) ──────

    useEffect(() => {
        if (!currentMember?.id) return;
        updateMemberLastSeen(currentMember.id).catch(() => {});
        const interval = setInterval(() => {
            updateMemberLastSeen(currentMember.id).catch(() => {});
        }, 60000);
        return () => clearInterval(interval);
    }, [currentMember?.id]);

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
                        return [...prev, payload.new as LocalMessage];
                    });
                }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [team?.id]);

    // ── Realtime: task updates ───────────────────────────────────

    useEffect(() => {
        if (!team) return;
        const channel = supabase
            .channel(`cftasks:${team.id}`)
            .on(
                'postgres_changes' as any,
                { event: '*', schema: 'public', table: 'cofounder_tasks', filter: `team_id=eq.${team.id}` },
                (payload: any) => {
                    if (payload.eventType === 'INSERT') {
                        setTasks(prev => prev.some(t => t.id === payload.new.id) ? prev : [payload.new as CofounderTask, ...prev]);
                    } else if (payload.eventType === 'UPDATE') {
                        setTasks(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t));
                    } else if (payload.eventType === 'DELETE') {
                        setTasks(prev => prev.filter(t => t.id !== payload.old.id));
                    }
                }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [team?.id]);

    // ── Scroll to bottom ─────────────────────────────────────────

    useEffect(() => {
        if (isPrependingRef.current) { isPrependingRef.current = false; return; }
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, chatLoading]);

    // ── Error auto-clear ─────────────────────────────────────────

    useEffect(() => {
        if (!inviteError) return;
        const t = setTimeout(() => setInviteError(null), 4000);
        return () => clearTimeout(t);
    }, [inviteError]);

    useEffect(() => {
        if (!createTeamError) return;
        const t = setTimeout(() => setCreateTeamError(null), 5000);
        return () => clearTimeout(t);
    }, [createTeamError]);

    // ── Expanded task description sync + load comments ───────────

    useEffect(() => {
        if (expandedTaskId) {
            const t = tasks.find(t => t.id === expandedTaskId);
            setEditingDescription(t?.description ?? '');
            handleLoadComments(expandedTaskId);
        }
    }, [expandedTaskId]);

    // ── Actions ──────────────────────────────────────────────────

    const handleCreateTeam = async () => {
        if (!teamNameInput.trim() || creating) return;
        setCreating(true);
        setCreateTeamError(null);
        const newTeam = await createTeam(userId, teamNameInput.trim(), profile.name);
        if (newTeam) {
            await loadWorkspace(newTeam);
            onTeamChanged?.(newTeam.id);
        } else {
            setCreateTeamError('Something went wrong creating your workspace. Please try again.');
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
            if (t) { await loadWorkspace(t); onTeamChanged?.(t.id); }
            setInviteInfo(null);
        }
        setJoining(false);
    };

    const handleGetInviteLink = async () => {
        if (!team || !currentMember) return;

        if (currentMember.user_id !== team.owner_id) {
            setInviteError('Only the team owner can generate invite links.');
            return;
        }

        setGeneratingInvite(true);
        let token = activeInvite?.token;
        if (!token) {
            const newInvite = await createInvite(team.id, userId);
            if (newInvite) {
                token = newInvite.token;
                setActiveInvite({ id: newInvite.id, token: newInvite.token });
            } else {
                setInviteError('Failed to generate invite link. Please try again.');
                setGeneratingInvite(false);
                return;
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

    const handleLoadMore = async () => {
        if (!team || loadingMore) return;
        setLoadingMore(true);
        const prevScrollHeight = scrollContainerRef.current?.scrollHeight ?? 0;
        const older = await loadCofounderMessages(team.id, 60, messageOffset);
        if (older.length > 0) {
            isPrependingRef.current = true;
            setMessages(prev => [...older, ...prev]);
            setHasMoreMessages(older.length === 60);
            setMessageOffset(prev => prev + 60);
            requestAnimationFrame(() => {
                if (scrollContainerRef.current) {
                    const newScrollHeight = scrollContainerRef.current.scrollHeight;
                    scrollContainerRef.current.scrollTop = newScrollHeight - prevScrollHeight;
                }
            });
        } else {
            setHasMoreMessages(false);
        }
        setLoadingMore(false);
    };

    const handleSend = async () => {
        if (!input.trim() || chatLoading || !team || !currentMember) return;
        const text = input.trim();
        setInput('');
        setActiveTab('chat');

        const optimisticId = `opt-${Date.now()}`;
        const optimistic: LocalMessage = {
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

        // Update presence
        updateMemberLastSeen(currentMember.id).catch(() => {});

        const saved = await sendCofounderMessage(
            team.id, userId, 'member',
            currentMember.display_name, currentMember.role, text
        );

        if (saved) {
            setMessages(prev => prev.map(m => m.id === optimisticId ? saved : m));
            if (/@forge/i.test(text)) {
                await handleForgeReply(messages.concat(saved));
            }
        } else {
            setMessages(prev => prev.map(m => m.id === optimisticId ? { ...m, failed: true } : m));
        }
    };

    const handleRetryMessage = async (failedId: string, content: string) => {
        if (!team || !currentMember) return;
        setMessages(prev => prev.map(m => m.id === failedId ? { ...m, failed: false } : m));
        const saved = await sendCofounderMessage(
            team.id, userId, 'member',
            currentMember.display_name, currentMember.role, content
        );
        if (saved) {
            setMessages(prev => prev.map(m => m.id === failedId ? saved : m));
            if (/@forge/i.test(content)) {
                const ctx = messages.filter(m => m.id !== failedId).concat(saved);
                await handleForgeReply(ctx);
            }
        } else {
            setMessages(prev => prev.map(m => m.id === failedId ? { ...m, failed: true } : m));
        }
    };

    const handleForgeReply = useCallback(async (
        contextMessages: LocalMessage[],
        existingPlaceholderId?: string
    ) => {
        if (!team) return;
        setChatLoading(true);

        const placeholderId = existingPlaceholderId ?? `forge-${Date.now()}`;

        if (!existingPlaceholderId) {
            const placeholder: LocalMessage = {
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
        } else {
            setMessages(prev => prev.map(m =>
                m.id === placeholderId ? { ...m, content: '', failed: false } : m
            ));
        }

        const bookContext = buildFoundryBookContext(
            Number(profile.currentStage) || 1,
            contextMessages.slice(-8).map(m => m.content),
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
            setMessages(prev => prev.map(m =>
                m.id === placeholderId
                    ? { ...m, content: 'Forge ran into a problem. Tap to try again.', failed: true }
                    : m
            ));
        }

        setChatLoading(false);
    }, [team, members, profile]);

    const handleRoleChange = async (memberId: string, newRole: string) => {
        const ok = await updateMemberRole(memberId, userId, newRole);
        if (ok) {
            setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
            if (memberId === currentMember?.id) {
                setCurrentMember(prev => prev ? { ...prev, role: newRole } : prev);
            }
        }
        setEditingRoleFor(null);
    };

    const handleRemoveMember = async () => {
        if (!confirmRemove) return;
        const ok = await removeMember(confirmRemove.id);
        if (ok) setMembers(prev => prev.filter(m => m.id !== confirmRemove.id));
        setConfirmRemove(null);
    };

    const handleLeaveTeam = async () => {
        if (!currentMember) return;
        const ok = await removeMember(currentMember.id);
        if (ok) {
            setTeam(null); setMembers([]); setMessages([]);
            setCurrentMember(null); setTasks([]);
            onTeamChanged?.(null);
        }
        setConfirmLeave(false);
    };

    const handleRevokeInvite = async () => {
        if (!activeInvite) return;
        const ok = await revokeInvite(activeInvite.id);
        if (ok) setActiveInvite(null);
        setConfirmRevokeInvite(false);
    };

    const handleConvertToTask = () => {
        if (!input.trim()) return;
        setNewTaskTitle(input.trim());
        setInput('');
        setAddTaskOpen(true);
    };

    const handleAddTask = async () => {
        if (!newTaskTitle.trim() || !team || !currentMember || savingTask) return;
        setSavingTask(true);
        const task = await createCofounderTask({
            team_id: team.id,
            created_by: userId,
            assigned_to: newTaskAssignedTo,
            title: newTaskTitle.trim(),
            description: newTaskDescription.trim() || null,
            status: 'todo',
            priority: newTaskPriority,
            due_date: newTaskDueDate || null,
            completed_at: null,
        });
        if (task) {
            setTasks(prev => [task, ...prev]);
            setAddTaskOpen(false);
            setNewTaskTitle(''); setNewTaskDescription('');
            setNewTaskAssignedTo(null); setNewTaskPriority('normal'); setNewTaskDueDate('');
        }
        setSavingTask(false);
    };

    const handleTaskStatusCycle = async (taskId: string, currentStatus: string) => {
        const next = nextStatus(currentStatus);
        const completedAt = next === 'done' ? new Date().toISOString() : null;
        const ok = await updateCofounderTask(taskId, { status: next, completed_at: completedAt });
        if (ok) {
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: next, completed_at: completedAt } : t));
        }
    };

    const handleUpdateTaskField = async (taskId: string, field: keyof CofounderTask, value: any) => {
        const ok = await updateCofounderTask(taskId, { [field]: value } as any);
        if (ok) setTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: value } : t));
    };

    const handleDeleteTask = async (taskId: string) => {
        const ok = await deleteCofounderTask(taskId);
        if (ok) {
            setTasks(prev => prev.filter(t => t.id !== taskId));
            if (expandedTaskId === taskId) setExpandedTaskId(null);
        }
    };

    // ── Task comment handlers ────────────────────────────────────

    const handleLoadComments = async (taskId: string) => {
        if (taskComments[taskId] !== undefined) return;
        setLoadingComments(prev => ({ ...prev, [taskId]: true }));
        const comments = await loadTaskComments(taskId);
        setTaskComments(prev => ({ ...prev, [taskId]: comments }));
        setLoadingComments(prev => ({ ...prev, [taskId]: false }));
    };

    const handleAddComment = async (taskId: string) => {
        const content = (commentInputs[taskId] ?? '').trim();
        if (!content || !currentMember) return;
        setCommentInputs(prev => ({ ...prev, [taskId]: '' }));
        const comment = await addTaskComment(taskId, userId, content);
        if (comment) {
            setTaskComments(prev => ({ ...prev, [taskId]: [...(prev[taskId] ?? []), comment] }));
        }
    };

    const handleDeleteComment = async (taskId: string, commentId: string) => {
        const ok = await deleteTaskComment(commentId);
        if (ok) setTaskComments(prev => ({ ...prev, [taskId]: (prev[taskId] ?? []).filter(c => c.id !== commentId) }));
    };

    // ── Decision handlers ────────────────────────────────────────

    const openDecisionForm = (msg?: LocalMessage) => {
        setDecisionFromMsg(msg ?? null);
        setNewDecisionTitle(msg ? msg.content.slice(0, 100) : '');
        setNewDecisionDescription(msg ? msg.content : '');
        setNewDecisionOptions('');
        setNewDecisionChosen('');
        setNewDecisionRationale('');
        setAddDecisionOpen(true);
    };

    const handleAddDecision = async () => {
        if (!newDecisionTitle.trim() || !team || !currentMember || savingDecision) return;
        setSavingDecision(true);
        const options = newDecisionOptions.trim()
            ? newDecisionOptions.split('\n').map(s => s.trim()).filter(Boolean)
            : null;
        const decision = await createDecision({
            workspace_id: team.id,
            created_by: userId,
            source_message_id: decisionFromMsg?.id ?? null,
            title: newDecisionTitle.trim(),
            description: newDecisionDescription.trim() || null,
            options,
            chosen_option: newDecisionChosen.trim() || null,
            rationale: newDecisionRationale.trim() || null,
            decided_at: new Date().toISOString(),
        });
        if (decision) {
            setDecisions(prev => [decision, ...prev]);
            setAddDecisionOpen(false);
            setActiveTab('decisions');
        }
        setSavingDecision(false);
    };

    const handleDeleteDecision = async (id: string) => {
        const ok = await deleteDecision(id);
        if (ok) {
            setDecisions(prev => prev.filter(d => d.id !== id));
            if (expandedDecisionId === id) setExpandedDecisionId(null);
        }
    };

    // ── File link handlers ───────────────────────────────────────

    const handleAddFileLink = async () => {
        if (!newFileLabel.trim() || !newFileUrl.trim() || !team || !currentMember || savingFile) return;
        setSavingFile(true);
        const link = await addFileLink(team.id, userId, newFileLabel.trim(), newFileUrl.trim());
        if (link) {
            setFileLinks(prev => [link, ...prev]);
            setAddFileOpen(false);
            setNewFileLabel('');
            setNewFileUrl('');
        }
        setSavingFile(false);
    };

    const handleDeleteFileLink = async (id: string) => {
        const ok = await deleteFileLink(id);
        if (ok) setFileLinks(prev => prev.filter(f => f.id !== id));
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

    const inviteUrl = getInviteUrl();
    const isOwner = team?.owner_id === userId;

    // ── Loading ──────────────────────────────────────────────────

    if (dataLoading) {
        return (
            <div style={{ position: 'fixed', inset: 0, background: '#080809', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
                <Icons.sidebar.cofounder size={28} />
                <div style={{ fontSize: 12, color: '#444', fontFamily: "'Lora', Georgia, serif", letterSpacing: '0.08em' }}>Loading workspace...</div>
            </div>
        );
    }

    // ── Invite acceptance ────────────────────────────────────────

    if (inviteInfo) {
        return (
            <div style={{ position: 'fixed', inset: 0, background: '#080809', fontFamily: "'Lora', Georgia, serif", color: '#F0EDE8', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: 'max(16px, calc(10px + env(safe-area-inset-top))) 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={onBack} style={{ ...btnSecondary, padding: '7px 14px', fontSize: 12 }}>← Back</button>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>You've been invited</div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 20, maxWidth: 500, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
                    <div style={{ animation: 'fadeSlideUp 0.4s ease', marginBottom: 28 }}>
                        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(232,98,42,0.1)', border: '1px solid rgba(232,98,42,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                            <Icons.sidebar.cofounder size={24} />
                        </div>
                        <div style={{ fontSize: 22, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, marginBottom: 6 }}>Join {inviteInfo.teamName}</div>
                        <div style={{ fontSize: 13, color: '#666', fontStyle: 'italic', lineHeight: 1.6 }}>You've been invited to collaborate on this business inside Foundry. Your team will be able to chat together and bring Forge into shared discussions.</div>
                    </div>
                    <div style={{ ...card, animation: 'fadeSlideUp 0.4s ease 0.1s both' }}>
                        <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Your Details</div>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>Display Name</div>
                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#F0EDE8' }}>{profile.name}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>Your Role</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {ROLE_OPTIONS.map(r => (
                                    <button key={r} onClick={() => setJoiningRole(r)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, border: joiningRole === r ? 'none' : '1px solid rgba(255,255,255,0.1)', background: joiningRole === r ? `${roleColor(r)}22` : 'transparent', color: joiningRole === r ? roleColor(r) : '#666', cursor: 'pointer', fontFamily: "'Lora', Georgia, serif", outline: joiningRole === r ? `1px solid ${roleColor(r)}55` : 'none', transition: 'all 0.15s' }}>{r}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <button onClick={handleAcceptInvite} disabled={joining} style={{ ...btnPrimary, width: '100%', padding: '13px', fontSize: 14, opacity: joining ? 0.7 : 1 }}>
                        {joining ? 'Joining...' : `Join as ${joiningRole}`}
                    </button>
                </div>
            </div>
        );
    }

    // ── No team yet — Setup ──────────────────────────────────────

    if (!team || !currentMember) {
        return (
            <div style={{ position: 'fixed', inset: 0, background: '#080809', fontFamily: "'Lora', Georgia, serif", color: '#F0EDE8', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: 'max(16px, calc(10px + env(safe-area-inset-top))) 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={onBack} style={{ ...btnSecondary, padding: '7px 14px', fontSize: 12 }}>← Back</button>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>Cofounder Mode</div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 20, maxWidth: 500, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
                    <div style={{ animation: 'fadeSlideUp 0.4s ease', marginBottom: 28 }}>
                        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(232,98,42,0.1)', border: '1px solid rgba(232,98,42,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                            <Icons.sidebar.cofounder size={24} />
                        </div>
                        <div style={{ fontSize: 22, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, marginBottom: 8 }}>Start Your Team Workspace</div>
                        <div style={{ fontSize: 13, color: '#666', fontStyle: 'italic', lineHeight: 1.7 }}>Cofounder Mode gives your founding team a shared workspace inside Foundry. Chat together, bring Forge into group discussions, and share context across every individual Forge conversation.</div>
                    </div>
                    <div style={{ ...card, animation: 'fadeSlideUp 0.4s ease 0.1s both' }}>
                        <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Team Name</div>
                        <input
                            value={teamNameInput}
                            onChange={e => setTeamNameInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateTeam()}
                            placeholder="e.g. Acme Inc or your business name"
                            autoFocus
                            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#F0EDE8', fontSize: 14, fontFamily: "'Lora', Georgia, serif", boxSizing: 'border-box', outline: 'none' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                            { icon: '💬', text: 'Shared team chat for your founding team' },
                            { icon: '⚡', text: "Tag @forge in the chat to get Forge's take on any discussion" },
                            { icon: '✅', text: 'Shared task list so nothing falls through the cracks' },
                            { icon: '🧠', text: 'Forge carries your team context into individual conversations' },
                        ].map(({ icon, text }) => (
                            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10 }}>
                                <span style={{ fontSize: 15 }}>{icon}</span>
                                <span style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>{text}</span>
                            </div>
                        ))}
                    </div>
                    {createTeamError && (
                        <div style={{ fontSize: 12, color: 'rgba(232,98,42,0.8)', textAlign: 'center', marginTop: 12 }}>{createTeamError}</div>
                    )}
                    <button
                        onClick={handleCreateTeam}
                        disabled={creating || !teamNameInput.trim()}
                        style={{ ...btnPrimary, width: '100%', padding: '13px', fontSize: 14, marginTop: 20, opacity: (creating || !teamNameInput.trim()) ? 0.5 : 1 }}
                    >
                        {creating ? 'Creating...' : 'Create Team Workspace'}
                    </button>
                </div>
            </div>
        );
    }

    // ── Main Workspace ───────────────────────────────────────────

    const filteredTasks = tasks.filter(task => {
        if (taskFilter === 'mine') return task.assigned_to === currentMember.id;
        if (taskFilter === 'todo') return task.status === 'todo';
        if (taskFilter === 'inprogress') return task.status === 'in_progress';
        if (taskFilter === 'done') return task.status === 'done';
        return true;
    });

    return (
        <div style={{ position: 'fixed', inset: 0, background: '#080809', fontFamily: "'Lora', Georgia, serif", color: '#F0EDE8', display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div style={{ padding: 'max(14px, calc(10px + env(safe-area-inset-top))) 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'rgba(8,8,9,0.95)', backdropFilter: 'blur(12px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={onBack} style={{ ...btnSecondary, padding: '7px 12px', fontSize: 12 }}>←</button>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <Icons.sidebar.cofounder size={14} />
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#F0EDE8' }}>Cofounder Mode</span>
                        </div>
                        <div style={{ fontSize: 10, color: '#555', marginTop: 1, fontStyle: 'italic' }}>{team.business_name}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {members.slice(0, 4).map((m, i) => {
                        const presence = getPresence(m);
                        return (
                            <div key={m.id} title={`${m.display_name} · ${m.role}`} style={{ position: 'relative', width: 26, height: 26, marginLeft: i > 0 ? -6 : 0 }}>
                                <div style={{ width: 26, height: 26, borderRadius: '50%', background: `${roleColor(m.role)}22`, border: `1.5px solid ${roleColor(m.role)}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: roleColor(m.role), fontWeight: 700 }}>
                                    {m.display_name.charAt(0).toUpperCase()}
                                </div>
                                {presence && (
                                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 7, height: 7, borderRadius: '50%', background: presenceDotColor(presence), border: '1.5px solid #080809' }} />
                                )}
                            </div>
                        );
                    })}
                    {members.length > 4 && <div style={{ fontSize: 10, color: '#555', marginLeft: 4 }}>+{members.length - 4}</div>}
                </div>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#080809', flexShrink: 0, overflowX: 'auto' }}>
                {([
                    { id: 'chat', label: 'Chat' },
                    { id: 'tasks', label: 'Tasks' },
                    { id: 'decisions', label: 'Decisions' },
                    { id: 'files', label: 'Files' },
                    { id: 'team', label: 'Team' },
                ] as { id: TabId; label: string }[]).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{ flex: '0 0 auto', minWidth: 60, padding: '11px 14px', background: 'transparent', border: 'none', borderBottom: activeTab === tab.id ? '2px solid #E8622A' : '2px solid transparent', color: activeTab === tab.id ? '#F0EDE8' : '#555', fontSize: 12, fontWeight: activeTab === tab.id ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s', fontFamily: "'Lora', Georgia, serif", whiteSpace: 'nowrap' }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── TEAM TAB ── */}
            {activeTab === 'team' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 32 }}>
                    <div style={{ maxWidth: 560, margin: '0 auto' }}>

                        {/* Team roster */}
                        <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
                                Team · {members.length} {members.length === 1 ? 'Member' : 'Members'}
                            </div>

                            {members.map(member => {
                                const isTeamOwner = team.owner_id === member.user_id;
                                const isMe = member.user_id === userId;
                                const color = roleColor(member.role);
                                const presence = getPresence(member);
                                const canEdit = isMe || isOwner;
                                const canRemove = isOwner && !isMe;
                                const isEditingThis = editingRoleFor === member.id;

                                return (
                                    <div key={member.id} style={{ marginBottom: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: isMe ? 'rgba(232,98,42,0.04)' : 'rgba(255,255,255,0.02)', border: isMe ? '1px solid rgba(232,98,42,0.15)' : '1px solid rgba(255,255,255,0.06)', borderRadius: isEditingThis ? '12px 12px 0 0' : 12, animation: 'fadeSlideUp 0.3s ease', position: 'relative' }}>
                                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                                <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${color}18`, border: `1.5px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color, fontWeight: 700 }}>
                                                    {member.display_name.charAt(0).toUpperCase()}
                                                </div>
                                                {presence && (
                                                    <div style={{ position: 'absolute', bottom: 1, right: 1, width: 9, height: 9, borderRadius: '50%', background: presenceDotColor(presence), border: '2px solid #080809' }} />
                                                )}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: 13, fontWeight: 500, color: '#F0EDE8' }}>{member.display_name}</span>
                                                    {isMe && <span style={{ fontSize: 9, color: '#E8622A', background: 'rgba(232,98,42,0.1)', border: '1px solid rgba(232,98,42,0.2)', borderRadius: 20, padding: '1px 7px', lineHeight: 1.6 }}>You</span>}
                                                    {isTeamOwner && <span style={{ fontSize: 9, color: '#F5A843', background: 'rgba(245,168,67,0.1)', border: '1px solid rgba(245,168,67,0.2)', borderRadius: 20, padding: '1px 7px', lineHeight: 1.6 }}>Owner</span>}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                                                    <div style={{ fontSize: 10, color, background: `${color}14`, border: `1px solid ${color}30`, borderRadius: 20, padding: '1px 8px' }}>{member.role}</div>
                                                    {canEdit && (
                                                        <button onClick={() => setEditingRoleFor(isEditingThis ? null : member.id)} style={{ fontSize: 11, color: 'rgba(240,237,232,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: 0 }}>
                                                            {isEditingThis ? 'Cancel' : 'Edit role'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {canRemove && (
                                                <button onClick={() => setConfirmRemove({ id: member.id, name: member.display_name })} title="Remove member" style={{ position: 'absolute', top: 10, right: 12, width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(240,237,232,0.3)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, fontFamily: 'sans-serif' }}>×</button>
                                            )}
                                        </div>

                                        {isEditingThis && (
                                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '10px 14px' }}>
                                                <div style={{ fontSize: 10, color: '#555', marginBottom: 8 }}>Select new role</div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                    {ROLE_OPTIONS.map(r => (
                                                        <button key={r} onClick={() => handleRoleChange(member.id, r)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, border: member.role === r ? 'none' : '1px solid rgba(255,255,255,0.1)', background: member.role === r ? `${roleColor(r)}22` : 'transparent', color: member.role === r ? roleColor(r) : '#666', cursor: 'pointer', fontFamily: "'Lora', Georgia, serif", transition: 'all 0.15s' }}>{r}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Invite section */}
                        <div style={{ ...card, marginTop: 20, animation: 'fadeSlideUp 0.4s ease 0.1s both' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#F0EDE8', marginBottom: 6 }}>Add to Your Team</div>
                            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6, marginBottom: 14 }}>Share this link with cofounders or team members. Anyone with the link can join this workspace.</div>

                            {inviteUrl && (
                                <div style={{ marginBottom: 12 }}>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '9px 12px', fontSize: 11, color: '#666', wordBreak: 'break-all', lineHeight: 1.5, fontFamily: 'monospace', marginBottom: 6 }}>
                                        {inviteUrl}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'rgba(240,237,232,0.3)', fontFamily: 'DM Sans, sans-serif', marginBottom: 10 }}>No expiration · Reusable link</div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={handleGetInviteLink} disabled={generatingInvite} style={{ ...btnPrimary, flex: 1, padding: '11px', background: copied ? 'linear-gradient(135deg, #48BB78, #38a869)' : 'linear-gradient(135deg, #E8622A, #c9521e)', opacity: generatingInvite ? 0.7 : 1, transition: 'background 0.3s' }}>
                                    {generatingInvite ? 'Generating...' : copied ? '✓ Link Copied' : inviteUrl ? 'Copy Invite Link' : 'Generate & Copy Invite Link'}
                                </button>
                                {inviteUrl && isOwner && (
                                    <button onClick={() => setConfirmRevokeInvite(true)} style={{ ...btnSecondary, padding: '11px 14px', fontSize: 12, color: 'rgba(240,237,232,0.4)', flexShrink: 0 }}>Revoke</button>
                                )}
                            </div>

                            {inviteError && (
                                <div style={{ fontSize: 12, color: 'rgba(232,98,42,0.7)', fontFamily: 'DM Sans, sans-serif', marginTop: 8, textAlign: 'center' }}>{inviteError}</div>
                            )}

                            <div style={{ fontSize: 10, color: '#333', textAlign: 'center', marginTop: 10 }}>Forge will carry shared team context into each person's individual conversations.</div>
                        </div>

                        {/* Role legend */}
                        <div style={{ marginTop: 20 }}>
                            <div style={{ fontSize: 10, color: '#333', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Role Colours</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {Object.entries(ROLE_COLORS).filter(([r]) => r !== 'Forge').map(([role, color]) => (
                                    <div key={role} style={{ fontSize: 10, color, background: `${color}12`, border: `1px solid ${color}25`, borderRadius: 20, padding: '2px 10px' }}>{role}</div>
                                ))}
                            </div>
                        </div>

                        {/* Leave team */}
                        {!isOwner && (
                            <div style={{ marginTop: 32, textAlign: 'center' }}>
                                <button onClick={() => setConfirmLeave(true)} style={{ fontSize: 12, color: 'rgba(240,237,232,0.3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: '8px 0' }}>Leave this workspace</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── TASKS TAB ── */}
            {activeTab === 'tasks' && (
                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 32 }}>
                    <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 16px 0' }}>

                        {/* Header row */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                            <div style={{ fontSize: 18, fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: '#F0EDE8' }}>Team Tasks</div>
                            <button onClick={() => setAddTaskOpen(true)} style={{ ...btnPrimary, padding: '8px 14px', fontSize: 12 }}>Add Task +</button>
                        </div>

                        {/* Filter pills */}
                        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                            {(['all', 'mine', 'todo', 'inprogress', 'done'] as TaskFilter[]).map(f => {
                                const label = f === 'all' ? 'All' : f === 'mine' ? 'My Tasks' : f === 'todo' ? 'Todo' : f === 'inprogress' ? 'In Progress' : 'Done';
                                const active = taskFilter === f;
                                return (
                                    <button key={f} onClick={() => setTaskFilter(f)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, border: active ? 'none' : '1px solid rgba(255,255,255,0.1)', background: active ? 'rgba(232,98,42,0.15)' : 'transparent', color: active ? '#E8622A' : '#666', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', outline: active ? '1px solid rgba(232,98,42,0.3)' : 'none', transition: 'all 0.15s' }}>{label}</button>
                                );
                            })}
                        </div>

                        {/* Empty state */}
                        {filteredTasks.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                                <div style={{ fontSize: 28, marginBottom: 12 }}>✅</div>
                                <div style={{ fontSize: 13, color: 'rgba(240,237,232,0.4)', lineHeight: 1.7, fontFamily: 'DM Sans, sans-serif' }}>
                                    {taskFilter === 'all' ? 'No tasks yet. Add your first one.' : 'No tasks match this filter.'}
                                </div>
                            </div>
                        )}

                        {/* Task cards */}
                        {filteredTasks.map(task => {
                            const assigneeMember = task.assigned_to ? members.find(m => m.id === task.assigned_to) : null;
                            const expanded = expandedTaskId === task.id;
                            const overdue = isOverdue(task.due_date);
                            const dueFmt = formatDueDate(task.due_date);

                            return (
                                <div key={task.id} style={{ marginBottom: 8, animation: 'fadeSlideUp 0.2s ease' }}>
                                    {/* Card header */}
                                    <div
                                        onClick={() => setExpandedTaskId(expanded ? null : task.id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: expanded ? '12px 12px 0 0' : 12, cursor: 'pointer' }}
                                    >
                                        {/* Status toggle */}
                                        <button
                                            onClick={e => { e.stopPropagation(); handleTaskStatusCycle(task.id, task.status); }}
                                            title="Cycle status"
                                            style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', border: task.status === 'done' ? 'none' : '1.5px solid rgba(255,255,255,0.25)', background: task.status === 'done' ? '#48BB78' : task.status === 'in_progress' ? 'rgba(245,168,67,0.2)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 11, color: task.status === 'done' ? '#fff' : '#F5A843', transition: 'all 0.15s' }}
                                        >
                                            {task.status === 'done' ? '✓' : task.status === 'in_progress' ? '◑' : ''}
                                        </button>

                                        {/* Title */}
                                        <span style={{ flex: 1, fontSize: 14, color: task.status === 'done' ? '#555' : '#F0EDE8', fontFamily: 'DM Sans, sans-serif', textDecoration: task.status === 'done' ? 'line-through' : 'none', lineHeight: 1.4 }}>{task.title}</span>

                                        {/* Priority badge */}
                                        {task.priority === 'high' && <span style={{ fontSize: 11, color: '#E8622A', flexShrink: 0 }}>!</span>}
                                        {task.priority === 'low' && <span style={{ fontSize: 11, color: '#555', flexShrink: 0 }}>↓</span>}

                                        {/* Due date */}
                                        {dueFmt && (
                                            <span style={{ fontSize: 11, color: overdue ? 'rgba(232,98,42,0.8)' : 'rgba(240,237,232,0.4)', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>{dueFmt}</span>
                                        )}

                                        {/* Assignee */}
                                        {assigneeMember ? (
                                            <div title={assigneeMember.display_name} style={{ width: 20, height: 20, borderRadius: '50%', background: `${roleColor(assigneeMember.role)}22`, border: `1px solid ${roleColor(assigneeMember.role)}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: roleColor(assigneeMember.role), fontWeight: 700, flexShrink: 0 }}>
                                                {assigneeMember.display_name.charAt(0).toUpperCase()}
                                            </div>
                                        ) : (
                                            <div title="Unassigned" style={{ width: 20, height: 20, borderRadius: '50%', border: '1px dashed rgba(255,255,255,0.15)', flexShrink: 0 }} />
                                        )}
                                    </div>

                                    {/* Expanded panel */}
                                    {expanded && (
                                        <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.07)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '12px 14px' }}>
                                            {/* Description */}
                                            <div style={{ marginBottom: 12 }}>
                                                <div style={{ fontSize: 10, color: '#555', marginBottom: 6 }}>Description</div>
                                                <textarea
                                                    value={editingDescription}
                                                    onChange={e => setEditingDescription(e.target.value)}
                                                    onBlur={() => handleUpdateTaskField(task.id, 'description', editingDescription || null)}
                                                    placeholder="Add details..."
                                                    rows={2}
                                                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px', color: '#C8C4BE', fontSize: 12, fontFamily: "'Lora', Georgia, serif", resize: 'none', outline: 'none', boxSizing: 'border-box' }}
                                                />
                                            </div>

                                            {/* Assignee */}
                                            <div style={{ marginBottom: 12 }}>
                                                <div style={{ fontSize: 10, color: '#555', marginBottom: 6 }}>Assignee</div>
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                    <button onClick={() => handleUpdateTaskField(task.id, 'assigned_to', null)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, border: !task.assigned_to ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.1)', background: !task.assigned_to ? 'rgba(255,255,255,0.06)' : 'transparent', color: !task.assigned_to ? '#F0EDE8' : '#555', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Unassigned</button>
                                                    {members.map(m => (
                                                        <button key={m.id} onClick={() => handleUpdateTaskField(task.id, 'assigned_to', m.id)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, border: task.assigned_to === m.id ? `1px solid ${roleColor(m.role)}55` : '1px solid rgba(255,255,255,0.1)', background: task.assigned_to === m.id ? `${roleColor(m.role)}18` : 'transparent', color: task.assigned_to === m.id ? roleColor(m.role) : '#555', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{m.display_name}</button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Priority + Due date row */}
                                            <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                                                <div>
                                                    <div style={{ fontSize: 10, color: '#555', marginBottom: 6 }}>Priority</div>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        {(['low', 'normal', 'high'] as const).map(p => (
                                                            <button key={p} onClick={() => handleUpdateTaskField(task.id, 'priority', p)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, border: task.priority === p ? 'none' : '1px solid rgba(255,255,255,0.1)', background: task.priority === p ? (p === 'high' ? 'rgba(232,98,42,0.2)' : p === 'low' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.05)') : 'transparent', color: task.priority === p ? (p === 'high' ? '#E8622A' : '#C8C4BE') : '#555', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', textTransform: 'capitalize' }}>{p}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 10, color: '#555', marginBottom: 6 }}>Due date</div>
                                                    <input
                                                        type="date"
                                                        value={task.due_date ?? ''}
                                                        onChange={e => handleUpdateTaskField(task.id, 'due_date', e.target.value || null)}
                                                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '4px 8px', color: '#C8C4BE', fontSize: 11, outline: 'none', fontFamily: 'DM Sans, sans-serif', colorScheme: 'dark' }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Comments */}
                                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, marginTop: 4, marginBottom: 12 }}>
                                                <div style={{ fontSize: 10, color: '#555', marginBottom: 8 }}>Comments</div>
                                                {loadingComments[task.id] && <div style={{ fontSize: 11, color: '#444', fontFamily: 'DM Sans, sans-serif' }}>Loading...</div>}
                                                {(taskComments[task.id] ?? []).map(c => {
                                                    const commenter = members.find(m => m.user_id === c.user_id);
                                                    return (
                                                        <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                                                            <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#888', flexShrink: 0, marginTop: 1 }}>
                                                                {(commenter?.display_name ?? '?').charAt(0).toUpperCase()}
                                                            </div>
                                                            <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '6px 10px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                                                    <span style={{ fontSize: 10, color: '#666' }}>{commenter?.display_name ?? 'Unknown'}</span>
                                                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                                        <span style={{ fontSize: 10, color: '#333' }}>{formatTime(c.created_at)}</span>
                                                                        {c.user_id === userId && (
                                                                            <button onClick={() => handleDeleteComment(task.id, c.id)} style={{ fontSize: 10, color: 'rgba(232,98,42,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>×</button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div style={{ fontSize: 12, color: '#C8C4BE', fontFamily: "'Lora', Georgia, serif", lineHeight: 1.5 }}>{c.content}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                                    <input
                                                        value={commentInputs[task.id] ?? ''}
                                                        onChange={e => setCommentInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(task.id); } }}
                                                        placeholder="Add a comment..."
                                                        style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 10px', color: '#F0EDE8', fontSize: 12, fontFamily: "'Lora', Georgia, serif", outline: 'none' }}
                                                    />
                                                    <button onClick={() => handleAddComment(task.id)} disabled={!(commentInputs[task.id] ?? '').trim()} style={{ ...btnPrimary, padding: '6px 12px', fontSize: 11, opacity: !(commentInputs[task.id] ?? '').trim() ? 0.4 : 1 }}>Post</button>
                                                </div>
                                            </div>

                                            {/* Delete */}
                                            <button onClick={() => handleDeleteTask(task.id)} style={{ fontSize: 11, color: 'rgba(232,98,42,0.5)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: 0 }}>Delete task</button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── DECISIONS TAB ── */}
            {activeTab === 'decisions' && (
                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 32 }}>
                    <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 16px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <div style={{ fontSize: 18, fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: '#F0EDE8' }}>Decision Log</div>
                            <button onClick={() => openDecisionForm()} style={{ ...btnPrimary, padding: '8px 14px', fontSize: 12 }}>Log Decision +</button>
                        </div>
                        {decisions.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                                <div style={{ fontSize: 28, marginBottom: 12 }}>🧭</div>
                                <div style={{ fontSize: 13, color: 'rgba(240,237,232,0.4)', lineHeight: 1.7, fontFamily: 'DM Sans, sans-serif' }}>No decisions logged yet. Record key choices so your team stays aligned.</div>
                            </div>
                        )}
                        {decisions.map(d => {
                            const expanded = expandedDecisionId === d.id;
                            const maker = members.find(m => m.user_id === d.created_by);
                            return (
                                <div key={d.id} style={{ marginBottom: 8, animation: 'fadeSlideUp 0.2s ease' }}>
                                    <div onClick={() => setExpandedDecisionId(expanded ? null : d.id)} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: expanded ? '12px 12px 0 0' : 12, cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 14, color: '#F0EDE8', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.4, marginBottom: 4 }}>{d.title}</div>
                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                                    {d.chosen_option && <span style={{ fontSize: 10, color: '#48BB78', background: 'rgba(72,187,120,0.1)', border: '1px solid rgba(72,187,120,0.2)', borderRadius: 20, padding: '1px 8px' }}>✓ {d.chosen_option}</span>}
                                                    <span style={{ fontSize: 10, color: '#444', fontFamily: 'DM Sans, sans-serif' }}>{maker?.display_name ?? 'Unknown'} · {new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                                </div>
                                            </div>
                                            <span style={{ fontSize: 12, color: '#555', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
                                        </div>
                                    </div>
                                    {expanded && (
                                        <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.07)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '12px 14px' }}>
                                            {d.description && <div style={{ fontSize: 13, color: '#C8C4BE', fontFamily: "'Lora', Georgia, serif", lineHeight: 1.6, marginBottom: 12 }}>{d.description}</div>}
                                            {d.options && d.options.length > 0 && (
                                                <div style={{ marginBottom: 12 }}>
                                                    <div style={{ fontSize: 10, color: '#555', marginBottom: 6 }}>Options considered</div>
                                                    {d.options.map((opt, i) => (
                                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: opt === d.chosen_option ? '#48BB78' : '#333', flexShrink: 0 }} />
                                                            <span style={{ fontSize: 12, color: opt === d.chosen_option ? '#F0EDE8' : '#666', fontFamily: 'DM Sans, sans-serif' }}>{opt}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {d.rationale && (
                                                <div style={{ marginBottom: 12 }}>
                                                    <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>Rationale</div>
                                                    <div style={{ fontSize: 12, color: '#888', fontFamily: "'Lora', Georgia, serif", lineHeight: 1.6, fontStyle: 'italic' }}>{d.rationale}</div>
                                                </div>
                                            )}
                                            <button onClick={() => handleDeleteDecision(d.id)} style={{ fontSize: 11, color: 'rgba(232,98,42,0.5)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: 0 }}>Delete</button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── FILES TAB ── */}
            {activeTab === 'files' && (
                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 32 }}>
                    <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 16px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <div style={{ fontSize: 18, fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: '#F0EDE8' }}>Shared Files</div>
                            <button onClick={() => setAddFileOpen(true)} style={{ ...btnPrimary, padding: '8px 14px', fontSize: 12 }}>Add Link +</button>
                        </div>
                        <div style={{ fontSize: 12, color: '#444', fontFamily: 'DM Sans, sans-serif', marginBottom: 16, lineHeight: 1.5 }}>Share links to Google Docs, Figma files, Notion pages, or any resource your team needs.</div>
                        {fileLinks.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                                <div style={{ fontSize: 28, marginBottom: 12 }}>📎</div>
                                <div style={{ fontSize: 13, color: 'rgba(240,237,232,0.4)', lineHeight: 1.7, fontFamily: 'DM Sans, sans-serif' }}>No files shared yet. Add links to keep your team's resources in one place.</div>
                            </div>
                        )}
                        {fileLinks.map(f => {
                            const sharer = members.find(m => m.user_id === f.user_id);
                            const canDelete = f.user_id === userId || isOwner;
                            let favicon = '';
                            try {
                                const u = new URL(f.url);
                                if (u.hostname.includes('figma')) favicon = '🎨';
                                else if (u.hostname.includes('notion')) favicon = '📝';
                                else if (u.hostname.includes('google')) favicon = '📄';
                                else favicon = '🔗';
                            } catch { favicon = '🔗'; }
                            return (
                                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, marginBottom: 8, animation: 'fadeSlideUp 0.2s ease' }}>
                                    <span style={{ fontSize: 20, flexShrink: 0 }}>{favicon}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#F0EDE8', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, textDecoration: 'none', display: 'block', marginBottom: 2 }} onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')} onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>{f.label}</a>
                                        <div style={{ fontSize: 10, color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sharer?.display_name ?? 'Unknown'} · {new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                                    </div>
                                    {canDelete && (
                                        <button onClick={() => handleDeleteFileLink(f.id)} style={{ fontSize: 13, color: 'rgba(240,237,232,0.25)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>×</button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── CHAT TAB ── */}
            {activeTab === 'chat' && (
                <>
                    <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 8px' }}>
                        <div style={{ maxWidth: 640, margin: '0 auto' }}>

                            {/* Load earlier messages */}
                            {hasMoreMessages && (
                                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                                    <button onClick={handleLoadMore} disabled={loadingMore} style={{ fontSize: 12, color: loadingMore ? '#333' : 'rgba(240,237,232,0.4)', background: 'none', border: 'none', cursor: loadingMore ? 'default' : 'pointer', padding: '8px 0', fontFamily: 'DM Sans, sans-serif' }}>
                                        {loadingMore ? 'Loading...' : '↑ Load earlier messages'}
                                    </button>
                                </div>
                            )}

                            {/* Empty state */}
                            {messages.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '48px 20px', animation: 'fadeIn 0.4s ease' }}>
                                    <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(232,98,42,0.08)', border: '1px solid rgba(232,98,42,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                        <Icons.sidebar.cofounder size={22} />
                                    </div>
                                    <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: '#F0EDE8', marginBottom: 8 }}>Your team workspace</div>
                                    <div style={{ fontSize: 13, color: 'rgba(240,237,232,0.4)', lineHeight: 1.7, fontFamily: 'DM Sans, sans-serif', marginBottom: 16 }}>
                                        This is where your founding team thinks out loud together.<br />
                                        Use <strong style={{ color: 'rgba(240,237,232,0.55)' }}>@forge</strong> to bring Forge into any conversation — ask for advice, pressure-test ideas, or get a second opinion.
                                    </div>
                                    <div style={{ fontSize: 12, color: 'rgba(240,237,232,0.25)', fontFamily: 'DM Sans, sans-serif', fontStyle: 'italic' }}>
                                        Try: @forge what should we prioritize this week?
                                    </div>
                                </div>
                            )}

                            {/* Messages with date dividers */}
                            {messages.map((msg, idx) => {
                                const prevMsg = idx > 0 ? messages[idx - 1] : null;
                                const showDivider = !prevMsg || !sameDay(prevMsg.created_at, msg.created_at);
                                return (
                                    <div key={msg.id}>
                                        {showDivider && (
                                            <div style={{ textAlign: 'center', margin: '12px 0 8px', fontSize: 11, color: 'rgba(240,237,232,0.3)', fontFamily: 'DM Sans, sans-serif' }}>
                                                {formatMessageDate(msg.created_at)}
                                            </div>
                                        )}
                                        <ChatMessage
                                            msg={msg}
                                            isOwn={msg.user_id === userId}
                                            isHovered={hoveredMessageId === msg.id}
                                            onMouseEnter={() => setHoveredMessageId(msg.id)}
                                            onMouseLeave={() => setHoveredMessageId(null)}
                                            onRetry={msg.failed && msg.role === 'member'
                                                ? () => handleRetryMessage(msg.id, msg.content)
                                                : msg.failed && msg.role === 'forge'
                                                    ? () => handleForgeReply(messages.filter(m => m.id !== msg.id), msg.id)
                                                    : undefined
                                            }
                                            onLogDecision={msg.role === 'member' && !msg.failed ? () => openDecisionForm(msg) : undefined}
                                        />
                                    </div>
                                );
                            })}

                            {/* Forge typing indicator */}
                            {chatLoading && (
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0', animation: 'fadeSlideUp 0.2s ease' }}>
                                    <ForgeAvatar size={30} />
                                    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px 14px 14px 14px', padding: '10px 14px' }}>
                                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 18 }}>
                                            {[0, 1, 2].map(i => (
                                                <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#555', animation: `forgePulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={chatEndRef} />
                        </div>
                    </div>

                    {/* Input area */}
                    <div style={{ padding: '10px 16px max(16px, calc(12px + env(safe-area-inset-bottom)))', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(8,8,9,0.97)', flexShrink: 0 }}>
                        <div style={{ maxWidth: 640, margin: '0 auto' }}>
                            {/@forge/i.test(input) && (
                                <div style={{ fontSize: 11, color: 'rgba(240,237,232,0.3)', fontFamily: 'DM Sans, sans-serif', fontStyle: 'italic', marginBottom: 6 }}>
                                    Forge will see the last 20 team messages
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: `${roleColor(currentMember.role)}18`, border: `1.5px solid ${roleColor(currentMember.role)}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: roleColor(currentMember.role), fontWeight: 700, marginBottom: 2 }}>
                                    {currentMember.display_name.charAt(0).toUpperCase()}
                                </div>
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                    placeholder="Message your team — type @forge to bring Forge in"
                                    rows={1}
                                    style={{ flex: 1, resize: 'none', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '9px 12px', color: '#F0EDE8', fontSize: 13, fontFamily: "'Lora', Georgia, serif", lineHeight: 1.5, outline: 'none', maxHeight: 120, overflowY: 'auto' }}
                                />
                                {/* Convert to task button */}
                                {input.trim() && (
                                    <button onClick={handleConvertToTask} title="Save as task" style={{ flexShrink: 0, ...btnSecondary, padding: '8px 10px', fontSize: 12, color: 'rgba(240,237,232,0.4)', marginBottom: 0 }}>
                                        ☑
                                    </button>
                                )}
                                <MicButton value={input} onChange={setInput} disabled={chatLoading} />
                                <button onClick={handleSend} disabled={!input.trim() || chatLoading} style={{ ...btnPrimary, padding: '9px 16px', flexShrink: 0, opacity: (!input.trim() || chatLoading) ? 0.4 : 1, transition: 'opacity 0.15s', marginBottom: 0 }}>Send</button>
                            </div>
                            <div style={{ fontSize: 10, color: '#2b2b2b', textAlign: 'center' }}>Forge is an AI. Always verify important information before acting on it.</div>
                        </div>
                    </div>
                </>
            )}

            {/* ── CONFIRMATION OVERLAYS ── */}
            {(confirmRemove || confirmLeave || confirmRevokeInvite) && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }} onClick={() => { setConfirmRemove(null); setConfirmLeave(false); setConfirmRevokeInvite(false); }}>
                    <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, maxWidth: 340, width: '100%', animation: 'fadeSlideUp 0.2s ease' }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, fontFamily: "'Lora', Georgia, serif" }}>
                            {confirmRemove ? `Remove ${confirmRemove.name}?` : confirmLeave ? 'Leave this workspace?' : 'Revoke this invite link?'}
                        </div>
                        <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 20, fontFamily: 'DM Sans, sans-serif' }}>
                            {confirmRemove ? `Remove ${confirmRemove.name} from the workspace? They will need a new invite link to rejoin.` : confirmLeave ? "You'll need a new invite link to rejoin." : "Anyone who has this link won't be able to use it."}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => { setConfirmRemove(null); setConfirmLeave(false); setConfirmRevokeInvite(false); }} style={{ ...btnSecondary, flex: 1, padding: '10px' }}>Cancel</button>
                            <button
                                onClick={() => {
                                    if (confirmRemove) handleRemoveMember();
                                    else if (confirmLeave) handleLeaveTeam();
                                    else if (confirmRevokeInvite) handleRevokeInvite();
                                }}
                                style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: 'rgba(232,98,42,0.15)', border: '1px solid rgba(232,98,42,0.3)', color: '#E8622A', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Lora', Georgia, serif" } as any}
                            >
                                {confirmRemove ? 'Remove' : confirmLeave ? 'Leave' : 'Revoke'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ADD DECISION PANEL ── */}
            {addDecisionOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }} onClick={() => setAddDecisionOpen(false)}>
                    <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 600, animation: 'slideUp 0.25s ease', paddingBottom: 'max(24px, calc(24px + env(safe-area-inset-bottom)))', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '0 auto 20px' }} />
                        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Lora', Georgia, serif", marginBottom: 4 }}>Log Decision</div>
                        {decisionFromMsg && <div style={{ fontSize: 11, color: '#555', fontFamily: 'DM Sans, sans-serif', marginBottom: 16, fontStyle: 'italic' }}>From message by {decisionFromMsg.sender_name}</div>}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>Title *</div>
                                <input value={newDecisionTitle} onChange={e => setNewDecisionTitle(e.target.value)} placeholder="What was decided?" autoFocus style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: '#F0EDE8', fontSize: 13, fontFamily: "'Lora', Georgia, serif", outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>Context / Description</div>
                                <textarea value={newDecisionDescription} onChange={e => setNewDecisionDescription(e.target.value)} placeholder="What led to this decision?" rows={3} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: '#C8C4BE', fontSize: 12, fontFamily: "'Lora', Georgia, serif", resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>Options considered <span style={{ color: '#333' }}>(one per line)</span></div>
                                <textarea value={newDecisionOptions} onChange={e => setNewDecisionOptions(e.target.value)} placeholder={"Option A\nOption B\nOption C"} rows={3} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: '#C8C4BE', fontSize: 12, fontFamily: "'Lora', Georgia, serif", resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>Chosen option</div>
                                <input value={newDecisionChosen} onChange={e => setNewDecisionChosen(e.target.value)} placeholder="What was ultimately chosen?" style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: '#F0EDE8', fontSize: 13, fontFamily: "'Lora', Georgia, serif", outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>Rationale</div>
                                <textarea value={newDecisionRationale} onChange={e => setNewDecisionRationale(e.target.value)} placeholder="Why was this chosen?" rows={2} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: '#C8C4BE', fontSize: 12, fontFamily: "'Lora', Georgia, serif", resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                            <button onClick={() => setAddDecisionOpen(false)} style={{ ...btnSecondary, flex: 1, padding: '12px' }}>Cancel</button>
                            <button onClick={handleAddDecision} disabled={!newDecisionTitle.trim() || savingDecision} style={{ ...btnPrimary, flex: 2, padding: '12px', opacity: !newDecisionTitle.trim() ? 0.5 : 1 }}>
                                {savingDecision ? 'Logging...' : 'Log Decision'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ADD FILE LINK PANEL ── */}
            {addFileOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }} onClick={() => setAddFileOpen(false)}>
                    <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 600, animation: 'slideUp 0.25s ease', paddingBottom: 'max(24px, calc(24px + env(safe-area-inset-bottom)))' }} onClick={e => e.stopPropagation()}>
                        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '0 auto 20px' }} />
                        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Lora', Georgia, serif", marginBottom: 18 }}>Add File Link</div>
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>Label *</div>
                            <input value={newFileLabel} onChange={e => setNewFileLabel(e.target.value)} placeholder="e.g. Q2 Pitch Deck, Brand Guidelines" autoFocus style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#F0EDE8', fontSize: 13, fontFamily: "'Lora', Georgia, serif", outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>URL *</div>
                            <input value={newFileUrl} onChange={e => setNewFileUrl(e.target.value)} placeholder="https://..." type="url" style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#F0EDE8', fontSize: 13, fontFamily: "'Lora', Georgia, serif", outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => setAddFileOpen(false)} style={{ ...btnSecondary, flex: 1, padding: '12px' }}>Cancel</button>
                            <button onClick={handleAddFileLink} disabled={!newFileLabel.trim() || !newFileUrl.trim() || savingFile} style={{ ...btnPrimary, flex: 2, padding: '12px', opacity: (!newFileLabel.trim() || !newFileUrl.trim()) ? 0.5 : 1 }}>
                                {savingFile ? 'Adding...' : 'Add Link'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ADD TASK PANEL ── */}
            {addTaskOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }} onClick={() => setAddTaskOpen(false)}>
                    <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 600, animation: 'slideUp 0.25s ease', paddingBottom: 'max(24px, calc(24px + env(safe-area-inset-bottom)))' }} onClick={e => e.stopPropagation()}>
                        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '0 auto 20px' }} />
                        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Lora', Georgia, serif", marginBottom: 18 }}>Add Task</div>

                        <div style={{ marginBottom: 14 }}>
                            <input
                                value={newTaskTitle}
                                onChange={e => setNewTaskTitle(e.target.value)}
                                placeholder="Task title (required)"
                                autoFocus
                                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px 14px', color: '#F0EDE8', fontSize: 14, fontFamily: "'Lora', Georgia, serif", outline: 'none', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div style={{ marginBottom: 14 }}>
                            <textarea
                                value={newTaskDescription}
                                onChange={e => setNewTaskDescription(e.target.value)}
                                placeholder="Description (optional)"
                                rows={2}
                                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: '#C8C4BE', fontSize: 13, fontFamily: "'Lora', Georgia, serif", resize: 'none', outline: 'none', boxSizing: 'border-box' }}
                            />
                        </div>

                        {/* Assignee */}
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 11, color: '#555', marginBottom: 8 }}>Assign to</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button onClick={() => setNewTaskAssignedTo(null)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, border: !newTaskAssignedTo ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.1)', background: !newTaskAssignedTo ? 'rgba(255,255,255,0.06)' : 'transparent', color: !newTaskAssignedTo ? '#F0EDE8' : '#555', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Unassigned</button>
                                {members.map(m => (
                                    <button key={m.id} onClick={() => setNewTaskAssignedTo(m.id)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, border: newTaskAssignedTo === m.id ? `1px solid ${roleColor(m.role)}55` : '1px solid rgba(255,255,255,0.1)', background: newTaskAssignedTo === m.id ? `${roleColor(m.role)}18` : 'transparent', color: newTaskAssignedTo === m.id ? roleColor(m.role) : '#555', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{m.display_name}</button>
                                ))}
                            </div>
                        </div>

                        {/* Priority + Due date */}
                        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ fontSize: 11, color: '#555', marginBottom: 8 }}>Priority</div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {(['low', 'normal', 'high'] as const).map(p => (
                                        <button key={p} onClick={() => setNewTaskPriority(p)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, border: newTaskPriority === p ? 'none' : '1px solid rgba(255,255,255,0.1)', background: newTaskPriority === p ? (p === 'high' ? 'rgba(232,98,42,0.2)' : 'rgba(255,255,255,0.06)') : 'transparent', color: newTaskPriority === p ? (p === 'high' ? '#E8622A' : '#F0EDE8') : '#555', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', textTransform: 'capitalize' }}>{p}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: '#555', marginBottom: 8 }}>Due date</div>
                                <input type="date" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: '#C8C4BE', fontSize: 12, outline: 'none', fontFamily: 'DM Sans, sans-serif', colorScheme: 'dark' }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => setAddTaskOpen(false)} style={{ ...btnSecondary, flex: 1, padding: '12px' }}>Cancel</button>
                            <button onClick={handleAddTask} disabled={!newTaskTitle.trim() || savingTask} style={{ ...btnPrimary, flex: 2, padding: '12px', opacity: !newTaskTitle.trim() ? 0.5 : 1 }}>
                                {savingTask ? 'Adding...' : 'Add Task'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// CHAT MESSAGE COMPONENT
// ─────────────────────────────────────────────────────────────

interface ChatMessageProps {
    msg: LocalMessage;
    isOwn: boolean;
    isHovered: boolean;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onRetry?: () => void;
    onLogDecision?: () => void;
}

function ChatMessage({ msg, isOwn, isHovered, onMouseEnter, onMouseLeave, onRetry, onLogDecision }: ChatMessageProps) {
    const isForge = msg.role === 'forge';
    const color = isForge ? '#C8A96E' : (ROLE_COLORS[msg.sender_role] ?? '#888');
    const failed = msg.failed;

    return (
        <div
            style={{ display: 'flex', flexDirection: isForge ? 'row' : 'column', alignItems: isForge ? 'flex-start' : undefined, gap: isForge ? 10 : 0, marginBottom: 14, animation: 'fadeSlideUp 0.2s ease' }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {isForge ? (
                <>
                    <ForgeAvatar size={30} />
                    <div>
                        <div style={{ fontSize: 10, color: '#C8A96E', fontWeight: 600, marginBottom: 5, letterSpacing: '0.04em' }}>Forge · AI Partner</div>
                        <div
                            onClick={failed ? onRetry : undefined}
                            style={{
                                background: failed ? 'rgba(232,98,42,0.08)' : 'rgba(255,255,255,0.04)',
                                border: failed ? '1px solid rgba(232,98,42,0.2)' : '1px solid rgba(255,255,255,0.07)',
                                borderRadius: '4px 14px 14px 14px',
                                padding: '10px 14px', fontSize: 13,
                                fontFamily: "'Lora', Georgia, serif",
                                lineHeight: 1.75, color: failed ? 'rgba(240,237,232,0.5)' : '#D8D4CE', maxWidth: 480,
                                cursor: failed ? 'pointer' : 'default',
                            }}
                        >
                            {renderMessageText(msg.content)}
                        </div>
                        {failed && (
                            <div style={{ fontSize: 11, color: 'rgba(232,98,42,0.6)', fontFamily: 'DM Sans, sans-serif', marginTop: 4 }}>Tap to retry</div>
                        )}
                        {!failed && <MessageActions text={msg.content} />}
                        {isHovered && (
                            <div style={{ fontSize: 11, color: '#333', fontFamily: 'DM Sans, sans-serif', marginTop: 2 }}>{formatTime(msg.created_at)}</div>
                        )}
                    </div>
                </>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexDirection: isOwn ? 'row-reverse' : 'row' }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${color}18`, border: `1.5px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color, fontWeight: 700 }}>
                            {msg.sender_name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 10, color: '#555' }}>{msg.sender_name}</span>
                        <span style={{ fontSize: 9, color, background: `${color}12`, border: `1px solid ${color}25`, borderRadius: 20, padding: '1px 7px' }}>{msg.sender_role}</span>
                        {isOwn && <span style={{ fontSize: 9, color: '#333' }}>You</span>}
                    </div>
                    <div
                        onClick={failed ? onRetry : undefined}
                        style={{
                            maxWidth: '75%', padding: '9px 13px', fontSize: 13,
                            fontFamily: "'Lora', Georgia, serif", lineHeight: 1.6, whiteSpace: 'pre-wrap',
                            borderRadius: isOwn ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                            background: failed ? 'rgba(232,98,42,0.08)' : (isOwn ? `linear-gradient(135deg, ${color}22, ${color}18)` : 'rgba(255,255,255,0.04)'),
                            border: failed ? '1px solid rgba(232,98,42,0.2)' : (isOwn ? `1px solid ${color}35` : '1px solid rgba(255,255,255,0.07)'),
                            color: failed ? 'rgba(240,237,232,0.5)' : '#D8D4CE',
                            cursor: failed ? 'pointer' : 'default',
                        }}
                    >
                        {msg.content}
                    </div>
                    {failed && (
                        <div style={{ fontSize: 11, color: 'rgba(232,98,42,0.6)', fontFamily: 'DM Sans, sans-serif', marginTop: 4 }}>Failed to send · Tap to retry</div>
                    )}
                    {isHovered && !failed && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                            <span style={{ fontSize: 11, color: '#333', fontFamily: 'DM Sans, sans-serif' }}>{formatTime(msg.created_at)}</span>
                            {onLogDecision && (
                                <button onClick={onLogDecision} style={{ fontSize: 10, color: 'rgba(240,237,232,0.35)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', padding: 0 }}>Log as decision</button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Light markdown: bold **text** + paragraph breaks
function renderMessageText(text: string) {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} style={{ color: '#F0EDE8', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
        }
        const lines = part.split('\n\n');
        return lines.map((line, j) => (
            <span key={`${i}-${j}`}>
                {j > 0 && <><br /><br /></>}
                {line}
            </span>
        ));
    });
}
