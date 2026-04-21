import { supabase } from "../supabase";
import {
    extractYoutubeVideoId,
    slugifyAcademyValue,
    type AcademyAdminWorkspace,
    type AcademyCategory,
    type AcademyContent,
    type AcademyContentType,
    type AcademyHistoryAction,
    type AcademySeries,
    type AcademySeriesItem,
    type AcademyStatus,
    type AcademyTag,
    type AcademyUserContentProgress,
    type AcademyUserHistory,
    type AcademyUserSeriesItemProgress,
    type AcademyWorkspace,
} from "./academy";

type CategoryInput = {
    id?: string | null;
    slug?: string | null;
    title: string;
    description?: string | null;
    accentColor?: string | null;
    sortOrder?: number;
    isMindset?: boolean;
    isActive?: boolean;
};

type ContentInput = {
    id?: string | null;
    slug?: string | null;
    title: string;
    shortDescription: string;
    description?: string | null;
    contentType: AcademyContentType;
    categoryId?: string | null;
    sourceType: "foundry_original" | "external_youtube" | "external_resource";
    stageIds?: number[];
    difficultyLabel?: string | null;
    thumbnailUrl?: string | null;
    estimatedMinutes?: number | null;
    whyThisMatters?: string | null;
    whatToWatchFor?: string | null;
    learningGoal?: string | null;
    whoThisIsFor?: string | null;
    whenThisMatters?: string | null;
    commonMistake?: string | null;
    starterPrompt?: string | null;
    forgeContext?: string | null;
    videoUrl?: string | null;
    resourceUrl?: string | null;
    transcript?: string | null;
    featured?: boolean;
    priority?: number;
    status?: AcademyStatus;
    tagNames?: string[];
};

type SeriesInput = {
    id?: string | null;
    slug?: string | null;
    title: string;
    shortDescription: string;
    description?: string | null;
    categoryId?: string | null;
    stageIds?: number[];
    difficultyLabel?: string | null;
    estimatedMinutes?: number | null;
    featured?: boolean;
    priority?: number;
    status?: AcademyStatus;
    learningGoal?: string | null;
    coverImageUrl?: string | null;
    items: Array<{
        id?: string | null;
        contentId: string;
        position: number;
        titleOverride?: string | null;
        descriptionOverride?: string | null;
        required?: boolean;
    }>;
};

function isMissingAcademyRelationError(error: any) {
    const message = String(error?.message ?? "").toLowerCase();
    return error?.code === "PGRST205" || message.includes("academy_");
}

function normalizeStageIds(stageIds: number[] | null | undefined) {
    return Array.from(new Set((stageIds ?? []).filter((stageId) => stageId >= 1 && stageId <= 6))).sort((a, b) => a - b);
}

function normalizeTagNames(tagNames: string[] | null | undefined) {
    return Array.from(
        new Set(
            (tagNames ?? [])
                .map((name) => name.trim())
                .filter(Boolean)
        )
    );
}

function mapCategory(row: any): AcademyCategory {
    return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description ?? null,
        accentColor: row.accent_color ?? null,
        sortOrder: row.sort_order ?? 0,
        isMindset: row.is_mindset ?? false,
        isActive: row.is_active ?? true,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapTag(row: any): AcademyTag {
    return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        createdAt: row.created_at,
    };
}

function mapContent(row: any, categoriesById: Map<string, AcademyCategory>, tagsByContentId: Map<string, AcademyTag[]>): AcademyContent {
    return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        shortDescription: row.short_description,
        description: row.description ?? null,
        contentType: row.content_type,
        categoryId: row.category_id ?? null,
        sourceType: row.source_type,
        stageIds: normalizeStageIds(row.stage_ids),
        difficultyLabel: row.difficulty_label ?? null,
        thumbnailUrl: row.thumbnail_url ?? null,
        estimatedMinutes: row.estimated_minutes ?? null,
        whyThisMatters: row.why_this_matters ?? null,
        whatToWatchFor: row.what_to_watch_for ?? null,
        learningGoal: row.learning_goal ?? null,
        whoThisIsFor: row.who_this_is_for ?? null,
        whenThisMatters: row.when_this_matters ?? null,
        commonMistake: row.common_mistake ?? null,
        starterPrompt: row.starter_prompt ?? null,
        forgeContext: row.forge_context ?? null,
        videoUrl: row.video_url ?? null,
        youtubeVideoId: row.youtube_video_id ?? null,
        resourceUrl: row.resource_url ?? null,
        transcript: row.transcript ?? null,
        featured: row.featured ?? false,
        priority: row.priority ?? 0,
        status: row.status,
        publishedAt: row.published_at ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        category: row.category_id ? categoriesById.get(row.category_id) ?? null : null,
        tags: tagsByContentId.get(row.id) ?? [],
    };
}

function mapSeriesItem(row: any, contentById: Map<string, AcademyContent>): AcademySeriesItem {
    return {
        id: row.id,
        seriesId: row.series_id,
        contentId: row.content_id,
        position: row.position,
        titleOverride: row.title_override ?? null,
        descriptionOverride: row.description_override ?? null,
        required: row.required ?? true,
        createdAt: row.created_at,
        content: contentById.get(row.content_id) ?? null,
    };
}

function mapSeries(row: any, categoriesById: Map<string, AcademyCategory>, itemsBySeriesId: Map<string, AcademySeriesItem[]>): AcademySeries {
    return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        shortDescription: row.short_description,
        description: row.description ?? null,
        categoryId: row.category_id ?? null,
        stageIds: normalizeStageIds(row.stage_ids),
        difficultyLabel: row.difficulty_label ?? null,
        estimatedMinutes: row.estimated_minutes ?? null,
        featured: row.featured ?? false,
        priority: row.priority ?? 0,
        status: row.status,
        learningGoal: row.learning_goal ?? null,
        coverImageUrl: row.cover_image_url ?? null,
        publishedAt: row.published_at ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        category: row.category_id ? categoriesById.get(row.category_id) ?? null : null,
        items: itemsBySeriesId.get(row.id) ?? [],
    };
}

function mapContentProgress(row: any): AcademyUserContentProgress {
    return {
        userId: row.user_id,
        contentId: row.content_id,
        status: row.status,
        completedAt: row.completed_at ?? null,
        lastOpenedAt: row.last_opened_at ?? null,
        lastForgeOpenedAt: row.last_forge_opened_at ?? null,
        updatedAt: row.updated_at,
    };
}

function mapSeriesItemProgress(row: any): AcademyUserSeriesItemProgress {
    return {
        userId: row.user_id,
        seriesId: row.series_id,
        seriesItemId: row.series_item_id,
        status: row.status,
        completedAt: row.completed_at ?? null,
        lastOpenedAt: row.last_opened_at ?? null,
        updatedAt: row.updated_at,
    };
}

function mapHistory(row: any): AcademyUserHistory {
    return {
        id: row.id,
        userId: row.user_id,
        contentId: row.content_id ?? null,
        seriesId: row.series_id ?? null,
        seriesItemId: row.series_item_id ?? null,
        action: row.action,
        metadata: (row.metadata ?? {}) as Record<string, unknown>,
        createdAt: row.created_at,
    };
}

async function loadAcademyWorkspaceInternal(userId: string, includeDrafts: boolean): Promise<AcademyWorkspace> {
    const contentQuery = supabase
        .from("academy_content")
        .select("*")
        .order("featured", { ascending: false })
        .order("priority", { ascending: true })
        .order("title", { ascending: true });

    const seriesQuery = supabase
        .from("academy_series")
        .select("*")
        .order("featured", { ascending: false })
        .order("priority", { ascending: true })
        .order("title", { ascending: true });

    const categoriesQuery = supabase
        .from("academy_categories")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true });

    const [
        categoriesRes,
        tagsRes,
        contentRes,
        contentTagsRes,
        seriesRes,
        seriesItemsRes,
        contentProgressRes,
        seriesItemProgressRes,
        historyRes,
    ] = await Promise.all([
        includeDrafts ? categoriesQuery : categoriesQuery.eq("is_active", true),
        supabase.from("academy_tags").select("*").order("name", { ascending: true }),
        includeDrafts ? contentQuery : contentQuery.eq("status", "published"),
        supabase
            .from("academy_content_tags")
            .select("content_id, tag:academy_tags(id, slug, name, created_at)"),
        includeDrafts ? seriesQuery : seriesQuery.eq("status", "published"),
        supabase.from("academy_series_items").select("*").order("position", { ascending: true }),
        supabase.from("academy_user_content_progress").select("*").eq("user_id", userId),
        supabase.from("academy_user_series_item_progress").select("*").eq("user_id", userId),
        supabase.from("academy_user_history").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(18),
    ]);

    const errors = [
        categoriesRes.error,
        tagsRes.error,
        contentRes.error,
        contentTagsRes.error,
        seriesRes.error,
        seriesItemsRes.error,
        contentProgressRes.error,
        seriesItemProgressRes.error,
        historyRes.error,
    ].filter(Boolean);

    if (errors.length > 0) {
        const firstError = errors[0];
        if (isMissingAcademyRelationError(firstError)) {
            return {
                categories: [],
                tags: [],
                content: [],
                series: [],
                contentProgress: [],
                seriesItemProgress: [],
                history: [],
            };
        }
        throw firstError;
    }

    const categories = (categoriesRes.data ?? []).map(mapCategory);
    const tags = (tagsRes.data ?? []).map(mapTag);
    const categoriesById = new Map(categories.map((category) => [category.id, category]));

    const tagsByContentId = new Map<string, AcademyTag[]>();
    for (const row of contentTagsRes.data ?? []) {
        const mappedTag = row.tag ? mapTag(row.tag) : null;
        if (!mappedTag) continue;
        const existing = tagsByContentId.get(row.content_id) ?? [];
        existing.push(mappedTag);
        tagsByContentId.set(row.content_id, existing);
    }

    const content = (contentRes.data ?? []).map((row) => mapContent(row, categoriesById, tagsByContentId));
    const contentById = new Map(content.map((entry) => [entry.id, entry]));

    const itemsBySeriesId = new Map<string, AcademySeriesItem[]>();
    for (const row of seriesItemsRes.data ?? []) {
        const item = mapSeriesItem(row, contentById);
        const existing = itemsBySeriesId.get(item.seriesId) ?? [];
        existing.push(item);
        itemsBySeriesId.set(item.seriesId, existing);
    }

    const series = (seriesRes.data ?? []).map((row) => mapSeries(row, categoriesById, itemsBySeriesId));

    return {
        categories,
        tags,
        content,
        series,
        contentProgress: (contentProgressRes.data ?? []).map(mapContentProgress),
        seriesItemProgress: (seriesItemProgressRes.data ?? []).map(mapSeriesItemProgress),
        history: (historyRes.data ?? []).map(mapHistory),
    };
}

export async function loadAcademyWorkspace(userId: string): Promise<AcademyWorkspace> {
    return loadAcademyWorkspaceInternal(userId, false);
}

export async function loadAcademyAdminWorkspace(userId: string): Promise<AcademyAdminWorkspace> {
    return loadAcademyWorkspaceInternal(userId, true);
}

export async function saveAcademyCategory(input: CategoryInput) {
    const now = new Date().toISOString();
    const payload = {
        id: input.id ?? undefined,
        slug: slugifyAcademyValue(input.slug?.trim() || input.title),
        title: input.title.trim(),
        description: input.description?.trim() || null,
        accent_color: input.accentColor?.trim() || null,
        sort_order: input.sortOrder ?? 0,
        is_mindset: input.isMindset ?? false,
        is_active: input.isActive ?? true,
        updated_at: now,
    };

    const query = input.id
        ? supabase.from("academy_categories").update(payload).eq("id", input.id)
        : supabase.from("academy_categories").insert({ ...payload, created_at: now });

    const { data, error } = await query.select().single();
    if (error) throw error;
    return mapCategory(data);
}

export async function deleteAcademyCategory(categoryId: string) {
    const { error } = await supabase.from("academy_categories").delete().eq("id", categoryId);
    if (error) throw error;
}

async function syncContentTags(contentId: string, tagNames: string[]) {
    const normalizedNames = normalizeTagNames(tagNames);
    if (normalizedNames.length === 0) {
        const { error } = await supabase.from("academy_content_tags").delete().eq("content_id", contentId);
        if (error) throw error;
        return;
    }

    const slugs = normalizedNames.map((name) => slugifyAcademyValue(name));
    const { data: existingTags, error: existingTagsError } = await supabase
        .from("academy_tags")
        .select("*")
        .in("slug", slugs);

    if (existingTagsError) throw existingTagsError;

    const existingBySlug = new Map((existingTags ?? []).map((tag) => [tag.slug, tag]));
    const missingTags = normalizedNames
        .map((name) => ({ name, slug: slugifyAcademyValue(name) }))
        .filter((tag) => !existingBySlug.has(tag.slug));

    if (missingTags.length > 0) {
        const now = new Date().toISOString();
        const { data: insertedTags, error: insertTagsError } = await supabase
            .from("academy_tags")
            .insert(missingTags.map((tag) => ({ ...tag, created_at: now })))
            .select("*");

        if (insertTagsError) throw insertTagsError;
        for (const tag of insertedTags ?? []) {
            existingBySlug.set(tag.slug, tag);
        }
    }

    const nextTagIds = normalizedNames
        .map((name) => existingBySlug.get(slugifyAcademyValue(name))?.id ?? null)
        .filter((id): id is string => Boolean(id));

    const { data: currentLinks, error: currentLinksError } = await supabase
        .from("academy_content_tags")
        .select("tag_id")
        .eq("content_id", contentId);

    if (currentLinksError) throw currentLinksError;

    const currentTagIds = new Set((currentLinks ?? []).map((link) => link.tag_id));
    const nextTagIdSet = new Set(nextTagIds);

    const idsToDelete = Array.from(currentTagIds).filter((tagId) => !nextTagIdSet.has(tagId));
    const rowsToInsert = nextTagIds
        .filter((tagId) => !currentTagIds.has(tagId))
        .map((tagId) => ({ content_id: contentId, tag_id: tagId }));

    if (idsToDelete.length > 0) {
        const { error } = await supabase
            .from("academy_content_tags")
            .delete()
            .eq("content_id", contentId)
            .in("tag_id", idsToDelete);
        if (error) throw error;
    }

    if (rowsToInsert.length > 0) {
        const { error } = await supabase.from("academy_content_tags").insert(rowsToInsert);
        if (error) throw error;
    }
}

export async function saveAcademyContent(input: ContentInput) {
    const now = new Date().toISOString();
    const videoUrl = input.videoUrl?.trim() || null;
    const youtubeVideoId = input.sourceType === "external_youtube" ? extractYoutubeVideoId(videoUrl) : null;
    const payload = {
        slug: slugifyAcademyValue(input.slug?.trim() || input.title),
        title: input.title.trim(),
        short_description: input.shortDescription.trim(),
        description: input.description?.trim() || null,
        content_type: input.contentType,
        category_id: input.categoryId || null,
        source_type: input.sourceType,
        stage_ids: normalizeStageIds(input.stageIds),
        difficulty_label: input.difficultyLabel?.trim() || null,
        thumbnail_url: input.thumbnailUrl?.trim() || null,
        estimated_minutes: input.estimatedMinutes ?? null,
        why_this_matters: input.whyThisMatters?.trim() || null,
        what_to_watch_for: input.whatToWatchFor?.trim() || null,
        learning_goal: input.learningGoal?.trim() || null,
        who_this_is_for: input.whoThisIsFor?.trim() || null,
        when_this_matters: input.whenThisMatters?.trim() || null,
        common_mistake: input.commonMistake?.trim() || null,
        starter_prompt: input.starterPrompt?.trim() || null,
        forge_context: input.forgeContext?.trim() || null,
        video_url: videoUrl,
        youtube_video_id: youtubeVideoId,
        resource_url: input.resourceUrl?.trim() || null,
        transcript: input.transcript?.trim() || null,
        featured: input.featured ?? false,
        priority: input.priority ?? 0,
        status: input.status ?? "draft",
        published_at: input.status === "published" ? now : null,
        updated_at: now,
    };

    const query = input.id
        ? supabase.from("academy_content").update(payload).eq("id", input.id)
        : supabase.from("academy_content").insert({ ...payload, created_at: now });

    const { data, error } = await query.select().single();
    if (error) throw error;

    await syncContentTags(data.id, input.tagNames ?? []);
    return data.id as string;
}

export async function deleteAcademyContent(contentId: string) {
    const { error } = await supabase.from("academy_content").delete().eq("id", contentId);
    if (error) throw error;
}

export async function saveAcademySeries(input: SeriesInput) {
    const now = new Date().toISOString();
    const payload = {
        slug: slugifyAcademyValue(input.slug?.trim() || input.title),
        title: input.title.trim(),
        short_description: input.shortDescription.trim(),
        description: input.description?.trim() || null,
        category_id: input.categoryId || null,
        stage_ids: normalizeStageIds(input.stageIds),
        difficulty_label: input.difficultyLabel?.trim() || null,
        estimated_minutes: input.estimatedMinutes ?? null,
        featured: input.featured ?? false,
        priority: input.priority ?? 0,
        status: input.status ?? "draft",
        learning_goal: input.learningGoal?.trim() || null,
        cover_image_url: input.coverImageUrl?.trim() || null,
        published_at: input.status === "published" ? now : null,
        updated_at: now,
    };

    const query = input.id
        ? supabase.from("academy_series").update(payload).eq("id", input.id)
        : supabase.from("academy_series").insert({ ...payload, created_at: now });

    const { data, error } = await query.select().single();
    if (error) throw error;

    const seriesId = data.id as string;

    const { data: existingItems, error: existingItemsError } = await supabase
        .from("academy_series_items")
        .select("id")
        .eq("series_id", seriesId);
    if (existingItemsError) throw existingItemsError;

    const existingIds = new Set((existingItems ?? []).map((item) => item.id));
    const nextIds = new Set((input.items ?? []).map((item) => item.id).filter(Boolean) as string[]);
    const idsToDelete = Array.from(existingIds).filter((id) => !nextIds.has(id));

    if (idsToDelete.length > 0) {
        const { error: deleteItemsError } = await supabase
            .from("academy_series_items")
            .delete()
            .eq("series_id", seriesId)
            .in("id", idsToDelete);
        if (deleteItemsError) throw deleteItemsError;
    }

    for (const item of input.items ?? []) {
        const itemPayload = {
            series_id: seriesId,
            content_id: item.contentId,
            position: item.position,
            title_override: item.titleOverride?.trim() || null,
            description_override: item.descriptionOverride?.trim() || null,
            required: item.required ?? true,
        };

        const itemQuery = item.id
            ? supabase.from("academy_series_items").update(itemPayload).eq("id", item.id)
            : supabase.from("academy_series_items").insert({ ...itemPayload, created_at: now });

        const { error: itemError } = await itemQuery;
        if (itemError) throw itemError;
    }

    return seriesId;
}

export async function deleteAcademySeries(seriesId: string) {
    const { error } = await supabase.from("academy_series").delete().eq("id", seriesId);
    if (error) throw error;
}

export async function saveAcademyTag(name: string) {
    const slug = slugifyAcademyValue(name);
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from("academy_tags")
        .upsert({ slug, name: name.trim(), created_at: now }, { onConflict: "slug" })
        .select()
        .single();
    if (error) throw error;
    return mapTag(data);
}

export async function deleteAcademyTag(tagId: string) {
    const { error } = await supabase.from("academy_tags").delete().eq("id", tagId);
    if (error) throw error;
}

export async function upsertAcademyContentProgress(userId: string, contentId: string, completed: boolean) {
    const now = new Date().toISOString();
    const payload = {
        user_id: userId,
        content_id: contentId,
        status: completed ? "completed" : "in_progress",
        completed_at: completed ? now : null,
        last_opened_at: now,
        updated_at: now,
    };

    const { data, error } = await supabase
        .from("academy_user_content_progress")
        .upsert(payload, { onConflict: "user_id,content_id" })
        .select()
        .single();
    if (error) throw error;
    return mapContentProgress(data);
}

export async function touchAcademyContentOpened(userId: string, contentId: string) {
    const now = new Date().toISOString();
    const { error } = await supabase
        .from("academy_user_content_progress")
        .upsert({
            user_id: userId,
            content_id: contentId,
            status: "in_progress",
            last_opened_at: now,
            updated_at: now,
        }, { onConflict: "user_id,content_id" });
    if (error) throw error;
}

export async function touchAcademyContentForgeOpened(userId: string, contentId: string) {
    const now = new Date().toISOString();
    const { error } = await supabase
        .from("academy_user_content_progress")
        .upsert({
            user_id: userId,
            content_id: contentId,
            status: "in_progress",
            last_opened_at: now,
            last_forge_opened_at: now,
            updated_at: now,
        }, { onConflict: "user_id,content_id" });
    if (error) throw error;
}

export async function upsertAcademySeriesItemProgress(userId: string, seriesId: string, seriesItemId: string, completed: boolean) {
    const now = new Date().toISOString();
    const payload = {
        user_id: userId,
        series_id: seriesId,
        series_item_id: seriesItemId,
        status: completed ? "completed" : "in_progress",
        completed_at: completed ? now : null,
        last_opened_at: now,
        updated_at: now,
    };

    const { data, error } = await supabase
        .from("academy_user_series_item_progress")
        .upsert(payload, { onConflict: "user_id,series_item_id" })
        .select()
        .single();
    if (error) throw error;
    return mapSeriesItemProgress(data);
}

export async function recordAcademyHistory(
    userId: string,
    action: AcademyHistoryAction,
    input: {
        contentId?: string | null;
        seriesId?: string | null;
        seriesItemId?: string | null;
        metadata?: Record<string, unknown>;
    } = {},
) {
    const { error } = await supabase
        .from("academy_user_history")
        .insert({
            user_id: userId,
            content_id: input.contentId ?? null,
            series_id: input.seriesId ?? null,
            series_item_id: input.seriesItemId ?? null,
            action,
            metadata: input.metadata ?? {},
        });
    if (error) throw error;
}
