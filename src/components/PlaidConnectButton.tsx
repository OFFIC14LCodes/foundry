import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { createPlaidLinkToken, exchangePlaidPublicToken } from "../lib/plaid";

export default function PlaidConnectButton({
    onConnected,
    label = "Connect Bank",
}: {
    onConnected?: () => void;
    label?: string;
}) {
    const [linkToken, setLinkToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [requestedOpen, setRequestedOpen] = useState(false);

    const { open, ready } = usePlaidLink({
        token: linkToken,
        onSuccess: async (publicToken) => {
            setLoading(true);
            setError(null);
            try {
                await exchangePlaidPublicToken(publicToken);
                onConnected?.();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Could not connect bank.");
            } finally {
                setLoading(false);
                setRequestedOpen(false);
            }
        },
        onExit: () => {
            setRequestedOpen(false);
        },
    });

    useEffect(() => {
        if (requestedOpen && !linkToken && !loading) {
            setLoading(true);
            setError(null);
            createPlaidLinkToken()
                .then((token) => setLinkToken(token))
                .catch((err) => setError(err instanceof Error ? err.message : "Could not start bank connection."))
                .finally(() => setLoading(false));
        }
    }, [requestedOpen, linkToken, loading]);

    useEffect(() => {
        if (requestedOpen && linkToken && ready) {
            open();
        }
    }, [requestedOpen, linkToken, ready, open]);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button
                onClick={() => setRequestedOpen(true)}
                disabled={loading}
                style={{
                    background: "linear-gradient(135deg, #4CAF8A, #3a9470)",
                    border: "none",
                    borderRadius: 10,
                    padding: "9px 14px",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: loading ? "default" : "pointer",
                    opacity: loading ? 0.75 : 1,
                }}
            >
                {loading ? "Connecting..." : label}
            </button>
            {error && (
                <div style={{ fontSize: 11, color: "#FF6B6B", lineHeight: 1.5 }}>
                    {error}
                </div>
            )}
        </div>
    );
}
