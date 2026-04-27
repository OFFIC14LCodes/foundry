import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getPlaidConfig, plaidErrorResponse, plaidRequest } from "../_shared/plaid.ts";

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

        const config = getPlaidConfig();
        const body = await request.json().catch(() => ({}));
        const response = await plaidRequest<{ link_token: string }>("/link/token/create", {
            user: {
                client_user_id: user.id,
            },
            client_name: "Foundry",
            language: "en",
            country_codes: config.countryCodes,
            products: config.products,
            redirect_uri: config.redirectUri ?? undefined,
            webhook: null,
            transactions: {
                days_requested: 30,
            },
            account_filters: body?.accountFilters ?? undefined,
        });

        return jsonResponse({ linkToken: response.link_token });
    } catch (error) {
        return plaidErrorResponse(error);
    }
});
