import { useState } from "react";
import { supabase } from "./supabase";
import Logo from "./components/Logo";

// ─────────────────────────────────────────────────────────────
// AUTH SCREEN — Foundry Login / Signup
// ─────────────────────────────────────────────────────────────
export default function AuthScreen({ onAuth }: { onAuth: () => void }) {
    const [mode, setMode] = useState<"login" | "signup">("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const handleGoogle = async () => {
        setError(null);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: window.location.origin,
            },
        });
        if (error) setError(error.message);
    };

    const handleEmailAuth = async () => {
        if (!email.trim() || !password.trim()) {
            setError("Please enter your email and password.");
            return;
        }
        if (mode === "signup" && !name.trim()) {
            setError("Please enter your name.");
            return;
        }
        setLoading(true);
        setError(null);

        if (mode === "signup") {
            const { error } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: { data: { name: name.trim() } },
            });
            if (error) {
                setError(error.message);
            } else {
                setSuccessMsg("Check your email for a confirmation link to activate your account.");
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });
            if (error) {
                setError(error.message);
            } else {
                onAuth();
            }
        }
        setLoading(false);
    };

    return (
        <div style={{
            position: "fixed", inset: 0, background: "#080809",
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", fontFamily: "'DM Sans', sans-serif",
            padding: "24px", zIndex: 200
        }}>

            {/* Glow */}
            <div style={{
                position: "absolute", width: 500, height: 500, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(232,98,42,0.08) 0%, transparent 70%)",
                pointerEvents: "none"
            }} />

            {/* Logo */}
            <div style={{ textAlign: "center", marginBottom: 40, animation: "fadeSlideUp 0.6s ease" }}>
                <Logo
                    variant="full"
                    style={{
                        width: "min(220px, 62vw)",
                        height: "auto",
                        marginBottom: 14,
                    }}
                />
                <div style={{
                    fontSize: "clamp(26px, 7vw, 34px)",
                    color: "#F0EDE8",
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    lineHeight: 1,
                }}>Foundry</div>
                <div style={{
                    fontSize: 11, color: "#E8622A", letterSpacing: "0.25em",
                    textTransform: "uppercase", marginTop: 8
                }}>Build Something Real</div>
            </div>

            {/* Card */}
            <div style={{
                width: "100%", maxWidth: 400,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 20, padding: "28px 24px",
                animation: "fadeSlideUp 0.7s ease"
            }}>

                {/* Mode toggle */}
                <div style={{
                    display: "flex", background: "rgba(255,255,255,0.04)",
                    borderRadius: 10, padding: 3, marginBottom: 24
                }}>
                    {(["login", "signup"] as const).map(m => (
                        <button key={m} onClick={() => { setMode(m); setError(null); setSuccessMsg(null); }}
                            style={{
                                flex: 1, padding: "8px", border: "none", borderRadius: 8,
                                background: mode === m ? "rgba(232,98,42,0.15)" : "transparent",
                                color: mode === m ? "#E8622A" : "#555",
                                fontSize: 13, fontWeight: 500, cursor: "pointer",
                                transition: "all 0.2s",
                                borderBottom: mode === m ? "1px solid rgba(232,98,42,0.4)" : "1px solid transparent"
                            }}>
                            {m === "login" ? "Sign In" : "Create Account"}
                        </button>
                    ))}
                </div>

                {successMsg ? (
                    <div style={{
                        textAlign: "center", padding: "24px 0",
                        color: "#4CAF8A", fontSize: 14,
                        fontFamily: "'Lora', Georgia, serif", lineHeight: 1.7
                    }}>
                        ✓ {successMsg}
                    </div>
                ) : (
                    <>
                        {/* Google */}
                        <button onClick={handleGoogle} style={{
                            width: "100%", padding: "12px", marginBottom: 16,
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 12, color: "#F0EDE8", fontSize: 13,
                            fontWeight: 500, cursor: "pointer", display: "flex",
                            alignItems: "center", justifyContent: "center", gap: 10,
                            transition: "all 0.2s"
                        }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"}
                        >
                            <svg width="18" height="18" viewBox="0 0 48 48">
                                <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-9 20-20 0-1.3-.1-2.7-.4-4z" />
                                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.6-2.9-11.3-7.1l-6.6 4.9C9.6 39.6 16.3 44 24 44z" />
                                <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.2 5.2C40.8 35.5 44 30.1 44 24c0-1.3-.1-2.7-.4-4z" />
                            </svg>
                            Continue with Google
                        </button>

                        {/* Divider */}
                        <div style={{
                            display: "flex", alignItems: "center", gap: 12, marginBottom: 16
                        }}>
                            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
                            <div style={{ fontSize: 11, color: "#444" }}>or</div>
                            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
                        </div>

                        {/* Name field (signup only) */}
                        {mode === "signup" && (
                            <input
                                type="text" placeholder="Your name" value={name}
                                onChange={e => setName(e.target.value)}
                                style={{
                                    width: "100%", padding: "12px 14px", marginBottom: 10,
                                    background: "rgba(255,255,255,0.04)",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    borderRadius: 10, color: "#F0EDE8", fontSize: 13,
                                    fontFamily: "'DM Sans', sans-serif",
                                }}
                            />
                        )}

                        {/* Email */}
                        <input
                            type="email" placeholder="Email address" value={email}
                            onChange={e => setEmail(e.target.value)}
                            style={{
                                width: "100%", padding: "12px 14px", marginBottom: 10,
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: 10, color: "#F0EDE8", fontSize: 13,
                                fontFamily: "'DM Sans', sans-serif",
                            }}
                        />

                        {/* Password */}
                        <input
                            type="password" placeholder="Password" value={password}
                            onChange={e => setPassword(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleEmailAuth()}
                            style={{
                                width: "100%", padding: "12px 14px", marginBottom: 16,
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: 10, color: "#F0EDE8", fontSize: 13,
                                fontFamily: "'DM Sans', sans-serif",
                            }}
                        />

                        {/* Error */}
                        {error && (
                            <div style={{
                                fontSize: 12, color: "#FF6B6B",
                                marginBottom: 12, textAlign: "center",
                                fontFamily: "'Lora', Georgia, serif"
                            }}>{error}</div>
                        )}

                        {/* Submit */}
                        <button onClick={handleEmailAuth} disabled={loading} style={{
                            width: "100%", padding: "13px",
                            background: loading ? "rgba(232,98,42,0.4)" : "linear-gradient(135deg, #E8622A, #c9521e)",
                            border: "none", borderRadius: 12, color: "#fff",
                            fontSize: 13, fontWeight: 600, cursor: loading ? "default" : "pointer",
                            fontFamily: "'Lora', Georgia, serif",
                            boxShadow: loading ? "none" : "0 4px 20px rgba(232,98,42,0.3)",
                            transition: "all 0.2s"
                        }}>
                            {loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}
                        </button>
                    </>
                )}
            </div>

            <div style={{ fontSize: 11, color: "#333", marginTop: 20, textAlign: "center", maxWidth: 300 }}>
                By continuing you agree to Foundry's Terms of Service and Privacy Policy
            </div>
        </div>
    );
}
