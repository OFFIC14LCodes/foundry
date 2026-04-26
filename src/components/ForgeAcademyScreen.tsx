import { useEffect, useMemo, useState, type ReactNode, type ChangeEvent } from "react";
import { Archive } from "lucide-react";
import { STAGES_DATA } from "../constants/stages";
import { supabase } from "../supabase";
import {
    buildYoutubeEmbedUrl,
    buildYoutubeThumbnailUrl,
    getAcademyContentTypeLabel,
    getAcademyHistoryLabel,
    getAcademyProgressLabel,
    getAcademyStageLabels,
    toAcademyTopicLaunch,
    type AcademyContent,
    type AcademySeries,
    type AcademySeriesItem,
    type AcademyTopicLaunch,
    type AcademyUserContentProgress,
    type AcademyUserHistory,
    type AcademyUserSeriesItemProgress,
    type AcademyWorkspace,
} from "../lib/academy";
import { STAGE_COLORS } from "../constants/glossary";
import { loadGlossaryTerms, type GlossaryTerm } from "../lib/glossaryDb";
import {
    loadAcademyWorkspace,
    recordAcademyHistory,
    touchAcademyContentForgeOpened,
    touchAcademyContentOpened,
    upsertAcademyContentProgress,
    upsertAcademySeriesItemProgress,
} from "../lib/academyDb";
import Logo from "./Logo";
import type { AcademyBubbleContext } from "./ForgeBubble";

export type AcademyScreenContext = AcademyBubbleContext;

type ForgeAcademyScreenProps = {
    userId: string;
    profile: any;
    onBack: () => void;
    onLaunchForgeConversation: (entry: AcademyTopicLaunch) => void;
    onOpenAskForgeAnything: () => void;
    onContextChange?: (ctx: AcademyScreenContext) => void;
    onOpenArchive?: () => void;
    maxPreviewStage?: number | null;
    trialNotice?: string | null;
};

const surface = "rgba(255,255,255,0.03)";
const border = "1px solid rgba(255,255,255,0.08)";
const textMuted = "#9D978E";
const stageFilterOptions = [{ id: 0, label: "All stages" }, ...STAGES_DATA.map((stage) => ({ id: stage.id, label: `Stage ${stage.id}` }))];
const PATH_STAGE_DESCRIPTIONS: Record<number, string> = {
    1: "Prove the problem is real before building anything",
    2: "Build a coherent business model before spending serious money",
    3: "Protect the business and founder with the right structure",
    4: "Build the financial foundation that makes every decision clearer",
    5: "Get the first paying customers and a repeatable way to find more",
    6: "Scale what's working without breaking what made it work",
};

type PathLessonStatus = "not_started" | "in_progress" | "completed";

type UserLessonProgressRow = {
    id: string;
    user_id: string;
    content_id: string;
    status: PathLessonStatus;
    started_at: string | null;
    completed_at: string | null;
    updated_at: string | null;
};

type PathSeriesBlock = {
    type: "series";
    id: string;
    priority: number;
    title: string;
    difficultyLabel: string | null;
    items: AcademyContent[];
    totalMinutes: number;
};

type PathLessonBlock = {
    type: "lesson";
    id: string;
    priority: number;
    lesson: AcademyContent;
};

type PathStageGroup = {
    stage: number;
    title: string;
    description: string;
    coreBlocks: Array<PathSeriesBlock | PathLessonBlock>;
    enrichmentBlocks: Array<PathSeriesBlock | PathLessonBlock>;
    coreLessons: AcademyContent[];
    enrichmentLessons: AcademyContent[];
    completedCoreCount: number;
    completedLessonCount: number;
    totalLessonCount: number;
    totalCoreCount: number;
};

type PathRecommendation = {
    lesson: AcademyContent;
    reason: string;
    action: "Continue" | "Start";
};

function isMissingRelationError(error: any) {
    const message = String(error?.message ?? "").toLowerCase();
    return error?.code === "PGRST205" || message.includes("user_lesson_progress");
}

export default function ForgeAcademyScreen({
    userId,
    profile,
    onBack,
    onLaunchForgeConversation,
    onOpenAskForgeAnything,
    onContextChange,
    onOpenArchive,
    maxPreviewStage = null,
    trialNotice = null,
}: ForgeAcademyScreenProps) {
    const [workspace, setWorkspace] = useState<AcademyWorkspace>({
        categories: [],
        tags: [],
        content: [],
        series: [],
        contentProgress: [],
        seriesItemProgress: [],
        history: [],
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | "all">("all");
    const [selectedStageId, setSelectedStageId] = useState<number>(0);
    const [selectedContent, setSelectedContent] = useState<AcademyContent | null>(null);
    const [selectedSeries, setSelectedSeries] = useState<AcademySeries | null>(null);
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 900);
    const [activeView, setActiveView] = useState<"path" | "library" | "glossary" | "guide">("path");
    const [glossaryTerms, setGlossaryTerms] = useState<GlossaryTerm[]>([]);
    const [glossaryLoading, setGlossaryLoading] = useState(false);
    const [pathProgressRows, setPathProgressRows] = useState<UserLessonProgressRow[]>([]);
    const [pathProgressLoading, setPathProgressLoading] = useState(true);
    const [expandedEnrichmentStages, setExpandedEnrichmentStages] = useState<Record<number, boolean>>({});

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 900);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        if (maxPreviewStage === null) return;
        if (selectedStageId === 0 || selectedStageId <= maxPreviewStage) return;
        setSelectedStageId(0);
    }, [maxPreviewStage, selectedStageId]);

    useEffect(() => {
        if (!onContextChange) return;
        const categoryLabel = selectedCategoryId === "all"
            ? "all"
            : workspace.categories.find((c) => c.id === selectedCategoryId)?.title ?? selectedCategoryId;
        onContextChange({
            screen: "ForgeAcademy",
            activeLesson: selectedContent
                ? {
                    title: selectedContent.title,
                    discipline: selectedContent.category?.title ?? getAcademyContentTypeLabel(selectedContent.contentType),
                    description: selectedContent.shortDescription ?? "",
                    whyItMatters: selectedContent.whyThisMatters ?? "",
                }
                : null,
            currentFilter: categoryLabel,
            stage: Number(profile?.currentStage) || 1,
        });
    }, [selectedContent, selectedCategoryId, workspace.categories, profile?.currentStage]);

    const refreshWorkspace = async () => {
        setLoading(true);
        setError(null);
        try {
            const next = await loadAcademyWorkspace(userId);
            setWorkspace(next);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Unable to load Forge Academy.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void refreshWorkspace();
    }, [userId]);

    useEffect(() => {
        let cancelled = false;
        setPathProgressLoading(true);
        supabase
            .from("user_lesson_progress")
            .select("*")
            .eq("user_id", userId)
            .then(({ data, error: progressError }) => {
                if (cancelled) return;
                if (progressError) {
                    if (!isMissingRelationError(progressError)) {
                        console.error("user lesson progress load error:", progressError);
                    }
                    setPathProgressRows([]);
                    return;
                }
                setPathProgressRows((data ?? []) as UserLessonProgressRow[]);
            })
            .finally(() => {
                if (!cancelled) setPathProgressLoading(false);
            });
        return () => { cancelled = true; };
    }, [userId]);

    useEffect(() => {
        const stage = Number(profile?.currentStage) || 1;
        setGlossaryLoading(true);
        loadGlossaryTerms(stage)
            .then(setGlossaryTerms)
            .catch(() => {})
            .finally(() => setGlossaryLoading(false));
    }, [userId, profile?.currentStage]);

    const contentProgressById = useMemo(
        () => new Map(workspace.contentProgress.map((entry) => [entry.contentId, entry])),
        [workspace.contentProgress]
    );
    const seriesItemProgressById = useMemo(
        () => new Map(workspace.seriesItemProgress.map((entry) => [entry.seriesItemId, entry])),
        [workspace.seriesItemProgress]
    );
    const visibleContent = useMemo(() => {
        if (maxPreviewStage === null) return workspace.content;
        return workspace.content.filter((entry) => entry.stageIds.some((stageId) => stageId <= maxPreviewStage));
    }, [maxPreviewStage, workspace.content]);
    const visibleContentIds = useMemo(() => new Set(visibleContent.map((entry) => entry.id)), [visibleContent]);
    const visibleSeries = useMemo(() => {
        if (maxPreviewStage === null) return workspace.series;
        return workspace.series
            .map((entry) => {
                const items = entry.items.filter((item) => item.content && visibleContentIds.has(item.content.id));
                const stageIds = Array.from(new Set(items.flatMap((item) => item.content?.stageIds ?? []))).sort((a, b) => a - b);
                return { ...entry, items, stageIds };
            })
            .filter((entry) => entry.items.length > 0);
    }, [maxPreviewStage, visibleContentIds, workspace.series]);
    const visibleContentById = useMemo(() => new Map(visibleContent.map((entry) => [entry.id, entry])), [visibleContent]);
    const visibleSeriesById = useMemo(() => new Map(visibleSeries.map((entry) => [entry.id, entry])), [visibleSeries]);
    const visibleSeriesItemIds = useMemo(() => new Set(visibleSeries.flatMap((entry) => entry.items.map((item) => item.id))), [visibleSeries]);
    const stageOptions = useMemo(() => (
        maxPreviewStage === null
            ? stageFilterOptions
            : stageFilterOptions.filter((stage) => stage.id === 0 || stage.id <= maxPreviewStage)
    ), [maxPreviewStage]);
    const pathProgressByContentId = useMemo(
        () => new Map(pathProgressRows.map((entry) => [entry.content_id, entry])),
        [pathProgressRows]
    );
    const effectiveContentProgressById = useMemo(() => {
        const merged = new Map(contentProgressById);
        pathProgressRows.forEach((entry) => {
            merged.set(entry.content_id, {
                userId: entry.user_id,
                contentId: entry.content_id,
                status: entry.status,
                completedAt: entry.completed_at,
                lastOpenedAt: entry.started_at ?? entry.updated_at,
                lastForgeOpenedAt: null,
                updatedAt: entry.updated_at ?? new Date().toISOString(),
            });
        });
        return merged;
    }, [contentProgressById, pathProgressRows]);

    const filteredContent = useMemo(() => {
        return visibleContent.filter((entry) => {
            const categoryMatch = selectedCategoryId === "all" || entry.categoryId === selectedCategoryId;
            const stageMatch = selectedStageId === 0 || entry.stageIds.includes(selectedStageId);
            return categoryMatch && stageMatch;
        });
    }, [selectedCategoryId, selectedStageId, visibleContent]);

    const filteredSeries = useMemo(() => {
        return visibleSeries.filter((entry) => {
            const categoryMatch = selectedCategoryId === "all" || entry.categoryId === selectedCategoryId;
            const stageMatch = selectedStageId === 0 || entry.stageIds.includes(selectedStageId);
            return categoryMatch && stageMatch;
        });
    }, [selectedCategoryId, selectedStageId, visibleSeries]);

    const featuredTopics = filteredContent.filter((entry) => {
        if (entry.contentType !== "topic" || !entry.featured) return false;
        const status = effectiveContentProgressById.get(entry.id)?.status;
        return status !== "in_progress" && status !== "completed";
    }).slice(0, 6);
    const lessonSeries = filteredSeries.slice(0, 6);
    const videos = filteredContent.filter((entry) => entry.contentType === "video").slice(0, 6);
    const resources = filteredContent.filter((entry) => entry.contentType === "resource").slice(0, 6);
    const mindset = filteredContent.filter((entry) => entry.contentType === "mindset").slice(0, 6);
    const continueLearning = filteredContent
        .filter((entry) => effectiveContentProgressById.get(entry.id)?.status === "in_progress")
        .sort((a, b) => {
            const aOpened = effectiveContentProgressById.get(a.id)?.lastOpenedAt ?? "";
            const bOpened = effectiveContentProgressById.get(b.id)?.lastOpenedAt ?? "";
            return bOpened.localeCompare(aOpened);
        })
        .slice(0, 4);
    const recentlyViewed = Array.from(new Map(
        workspace.history
            .filter((entry) => entry.contentId && (entry.action === "viewed" || entry.action === "started_video" || entry.action === "opened_forge"))
            .map((entry) => {
                const content = entry.contentId ? visibleContentById.get(entry.contentId) : undefined;
                return content ? [content.id, content] : null;
            })
            .filter(Boolean) as Array<[string, AcademyContent]>
    ).values())
        .filter((entry) => !continueLearning.some((item) => item.id === entry.id))
        .slice(0, 4);

    const completedContentCount = Array.from(effectiveContentProgressById.values()).filter((entry) => entry.status === "completed" && visibleContentIds.has(entry.contentId)).length;
    const totalLessonsCount = visibleContent.length;
    const completedSeriesItems = workspace.seriesItemProgress.filter((entry) => entry.status === "completed" && visibleSeriesItemIds.has(entry.seriesItemId)).length;
    const recentHistory = workspace.history.filter((entry) => (
        (!entry.contentId || visibleContentIds.has(entry.contentId)) &&
        (!entry.seriesId || visibleSeriesById.has(entry.seriesId))
    )).slice(0, 4);
    const nextSeriesUp = lessonSeries
        .map((series) => ({ series, nextItem: getNextSeriesItem(series, seriesItemProgressById) }))
        .filter((entry) => entry.nextItem)
        .slice(0, 3);

    const persistPathProgress = async (contentId: string, status: PathLessonStatus) => {
        const existing = pathProgressByContentId.get(contentId) ?? null;
        const now = new Date().toISOString();
        const payload = {
            user_id: userId,
            content_id: contentId,
            status,
            started_at: status === "not_started" ? null : existing?.started_at ?? now,
            completed_at: status === "completed" ? now : null,
            updated_at: now,
        };

        if (existing) {
            const { data, error: updateError } = await supabase
                .from("user_lesson_progress")
                .update(payload)
                .eq("id", existing.id)
                .select()
                .single();
            if (updateError) {
                if (!isMissingRelationError(updateError)) {
                    console.error("user lesson progress update error:", updateError);
                }
                return;
            }
            if (data) {
                setPathProgressRows((prev) => prev.map((entry) => entry.id === existing.id ? data as UserLessonProgressRow : entry));
            }
            return;
        }

        const { data, error: insertError } = await supabase
            .from("user_lesson_progress")
            .insert(payload)
            .select()
            .single();
        if (insertError) {
            if (!isMissingRelationError(insertError)) {
                console.error("user lesson progress insert error:", insertError);
            }
            return;
        }
        if (data) {
            setPathProgressRows((prev) => [data as UserLessonProgressRow, ...prev.filter((entry) => entry.content_id !== contentId)]);
        }
    };

    const markLessonInProgress = async (contentId: string) => {
        const currentStatus = pathProgressByContentId.get(contentId)?.status ?? "not_started";
        if (currentStatus === "completed" || currentStatus === "in_progress") return;
        await persistPathProgress(contentId, "in_progress");
    };

    const pathStageGroups = useMemo<PathStageGroup[]>(() => {
        const contentByStage = new Map<number, AcademyContent[]>();
        for (const content of visibleContent) {
            const stage = content.pathStage ?? content.stageIds[0] ?? 1;
            const existing = contentByStage.get(stage) ?? [];
            existing.push(content);
            contentByStage.set(stage, existing);
        }

        const seriesContentIds = new Set(visibleSeries.flatMap((series) => series.items.map((item) => item.contentId)));

        return Array.from({ length: 6 }, (_, index) => {
            const stage = index + 1;
            const stageLessons = [...(contentByStage.get(stage) ?? [])].sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
            const stageSeries = visibleSeries.flatMap((series) => {
                const items = [...series.items]
                    .filter((item) => item.content && (item.content.pathStage ?? item.content.stageIds[0] ?? 1) === stage)
                    .sort((a, b) => a.position - b.position || (a.content?.priority ?? 0) - (b.content?.priority ?? 0));
                if (items.length === 0) return [];

                const makeBlock = (suffix: string, blockItems: typeof items): PathSeriesBlock | null => {
                    const lessons = blockItems.map((item) => item.content).filter((item): item is AcademyContent => Boolean(item));
                    if (lessons.length === 0) return null;
                    return {
                        type: "series",
                        id: `${series.id}-${suffix}`,
                        priority: Math.min(...lessons.map((lesson) => lesson.priority)),
                        title: series.title,
                        difficultyLabel: series.difficultyLabel,
                        items: lessons,
                        totalMinutes: lessons.reduce((sum, lesson) => sum + (lesson.estimatedMinutes ?? 0), 0),
                    };
                };

                return [
                    makeBlock("core", items.filter((item) => item.content?.isCore)),
                    makeBlock("enrichment", items.filter((item) => !item.content?.isCore)),
                ].filter((entry): entry is PathSeriesBlock => Boolean(entry));
            });

            const standaloneLessons = stageLessons
                .filter((lesson) => !seriesContentIds.has(lesson.id))
                .map((lesson) => ({
                    type: "lesson" as const,
                    id: lesson.id,
                    priority: lesson.priority,
                    lesson,
                }));

            const allBlocks = [...stageSeries, ...standaloneLessons].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
            const coreBlocks = allBlocks.filter((block) => block.type === "series" ? block.items[0]?.isCore : block.lesson.isCore);
            const enrichmentBlocks = allBlocks.filter((block) => block.type === "series" ? !block.items[0]?.isCore : !block.lesson.isCore);
            const coreLessons = stageLessons.filter((lesson) => lesson.isCore);
            const enrichmentLessons = stageLessons.filter((lesson) => !lesson.isCore);
            const completedCoreCount = coreLessons.filter((lesson) => pathProgressByContentId.get(lesson.id)?.status === "completed").length;
            const completedLessonCount = stageLessons.filter((lesson) => pathProgressByContentId.get(lesson.id)?.status === "completed").length;

            return {
                stage,
                title: STAGES_DATA.find((entry) => entry.id === stage)?.label ?? `Stage ${stage}`,
                description: PATH_STAGE_DESCRIPTIONS[stage],
                coreBlocks,
                enrichmentBlocks,
                coreLessons,
                enrichmentLessons,
                completedCoreCount,
                completedLessonCount,
                totalLessonCount: stageLessons.length,
                totalCoreCount: coreLessons.length,
            };
        });
    }, [pathProgressByContentId, visibleContent, visibleSeries]);

    const pathRecommendation = useMemo<PathRecommendation | null>(() => {
        const allCoreLessons = pathStageGroups.flatMap((group) => group.coreLessons);
        const inProgressLesson = allCoreLessons.find((lesson) => pathProgressByContentId.get(lesson.id)?.status === "in_progress")
            ?? visibleContent.find((lesson) => pathProgressByContentId.get(lesson.id)?.status === "in_progress")
            ?? null;
        if (inProgressLesson) {
            return {
                lesson: inProgressLesson,
                reason: "You already started this lesson. Keep the thread warm and build from the thinking that is already moving.",
                action: "Continue",
            };
        }

        const firstIncompleteStage = pathStageGroups.find((group) => group.totalCoreCount === 0 || group.completedCoreCount < group.totalCoreCount) ?? null;
        if (firstIncompleteStage) {
            const nextLesson = firstIncompleteStage.coreLessons.find((lesson) => (pathProgressByContentId.get(lesson.id)?.status ?? "not_started") !== "completed") ?? firstIncompleteStage.coreLessons[0] ?? null;
            if (nextLesson) {
                return {
                    lesson: nextLesson,
                    reason: `Stage ${firstIncompleteStage.stage} is your active stretch right now. This is the next core lesson that moves the path forward.`,
                    action: pathProgressByContentId.get(nextLesson.id)?.status === "in_progress" ? "Continue" : "Start",
                };
            }
        }

        const nextEnrichmentLesson = pathStageGroups
            .flatMap((group) => group.enrichmentLessons)
            .find((lesson) => (pathProgressByContentId.get(lesson.id)?.status ?? "not_started") !== "completed") ?? null;
        if (nextEnrichmentLesson) {
            return {
                lesson: nextEnrichmentLesson,
                reason: "You cleared the core path. Go deeper where a stronger founder instinct still compounds.",
                action: "Start",
            };
        }

        return visibleContent[0]
            ? {
                lesson: visibleContent[0],
                reason: "Start with the first lesson on the path and let the roadmap build from there.",
                action: "Start",
            }
            : null;
    }, [pathProgressByContentId, pathStageGroups, visibleContent]);

    const activePathStage = pathRecommendation?.lesson.pathStage
        ?? pathStageGroups.find((group) => group.totalCoreCount === 0 || group.completedCoreCount < group.totalCoreCount)?.stage
        ?? 1;

    const toggleEnrichmentStage = (stage: number) => {
        setExpandedEnrichmentStages((prev) => ({ ...prev, [stage]: !prev[stage] }));
    };

    const launchLessonFromPath = async (content: AcademyContent) => {
        await handleLaunchForge(content);
    };

    const openContent = async (content: AcademyContent, action: "viewed" | "started_video" = "viewed") => {
        setSelectedSeries(null);
        setSelectedContent(content);
        try {
            await markLessonInProgress(content.id);
            await touchAcademyContentOpened(userId, content.id);
            await recordAcademyHistory(userId, action, {
                contentId: content.id,
                metadata: { title: content.title, contentType: content.contentType },
            });
            setWorkspace((prev) => ({
                ...prev,
                contentProgress: mergeContentProgress(prev.contentProgress, {
                    userId,
                    contentId: content.id,
                    status: contentProgressById.get(content.id)?.status ?? "in_progress",
                    completedAt: contentProgressById.get(content.id)?.completedAt ?? null,
                    lastOpenedAt: new Date().toISOString(),
                    lastForgeOpenedAt: contentProgressById.get(content.id)?.lastForgeOpenedAt ?? null,
                    updatedAt: new Date().toISOString(),
                }),
                history: [
                    {
                        id: `local-${Date.now()}`,
                        userId,
                        contentId: content.id,
                        seriesId: null,
                        seriesItemId: null,
                        action,
                        metadata: { title: content.title, contentType: content.contentType },
                        createdAt: new Date().toISOString(),
                    },
                    ...prev.history,
                ].slice(0, 18),
            }));
        } catch (historyError) {
            console.error("academy open content error:", historyError);
        }
    };

    const openSeries = async (series: AcademySeries) => {
        setSelectedContent(null);
        setSelectedSeries(series);
    };

    const handleLaunchForge = async (content: AcademyContent) => {
        if (!canLaunchForgeFromContent(content)) return;
        setBusyKey(`forge-${content.id}`);
        try {
            await markLessonInProgress(content.id);
            await touchAcademyContentForgeOpened(userId, content.id);
            await recordAcademyHistory(userId, "opened_forge", {
                contentId: content.id,
                metadata: { title: content.title },
            });
            onLaunchForgeConversation(toAcademyTopicLaunch(content));
        } catch (launchError) {
            console.error("academy launch forge error:", launchError);
        } finally {
            setBusyKey(null);
        }
    };

    const handleToggleContentComplete = async (content: AcademyContent, completed: boolean) => {
        setBusyKey(`content-${content.id}`);
        try {
            await persistPathProgress(content.id, completed ? "completed" : "in_progress");
            const progress = await upsertAcademyContentProgress(userId, content.id, completed);
            if (completed) {
                await recordAcademyHistory(userId, "completed", {
                    contentId: content.id,
                    metadata: { title: content.title },
                });
            }
            setWorkspace((prev) => ({
                ...prev,
                contentProgress: mergeContentProgress(prev.contentProgress, progress),
                history: completed
                    ? [{
                        id: `local-${Date.now()}`,
                        userId,
                        contentId: content.id,
                        seriesId: null,
                        seriesItemId: null,
                        action: "completed",
                        metadata: { title: content.title },
                        createdAt: new Date().toISOString(),
                    }, ...prev.history].slice(0, 18)
                    : prev.history,
            }));
        } catch (progressError) {
            console.error("academy complete content error:", progressError);
        } finally {
            setBusyKey(null);
        }
    };

    const handleToggleSeriesItemComplete = async (series: AcademySeries, item: AcademySeriesItem, completed: boolean) => {
        setBusyKey(`series-item-${item.id}`);
        try {
            await persistPathProgress(item.contentId, completed ? "completed" : "in_progress");
            const progress = await upsertAcademySeriesItemProgress(userId, series.id, item.id, completed);
            if (completed) {
                await recordAcademyHistory(userId, "completed_series_item", {
                    contentId: item.contentId,
                    seriesId: series.id,
                    seriesItemId: item.id,
                    metadata: { seriesTitle: series.title, itemTitle: getSeriesItemTitle(item) },
                });
            }
            setWorkspace((prev) => ({
                ...prev,
                seriesItemProgress: mergeSeriesItemProgress(prev.seriesItemProgress, progress),
                history: completed
                    ? [{
                        id: `local-${Date.now()}`,
                        userId,
                        contentId: item.contentId,
                        seriesId: series.id,
                        seriesItemId: item.id,
                        action: "completed_series_item",
                        metadata: { seriesTitle: series.title, itemTitle: getSeriesItemTitle(item) },
                        createdAt: new Date().toISOString(),
                    }, ...prev.history].slice(0, 18)
                    : prev.history,
            }));
        } catch (seriesProgressError) {
            console.error("academy complete series item error:", seriesProgressError);
        } finally {
            setBusyKey(null);
        }
    };

    if (loading) {
        return (
            <AcademyShell onBack={onBack} onOpenArchive={onOpenArchive}>
                <CenteredState
                    title="Loading Forge Academy"
                    body="Pulling together the current curriculum, learning history, and founder progress."
                />
            </AcademyShell>
        );
    }

    if (error) {
        return (
            <AcademyShell onBack={onBack} onOpenArchive={onOpenArchive}>
                <CenteredState
                    title="Forge Academy is unavailable"
                    body={error}
                    action={<InlineButton onClick={() => void refreshWorkspace()}>Retry</InlineButton>}
                />
            </AcademyShell>
        );
    }

    return (
        <AcademyShell onBack={onBack} onOpenArchive={onOpenArchive}>
            <div style={{ display: "flex", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <FilterPill active={activeView === "path"} onClick={() => setActiveView("path")}>Path</FilterPill>
                <FilterPill active={activeView === "library"} onClick={() => setActiveView("library")}>Library</FilterPill>
                <FilterPill active={activeView === "glossary"} onClick={() => setActiveView("glossary")}>Glossary</FilterPill>
                <FilterPill active={activeView === "guide"} onClick={() => setActiveView("guide")}>Guide</FilterPill>
            </div>

            {activeView === "path" && (
                <PathView
                    stages={pathStageGroups}
                    recommendation={pathRecommendation}
                    activeStage={activePathStage}
                    progressByContentId={pathProgressByContentId}
                    loading={pathProgressLoading}
                    busyKey={busyKey}
                    onOpenLesson={(content) => void openContent(content, content.contentType === "video" ? "started_video" : "viewed")}
                    onLaunchLesson={launchLessonFromPath}
                    expandedEnrichmentStages={expandedEnrichmentStages}
                    onToggleEnrichmentStage={toggleEnrichmentStage}
                    trialNotice={trialNotice}
                />
            )}

            {activeView === "glossary" && (
                <GlossaryView terms={glossaryTerms} loading={glossaryLoading} />
            )}

            {activeView === "guide" && (
                <div style={{ maxWidth: 1180, margin: "0 auto" }}>
                    <AcademyGuideCard activeView={activeView} />
                </div>
            )}

            {activeView === "library" && (
            <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 18 }}>
                <div style={{
                    background: "linear-gradient(180deg, rgba(232,98,42,0.07), rgba(255,255,255,0.025))",
                    border,
                    borderRadius: 28,
                    padding: "28px 26px 24px",
                }}>
                    <div style={{ display: "grid", gap: 18, maxWidth: 780, margin: "0 auto", textAlign: "center" }}>
                        <div style={{ fontSize: "var(--foundry-academy-sm-font)", color: "#E8622A", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                            Forge Academy
                        </div>
                        <div style={{ fontSize: "clamp(30px, 5vw, 48px)", lineHeight: 0.97, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8" }}>
                            Sharpen your thinking before the stakes get real
                        </div>
                        <div style={{ fontSize: 15, color: "#BDAFA2", lineHeight: 1.85, fontStyle: "italic" }}>
                            Where founders build better instincts — before the market charges tuition for the lessons.
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                            <HeroPill label={`${totalLessonsCount} lessons available`} />
                            <HeroPill label={`${visibleSeries.length} series`} />
                            <HeroPill label={`${completedContentCount} completed`} />
                        </div>
                        {trialNotice && (
                            <div style={{
                                padding: "12px 14px",
                                borderRadius: 14,
                                background: "rgba(232,98,42,0.08)",
                                border: "1px solid rgba(232,98,42,0.18)",
                                fontSize: 12,
                                color: "#D9C7B8",
                                lineHeight: 1.65,
                            }}>
                                {trialNotice}
                            </div>
                        )}
                        {continueLearning.length > 0 && (
                            <div style={{ fontSize: 13, color: "#9D978E" }}>
                                You have {continueLearning.length} lesson{continueLearning.length !== 1 ? "s" : ""} in progress —{" "}
                                <button
                                    onClick={() => document.getElementById("continue-learning")?.scrollIntoView({ behavior: "smooth" })}
                                    style={{ background: "none", border: "none", color: "#E8622A", fontSize: 13, cursor: "pointer", padding: 0, fontFamily: "inherit", textDecoration: "underline" }}
                                >
                                    {continueLearning[0].title}
                                </button>
                            </div>
                        )}
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                            <InlineButton onClick={() => document.getElementById("featured-topics")?.scrollIntoView({ behavior: "smooth" })}>
                                Start with Featured Topics
                            </InlineButton>
                            <InlineButton tone="muted" onClick={() => document.getElementById("filter-row")?.scrollIntoView({ behavior: "smooth" })}>
                                Browse by Discipline
                            </InlineButton>
                        </div>
                    </div>
                </div>

                <div id="filter-row" style={{ display: "grid", gap: 12 }}>
                    <SectionHeader
                        eyebrow="Explore the room"
                        title="Follow what matters now, or what you keep avoiding"
                        description="You do not need a perfect plan. Filter by stage or discipline when you want direction, or leave it open and pick the thing that feels relevant, difficult, or overdue."
                        align="center"
                    />
                    <div style={{ background: surface, border, borderRadius: 22, padding: 16, display: "grid", gap: 14 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            <FilterPill active={selectedCategoryId === "all"} onClick={() => setSelectedCategoryId("all")}>All disciplines</FilterPill>
                            {workspace.categories.filter((category) => category.isActive).map((category) => (
                                <FilterPill
                                    key={category.id}
                                    active={selectedCategoryId === category.id}
                                    onClick={() => setSelectedCategoryId(category.id)}
                                >
                                    {category.title}
                                </FilterPill>
                            ))}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {stageOptions.map((stage) => (
                                <FilterPill
                                    key={stage.id}
                                    active={selectedStageId === stage.id}
                                    onClick={() => setSelectedStageId(stage.id)}
                                >
                                    {stage.label}
                                </FilterPill>
                            ))}
                        </div>
                    </div>
                </div>

                {(() => {
                    const sectionContinueLearning = (
                        <div id="continue-learning">
                            <AcademySection
                                eyebrow="Continue Learning"
                                title="Pick back up where the spark already started"
                                description="The easiest way to keep moving is to reopen something that already got under your skin."
                                items={continueLearning}
                                emptyTitle="Your momentum starts with one strong click"
                                emptyBody="Open one lesson that feels relevant or uncomfortable. Academy will remember it and give you a way back in."
                                tone="ember"
                                renderItem={(entry) => (
                                    <ContentCard
                                        key={entry.id}
                                        content={entry}
                                        progress={effectiveContentProgressById.get(entry.id)}
                                        onOpen={() => void openContent(entry, entry.contentType === "video" ? "started_video" : "viewed")}
                                        onLaunchForge={() => void handleLaunchForge(entry)}
                                        busy={busyKey === `forge-${entry.id}`}
                                        emphasis={entry.contentType === "mindset" ? "mindset" : "default"}
                                        continueLearning
                                    />
                                )}
                            />
                        </div>
                    );
                    const sectionDivider = (
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
                            <div style={{ fontSize: "var(--foundry-academy-xs-font)", color: "#E8622A", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap" }}>Featured Topics</div>
                            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
                        </div>
                    );
                    const sectionFeaturedTopics = (
                        <div id="featured-topics">
                            <AcademySection
                                eyebrow=""
                                title="Ideas that make founders sharper fast"
                                description="These are strong starting points. Open them before the market teaches the lesson in a more expensive way."
                                items={featuredTopics}
                                emptyTitle="The next sharp idea will land here"
                                emptyBody="Featured topics are meant to feel hard to ignore. When one lands here, it should earn the click."
                                tone="glow"
                                renderItem={(entry) => (
                                    <ContentCard
                                        key={entry.id}
                                        content={entry}
                                        progress={effectiveContentProgressById.get(entry.id)}
                                        onOpen={() => void openContent(entry)}
                                        onLaunchForge={() => void handleLaunchForge(entry)}
                                        busy={busyKey === `forge-${entry.id}`}
                                    />
                                )}
                            />
                        </div>
                    );
                    const sectionLessonSeries = (
                        <AcademySection
                            eyebrow="Lesson Series"
                            title="Developmental paths that build on themselves"
                            description="Series are for when one good idea is not enough. Move through them in order and let the thinking stack."
                            items={lessonSeries}
                            emptyTitle="A structured path is coming into view"
                            emptyBody="When a series belongs here, it should feel like a real progression, not a playlist."
                            tone="blue"
                            renderItem={(entry) => (
                                <SeriesCard
                                    key={entry.id}
                                    series={entry}
                                    progressMap={seriesItemProgressById}
                                    onOpen={() => void openSeries(entry)}
                                />
                            )}
                        />
                    );
                    const sectionRecentlyViewed = recentlyViewed.length > 0 ? (
                        <AcademySection
                            eyebrow="Recently Viewed"
                            title="Things that caught your attention recently"
                            description="Founder learning is rarely neat. Come back to what grabbed you and see it again with better eyes."
                            items={recentlyViewed}
                            emptyTitle="Your trail will start to form here"
                            emptyBody="As soon as you start opening things, Academy will keep the useful doors from disappearing on you."
                            tone="neutral"
                            renderItem={(entry) => (
                                <ContentCard
                                    key={entry.id}
                                    content={entry}
                                    progress={effectiveContentProgressById.get(entry.id)}
                                    onOpen={() => void openContent(entry, entry.contentType === "video" ? "started_video" : "viewed")}
                                    onLaunchForge={() => void handleLaunchForge(entry)}
                                    busy={busyKey === `forge-${entry.id}`}
                                    emphasis={entry.contentType === "mindset" ? "mindset" : "default"}
                                />
                            )}
                        />
                    ) : null;
                    const sectionVideos = (
                        <AcademySection
                            eyebrow="Videos"
                            title="Practical insight you can sit with for ten minutes"
                            description="These videos earn their place by making the next real-world move clearer."
                            items={videos}
                            emptyTitle="The right watch is better than more noise"
                            emptyBody="When a video earns a place here, it should leave you clearer, not just more informed."
                            tone="blue"
                            renderItem={(entry) => (
                                <ContentCard
                                    key={entry.id}
                                    content={entry}
                                    progress={effectiveContentProgressById.get(entry.id)}
                                    onOpen={() => void openContent(entry, "started_video")}
                                    onLaunchForge={() => void handleLaunchForge(entry)}
                                    busy={busyKey === `forge-${entry.id}`}
                                />
                            )}
                        />
                    );
                    const sectionResources = (
                        <AcademySection
                            eyebrow="Resources"
                            title="Frameworks you will be glad to revisit"
                            description="These are the steady tools. Open them when your thinking is messy and you need structure fast."
                            items={resources}
                            emptyTitle="Your dependable tools will gather here"
                            emptyBody="This is where the useful tools live when the business gets noisy and you need something solid."
                            tone="stone"
                            renderItem={(entry) => (
                                <ContentCard
                                    key={entry.id}
                                    content={entry}
                                    progress={effectiveContentProgressById.get(entry.id)}
                                    onOpen={() => void openContent(entry)}
                                    onLaunchForge={() => void handleLaunchForge(entry)}
                                    busy={busyKey === `forge-${entry.id}`}
                                />
                            )}
                        />
                    );
                    const sectionMindset = (
                        <AcademySection
                            eyebrow="Winner's Mindset"
                            title="The deeper work underneath founder performance"
                            description="This is the inner work: identity, uncertainty, rejection, hesitation, and the patterns that quietly run the founder."
                            items={mindset}
                            emptyTitle="The inner game has a place here too"
                            emptyBody="When these lessons land, they should name the thing you have been carrying but not saying clearly."
                            tone="mindset"
                            renderItem={(entry) => (
                                <ContentCard
                                    key={entry.id}
                                    content={entry}
                                    progress={effectiveContentProgressById.get(entry.id)}
                                    onOpen={() => void openContent(entry)}
                                    onLaunchForge={() => void handleLaunchForge(entry)}
                                    busy={busyKey === `forge-${entry.id}`}
                                    emphasis="mindset"
                                />
                            )}
                        />
                    );
                    const cardAskForge = (
                        <AsideCard eyebrow="Ask Forge" title="Need a sharper thought partner right now?" description="Guided lessons stay primary. Freeform Forge is for the question that does not fit neatly anywhere yet." tone="ember">
                            <div style={{ display: "grid", gap: 10 }}>
                                <div style={{ fontSize: 13, color: "#C8C4BE", lineHeight: 1.8 }}>Bring the messy question, the edge case, or the half-formed thought you want turned into something useful.</div>
                                <InlineButton onClick={onOpenAskForgeAnything}>Ask Forge Anything</InlineButton>
                            </div>
                        </AsideCard>
                    );
                    const cardProgress = (
                        <AsideCard eyebrow="Progress" title="How your edge is building" description="This only matters if it changes how you notice, decide, and move. Use the numbers as momentum, not wallpaper." tone="glow">
                            <MetricRow label="Completed content" value={String(completedContentCount)} />
                            <MetricRow label="Completed series items" value={String(completedSeriesItems)} />
                            <MetricRow label="In-progress lessons" value={String(continueLearning.length)} />
                            <MetricRow label="Featured topics available" value={String(featuredTopics.length)} />
                            <MetricRow label="Mindset lessons available" value={String(mindset.length)} />
                        </AsideCard>
                    );
                    const cardNextUp = (
                        <AsideCard eyebrow="Next Up" title="When you want an obvious next move" description="These are the paths where the next step is obvious, so you can spend your energy learning instead of deciding what to click." tone="blue">
                            {nextSeriesUp.length === 0 ? (
                                <div style={{ fontSize: 13, color: "#777", lineHeight: 1.7 }}>Start a lesson series and the next recommended step shows up here.</div>
                            ) : (
                                <div style={{ display: "grid", gap: 10 }}>
                                    {nextSeriesUp.map(({ series, nextItem }) => (
                                        <button key={series.id} onClick={() => void openSeries(series)} style={{ background: "linear-gradient(135deg, rgba(99,179,237,0.10), rgba(255,255,255,0.03))", border, borderRadius: 16, padding: 14, textAlign: "left", cursor: "pointer", display: "grid", gap: 6 }}>
                                            <div style={{ fontSize: "var(--foundry-academy-sm-font)", color: "#63B3ED", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{series.title}</div>
                                            <div style={{ fontSize: 14, color: "#F0EDE8", fontWeight: 700 }}>Continue with {getSeriesItemTitle(nextItem!)}</div>
                                            <div style={{ fontSize: "var(--foundry-academy-md-font)", color: "#9D978E", lineHeight: 1.7 }}>Lesson {nextItem?.position} of {series.items.length}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </AsideCard>
                    );
                    const cardUseWell = (
                        <AsideCard eyebrow="Use Academy well" title="A simple rhythm that works" description="The point is not to consume more. It is to let one useful idea change how you operate this week." tone="mindset">
                            <div style={{ display: "grid", gap: 10 }}>
                                {["Open one topic before you think you need it.", "Use Forge conversations to convert theory into your actual situation.", "Treat mindset entries like operating discipline, not motivation.", "Revisit resources when a decision starts to feel noisy."].map((item) => (
                                    <div key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#E8622A", marginTop: 7, flexShrink: 0 }} />
                                        <div style={{ fontSize: 13, color: "#C8C4BE", lineHeight: 1.7 }}>{item}</div>
                                    </div>
                                ))}
                            </div>
                        </AsideCard>
                    );
                    const cardHistory = (
                        <AsideCard eyebrow="Learning History" title="Your trail through Academy" description="Not a passive log. More like a reminder of what has already started shifting how you think." tone="stone">
                            {recentHistory.length === 0 ? (
                                <div style={{ fontSize: 13, color: "#777", lineHeight: 1.7 }}>Open one real lesson and the trail starts here.</div>
                            ) : (
                                <div style={{ display: "grid", gap: 10 }}>
                                    {recentHistory.map((entry) => (
                                        <HistoryRow key={entry.id} entry={entry} content={entry.contentId ? visibleContentById.get(entry.contentId) ?? null : null} series={entry.seriesId ? visibleSeriesById.get(entry.seriesId) ?? null : null} />
                                    ))}
                                </div>
                            )}
                        </AsideCard>
                    );

                    if (isMobile) {
                        return (
                            <div style={{ display: "grid", gap: 18 }}>
                                {cardAskForge}
                                {sectionContinueLearning}
                                {sectionDivider}
                                {sectionFeaturedTopics}
                                {sectionLessonSeries}
                                {sectionVideos}
                                {sectionResources}
                                {sectionMindset}
                                {sectionRecentlyViewed}
                                {cardProgress}
                                {cardNextUp}
                                {cardUseWell}
                                {cardHistory}
                            </div>
                        );
                    }

                    return (
                        <div style={{ display: "grid", gap: 18, gridTemplateColumns: "minmax(0, 1.6fr) minmax(280px, 0.9fr)" }}>
                            <div style={{ minWidth: 0, display: "grid", gap: 18 }}>
                                {sectionContinueLearning}
                                {sectionDivider}
                                {sectionFeaturedTopics}
                                {sectionLessonSeries}
                                {sectionRecentlyViewed}
                                {sectionVideos}
                                {sectionResources}
                                {sectionMindset}
                            </div>
                            <div style={{ minWidth: 0, display: "grid", gap: 18, alignContent: "start" }}>
                                {cardAskForge}
                                {cardHistory}
                                {cardProgress}
                                {cardNextUp}
                                {cardUseWell}
                            </div>
                        </div>
                    );
                })()}
            </div>
            )}

            {selectedContent && (
                <ContentDetailModal
                    content={selectedContent}
                    progress={effectiveContentProgressById.get(selectedContent.id)}
                    onClose={() => setSelectedContent(null)}
                    onToggleComplete={(completed) => void handleToggleContentComplete(selectedContent, completed)}
                    onLaunchForge={canLaunchForgeFromContent(selectedContent) ? () => void handleLaunchForge(selectedContent) : undefined}
                    busy={busyKey === `content-${selectedContent.id}` || busyKey === `forge-${selectedContent.id}`}
                />
            )}

            {selectedSeries && (
                <SeriesDetailModal
                    series={selectedSeries}
                    progressMap={seriesItemProgressById}
                    onClose={() => setSelectedSeries(null)}
                    onOpenItem={(content) => void openContent(content, content.contentType === "video" ? "started_video" : "viewed")}
                    onToggleSeriesItem={(item, completed) => void handleToggleSeriesItemComplete(selectedSeries, item, completed)}
                    busyKey={busyKey}
                />
            )}
        </AcademyShell>
    );
}

function AcademyGuideCard({ activeView }: { activeView: "path" | "library" | "guide" }) {
    return (
        <div style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "16px 18px",
            borderRadius: 18,
            background: "rgba(255,255,255,0.03)",
            border,
            display: "grid",
            gap: 14,
        }}>
            <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: "var(--foundry-academy-xs-font)", color: "#E8622A", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>
                    How To Use Forge Academy
                </div>
                <div style={{ fontSize: 18, lineHeight: 1.15, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8" }}>
                    Learn the room once, then the whole system makes sense
                </div>
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <GuideBlock
                    title="Core"
                    body="The main required lessons for a stage. Clear these first if you want the strongest path through Academy."
                />
                <GuideBlock
                    title="Applied"
                    body="A practical lesson meant to sharpen judgment in real business situations, not just teach theory."
                />
                <GuideBlock
                    title="Go Deeper"
                    body="Optional enrichment lessons. Use these after the core path when you want more reps, nuance, or context."
                />
                <GuideBlock
                    title="Learn with Forge"
                    body="Opens a guided Forge conversation from that lesson so you can turn the topic into your actual situation."
                />
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <GuideBlock
                    title="Path"
                    body="The primary roadmap. Use it when you want Forge Academy to show the next stage-based lesson in sequence."
                />
                <GuideBlock
                    title="Library"
                    body="The browseable catalog. Use filters to explore by discipline or stage when you already know what you want."
                />
                <GuideBlock
                    title="Glossary"
                    body="A quick-reference language bank. Search terms by name or meaning, and use it when Forge uses business language you want to ground more clearly."
                />
                <GuideBlock
                    title="Archive"
                    body="Saved Academy chats and lesson conversations live in Archive, so useful teaching does not disappear after one session."
                />
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <GuideBlock
                    title="Continue Learning"
                    body="Picks up lessons you already opened or started, so you do not lose momentum every time you leave Academy."
                />
                <GuideBlock
                    title="Featured Topics"
                    body="Strong starting points picked to matter early. Use these when you want a sharp lesson fast rather than a full sequence."
                />
                <GuideBlock
                    title="Lesson Series"
                    body="Multi-lesson tracks that stack ideas in order. Best when one concept is not enough and you want a fuller progression."
                />
                <GuideBlock
                    title="Winner's Mindset"
                    body="The founder psychology side of the work: hesitation, identity, resilience, fear, and patterns that affect execution."
                />
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <GuideBlock
                    title="Start Learning"
                    body="Opens the lesson walkthrough first, so you get the structured teaching before going into conversation with Forge."
                />
                <GuideBlock
                    title="Recommendation Card"
                    body="At the top of Path, Forge Academy suggests the best next lesson based on what is in progress and what core work is still incomplete."
                />
                <GuideBlock
                    title="Progress Status"
                    body="Not Started means untouched, In Progress means you began the lesson or opened it with Forge, and Completed means you marked it done."
                />
                <GuideBlock
                    title="Filters"
                    body="Library filters help when the room is too broad. Narrow by discipline or stage when you want signal, not more scrolling."
                />
            </div>

            <div style={{
                padding: "12px 14px",
                borderRadius: 14,
                background: "rgba(232,98,42,0.06)",
                border: "1px solid rgba(232,98,42,0.16)",
                fontSize: 13,
                color: "#C8C4BE",
                lineHeight: 1.75,
            }}>
                {activeView === "path"
                    ? "Path is the roadmap. Move stage by stage, complete the core lessons, then open Go Deeper when you want extra depth. Use Library when you want to browse the full curriculum more freely."
                    : activeView === "library"
                        ? "Library is the browseable catalog. Use it when you already know what you want to study, want to reopen lessons, or want to jump by category instead of following the path."
                        : "Use this Guide tab when you want a quick reset on Academy language, navigation, lesson states, and where to go next. Then jump back into Path, Library, or Glossary when you are ready."}
            </div>
        </div>
    );
}

function GuideBlock({ title, body }: { title: string; body: string }) {
    return (
        <div style={{
            padding: "12px 13px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            display: "grid",
            gap: 6,
        }}>
            <div style={{ fontSize: 13, color: "#F0EDE8", fontWeight: 700 }}>
                {title}
            </div>
            <div style={{ fontSize: 12, color: "#A8A4A0", lineHeight: 1.7 }}>
                {body}
            </div>
        </div>
    );
}

function PathView({
    stages,
    recommendation,
    activeStage,
    progressByContentId,
    loading,
    busyKey,
    onOpenLesson,
    onLaunchLesson,
    expandedEnrichmentStages,
    onToggleEnrichmentStage,
    trialNotice,
}: {
    stages: PathStageGroup[];
    recommendation: PathRecommendation | null;
    activeStage: number;
    progressByContentId: Map<string, UserLessonProgressRow>;
    loading: boolean;
    busyKey: string | null;
    onOpenLesson: (content: AcademyContent) => void;
    onLaunchLesson: (content: AcademyContent) => void;
    expandedEnrichmentStages: Record<number, boolean>;
    onToggleEnrichmentStage: (stage: number) => void;
    trialNotice?: string | null;
}) {
    return (
        <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 18 }}>
            <div style={{
                background: "linear-gradient(180deg, rgba(232,98,42,0.08), rgba(255,255,255,0.02))",
                border,
                borderRadius: 26,
                padding: "24px 22px",
                display: "grid",
                gap: 16,
            }}>
                <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ fontSize: "var(--foundry-academy-sm-font)", color: "#E8622A", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                        Forge Academy Path
                    </div>
                    <div style={{ fontSize: "clamp(28px, 4.4vw, 40px)", lineHeight: 1.02, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8" }}>
                        A roadmap, not a pile of lessons
                    </div>
                    <div style={{ fontSize: 14, color: "#BDAFA2", lineHeight: 1.8, fontStyle: "italic" }}>
                        Move stage by stage. Clear the core path first. Go deeper when the business needs depth, not distraction.
                    </div>
                </div>

                {trialNotice && (
                    <div style={{
                        padding: "12px 14px",
                        borderRadius: 14,
                        background: "rgba(232,98,42,0.08)",
                        border: "1px solid rgba(232,98,42,0.18)",
                        fontSize: 12,
                        color: "#D9C7B8",
                        lineHeight: 1.65,
                    }}>
                        {trialNotice}
                    </div>
                )}

                <div style={{
                    background: "rgba(255,255,255,0.03)",
                    border,
                    borderRadius: 20,
                    padding: "18px 18px 16px",
                    display: "grid",
                    gap: 12,
                }}>
                    <div style={{ fontSize: "var(--foundry-academy-xs-font)", color: "#E8622A", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>
                        Your next step
                    </div>
                    {loading ? (
                        <div style={{ fontSize: 14, color: textMuted, lineHeight: 1.7 }}>Loading your lesson progress...</div>
                    ) : recommendation ? (
                        <>
                            <div style={{ fontSize: 26, lineHeight: 1.08, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8" }}>
                                {recommendation.lesson.title}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                <HeroPill label={`Stage ${recommendation.lesson.pathStage ?? recommendation.lesson.stageIds[0] ?? 1}`} />
                                {recommendation.lesson.difficultyLabel && <HeroPill label={recommendation.lesson.difficultyLabel} />}
                                {recommendation.lesson.estimatedMinutes ? <HeroPill label={`${recommendation.lesson.estimatedMinutes} min`} /> : null}
                            </div>
                            <div style={{ fontSize: 14, color: "#C8C4BE", lineHeight: 1.8 }}>
                                {recommendation.reason}
                            </div>
                            <div>
                                <InlineButton onClick={() => onLaunchLesson(recommendation.lesson)}>
                                    {recommendation.action}
                                </InlineButton>
                            </div>
                        </>
                    ) : (
                        <div style={{ fontSize: 14, color: textMuted, lineHeight: 1.7 }}>No lessons are available on the path yet.</div>
                    )}
                </div>
            </div>

            <div style={{ position: "relative", display: "grid", gap: 18 }}>
                <div style={{
                    position: "absolute",
                    left: 30,
                    top: 12,
                    bottom: 12,
                    width: 3,
                    borderRadius: 999,
                    background: "linear-gradient(180deg, rgba(232,98,42,0.42), rgba(255,255,255,0.1))",
                    boxShadow: "0 0 18px rgba(232,98,42,0.08)",
                    pointerEvents: "none",
                }} />
                {stages.map((stage) => (
                    <PathStageCard
                        key={stage.stage}
                        stage={stage}
                        activeStage={activeStage}
                        progressByContentId={progressByContentId}
                        busyKey={busyKey}
                        onOpenLesson={onOpenLesson}
                        onLaunchLesson={onLaunchLesson}
                        enrichmentExpanded={Boolean(expandedEnrichmentStages[stage.stage])}
                        onToggleEnrichment={() => onToggleEnrichmentStage(stage.stage)}
                    />
                ))}
            </div>
        </div>
    );
}

function PathStageCard({
    stage,
    activeStage,
    progressByContentId,
    busyKey,
    onOpenLesson,
    onLaunchLesson,
    enrichmentExpanded,
    onToggleEnrichment,
}: {
    stage: PathStageGroup;
    activeStage: number;
    progressByContentId: Map<string, UserLessonProgressRow>;
    busyKey: string | null;
    onOpenLesson: (content: AcademyContent) => void;
    onLaunchLesson: (content: AcademyContent) => void;
    enrichmentExpanded: boolean;
    onToggleEnrichment: () => void;
}) {
    const allCoreComplete = stage.totalCoreCount > 0 && stage.completedCoreCount >= stage.totalCoreCount;
    const stageColor = allCoreComplete
        ? "#4CAF8A"
        : stage.stage === activeStage
            ? "#E8622A"
            : "rgba(255,255,255,0.2)";

    return (
        <div style={{ position: "relative", paddingLeft: 84 }}>
            <div style={{
                position: "absolute",
                left: 16,
                top: 9,
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: `radial-gradient(circle at 35% 35%, ${stageColor}55, rgba(8,8,9,0.95))`,
                border: `1px solid ${stageColor}`,
                boxShadow: `0 0 0 6px ${stageColor}14, inset 0 0 18px rgba(255,255,255,0.05)`,
                zIndex: 1,
            }} />
            <div style={{
                position: "absolute",
                left: 26,
                top: 19,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: stageColor,
                boxShadow: `0 0 12px ${stageColor}66`,
                zIndex: 2,
            }} />
            <div style={{
                position: "absolute",
                left: 46,
                top: 22,
                width: 34,
                height: 3,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${stageColor}, rgba(255,255,255,0.18))`,
                opacity: 0.95,
            }} />

            <div style={{
                background: "rgba(255,255,255,0.025)",
                border,
                borderRadius: 22,
                padding: "20px 20px 18px",
                display: "grid",
                gap: 16,
            }}>
                <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ display: "grid", gap: 4 }}>
                            <div style={{ fontSize: "var(--foundry-academy-xs-font)", color: stageColor, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
                                Stage {stage.stage}
                            </div>
                            <div style={{ fontSize: 24, lineHeight: 1.08, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8" }}>
                                {stage.title}
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <HeroPill label={`${stage.completedLessonCount}/${stage.totalLessonCount} complete`} />
                            <HeroPill label={`${stage.totalCoreCount} core lesson${stage.totalCoreCount === 1 ? "" : "s"}`} />
                            {stage.enrichmentLessons.length > 0 ? <HeroPill label={`${stage.enrichmentLessons.length} deeper lesson${stage.enrichmentLessons.length === 1 ? "" : "s"}`} /> : null}
                        </div>
                    </div>
                    <div style={{ fontSize: 14, color: "#C8C4BE", lineHeight: 1.8 }}>
                        {stage.description}
                    </div>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                    {stage.coreBlocks.length > 0 ? stage.coreBlocks.map((block) => (
                        block.type === "series"
                            ? <PathSeriesGroup key={`series-${block.id}`} block={block} progressByContentId={progressByContentId} busyKey={busyKey} onOpenLesson={onOpenLesson} onLaunchLesson={onLaunchLesson} />
                            : <PathLessonNode key={block.lesson.id} lesson={block.lesson} progress={progressByContentId.get(block.lesson.id) ?? null} busy={busyKey === `forge-${block.lesson.id}`} onOpen={() => onOpenLesson(block.lesson)} onLaunch={() => onLaunchLesson(block.lesson)} />
                    )) : (
                        <div style={{ fontSize: 13, color: "#777", lineHeight: 1.7 }}>
                            No core lessons have been mapped to this stage yet.
                        </div>
                    )}
                </div>

                {stage.enrichmentBlocks.length > 0 && (
                    <div style={{ display: "grid", gap: 12 }}>
                        <button
                            onClick={onToggleEnrichment}
                            style={{
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid rgba(255,255,255,0.06)",
                                borderRadius: 14,
                                padding: "12px 14px",
                                color: "rgba(240,237,232,0.6)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 10,
                                fontFamily: "'Lora', Georgia, serif",
                                fontSize: 13,
                            }}
                        >
                            <span>{`Go Deeper · ${stage.enrichmentLessons.length} lesson${stage.enrichmentLessons.length === 1 ? "" : "s"}`}</span>
                            <span>{enrichmentExpanded ? "−" : "+"}</span>
                        </button>
                        {enrichmentExpanded && (
                            <div style={{ display: "grid", gap: 12 }}>
                                {stage.enrichmentBlocks.map((block) => (
                                    block.type === "series"
                                        ? <PathSeriesGroup key={`series-${block.id}`} block={block} progressByContentId={progressByContentId} busyKey={busyKey} onOpenLesson={onOpenLesson} onLaunchLesson={onLaunchLesson} muted />
                                        : <PathLessonNode key={block.lesson.id} lesson={block.lesson} progress={progressByContentId.get(block.lesson.id) ?? null} busy={busyKey === `forge-${block.lesson.id}`} onOpen={() => onOpenLesson(block.lesson)} onLaunch={() => onLaunchLesson(block.lesson)} muted />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function PathSeriesGroup({
    block,
    progressByContentId,
    busyKey,
    onOpenLesson,
    onLaunchLesson,
    muted = false,
}: {
    block: PathSeriesBlock;
    progressByContentId: Map<string, UserLessonProgressRow>;
    busyKey: string | null;
    onOpenLesson: (content: AcademyContent) => void;
    onLaunchLesson: (content: AcademyContent) => void;
    muted?: boolean;
}) {
    return (
        <div style={{
            background: muted ? "rgba(255,255,255,0.02)" : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.025))",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 18,
            padding: "14px 14px 12px 14px",
            display: "grid",
            gap: 12,
        }}>
            <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 16, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: muted ? "rgba(240,237,232,0.72)" : "#F0EDE8" }}>
                        {block.title}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <SeriesMetaBadge label={`${block.items.length} lesson${block.items.length === 1 ? "" : "s"}`} muted={muted} />
                        <SeriesMetaBadge label={`${block.totalMinutes} min`} muted={muted} />
                        {block.difficultyLabel ? <SeriesMetaBadge label={block.difficultyLabel} muted={muted} /> : null}
                    </div>
                </div>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
                {block.items.map((lesson) => (
                    <PathLessonNode
                        key={lesson.id}
                        lesson={lesson}
                        progress={progressByContentId.get(lesson.id) ?? null}
                        busy={busyKey === `forge-${lesson.id}`}
                        onOpen={() => onOpenLesson(lesson)}
                        onLaunch={() => onLaunchLesson(lesson)}
                        muted={muted}
                    />
                ))}
            </div>
        </div>
    );
}

function PathLessonNode({
    lesson,
    progress,
    busy,
    onOpen,
    onLaunch,
    muted = false,
}: {
    lesson: AcademyContent;
    progress: UserLessonProgressRow | null;
    busy: boolean;
    onOpen: () => void;
    onLaunch: () => void;
    muted?: boolean;
}) {
    const status = progress?.status ?? "not_started";
    const statusColor = status === "completed" ? "#4CAF8A" : status === "in_progress" ? "#E8622A" : "rgba(255,255,255,0.35)";
    const textColor = muted ? "rgba(240,237,232,0.72)" : "#F0EDE8";
    const bodyColor = muted ? "rgba(240,237,232,0.6)" : "#C8C4BE";

    return (
        <div style={{ position: "relative", paddingLeft: 34 }}>
            <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, borderRadius: "50%", background: "rgba(8,8,9,0.98)", border: `1px solid ${statusColor}`, boxShadow: `0 0 0 4px ${statusColor}12` }} />
            <div style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", width: 6, height: 6, borderRadius: "50%", background: statusColor, boxShadow: `0 0 10px ${statusColor}55` }} />
            <div style={{
                background: muted ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 16,
                padding: "14px 14px 13px",
                display: "grid",
                gap: 10,
            }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontSize: 18, lineHeight: 1.16, fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: textColor }}>
                            {lesson.title}
                        </div>
                        {lesson.shortDescription && (
                            <div style={{ fontSize: 13, color: bodyColor, lineHeight: 1.7 }}>
                                {lesson.shortDescription}
                            </div>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {lesson.difficultyLabel ? <SeriesMetaBadge label={lesson.difficultyLabel} muted={muted} /> : null}
                        {lesson.estimatedMinutes ? <SeriesMetaBadge label={`${lesson.estimatedMinutes} min`} muted={muted} /> : null}
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, color: statusColor, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        {status === "completed" ? "Completed" : status === "in_progress" ? "In Progress" : "Not Started"}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <InlineButton onClick={onOpen} tone="muted">
                            Start Learning
                        </InlineButton>
                        <InlineButton onClick={onLaunch} tone={muted ? "muted" : "primary"} disabled={busy}>
                            {busy ? "Opening..." : "Learn with Forge"}
                        </InlineButton>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SeriesMetaBadge({ label, muted = false }: { label: string; muted?: boolean }) {
    return (
        <div style={{
            padding: "5px 10px",
            borderRadius: 999,
            background: muted ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.045)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: muted ? "rgba(240,237,232,0.56)" : "#A8A4A0",
            fontSize: 11,
            lineHeight: 1,
            whiteSpace: "nowrap",
        }}>
            {label}
        </div>
    );
}

function GlossaryView({ terms, loading }: { terms: GlossaryTerm[]; loading: boolean }) {
    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return terms;
        return terms.filter((t) =>
            t.term.toLowerCase().includes(q) ||
            t.definition.toLowerCase().includes(q)
        );
    }, [search, terms]);

    const byCategory = useMemo(() => {
        const map = new Map<string, GlossaryTerm[]>();
        for (const t of filtered) {
            const list = map.get(t.category) ?? [];
            list.push(t);
            map.set(t.category, list);
        }
        return map;
    }, [filtered]);

    const categoryOrder = ["Strategy", "Finance", "Marketing", "Sales", "Legal"];
    const sortedCategories = Array.from(byCategory.keys()).sort((a, b) => {
        const ai = categoryOrder.indexOf(a);
        const bi = categoryOrder.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: "60px 20px", color: textMuted, fontSize: 14 }}>
                Loading glossary…
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 24 }}>
            <div style={{ display: "grid", gap: 10, maxWidth: 760, margin: "0 auto", textAlign: "center", width: "100%" }}>
                <div style={{ fontSize: "var(--foundry-academy-sm-font)", color: "#E8622A", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                    Forge Glossary
                </div>
                <div style={{ fontSize: "clamp(26px, 4vw, 38px)", lineHeight: 1.05, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8" }}>
                    The language that changes how you think
                </div>
                <div style={{ fontSize: 14, color: "#BDAFA2", lineHeight: 1.8, fontStyle: "italic" }}>
                    Terms unlock as you advance through the stages. Every one of these is a concept the market will teach you one way or another.
                </div>
            </div>

            <div style={{ position: "relative", maxWidth: 520, margin: "0 auto", width: "100%" }}>
                <input
                    type="text"
                    placeholder="Search terms…"
                    value={search}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "12px 16px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 14,
                        color: "#F0EDE8",
                        fontSize: 14,
                        fontFamily: "'Lora', Georgia, serif",
                        outline: "none",
                        boxSizing: "border-box",
                    }}
                />
            </div>

            {terms.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 20px", color: textMuted, fontSize: 14, lineHeight: 1.8 }}>
                    No glossary terms have been unlocked yet. Terms unlock as you move through the stages.
                </div>
            )}

            {terms.length > 0 && filtered.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 20px", color: textMuted, fontSize: 14 }}>
                    No terms match your search.
                </div>
            )}

            {sortedCategories.map((category) => {
                const categoryTerms = byCategory.get(category)!;
                return (
                    <div key={category} style={{ display: "grid", gap: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{ fontSize: "var(--foundry-academy-xs-font)", color: "#E8622A", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap" }}>
                                {category}
                            </div>
                            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                            {categoryTerms.map((t) => {
                                const stageColor = STAGE_COLORS[t.stage_unlock as keyof typeof STAGE_COLORS] ?? "#F5A843";
                                return (
                                    <div key={t.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 18, display: "grid", gap: 12 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                                            <div style={{ fontSize: 16, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8", lineHeight: 1.2 }}>
                                                {t.term}
                                            </div>
                                            <div style={{ fontSize: 10, color: stageColor, background: `${stageColor}18`, border: `1px solid ${stageColor}30`, borderRadius: 20, padding: "2px 9px", fontWeight: 500, flexShrink: 0 }}>
                                                Stage {t.stage_unlock}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 13, color: "#C8C4BE", lineHeight: 1.75 }}>
                                            {t.definition}
                                        </div>
                                        <div style={{ fontSize: 12, color: "#7A736B", fontStyle: "italic", lineHeight: 1.7, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                                            {t.usage_example}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function AcademyShell({ children, onBack, onOpenArchive }: { children: ReactNode; onBack: () => void; onOpenArchive?: () => void }) {
    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "#080809", color: "#F0EDE8", display: "flex", flexDirection: "column", fontFamily: "'Lora', Georgia, serif" }}>
            <div style={{ padding: "max(14px, calc(10px + env(safe-area-inset-top))) 18px 12px", borderBottom: border, background: "rgba(8,8,9,0.95)", backdropFilter: "blur(16px)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <button onClick={onBack} style={{ background: "rgba(255,255,255,0.05)", border, borderRadius: 9, padding: "var(--foundry-app-header-button-padding)", color: "#C8C4BE", fontSize: "var(--foundry-app-header-button-font)", cursor: "pointer" }}>
                    ← Hub
                </button>
                <div style={{ width: 34, height: 34, borderRadius: 12, background: "rgba(232,98,42,0.12)", border: "1px solid rgba(232,98,42,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Logo variant="forge" style={{ width: "var(--foundry-app-header-icon-size)", height: "var(--foundry-app-header-icon-size)", objectFit: "contain" }} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "var(--foundry-app-header-title-font)", fontWeight: 600 }}>Forge Academy</div>
                    <div style={{ fontSize: "var(--foundry-app-header-meta-font)", color: "#6E675F" }}>Curated founder education</div>
                </div>
                {onOpenArchive && (
                    <button
                        onClick={onOpenArchive}
                        style={{ background: "rgba(232,98,42,0.08)", border: "1px solid rgba(232,98,42,0.2)", borderRadius: 9, padding: "var(--foundry-app-header-button-padding)", color: "#E8622A", fontSize: "var(--foundry-app-header-button-font)", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
                    >
                        <Archive size={"var(--foundry-app-header-icon-size)"} />
                        Archive
                    </button>
                )}
            </div>
            <div className="foundry-app-page__content" style={{ flex: 1, overflowY: "auto", padding: "22px 18px 36px" }}>
                {children}
            </div>
        </div>
    );
}

function SectionHeader({
    eyebrow,
    title,
    description,
    align = "left",
}: {
    eyebrow: string;
    title: string;
    description: string;
    align?: "left" | "center";
}) {
    return (
        <div style={{ textAlign: align }}>
            {eyebrow && <div style={{ fontSize: "var(--foundry-academy-xs-font)", color: "#E8622A", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>{eyebrow}</div>}
            <div style={{ fontSize: 28, lineHeight: 1.05, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8", marginBottom: 8 }}>
                {title}
            </div>
            <div style={{ fontSize: 13, color: textMuted, lineHeight: 1.8, maxWidth: 760, margin: align === "center" ? "0 auto" : undefined }}>
                {description}
            </div>
        </div>
    );
}

function AcademySection({
    eyebrow,
    title,
    description,
    items,
    renderItem,
    emptyTitle,
    emptyBody,
    tone = "neutral",
}: {
    eyebrow: string;
    title: string;
    description: string;
    items: unknown[];
    renderItem: (item: any) => ReactNode;
    emptyTitle: string;
    emptyBody: string;
    tone?: "neutral" | "ember" | "glow" | "blue" | "stone" | "mindset";
}) {
    const sectionStyles = {
        neutral: {
            panel: "rgba(255,255,255,0.03)",
            borderColor: "rgba(255,255,255,0.08)",
        },
        ember: {
            panel: "linear-gradient(180deg, rgba(232,98,42,0.09), rgba(255,255,255,0.02))",
            borderColor: "rgba(232,98,42,0.18)",
        },
        glow: {
            panel: "linear-gradient(180deg, rgba(232,98,42,0.08), rgba(99,179,237,0.04), rgba(255,255,255,0.02))",
            borderColor: "rgba(232,98,42,0.16)",
        },
        blue: {
            panel: "linear-gradient(180deg, rgba(99,179,237,0.09), rgba(255,255,255,0.02))",
            borderColor: "rgba(99,179,237,0.16)",
        },
        stone: {
            panel: "linear-gradient(180deg, rgba(200,169,110,0.08), rgba(255,255,255,0.02))",
            borderColor: "rgba(200,169,110,0.16)",
        },
        mindset: {
            panel: "linear-gradient(180deg, rgba(199,107,75,0.12), rgba(255,255,255,0.02))",
            borderColor: "rgba(199,107,75,0.18)",
        },
    } as const;
    const style = sectionStyles[tone];

    return (
        <div style={{ display: "grid", gap: 14 }}>
            <SectionHeader eyebrow={eyebrow} title={title} description={description} />
            {items.length === 0 ? (
                <div style={{ background: style.panel, border: `1px solid ${style.borderColor}`, borderRadius: 22, padding: 20 }}>
                    <div style={{ fontSize: 16, color: "#F0EDE8", fontWeight: 600, marginBottom: 8 }}>{emptyTitle}</div>
                    <div style={{ fontSize: 13, color: textMuted, lineHeight: 1.8 }}>{emptyBody}</div>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
                    {items.map((item) => renderItem(item))}
                </div>
            )}
        </div>
    );
}

function ContentCard({
    content,
    progress,
    onOpen,
    onLaunchForge,
    busy,
    emphasis = "default",
    continueLearning: isContinueLearning = false,
}: {
    content: AcademyContent;
    progress?: AcademyUserContentProgress;
    onOpen: () => void;
    onLaunchForge: () => void;
    busy: boolean;
    emphasis?: "default" | "mindset";
    continueLearning?: boolean;
}) {
    const stageLabels = getAcademyStageLabels(content.stageIds);
    const thumbnailUrl = content.thumbnailUrl || buildYoutubeThumbnailUrl(content.youtubeVideoId);

    return (
        <div
            style={{
                background: emphasis === "mindset"
                    ? "linear-gradient(180deg, rgba(199,107,75,0.14), rgba(255,255,255,0.03))"
                    : "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                border: isContinueLearning ? "1px solid rgba(99,179,237,0.22)" : border,
                borderLeft: isContinueLearning ? "3px solid rgba(99,179,237,0.4)" : undefined,
                borderRadius: 22,
                padding: 18,
                display: "flex",
                flexDirection: "column",
                gap: 14,
                minHeight: 262,
                boxShadow: emphasis === "mindset"
                    ? "0 14px 32px rgba(0,0,0,0.20)"
                    : "0 12px 28px rgba(0,0,0,0.16)",
            }}
        >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
                    <Pill tone={emphasis === "mindset" ? "warm" : "orange"}>{content.category?.title ?? getAcademyContentTypeLabel(content.contentType)}</Pill>
                    {content.difficultyLabel && <Pill>{content.difficultyLabel}</Pill>}
                <ProgressPill status={progress?.status} />
            </div>

            <div
                style={{
                    borderRadius: 18,
                    height: 96,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.06)",
                    background: thumbnailUrl
                        ? `linear-gradient(180deg, rgba(8,8,9,0.18), rgba(8,8,9,0.62)), url(${thumbnailUrl}) center/cover`
                        : emphasis === "mindset"
                            ? "linear-gradient(135deg, rgba(199,107,75,0.28), rgba(12,12,14,0.84))"
                            : "linear-gradient(135deg, rgba(232,98,42,0.24), rgba(99,179,237,0.16), rgba(12,12,14,0.88))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "12px 18px",
                }}
            >
                <div style={{ fontSize: 18, lineHeight: 1.12, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8", textShadow: "0 1px 6px rgba(0,0,0,0.5)", textAlign: "center" }}>
                    {content.title}
                </div>
            </div>

            <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
                <div style={{ fontSize: 13, color: "#B8B1A8", lineHeight: 1.8, maxWidth: 320 }}>
                    {content.shortDescription}
                </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
                {content.whyThisMatters && (
                    <div style={{ fontSize: "var(--foundry-academy-md-font)", color: "#E9C7B8", lineHeight: 1.7, textAlign: "left" }}>
                        <span style={{ color: "#E8622A", fontWeight: 700 }}>Why this matters:</span> {content.whyThisMatters}
                    </div>
                )}
                {content.commonMistake && (
                    <div style={{ fontSize: "var(--foundry-academy-md-font)", color: "#BFB7AE", lineHeight: 1.7, textAlign: "left" }}>
                        <span style={{ color: "#C8A96E", fontWeight: 700 }}>Common mistake:</span> {content.commonMistake}
                    </div>
                )}
                {stageLabels.length > 0 && (
                    <div style={{ fontSize: "var(--foundry-academy-sm-font)", color: "#8D857C", lineHeight: 1.6, textAlign: "center" }}>
                        {stageLabels.join(" · ")}
                    </div>
                )}
            </div>

            <div style={{ display: "grid", justifyItems: "center", gap: 12, marginTop: "auto" }}>
                <div style={{ fontSize: "var(--foundry-academy-sm-font)", color: "#6E675F" }}>
                    {content.estimatedMinutes ? `${content.estimatedMinutes} min` : "Deep dive"}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    <button type="button" onClick={onOpen} style={{ background: "rgba(255,255,255,0.04)", border, borderRadius: 999, padding: "8px 12px", color: "#C8C4BE", fontSize: "var(--foundry-academy-sm-font)", fontWeight: 700, cursor: "pointer" }}>
                        Start Learning
                    </button>
                    {canLaunchForgeFromContent(content) && (
                        <button
                            type="button"
                            onClick={onLaunchForge}
                            disabled={busy}
                            style={{
                                background: "rgba(232,98,42,0.12)",
                                border: "1px solid rgba(232,98,42,0.22)",
                                borderRadius: 999,
                                padding: "8px 12px",
                                color: "#E8622A",
                                fontSize: "var(--foundry-academy-sm-font)",
                                fontWeight: 700,
                                cursor: busy ? "default" : "pointer",
                            }}
                        >
                            {busy ? "Opening..." : "Learn with Forge"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function SeriesCard({
    series,
    progressMap,
    onOpen,
}: {
    series: AcademySeries;
    progressMap: Map<string, AcademyUserSeriesItemProgress>;
    onOpen: () => void;
}) {
    const completedItems = series.items.filter((item) => progressMap.get(item.id)?.status === "completed").length;
    const totalItems = Math.max(series.items.length, 1);
    const progress = Math.round((completedItems / totalItems) * 100);
    const nextItem = getNextSeriesItem(series, progressMap);
    const seriesStatus = completedItems === 0 ? "not_started" : completedItems >= series.items.length ? "completed" : "in_progress";

    return (
        <button
            type="button"
            onClick={onOpen}
            style={{
                background: "linear-gradient(180deg, rgba(99,179,237,0.10), rgba(255,255,255,0.02))",
                border,
                borderRadius: 22,
                padding: 18,
                textAlign: "center",
                cursor: "pointer",
                display: "grid",
                gap: 14,
                minHeight: 240,
                boxShadow: "0 12px 28px rgba(0,0,0,0.16)",
            }}
        >
            <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    <Pill tone="blue">{series.category?.title ?? "Lesson series"}</Pill>
                    {series.difficultyLabel && <Pill>{series.difficultyLabel}</Pill>}
                </div>
                <ProgressPill status={seriesStatus} compact />
            </div>
            <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
                <div style={{ fontSize: 22, lineHeight: 1.05, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8", marginBottom: 10 }}>
                    {series.title}
                </div>
                <div style={{ fontSize: 13, color: "#B8B1A8", lineHeight: 1.8, maxWidth: 320 }}>
                    {series.shortDescription}
                </div>
            </div>
            <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
                <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 8 }}>
                    <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg, #63B3ED, #E8622A)" }} />
                </div>
                <div style={{ fontSize: "var(--foundry-academy-sm-font)", color: "#7A736B" }}>
                    {series.items.length} items · {series.estimatedMinutes ? `${series.estimatedMinutes} min total` : "Structured track"}
                </div>
                {nextItem && (
                    <div style={{ marginTop: 8, fontSize: "var(--foundry-academy-md-font)", color: "#C8C4BE", lineHeight: 1.7 }}>
                        Next lesson: <span style={{ color: "#F0EDE8", fontWeight: 700 }}>{getSeriesItemTitle(nextItem)}</span>
                    </div>
                )}
            </div>
        </button>
    );
}

function AsideCard({
    eyebrow,
    title,
    description,
    children,
    tone = "neutral",
}: {
    eyebrow: string;
    title: string;
    description: string;
    children: ReactNode;
    tone?: "neutral" | "ember" | "glow" | "blue" | "stone" | "mindset";
}) {
    const cardStyles = {
        neutral: { background: surface, borderColor: "rgba(255,255,255,0.08)" },
        ember: { background: "linear-gradient(180deg, rgba(232,98,42,0.10), rgba(255,255,255,0.03))", borderColor: "rgba(232,98,42,0.18)" },
        glow: { background: "linear-gradient(180deg, rgba(232,98,42,0.08), rgba(99,179,237,0.05), rgba(255,255,255,0.03))", borderColor: "rgba(232,98,42,0.14)" },
        blue: { background: "linear-gradient(180deg, rgba(99,179,237,0.10), rgba(255,255,255,0.03))", borderColor: "rgba(99,179,237,0.16)" },
        stone: { background: "linear-gradient(180deg, rgba(200,169,110,0.08), rgba(255,255,255,0.03))", borderColor: "rgba(200,169,110,0.14)" },
        mindset: { background: "linear-gradient(180deg, rgba(199,107,75,0.12), rgba(255,255,255,0.03))", borderColor: "rgba(199,107,75,0.18)" },
    } as const;
    const style = cardStyles[tone];

    return (
        <div style={{ background: style.background, border: `1px solid ${style.borderColor}`, borderRadius: 22, padding: 18, display: "grid", gap: 12 }}>
            <div style={{ fontSize: "var(--foundry-academy-xs-font)", color: "#E8622A", letterSpacing: "0.14em", textTransform: "uppercase" }}>{eyebrow}</div>
            <div style={{ fontSize: 24, lineHeight: 1.06, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}>{title}</div>
            <div style={{ fontSize: 13, color: textMuted, lineHeight: 1.8 }}>{description}</div>
            {children}
        </div>
    );
}

function HistoryRow({
    entry,
    content,
    series,
}: {
    entry: AcademyUserHistory;
    content: AcademyContent | null;
    series: AcademySeries | null;
}) {
    return (
        <div style={{ display: "grid", gap: 4, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: "var(--foundry-academy-md-font)", color: "#F0EDE8", fontWeight: 600 }}>
                {content?.title ?? series?.title ?? String(entry.metadata?.itemTitle ?? "Academy")}
            </div>
            <div style={{ fontSize: "var(--foundry-academy-sm-font)", color: "#8D857C" }}>
                {getAcademyHistoryLabel(entry.action)} · {new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
        </div>
    );
}

function MetricRow({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: "var(--foundry-academy-md-font)", color: "#8D857C" }}>{label}</div>
            <div style={{ fontSize: "var(--foundry-academy-md-font)", color: "#F0EDE8", fontWeight: 700 }}>{value}</div>
        </div>
    );
}

type LessonSlide = {
    eyebrow: string;
    title: string;
    body: string;
    bullets?: string[];
    note?: string;
    tone?: "orange" | "blue" | "warm" | "neutral";
};

function joinLessonParts(parts: Array<string | null | undefined>) {
    return parts
        .map((part) => (part ?? "").trim())
        .filter(Boolean)
        .join("\n\n");
}

function renderSlideBullet(text: string) {
    const match = text.match(/^([^:]+:)(\s*)(.*)$/);
    if (!match) return text;
    return (
        <>
            <strong style={{ color: "#F0EDE8", fontWeight: 700 }}>{match[1]}</strong>
            {match[2]}
            <span>{match[3]}</span>
        </>
    );
}

function buildLessonSlides(content: AcademyContent) {
    const stageLabels = getAcademyStageLabels(content.stageIds);
    const slides: LessonSlide[] = [];

    slides.push({
        eyebrow: "Lesson overview",
        title: "What this lesson covers",
        body: joinLessonParts([
            content.shortDescription,
            content.description
                ? "This walkthrough gives you the context first, then the founder-level judgment behind the lesson."
                : "Use this lesson to build a cleaner working understanding before you pressure-test it with Forge.",
        ]),
        bullets: [
            `Discipline: ${content.category?.title ?? getAcademyContentTypeLabel(content.contentType)}`,
            content.difficultyLabel ? `Difficulty: ${content.difficultyLabel}` : null,
            content.estimatedMinutes ? `Length: ${content.estimatedMinutes} minute lesson` : "Length: Guided deep dive",
            stageLabels.length ? `Stages: ${stageLabels.join(" · ")}` : null,
        ].filter(Boolean) as string[],
        note: "Move through the cards first, then take the lesson into Forge for application.",
        tone: "orange",
    });

    if (content.learningGoal || content.whoThisIsFor) {
        slides.push({
            eyebrow: "What you should learn",
            title: "The outcome this lesson should create",
            body: joinLessonParts([
                content.learningGoal || "Use this lesson to sharpen how you think, decide, and execute on this topic.",
                content.whoThisIsFor
                    ? `This is especially useful for founders who are dealing with this issue in real time, not just studying it conceptually.`
                    : null,
            ]),
            bullets: [
                content.whoThisIsFor ? `Best for: ${content.whoThisIsFor}` : null,
                content.whenThisMatters ? `Most useful when: ${content.whenThisMatters}` : null,
            ].filter(Boolean) as string[],
            tone: "blue",
        });
    }

    if (content.whyThisMatters || content.whenThisMatters) {
        slides.push({
            eyebrow: "Strategic context",
            title: "Why this matters right now",
            body: joinLessonParts([
                content.whyThisMatters || "This topic matters because it compounds into clearer decisions and stronger execution over time.",
                content.whenThisMatters
                    ? `Founders usually feel the consequences of this lesson most sharply when timing, pressure, or uncertainty makes weak thinking expensive.`
                    : null,
            ]),
            bullets: [
                content.whenThisMatters ? `When this shows up: ${content.whenThisMatters}` : null,
                content.category?.title ? `Discipline: ${content.category.title}` : null,
            ].filter(Boolean) as string[],
            tone: "warm",
        });
    }

    if (content.whatToWatchFor || content.commonMistake) {
        slides.push({
            eyebrow: "Critical pattern",
            title: "What experienced founders notice here",
            body: joinLessonParts([
                content.whatToWatchFor || "Pay attention to the subtle patterns and assumptions that can distort your judgment on this topic.",
                content.commonMistake
                    ? "The point is not just to avoid a mistake once. It is to recognize the mental pattern early enough that it stops shaping your execution."
                    : null,
            ]),
            bullets: [
                content.commonMistake ? `Common mistake: ${content.commonMistake}` : null,
            ].filter(Boolean) as string[],
            tone: "orange",
        });
    }

    if (content.learningGoal || content.whyThisMatters || content.commonMistake) {
        slides.push({
            eyebrow: "Decision lens",
            title: "How to use this lesson in the real world",
            body: joinLessonParts([
                "Do not treat this as information to agree with. Treat it as a lens for better decisions.",
                content.learningGoal ? `A strong outcome here looks like this: ${content.learningGoal}` : null,
                content.commonMistake ? `A weak outcome usually sounds like this: ${content.commonMistake}` : null,
            ]),
            bullets: [
                content.whyThisMatters ? `Why it compounds: ${content.whyThisMatters}` : null,
                content.whenThisMatters ? `Where to apply it: ${content.whenThisMatters}` : null,
            ].filter(Boolean) as string[],
            note: "As you move through the next slides, keep asking where this is already showing up in your company.",
            tone: "neutral",
        });
    }

    const detailSections = splitLessonTextIntoSlides(content.description);
    detailSections.forEach((section, index) => {
        slides.push({
            eyebrow: `Deep dive ${index + 1}`,
            title: section.title,
            body: section.body,
            tone: index % 2 === 0 ? "neutral" : "blue",
        });
    });

    if (content.forgeContext || content.starterPrompt || content.tags.length > 0) {
        slides.push({
            eyebrow: "Bring it into Forge",
            title: "Translate the lesson into your company",
            body: joinLessonParts([
                content.forgeContext
                    || "You have the lesson framing. Next, use Forge to pressure-test it against your actual startup, decisions, and constraints.",
                "The strongest Forge conversations happen when you bring one real decision, one weak assumption, or one current situation into the discussion.",
            ]),
            bullets: [
                content.starterPrompt ? `Suggested prompt: ${content.starterPrompt}` : null,
                content.tags.length ? `Topics: ${content.tags.map((tag) => tag.name).join(" · ")}` : null,
            ].filter(Boolean) as string[],
            note: "Once you finish this final card, the Forge conversation unlocks below.",
            tone: "warm",
        });
    }

    return slides;
}

function splitLessonTextIntoSlides(text: string | null | undefined) {
    const source = (text ?? "").trim();
    if (!source) return [];

    const normalized = source.replace(/\r\n/g, "\n");
    const headingMatches = Array.from(normalized.matchAll(/^#{1,6}\s+(.+)$/gm));

    if (headingMatches.length > 0) {
        return headingMatches
            .map((match, index) => {
                const title = match[1].trim();
                const start = match.index! + match[0].length;
                const end = headingMatches[index + 1]?.index ?? normalized.length;
                const body = normalized.slice(start, end).trim();
                return body ? { title, body } : null;
            })
            .filter((section): section is { title: string; body: string } => Boolean(section))
            .slice(0, 4);
    }

    const paragraphs = normalized
        .split(/\n\s*\n/)
        .map((entry) => entry.trim())
        .filter(Boolean);
    if (!paragraphs.length) return [];

    const chunks: { title: string; body: string }[] = [];
    for (let index = 0; index < paragraphs.length; index += 1) {
        const body = paragraphs[index];
        chunks.push({
            title: `Lesson detail ${chunks.length + 1}`,
            body,
        });
    }
    return chunks.slice(0, 5);
}

function ContentDetailModal({
    content,
    progress,
    onClose,
    onToggleComplete,
    onLaunchForge,
    busy,
}: {
    content: AcademyContent;
    progress?: AcademyUserContentProgress;
    onClose: () => void;
    onToggleComplete: (completed: boolean) => void;
    onLaunchForge?: () => void;
    busy: boolean;
}) {
    const completed = progress?.status === "completed";
    const embedUrl = buildYoutubeEmbedUrl(content.youtubeVideoId);
    const thumbnailUrl = content.thumbnailUrl || buildYoutubeThumbnailUrl(content.youtubeVideoId);
    const slides = useMemo(() => buildLessonSlides(content), [content]);
    const [activeSlideIndex, setActiveSlideIndex] = useState(0);

    useEffect(() => {
        setActiveSlideIndex(0);
    }, [content.id]);

    const activeSlide = slides[activeSlideIndex] ?? slides[0];
    const isLastSlide = activeSlideIndex >= slides.length - 1;
    const canOpenForge = Boolean(onLaunchForge && isLastSlide);

    return (
        <ModalShell onClose={onClose}>
            <div style={{ display: "grid", gap: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
                    <div style={{ display: "grid", gap: 12 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Pill tone="orange">{content.category?.title ?? getAcademyContentTypeLabel(content.contentType)}</Pill>
                            {content.difficultyLabel && <Pill>{content.difficultyLabel}</Pill>}
                            <ProgressPill status={progress?.status} />
                        </div>
                        <div style={{ fontSize: 34, lineHeight: 0.98, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8" }}>
                            {content.title}
                        </div>
                        <div style={{ fontSize: 14, color: "#C8C4BE", lineHeight: 1.9 }}>
                            Work through the lesson cards first. Forge unlocks after you finish the walkthrough.
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: "rgba(255,255,255,0.04)", border, borderRadius: 10, padding: "8px 12px", color: "#888", cursor: "pointer" }}>
                        Close
                    </button>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontSize: "var(--foundry-academy-md-font)", color: "#A8A4A0", fontWeight: 700 }}>
                            Slide {activeSlideIndex + 1} of {slides.length}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {slides.map((slide, index) => (
                                <button
                                    key={`${slide.eyebrow}-${index}`}
                                    type="button"
                                    onClick={() => setActiveSlideIndex(index)}
                                    style={{
                                        width: 34,
                                        height: 8,
                                        borderRadius: 999,
                                        border: "none",
                                        background: index === activeSlideIndex ? "#E8622A" : "rgba(255,255,255,0.10)",
                                        cursor: "pointer",
                                    }}
                                    aria-label={`Go to slide ${index + 1}`}
                                />
                            ))}
                        </div>
                    </div>

                    <div style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))", border, borderRadius: 24, overflow: "hidden" }}>
                        {activeSlideIndex === 0 && (
                            <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                {embedUrl ? (
                                    <div style={{ position: "relative", paddingTop: "46%", background: "#050506" }}>
                                        <iframe
                                            src={embedUrl}
                                            title={content.title}
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                                        />
                                    </div>
                                ) : (
                                    <div
                                        style={{
                                            background: thumbnailUrl
                                                ? `linear-gradient(180deg, rgba(8,8,9,0.18), rgba(8,8,9,0.62)), url(${thumbnailUrl}) center/cover`
                                                : "linear-gradient(135deg, rgba(232,98,42,0.26), rgba(99,179,237,0.18), rgba(12,12,14,0.9))",
                                            display: "grid",
                                            alignContent: "start",
                                            padding: "16px 18px",
                                        }}
                                    >
                                        <div style={{ fontSize: "var(--foundry-academy-sm-font)", color: "#C8A96E", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>
                                            Guided lesson
                                        </div>
                                        <div style={{ fontSize: 13, color: "#D4D0CB", lineHeight: 1.8, maxWidth: 640 }}>
                                            {content.contentType === "video"
                                                ? "Use the walkthrough below to frame the lesson before jumping into a Forge conversation."
                                                : "This lesson is now structured as a guided walkthrough before you take it into Forge."}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ padding: 22, display: "grid", gap: 18 }}>
                            <div style={{ display: "grid", gap: 12 }}>
                                <div style={{ fontSize: "var(--foundry-academy-sm-font)", color: "#E8622A", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                                    {activeSlide.eyebrow}
                                </div>
                                <div style={{ fontSize: 30, lineHeight: 1.02, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8" }}>
                                    {activeSlide.title}
                                </div>
                                <div style={{ fontSize: 15, color: "#C8C4BE", lineHeight: 1.95, whiteSpace: "pre-wrap" }}>
                                    {activeSlide.body}
                                </div>
                            </div>

                            {activeSlide.bullets && activeSlide.bullets.length > 0 && (
                                <div style={{ display: "grid", gap: 10 }}>
                                    {activeSlide.bullets.map((bullet) => (
                                        <div key={bullet} style={{ background: "rgba(255,255,255,0.04)", border, borderRadius: 16, padding: "12px 14px", fontSize: 13, color: "#D7D1CA", lineHeight: 1.8 }}>
                                            {renderSlideBullet(bullet)}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeSlide.note && (
                                <div style={{ background: "rgba(232,98,42,0.08)", border: "1px solid rgba(232,98,42,0.18)", borderRadius: 16, padding: "12px 14px", fontSize: 13, color: "#E7D5CA", lineHeight: 1.8 }}>
                                    {activeSlide.note}
                                </div>
                            )}

                            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                                <InlineButton tone="muted" onClick={() => setActiveSlideIndex((current) => Math.max(0, current - 1))} disabled={activeSlideIndex === 0}>
                                    Back
                                </InlineButton>
                                {!isLastSlide && (
                                    <InlineButton onClick={() => setActiveSlideIndex((current) => Math.min(slides.length - 1, current + 1))}>
                                        Next card
                                    </InlineButton>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {canOpenForge && onLaunchForge && (
                        <InlineButton onClick={onLaunchForge} disabled={busy}>
                            {busy ? "Opening..." : "Chat with Forge about this"}
                        </InlineButton>
                    )}
                    <InlineButton tone={completed ? "muted" : "success"} onClick={() => onToggleComplete(!completed)} disabled={busy}>
                        {completed ? "Mark as in progress" : "Mark completed"}
                    </InlineButton>
                    {content.resourceUrl && (
                        <a
                            href={content.resourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", padding: "10px 14px", borderRadius: 999, border, background: "rgba(255,255,255,0.04)", color: "#F0EDE8", textDecoration: "none", fontSize: "var(--foundry-academy-md-font)" }}
                        >
                            Open resource
                        </a>
                    )}
                </div>

                {!isLastSlide && onLaunchForge && (
                    <div style={{ fontSize: "var(--foundry-academy-md-font)", color: "#8D857C", lineHeight: 1.7 }}>
                        Finish the full walkthrough to unlock the Forge conversation for this lesson.
                    </div>
                )}
            </div>
        </ModalShell>
    );
}

function SeriesDetailModal({
    series,
    progressMap,
    onClose,
    onOpenItem,
    onToggleSeriesItem,
    busyKey,
}: {
    series: AcademySeries;
    progressMap: Map<string, AcademyUserSeriesItemProgress>;
    onClose: () => void;
    onOpenItem: (content: AcademyContent) => void;
    onToggleSeriesItem: (item: AcademySeriesItem, completed: boolean) => void;
    busyKey: string | null;
}) {
    const completedItems = series.items.filter((item) => progressMap.get(item.id)?.status === "completed").length;
    const nextItem = getNextSeriesItem(series, progressMap);
    return (
        <ModalShell onClose={onClose}>
            <div style={{ display: "grid", gap: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
                    <div style={{ display: "grid", gap: 10 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Pill tone="blue">{series.category?.title ?? "Lesson series"}</Pill>
                            {series.difficultyLabel && <Pill>{series.difficultyLabel}</Pill>}
                            <ProgressPill status={completedItems === 0 ? "not_started" : completedItems >= series.items.length ? "completed" : "in_progress"} />
                        </div>
                        <div style={{ fontSize: 34, lineHeight: 0.98, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8" }}>
                            {series.title}
                        </div>
                        <div style={{ fontSize: 14, color: "#C8C4BE", lineHeight: 1.9 }}>
                            {series.shortDescription}
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: "rgba(255,255,255,0.04)", border, borderRadius: 10, padding: "8px 12px", color: "#888", cursor: "pointer" }}>
                        Close
                    </button>
                </div>

                {series.description && (
                    <div style={{ background: surface, border, borderRadius: 18, padding: 16, fontSize: 14, color: "#C8C4BE", lineHeight: 1.9 }}>
                        {series.description}
                    </div>
                )}

                {nextItem && (
                    <div style={{ background: "rgba(99,179,237,0.10)", border: "1px solid rgba(99,179,237,0.18)", borderRadius: 18, padding: 16, display: "grid", gap: 6 }}>
                        <div style={{ fontSize: "var(--foundry-academy-sm-font)", color: "#63B3ED", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                            Recommended next step
                        </div>
                        <div style={{ fontSize: 18, color: "#F0EDE8", fontWeight: 700 }}>
                            {getSeriesItemTitle(nextItem)}
                        </div>
                        <div style={{ fontSize: 13, color: "#C8C4BE", lineHeight: 1.7 }}>
                            Lesson {nextItem.position} of {series.items.length}. Continue the series in order so each lesson compounds on the previous one.
                        </div>
                    </div>
                )}

                <div style={{ display: "grid", gap: 12 }}>
                    {series.items.map((item, index) => {
                        const itemProgress = progressMap.get(item.id);
                        const status = itemProgress?.status;
                        const completed = status === "completed";
                        const isNext = nextItem?.id === item.id;
                        return (
                            <div key={item.id} style={{ background: isNext ? "rgba(99,179,237,0.08)" : "rgba(255,255,255,0.03)", border: isNext ? "1px solid rgba(99,179,237,0.18)" : border, borderRadius: 18, padding: 16, display: "grid", gap: 12 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                                    <div>
                                        <div style={{ fontSize: "var(--foundry-academy-sm-font)", color: "#E8622A", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>
                                            Lesson {index + 1}
                                        </div>
                                        <div style={{ fontSize: 18, color: "#F0EDE8", fontWeight: 700, marginBottom: 6 }}>
                                            {getSeriesItemTitle(item)}
                                        </div>
                                        <div style={{ fontSize: 13, color: "#A8A4A0", lineHeight: 1.7 }}>
                                            {item.descriptionOverride || item.content?.shortDescription || "No summary added yet."}
                                        </div>
                                    </div>
                                    <ProgressPill status={status} />
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                                    {item.content && (
                                        <InlineButton onClick={() => onOpenItem(item.content)}>
                                            {isNext ? "Continue lesson" : "Open lesson"}
                                        </InlineButton>
                                    )}
                                    <InlineButton
                                        tone={completed ? "muted" : "success"}
                                        onClick={() => onToggleSeriesItem(item, !completed)}
                                        disabled={busyKey === `series-item-${item.id}`}
                                    >
                                        {busyKey === `series-item-${item.id}`
                                            ? "Saving..."
                                            : completed ? "Mark as in progress" : "Mark lesson complete"}
                                    </InlineButton>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </ModalShell>
    );
}

function ModalShell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
    return (
        <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 140, background: "rgba(3,3,4,0.82)", backdropFilter: "blur(10px)", padding: 18, overflowY: "auto" }}>
            <div onClick={(event) => event.stopPropagation()} style={{ width: "min(920px, 100%)", margin: "40px auto", background: "#0C0C0E", border, borderRadius: 24, padding: 20 }}>
                {children}
            </div>
        </div>
    );
}

function DetailPanel({ title, body }: { title: string; body: string }) {
    return (
        <div style={{ background: surface, border, borderRadius: 18, padding: 16 }}>
            <div style={{ fontSize: "var(--foundry-academy-xs-font)", color: "#E8622A", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>{title}</div>
            <div style={{ fontSize: 13, color: "#C8C4BE", lineHeight: 1.8 }}>{body}</div>
        </div>
    );
}

function HeroPill({ label }: { label: string }) {
    return (
        <div style={{ padding: "8px 12px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border, fontSize: "var(--foundry-academy-sm-font)", color: "#DDD6CF", letterSpacing: "0.02em", width: "fit-content", flex: "0 0 auto", alignSelf: "center" }}>
            {label}
        </div>
    );
}

function SummaryTile({ label, value, hint }: { label: string; value: string; hint: string }) {
    return (
        <div style={{ background: "rgba(255,255,255,0.045)", border, borderRadius: 18, padding: 16 }}>
            <div style={{ fontSize: "var(--foundry-academy-xs-font)", color: "#9B9389", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 28, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8", marginBottom: 8 }}>{value}</div>
            <div style={{ fontSize: "var(--foundry-academy-md-font)", color: textMuted, lineHeight: 1.7 }}>{hint}</div>
        </div>
    );
}

function AliveEmptyState({ title, body }: { title: string; body: string }) {
    return (
        <div style={{ background: "linear-gradient(140deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))", border, borderRadius: 20, padding: 18, display: "grid", gap: 8 }}>
            <div style={{ fontSize: "var(--foundry-academy-sm-font)", color: "#E8622A", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                Forge Academy
            </div>
            <div style={{ fontSize: 20, lineHeight: 1.08, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8" }}>
                {title}
            </div>
            <div style={{ fontSize: 13, color: "#C8C4BE", lineHeight: 1.8 }}>
                {body}
            </div>
        </div>
    );
}

function ProgressPill({
    status,
}: {
    status: AcademyUserContentProgress["status"] | null | undefined;
}) {
    const normalized = status ?? "not_started";
    const tone = normalized === "completed" ? "success" : normalized === "in_progress" ? "blue" : "neutral";
    return <Pill tone={tone}>{getAcademyProgressLabel(normalized)}</Pill>;
}

function Pill({
    children,
    tone = "neutral",
}: {
    children: ReactNode;
    tone?: "neutral" | "orange" | "blue" | "success" | "warm";
}) {
    const tones: Record<string, { background: string; borderColor: string; color: string }> = {
        neutral: { background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)", color: "#C8C4BE" },
        orange: { background: "rgba(232,98,42,0.14)", borderColor: "rgba(232,98,42,0.24)", color: "#E8622A" },
        blue: { background: "rgba(99,179,237,0.14)", borderColor: "rgba(99,179,237,0.24)", color: "#63B3ED" },
        success: { background: "rgba(76,175,138,0.14)", borderColor: "rgba(76,175,138,0.24)", color: "#4CAF8A" },
        warm: { background: "rgba(199,107,75,0.16)", borderColor: "rgba(199,107,75,0.26)", color: "#E0B09E" },
    };
    const theme = tones[tone];
    return (
        <div
            style={{
                padding: "7px 10px",
                borderRadius: 999,
                background: theme.background,
                border: `1px solid ${theme.borderColor}`,
                color: theme.color,
                fontSize: 13,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1.1,
                whiteSpace: "nowrap",
                width: "fit-content",
                flex: "0 0 auto",
                alignSelf: "center",
            }}
        >
            {children}
        </div>
    );
}

function FilterPill({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: active ? "1px solid rgba(232,98,42,0.28)" : "1px solid rgba(255,255,255,0.08)",
                background: active ? "rgba(232,98,42,0.14)" : "rgba(255,255,255,0.03)",
                color: active ? "#E8622A" : "#A8A4A0",
                fontSize: "var(--foundry-academy-sm-font)",
                fontWeight: 700,
                cursor: "pointer",
                width: "fit-content",
                flex: "0 0 auto",
                alignSelf: "center",
            }}
        >
            {children}
        </button>
    );
}

function InlineButton({
    children,
    onClick,
    disabled,
    tone = "primary",
}: {
    children: ReactNode;
    onClick: () => void;
    disabled?: boolean;
    tone?: "primary" | "success" | "muted";
}) {
    const styles = {
        primary: {
            background: "linear-gradient(135deg, #E8622A, #C9521E)",
            border: "none",
            color: "#fff",
        },
        success: {
            background: "rgba(76,175,138,0.14)",
            border: "1px solid rgba(76,175,138,0.24)",
            color: "#4CAF8A",
        },
        muted: {
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#C8C4BE",
        },
    } as const;
    const style = styles[tone];
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                ...style,
                borderRadius: 999,
                padding: "10px 14px",
                fontSize: "var(--foundry-academy-md-font)",
                fontWeight: 700,
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.7 : 1,
            }}
        >
            {children}
        </button>
    );
}

function CenteredState({
    title,
    body,
    action,
}: {
    title: string;
    body: string;
    action?: ReactNode;
}) {
    return (
        <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}>
            <div style={{ maxWidth: 520, display: "grid", gap: 12 }}>
                <div style={{ fontSize: 34, lineHeight: 0.98, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8" }}>
                    {title}
                </div>
                <div style={{ fontSize: 14, color: textMuted, lineHeight: 1.8 }}>
                    {body}
                </div>
                {action}
            </div>
        </div>
    );
}

function mergeContentProgress(
    entries: AcademyUserContentProgress[],
    next: AcademyUserContentProgress,
) {
    const index = entries.findIndex((entry) => entry.contentId === next.contentId);
    if (index === -1) return [next, ...entries];
    const copy = [...entries];
    copy[index] = next;
    return copy;
}

function mergeSeriesItemProgress(
    entries: AcademyUserSeriesItemProgress[],
    next: AcademyUserSeriesItemProgress,
) {
    const index = entries.findIndex((entry) => entry.seriesItemId === next.seriesItemId);
    if (index === -1) return [next, ...entries];
    const copy = [...entries];
    copy[index] = next;
    return copy;
}

function getSeriesItemTitle(item: AcademySeriesItem) {
    return item.titleOverride || item.content?.title || "Series lesson";
}

function getNextSeriesItem(
    series: AcademySeries,
    progressMap: Map<string, AcademyUserSeriesItemProgress>,
) {
    return series.items.find((item) => progressMap.get(item.id)?.status !== "completed") ?? series.items[0] ?? null;
}

function canLaunchForgeFromContent(content: AcademyContent) {
    return Boolean(
        content.starterPrompt
        || content.forgeContext
        || content.learningGoal
        || content.whyThisMatters
        || content.commonMistake
    );
}
