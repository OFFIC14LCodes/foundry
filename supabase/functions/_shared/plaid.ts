import { jsonResponse } from "./cors.ts";

type PlaidConfig = {
    clientId: string;
    secret: string;
    env: string;
    products: string[];
    countryCodes: string[];
    redirectUri: string | null;
    encryptionKey: string;
};

export function getPlaidConfig(): PlaidConfig {
    const clientId = Deno.env.get("PLAID_CLIENT_ID") ?? "";
    const secret = Deno.env.get("PLAID_SECRET") ?? "";
    const env = (Deno.env.get("PLAID_ENV") ?? "sandbox").trim();
    const products = (Deno.env.get("PLAID_PRODUCTS") ?? "transactions")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    const countryCodes = (Deno.env.get("PLAID_COUNTRY_CODES") ?? "US")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    const redirectUri = (Deno.env.get("PLAID_REDIRECT_URI") ?? "").trim() || null;
    const encryptionKey = Deno.env.get("PLAID_TOKEN_ENCRYPTION_KEY") ?? "";

    if (!clientId || !secret || !encryptionKey) {
        throw new Error("Missing Plaid environment variables.");
    }

    return { clientId, secret, env, products, countryCodes, redirectUri, encryptionKey };
}

function getPlaidBaseUrl(env: string) {
    if (env === "production") return "https://production.plaid.com";
    if (env === "development") return "https://development.plaid.com";
    return "https://sandbox.plaid.com";
}

export async function plaidRequest<T>(path: string, body: Record<string, unknown>) {
    const config = getPlaidConfig();
    const response = await fetch(`${getPlaidBaseUrl(config.env)}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            client_id: config.clientId,
            secret: config.secret,
            ...body,
        }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const errorMessage = payload?.error_message || payload?.display_message || `Plaid request failed for ${path}.`;
        throw new Error(errorMessage);
    }

    return payload as T;
}

function encodeBase64(bytes: Uint8Array) {
    let binary = "";
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
}

function decodeBase64(value: string) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

async function getAesKey() {
    const config = getPlaidConfig();
    const keyMaterial = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(config.encryptionKey),
    );
    return crypto.subtle.importKey("raw", keyMaterial, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptPlaidAccessToken(token: string) {
    const key = await getAesKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        new TextEncoder().encode(token),
    );
    return {
        ciphertext: encodeBase64(new Uint8Array(encrypted)),
        iv: encodeBase64(iv),
    };
}

export async function decryptPlaidAccessToken(ciphertext: string, iv: string) {
    const key = await getAesKey();
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: decodeBase64(iv) },
        key,
        decodeBase64(ciphertext),
    );
    return new TextDecoder().decode(decrypted);
}

export async function getPlaidInstitutionName(institutionId: string | null) {
    if (!institutionId) return null;
    const config = getPlaidConfig();
    const response = await plaidRequest<{ institution: { name?: string } }>(
        "/institutions/get_by_id",
        {
            institution_id: institutionId,
            country_codes: config.countryCodes,
        },
    );
    return response.institution?.name ?? null;
}

export function plaidErrorResponse(error: unknown) {
    return jsonResponse({
        error: error instanceof Error ? error.message : "Unexpected Plaid error.",
    }, 500);
}
