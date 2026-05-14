import { supabase } from "../supabase";

export interface AdminFounderListItem {
    user_id: string;
    email: string | null;
    display_name: string | null;
    name: string | null;
    business_name: string | null;
    side_hustle_name: string | null;
    idea: string | null;
    current_stage: number | null;
    venture_mode: string | null;
    role: string;
    created_at: string | null;
    updated_at: string | null;
    last_active_at: string | null;
    account_access: AdminAccountAccessSummary | null;
    billing_subscription: AdminBillingSummary | null;
    action_count: number;
    document_count: number;
    archive_count: number;
    academy_progress_count: number;
}

export interface AdminAccountAccessSummary {
    access_status: string | null;
    plan_type: string | null;
    subscription_status: string | null;
    is_family_comp: boolean;
    comp_reason?: string | null;
    starts_at?: string | null;
    ends_at: string | null;
    canceled_at: string | null;
    suspended_at: string | null;
    suspension_reason?: string | null;
    created_at?: string | null;
    updated_at: string | null;
}

export interface AdminBillingSummary {
    stripe_status: string | null;
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    stripe_price_id?: string | null;
    current_period_start?: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    trial_end: string | null;
    created_at?: string | null;
    updated_at: string | null;
    has_stripe_customer: boolean;
    has_stripe_subscription: boolean;
}

export interface AdminFounderListResponse {
    founders: AdminFounderListItem[];
    pagination: {
        limit: number;
        offset: number;
        count: number;
    };
}

export interface AdminFounderDetailResponse {
    profile: AdminFounderProfile;
    account_access: AdminAccountAccessSummary | null;
    billing_subscription: AdminBillingSummary | null;
    recent_admin_support_notes: AdminSupportNote[];
    recent_admin_actions: AdminAuditEntry[];
    counts: AdminFounderCounts;
    recent_archives: AdminArchivePreview[];
    recent_documents: AdminDocumentPreview[];
    recent_actions: AdminActionPreview[];
}

export interface AdminFounderAcademyProgressResponse {
    user_id: string;
    profile: {
        user_id: string;
        email: string | null;
        name: string | null;
    };
    totals: AdminAcademyProgressTotals;
    stages: AdminAcademyProgressStage[];
}

export interface AdminAcademyProgressStage {
    stage_id: number;
    totals: AdminAcademyProgressTotals;
    lessons: AdminAcademyProgressLesson[];
}

export interface AdminAcademyProgressTotals {
    total: number;
    completed: number;
    completed_pending_assessment: number;
    in_progress: number;
    not_started: number;
    assessment_passed: number;
    assessment_attempts: number;
}

export interface AdminAcademyProgressLesson {
    content_id: string;
    lesson_id: string;
    lesson_title: string;
    topic_title: string | null;
    stage_id: number;
    lesson_type: string | null;
    category: string | null;
    source_type: string | null;
    is_core: boolean;
    current_progress_status: string | null;
    legacy_progress_status: string | null;
    normalized_status: "not_started" | "in_progress" | "completed_pending_assessment" | "completed";
    completed_at: string | null;
    started_at: string | null;
    last_opened_at: string | null;
    last_forge_opened_at: string | null;
    updated_at: string | null;
    assessment_attempt_count: number;
    assessment_question_count: number;
    latest_assessment_score: {
        correct: number;
        attempted: number;
        percent: number;
    } | null;
    latest_assessment_status: "not_started" | "in_progress" | "passed";
    latest_assessment_attempted_at: string | null;
    archive_references: Array<{
        id: string;
        title: string | null;
        summary_date: string | null;
        stage_id: number | null;
        archive_source_type: string | null;
        archive_source_ref_id: string | null;
        archive_source_title: string | null;
        archive_source_metadata: Record<string, unknown>;
        created_at: string | null;
    }>;
}

export interface AdminFounderProfile {
    user_id: string;
    email: string | null;
    display_name: string | null;
    name: string | null;
    business_name: string | null;
    side_hustle_name: string | null;
    idea: string | null;
    industry: string | null;
    strategy_label: string | null;
    current_stage: number | null;
    venture_mode: string | null;
    role: string;
    setup_completed: boolean;
    created_at: string | null;
    updated_at: string | null;
    last_active_at: string | null;
}

export interface AdminFounderCounts {
    academy_progress: number;
    academy_user_content_progress: number;
    user_lesson_progress: number;
    actions: number;
    documents: number;
    archives: number;
    books: number;
    market_reports: number;
}

export interface AdminArchivePreview {
    id: string;
    stage_id: number | null;
    summary_date: string | null;
    title: string | null;
    summary_preview: string | null;
    message_count: number;
    archive_source_type: string | null;
    archive_source_ref_id: string | null;
    archive_source_title: string | null;
    archive_source_metadata: Record<string, unknown>;
    created_at: string | null;
    updated_at: string | null;
}

export interface AdminDocumentPreview {
    id: string;
    title: string | null;
    doc_type: string | null;
    category: string | null;
    status: string | null;
    stage_id: number | null;
    created_at: string | null;
    updated_at: string | null;
    archived_at: string | null;
}

export interface AdminActionPreview {
    id: string;
    title: string | null;
    source_module: string | null;
    source_type: string | null;
    action_type: string | null;
    status: string | null;
    priority: string | null;
    due_date: string | null;
    completed_at: string | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface AdminSupportNote {
    id: string;
    target_user_id: string;
    admin_id: string | null;
    note: string;
    note_type: string | null;
    visibility: string | null;
    linked_entity_type: string | null;
    linked_entity_id: string | null;
    metadata: Record<string, unknown>;
    created_at: string | null;
    updated_at: string | null;
}

export interface AdminAuditEntry {
    id: string;
    admin_id: string | null;
    target_user_id: string | null;
    action_type: string;
    entity_type: string | null;
    entity_id: string | null;
    reason: string | null;
    metadata: Record<string, unknown>;
    created_at: string | null;
}

export interface LoadAdminFoundersOptions {
    search?: string;
    limit?: number;
    offset?: number;
    page?: number;
    accessStatus?: string;
    stage?: number | null;
}

export type AdminAcademyRepairStatus = "completed" | "in_progress" | "not_started";
export type AdminSupportNoteType = "general" | "support" | "retention" | "billing" | "academy" | "technical";
export type AdminNotificationType = "admin_support" | "system" | "milestone";
export type AdminFeedbackStatus = "new" | "reviewed" | "fixed" | "ignored";

export interface AdminFeedbackProfile {
    user_id: string;
    email: string | null;
    name: string | null;
    business_name: string | null;
}

export interface AdminFeedbackItem {
    id: string;
    user_id: string | null;
    reaction: "up" | "down";
    surface: string | null;
    message_id: string | null;
    message_text: string | null;
    conversation_title: string | null;
    stage_id: number | null;
    status: AdminFeedbackStatus;
    admin_note: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    created_at: string | null;
    profile: AdminFeedbackProfile | null;
}

export interface AdminFeedbackListResponse {
    items: AdminFeedbackItem[];
    pagination: {
        limit: number;
        page: number;
        count: number;
        total_pages: number;
    };
}

export interface FetchAdminFeedbackOptions {
    status?: string;
    reaction?: string;
    surface?: string;
    limit?: number;
    page?: number;
}

export interface UpdateAdminFeedbackPayload {
    status?: AdminFeedbackStatus;
    admin_note?: string | null;
}

export interface AdminFounderNotification {
    id: string;
    user_id: string;
    type: string;
    title: string;
    message: string;
    channel: string;
    status: string;
    sent_at: string | null;
    read_at: string | null;
    metadata: Record<string, unknown>;
    created_at: string | null;
}

export interface CreateFounderNotificationPayload {
    title: string;
    message: string;
    type?: AdminNotificationType;
    metadata?: Record<string, unknown>;
}

export async function loadAdminOperationFounders(options: LoadAdminFoundersOptions = {}): Promise<AdminFounderListResponse> {
    const params = new URLSearchParams();
    if (options.search?.trim()) params.set("search", options.search.trim());
    if (options.limit) params.set("limit", String(options.limit));
    if (options.offset != null) params.set("offset", String(options.offset));
    if (options.page != null) params.set("page", String(options.page));
    if (options.accessStatus) params.set("access_status", options.accessStatus);
    if (options.stage) params.set("stage", String(options.stage));

    const query = params.toString();
    return adminFetch<AdminFounderListResponse>(`/api/admin/founders${query ? `?${query}` : ""}`);
}

export async function loadAdminOperationFounderDetail(userId: string): Promise<AdminFounderDetailResponse> {
    return adminFetch<AdminFounderDetailResponse>(`/api/admin/founders/${encodeURIComponent(userId)}`);
}

export async function loadAdminOperationFounderAcademyProgress(userId: string): Promise<AdminFounderAcademyProgressResponse> {
    return adminFetch<AdminFounderAcademyProgressResponse>(`/api/admin/founders/${encodeURIComponent(userId)}/academy-progress`);
}

export async function repairFounderAcademyProgress(
    userId: string,
    contentId: string,
    status: AdminAcademyRepairStatus,
    reason: string,
    metadata: Record<string, unknown> = {},
): Promise<{ ok: true; lesson: AdminAcademyProgressLesson }> {
    return adminFetch<{ ok: true; lesson: AdminAcademyProgressLesson }>(
        `/api/admin/founders/${encodeURIComponent(userId)}/academy-progress`,
        {
            method: "POST",
            body: {
                contentId,
                status,
                reason,
                metadata,
            },
        },
    );
}

export async function resetFounderAssessment(
    userId: string,
    contentId: string,
    reason: string,
    confirmation: string,
    metadata: Record<string, unknown> = {},
): Promise<{
    ok: true;
    content_id: string;
    assessment_summary: unknown;
}> {
    return adminFetch<{
        ok: true;
        content_id: string;
        assessment_summary: unknown;
    }>(
        `/api/admin/founders/${encodeURIComponent(userId)}/reset-assessment`,
        {
            method: "POST",
            body: {
                contentId,
                reason,
                confirmation,
                metadata,
            },
        },
    );
}

export async function createFounderAdminNote(
    userId: string,
    note: string,
    noteType: AdminSupportNoteType,
    metadata: Record<string, unknown> = {},
): Promise<{ ok: true; note: AdminSupportNote }> {
    return adminFetch<{ ok: true; note: AdminSupportNote }>(
        `/api/admin/founders/${encodeURIComponent(userId)}/notes`,
        {
            method: "POST",
            body: {
                note,
                note_type: noteType,
                metadata,
            },
        },
    );
}

export async function fetchAdminFeedback(
    options: FetchAdminFeedbackOptions = {},
): Promise<AdminFeedbackListResponse> {
    const params = new URLSearchParams();
    if (options.status) params.set("status", options.status);
    if (options.reaction) params.set("reaction", options.reaction);
    if (options.surface) params.set("surface", options.surface);
    if (options.limit) params.set("limit", String(options.limit));
    if (options.page) params.set("page", String(options.page));
    const query = params.toString();
    return adminFetch<AdminFeedbackListResponse>(`/api/admin/feedback${query ? `?${query}` : ""}`);
}

export async function updateAdminFeedback(
    id: string,
    payload: UpdateAdminFeedbackPayload,
): Promise<{ ok: true; feedback: AdminFeedbackItem }> {
    return adminFetch<{ ok: true; feedback: AdminFeedbackItem }>(
        `/api/admin/feedback/${encodeURIComponent(id)}`,
        { method: "PATCH", body: payload as Record<string, unknown> },
    );
}

export async function createFounderNotification(
    userId: string,
    payload: CreateFounderNotificationPayload,
): Promise<{ ok: true; notification: AdminFounderNotification }> {
    return adminFetch<{ ok: true; notification: AdminFounderNotification }>(
        `/api/admin/founders/${encodeURIComponent(userId)}/notifications`,
        {
            method: "POST",
            body: payload as Record<string, unknown>,
        },
    );
}

async function adminFetch<T>(url: string, options: { method?: string; body?: Record<string, unknown> } = {}): Promise<T> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
        throw new Error("Missing active session");
    }

    const response = await fetch(url, {
        method: options.method ?? "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
        const message = await readErrorMessage(response);
        throw new Error(message || `Admin API ${response.status}`);
    }

    return response.json();
}

async function readErrorMessage(response: Response) {
    const text = await response.text();
    if (!text) return response.status === 403 ? "Admin access required" : response.statusText;
    try {
        const parsed = JSON.parse(text) as { error?: string };
        return parsed.error || text.slice(0, 220);
    } catch {
        return text.slice(0, 220);
    }
}
