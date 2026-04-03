export type BillingRouteState =
    | { type: "success"; sessionId: string | null }
    | { type: "cancelled" }
    | null;

export function getBillingRouteState(locationLike = window.location): BillingRouteState {
    const path = locationLike.pathname.replace(/\/+$/, "") || "/";
    const params = new URLSearchParams(locationLike.search);

    if (path === "/billing/success") {
        return {
            type: "success",
            sessionId: params.get("session_id"),
        };
    }

    if (path === "/pricing" && params.get("checkout") === "cancelled") {
        return { type: "cancelled" };
    }

    return null;
}

export function clearBillingRoute(nextPath = "/") {
    window.history.replaceState({}, "", nextPath);
}
