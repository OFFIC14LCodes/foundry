import { supabase } from "../supabase";
import { callForgeAPI } from "./forgeApi";
import { recordAcademyHistory, upsertAcademyContentProgress } from "./academyDb";
import type { AcademyContent, AcademySessionMode, AcademyTopicLaunch } from "./academy";

export type KnowledgeCheckEvaluation = {
    passed: boolean;
    feedback: string;
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
}: {
    userId: string;
    contentId: string;
    contentTitle?: string | null;
    response?: string | null;
    feedback?: string | null;
    completedAt?: string | null;
    source?: "lesson_modal" | "forge_chat" | "academy";
}): Promise<CompletedAcademyLessonResult> {
    const completedTimestamp = completedAt ?? new Date().toISOString();
    const contentProgress = await upsertAcademyContentProgress(userId, contentId, true, {
        knowledgeCheckedAt: completedTimestamp,
        lastCheckResponse: response ?? null,
        lastCheckFeedback: feedback ?? null,
    });

    await recordAcademyHistory(userId, "completed", {
        contentId,
        metadata: {
            title: contentTitle ?? null,
            source,
        },
    });

    const { data, error } = await supabase
        .from("user_lesson_progress")
        .upsert({
            user_id: userId,
            content_id: contentId,
            status: "completed",
            started_at: completedTimestamp,
            completed_at: completedTimestamp,
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
"passed": true or false
"feedback": short feedback in 2-4 sentences. If weak, explain what is missing and what to sharpen. If strong, explain why it landed and what judgment the founder now has.`
        }],
        "You evaluate founder understanding for Forge Academy. Be strict enough to protect quality, but encouraging and direct. Return only valid JSON."
    );

    try {
        const parsed = JSON.parse(raw);
        return {
            passed: Boolean(parsed?.passed),
            feedback: typeof parsed?.feedback === "string" && parsed.feedback.trim()
                ? parsed.feedback.trim()
                : "Forge could not produce clear feedback. Try again with a more concrete explanation.",
        };
    } catch {
        return {
            passed: false,
            feedback: "Forge could not evaluate that answer cleanly. Try again with a clearer explanation in your own words.",
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
"passed": true or false
"feedback": short feedback in 2-4 sentences. If weak, explain what is missing and what to sharpen. If strong, explain why it landed and what judgment the founder now has.`
        }],
        "You evaluate founder understanding for Forge Academy. Be strict enough to protect quality, but encouraging and direct. Return only valid JSON."
    );

    try {
        const parsed = JSON.parse(raw);
        return {
            passed: Boolean(parsed?.passed),
            feedback: typeof parsed?.feedback === "string" && parsed.feedback.trim()
                ? parsed.feedback.trim()
                : "Forge could not produce clear feedback. Try again with a more concrete explanation.",
        };
    } catch {
        return {
            passed: false,
            feedback: "Forge could not evaluate that answer cleanly. Try again with a clearer explanation in your own words.",
        };
    }
}
