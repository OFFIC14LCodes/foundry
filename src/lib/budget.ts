import { BUDGET_CARDS } from "../constants/onboarding";

export function parseBudgetInput(value: string): number | null {
    const normalized = value.replace(/[$,\s]/g, "").trim();
    if (!normalized) return null;

    const amount = Number(normalized);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    return Math.round(amount);
}

export function formatCurrency(amount: number | null | undefined): string {
    const value = Number(amount ?? 0);
    return `$${value.toLocaleString()}`;
}

export function getBudgetCardById(cardId: string | null | undefined) {
    return BUDGET_CARDS.find((card) => card.id === cardId) ?? null;
}

export function getFallbackBudgetAmount(cardId: string | null | undefined): number {
    return getBudgetCardById(cardId)?.fallbackAmount ?? 1000;
}

export function getBudgetRangeLabel(cardId: string | null | undefined): string {
    return getBudgetCardById(cardId)?.label ?? "";
}
