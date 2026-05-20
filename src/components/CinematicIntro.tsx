import { useEffect, useState } from "react";
import Logo from "./Logo";

// ─────────────────────────────────────────────────────────────
// CINEMATIC INTRO
// ─────────────────────────────────────────────────────────────
export default function CinematicIntro({ onComplete }) {
    const [phase, setPhase] = useState(0);
    useEffect(() => {
        const timers = [
            setTimeout(() => setPhase(1), 600),
            setTimeout(() => setPhase(2), 2000),
            setTimeout(() => setPhase(3), 3400),
            setTimeout(() => setPhase(4), 6400),
            setTimeout(() => onComplete(), 7800),
        ];
        return () => timers.forEach(clearTimeout);
    }, []);
    return (
        <div style={{ position: "fixed", inset: 0, background: "var(--color-bg-soft)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(216,155,43,0.12) 0%, transparent 70%)", opacity: phase >= 1 ? 1 : 0, transition: "opacity 2s ease", pointerEvents: "none" }} />
            <Logo
                variant="full"
                style={{
                    width: "min(256px, 62vw)",
                    height: "auto",
                    marginBottom: 24,
                    opacity: phase >= 1 ? 1 : 0,
                    transform: phase >= 1 ? "scale(1) translateY(0)" : "scale(0.6) translateY(20px)",
                    transition: "all 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
                    filter: phase >= 2 ? "drop-shadow(0 0 30px rgba(216,155,43,0.6))" : "none",
                }}
            />
            <div style={{ opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? "translateY(0)" : "translateY(12px)", transition: "all 0.9s cubic-bezier(0.16, 1, 0.3, 1)", textAlign: "center", marginBottom: 40 }}>
                <div style={{ fontSize: "clamp(36px, 11vw, 52px)", fontFamily: "var(--tekori-font-brand)", fontWeight: 700, color: "var(--color-text)", letterSpacing: "-1px", lineHeight: 1 }}>Tekori</div>
                <div style={{ fontSize: 11, fontFamily: "var(--tekori-font-ui)", color: "var(--tekori-gold)", letterSpacing: "0.25em", textTransform: "uppercase", marginTop: 8 }}>The Builder&apos;s Light</div>
            </div>
            <div style={{ opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? "translateY(0)" : "translateY(8px)", transition: "all 0.8s ease", textAlign: "center", maxWidth: 380, padding: "0 32px" }}>
                <div style={{ fontSize: 15, fontFamily: "var(--tekori-font-ui)", fontStyle: "italic", color: "rgba(71,84,103,0.88)", lineHeight: 1.7 }}>"Every great business started with one person who decided to try."</div>
            </div>
            <div style={{ position: "absolute", inset: 0, background: "var(--color-bg-soft)", opacity: phase >= 4 ? 1 : 0, transition: "opacity 0.9s ease", pointerEvents: "none" }} />
        </div>
    );
}
