import { STAGES_DATA } from "../constants/stages";

export type AcademyContentType = "topic" | "video" | "resource" | "mindset";
export type AcademySourceType = "foundry_original" | "external_youtube" | "external_resource";
export type AcademyStatus = "draft" | "published" | "hidden";
export type AcademyProgressStatus = "not_started" | "in_progress" | "completed";
export type AcademyHistoryAction =
    | "viewed"
    | "opened_forge"
    | "completed"
    | "started_video"
    | "completed_series_item";

export type AcademyCategory = {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    accentColor: string | null;
    sortOrder: number;
    isMindset: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
};

export type AcademyTag = {
    id: string;
    slug: string;
    name: string;
    createdAt: string;
};

export type AcademyContent = {
    id: string;
    slug: string;
    title: string;
    shortDescription: string;
    description: string | null;
    contentType: AcademyContentType;
    categoryId: string | null;
    sourceType: AcademySourceType;
    stageIds: number[];
    difficultyLabel: string | null;
    thumbnailUrl: string | null;
    estimatedMinutes: number | null;
    whyThisMatters: string | null;
    whatToWatchFor: string | null;
    learningGoal: string | null;
    whoThisIsFor: string | null;
    whenThisMatters: string | null;
    commonMistake: string | null;
    starterPrompt: string | null;
    forgeContext: string | null;
    knowledgeCheckPrompt: string | null;
    knowledgeCheckExpectedPoints: string[];
    completionBadgeLabel: string | null;
    videoUrl: string | null;
    youtubeVideoId: string | null;
    resourceUrl: string | null;
    transcript: string | null;
    featured: boolean;
    priority: number;
    pathStage: number | null;
    isCore: boolean;
    status: AcademyStatus;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
    category: AcademyCategory | null;
    tags: AcademyTag[];
};

export type AcademySeries = {
    id: string;
    slug: string;
    title: string;
    shortDescription: string;
    description: string | null;
    categoryId: string | null;
    stageIds: number[];
    difficultyLabel: string | null;
    estimatedMinutes: number | null;
    featured: boolean;
    priority: number;
    status: AcademyStatus;
    learningGoal: string | null;
    coverImageUrl: string | null;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
    category: AcademyCategory | null;
    items: AcademySeriesItem[];
};

export type AcademySeriesItem = {
    id: string;
    seriesId: string;
    contentId: string;
    position: number;
    titleOverride: string | null;
    descriptionOverride: string | null;
    required: boolean;
    createdAt: string;
    content: AcademyContent | null;
};

export type AcademyUserContentProgress = {
    userId: string;
    contentId: string;
    status: AcademyProgressStatus;
    completedAt: string | null;
    knowledgeCheckedAt: string | null;
    lastCheckResponse: string | null;
    lastCheckFeedback: string | null;
    lastOpenedAt: string | null;
    lastForgeOpenedAt: string | null;
    updatedAt: string;
};

export type AcademySessionMode = "learn" | "apply" | "knowledge_check";

export type AcademyUserSeriesItemProgress = {
    userId: string;
    seriesId: string;
    seriesItemId: string;
    status: AcademyProgressStatus;
    completedAt: string | null;
    lastOpenedAt: string | null;
    updatedAt: string;
};

export type AcademyUserHistory = {
    id: string;
    userId: string;
    contentId: string | null;
    seriesId: string | null;
    seriesItemId: string | null;
    action: AcademyHistoryAction;
    metadata: Record<string, unknown>;
    createdAt: string;
};

export type AcademyWorkspace = {
    categories: AcademyCategory[];
    tags: AcademyTag[];
    content: AcademyContent[];
    series: AcademySeries[];
    contentProgress: AcademyUserContentProgress[];
    seriesItemProgress: AcademyUserSeriesItemProgress[];
    history: AcademyUserHistory[];
};

export type AcademyAdminWorkspace = AcademyWorkspace;

export type AcademyTopicLaunch = {
    id: string;
    title: string;
    sessionMode: AcademySessionMode;
    categoryTitle: string | null;
    stageIds: number[];
    learningGoal: string | null;
    whoThisIsFor: string | null;
    whenThisMatters: string | null;
    commonMistake: string | null;
    starterPrompt: string | null;
    forgeContext: string | null;
    whyThisMatters: string | null;
    whatToWatchFor: string | null;
    knowledgeCheckPrompt: string | null;
    knowledgeCheckExpectedPoints: string[];
    completionBadgeLabel: string | null;
    tags: string[];
};

export function slugifyAcademyValue(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

export function extractYoutubeVideoId(input: string | null | undefined) {
    const raw = (input ?? "").trim();
    if (!raw) return null;

    const normalized = raw.replace(/&amp;/g, "&");
    if (/^[A-Za-z0-9_-]{11}$/.test(normalized)) return normalized;

    const candidates = [
        normalized,
        normalized.startsWith("http://") || normalized.startsWith("https://") ? normalized : `https://${normalized}`,
    ];

    for (const candidate of candidates) {
        try {
            const url = new URL(candidate);
            const host = url.hostname.replace(/^www\./i, "").toLowerCase();
            const pathSegments = url.pathname.split("/").filter(Boolean);

            if (host === "youtu.be") {
                const shortId = pathSegments[0];
                if (shortId && /^[A-Za-z0-9_-]{11}$/.test(shortId)) return shortId;
            }

            if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
                const queryId = url.searchParams.get("v");
                if (queryId && /^[A-Za-z0-9_-]{11}$/.test(queryId)) return queryId;

                const markerIndex = pathSegments.findIndex((segment) => ["embed", "shorts", "live", "v"].includes(segment));
                const pathId = markerIndex >= 0 ? pathSegments[markerIndex + 1] : null;
                if (pathId && /^[A-Za-z0-9_-]{11}$/.test(pathId)) return pathId;
            }
        } catch {
            continue;
        }
    }

    const fallbackMatch = normalized.match(/([A-Za-z0-9_-]{11})/);
    if (fallbackMatch?.[1]) return fallbackMatch[1];
    return null;
}

export function buildYoutubeEmbedUrl(videoId: string | null | undefined) {
    if (!videoId) return null;
    return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

export function buildYoutubeThumbnailUrl(videoId: string | null | undefined) {
    if (!videoId) return null;
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function getAcademyStageLabels(stageIds: number[]) {
    return stageIds
        .map((stageId) => STAGES_DATA.find((stage) => stage.id === stageId))
        .filter((stage): stage is (typeof STAGES_DATA)[number] => Boolean(stage))
        .map((stage) => `Stage ${stage.id}: ${stage.label}`);
}

export function getAcademyContentTypeLabel(contentType: AcademyContentType) {
    switch (contentType) {
        case "topic":
            return "Topic";
        case "video":
            return "Video";
        case "resource":
            return "Resource";
        case "mindset":
            return "Winner's Mindset";
        default:
            return "Academy";
    }
}

export function getAcademyHistoryLabel(action: AcademyHistoryAction) {
    switch (action) {
        case "opened_forge":
            return "Started Forge session";
        case "completed":
            return "Completed";
        case "started_video":
            return "Started video";
        case "completed_series_item":
            return "Completed lesson";
        case "viewed":
        default:
            return "Viewed";
    }
}

export function getAcademyProgressLabel(status: AcademyProgressStatus | null | undefined) {
    switch (status) {
        case "completed":
            return "Completed";
        case "in_progress":
            return "In Progress";
        case "not_started":
        default:
            return "Not Started";
    }
}

export function toAcademyTopicLaunch(content: AcademyContent, sessionMode: AcademySessionMode = "learn"): AcademyTopicLaunch {
    return {
        id: content.id,
        title: content.title,
        sessionMode,
        categoryTitle: content.category?.title ?? null,
        stageIds: content.stageIds,
        learningGoal: content.learningGoal,
        whoThisIsFor: content.whoThisIsFor,
        whenThisMatters: content.whenThisMatters,
        commonMistake: content.commonMistake,
        starterPrompt: content.starterPrompt,
        forgeContext: content.forgeContext,
        whyThisMatters: content.whyThisMatters,
        whatToWatchFor: content.whatToWatchFor,
        knowledgeCheckPrompt: content.knowledgeCheckPrompt,
        knowledgeCheckExpectedPoints: content.knowledgeCheckExpectedPoints,
        completionBadgeLabel: content.completionBadgeLabel,
        tags: content.tags.map((tag) => tag.name),
    };
}
