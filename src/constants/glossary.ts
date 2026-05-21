export const GLOSSARY: Record<
    string,
    {
        definition: string;
        why: string;
        example: string;
        resource: string;
        stage: number;
        color: string;
    }
> = {
    // paste your full glossary object exactly here
};

export const AUTO_DETECT_TERMS = new Set(Object.keys(GLOSSARY));

export const STAGE_COLORS = {
    1: "var(--tekori-gold)",
    2: "var(--tekori-slate)",
    3: "var(--tekori-midnight)",
    4: "var(--tekori-sage)",
    5: "var(--tekori-gold)",
    6: "var(--tekori-amber-light)",
} as const;
