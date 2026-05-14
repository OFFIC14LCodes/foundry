export type VentureMode = "business" | "side_hustle" | "side_hustle_to_full_time" | "exploring";

export const DEFAULT_VENTURE_MODE: VentureMode = "business";

export const VENTURE_MODE_LABELS: Record<VentureMode, string> = {
    business: "Build a Business",
    side_hustle: "Grow a Side Hustle",
    side_hustle_to_full_time: "Make It Full Time",
    exploring: "Explore an Idea",
};

export function normalizeVentureMode(value: unknown): VentureMode {
    if (value === "side_hustle" || value === "side_hustle_to_full_time" || value === "exploring" || value === "business") {
        return value;
    }
    return DEFAULT_VENTURE_MODE;
}

export function isSideHustleMode(profile?: { ventureMode?: unknown } | null) {
    const mode = normalizeVentureMode(profile?.ventureMode);
    return mode === "side_hustle" || mode === "side_hustle_to_full_time";
}

export function getVentureModeLabel(profile?: { ventureMode?: unknown } | null) {
    return VENTURE_MODE_LABELS[normalizeVentureMode(profile?.ventureMode)];
}

export function getVentureNoun(profile?: { ventureMode?: unknown } | null) {
    const mode = normalizeVentureMode(profile?.ventureMode);
    if (mode === "side_hustle") return "side hustle";
    if (mode === "side_hustle_to_full_time") return "side hustle-to-full-time path";
    if (mode === "exploring") return "idea";
    return "business";
}

export function getBuilderNoun(profile?: { ventureMode?: unknown } | null) {
    const mode = normalizeVentureMode(profile?.ventureMode);
    if (mode === "business") return "founder";
    if (mode === "side_hustle_to_full_time") return "builder";
    if (mode === "side_hustle") return "operator";
    return "builder";
}

export function buildVentureModeContext(profile?: any) {
    const mode = normalizeVentureMode(profile?.ventureMode);
    const label = VENTURE_MODE_LABELS[mode];
    const goal = profile?.ventureGoal || profile?.sideHustleGoal || "not specified";
    const noun = getVentureNoun(profile);

    const rules = mode === "business"
        ? [
            "The user is building or formalizing a business. Standard founder language is appropriate.",
            "Still avoid unnecessary complexity before the stage requires it.",
        ]
        : mode === "side_hustle"
            ? [
                "The user may want durable extra income, not a company. Do not assume they need to form an entity, hire, raise money, or quit their job.",
                "Optimize for small paid offers, time constraints, profit per hour, simple operations, and low-risk validation.",
                "Use language like side hustle, offer, buyers, clients, project, income stream, and operator when it fits.",
            ]
            : mode === "side_hustle_to_full_time"
                ? [
                    "The user wants to test whether this side hustle can become their main work. Balance ambition with job-income safety.",
                    "Track replacement income, consistency, runway, weekly hours, repeatability, and the decision point for going full time.",
                    "Do not push them to quit early. Help them earn proof before risk increases.",
                ]
                : [
                    "The user is exploring. Do not force a company identity too early.",
                    "Help them clarify a monetizable problem, offer, audience, skill, or project before formal business mechanics.",
                ];

    return `VENTURE MODE:
Mode: ${label}
Primary thing being built: ${noun}
Goal / constraints: ${goal}

How Forge should adapt:
${rules.map((rule) => `- ${rule}`).join("\n")}`;
}
