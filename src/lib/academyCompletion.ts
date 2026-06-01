import { supabase } from "../supabase";
import { callForgeAPI } from "./forgeApi";
import { upsertAcademyContentProgress } from "./academyDb";
import type { AcademyContent, AcademySessionMode, AcademyTopicLaunch, AcademyUserContentProgress, AssessmentAttempt } from "./academy";
import {
    buildAcademyCompletionEventKey,
    persistAcademyCompletionWithRetry,
    type AcademyCompletionVerificationState,
} from "./academyCompletionRetry";

export type KnowledgeCheckTrackStatus = "passed" | "on_track" | "off_track";
export type AcademyUnderstandingLevel = "incorrect" | "partially_correct" | "mostly_correct" | "fully_correct";

export type KnowledgeCheckEvaluation = {
    passed: boolean;
    trackStatus: KnowledgeCheckTrackStatus;
    understandingLevel: AcademyUnderstandingLevel;
    feedback: string;
    demonstratedUnderstanding: string[];
    missingUnderstanding: string[];
    evidenceQuote: string | null;
};

export type CompletedAcademyLessonResult = {
    contentProgress: Awaited<ReturnType<typeof upsertAcademyContentProgress>>;
    lessonProgress: {
        id: string;
        user_id: string;
        content_id: string;
        status: "not_started" | "in_progress" | "completed";
        started_at: string | null;
        completed_at: string | null;
        knowledge_checked_at: string | null;
        last_check_response: string | null;
        last_check_feedback: string | null;
        updated_at: string | null;
    };
    eventKey: string;
    attempts: number;
    verification: AcademyCompletionVerificationState;
    historyInserted: boolean;
};

export async function completeAcademyLesson({
    userId,
    contentId,
    contentTitle,
    response,
    feedback,
    completedAt,
    source = "academy",
    assessmentPassed = true,
    correctCount = null,
    attemptedCount = null,
}: {
    userId: string;
    contentId: string;
    contentTitle?: string | null;
    response?: string | null;
    feedback?: string | null;
    completedAt?: string | null;
    source?: "lesson_modal" | "forge_chat" | "academy";
    assessmentPassed?: boolean;
    correctCount?: number | null;
    attemptedCount?: number | null;
}): Promise<CompletedAcademyLessonResult> {
    const completedTimestamp = completedAt ?? new Date().toISOString();
    const fullyComplete = assessmentPassed;
    if (!fullyComplete) {
        const contentProgress = await upsertAcademyContentProgress(userId, contentId, false, {
            knowledgeCheckedAt: completedTimestamp,
            lastCheckResponse: response ?? null,
            lastCheckFeedback: feedback ?? null,
        });

        const { data, error } = await supabase
            .from("user_lesson_progress")
            .upsert({
                user_id: userId,
                content_id: contentId,
                status: "in_progress",
                started_at: completedTimestamp,
                completed_at: null,
                knowledge_checked_at: completedTimestamp,
                last_check_response: response ?? null,
                last_check_feedback: feedback ?? null,
                updated_at: completedTimestamp,
            }, { onConflict: "user_id,content_id" })
            .select()
            .single();

        if (error) throw error;

        return {
            contentProgress,
            lessonProgress: {
                id: data.id,
                user_id: data.user_id,
                content_id: data.content_id,
                status: data.status,
                started_at: data.started_at ?? null,
                completed_at: data.completed_at ?? null,
                knowledge_checked_at: data.knowledge_checked_at ?? null,
                last_check_response: data.last_check_response ?? null,
                last_check_feedback: data.last_check_feedback ?? null,
                updated_at: data.updated_at ?? null,
            },
            eventKey: buildAcademyCompletionEventKey(userId, contentId),
            attempts: 1,
            verification: {
                contentProgressCompleted: false,
                lessonProgressCompleted: false,
                contentProgressUpdatedAt: contentProgress.updatedAt ?? null,
                lessonProgressUpdatedAt: data.updated_at ?? null,
            },
            historyInserted: false,
        };
    }

    const result = await persistAcademyCompletionWithRetry({
        lessonId: contentId,
        userId,
        masteryResult: "passed",
        eventKey: buildAcademyCompletionEventKey(userId, contentId),
        persistOnce: async (_attempt, eventKey) => {
            const { data, error } = await supabase.rpc("complete_academy_lesson", {
                p_content_id: contentId,
                p_completed_at: completedTimestamp,
                p_knowledge_checked_at: completedTimestamp,
                p_last_check_response: response ?? null,
                p_last_check_feedback: feedback ?? null,
                p_source: source,
                p_correct_count: correctCount,
                p_attempted_count: attemptedCount,
                p_event_key: eventKey,
            });
            if (error) throw error;
            return normalizeCompletionRpcResult(data);
        },
        verifyOnce: async () => verifyAcademyLessonCompletion(userId, contentId),
        onDiagnostics: (event) => {
            const payload = {
                ...event,
                contentTitle: contentTitle ?? null,
            };
            if (event.persistenceResult === "failed") {
                console.error("academy lesson completion diagnostics:", payload);
                return;
            }
            if (event.persistenceResult === "retrying") {
                console.warn("academy lesson completion diagnostics:", payload);
                return;
            }
            console.info("academy lesson completion diagnostics:", payload);
        },
    });

    return {
        contentProgress: result.persisted.contentProgress,
        lessonProgress: result.persisted.lessonProgress,
        eventKey: result.eventKey,
        attempts: result.attempts,
        verification: result.verification,
        historyInserted: result.persisted.historyInserted,
    };
}

type CompletionRpcRow = {
    content_progress?: {
        user_id: string;
        content_id: string;
        status: AcademyUserContentProgress["status"];
        completed_at: string | null;
        knowledge_checked_at?: string | null;
        last_check_response?: string | null;
        last_check_feedback?: string | null;
        last_opened_at: string | null;
        last_forge_opened_at: string | null;
        updated_at: string | null;
    } | null;
    lesson_progress?: {
        id: string;
        user_id: string;
        content_id: string;
        status: "not_started" | "in_progress" | "completed";
        started_at: string | null;
        completed_at: string | null;
        knowledge_checked_at: string | null;
        last_check_response: string | null;
        last_check_feedback: string | null;
        updated_at: string | null;
    } | null;
    history_inserted?: boolean;
};

function normalizeCompletionRpcResult(raw: unknown) {
    const parsed = (raw ?? {}) as CompletionRpcRow;
    const contentProgress = parsed.content_progress;
    const lessonProgress = parsed.lesson_progress;
    if (!contentProgress || !lessonProgress) {
        throw new Error("Academy completion RPC returned incomplete data");
    }
    return {
        contentProgress: {
            userId: contentProgress.user_id,
            contentId: contentProgress.content_id,
            status: contentProgress.status,
            completedAt: contentProgress.completed_at ?? null,
            knowledgeCheckedAt: contentProgress.knowledge_checked_at ?? null,
            lastCheckResponse: contentProgress.last_check_response ?? null,
            lastCheckFeedback: contentProgress.last_check_feedback ?? null,
            lastOpenedAt: contentProgress.last_opened_at ?? null,
            lastForgeOpenedAt: contentProgress.last_forge_opened_at ?? null,
            updatedAt: contentProgress.updated_at ?? new Date().toISOString(),
        },
        lessonProgress: {
            id: lessonProgress.id,
            user_id: lessonProgress.user_id,
            content_id: lessonProgress.content_id,
            status: lessonProgress.status,
            started_at: lessonProgress.started_at ?? null,
            completed_at: lessonProgress.completed_at ?? null,
            knowledge_checked_at: lessonProgress.knowledge_checked_at ?? null,
            last_check_response: lessonProgress.last_check_response ?? null,
            last_check_feedback: lessonProgress.last_check_feedback ?? null,
            updated_at: lessonProgress.updated_at ?? null,
        },
        historyInserted: Boolean(parsed.history_inserted),
    };
}

async function verifyAcademyLessonCompletion(userId: string, contentId: string): Promise<AcademyCompletionVerificationState> {
    const [contentProgressRes, lessonProgressRes] = await Promise.all([
        supabase
            .from("academy_user_content_progress")
            .select("status,completed_at,updated_at")
            .eq("user_id", userId)
            .eq("content_id", contentId)
            .maybeSingle(),
        supabase
            .from("user_lesson_progress")
            .select("status,completed_at,updated_at")
            .eq("user_id", userId)
            .eq("content_id", contentId)
            .maybeSingle(),
    ]);

    if (contentProgressRes.error) throw contentProgressRes.error;
    if (lessonProgressRes.error) throw lessonProgressRes.error;

    return {
        contentProgressCompleted: contentProgressRes.data?.status === "completed" || Boolean(contentProgressRes.data?.completed_at),
        lessonProgressCompleted: lessonProgressRes.data?.status === "completed" || Boolean(lessonProgressRes.data?.completed_at),
        contentProgressUpdatedAt: contentProgressRes.data?.updated_at ?? null,
        lessonProgressUpdatedAt: lessonProgressRes.data?.updated_at ?? null,
    };
}

export function getLessonAssessmentScore(attempts: AssessmentAttempt[], lessonId: string) {
    const latestByAssessment = new Map<string, AssessmentAttempt>();
    attempts
        .filter((attempt) => attempt.lessonId === lessonId)
        .sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))
        .forEach((attempt) => {
            if (!latestByAssessment.has(attempt.assessmentId)) {
                latestByAssessment.set(attempt.assessmentId, attempt);
            }
        });
    const latestAttempts = Array.from(latestByAssessment.values());
    const correctCount = latestAttempts.filter((attempt) => attempt.isCorrect).length;
    return {
        attemptedCount: latestAttempts.length,
        correctCount,
        passed: latestAttempts.length >= 3 && correctCount >= 2,
        latestAttempts,
    };
}

export function isAcademyLessonFullyComplete(
    progress: AcademyUserContentProgress | null | undefined,
    attempts: AssessmentAttempt[],
    lessonId: string,
) {
    const readComplete = progress?.status === "completed" || Boolean(progress?.completedAt);
    return readComplete && getLessonAssessmentScore(attempts, lessonId).passed;
}

export function getCompletionBadgeLabel(content: AcademyContent) {
    return content.completionBadgeLabel?.trim() || "Completed";
}

export function getKnowledgeCheckPrompt(content: AcademyContent) {
    return content.knowledgeCheckPrompt?.trim()
        || `What is the core founder judgment this lesson was trying to build around "${content.title}"?`;
}

export function getKnowledgeCheckExpectedPoints(content: AcademyContent) {
    if (content.knowledgeCheckExpectedPoints.length > 0) return content.knowledgeCheckExpectedPoints;

    return [
        content.learningGoal ? `The answer should reflect this lesson goal: ${content.learningGoal}` : null,
        content.commonMistake ? `It should show awareness of this founder mistake: ${content.commonMistake}` : null,
        content.whyThisMatters ? `It should explain why the lesson matters in real business situations: ${content.whyThisMatters}` : null,
    ].filter(Boolean) as string[];
}

export function getAcademySessionSubtitle(mode: AcademySessionMode) {
    switch (mode) {
        case "apply":
            return "Applied Academy conversation";
        case "knowledge_check":
            return "Understanding check";
        case "learn":
        default:
            return "Guided Academy conversation";
    }
}

export async function evaluateKnowledgeCheckAnswer(content: AcademyContent, answer: string): Promise<KnowledgeCheckEvaluation> {
    const prompt = getKnowledgeCheckPrompt(content);
    const expectedPoints = getKnowledgeCheckExpectedPoints(content);
    const rubric = expectedPoints.length > 0
        ? expectedPoints.map((point, index) => `${index + 1}. ${point}`).join("\n")
        : "Judge whether the founder actually understood the lesson and can explain it clearly in plain language.";

    const raw = await callForgeAPI(
        [{
            role: "user",
            content: `Evaluate this Navi Academy knowledge check answer.

Lesson title: ${content.title}
Knowledge check prompt: ${prompt}

Expected understanding points:
${rubric}

Founder answer:
${answer}

Return valid JSON only with exactly these keys:
"trackStatus": exactly one of "passed", "on_track", or "off_track". Use "passed" if the founder demonstrates the core concept, even if their wording is imperfect or they miss a minor nuance. Use "on_track" only if they are directionally right but have not yet stated the core concept clearly enough. Use "off_track" only if they fundamentally miss the point or show no real grasp of the lesson.
"passed": true only if trackStatus is "passed", false otherwise
"understandingLevel": exactly one of "incorrect", "partially_correct", "mostly_correct", or "fully_correct".
"feedback": short feedback in 2-4 sentences. If passed, explain what landed well. If on_track, explain what's right and what still needs sharpening. If off_track, explain what core concept they're missing.
"demonstratedUnderstanding": an array of 1-4 short strings naming the specific lesson ideas the founder did demonstrate.
"missingUnderstanding": an array of 0-3 short strings naming only the specific lesson ideas still missing. Empty array if passed.
"evidenceQuote": a short exact quote from the founder answer that best supports your judgment, or null if no useful quote exists.

Evaluation rules:
- Judge understanding, not phrasing. Do not require the founder to use the lesson's exact words.
- Pass answers that accurately connect the lesson to the founder's own behavior, systems, decisions, or business execution.
- Treat the founder as understanding when they correctly explain the mechanism in their own words, give a relevant business example, apply the lesson to Tekori/their company, or explain decision elimination, systemization, automation, founder dependency reduction, operational consistency, or business risk reduction.
- Do not reject an answer solely because it includes personal productivity language if it also connects that behavior to business systems, operational risk, decision quality, consistency, or founder dependency.
- If the founder pushes back that they already answered, fairly re-evaluate their actual answer. Do not double down unless a concrete missing concept remains.
- Err on completion when the founder clearly gets the concept. Navi Academy is checking useful understanding, not mastery.
- Do not mark an answer incomplete just because it could be sharper, more polished, or more comprehensive. Mark it incomplete only when the core concept is actually absent or materially confused.
- Minor missing details should be captured in feedback while still passing the answer.
- If the answer is incomplete, the feedback must identify the exact missing idea rather than restarting the lesson.`
        }],
        "You evaluate founder understanding for Navi Academy. Be strict enough to protect quality, but encouraging and direct. Return only valid JSON."
    );

    try {
        const parsed = JSON.parse(raw);
        const trackStatus: KnowledgeCheckTrackStatus =
            parsed?.trackStatus === "passed" ? "passed" :
            parsed?.trackStatus === "on_track" ? "on_track" : "off_track";
        const understandingLevel: AcademyUnderstandingLevel =
            parsed?.understandingLevel === "fully_correct" ? "fully_correct" :
            parsed?.understandingLevel === "mostly_correct" ? "mostly_correct" :
            parsed?.understandingLevel === "partially_correct" ? "partially_correct" :
            trackStatus === "passed" ? "fully_correct" :
            trackStatus === "on_track" ? "mostly_correct" : "incorrect";
        const demonstratedUnderstanding = Array.isArray(parsed?.demonstratedUnderstanding)
            ? parsed.demonstratedUnderstanding.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 4)
            : [];
        const missingUnderstanding = Array.isArray(parsed?.missingUnderstanding)
            ? parsed.missingUnderstanding.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 3)
            : [];
        return {
            passed: trackStatus === "passed",
            trackStatus,
            understandingLevel,
            feedback: typeof parsed?.feedback === "string" && parsed.feedback.trim()
                ? parsed.feedback.trim()
                : "Navi could not produce clear feedback. Try again with a more concrete explanation.",
            demonstratedUnderstanding,
            missingUnderstanding,
            evidenceQuote: typeof parsed?.evidenceQuote === "string" && parsed.evidenceQuote.trim()
                ? parsed.evidenceQuote.trim().slice(0, 220)
                : null,
        };
    } catch {
        return {
            passed: false,
            trackStatus: "off_track" as KnowledgeCheckTrackStatus,
            understandingLevel: "incorrect",
            feedback: "Navi could not evaluate that answer cleanly. Try again with a clearer explanation in your own words.",
            demonstratedUnderstanding: [],
            missingUnderstanding: ["The answer could not be evaluated cleanly."],
            evidenceQuote: null,
        };
    }
}

export async function evaluateKnowledgeCheckLaunchAnswer(entry: AcademyTopicLaunch, answer: string): Promise<KnowledgeCheckEvaluation> {
    const prompt = entry.knowledgeCheckPrompt?.trim()
        || `What is the core founder judgment this lesson was trying to build around "${entry.title}"?`;
    const expectedPoints = entry.knowledgeCheckExpectedPoints.length > 0
        ? entry.knowledgeCheckExpectedPoints
        : [
            entry.learningGoal ? `The answer should reflect this lesson goal: ${entry.learningGoal}` : null,
            entry.commonMistake ? `It should show awareness of this founder mistake: ${entry.commonMistake}` : null,
            entry.whyThisMatters ? `It should explain why the lesson matters in real business situations: ${entry.whyThisMatters}` : null,
        ].filter(Boolean) as string[];
    const rubric = expectedPoints.length > 0
        ? expectedPoints.map((point, index) => `${index + 1}. ${point}`).join("\n")
        : "Judge whether the founder actually understood the lesson and can explain it clearly in plain language.";

    const raw = await callForgeAPI(
        [{
            role: "user",
            content: `Evaluate this Navi Academy knowledge check answer.

Lesson title: ${entry.title}
Knowledge check prompt: ${prompt}

Expected understanding points:
${rubric}

Founder answer:
${answer}

Return valid JSON only with exactly these keys:
"trackStatus": exactly one of "passed", "on_track", or "off_track". Use "passed" if the founder demonstrates the core concept, even if their wording is imperfect or they miss a minor nuance. Use "on_track" only if they are directionally right but have not yet stated the core concept clearly enough. Use "off_track" only if they fundamentally miss the point or show no real grasp of the lesson.
"passed": true only if trackStatus is "passed", false otherwise
"understandingLevel": exactly one of "incorrect", "partially_correct", "mostly_correct", or "fully_correct".
"feedback": short feedback in 2-4 sentences. If passed, explain what landed well. If on_track, explain what's right and what still needs sharpening. If off_track, explain what core concept they're missing.
"demonstratedUnderstanding": an array of 1-4 short strings naming the specific lesson ideas the founder did demonstrate.
"missingUnderstanding": an array of 0-3 short strings naming only the specific lesson ideas still missing. Empty array if passed.
"evidenceQuote": a short exact quote from the founder answer that best supports your judgment, or null if no useful quote exists.

Evaluation rules:
- Judge understanding, not phrasing. Do not require the founder to use the lesson's exact words.
- Pass answers that accurately connect the lesson to the founder's own behavior, systems, decisions, or business execution.
- Treat the founder as understanding when they correctly explain the mechanism in their own words, give a relevant business example, apply the lesson to Tekori/their company, or explain decision elimination, systemization, automation, founder dependency reduction, operational consistency, or business risk reduction.
- Do not reject an answer solely because it includes personal productivity language if it also connects that behavior to business systems, operational risk, decision quality, consistency, or founder dependency.
- If recent transcript shows Navi has already asked substantially the same question twice, avoid another drill. If the founder is mostly correct, mark passed; if not, name one exact missing distinction.
- If the founder pushes back that they already answered, fairly re-evaluate their actual answer. Do not double down unless a concrete missing concept remains.
- Err on completion when the founder clearly gets the concept. Navi Academy is checking useful understanding, not mastery.
- Do not mark an answer incomplete just because it could be sharper, more polished, or more comprehensive. Mark it incomplete only when the core concept is actually absent or materially confused.
- Minor missing details should be captured in feedback while still passing the answer.
- If the answer is incomplete, the feedback must identify the exact missing idea rather than restarting the lesson.`
        }],
        "You evaluate founder understanding for Navi Academy. Be strict enough to protect quality, but encouraging and direct. Return only valid JSON."
    );

    try {
        const parsed = JSON.parse(raw);
        const trackStatus: KnowledgeCheckTrackStatus =
            parsed?.trackStatus === "passed" ? "passed" :
            parsed?.trackStatus === "on_track" ? "on_track" : "off_track";
        const understandingLevel: AcademyUnderstandingLevel =
            parsed?.understandingLevel === "fully_correct" ? "fully_correct" :
            parsed?.understandingLevel === "mostly_correct" ? "mostly_correct" :
            parsed?.understandingLevel === "partially_correct" ? "partially_correct" :
            trackStatus === "passed" ? "fully_correct" :
            trackStatus === "on_track" ? "mostly_correct" : "incorrect";
        const demonstratedUnderstanding = Array.isArray(parsed?.demonstratedUnderstanding)
            ? parsed.demonstratedUnderstanding.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 4)
            : [];
        const missingUnderstanding = Array.isArray(parsed?.missingUnderstanding)
            ? parsed.missingUnderstanding.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 3)
            : [];
        return {
            passed: trackStatus === "passed",
            trackStatus,
            understandingLevel,
            feedback: typeof parsed?.feedback === "string" && parsed.feedback.trim()
                ? parsed.feedback.trim()
                : "Navi could not produce clear feedback. Try again with a more concrete explanation.",
            demonstratedUnderstanding,
            missingUnderstanding,
            evidenceQuote: typeof parsed?.evidenceQuote === "string" && parsed.evidenceQuote.trim()
                ? parsed.evidenceQuote.trim().slice(0, 220)
                : null,
        };
    } catch {
        return {
            passed: false,
            trackStatus: "off_track",
            understandingLevel: "incorrect",
            feedback: "Navi could not evaluate that answer cleanly. Try again with a clearer explanation in your own words.",
            demonstratedUnderstanding: [],
            missingUnderstanding: ["The answer could not be evaluated cleanly."],
            evidenceQuote: null,
        };
    }
}
