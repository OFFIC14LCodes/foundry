import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Archive } from "lucide-react";
import { STAGES_DATA } from "../constants/stages";
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
};

const surface = "rgba(255,255,255,0.03)";
const border = "1px solid rgba(255,255,255,0.08)";
const textMuted = "#9D978E";
const stageFilterOptions = [{ id: 0, label: "All stages" }, ...STAGES_DATA.map((stage) => ({ id: stage.id, label: `Stage ${stage.id}` }))];

export default function ForgeAcademyScreen({
    userId,
    profile,
    onBack,
    onLaunchForgeConversation,
    onOpenAskForgeAnything,
    onContextChange,
    onOpenArchive,
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

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 900);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

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

    const contentProgressById = useMemo(
        () => new Map(workspace.contentProgress.map((entry) => [entry.contentId, entry])),
        [workspace.contentProgress]
    );
    const seriesItemProgressById = useMemo(
        () => new Map(workspace.seriesItemProgress.map((entry) => [entry.seriesItemId, entry])),
        [workspace.seriesItemProgress]
    );

    const filteredContent = useMemo(() => {
        return workspace.content.filter((entry) => {
            const categoryMatch = selectedCategoryId === "all" || entry.categoryId === selectedCategoryId;
            const stageMatch = selectedStageId === 0 || entry.stageIds.includes(selectedStageId);
            return categoryMatch && stageMatch;
        });
    }, [selectedCategoryId, selectedStageId, workspace.content]);

    const filteredSeries = useMemo(() => {
        return workspace.series.filter((entry) => {
            const categoryMatch = selectedCategoryId === "all" || entry.categoryId === selectedCategoryId;
            const stageMatch = selectedStageId === 0 || entry.stageIds.includes(selectedStageId);
            return categoryMatch && stageMatch;
        });
    }, [selectedCategoryId, selectedStageId, workspace.series]);

    const featuredTopics = filteredContent.filter((entry) => {
        if (entry.contentType !== "topic" || !entry.featured) return false;
        const status = contentProgressById.get(entry.id)?.status;
        return status !== "in_progress" && status !== "completed";
    }).slice(0, 6);
    const lessonSeries = filteredSeries.slice(0, 6);
    const videos = filteredContent.filter((entry) => entry.contentType === "video").slice(0, 6);
    const resources = filteredContent.filter((entry) => entry.contentType === "resource").slice(0, 6);
    const mindset = filteredContent.filter((entry) => entry.contentType === "mindset").slice(0, 6);
    const continueLearning = filteredContent
        .filter((entry) => contentProgressById.get(entry.id)?.status === "in_progress")
        .sort((a, b) => {
            const aOpened = contentProgressById.get(a.id)?.lastOpenedAt ?? "";
            const bOpened = contentProgressById.get(b.id)?.lastOpenedAt ?? "";
            return bOpened.localeCompare(aOpened);
        })
        .slice(0, 4);
    const recentlyViewed = Array.from(new Map(
        workspace.history
            .filter((entry) => entry.contentId && (entry.action === "viewed" || entry.action === "started_video" || entry.action === "opened_forge"))
            .map((entry) => {
                const content = workspace.content.find((item) => item.id === entry.contentId);
                return content ? [content.id, content] : null;
            })
            .filter(Boolean) as Array<[string, AcademyContent]>
    ).values())
        .filter((entry) => !continueLearning.some((item) => item.id === entry.id))
        .slice(0, 4);

    const completedContentCount = workspace.contentProgress.filter((entry) => entry.status === "completed").length;
    const totalLessonsCount = workspace.content.length;
    const completedSeriesItems = workspace.seriesItemProgress.filter((entry) => entry.status === "completed").length;
    const recentHistory = workspace.history.slice(0, 4);
    const nextSeriesUp = lessonSeries
        .map((series) => ({ series, nextItem: getNextSeriesItem(series, seriesItemProgressById) }))
        .filter((entry) => entry.nextItem)
        .slice(0, 3);

    const openContent = async (content: AcademyContent, action: "viewed" | "started_video" = "viewed") => {
        setSelectedSeries(null);
        setSelectedContent(content);
        try {
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
            <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 18 }}>
                <div style={{
                    background: "linear-gradient(180deg, rgba(232,98,42,0.07), rgba(255,255,255,0.025))",
                    border,
                    borderRadius: 28,
                    padding: "28px 26px 24px",
                }}>
                    <div style={{ display: "grid", gap: 18, maxWidth: 780, margin: "0 auto", textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "#E8622A", letterSpacing: "0.16em", textTransform: "uppercase" }}>
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
                            <HeroPill label={`${workspace.series.length} series`} />
                            <HeroPill label={`${completedContentCount} completed`} />
                        </div>
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
                            {stageFilterOptions.map((stage) => (
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
                                        progress={contentProgressById.get(entry.id)}
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
                            <div style={{ fontSize: 10, color: "#E8622A", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap" }}>Featured Topics</div>
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
                                        progress={contentProgressById.get(entry.id)}
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
                                    progress={contentProgressById.get(entry.id)}
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
                                    progress={contentProgressById.get(entry.id)}
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
                                    progress={contentProgressById.get(entry.id)}
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
                                    progress={contentProgressById.get(entry.id)}
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
                                            <div style={{ fontSize: 11, color: "#63B3ED", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{series.title}</div>
                                            <div style={{ fontSize: 14, color: "#F0EDE8", fontWeight: 700 }}>Continue with {getSeriesItemTitle(nextItem!)}</div>
                                            <div style={{ fontSize: 12, color: "#9D978E", lineHeight: 1.7 }}>Lesson {nextItem?.position} of {series.items.length}</div>
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
                                        <HistoryRow key={entry.id} entry={entry} content={workspace.content.find((c) => c.id === entry.contentId) ?? null} series={workspace.series.find((s) => s.id === entry.seriesId) ?? null} />
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

            {selectedContent && (
                <ContentDetailModal
                    content={selectedContent}
                    progress={contentProgressById.get(selectedContent.id)}
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

function AcademyShell({ children, onBack, onOpenArchive }: { children: ReactNode; onBack: () => void; onOpenArchive?: () => void }) {
    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "#080809", color: "#F0EDE8", display: "flex", flexDirection: "column", fontFamily: "'Lora', Georgia, serif" }}>
            <div style={{ padding: "max(14px, calc(10px + env(safe-area-inset-top))) 18px 12px", borderBottom: border, background: "rgba(8,8,9,0.95)", backdropFilter: "blur(16px)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <button onClick={onBack} style={{ background: "rgba(255,255,255,0.05)", border, borderRadius: 9, padding: "8px 12px", color: "#C8C4BE", fontSize: 12, cursor: "pointer" }}>
                    ← Hub
                </button>
                <div style={{ width: 34, height: 34, borderRadius: 12, background: "rgba(232,98,42,0.12)", border: "1px solid rgba(232,98,42,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Logo variant="forge" style={{ width: 18, height: 18, objectFit: "contain" }} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>Forge Academy</div>
                    <div style={{ fontSize: 11, color: "#6E675F" }}>Curated founder education</div>
                </div>
                {onOpenArchive && (
                    <button
                        onClick={onOpenArchive}
                        style={{ background: "rgba(232,98,42,0.08)", border: "1px solid rgba(232,98,42,0.2)", borderRadius: 9, padding: "7px 12px", color: "#E8622A", fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
                    >
                        <Archive size={14} />
                        Archive
                    </button>
                )}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "22px 18px 36px" }}>
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
            {eyebrow && <div style={{ fontSize: 10, color: "#E8622A", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>{eyebrow}</div>}
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
                display: "grid",
                gap: 14,
                minHeight: 262,
                boxShadow: emphasis === "mindset"
                    ? "0 14px 32px rgba(0,0,0,0.20)"
                    : "0 12px 28px rgba(0,0,0,0.16)",
            }}
        >
            <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    <Pill tone={emphasis === "mindset" ? "warm" : "orange"}>{content.category?.title ?? getAcademyContentTypeLabel(content.contentType)}</Pill>
                    {content.difficultyLabel && <Pill>{content.difficultyLabel}</Pill>}
                </div>
                <ProgressPill status={progress?.status} compact={!isContinueLearning} />
            </div>

            <div
                style={{
                    borderRadius: 18,
                    minHeight: 110,
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
                    padding: "12px 14px",
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
                    <div style={{ fontSize: 12, color: "#E9C7B8", lineHeight: 1.7, textAlign: "left" }}>
                        <span style={{ color: "#E8622A", fontWeight: 700 }}>Why this matters:</span> {content.whyThisMatters}
                    </div>
                )}
                {content.commonMistake && (
                    <div style={{ fontSize: 12, color: "#BFB7AE", lineHeight: 1.7, textAlign: "left" }}>
                        <span style={{ color: "#C8A96E", fontWeight: 700 }}>Common mistake:</span> {content.commonMistake}
                    </div>
                )}
                {stageLabels.length > 0 && (
                    <div style={{ fontSize: 11, color: "#8D857C", lineHeight: 1.6, textAlign: "center" }}>
                        {stageLabels.join(" · ")}
                    </div>
                )}
            </div>

            <div style={{ display: "grid", justifyItems: "center", gap: 12, marginTop: "auto" }}>
                <div style={{ fontSize: 11, color: "#6E675F" }}>
                    {content.estimatedMinutes ? `${content.estimatedMinutes} min` : "Deep dive"}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    <button type="button" onClick={onOpen} style={{ background: "rgba(255,255,255,0.04)", border, borderRadius: 999, padding: "8px 12px", color: "#C8C4BE", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        Step inside
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
                                fontSize: 11,
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
                <div style={{ fontSize: 11, color: "#7A736B" }}>
                    {series.items.length} items · {series.estimatedMinutes ? `${series.estimatedMinutes} min total` : "Structured track"}
                </div>
                {nextItem && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#C8C4BE", lineHeight: 1.7 }}>
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
            <div style={{ fontSize: 10, color: "#E8622A", letterSpacing: "0.14em", textTransform: "uppercase" }}>{eyebrow}</div>
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
            <div style={{ fontSize: 12, color: "#F0EDE8", fontWeight: 600 }}>
                {content?.title ?? series?.title ?? String(entry.metadata?.itemTitle ?? "Academy")}
            </div>
            <div style={{ fontSize: 11, color: "#8D857C" }}>
                {getAcademyHistoryLabel(entry.action)} · {new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
        </div>
    );
}

function MetricRow({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: 12, color: "#8D857C" }}>{label}</div>
            <div style={{ fontSize: 12, color: "#F0EDE8", fontWeight: 700 }}>{value}</div>
        </div>
    );
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
    const stageLabels = getAcademyStageLabels(content.stageIds);
    const completed = progress?.status === "completed";
    const embedUrl = buildYoutubeEmbedUrl(content.youtubeVideoId);
    const thumbnailUrl = content.thumbnailUrl || buildYoutubeThumbnailUrl(content.youtubeVideoId);

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
                            {content.shortDescription}
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: "rgba(255,255,255,0.04)", border, borderRadius: 10, padding: "8px 12px", color: "#888", cursor: "pointer" }}>
                        Close
                    </button>
                </div>

                <div style={{ borderRadius: 20, overflow: "hidden", border }}>
                    {embedUrl ? (
                        <div style={{ position: "relative", paddingTop: "56.25%", background: "#050506" }}>
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
                                minHeight: 250,
                                background: thumbnailUrl
                                    ? `linear-gradient(180deg, rgba(8,8,9,0.16), rgba(8,8,9,0.62)), url(${thumbnailUrl}) center/cover`
                                    : "linear-gradient(135deg, rgba(232,98,42,0.26), rgba(99,179,237,0.18), rgba(12,12,14,0.9))",
                                display: "grid",
                                alignContent: "end",
                                padding: 20,
                            }}
                        >
                            <div style={{ fontSize: 11, color: "#C8A96E", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>
                                Guided lesson detail
                            </div>
                            <div style={{ fontSize: 24, color: "#F0EDE8", fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, marginBottom: 8 }}>
                                {content.title}
                            </div>
                            <div style={{ fontSize: 13, color: "#D4D0CB", lineHeight: 1.8, maxWidth: 640 }}>
                                {content.contentType === "video"
                                    ? "This entry has not been attached to an embeddable YouTube player yet, but the Academy lesson framing is still available below."
                                    : "This Academy entry is designed to be explored through its lesson framing and guided Forge follow-up, not only through embedded media."}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                    <DetailPanel title="Why this matters" body={content.whyThisMatters || "No note added yet."} />
                    <DetailPanel title="What to watch for" body={content.whatToWatchFor || "No watch-for guidance added yet."} />
                    <DetailPanel title="Learning goal" body={content.learningGoal || "No explicit learning goal added yet."} />
                    <DetailPanel title="Who this is for" body={content.whoThisIsFor || "No audience framing added yet."} />
                    <DetailPanel title="When this matters" body={content.whenThisMatters || "No timing guidance added yet."} />
                    <DetailPanel title="Common mistake" body={content.commonMistake || "No common mistake note added yet."} />
                </div>

                {content.description && (
                    <div style={{ background: surface, border, borderRadius: 18, padding: 16 }}>
                        <div style={{ fontSize: 11, color: "#C8A96E", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>
                            Lesson Detail
                        </div>
                        <div style={{ fontSize: 14, color: "#C8C4BE", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>
                            {content.description}
                        </div>
                    </div>
                )}

                <div style={{ display: "grid", gap: 10 }}>
                    {stageLabels.length > 0 && (
                        <div style={{ fontSize: 12, color: "#8D857C", lineHeight: 1.7 }}>
                            {stageLabels.join(" · ")}
                        </div>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {content.tags.map((tag) => (
                            <Pill key={tag.id}>{tag.name}</Pill>
                        ))}
                    </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {onLaunchForge && (
                        <InlineButton onClick={onLaunchForge} disabled={busy}>
                            {busy ? "Opening..." : "Start Forge conversation"}
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
                            style={{ display: "inline-flex", alignItems: "center", padding: "10px 14px", borderRadius: 999, border, background: "rgba(255,255,255,0.04)", color: "#F0EDE8", textDecoration: "none", fontSize: 12 }}
                        >
                            Open resource
                        </a>
                    )}
                </div>
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
                        <div style={{ fontSize: 11, color: "#63B3ED", letterSpacing: "0.14em", textTransform: "uppercase" }}>
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
                                        <div style={{ fontSize: 11, color: "#E8622A", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>
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
            <div style={{ fontSize: 10, color: "#E8622A", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>{title}</div>
            <div style={{ fontSize: 13, color: "#C8C4BE", lineHeight: 1.8 }}>{body}</div>
        </div>
    );
}

function HeroPill({ label }: { label: string }) {
    return (
        <div style={{ padding: "8px 12px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border, fontSize: 11, color: "#DDD6CF", letterSpacing: "0.02em" }}>
            {label}
        </div>
    );
}

function SummaryTile({ label, value, hint }: { label: string; value: string; hint: string }) {
    return (
        <div style={{ background: "rgba(255,255,255,0.045)", border, borderRadius: 18, padding: 16 }}>
            <div style={{ fontSize: 10, color: "#9B9389", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 28, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8", marginBottom: 8 }}>{value}</div>
            <div style={{ fontSize: 12, color: textMuted, lineHeight: 1.7 }}>{hint}</div>
        </div>
    );
}

function AliveEmptyState({ title, body }: { title: string; body: string }) {
    return (
        <div style={{ background: "linear-gradient(140deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))", border, borderRadius: 20, padding: 18, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 11, color: "#E8622A", letterSpacing: "0.14em", textTransform: "uppercase" }}>
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
    compact = false,
}: {
    status: AcademyUserContentProgress["status"] | null | undefined;
    compact?: boolean;
}) {
    const normalized = status ?? "not_started";
    const tone = normalized === "completed" ? "success" : normalized === "in_progress" ? "blue" : "neutral";
    return <Pill tone={tone} compact={compact}>{getAcademyProgressLabel(normalized)}</Pill>;
}

function Pill({
    children,
    tone = "neutral",
    compact = false,
}: {
    children: ReactNode;
    tone?: "neutral" | "orange" | "blue" | "success" | "warm";
    compact?: boolean;
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
                padding: compact ? "4px 8px" : "7px 10px",
                borderRadius: 999,
                background: theme.background,
                border: `1px solid ${theme.borderColor}`,
                color: theme.color,
                fontSize: compact ? 9 : 13,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1.1,
                whiteSpace: "nowrap",
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
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
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
                fontSize: 12,
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
