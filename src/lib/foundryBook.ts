import {
  FOUNDRY_BOOK_SECTIONS,
  type FoundryBookParagraph,
  type FoundryBookSection,
} from "../data/foundryBookSections";

export type FoundryBookCitation = {
  id: string;
  source_title: string;
  source_version: string;
  source_edition: string;
  stage_id: number;
  stage_label: string;
  chapter_name: string;
  section_name: string;
  page_start: number | null;
  page_end: number | null;
  paragraph_start: number | null;
  paragraph_end: number | null;
};

export type RetrievedBookSection = {
  section: FoundryBookSection;
  excerpt: string;
  score: number;
  citation: FoundryBookCitation;
};

export type FoundryBookContextPackage = {
  context: string;
  matches: RetrievedBookSection[];
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "so",
  "that",
  "the",
  "their",
  "them",
  "they",
  "this",
  "to",
  "we",
  "what",
  "when",
  "why",
  "with",
  "you",
  "your",
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return Array.from(
    new Set(
      normalize(text)
        .split(" ")
        .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
    )
  );
}

function scoreOccurrences(haystack: string, token: string): number {
  if (!haystack.includes(token)) return 0;
  let count = 0;
  let index = haystack.indexOf(token);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(token, index + token.length);
  }
  return count;
}

function scoreSection(section: FoundryBookSection, query: string, tokens: string[]): number {
  const title = normalize(section.section_name);
  const chapter = normalize(section.chapter_name);
  const content = normalize(section.content);
  let score = 0;

  if (query && title.includes(query)) score += 30;
  if (query && chapter.includes(query)) score += 18;
  if (query && content.includes(query)) score += 10;

  for (const token of tokens) {
    score += scoreOccurrences(title, token) * 8;
    score += scoreOccurrences(chapter, token) * 6;
    score += Math.min(scoreOccurrences(content, token), 6) * 2;
  }

  return score;
}

function toCitation(
  section: FoundryBookSection,
  paragraphs?: FoundryBookParagraph[]
): FoundryBookCitation {
  const firstParagraph = paragraphs?.[0];
  const lastParagraph = paragraphs?.[paragraphs.length - 1];

  return {
    id: section.id,
    source_title: section.source_title,
    source_version: section.source_version,
    source_edition: section.source_edition,
    stage_id: section.stage_id,
    stage_label: section.stage_label,
    chapter_name: section.chapter_name,
    section_name: section.section_name,
    page_start: firstParagraph?.page ?? section.page_start,
    page_end: lastParagraph?.page ?? section.page_end,
    paragraph_start: firstParagraph?.paragraph_number ?? section.paragraph_start,
    paragraph_end: lastParagraph?.paragraph_number ?? section.paragraph_end,
  };
}

function selectExcerptParagraphs(
  section: FoundryBookSection,
  tokens: string[],
  maxChars = 1600
): FoundryBookParagraph[] {
  const paragraphs = section.paragraphs.filter((paragraph) => paragraph.content.trim().length > 0);
  if (paragraphs.length === 0) return [];

  let bestIndex = 0;
  let bestScore = -1;

  paragraphs.forEach((paragraph, index) => {
    const normalized = normalize(paragraph.content);
    const score = tokens.reduce((sum, token) => sum + scoreOccurrences(normalized, token), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  const start = bestScore > 0 ? Math.max(0, bestIndex - 1) : 0;
  const selected: FoundryBookParagraph[] = [];
  let length = 0;

  for (let index = start; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    const nextLength = length + paragraph.content.length + (selected.length > 0 ? 2 : 0);
    if (selected.length > 0 && nextLength > maxChars) break;
    selected.push(paragraph);
    length = nextLength;
    if (selected.length >= 3) break;
  }

  return selected;
}

function buildExcerpt(paragraphs: FoundryBookParagraph[]): string {
  return paragraphs.map((paragraph) => paragraph.content.trim()).join("\n\n").trim();
}

function formatPageRange(pageStart: number | null, pageEnd: number | null): string | null {
  if (pageStart == null) return null;
  if (pageEnd == null || pageEnd === pageStart) return `p. ${pageStart}`;
  return `pp. ${pageStart}-${pageEnd}`;
}

function formatParagraphRange(paragraphStart: number | null, paragraphEnd: number | null): string | null {
  if (paragraphStart == null) return null;
  if (paragraphEnd == null || paragraphEnd === paragraphStart) return `¶${paragraphStart}`;
  return `¶${paragraphStart}-${paragraphEnd}`;
}

export function formatFoundryCitation(citation: FoundryBookCitation): string {
  const parts = [`${citation.source_title} — "${citation.section_name}"`];
  const pagePart = formatPageRange(citation.page_start, citation.page_end);
  const paragraphPart = formatParagraphRange(citation.paragraph_start, citation.paragraph_end);

  if (pagePart) parts.push(pagePart);
  if (paragraphPart) parts.push(paragraphPart);

  return parts.join(", ");
}

function buildContextCitationLine(citation: FoundryBookCitation): string[] {
  const lines = [
    `Citation ID: ${citation.id}`,
    `Stage ${citation.stage_id} — ${citation.stage_label}`,
    `Chapter: ${citation.chapter_name}`,
    `Section: ${citation.section_name}`,
  ];

  if (citation.page_start != null) {
    lines.push(
      citation.page_end != null && citation.page_end !== citation.page_start
        ? `Pages: ${citation.page_start}-${citation.page_end}`
        : `Page: ${citation.page_start}`
    );
  }

  if (citation.paragraph_start != null) {
    lines.push(
      citation.paragraph_end != null && citation.paragraph_end !== citation.paragraph_start
        ? `Paragraphs: ${citation.paragraph_start}-${citation.paragraph_end}`
        : `Paragraph: ${citation.paragraph_start}`
    );
  }

  return lines;
}

function parseBookUsageIds(text: string): string[] {
  const match = text.match(/\[BOOK_USED:\s*([^\]]+)\]/i);
  if (!match) return [];

  return match[1]
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function applyFoundryBookCitations(
  text: string,
  matches: RetrievedBookSection[]
): { cleanText: string; usedCitations: FoundryBookCitation[] } {
  const allowed = new Map(matches.map((match) => [match.citation.id, match.citation]));
  const usedIds = parseBookUsageIds(text);
  const cleanText = text.replace(/\[BOOK_USED:\s*[^\]]+\]/gi, "").trim();

  const usedCitations = usedIds
    .map((id) => allowed.get(id))
    .filter((citation): citation is FoundryBookCitation => Boolean(citation));

  if (usedCitations.length === 0) {
    return { cleanText, usedCitations: [] };
  }

  const uniqueCitations = Array.from(
    new Map(usedCitations.map((citation) => [citation.id, citation])).values()
  );

  const sourceLabel = uniqueCitations.length === 1 ? "Source" : "Sources";
  const sourceLine = `${sourceLabel}: ${uniqueCitations
    .map((citation) => formatFoundryCitation(citation))
    .join("; ")}`;

  return {
    cleanText: cleanText ? `${cleanText}\n\n${sourceLine}` : sourceLine,
    usedCitations: uniqueCitations,
  };
}

export function getRelevantFoundryBookSections(
  stageId: number,
  inputs: string[],
  limit = 3
): RetrievedBookSection[] {
  const query = normalize(inputs.filter(Boolean).join(" "));
  const tokens = tokenize(query);
  const stageSections = FOUNDRY_BOOK_SECTIONS.filter((section) => section.stage_id === stageId);

  const scored = stageSections
    .map((section) => {
      const excerptParagraphs = selectExcerptParagraphs(section, tokens);
      return {
        section,
        excerpt: buildExcerpt(excerptParagraphs),
        score: scoreSection(section, query, tokens),
        citation: toCitation(section, excerptParagraphs),
      };
    })
    .sort((a, b) => b.score - a.score);

  const matches = scored.filter((item) => item.score > 0).slice(0, limit);
  if (matches.length > 0) return matches;

  return scored.slice(0, 1);
}

export function buildFoundryBookContext(
  stageId: number,
  inputs: string[],
  limit = 3
): FoundryBookContextPackage {
  const matches = getRelevantFoundryBookSections(stageId, inputs, limit);
  if (matches.length === 0) return { context: "", matches: [] };

  const body = matches
    .map(
      ({ excerpt, citation }) =>
        `${buildContextCitationLine(citation).join("\n")}\nExcerpt:\n${excerpt}`
    )
    .join("\n\n---\n\n");

  return {
    context: `[BOOK_CONTEXT]
Use this as background teaching context for the current reply. These are the most relevant book excerpts for this message.
This source uses a locked text snapshot with stable section and paragraph numbering. Page citations are only allowed when a page number is explicitly shown below.
Only cite locations that appear here. If you materially use this book context, append [BOOK_USED: citation_id, citation_id] at the very end of your response using only Citation IDs shown here. Never invent a citation ID, page number, or paragraph number.

${body}
[/BOOK_CONTEXT]`,
    matches,
  };
}
