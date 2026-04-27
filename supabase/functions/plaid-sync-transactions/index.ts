import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
    decryptPlaidAccessToken,
    plaidErrorResponse,
    plaidRequest,
} from "../_shared/plaid.ts";

type SyncResponse = {
    added: any[];
    modified: any[];
    removed: any[];
    has_more: boolean;
    next_cursor: string | null;
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

        let cursor = plaidItem.sync_cursor ?? null;
        let hasMore = true;
        const stagedTransactions: any[] = [];

        while (hasMore) {
            const syncResponse = await plaidRequest<SyncResponse>("/transactions/sync", {
                access_token: accessToken,
                cursor,
                count: 100,
            });

            stagedTransactions.push(...syncResponse.added, ...syncResponse.modified);
            hasMore = Boolean(syncResponse.has_more);
            cursor = syncResponse.next_cursor ?? null;
        }

        const acceptedTransactions = stagedTransactions.filter((transaction) => transaction.pending !== true);
        const transactionIds = acceptedTransactions.map((transaction) => transaction.transaction_id).filter(Boolean);
        const existingMap = new Map<string, any>();

        if (transactionIds.length > 0) {
            const { data: existingRows } = await serviceClient
                .from("plaid_transactions")
                .select("plaid_transaction_id, review_status, linked_expense_id, linked_revenue_id, mapped_direction")
                .eq("user_id", user.id)
                .in("plaid_transaction_id", transactionIds);
            (existingRows ?? []).forEach((row) => existingMap.set(row.plaid_transaction_id, row));
        }

        const upsertRows = acceptedTransactions.map((transaction) => {
            const existing = existingMap.get(transaction.transaction_id);
            return {
                user_id: user.id,
                plaid_item_id: plaidItemId,
                plaid_account_id: transaction.account_id ?? null,
                plaid_transaction_id: transaction.transaction_id,
                name: transaction.name ?? transaction.original_description ?? "Imported transaction",
                merchant_name: transaction.merchant_name ?? null,
                amount: Number(transaction.amount ?? 0),
                currency: transaction.iso_currency_code ?? "USD",
                authorized_date: transaction.authorized_date ?? null,
                posted_date: transaction.date ?? null,
                category_raw: transaction.personal_finance_category ?? transaction.category ?? [],
                pending: false,
                review_status: existing?.review_status ?? "pending",
                mapped_direction: existing?.mapped_direction ?? (Number(transaction.amount ?? 0) >= 0 ? "expense" : "revenue"),
                linked_expense_id: existing?.linked_expense_id ?? null,
                linked_revenue_id: existing?.linked_revenue_id ?? null,
                imported_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
        });

        if (upsertRows.length > 0) {
            await serviceClient
                .from("plaid_transactions")
                .upsert(upsertRows, { onConflict: "plaid_transaction_id" });
        }

        await serviceClient
            .from("plaid_items")
            .update({
                sync_cursor: cursor,
                last_synced_at: new Date().toISOString(),
                status: "synced",
                updated_at: new Date().toISOString(),
            })
            .eq("id", plaidItem.id);

        await serviceClient
            .from("founder_financial_accounts")
            .update({
                last_synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", user.id)
            .eq("provider", "plaid")
            .eq("provider_item_id", plaidItemId);

        return jsonResponse({
            ok: true,
            importedCount: upsertRows.length,
            skippedPendingCount: stagedTransactions.length - acceptedTransactions.length,
        });
    } catch (error) {
        return plaidErrorResponse(error);
    }
});
