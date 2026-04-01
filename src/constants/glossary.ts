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
    1: "#F5A843",
    2: "#63B3ED",
    3: "#9F7AEA",
    4: "#48BB78",
    5: "#E8622A",
    6: "#F5A843",
} as const;