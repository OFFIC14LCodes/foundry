import { supabase } from "../supabase";

export type GlossaryTerm = {
    id: string;
    term: string;
    definition: string;
    usage_example: string;
    category: string;
    stage_unlock: number;
    lesson_unlock: string | null;
    related_term_ids: string[];
    created_at: string;
    updated_at: string;
};

export async function loadGlossaryTerms(stageUnlock: number): Promise<GlossaryTerm[]> {
    const { data, error } = await supabase
        .from("glossary_terms")
        .select("*")
        .lte("stage_unlock", stageUnlock)
        .order("stage_unlock", { ascending: true })
        .order("term", { ascending: true });

    if (error) throw error;
    return (data as GlossaryTerm[]) ?? [];
}
