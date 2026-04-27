import { supabase } from "../supabase";

async function getPlaidAuthHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

    if (!token) {
        throw new Error("Your session expired. Sign in again before connecting a bank.");
    }

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Missing Supabase Plaid configuration.");
    }

    return {
        supabaseUrl,
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
    };
}

async function invokePlaidFunction<TBody extends object>(name: string, body: TBody) {
    const headers = await getPlaidAuthHeaders();
    const response = await fetch(`${headers.supabaseUrl}/functions/v1/${name}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: headers.Authorization,
            apikey: headers.apikey,
        },
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    return {
        ok: response.ok,
        status: response.status,
        data: payload,
    };
}

export async function createPlaidLinkToken() {
    const result = await invokePlaidFunction("plaid-create-link-token", {});
    if (!result.ok || !result.data?.linkToken) {
        throw new Error(result.data?.error || "Could not start Plaid Link.");
    }
    return result.data.linkToken as string;
}

export async function exchangePlaidPublicToken(publicToken: string) {
    const result = await invokePlaidFunction("plaid-exchange-public-token", { publicToken });
    if (!result.ok) {
        throw new Error(result.data?.error || "Could not connect this bank account.");
    }
    return result.data;
}

export async function syncPlaidTransactions(plaidItemId: string) {
    const result = await invokePlaidFunction("plaid-sync-transactions", { plaidItemId });
    if (!result.ok) {
        throw new Error(result.data?.error || "Could not sync bank transactions.");
    }
    return result.data;
}
