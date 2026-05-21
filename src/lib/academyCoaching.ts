import type { AcademyTopicLaunch } from "./academy";
import type { AcademyUnderstandingLevel, KnowledgeCheckEvaluation } from "./academyCompletion";

type AcademyCoachingMessage = {
    role: "user" | "forge";
    text: string;
};

export type AcademyCoachingSignals = {
    localLevel: AcademyUnderstandingLevel;
    frustrationDetected: boolean;
    repeatedDrillDetected: boolean;
    demonstratedSignals: string[];
    shouldSynthesize: boolean;
    shouldComplete: boolean;
};

const COMPLETE_MARKER_PATTERN = /\[COMPLETE(?::\s*[\w-]+)?\]/i;

const FRUSTRATION_PATTERNS = [
    /\bi already answered\b/i,
    /\byou can tell i understand\b/i,
    /\bthat'?s what i said\b/i,
    /\byou keep asking\b/i,
    /\bsame (thing|question)\b/i,
    /\bi explained both\b/i,
    /\bwhere .* wrong\b/i,
    /\bquote .* correct/i,
    /\bquote .* wrong/i,
];

const MASTERY_CLOSURE_PATTERNS = [
    COMPLETE_MARKER_PATTERN,
    /\b(that'?s|that is) the complete concept\b/i,
    /\byou got it\b/i,
    /\bwell done\b/i,
    /\byou understand (the|this) (framework|concept|lesson)\b/i,
    /\bthat'?s mastery\b/i,
    /\bthat'?s the infrastructure frame\b/i,
    /\bthat'?s a valid infrastructure framing\b/i,
    /\bperfect\b/i,
];

const STOP_WORDS = new Set([
    "the", "and", "that", "this", "with", "you", "your", "for", "are", "what", "why", "how",
    "when", "where", "they", "them", "then", "into", "from", "about", "have", "has", "was",
    "were", "will", "would", "could", "should", "does", "did", "not", "but", "just", "still",
    "founder", "founders", "business", "lesson", "concept", "explain", "tell",
]);

function normalize(text: string) {
    return text.toLowerCase().replace(/[^\w\s']/g, " ").replace(/\s+/g, " ").trim();
}

function tokenizeQuestion(text: string) {
    return normalize(text)
        .split(" ")
        .map((word) => word.replace(/'s$/, ""))
        .filter((word) => word.length > 3 && !STOP_WORDS.has(word));
}

function hasAny(text: string, patterns: RegExp[]) {
    return patterns.some((pattern) => pattern.test(text));
}

function countMatches(text: string, patterns: RegExp[]) {
    return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

export function detectAcademyFrustration(text: string) {
    return FRUSTRATION_PATTERNS.some((pattern) => pattern.test(text));
}

export function detectAcademyMasteryClosure(text: string) {
    return MASTERY_CLOSURE_PATTERNS.some((pattern) => pattern.test(text));
}

export function detectRepeatedAcademyDrill(messages: AcademyCoachingMessage[]) {
    const assistantQuestions = messages
        .filter((message) => message.role === "forge" && /\?/.test(message.text))
        .slice(-3)
        .map((message) => tokenizeQuestion(message.text));

    if (assistantQuestions.length < 2) return false;

    for (let i = 0; i < assistantQuestions.length; i += 1) {
        for (let j = i + 1; j < assistantQuestions.length; j += 1) {
            const a = new Set(assistantQuestions[i]);
            const b = new Set(assistantQuestions[j]);
            if (a.size < 4 || b.size < 4) continue;
            const shared = [...a].filter((word) => b.has(word)).length;
            const similarity = shared / Math.min(a.size, b.size);
            if (similarity >= 0.48 || shared >= 5) return true;
        }
    }

    return false;
}

export function classifyAcademyAnswerLocally(answer: string, entry?: AcademyTopicLaunch | null): {
    level: AcademyUnderstandingLevel;
    demonstratedSignals: string[];
} {
    const text = normalize(`${entry?.title ?? ""} ${entry?.learningGoal ?? ""} ${entry?.knowledgeCheckPrompt ?? ""} ${answer}`);
    const answerOnly = normalize(answer);

    const mechanismCount = countMatches(answerOnly, [
        /\b(system|systems|infrastructure|process|routine|operating system|workflow|structure)\b/,
        /\b(automat(e|ed|ion|ically)|default|pre[-\s]?decid(e|ed)|front[-\s]?load|planned? ahead)\b/,
        /\b(decision|decisions|mental load|bandwidth|capacity|willpower|motivation)\b/,
        /\b(consisten(t|cy)|repeatable|recurring|schedule|cadence)\b/,
    ]);
    const businessCount = countMatches(answerOnly, [
        /\b(business|company|customers?|market|pricing|sales|revenue|marketing|product|strategy|tekori|foundry)\b/,
        /\b(operational|operations|execution|risk|dependency|depends? on|founder[-\s]?dependent)\b/,
        /\b(skipped|breaks? down|quality|decision quality|important work|strategic)\b/,
    ]);
    const applicationCount = countMatches(answerOnly, [
        /\b(i would|i can|i will|my|our|we would|we can|for me|in my business|at tekori|inside tekori)\b/,
        /\b(example|like|such as|sunday|weekly|noon|marketing|content|calls?|emails?)\b/,
    ]);
    const personalOnly = hasAny(answerOnly, [
        /\b(energy|sleep|workout|exercise|caffeine|mood|discipline|productive|productivity)\b/,
    ]) && businessCount === 0;
    const distinguishesPersonalAndBusiness = hasAny(answerOnly, [
        /\b(not just|rather than|instead of|more than|not only)\b.*\b(personal|energy|mood|discipline|productivity)\b/,
        /\b(personal|energy|mood|discipline|productivity)\b.*\b(business|operational|infrastructure|risk|dependency)\b/,
    ]);

    const demonstratedSignals = [
        mechanismCount > 0 ? "Explains a mechanism for reducing repeated decisions or systemizing behavior." : null,
        businessCount > 0 ? "Connects the concept to business execution, risk, consistency, or founder dependency." : null,
        applicationCount > 0 ? "Applies the lesson to a concrete company or founder workflow." : null,
        distinguishesPersonalAndBusiness ? "Distinguishes personal productivity from business infrastructure." : null,
    ].filter(Boolean) as string[];

    const isHabitInfrastructureLesson = /\b(habit|behavior|behaviour|infrastructure|decision fatigue|routine)\b/.test(text);

    if (personalOnly && isHabitInfrastructureLesson) {
        return { level: "partially_correct", demonstratedSignals };
    }
    if ((mechanismCount >= 2 && businessCount >= 1 && applicationCount >= 1) || (businessCount >= 2 && distinguishesPersonalAndBusiness)) {
        return { level: "fully_correct", demonstratedSignals };
    }
    if ((mechanismCount >= 2 && businessCount >= 1) || (mechanismCount >= 1 && businessCount >= 1 && applicationCount >= 1)) {
        return { level: "mostly_correct", demonstratedSignals };
    }
    if (mechanismCount >= 1 || businessCount >= 1 || applicationCount >= 1) {
        return { level: "partially_correct", demonstratedSignals };
    }
    return { level: "incorrect", demonstratedSignals };
}

export function getAcademyCoachingSignals(
    entry: AcademyTopicLaunch,
    answer: string,
    messages: AcademyCoachingMessage[],
    evaluation?: KnowledgeCheckEvaluation,
): AcademyCoachingSignals {
    const local = classifyAcademyAnswerLocally(answer, entry);
    const frustrationDetected = detectAcademyFrustration(answer);
    const repeatedDrillDetected = detectRepeatedAcademyDrill(messages);
    const evaluatorLevel = evaluation?.understandingLevel ?? "incorrect";
    const strongestLevel = chooseStrongerLevel(local.level, evaluatorLevel);
    const enoughByEvaluation = evaluation?.passed || evaluation?.trackStatus === "passed";
    const mostlyOrBetter = strongestLevel === "mostly_correct" || strongestLevel === "fully_correct";
    const shouldComplete = Boolean(
        enoughByEvaluation
        || strongestLevel === "fully_correct"
        || (mostlyOrBetter && (frustrationDetected || repeatedDrillDetected || evaluation?.trackStatus === "on_track"))
        || (evaluation?.trackStatus === "on_track" && (evaluation.missingUnderstanding?.length ?? 0) <= 1 && local.level !== "incorrect")
    );

    return {
        localLevel: strongestLevel,
        frustrationDetected,
        repeatedDrillDetected,
        demonstratedSignals: [
            ...local.demonstratedSignals,
            ...(evaluation?.demonstratedUnderstanding ?? []),
        ].filter((item, index, array) => array.indexOf(item) === index).slice(0, 6),
        shouldSynthesize: shouldComplete || strongestLevel === "mostly_correct" || frustrationDetected || repeatedDrillDetected,
        shouldComplete,
    };
}

export function formatAcademyCoachingPolicy(signals?: AcademyCoachingSignals) {
    const dynamicContext = signals
        ? [
            `Local understanding classification: ${signals.localLevel}.`,
            signals.frustrationDetected ? "Frustration/pushback detected: acknowledge the founder's point and do not double down." : null,
            signals.repeatedDrillDetected ? "Repeated drilling detected: do not ask substantially the same conceptual question again." : null,
            signals.shouldSynthesize ? "Use synthesis mode: summarize what they got, refine the missing distinction directly, then move forward or ask one concrete application question." : null,
            signals.demonstratedSignals.length ? `Recognized evidence: ${signals.demonstratedSignals.join("; ")}` : null,
        ].filter(Boolean).join("\n")
        : "No local signal context supplied.";

    return `Academy coaching policy:
- Before challenging again, recognize demonstrated understanding.
- Classify the answer internally as incorrect, partially correct, mostly correct, or fully correct.
- Incorrect: explain the misconception and ask one simpler guided question.
- Partially correct: say what is right first, identify the missing piece, ask one focused follow-up.
- Mostly correct: acknowledge understanding, sharpen the language, and shift to application or synthesis.
- Fully correct: confirm mastery and advance.
- Do not reject an answer only because it includes personal productivity language; if it also explains business systems, operational risk, consistency, or founder dependency, treat that as valid understanding.
- Avoid repeated negative phrasing like "You're still..." or "You're missing...". Prefer "You've got the first half," "The refinement is," "The sharper business version is," or "That example works because."
- If Navi has already asked the same conceptual question twice, stop drilling. Summarize the correct concept, state the missing distinction directly if needed, and either move forward or ask one concrete application question.

${dynamicContext}`;
}

function chooseStrongerLevel(a: AcademyUnderstandingLevel, b: AcademyUnderstandingLevel): AcademyUnderstandingLevel {
    const order: Record<AcademyUnderstandingLevel, number> = {
        incorrect: 0,
        partially_correct: 1,
        mostly_correct: 2,
        fully_correct: 3,
    };
    return order[a] >= order[b] ? a : b;
}
