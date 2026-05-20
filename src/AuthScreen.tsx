import { useState } from "react";
import { supabase } from "./supabase";
import Logo from "./components/Logo";

function getAuthRedirectUrl() {
    if (typeof window !== "undefined" && window.location?.origin) {
        return window.location.origin.replace(/\/+$/, "");
    }

    const configuredUrl = import.meta.env.VITE_APP_URL?.trim();
    return (configuredUrl || "").replace(/\/+$/, "");
}

type AuthMode = "login" | "signup" | "forgot" | "reset";

// ─────────────────────────────────────────────────────────────
// AUTH SCREEN — Tekori Login / Signup / Password Reset
// ─────────────────────────────────────────────────────────────
export default function AuthScreen({
    onAuth,
    initialMode = "login",
    onPasswordReset,
}: {
    onAuth: () => void;
    initialMode?: AuthMode;
    onPasswordReset?: () => void;
}) {
    const [mode, setMode] = useState<AuthMode>(initialMode);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const switchMode = (m: AuthMode) => {
        setMode(m);
        setError(null);
        setSuccessMsg(null);
        setPassword("");
        setConfirmPassword("");
    };

    const handleGoogle = async () => {
        setError(null);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: getAuthRedirectUrl(),
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
                options: {
                    data: { name: name.trim() },
                    emailRedirectTo: getAuthRedirectUrl(),
                },
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

    const handleForgotPassword = async () => {
        if (!email.trim()) {
            setError("Please enter your email address.");
            return;
        }
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: getAuthRedirectUrl(),
        });
        setLoading(false);
        if (error) {
            setError(error.message);
        } else {
            setSuccessMsg("If that email has an account, you'll receive a reset link shortly. Check your inbox.");
        }
    };

    const handleSetNewPassword = async () => {
        if (!password.trim()) {
            setError("Please enter a new password.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords don't match.");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.updateUser({ password });
        setLoading(false);
        if (error) {
            setError(error.message);
        } else {
            setSuccessMsg("Password updated. You're all set.");
            // Sign out after reset so they log in fresh with new password
            setTimeout(async () => {
                await supabase.auth.signOut();
                onPasswordReset?.();
            }, 1800);
        }
    };

    const inputStyle: React.CSSProperties = {
        width: "100%",
        padding: "13px 14px",
        marginBottom: 10,
        background: "rgba(7,26,47,0.04)",
        border: "1px solid rgba(7,26,47,0.08)",
        borderRadius: 10,
        color: "var(--color-text)",
        fontSize: 16,
        fontFamily: "var(--tekori-font-ui)",
        boxSizing: "border-box",
    };
    const authInputClassName = "foundry-auth-input";

    return (
        <div className="foundry-auth-shell" style={{
            background: "var(--color-bg-soft)",
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", fontFamily: "var(--tekori-font-ui)",
            zIndex: 200
        }}>

            {/* Glow */}
            <div style={{
                position: "absolute", width: 500, height: 500, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(216,155,43,0.08) 0%, transparent 70%)",
                pointerEvents: "none"
            }} />

            {/* Logo */}
            <div className="foundry-auth-brand">
                <Logo
                    variant="full"
                    className="foundry-auth-brand-logo"
                    style={{
                        height: "auto",
                    }}
                />
                <div className="foundry-auth-brand-title" style={{
                    fontSize: "clamp(26px, 7vw, 34px)",
                    color: "var(--color-text)",
                    fontFamily: "var(--tekori-font-brand)",
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    lineHeight: 1,
                }}>Tekori</div>
                <div className="foundry-auth-brand-tagline" style={{
                    fontSize: 11, color: "var(--tekori-gold)", letterSpacing: "0.25em",
                    textTransform: "uppercase", marginTop: 8
                }}>The Builder&apos;s Light</div>
            </div>

            {/* Card */}
            <div className="foundry-auth-card foundry-modal-surface" style={{
                padding: "28px 24px",
                animation: "fadeSlideUp 0.7s ease"
            }}>

                {/* ── RESET PASSWORD MODE ── */}
                {mode === "reset" && (
                    <>
                        <div style={{ marginBottom: 20, textAlign: "center" }}>
                            <div style={{
                                fontSize: 16, fontWeight: 600, color: "var(--color-text)",
                                fontFamily: "var(--tekori-font-brand)",
                                marginBottom: 6
                            }}>Set a new password</div>
                            <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)", lineHeight: 1.5 }}>
                                Choose something you haven't used before.
                            </div>
                        </div>

                        {successMsg ? (
                            <div style={{
                                textAlign: "center", padding: "24px 0",
                                color: "var(--color-success)", fontSize: 14,
                                fontFamily: "var(--tekori-font-ui)", lineHeight: 1.7
                            }}>
                                ✓ {successMsg}
                            </div>
                        ) : (
                            <>
                                <input
                                    type="password"
                                    placeholder="New password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className={authInputClassName}
                                    style={inputStyle}
                                />
                                <input
                                    type="password"
                                    placeholder="Confirm new password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && handleSetNewPassword()}
                                    className={authInputClassName}
                                    style={{ ...inputStyle, marginBottom: 16 }}
                                />
                                {error && (
                                    <div style={{
                                        fontSize: 12, color: "#FF6B6B",
                                        marginBottom: 12, textAlign: "center",
                                        fontFamily: "var(--tekori-font-ui)"
                                    }}>{error}</div>
                                )}
                                <button
                                    onClick={handleSetNewPassword}
                                    disabled={loading}
                                    className="foundry-btn foundry-btn--primary"
                                    style={{
                                        width: "100%", padding: "13px",
                                        background: loading ? "rgba(7,26,47,0.38)" : "linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))",
                                        border: "none", borderRadius: 12, color: "#fff",
                                        fontSize: 13, fontWeight: 600, cursor: loading ? "default" : "pointer",
                                        fontFamily: "var(--tekori-font-ui)",
                                        boxShadow: loading ? "none" : "0 14px 28px rgba(7,26,47,0.18)",
                                        transition: "all 0.2s"
                                    }}>
                                    {loading ? "..." : "Update Password"}
                                </button>
                            </>
                        )}
                    </>
                )}

                {/* ── FORGOT PASSWORD MODE ── */}
                {mode === "forgot" && (
                    <>
                        <button
                            onClick={() => switchMode("login")}
                            style={{
                                background: "none", border: "none", color: "var(--foundry-text-muted)",
                                fontSize: 12, cursor: "pointer", padding: 0,
                                marginBottom: 16, display: "flex", alignItems: "center", gap: 6
                            }}
                        >
                            ← Back to sign in
                        </button>

                        <div style={{ marginBottom: 20, textAlign: "center" }}>
                            <div style={{
                                fontSize: 16, fontWeight: 600, color: "var(--color-text)",
                                fontFamily: "var(--tekori-font-brand)",
                                marginBottom: 6
                            }}>Reset your password</div>
                            <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)", lineHeight: 1.5 }}>
                                Enter the email you signed up with and we'll send you a reset link.
                                This only works for email/password accounts, not Google sign-in.
                            </div>
                        </div>

                        {successMsg ? (
                            <div style={{
                                textAlign: "center", padding: "24px 0",
                                color: "var(--color-success)", fontSize: 14,
                                fontFamily: "var(--tekori-font-ui)", lineHeight: 1.7
                            }}>
                                ✓ {successMsg}
                            </div>
                        ) : (
                            <>
                                <input
                                    type="email"
                                    placeholder="Email address"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && handleForgotPassword()}
                                    className={authInputClassName}
                                    style={{ ...inputStyle, marginBottom: 16 }}
                                />
                                {error && (
                                    <div style={{
                                        fontSize: 12, color: "#FF6B6B",
                                        marginBottom: 12, textAlign: "center",
                                        fontFamily: "var(--tekori-font-ui)"
                                    }}>{error}</div>
                                )}
                                <button
                                    onClick={handleForgotPassword}
                                    disabled={loading}
                                    className="foundry-btn foundry-btn--primary"
                                    style={{
                                        width: "100%", padding: "13px",
                                        background: loading ? "rgba(7,26,47,0.38)" : "linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))",
                                        border: "none", borderRadius: 12, color: "#fff",
                                        fontSize: 13, fontWeight: 600, cursor: loading ? "default" : "pointer",
                                        fontFamily: "var(--tekori-font-ui)",
                                        boxShadow: loading ? "none" : "0 14px 28px rgba(7,26,47,0.18)",
                                        transition: "all 0.2s"
                                    }}>
                                    {loading ? "..." : "Send Reset Link"}
                                </button>
                            </>
                        )}
                    </>
                )}

                {/* ── LOGIN / SIGNUP MODE ── */}
                {(mode === "login" || mode === "signup") && (
                    <>
                        {/* Mode toggle */}
                        <div className="foundry-auth-mode-toggle" style={{
                            display: "flex", background: "rgba(7,26,47,0.04)",
                            borderRadius: 10, padding: 3, marginBottom: 24
                        }}>
                            {(["login", "signup"] as const).map(m => (
                                <button className="foundry-auth-mode-button" key={m} onClick={() => switchMode(m)}
                                    style={{
                                        flex: 1, padding: "8px", border: "none", borderRadius: 8,
                                        background: mode === m ? "rgba(216,155,43,0.15)" : "transparent",
                                        color: mode === m ? "var(--tekori-gold)" : "var(--color-text-muted)",
                                        fontSize: 13, fontWeight: 500, cursor: "pointer",
                                        transition: "all 0.2s",
                                        borderBottom: mode === m ? "1px solid rgba(216,155,43,0.4)" : "1px solid transparent"
                                    }}>
                                    {m === "login" ? "Sign In" : "Create Account"}
                                </button>
                            ))}
                        </div>

                        {successMsg ? (
                            <div style={{
                                textAlign: "center", padding: "24px 0",
                                color: "var(--color-success)", fontSize: 14,
                                fontFamily: "var(--tekori-font-ui)", lineHeight: 1.7
                            }}>
                                ✓ {successMsg}
                            </div>
                        ) : (
                            <>
                                {/* Google */}
                                <button onClick={handleGoogle} className="foundry-btn foundry-btn--secondary foundry-auth-google-button" style={{
                                    width: "100%", padding: "12px", marginBottom: 16,
                                    background: "rgba(7,26,47,0.05)",
                                    border: "1px solid rgba(7,26,47,0.1)",
                                    borderRadius: 12, color: "var(--color-text)", fontSize: 13,
                                    fontWeight: 500, cursor: "pointer", display: "flex",
                                    alignItems: "center", justifyContent: "center", gap: 10,
                                    transition: "all 0.2s"
                                }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(7,26,47,0.08)"}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(7,26,47,0.05)"}
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
                                <div className="foundry-auth-divider" style={{
                                    display: "flex", alignItems: "center", gap: 12, marginBottom: 16
                                }}>
                                    <div style={{ flex: 1, height: 1, background: "rgba(7,26,47,0.07)" }} />
                                    <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)" }}>or</div>
                                    <div style={{ flex: 1, height: 1, background: "rgba(7,26,47,0.07)" }} />
                                </div>

                                {/* Name field (signup only) */}
                                {mode === "signup" && (
                                    <input
                                        type="text" placeholder="Your name" value={name}
                                        onChange={e => setName(e.target.value)}
                                        className={authInputClassName}
                                        style={inputStyle}
                                    />
                                )}

                                {/* Email */}
                                <input
                                    type="email" placeholder="Email address" value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className={authInputClassName}
                                    style={inputStyle}
                                />

                                {/* Password */}
                                <input
                                    type="password" placeholder="Password" value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    onKeyDown={e => e.key === "Enter" && handleEmailAuth()}
                                    className={authInputClassName}
                                    style={{ ...inputStyle, marginBottom: mode === "login" ? 6 : 16 }}
                                />

                                {/* Forgot password link — login only */}
                                {mode === "login" && (
                                    <div className="foundry-auth-forgot-row" style={{ textAlign: "right", marginBottom: 16 }}>
                                        <button
                                            onClick={() => switchMode("forgot")}
                                            style={{
                                                background: "none", border: "none",
                                                color: "var(--foundry-text-muted)", fontSize: 11,
                                                cursor: "pointer", padding: 0,
                                                fontFamily: "var(--tekori-font-ui)",
                                            }}
                                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--tekori-gold)"}
                                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--color-text-muted)"}
                                        >
                                            Forgot password?
                                        </button>
                                    </div>
                                )}

                                {/* Error */}
                                {error && (
                                    <div style={{
                                        fontSize: 12, color: "#FF6B6B",
                                        marginBottom: 12, textAlign: "center",
                                        fontFamily: "var(--tekori-font-ui)"
                                    }}>{error}</div>
                                )}

                                {/* Submit */}
                                <button onClick={handleEmailAuth} disabled={loading} className="foundry-btn foundry-btn--primary foundry-auth-submit-button" style={{
                                    width: "100%", padding: "13px",
                                    background: loading ? "rgba(7,26,47,0.38)" : "linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))",
                                    border: "none", borderRadius: 12, color: "#fff",
                                    fontSize: 13, fontWeight: 600, cursor: loading ? "default" : "pointer",
                                    fontFamily: "var(--tekori-font-ui)",
                                    boxShadow: loading ? "none" : "0 14px 28px rgba(7,26,47,0.18)",
                                    transition: "all 0.2s"
                                }}>
                                    {loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}
                                </button>
                            </>
                        )}
                    </>
                )}
            </div>

            <div className="foundry-auth-footer" style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                By continuing you agree to Tekori's Terms of Service and Privacy Policy
            </div>
        </div>
    );
}
