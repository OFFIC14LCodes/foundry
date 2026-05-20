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
    1: "#E4AA3A",
    2: "#8EA0B5",
    3: "#C98924",
    4: "#2F8F68",
    5: "#C98924",
    6: "#E4AA3A",
} as const;
