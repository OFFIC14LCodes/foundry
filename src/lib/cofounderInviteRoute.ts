const PENDING_COFUNDER_INVITE_KEY = 'foundry_pending_cofounder_invite';

export function getCofounderInviteTokenFromLocation(location: Location = window.location): string | null {
    const fromSearch = new URLSearchParams(location.search).get('invite');
    if (fromSearch?.trim()) return fromSearch.trim();

    const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
    const queryStart = hash.indexOf('?');
    if (queryStart === -1) return null;

    const fromHash = new URLSearchParams(hash.slice(queryStart + 1)).get('invite');
    return fromHash?.trim() || null;
}

export function getPendingCofounderInviteToken(): string | null {
    const token = getCofounderInviteTokenFromLocation();
    if (token) {
        sessionStorage.setItem(PENDING_COFUNDER_INVITE_KEY, token);
        return token;
    }

    return sessionStorage.getItem(PENDING_COFUNDER_INVITE_KEY);
}

export function clearCofounderInviteTokenFromUrl() {
    sessionStorage.removeItem(PENDING_COFUNDER_INVITE_KEY);

    const url = new URL(window.location.href);
    url.searchParams.delete('invite');

    if (url.hash.includes('?')) {
        const [hashPath, hashQuery = ''] = url.hash.slice(1).split('?');
        const hashParams = new URLSearchParams(hashQuery);
        hashParams.delete('invite');
        const nextQuery = hashParams.toString();
        url.hash = nextQuery ? `${hashPath}?${nextQuery}` : hashPath;
    }

    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}
