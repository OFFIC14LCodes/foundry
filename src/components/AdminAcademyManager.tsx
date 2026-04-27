import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { STAGES_DATA } from "../constants/stages";
import {
    extractYoutubeVideoId,
    slugifyAcademyValue,
    type AcademyAdminWorkspace,
    type AcademyCategory,
    type AcademyContent,
    type AcademySeries,
} from "../lib/academy";
import {
    deleteAcademyCategory,
    deleteAcademyContent,
    deleteAcademySeries,
    deleteAcademyTag,
    loadAcademyAdminWorkspace,
    saveAcademyCategory,
    saveAcademyContent,
    saveAcademySeries,
    saveAcademyTag,
} from "../lib/academyDb";

type Props = {
    userId: string;
    onBack: () => void;
};

type ContentFormState = {
    id?: string | null;
    title: string;
    slug: string;
    shortDescription: string;
    description: string;
    contentType: "topic" | "video" | "resource" | "mindset";
    categoryId: string;
    sourceType: "foundry_original" | "external_youtube" | "external_resource";
    difficultyLabel: string;
    estimatedMinutes: string;
    whyThisMatters: string;
    whatToWatchFor: string;
    learningGoal: string;
    whoThisIsFor: string;
    whenThisMatters: string;
    commonMistake: string;
    starterPrompt: string;
    forgeContext: string;
    knowledgeCheckPrompt: string;
    knowledgeCheckExpectedPoints: string;
    completionBadgeLabel: string;
    videoUrl: string;
    resourceUrl: string;
    thumbnailUrl: string;
    transcript: string;
    featured: boolean;
    priority: string;
    status: "draft" | "published" | "hidden";
    tagText: string;
    stageIds: number[];
};

type SeriesFormState = {
    id?: string | null;
    title: string;
    slug: string;
    shortDescription: string;
    description: string;
    categoryId: string;
    difficultyLabel: string;
    estimatedMinutes: string;
    learningGoal: string;
    coverImageUrl: string;
    featured: boolean;
    priority: string;
    status: "draft" | "published" | "hidden";
    stageIds: number[];
    items: Array<{
        id?: string | null;
        contentId: string;
        position: number;
        titleOverride: string;
        descriptionOverride: string;
        required: boolean;
    }>;
};

type CategoryFormState = {
    id?: string | null;
    title: string;
    slug: string;
    description: string;
    accentColor: string;
    sortOrder: string;
    isMindset: boolean;
    isActive: boolean;
};

const surface = "rgba(255,255,255,0.03)";
const border = "1px solid rgba(255,255,255,0.08)";

export default function AdminAcademyManager({ userId, onBack }: Props) {
    const [workspace, setWorkspace] = useState<AcademyAdminWorkspace>({
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
    const [saving, setSaving] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"content" | "series" | "categories" | "tags">("content");
    const [contentForm, setContentForm] = useState<ContentFormState>(createEmptyContentForm());
    const [seriesForm, setSeriesForm] = useState<SeriesFormState>(createEmptySeriesForm());
    const [categoryForm, setCategoryForm] = useState<CategoryFormState>(createEmptyCategoryForm());
    const [newTagName, setNewTagName] = useState("");
    const [contentTypeFilter, setContentTypeFilter] = useState<"all" | ContentFormState["contentType"]>("all");
    const [statusFilter, setStatusFilter] = useState<"all" | ContentFormState["status"]>("all");
    const [featuredFilter, setFeaturedFilter] = useState<"all" | "featured" | "standard">("all");

    const refreshWorkspace = async () => {
        setLoading(true);
        setError(null);
        try {
            const next = await loadAcademyAdminWorkspace(userId);
            setWorkspace(next);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Unable to load Academy admin.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void refreshWorkspace();
    }, [userId]);

    const sortedCategories = useMemo(
        () => [...workspace.categories].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)),
        [workspace.categories]
    );
    const sortedContent = useMemo(
        () => [...workspace.content].sort((a, b) => Number(b.featured) - Number(a.featured) || a.priority - b.priority || a.title.localeCompare(b.title)),
        [workspace.content]
    );
    const filteredContent = useMemo(() => {
        return sortedContent.filter((entry) => {
            const matchesType = contentTypeFilter === "all" || entry.contentType === contentTypeFilter;
            const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
            const matchesFeatured = featuredFilter === "all"
                || (featuredFilter === "featured" && entry.featured)
                || (featuredFilter === "standard" && !entry.featured);
            return matchesType && matchesStatus && matchesFeatured;
        });
    }, [contentTypeFilter, featuredFilter, sortedContent, statusFilter]);
    const sortedSeries = useMemo(
        () => [...workspace.series].sort((a, b) => Number(b.featured) - Number(a.featured) || a.priority - b.priority || a.title.localeCompare(b.title)),
        [workspace.series]
    );

    if (loading) {
        return (
            <AdminShell onBack={onBack}>
                <CenteredAdminState title="Loading Academy admin" body="Pulling current categories, content, series, and metadata from Supabase." />
            </AdminShell>
        );
    }

    if (error) {
        return (
            <AdminShell onBack={onBack}>
                <CenteredAdminState title="Academy admin is unavailable" body={error} />
            </AdminShell>
        );
    }

    return (
        <AdminShell onBack={onBack}>
            <div style={{ maxWidth: 1220, margin: "0 auto", display: "grid", gap: 18 }}>
                <div style={{ background: "linear-gradient(180deg, rgba(232,98,42,0.10), rgba(255,255,255,0.03))", border, borderRadius: 24, padding: 22 }}>
                    <div style={{ fontSize: 10, color: "#E8622A", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>
                        Academy Control Surface
                    </div>
                    <div style={{ fontSize: "clamp(30px, 5vw, 42px)", lineHeight: 1, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8", marginBottom: 12 }}>
                        Forge Academy Management
                    </div>
                    <div style={{ maxWidth: 820, fontSize: 14, color: "#B5AEA5", lineHeight: 1.85 }}>
                        Create and maintain the structured learning layer of Foundry. Publish guided topics, attach YouTube videos with founder annotations, build lesson series, and keep Winner&apos;s Mindset content distinct from tactical business instruction.
                    </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {[
                        { id: "content", label: "Academy Content" },
                        { id: "series", label: "Lesson Series" },
                        { id: "categories", label: "Categories" },
                        { id: "tags", label: "Tags" },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            style={{
                                padding: "10px 14px",
                                borderRadius: 999,
                                border: activeTab === tab.id ? "1px solid rgba(232,98,42,0.28)" : border,
                                background: activeTab === tab.id ? "rgba(232,98,42,0.14)" : surface,
                                color: activeTab === tab.id ? "#E8622A" : "#C8C4BE",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === "content" && (
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(340px, 0.95fr) minmax(0, 1.2fr)", gap: 18 }}>
                        <Panel title="Create or edit content" subtitle="Topics, videos, resources, and Winner's Mindset entries all live here.">
                            {renderContentForm({
                                form: contentForm,
                                categories: sortedCategories,
                                allTags: workspace.tags,
                                saving: saving === "content",
                                onChange: setContentForm,
                                onReset: () => setContentForm(createEmptyContentForm()),
                                onSubmit: async () => {
                                    setSaving("content");
                                    try {
                                        await saveAcademyContent({
                                            id: contentForm.id ?? undefined,
                                            title: contentForm.title,
                                            slug: contentForm.slug,
                                            shortDescription: contentForm.shortDescription,
                                            description: contentForm.description,
                                            contentType: contentForm.contentType,
                                            categoryId: contentForm.categoryId || null,
                                            sourceType: contentForm.sourceType,
                                            stageIds: contentForm.stageIds,
                                            difficultyLabel: contentForm.difficultyLabel,
                                            estimatedMinutes: parseNullableNumber(contentForm.estimatedMinutes),
                                            whyThisMatters: contentForm.whyThisMatters,
                                            whatToWatchFor: contentForm.whatToWatchFor,
                                            learningGoal: contentForm.learningGoal,
                                            whoThisIsFor: contentForm.whoThisIsFor,
                                            whenThisMatters: contentForm.whenThisMatters,
                                            commonMistake: contentForm.commonMistake,
                                            starterPrompt: contentForm.starterPrompt,
                                            forgeContext: contentForm.forgeContext,
                                            knowledgeCheckPrompt: contentForm.knowledgeCheckPrompt,
                                            knowledgeCheckExpectedPoints: contentForm.knowledgeCheckExpectedPoints.split("\n").map((value) => value.trim()).filter(Boolean),
                                            completionBadgeLabel: contentForm.completionBadgeLabel,
                                            videoUrl: contentForm.videoUrl,
                                            resourceUrl: contentForm.resourceUrl,
                                            thumbnailUrl: contentForm.thumbnailUrl,
                                            transcript: contentForm.transcript,
                                            featured: contentForm.featured,
                                            priority: Number(contentForm.priority) || 0,
                                            status: contentForm.status,
                                            tagNames: contentForm.tagText.split(",").map((value) => value.trim()).filter(Boolean),
                                        });
                                        setContentForm(createEmptyContentForm());
                                        await refreshWorkspace();
                                    } finally {
                                        setSaving(null);
                                    }
                                },
                            })}
                        </Panel>
                        <Panel title="Existing content" subtitle="Published and draft Academy entries across every content type.">
                            <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                    {[
                                        { value: "all", label: "All types" },
                                        { value: "topic", label: "Topics" },
                                        { value: "video", label: "Videos" },
                                        { value: "resource", label: "Resources" },
                                        { value: "mindset", label: "Mindset" },
                                    ].map((option) => (
                                        <FilterChip
                                            key={option.value}
                                            active={contentTypeFilter === option.value}
                                            onClick={() => setContentTypeFilter(option.value as typeof contentTypeFilter)}
                                        >
                                            {option.label}
                                        </FilterChip>
                                    ))}
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                    {[
                                        { value: "all", label: "All statuses" },
                                        { value: "published", label: "Published" },
                                        { value: "draft", label: "Draft" },
                                        { value: "hidden", label: "Hidden" },
                                        { value: "all-featured", label: "All featured states" },
                                        { value: "featured", label: "Featured only" },
                                        { value: "standard", label: "Non-featured" },
                                    ].map((option) => (
                                        <FilterChip
                                            key={option.value}
                                            active={option.value === "featured" || option.value === "standard"
                                                ? featuredFilter === option.value
                                                : option.value === "all-featured"
                                                    ? featuredFilter === "all"
                                                : statusFilter === option.value}
                                            onClick={() => {
                                                if (option.value === "featured" || option.value === "standard" || option.value === "all-featured") {
                                                    setFeaturedFilter(option.value === "all-featured" ? "all" : option.value as typeof featuredFilter);
                                                } else {
                                                    setStatusFilter(option.value as typeof statusFilter);
                                                }
                                            }}
                                        >
                                            {option.label}
                                        </FilterChip>
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: "grid", gap: 10 }}>
                                {filteredContent.map((entry) => (
                                    <AdminListRow
                                        key={entry.id}
                                        title={entry.title}
                                        subtitle={`${entry.category?.title ?? getReadableType(entry.contentType)} · ${entry.status} · priority ${entry.priority}`}
                                        badges={[
                                            entry.featured ? "Featured" : null,
                                            entry.sourceType === "external_youtube" && entry.videoUrl ? "YouTube" : null,
                                            entry.contentType === "mindset" ? "Winner's Mindset" : null,
                                        ].filter(Boolean) as string[]}
                                        onEdit={() => setContentForm(populateContentForm(entry))}
                                        onDelete={async () => {
                                            setSaving(`delete-content-${entry.id}`);
                                            try {
                                                await deleteAcademyContent(entry.id);
                                                if (contentForm.id === entry.id) setContentForm(createEmptyContentForm());
                                                await refreshWorkspace();
                                            } finally {
                                                setSaving(null);
                                            }
                                        }}
                                        deleting={saving === `delete-content-${entry.id}`}
                                    />
                                ))}
                            </div>
                        </Panel>
                    </div>
                )}

                {activeTab === "series" && (
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(340px, 0.95fr) minmax(0, 1.2fr)", gap: 18 }}>
                        <Panel title="Create or edit series" subtitle="Series sequence existing Academy content into a structured learning path.">
                            {renderSeriesForm({
                                form: seriesForm,
                                categories: sortedCategories,
                                content: sortedContent.filter((entry) => entry.status !== "hidden"),
                                saving: saving === "series",
                                onChange: setSeriesForm,
                                onReset: () => setSeriesForm(createEmptySeriesForm()),
                                onSubmit: async () => {
                                    setSaving("series");
                                    try {
                                        await saveAcademySeries({
                                            id: seriesForm.id ?? undefined,
                                            title: seriesForm.title,
                                            slug: seriesForm.slug,
                                            shortDescription: seriesForm.shortDescription,
                                            description: seriesForm.description,
                                            categoryId: seriesForm.categoryId || null,
                                            stageIds: seriesForm.stageIds,
                                            difficultyLabel: seriesForm.difficultyLabel,
                                            estimatedMinutes: parseNullableNumber(seriesForm.estimatedMinutes),
                                            learningGoal: seriesForm.learningGoal,
                                            coverImageUrl: seriesForm.coverImageUrl,
                                            featured: seriesForm.featured,
                                            priority: Number(seriesForm.priority) || 0,
                                            status: seriesForm.status,
                                            items: seriesForm.items.map((item, index) => ({
                                                ...item,
                                                position: index + 1,
                                            })),
                                        });
                                        setSeriesForm(createEmptySeriesForm());
                                        await refreshWorkspace();
                                    } finally {
                                        setSaving(null);
                                    }
                                },
                            })}
                        </Panel>
                        <Panel title="Existing lesson series" subtitle="Series should feel intentional, not like random playlists.">
                            <div style={{ display: "grid", gap: 10 }}>
                                {sortedSeries.map((entry) => (
                                    <AdminListRow
                                        key={entry.id}
                                        title={entry.title}
                                        subtitle={`${entry.category?.title ?? "Series"} · ${entry.status} · ${entry.items.length} items`}
                                        badges={[
                                            entry.featured ? "Featured" : null,
                                            entry.difficultyLabel || null,
                                        ].filter(Boolean) as string[]}
                                        onEdit={() => setSeriesForm(populateSeriesForm(entry))}
                                        onDelete={async () => {
                                            setSaving(`delete-series-${entry.id}`);
                                            try {
                                                await deleteAcademySeries(entry.id);
                                                if (seriesForm.id === entry.id) setSeriesForm(createEmptySeriesForm());
                                                await refreshWorkspace();
                                            } finally {
                                                setSaving(null);
                                            }
                                        }}
                                        deleting={saving === `delete-series-${entry.id}`}
                                    />
                                ))}
                            </div>
                        </Panel>
                    </div>
                )}

                {activeTab === "categories" && (
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 0.85fr) minmax(0, 1.1fr)", gap: 18 }}>
                        <Panel title="Create or edit categories" subtitle="Categories define the structure of Academy and should remain practical.">
                            {renderCategoryForm({
                                form: categoryForm,
                                saving: saving === "category",
                                onChange: setCategoryForm,
                                onReset: () => setCategoryForm(createEmptyCategoryForm()),
                                onSubmit: async () => {
                                    setSaving("category");
                                    try {
                                        await saveAcademyCategory({
                                            id: categoryForm.id ?? undefined,
                                            title: categoryForm.title,
                                            slug: categoryForm.slug,
                                            description: categoryForm.description,
                                            accentColor: categoryForm.accentColor,
                                            sortOrder: Number(categoryForm.sortOrder) || 0,
                                            isMindset: categoryForm.isMindset,
                                            isActive: categoryForm.isActive,
                                        });
                                        setCategoryForm(createEmptyCategoryForm());
                                        await refreshWorkspace();
                                    } finally {
                                        setSaving(null);
                                    }
                                },
                            })}
                        </Panel>
                        <Panel title="Category library" subtitle="Used to segment content areas like finance, sales, and Winner's Mindset.">
                            <div style={{ display: "grid", gap: 10 }}>
                                {sortedCategories.map((entry) => (
                                    <AdminListRow
                                        key={entry.id}
                                        title={entry.title}
                                        subtitle={`${entry.slug} · order ${entry.sortOrder}`}
                                        badges={[
                                            entry.isMindset ? "Mindset" : null,
                                            entry.isActive ? "Active" : "Hidden",
                                        ].filter(Boolean) as string[]}
                                        onEdit={() => setCategoryForm(populateCategoryForm(entry))}
                                        onDelete={async () => {
                                            setSaving(`delete-category-${entry.id}`);
                                            try {
                                                await deleteAcademyCategory(entry.id);
                                                if (categoryForm.id === entry.id) setCategoryForm(createEmptyCategoryForm());
                                                await refreshWorkspace();
                                            } finally {
                                                setSaving(null);
                                            }
                                        }}
                                        deleting={saving === `delete-category-${entry.id}`}
                                    />
                                ))}
                            </div>
                        </Panel>
                    </div>
                )}

                {activeTab === "tags" && (
                    <div style={{ display: "grid", gap: 18, gridTemplateColumns: "minmax(320px, 0.8fr) minmax(0, 1fr)" }}>
                        <Panel title="Add tag" subtitle="Tags are used for concept mapping and discovery inside Academy.">
                            <div style={{ display: "grid", gap: 12 }}>
                                <FormField label="Tag name">
                                    <input
                                        value={newTagName}
                                        onChange={(event) => setNewTagName(event.target.value)}
                                        placeholder="Pricing, founder identity, uncertainty..."
                                        style={inputStyle}
                                    />
                                </FormField>
                                <button
                                    onClick={async () => {
                                        if (!newTagName.trim()) return;
                                        setSaving("tag");
                                        try {
                                            await saveAcademyTag(newTagName);
                                            setNewTagName("");
                                            await refreshWorkspace();
                                        } finally {
                                            setSaving(null);
                                        }
                                    }}
                                    style={primaryButtonStyle}
                                    disabled={saving === "tag"}
                                >
                                    {saving === "tag" ? "Saving..." : "Save tag"}
                                </button>
                            </div>
                        </Panel>
                        <Panel title="Tag library" subtitle="Tags can also be created from the content form through the comma-separated tag field.">
                            <div style={{ display: "grid", gap: 10 }}>
                                {workspace.tags.map((tag) => (
                                    <div key={tag.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", background: surface, border, borderRadius: 14, padding: "12px 14px" }}>
                                        <div>
                                            <div style={{ fontSize: 13, color: "#F0EDE8", fontWeight: 600 }}>{tag.name}</div>
                                            <div style={{ fontSize: 11, color: "#777" }}>{tag.slug}</div>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                setSaving(`delete-tag-${tag.id}`);
                                                try {
                                                    await deleteAcademyTag(tag.id);
                                                    await refreshWorkspace();
                                                } finally {
                                                    setSaving(null);
                                                }
                                            }}
                                            style={dangerButtonStyle}
                                            disabled={saving === `delete-tag-${tag.id}`}
                                        >
                                            {saving === `delete-tag-${tag.id}` ? "Deleting..." : "Delete"}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </Panel>
                    </div>
                )}
            </div>
        </AdminShell>
    );
}

function AdminShell({ children, onBack }: { children: ReactNode; onBack: () => void }) {
    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 190, background: "#080809", color: "#F0EDE8", display: "flex", flexDirection: "column", fontFamily: "'Lora', Georgia, serif" }}>
            <div style={{ padding: "max(14px, calc(10px + env(safe-area-inset-top))) 16px 12px", borderBottom: border, background: "rgba(8,8,9,0.95)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={onBack} style={{ background: surface, border, borderRadius: 9, padding: "8px 12px", color: "#C8C4BE", fontSize: 12, cursor: "pointer" }}>
                    ← Admin Hub
                </button>
                <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>Forge Academy Admin</div>
                    <div style={{ fontSize: 11, color: "#6E675F" }}>Content and curriculum management</div>
                </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px 36px" }}>
                {children}
            </div>
        </div>
    );
}

function Panel({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle: string;
    children: ReactNode;
}) {
    return (
        <div style={{ background: surface, border, borderRadius: 22, padding: 18 }}>
            <div style={{ fontSize: 22, lineHeight: 1.05, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, marginBottom: 8 }}>
                {title}
            </div>
            <div style={{ fontSize: 13, color: "#9D978E", lineHeight: 1.75, marginBottom: 16 }}>
                {subtitle}
            </div>
            {children}
        </div>
    );
}

function FilterChip({
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
                border: active ? "1px solid rgba(232,98,42,0.28)" : border,
                background: active ? "rgba(232,98,42,0.14)" : "rgba(255,255,255,0.03)",
                color: active ? "#E8622A" : "#C8C4BE",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
            }}
        >
            {children}
        </button>
    );
}

function AdminListRow({
    title,
    subtitle,
    badges,
    onEdit,
    onDelete,
    deleting,
}: {
    title: string;
    subtitle: string;
    badges: string[];
    onEdit: () => void;
    onDelete: () => void;
    deleting?: boolean;
}) {
    return (
        <div style={{ background: "rgba(255,255,255,0.025)", border, borderRadius: 16, padding: 14, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div>
                    <div style={{ fontSize: 14, color: "#F0EDE8", fontWeight: 700, marginBottom: 6 }}>{title}</div>
                    <div style={{ fontSize: 12, color: "#8D857C", lineHeight: 1.7 }}>{subtitle}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {badges.map((badge) => (
                        <span key={badge} style={{ padding: "5px 8px", borderRadius: 999, background: "rgba(255,255,255,0.05)", border, color: "#C8C4BE", fontSize: 10, fontWeight: 700 }}>
                            {badge}
                        </span>
                    ))}
                </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={onEdit} style={secondaryButtonStyle}>Edit</button>
                <button onClick={onDelete} style={dangerButtonStyle} disabled={deleting}>
                    {deleting ? "Deleting..." : "Delete"}
                </button>
            </div>
        </div>
    );
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
    return (
        <label style={{ display: "grid", gap: 8 }}>
            <div>
                <div style={{ fontSize: 11, color: "#C8C4BE", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: hint ? 4 : 0 }}>{label}</div>
                {hint && <div style={{ fontSize: 11, color: "#777", lineHeight: 1.6 }}>{hint}</div>}
            </div>
            {children}
        </label>
    );
}

function Toggle({
    checked,
    label,
    onChange,
}: {
    checked: boolean;
    label: string;
    onChange: (next: boolean) => void;
}) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            style={{
                justifySelf: "start",
                padding: "8px 12px",
                borderRadius: 999,
                border: checked ? "1px solid rgba(76,175,138,0.28)" : border,
                background: checked ? "rgba(76,175,138,0.14)" : "rgba(255,255,255,0.03)",
                color: checked ? "#4CAF8A" : "#C8C4BE",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
            }}
        >
            {label}: {checked ? "On" : "Off"}
        </button>
    );
}

function StageSelector({ value, onChange }: { value: number[]; onChange: (next: number[]) => void }) {
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {STAGES_DATA.map((stage) => {
                const active = value.includes(stage.id);
                return (
                    <button
                        key={stage.id}
                        type="button"
                        onClick={() => onChange(active ? value.filter((item) => item !== stage.id) : [...value, stage.id].sort((a, b) => a - b))}
                        style={{
                            padding: "8px 10px",
                            borderRadius: 999,
                            border: active ? "1px solid rgba(232,98,42,0.28)" : border,
                            background: active ? "rgba(232,98,42,0.14)" : "rgba(255,255,255,0.03)",
                            color: active ? "#E8622A" : "#C8C4BE",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        Stage {stage.id}
                    </button>
                );
            })}
        </div>
    );
}

function CenteredAdminState({ title, body }: { title: string; body: string }) {
    return (
        <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <div style={{ maxWidth: 560, display: "grid", gap: 10 }}>
                <div style={{ fontSize: 36, lineHeight: 1, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}>{title}</div>
                <div style={{ fontSize: 14, color: "#9D978E", lineHeight: 1.8 }}>{body}</div>
            </div>
        </div>
    );
}

const inputStyle: CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 12,
    padding: "11px 12px",
    color: "#F0EDE8",
    fontSize: 13,
    boxSizing: "border-box",
};

const textareaStyle: CSSProperties = {
    ...inputStyle,
    minHeight: 110,
    resize: "vertical",
    lineHeight: 1.6,
    fontFamily: "inherit",
};

const primaryButtonStyle: CSSProperties = {
    background: "linear-gradient(135deg, #E8622A, #C9521E)",
    border: "none",
    borderRadius: 12,
    padding: "11px 14px",
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border,
    borderRadius: 10,
    padding: "9px 12px",
    color: "#C8C4BE",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
};

const dangerButtonStyle: CSSProperties = {
    background: "rgba(166,59,36,0.18)",
    border: "1px solid rgba(166,59,36,0.28)",
    borderRadius: 10,
    padding: "9px 12px",
    color: "#E0B09E",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
};

function renderContentForm({
    form,
    categories,
    allTags,
    saving,
    onChange,
    onReset,
    onSubmit,
}: {
    form: ContentFormState;
    categories: AcademyCategory[];
    allTags: AcademyAdminWorkspace["tags"];
    saving: boolean;
    onChange: (next: ContentFormState) => void;
    onReset: () => void;
    onSubmit: () => void;
}) {
    const youtubeId = extractYoutubeVideoId(form.videoUrl);
    return (
        <div style={{ display: "grid", gap: 14 }}>
            <FormField label="Title">
                <input value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value, slug: form.id ? form.slug : slugifyAcademyValue(event.target.value) })} style={inputStyle} />
            </FormField>
            <FormField label="Slug">
                <input value={form.slug} onChange={(event) => onChange({ ...form, slug: slugifyAcademyValue(event.target.value) })} style={inputStyle} />
            </FormField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="Type">
                    <select value={form.contentType} onChange={(event) => onChange({ ...form, contentType: event.target.value as ContentFormState["contentType"] })} style={inputStyle}>
                        <option value="topic">Topic conversation</option>
                        <option value="video">Video</option>
                        <option value="resource">Resource</option>
                        <option value="mindset">Winner&apos;s Mindset</option>
                    </select>
                </FormField>
                <FormField label="Status">
                    <select value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as ContentFormState["status"] })} style={inputStyle}>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="hidden">Hidden</option>
                    </select>
                </FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="Category">
                    <select value={form.categoryId} onChange={(event) => onChange({ ...form, categoryId: event.target.value })} style={inputStyle}>
                        <option value="">No category</option>
                        {categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}
                    </select>
                </FormField>
                <FormField label="Source type">
                    <select value={form.sourceType} onChange={(event) => onChange({ ...form, sourceType: event.target.value as ContentFormState["sourceType"] })} style={inputStyle}>
                        <option value="foundry_original">Foundry original</option>
                        <option value="external_youtube">External YouTube</option>
                        <option value="external_resource">External resource</option>
                    </select>
                </FormField>
            </div>
            <FormField label="Short description">
                <textarea value={form.shortDescription} onChange={(event) => onChange({ ...form, shortDescription: event.target.value })} style={{ ...textareaStyle, minHeight: 90 }} />
            </FormField>
            <FormField label="Full description">
                <textarea value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} style={textareaStyle} />
            </FormField>
            <FormField label="Stage relevance">
                <StageSelector value={form.stageIds} onChange={(stageIds) => onChange({ ...form, stageIds })} />
            </FormField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <FormField label="Difficulty">
                    <input value={form.difficultyLabel} onChange={(event) => onChange({ ...form, difficultyLabel: event.target.value })} style={inputStyle} />
                </FormField>
                <FormField label="Estimated minutes">
                    <input value={form.estimatedMinutes} onChange={(event) => onChange({ ...form, estimatedMinutes: event.target.value })} style={inputStyle} />
                </FormField>
                <FormField label="Priority">
                    <input value={form.priority} onChange={(event) => onChange({ ...form, priority: event.target.value })} style={inputStyle} />
                </FormField>
            </div>
            <FormField label="Tags" hint="Comma-separated. New tags will be created automatically.">
                <input value={form.tagText} onChange={(event) => onChange({ ...form, tagText: event.target.value })} style={inputStyle} />
            </FormField>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {allTags.slice(0, 12).map((tag) => {
                    const active = form.tagText.toLowerCase().split(",").map((value) => value.trim()).includes(tag.name.toLowerCase());
                    return (
                        <FilterChip
                            key={tag.id}
                            active={active}
                            onClick={() => {
                                const current = form.tagText.split(",").map((value) => value.trim()).filter(Boolean);
                                const exists = current.some((value) => value.toLowerCase() === tag.name.toLowerCase());
                                const next = exists
                                    ? current.filter((value) => value.toLowerCase() !== tag.name.toLowerCase())
                                    : [...current, tag.name];
                                onChange({ ...form, tagText: next.join(", ") });
                            }}
                        >
                            {tag.name}
                        </FilterChip>
                    );
                })}
            </div>
            <FormField label="Why this matters">
                <textarea value={form.whyThisMatters} onChange={(event) => onChange({ ...form, whyThisMatters: event.target.value })} style={{ ...textareaStyle, minHeight: 100 }} />
            </FormField>
            <FormField label="What to watch for">
                <textarea value={form.whatToWatchFor} onChange={(event) => onChange({ ...form, whatToWatchFor: event.target.value })} style={{ ...textareaStyle, minHeight: 100 }} />
            </FormField>
            <FormField label="Learning objective">
                <textarea value={form.learningGoal} onChange={(event) => onChange({ ...form, learningGoal: event.target.value })} style={{ ...textareaStyle, minHeight: 90 }} />
            </FormField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="Who this is for">
                    <textarea value={form.whoThisIsFor} onChange={(event) => onChange({ ...form, whoThisIsFor: event.target.value })} style={{ ...textareaStyle, minHeight: 90 }} />
                </FormField>
                <FormField label="When this matters">
                    <textarea value={form.whenThisMatters} onChange={(event) => onChange({ ...form, whenThisMatters: event.target.value })} style={{ ...textareaStyle, minHeight: 90 }} />
                </FormField>
            </div>
            <FormField label="Common mistake">
                <textarea value={form.commonMistake} onChange={(event) => onChange({ ...form, commonMistake: event.target.value })} style={{ ...textareaStyle, minHeight: 90 }} />
            </FormField>
            <FormField label="Forge starter prompt" hint="Used when a founder opens a guided topic conversation from Academy.">
                <textarea value={form.starterPrompt} onChange={(event) => onChange({ ...form, starterPrompt: event.target.value })} style={textareaStyle} />
            </FormField>
            <FormField label="Forge supporting context">
                <textarea value={form.forgeContext} onChange={(event) => onChange({ ...form, forgeContext: event.target.value })} style={textareaStyle} />
            </FormField>
            <FormField label="Knowledge check prompt" hint="One sharp understanding question Forge can use before completion.">
                <textarea value={form.knowledgeCheckPrompt} onChange={(event) => onChange({ ...form, knowledgeCheckPrompt: event.target.value })} style={{ ...textareaStyle, minHeight: 110 }} />
            </FormField>
            <FormField label="Knowledge check expected points" hint="One point per line. Forge uses these to judge whether the lesson really landed.">
                <textarea value={form.knowledgeCheckExpectedPoints} onChange={(event) => onChange({ ...form, knowledgeCheckExpectedPoints: event.target.value })} style={{ ...textareaStyle, minHeight: 120 }} />
            </FormField>
            <FormField label="Completion badge label">
                <input value={form.completionBadgeLabel} onChange={(event) => onChange({ ...form, completionBadgeLabel: event.target.value })} style={inputStyle} />
            </FormField>
            <FormField label="YouTube video URL" hint={youtubeId ? `Detected YouTube ID: ${youtubeId}` : "Accepted formats: youtube.com, youtu.be, embed, shorts, or a raw 11-char ID."}>
                <input value={form.videoUrl} onChange={(event) => onChange({ ...form, videoUrl: event.target.value })} style={inputStyle} />
            </FormField>
            <FormField label="Resource URL">
                <input value={form.resourceUrl} onChange={(event) => onChange({ ...form, resourceUrl: event.target.value })} style={inputStyle} />
            </FormField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="Thumbnail URL">
                    <input value={form.thumbnailUrl} onChange={(event) => onChange({ ...form, thumbnailUrl: event.target.value })} style={inputStyle} />
                </FormField>
                <FormField label="Transcript">
                    <textarea value={form.transcript} onChange={(event) => onChange({ ...form, transcript: event.target.value })} style={{ ...textareaStyle, minHeight: 90 }} />
                </FormField>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Toggle checked={form.featured} label="Featured" onChange={(featured) => onChange({ ...form, featured })} />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={onSubmit} style={primaryButtonStyle} disabled={saving}>{saving ? "Saving..." : form.id ? "Update content" : "Create content"}</button>
                <button onClick={onReset} style={secondaryButtonStyle}>Reset form</button>
            </div>
        </div>
    );
}

function renderSeriesForm({
    form,
    categories,
    content,
    saving,
    onChange,
    onReset,
    onSubmit,
}: {
    form: SeriesFormState;
    categories: AcademyCategory[];
    content: AcademyContent[];
    saving: boolean;
    onChange: (next: SeriesFormState) => void;
    onReset: () => void;
    onSubmit: () => void;
}) {
    return (
        <div style={{ display: "grid", gap: 14 }}>
            <FormField label="Title">
                <input value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value, slug: form.id ? form.slug : slugifyAcademyValue(event.target.value) })} style={inputStyle} />
            </FormField>
            <FormField label="Slug">
                <input value={form.slug} onChange={(event) => onChange({ ...form, slug: slugifyAcademyValue(event.target.value) })} style={inputStyle} />
            </FormField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="Category">
                    <select value={form.categoryId} onChange={(event) => onChange({ ...form, categoryId: event.target.value })} style={inputStyle}>
                        <option value="">No category</option>
                        {categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}
                    </select>
                </FormField>
                <FormField label="Status">
                    <select value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as SeriesFormState["status"] })} style={inputStyle}>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="hidden">Hidden</option>
                    </select>
                </FormField>
            </div>
            <FormField label="Short description">
                <textarea value={form.shortDescription} onChange={(event) => onChange({ ...form, shortDescription: event.target.value })} style={{ ...textareaStyle, minHeight: 90 }} />
            </FormField>
            <FormField label="Full description">
                <textarea value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} style={textareaStyle} />
            </FormField>
            <FormField label="Learning goal">
                <textarea value={form.learningGoal} onChange={(event) => onChange({ ...form, learningGoal: event.target.value })} style={{ ...textareaStyle, minHeight: 90 }} />
            </FormField>
            <FormField label="Stage relevance">
                <StageSelector value={form.stageIds} onChange={(stageIds) => onChange({ ...form, stageIds })} />
            </FormField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <FormField label="Difficulty">
                    <input value={form.difficultyLabel} onChange={(event) => onChange({ ...form, difficultyLabel: event.target.value })} style={inputStyle} />
                </FormField>
                <FormField label="Estimated minutes">
                    <input value={form.estimatedMinutes} onChange={(event) => onChange({ ...form, estimatedMinutes: event.target.value })} style={inputStyle} />
                </FormField>
                <FormField label="Priority">
                    <input value={form.priority} onChange={(event) => onChange({ ...form, priority: event.target.value })} style={inputStyle} />
                </FormField>
            </div>
            <FormField label="Cover image URL">
                <input value={form.coverImageUrl} onChange={(event) => onChange({ ...form, coverImageUrl: event.target.value })} style={inputStyle} />
            </FormField>
            <Toggle checked={form.featured} label="Featured" onChange={(featured) => onChange({ ...form, featured })} />
            <FormField label="Series items" hint="Add Academy content records in the order founders should progress through them.">
                <div style={{ display: "grid", gap: 10 }}>
                    {form.items.map((item, index) => (
                        <div key={`${item.id ?? "new"}-${index}`} style={{ background: "rgba(255,255,255,0.02)", border, borderRadius: 14, padding: 12, display: "grid", gap: 10 }}>
                            <FormField label={`Item ${index + 1}`}>
                                <select value={item.contentId} onChange={(event) => onChange({
                                    ...form,
                                    items: form.items.map((current, currentIndex) => currentIndex === index ? { ...current, contentId: event.target.value } : current),
                                })} style={inputStyle}>
                                    <option value="">Select content</option>
                                    {content.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
                                </select>
                            </FormField>
                            <FormField label="Title override">
                                <input value={item.titleOverride} onChange={(event) => onChange({
                                    ...form,
                                    items: form.items.map((current, currentIndex) => currentIndex === index ? { ...current, titleOverride: event.target.value } : current),
                                })} style={inputStyle} />
                            </FormField>
                            <FormField label="Description override">
                                <textarea value={item.descriptionOverride} onChange={(event) => onChange({
                                    ...form,
                                    items: form.items.map((current, currentIndex) => currentIndex === index ? { ...current, descriptionOverride: event.target.value } : current),
                                })} style={{ ...textareaStyle, minHeight: 90 }} />
                            </FormField>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                <Toggle checked={item.required} label="Required" onChange={(required) => onChange({
                                    ...form,
                                    items: form.items.map((current, currentIndex) => currentIndex === index ? { ...current, required } : current),
                                })} />
                                <button onClick={() => onChange({ ...form, items: form.items.filter((_, currentIndex) => currentIndex !== index) })} style={dangerButtonStyle}>
                                    Remove item
                                </button>
                            </div>
                        </div>
                    ))}
                    <button onClick={() => onChange({ ...form, items: [...form.items, { contentId: "", position: form.items.length + 1, titleOverride: "", descriptionOverride: "", required: true }] })} style={secondaryButtonStyle}>
                        Add series item
                    </button>
                </div>
            </FormField>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={onSubmit} style={primaryButtonStyle} disabled={saving}>{saving ? "Saving..." : form.id ? "Update series" : "Create series"}</button>
                <button onClick={onReset} style={secondaryButtonStyle}>Reset form</button>
            </div>
        </div>
    );
}

function renderCategoryForm({
    form,
    saving,
    onChange,
    onReset,
    onSubmit,
}: {
    form: CategoryFormState;
    saving: boolean;
    onChange: (next: CategoryFormState) => void;
    onReset: () => void;
    onSubmit: () => void;
}) {
    return (
        <div style={{ display: "grid", gap: 14 }}>
            <FormField label="Title">
                <input value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value, slug: form.id ? form.slug : slugifyAcademyValue(event.target.value) })} style={inputStyle} />
            </FormField>
            <FormField label="Slug">
                <input value={form.slug} onChange={(event) => onChange({ ...form, slug: slugifyAcademyValue(event.target.value) })} style={inputStyle} />
            </FormField>
            <FormField label="Description">
                <textarea value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} style={textareaStyle} />
            </FormField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="Accent color">
                    <input value={form.accentColor} onChange={(event) => onChange({ ...form, accentColor: event.target.value })} style={inputStyle} />
                </FormField>
                <FormField label="Sort order">
                    <input value={form.sortOrder} onChange={(event) => onChange({ ...form, sortOrder: event.target.value })} style={inputStyle} />
                </FormField>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Toggle checked={form.isMindset} label="Mindset category" onChange={(isMindset) => onChange({ ...form, isMindset })} />
                <Toggle checked={form.isActive} label="Active" onChange={(isActive) => onChange({ ...form, isActive })} />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={onSubmit} style={primaryButtonStyle} disabled={saving}>{saving ? "Saving..." : form.id ? "Update category" : "Create category"}</button>
                <button onClick={onReset} style={secondaryButtonStyle}>Reset form</button>
            </div>
        </div>
    );
}

function createEmptyContentForm(): ContentFormState {
    return {
        title: "",
        slug: "",
        shortDescription: "",
        description: "",
        contentType: "topic",
        categoryId: "",
        sourceType: "foundry_original",
        difficultyLabel: "",
        estimatedMinutes: "",
        whyThisMatters: "",
        whatToWatchFor: "",
        learningGoal: "",
        whoThisIsFor: "",
        whenThisMatters: "",
        commonMistake: "",
        starterPrompt: "",
        forgeContext: "",
        knowledgeCheckPrompt: "",
        knowledgeCheckExpectedPoints: "",
        completionBadgeLabel: "",
        videoUrl: "",
        resourceUrl: "",
        thumbnailUrl: "",
        transcript: "",
        featured: false,
        priority: "0",
        status: "draft",
        tagText: "",
        stageIds: [],
    };
}

function createEmptySeriesForm(): SeriesFormState {
    return {
        title: "",
        slug: "",
        shortDescription: "",
        description: "",
        categoryId: "",
        difficultyLabel: "",
        estimatedMinutes: "",
        learningGoal: "",
        coverImageUrl: "",
        featured: false,
        priority: "0",
        status: "draft",
        stageIds: [],
        items: [],
    };
}

function createEmptyCategoryForm(): CategoryFormState {
    return {
        title: "",
        slug: "",
        description: "",
        accentColor: "",
        sortOrder: "0",
        isMindset: false,
        isActive: true,
    };
}

function populateContentForm(entry: AcademyContent): ContentFormState {
    return {
        id: entry.id,
        title: entry.title,
        slug: entry.slug,
        shortDescription: entry.shortDescription,
        description: entry.description ?? "",
        contentType: entry.contentType,
        categoryId: entry.categoryId ?? "",
        sourceType: entry.sourceType,
        difficultyLabel: entry.difficultyLabel ?? "",
        estimatedMinutes: entry.estimatedMinutes != null ? String(entry.estimatedMinutes) : "",
        whyThisMatters: entry.whyThisMatters ?? "",
        whatToWatchFor: entry.whatToWatchFor ?? "",
        learningGoal: entry.learningGoal ?? "",
        whoThisIsFor: entry.whoThisIsFor ?? "",
        whenThisMatters: entry.whenThisMatters ?? "",
        commonMistake: entry.commonMistake ?? "",
        starterPrompt: entry.starterPrompt ?? "",
        forgeContext: entry.forgeContext ?? "",
        knowledgeCheckPrompt: entry.knowledgeCheckPrompt ?? "",
        knowledgeCheckExpectedPoints: entry.knowledgeCheckExpectedPoints.join("\n"),
        completionBadgeLabel: entry.completionBadgeLabel ?? "",
        videoUrl: entry.videoUrl ?? "",
        resourceUrl: entry.resourceUrl ?? "",
        thumbnailUrl: entry.thumbnailUrl ?? "",
        transcript: entry.transcript ?? "",
        featured: entry.featured,
        priority: String(entry.priority ?? 0),
        status: entry.status,
        tagText: entry.tags.map((tag) => tag.name).join(", "),
        stageIds: entry.stageIds,
    };
}

function populateSeriesForm(entry: AcademySeries): SeriesFormState {
    return {
        id: entry.id,
        title: entry.title,
        slug: entry.slug,
        shortDescription: entry.shortDescription,
        description: entry.description ?? "",
        categoryId: entry.categoryId ?? "",
        difficultyLabel: entry.difficultyLabel ?? "",
        estimatedMinutes: entry.estimatedMinutes != null ? String(entry.estimatedMinutes) : "",
        learningGoal: entry.learningGoal ?? "",
        coverImageUrl: entry.coverImageUrl ?? "",
        featured: entry.featured,
        priority: String(entry.priority ?? 0),
        status: entry.status,
        stageIds: entry.stageIds,
        items: entry.items.map((item, index) => ({
            id: item.id,
            contentId: item.contentId,
            position: index + 1,
            titleOverride: item.titleOverride ?? "",
            descriptionOverride: item.descriptionOverride ?? "",
            required: item.required,
        })),
    };
}

function populateCategoryForm(entry: AcademyCategory): CategoryFormState {
    return {
        id: entry.id,
        title: entry.title,
        slug: entry.slug,
        description: entry.description ?? "",
        accentColor: entry.accentColor ?? "",
        sortOrder: String(entry.sortOrder),
        isMindset: entry.isMindset,
        isActive: entry.isActive,
    };
}

function parseNullableNumber(value: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function getReadableType(type: AcademyContent["contentType"]) {
    switch (type) {
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
