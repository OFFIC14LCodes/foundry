import { createAdminApiError } from "../../_lib/admin.js";

const OPTIONAL_TABLE_CODES = new Set(["PGRST116", "PGRST200", "PGRST204", "PGRST205"]);
const STATUS_RANK = {
  not_started: 0,
  in_progress: 1,
  completed: 2,
};

export async function loadFounderAcademyProgress(serviceClient, userId) {
  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("id,email,name")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) throw createAdminApiError(404, "Founder not found");

  const [
    contentRows,
    categoryRows,
    currentProgressRows,
    legacyProgressRows,
    assessmentRows,
    attemptRows,
    archiveRows,
  ] = await Promise.all([
    loadRows(serviceClient, "academy_content", "*", { eq: ["status", "published"], orderBy: "priority", ascending: true }),
    loadRows(serviceClient, "academy_categories", "id,title,slug", { orderBy: "sort_order", ascending: true }),
    loadRows(serviceClient, "academy_user_content_progress", "*", { eq: ["user_id", userId] }),
    loadRows(serviceClient, "user_lesson_progress", "*", { eq: ["user_id", userId] }),
    loadRows(serviceClient, "lesson_assessments", "id,lesson_id,created_at", {}),
    loadRows(serviceClient, "assessment_attempts", "id,user_id,lesson_id,assessment_id,is_correct,attempted_at", { eq: ["user_id", userId], orderBy: "attempted_at", ascending: false }),
    loadRows(
      serviceClient,
      "daily_chat_summaries",
      "id,stage_id,summary_date,title,archive_source_type,archive_source_ref_id,archive_source_title,archive_source_metadata,created_at",
      { eq: ["user_id", userId], orderBy: "created_at", ascending: false }
    ),
  ]);

  const categoriesById = new Map(categoryRows.map((category) => [category.id, category]));
  const currentProgressByContentId = new Map(currentProgressRows.map((row) => [row.content_id, row]));
  const legacyProgressByContentId = new Map(legacyProgressRows.map((row) => [row.content_id, row]));
  const assessmentsByLessonId = groupBy(assessmentRows, "lesson_id");
  const attemptsByLessonId = groupBy(attemptRows, "lesson_id");
  const archivesByContentId = groupArchivesByContentId(archiveRows);

  const lessons = contentRows
    .filter((content) => content?.id)
    .map((content) => {
      const currentProgress = currentProgressByContentId.get(content.id) || null;
      const legacyProgress = legacyProgressByContentId.get(content.id) || null;
      const assessmentSummary = summarizeAssessments(
        assessmentsByLessonId.get(content.id) || [],
        attemptsByLessonId.get(content.id) || []
      );
      const stageId = normalizeStageId(content);
      const category = content.category_id ? categoriesById.get(content.category_id) : null;

      return {
        content_id: content.id,
        lesson_id: content.id,
        lesson_title: content.title || "Untitled lesson",
        topic_title: category?.title || null,
        stage_id: stageId,
        lesson_type: content.content_type || null,
        category: category?.title || null,
        source_type: content.source_type || null,
        is_core: Boolean(content.is_core),
        current_progress_status: currentProgress?.status || null,
        legacy_progress_status: legacyProgress?.status || null,
        normalized_status: normalizeDisplayStatus(currentProgress, legacyProgress, assessmentSummary),
        completed_at: latestIso(currentProgress?.completed_at, legacyProgress?.completed_at),
        started_at: legacyProgress?.started_at || null,
        last_opened_at: currentProgress?.last_opened_at || null,
        last_forge_opened_at: currentProgress?.last_forge_opened_at || null,
        updated_at: latestIso(currentProgress?.updated_at, legacyProgress?.updated_at),
        assessment_attempt_count: assessmentSummary.attemptCount,
        assessment_question_count: assessmentSummary.assessmentCount,
        latest_assessment_score: assessmentSummary.latestScore,
        latest_assessment_status: assessmentSummary.latestStatus,
        latest_assessment_attempted_at: assessmentSummary.latestAttemptedAt,
        archive_references: archivesByContentId.get(content.id) || [],
      };
    })
    .sort((a, b) => {
      if (a.stage_id !== b.stage_id) return a.stage_id - b.stage_id;
      if (a.is_core !== b.is_core) return a.is_core ? -1 : 1;
      return a.lesson_title.localeCompare(b.lesson_title);
    });

  const groupedStages = [1, 2, 3, 4, 5, 6].map((stageId) => {
    const stageLessons = lessons.filter((lesson) => lesson.stage_id === stageId);
    return {
      stage_id: stageId,
      totals: buildTotals(stageLessons),
      lessons: stageLessons,
    };
  }).filter((stage) => stage.lessons.length > 0);

  return {
    user_id: userId,
    profile: {
      user_id: profile.id,
      email: profile.email || null,
      name: profile.name || null,
    },
    totals: buildTotals(lessons),
    stages: groupedStages,
  };
}

export async function repairFounderAcademyLessonProgress(serviceClient, input) {
  const now = new Date().toISOString();
  const { userId, contentId, status } = input;
  await assertFounderAndContentExist(serviceClient, userId, contentId);
  const beforeState = await loadLessonState(serviceClient, userId, contentId);

  const currentPayload = buildCurrentProgressPayload(userId, contentId, status, beforeState.current_progress, now);
  const legacyPayload = buildLegacyProgressPayload(userId, contentId, status, beforeState.legacy_progress, now);

  const [currentWrite, legacyWrite] = await Promise.all([
    upsertOptional(serviceClient, "academy_user_content_progress", currentPayload, "user_id,content_id"),
    upsertOptional(serviceClient, "user_lesson_progress", legacyPayload, "user_id,content_id"),
  ]);

  const afterState = await loadLessonState(serviceClient, userId, contentId);
  const normalizedLesson = await loadSingleAcademyLessonProgress(serviceClient, userId, contentId);

  return {
    beforeState,
    afterState: {
      ...afterState,
      current_write_skipped: currentWrite.skipped,
      legacy_write_skipped: legacyWrite.skipped,
    },
    lesson: normalizedLesson,
  };
}

export async function resetFounderAcademyAssessment(serviceClient, input) {
  const { userId, contentId } = input;
  await assertFounderAndContentExist(serviceClient, userId, contentId);
  const beforeState = await loadLessonState(serviceClient, userId, contentId);

  const { error } = await serviceClient
    .from("assessment_attempts")
    .delete()
    .eq("user_id", userId)
    .eq("lesson_id", contentId);
  if (isOptionalTableError(error)) {
    return {
      beforeState,
      afterState: {
        ...beforeState,
        assessment_attempts: [],
        assessment_summary: summarizeAssessments(beforeState.lesson_assessments || [], []),
        reset_skipped: true,
      },
    };
  }
  if (error) throw error;

  const afterState = await loadLessonState(serviceClient, userId, contentId);
  return {
    beforeState,
    afterState,
  };
}

export async function loadSingleAcademyLessonProgress(serviceClient, userId, contentId) {
  const full = await loadFounderAcademyProgress(serviceClient, userId);
  for (const stage of full.stages) {
    const lesson = stage.lessons.find((entry) => entry.content_id === contentId);
    if (lesson) return lesson;
  }
  throw createAdminApiError(404, "Academy lesson not found");
}

export async function loadLessonState(serviceClient, userId, contentId) {
  const [
    currentProgress,
    legacyProgress,
    lessonAssessments,
    assessmentAttempts,
  ] = await Promise.all([
    loadMaybeSingle(serviceClient, "academy_user_content_progress", "*", { user_id: userId, content_id: contentId }),
    loadMaybeSingle(serviceClient, "user_lesson_progress", "*", { user_id: userId, content_id: contentId }),
    loadRows(serviceClient, "lesson_assessments", "id,lesson_id,created_at", { eq: ["lesson_id", contentId] }),
    loadRows(serviceClient, "assessment_attempts", "id,user_id,lesson_id,assessment_id,is_correct,attempted_at", { eq: ["user_id", userId], orderBy: "attempted_at", ascending: false }),
  ]);
  const lessonAttempts = assessmentAttempts.filter((attempt) => attempt.lesson_id === contentId);

  return {
    current_progress: currentProgress,
    legacy_progress: legacyProgress,
    lesson_assessments: lessonAssessments,
    assessment_attempts: lessonAttempts,
    assessment_summary: summarizeAssessments(lessonAssessments, lessonAttempts),
  };
}

async function loadRows(serviceClient, table, select, options) {
  let query = serviceClient.from(table).select(select);
  if (options.eq) {
    query = query.eq(options.eq[0], options.eq[1]);
  }
  if (options.orderBy) {
    query = query.order(options.orderBy, { ascending: options.ascending ?? false });
  }

  const { data, error } = await query;
  if (isOptionalTableError(error)) return [];
  if (error) throw error;
  return data || [];
}

async function loadMaybeSingle(serviceClient, table, select, match) {
  let query = serviceClient.from(table).select(select);
  for (const [column, value] of Object.entries(match)) {
    query = query.eq(column, value);
  }

  const { data, error } = await query.maybeSingle();
  if (isOptionalTableError(error)) return null;
  if (error) throw error;
  return data || null;
}

async function assertFounderAndContentExist(serviceClient, userId, contentId) {
  const [founder, content] = await Promise.all([
    loadMaybeSingle(serviceClient, "profiles", "id", { id: userId }),
    loadMaybeSingle(serviceClient, "academy_content", "id,title,status", { id: contentId }),
  ]);

  if (!founder) throw createAdminApiError(404, "Founder not found");
  if (!content) throw createAdminApiError(404, "Academy content item not found");
}

async function upsertOptional(serviceClient, table, payload, onConflict) {
  const { data, error } = await serviceClient
    .from(table)
    .upsert(payload, { onConflict })
    .select()
    .maybeSingle();
  if (isOptionalTableError(error)) return { data: null, skipped: true };
  if (error) throw error;
  return { data: data || null, skipped: false };
}

function buildCurrentProgressPayload(userId, contentId, status, existing, now) {
  const completedAt = status === "completed"
    ? existing?.completed_at || now
    : null;
  const openedAt = status === "not_started"
    ? null
    : existing?.last_opened_at || now;

  return {
    user_id: userId,
    content_id: contentId,
    status,
    completed_at: completedAt,
    last_opened_at: openedAt,
    last_forge_opened_at: status === "not_started" ? null : existing?.last_forge_opened_at || null,
    updated_at: now,
  };
}

function buildLegacyProgressPayload(userId, contentId, status, existing, now) {
  return {
    user_id: userId,
    content_id: contentId,
    status,
    started_at: status === "not_started" ? null : existing?.started_at || now,
    completed_at: status === "completed" ? existing?.completed_at || now : null,
    knowledge_checked_at: status === "not_started" ? null : existing?.knowledge_checked_at || null,
    last_check_response: status === "not_started" ? null : existing?.last_check_response || null,
    last_check_feedback: status === "not_started" ? null : existing?.last_check_feedback || null,
    updated_at: now,
  };
}

function summarizeAssessments(assessments, attempts) {
  const latestByAssessment = new Map();
  const sortedAttempts = [...attempts].sort((a, b) => String(b.attempted_at || "").localeCompare(String(a.attempted_at || "")));
  for (const attempt of sortedAttempts) {
    if (!latestByAssessment.has(attempt.assessment_id)) {
      latestByAssessment.set(attempt.assessment_id, attempt);
    }
  }

  const latestAttempts = Array.from(latestByAssessment.values());
  const correctCount = latestAttempts.filter((attempt) => attempt.is_correct).length;
  const attemptedCount = latestAttempts.length;
  const assessmentCount = assessments.length;
  const requiredAttempts = Math.min(3, Math.max(assessmentCount, 0));
  const passed = attemptedCount >= requiredAttempts && attemptedCount > 0 && correctCount >= Math.min(2, requiredAttempts);
  const latestAttemptedAt = sortedAttempts[0]?.attempted_at || null;

  return {
    assessmentCount,
    attemptCount: attempts.length,
    latestAttemptedCount: attemptedCount,
    latestCorrectCount: correctCount,
    latestScore: attemptedCount > 0
      ? {
        correct: correctCount,
        attempted: attemptedCount,
        percent: Math.round((correctCount / attemptedCount) * 100),
      }
      : null,
    latestStatus: passed ? "passed" : attemptedCount > 0 ? "in_progress" : "not_started",
    latestAttemptedAt,
  };
}

function normalizeDisplayStatus(currentProgress, legacyProgress, assessmentSummary) {
  const status = strongestStatus(currentProgress?.status, legacyProgress?.status);
  const hasCompletionDate = Boolean(currentProgress?.completed_at || legacyProgress?.completed_at);
  if ((status === "completed" || hasCompletionDate) && assessmentSummary.latestStatus === "passed") return "completed";
  if (status === "completed" || hasCompletionDate) return "completed_pending_assessment";
  if (status === "in_progress" || currentProgress?.last_opened_at || legacyProgress?.started_at || assessmentSummary.attemptCount > 0) return "in_progress";
  return "not_started";
}

function strongestStatus(...statuses) {
  return statuses
    .filter(Boolean)
    .sort((a, b) => (STATUS_RANK[b] ?? 0) - (STATUS_RANK[a] ?? 0))[0] || "not_started";
}

function buildTotals(lessons) {
  return {
    total: lessons.length,
    completed: lessons.filter((lesson) => lesson.normalized_status === "completed").length,
    completed_pending_assessment: lessons.filter((lesson) => lesson.normalized_status === "completed_pending_assessment").length,
    in_progress: lessons.filter((lesson) => lesson.normalized_status === "in_progress").length,
    not_started: lessons.filter((lesson) => lesson.normalized_status === "not_started").length,
    assessment_passed: lessons.filter((lesson) => lesson.latest_assessment_status === "passed").length,
    assessment_attempts: lessons.reduce((sum, lesson) => sum + (lesson.assessment_attempt_count || 0), 0),
  };
}

function normalizeStageId(content) {
  if (Number.isInteger(content.path_stage) && content.path_stage >= 1 && content.path_stage <= 6) return content.path_stage;
  if (Array.isArray(content.stage_ids)) {
    const stageId = content.stage_ids.find((value) => Number.isInteger(value) && value >= 1 && value <= 6);
    if (stageId) return stageId;
  }
  return 1;
}

function groupArchivesByContentId(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const sourceRefId = row.archive_source_ref_id || "";
    if (!sourceRefId || row.archive_source_type !== "academy") continue;
    const current = grouped.get(sourceRefId) || [];
    current.push({
      id: row.id,
      title: row.title || row.archive_source_title || null,
      summary_date: row.summary_date || null,
      stage_id: row.stage_id || null,
      archive_source_type: row.archive_source_type || null,
      archive_source_ref_id: row.archive_source_ref_id || null,
      archive_source_title: row.archive_source_title || null,
      archive_source_metadata: row.archive_source_metadata || {},
      created_at: row.created_at || null,
    });
    grouped.set(sourceRefId, current.slice(0, 3));
  }
  return grouped;
}

function groupBy(rows, key) {
  const grouped = new Map();
  for (const row of rows) {
    const groupKey = row?.[key];
    if (!groupKey) continue;
    const current = grouped.get(groupKey) || [];
    current.push(row);
    grouped.set(groupKey, current);
  }
  return grouped;
}

function latestIso(...values) {
  return values
    .filter(Boolean)
    .sort((a, b) => String(b).localeCompare(String(a)))[0] || null;
}

function isOptionalTableError(error) {
  if (!error) return false;
  const message = String(error.message || "");
  return OPTIONAL_TABLE_CODES.has(error.code) || /could not find|does not exist|schema cache/i.test(message);
}
