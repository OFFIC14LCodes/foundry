import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
    encryptPlaidAccessToken,
    getPlaidInstitutionName,
    plaidErrorResponse,
    plaidRequest,
} from "../_shared/plaid.ts";

type ExchangeResponse = {
    access_token: string;
    item_id: string;
};

type AccountsResponse = {
    item: {
        item_id: string;
        institution_id?: string | null;
    };
    accounts: Array<{
        account_id: string;
        name: string;
        official_name?: string | null;
        subtype?: string | null;
        type?: string | null;
        mask?: string | null;
    }>;
};

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        if (request.method !== "POST") {
            return jsonResponse({ error: "Method not allowed." }, 405);
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        if (!supabaseUrl || !serviceRoleKey) {
            return jsonResponse({ error: "Missing Supabase environment variables." }, 500);
        }

        const serviceClient = createClient(supabaseUrl, serviceRoleKey);
        const authHeader = request.headers.get("Authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        const {
            data: { user },
            error: authError,
        } = await serviceClient.auth.getUser(token);

        if (!token || authError || !user) {
            return jsonResponse({ error: "Unauthorized." }, 401);
        }

        const body = await request.json().catch(() => ({}));
        const publicToken = String(body?.publicToken || "").trim();
        if (!publicToken) {
            return jsonResponse({ error: "publicToken is required." }, 400);
        }

        const exchange = await plaidRequest<ExchangeResponse>("/item/public_token/exchange", {
            public_token: publicToken,
        });
        const encrypted = await encryptPlaidAccessToken(exchange.access_token);

        const accounts = await plaidRequest<AccountsResponse>("/accounts/get", {
            access_token: exchange.access_token,
        });
        const institutionId = accounts.item?.institution_id ?? null;
        const institutionName = await getPlaidInstitutionName(institutionId);

        await serviceClient.from("plaid_items").upsert({
            user_id: user.id,
            plaid_item_id: exchange.item_id,
            access_token_ciphertext: encrypted.ciphertext,
            access_token_iv: encrypted.iv,
            institution_id: institutionId,
            institution_name: institutionName,
            status: "connected",
            updated_at: new Date().toISOString(),
        }, { onConflict: "plaid_item_id" });

        const accountRows = accounts.accounts.map((account) => ({
            user_id: user.id,
            name: account.name,
            account_type: mapPlaidAccountType(account.type, account.subtype),
            institution_name: institutionName,
            last4: account.mask ?? null,
            is_external_feed: true,
            is_active: true,
            provider: "plaid",
            provider_item_id: exchange.item_id,
            provider_account_id: account.account_id,
            official_name: account.official_name ?? null,
            subtype: account.subtype ?? null,
            mask: account.mask ?? null,
            updated_at: new Date().toISOString(),
        }));

        if (accountRows.length > 0) {
            await serviceClient.from("founder_financial_accounts").upsert(accountRows, {
                onConflict: "user_id,provider,provider_account_id",
                ignoreDuplicates: false,
            } as any);
        }

        return jsonResponse({
            ok: true,
            institutionName,
            accountsAdded: accountRows.length,
        });
    } catch (error) {
        return plaidErrorResponse(error);
    }
});

function mapPlaidAccountType(type?: string | null, subtype?: string | null) {
    if (type === "depository") return "operating";
    if (subtype === "credit card") return "other";
    return "other";
}
