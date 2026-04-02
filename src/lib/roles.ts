export type UserRole = "user" | "admin" | "owner";

export const OWNER_EMAIL = "foundryandforge.app@gmail.com";

export function normalizeEmail(email: string | null | undefined): string {
    return (email ?? "").trim().toLowerCase();
}

export function normalizeUserRole(role: string | null | undefined): UserRole {
    if (role === "admin" || role === "owner") return role;
    return "user";
}

export function hasAdminAccess(role: string | null | undefined): boolean {
    const normalized = normalizeUserRole(role);
    return normalized === "admin" || normalized === "owner";
}

export function isOwnerRole(role: string | null | undefined): boolean {
    return normalizeUserRole(role) === "owner";
}

export function roleLabel(role: string | null | undefined): string {
    const normalized = normalizeUserRole(role);
    if (normalized === "owner") return "Owner";
    if (normalized === "admin") return "Admin";
    return "User";
}

export function isOwnerEmail(email: string | null | undefined): boolean {
    return normalizeEmail(email) === OWNER_EMAIL;
}

export function hasAdminHubAccess(input: {
    role?: string | null;
    profileEmail?: string | null;
    authEmail?: string | null;
} | null | undefined): boolean {
    if (!input) return false;
    if (hasAdminAccess(input.role)) return true;

    const profileEmail = normalizeEmail(input.profileEmail);
    const authEmail = normalizeEmail(input.authEmail);

    return profileEmail === OWNER_EMAIL || authEmail === OWNER_EMAIL;
}
