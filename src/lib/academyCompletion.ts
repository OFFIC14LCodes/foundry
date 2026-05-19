import { supabase } from "../supabase";
import { callForgeAPI } from "./forgeApi";
import { recordAcademyHistory, upsertAcademyContentProgress } from "./academyDb";
import type { AcademyContent, AcademySessionMode, AcademyTopicLaunch, AcademyUserContentProgress, AssessmentAttempt } from "./academy";

export type KnowledgeCheckTrackStatus = "passed" | "on_track" | "off_track";

export type KnowledgeCheckEvaluation = {
    passed: boolean;
    trackStatus: KnowledgeCheckTrackStatus;
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
    const contentProgress = await upsertAcademyContentProgress(userId, contentId, fullyComplete, {
        knowledgeCheckedAt: completedTimestamp,
        lastCheckResponse: response ?? null,
        lastCheckFeedback: feedback ?? null,
    });

    if (fullyComplete) {
        await recordAcademyHistory(userId, "completed", {
            contentId,
            metadata: {
                title: contentTitle ?? null,
                source,
                correctCount,
                attemptedCount,
            },
        });
    }

    const { data, error } = await supabase
        .from("user_lesson_progress")
        .upsert({
            user_id: userId,
            content_id: contentId,
            status: fullyComplete ? "completed" : "in_progress",
            started_at: completedTimestamp,
            completed_at: fullyComplete ? completedTimestamp : null,
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
            content: `Evaluate this Forge Academy knowledge check answer.

Lesson title: ${content.title}
Knowledge check prompt: ${prompt}

Expected understanding points:
${rubric}

Founder answer:
${answer}

Return valid JSON only with exactly these keys:
"trackStatus": exactly one of "passed", "on_track", or "off_track". Use "passed" if the founder clearly demonstrates the core understanding. Use "on_track" if they show partial understanding or are heading in the right direction but need refinement. Use "off_track" only if they fundamentally miss the point or show no real grasp of the lesson.
"passed": true only if trackStatus is "passed", false otherwise
"feedback": short feedback in 2-4 sentences. If passed, explain what landed well. If on_track, explain what's right and what still needs sharpening. If off_track, explain what core concept they're missing.
"demonstratedUnderstanding": an array of 1-4 short strings naming the specific lesson ideas the founder did demonstrate.
"missingUnderstanding": an array of 0-3 short strings naming only the specific lesson ideas still missing. Empty array if passed.
"evidenceQuote": a short exact quote from the founder answer that best supports your judgment, or null if no useful quote exists.

Evaluation rules:
- Judge understanding, not phrasing. Do not require the founder to use the lesson's exact words.
- Pass answers that accurately connect the lesson to the founder's own behavior, systems, decisions, or business execution.
- Do not mark an answer incomplete just because it could be sharper. Mark it incomplete only when a required concept is actually absent or materially confused.
- If the answer is incomplete, the feedback must identify the exact missing idea rather than restarting the lesson.`
        }],
        "You evaluate founder understanding for Forge Academy. Be strict enough to protect quality, but encouraging and direct. Return only valid JSON."
    );

    try {
        const parsed = JSON.parse(raw);
        const trackStatus: KnowledgeCheckTrackStatus =
            parsed?.trackStatus === "passed" ? "passed" :
            parsed?.trackStatus === "on_track" ? "on_track" : "off_track";
        const demonstratedUnderstanding = Array.isArray(parsed?.demonstratedUnderstanding)
            ? parsed.demonstratedUnderstanding.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 4)
            : [];
        const missingUnderstanding = Array.isArray(parsed?.missingUnderstanding)
            ? parsed.missingUnderstanding.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 3)
            : [];
        return {
            passed: trackStatus === "passed",
            trackStatus,
            feedback: typeof parsed?.feedback === "string" && parsed.feedback.trim()
                ? parsed.feedback.trim()
                : "Forge could not produce clear feedback. Try again with a more concrete explanation.",
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
            feedback: "Forge could not evaluate that answer cleanly. Try again with a clearer explanation in your own words.",
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
            content: `Evaluate this Forge Academy knowledge check answer.

Lesson title: ${entry.title}
Knowledge check prompt: ${prompt}

Expected understanding points:
${rubric}

Founder answer:
${answer}

Return valid JSON only with exactly these keys:
"trackStatus": exactly one of "passed", "on_track", or "off_track". Use "passed" if the founder clearly demonstrates the core understanding. Use "on_track" if they show partial understanding or are heading in the right direction but need refinement. Use "off_track" only if they fundamentally miss the point or show no real grasp of the lesson.
"passed": true only if trackStatus is "passed", false otherwise
"feedback": short feedback in 2-4 sentences. If passed, explain what landed well. If on_track, explain what's right and what still needs sharpening. If off_track, explain what core concept they're missing.
"demonstratedUnderstanding": an array of 1-4 short strings naming the specific lesson ideas the founder did demonstrate.
"missingUnderstanding": an array of 0-3 short strings naming only the specific lesson ideas still missing. Empty array if passed.
"evidenceQuote": a short exact quote from the founder answer that best supports your judgment, or null if no useful quote exists.

Evaluation rules:
- Judge understanding, not phrasing. Do not require the founder to use the lesson's exact words.
- Pass answers that accurately connect the lesson to the founder's own behavior, systems, decisions, or business execution.
- Do not mark an answer incomplete just because it could be sharper. Mark it incomplete only when a required concept is actually absent or materially confused.
- If the answer is incomplete, the feedback must identify the exact missing idea rather than restarting the lesson.`
        }],
        "You evaluate founder understanding for Forge Academy. Be strict enough to protect quality, but encouraging and direct. Return only valid JSON."
    );

    try {
        const parsed = JSON.parse(raw);
        const trackStatus: KnowledgeCheckTrackStatus =
            parsed?.trackStatus === "passed" ? "passed" :
            parsed?.trackStatus === "on_track" ? "on_track" : "off_track";
        const demonstratedUnderstanding = Array.isArray(parsed?.demonstratedUnderstanding)
            ? parsed.demonstratedUnderstanding.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 4)
            : [];
        const missingUnderstanding = Array.isArray(parsed?.missingUnderstanding)
            ? parsed.missingUnderstanding.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 3)
            : [];
        return {
            passed: trackStatus === "passed",
            trackStatus,
            feedback: typeof parsed?.feedback === "string" && parsed.feedback.trim()
                ? parsed.feedback.trim()
                : "Forge could not produce clear feedback. Try again with a more concrete explanation.",
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
            feedback: "Forge could not evaluate that answer cleanly. Try again with a clearer explanation in your own words.",
            demonstratedUnderstanding: [],
            missingUnderstanding: ["The answer could not be evaluated cleanly."],
            evidenceQuote: null,
        };
    }
}
