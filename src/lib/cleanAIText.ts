/**
 * Strip AI formatting artifacts before rendering:
 * - [TERM]...[/TERM] wrappers → inner text only (glossary highlighting handles styling)
 * - Code fence delimiters (```json, ```, etc.) → removed, content kept
 */
export function cleanAIText(text: string): string {
    return text
        // Strip [TERM]...[/TERM] tags, preserving the term text inside
        .replace(/\[TERM\]([\s\S]*?)\[\/TERM\]/g, "$1")
        // Strip code fence lines (```lang or bare ```) — keep content between them
        .replace(/^```[a-zA-Z0-9]*[ \t]*$/gm, "")
        // Collapse any triple+ blank lines left behind into a single blank line
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
