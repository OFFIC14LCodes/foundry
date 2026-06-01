import assert from "node:assert/strict";

import {
    buildAcademyCompletionEventKey,
    buildAcademyCompletionOverrideState,
    getAcademyCompletionRetryDelay,
    isAcademyCompletionVerified,
    persistAcademyCompletionWithRetry,
} from "../src/lib/academyCompletionRetry.ts";

async function run() {
    await testSuccessfulCompletion();
    await testTemporaryFailureRetry();
    testRefreshAfterCompletion();
    testArchiveAfterCompletion();
    testNavigationAwayAfterCompletion();
    await testDuplicateCompletionAttempts();
    testRetryBackoff();
    testDeterministicEventKeys();
    console.log("academy completion tests: ok");
}

async function testSuccessfulCompletion() {
    let persistCalls = 0;
    let verifyCalls = 0;

    const result = await persistAcademyCompletionWithRetry({
        lessonId: "lesson-1",
        userId: "user-1",
        masteryResult: "passed",
        persistOnce: async () => {
            persistCalls += 1;
            return { ok: true };
        },
        verifyOnce: async () => {
            verifyCalls += 1;
            return {
                contentProgressCompleted: true,
                lessonProgressCompleted: true,
            };
        },
    });

    assert.equal(persistCalls, 1, "successful completion should persist once");
    assert.equal(verifyCalls, 1, "successful completion should verify once");
    assert.equal(result.attempts, 1, "successful completion should finish on first attempt");
    assert.equal(result.eventKey, "academy-complete:user-1:lesson-1");
}

async function testTemporaryFailureRetry() {
    let persistCalls = 0;

    const result = await persistAcademyCompletionWithRetry({
        lessonId: "lesson-2",
        userId: "user-2",
        masteryResult: "passed",
        options: {
            maxAttempts: 3,
            baseDelayMs: 1,
        },
        persistOnce: async () => {
            persistCalls += 1;
            if (persistCalls === 1) {
                throw new Error("fetch failed");
            }
            return { ok: true };
        },
        verifyOnce: async () => ({
            contentProgressCompleted: true,
            lessonProgressCompleted: true,
        }),
    });

    assert.equal(persistCalls, 2, "temporary DB failure should retry");
    assert.equal(result.attempts, 2, "temporary DB failure should succeed on retry");
}

function testRefreshAfterCompletion() {
    const completedAt = "2026-06-01T12:00:00.000Z";
    const override = buildAcademyCompletionOverrideState({
        userId: "user-3",
        contentId: "lesson-3",
        completedAt,
        updatedAt: completedAt,
    });

    assert.equal(override.status, "completed", "refresh should rebuild a completed override");
    assert.equal(override.completedAt, completedAt);
    assert.equal(override.lastOpenedAt, completedAt);
}

function testArchiveAfterCompletion() {
    const override = buildAcademyCompletionOverrideState({
        userId: "user-4",
        contentId: "lesson-4",
        completedAt: "2026-06-01T12:00:00.000Z",
        lastCheckResponse: "I explained the lesson clearly.",
    });

    assert.equal(override.status, "completed", "archive should preserve completed status");
    assert.equal(override.lastCheckResponse, "I explained the lesson clearly.");
}

function testNavigationAwayAfterCompletion() {
    assert.equal(isAcademyCompletionVerified({
        contentProgressCompleted: true,
        lessonProgressCompleted: true,
        contentProgressUpdatedAt: "2026-06-01T12:00:00.000Z",
        lessonProgressUpdatedAt: "2026-06-01T12:00:00.000Z",
    }), true, "navigation away should rely on verified persisted completion");
}

async function testDuplicateCompletionAttempts() {
    const seenEventKeys = new Set<string>();
    let historyInsertions = 0;

    const runCompletion = async () => persistAcademyCompletionWithRetry({
        lessonId: "lesson-5",
        userId: "user-5",
        masteryResult: "passed",
        persistOnce: async (_attempt, eventKey) => {
            if (!seenEventKeys.has(eventKey)) {
                seenEventKeys.add(eventKey);
                historyInsertions += 1;
            }
            return { eventKey };
        },
        verifyOnce: async () => ({
            contentProgressCompleted: true,
            lessonProgressCompleted: true,
        }),
    });

    const first = await runCompletion();
    const second = await runCompletion();

    assert.equal(first.eventKey, second.eventKey, "duplicate completion attempts should reuse the same idempotency key");
    assert.equal(historyInsertions, 1, "duplicate completion attempts should not duplicate history insertions");
}

function testRetryBackoff() {
    assert.equal(getAcademyCompletionRetryDelay(1, 300), 300);
    assert.equal(getAcademyCompletionRetryDelay(2, 300), 600);
    assert.equal(getAcademyCompletionRetryDelay(3, 300), 1200);
    assert.equal(getAcademyCompletionRetryDelay(10, 300), 4000);
}

function testDeterministicEventKeys() {
    assert.equal(
        buildAcademyCompletionEventKey("user-6", "lesson-6"),
        buildAcademyCompletionEventKey("user-6", "lesson-6"),
    );
}

void run().catch((error) => {
    console.error("academy completion tests: failed");
    console.error(error);
    process.exitCode = 1;
});
