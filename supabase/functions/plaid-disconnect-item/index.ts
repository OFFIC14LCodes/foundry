import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
    decryptPlaidAccessToken,
    plaidErrorResponse,
    plaidRequest,
} from "../_shared/plaid.ts";

type RemoveItemResponse = {
    removed: boolean;
    request_id?: string;
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
        const plaidItemId = String(body?.plaidItemId || "").trim();
        if (!plaidItemId) {
            return jsonResponse({ error: "plaidItemId is required." }, 400);
        }

        const { data: plaidItem } = await serviceClient
            .from("plaid_items")
            .select("*")
            .eq("user_id", user.id)
            .eq("plaid_item_id", plaidItemId)
            .maybeSingle();

        if (!plaidItem) {
            return jsonResponse({ error: "Connected Plaid item not found." }, 404);
        }

        const accessToken = await decryptPlaidAccessToken(
            plaidItem.access_token_ciphertext,
            plaidItem.access_token_iv,
        );

        await plaidRequest<RemoveItemResponse>("/item/remove", {
            access_token: accessToken,
        });

        await serviceClient
            .from("plaid_transactions")
            .delete()
            .eq("user_id", user.id)
            .eq("plaid_item_id", plaidItemId)
            .neq("review_status", "accepted");

        await serviceClient
            .from("founder_financial_accounts")
            .delete()
            .eq("user_id", user.id)
            .eq("provider", "plaid")
            .eq("provider_item_id", plaidItemId);

        await serviceClient
            .from("plaid_items")
            .delete()
            .eq("id", plaidItem.id)
            .eq("user_id", user.id);

        return jsonResponse({
            ok: true,
            plaidItemId,
        });
    } catch (error) {
        return plaidErrorResponse(error);
    }
});
