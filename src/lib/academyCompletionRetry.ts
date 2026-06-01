export type AcademyCompletionVerificationState = {
    contentProgressCompleted: boolean;
    lessonProgressCompleted: boolean;
    contentProgressUpdatedAt?: string | null;
    lessonProgressUpdatedAt?: string | null;
};

export type AcademyCompletionOverrideState = {
    userId: string;
    contentId: string;
    status: "completed";
    completedAt: string;
    knowledgeCheckedAt: string | null;
    lastCheckResponse: string | null;
    lastCheckFeedback: string | null;
    lastOpenedAt: string;
    lastForgeOpenedAt: string;
    updatedAt: string;
};

export type AcademyCompletionDiagnostics = {
    lessonId: string;
    userId: string;
    masteryResult: "passed";
    completionEventFired: boolean;
    eventKey: string;
    attempt: number;
    persistenceResult: "pending" | "persisted" | "verified" | "retrying" | "failed";
    frontendUpdateResult?: "pending" | "applied";
    retryDelayMs?: number;
    verification?: AcademyCompletionVerificationState;
    error?: unknown;
};

export type AcademyCompletionRetryOptions = {
    maxAttempts?: number;
    baseDelayMs?: number;
};

export type AcademyCompletionRetryInput<TPersisted, TVerified extends AcademyCompletionVerificationState> = {
    lessonId: string;
    userId: string;
    masteryResult: "passed";
    eventKey?: string;
    persistOnce: (attempt: number, eventKey: string) => Promise<TPersisted>;
    verifyOnce: (attempt: number, persisted: TPersisted, eventKey: string) => Promise<TVerified>;
    onDiagnostics?: (event: AcademyCompletionDiagnostics) => void;
    options?: AcademyCompletionRetryOptions;
};

export type AcademyCompletionRetryResult<TPersisted, TVerified extends AcademyCompletionVerificationState> = {
    persisted: TPersisted;
    verification: TVerified;
    eventKey: string;
    attempts: number;
};

const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_BASE_DELAY_MS = 300;

export async function persistAcademyCompletionWithRetry<TPersisted, TVerified extends AcademyCompletionVerificationState>(
    input: AcademyCompletionRetryInput<TPersisted, TVerified>,
): Promise<AcademyCompletionRetryResult<TPersisted, TVerified>> {
    const eventKey = input.eventKey ?? buildAcademyCompletionEventKey(input.userId, input.lessonId);
    const maxAttempts = Math.max(1, input.options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    const baseDelayMs = Math.max(50, input.options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS);

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            input.onDiagnostics?.({
                lessonId: input.lessonId,
                userId: input.userId,
                masteryResult: input.masteryResult,
                completionEventFired: true,
                eventKey,
                attempt,
                persistenceResult: "pending",
                frontendUpdateResult: "pending",
            });

            const persisted = await input.persistOnce(attempt, eventKey);

            input.onDiagnostics?.({
                lessonId: input.lessonId,
                userId: input.userId,
                masteryResult: input.masteryResult,
                completionEventFired: true,
                eventKey,
                attempt,
                persistenceResult: "persisted",
                frontendUpdateResult: "pending",
            });

            const verification = await input.verifyOnce(attempt, persisted, eventKey);
            if (!isAcademyCompletionVerified(verification)) {
                throw new Error("Academy completion verification failed");
            }

            input.onDiagnostics?.({
                lessonId: input.lessonId,
                userId: input.userId,
                masteryResult: input.masteryResult,
                completionEventFired: true,
                eventKey,
                attempt,
                persistenceResult: "verified",
                verification,
                frontendUpdateResult: "pending",
            });

            return {
                persisted,
                verification,
                eventKey,
                attempts: attempt,
            };
        } catch (error) {
            lastError = error;
            const retryable = attempt < maxAttempts && isRetryableAcademyCompletionError(error);
            const retryDelayMs = retryable ? getAcademyCompletionRetryDelay(attempt, baseDelayMs) : undefined;

            input.onDiagnostics?.({
                lessonId: input.lessonId,
                userId: input.userId,
                masteryResult: input.masteryResult,
                completionEventFired: true,
                eventKey,
                attempt,
                persistenceResult: retryable ? "retrying" : "failed",
                retryDelayMs,
                error,
                frontendUpdateResult: "pending",
            });

            if (!retryable) break;
            await delay(retryDelayMs!);
        }
    }

    throw lastError instanceof Error ? lastError : new Error("Academy completion persistence failed");
}

export function buildAcademyCompletionEventKey(userId: string, lessonId: string) {
    return `academy-complete:${userId}:${lessonId}`;
}

export function getAcademyCompletionRetryDelay(attempt: number, baseDelayMs = DEFAULT_BASE_DELAY_MS) {
    const exponent = Math.max(0, attempt - 1);
    return Math.min(4000, Math.round(baseDelayMs * (2 ** exponent)));
}

export function isAcademyCompletionVerified(state: AcademyCompletionVerificationState) {
    return Boolean(state.contentProgressCompleted && state.lessonProgressCompleted);
}

export function isRetryableAcademyCompletionError(error: unknown) {
    const message = String((error as { message?: string } | null)?.message ?? error ?? "").toLowerCase();
    const code = String((error as { code?: string | number } | null)?.code ?? "");
    const status = Number((error as { status?: number; statusCode?: number } | null)?.status
        ?? (error as { statusCode?: number } | null)?.statusCode
        ?? 0);

    if (status === 401 || status === 403 || status === 404) return false;
    if (code === "42501" || code === "23503" || code === "23514") return false;
    if (message.includes("authentication required")) return false;
    if (message.includes("jwt")) return false;
    if (message.includes("permission denied")) return false;
    if (message.includes("row-level security")) return false;
    if (message.includes("not found")) return false;
    if (message.includes("violates")) return false;
    if (message.includes("must be")) return false;

    return true;
}

export function buildAcademyCompletionOverrideState(input: {
    userId: string;
    contentId: string;
    completedAt: string;
    knowledgeCheckedAt?: string | null;
    lastCheckResponse?: string | null;
    lastCheckFeedback?: string | null;
    lastOpenedAt?: string | null;
    lastForgeOpenedAt?: string | null;
    updatedAt?: string | null;
}): AcademyCompletionOverrideState {
    return {
        userId: input.userId,
        contentId: input.contentId,
        status: "completed",
        completedAt: input.completedAt,
        knowledgeCheckedAt: input.knowledgeCheckedAt ?? input.completedAt,
        lastCheckResponse: input.lastCheckResponse ?? null,
        lastCheckFeedback: input.lastCheckFeedback ?? null,
        lastOpenedAt: input.lastOpenedAt ?? input.completedAt,
        lastForgeOpenedAt: input.lastForgeOpenedAt ?? input.completedAt,
        updatedAt: input.updatedAt ?? input.completedAt,
    };
}

function delay(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
