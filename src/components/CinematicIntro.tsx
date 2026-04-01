import { useEffect, useState } from "react";

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
        <div style={{ position: "fixed", inset: 0, background: "#080809", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(232,98,42,0.12) 0%, transparent 70%)", opacity: phase >= 1 ? 1 : 0, transition: "opacity 2s ease", pointerEvents: "none" }} />
            <div style={{ fontSize: "clamp(48px, 15vw, 64px)", marginBottom: 24, opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? "scale(1) translateY(0)" : "scale(0.6) translateY(20px)", transition: "all 1.2s cubic-bezier(0.16, 1, 0.3, 1)", filter: phase >= 2 ? "drop-shadow(0 0 30px rgba(232,98,42,0.6))" : "none" }}>🔥</div>
            <div style={{ opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? "translateY(0)" : "translateY(12px)", transition: "all 0.9s cubic-bezier(0.16, 1, 0.3, 1)", textAlign: "center", marginBottom: 40 }}>
                <div style={{ fontSize: "clamp(36px, 11vw, 52px)", fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, color: "#F0EDE8", letterSpacing: "-1px", lineHeight: 1 }}>Foundry</div>
                <div style={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif", color: "#E8622A", letterSpacing: "0.25em", textTransform: "uppercase", marginTop: 8 }}>Build Something Real</div>
            </div>
            <div style={{ opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? "translateY(0)" : "translateY(8px)", transition: "all 0.8s ease", textAlign: "center", maxWidth: 380, padding: "0 32px" }}>
                <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", color: "rgba(240,237,232,0.5)", lineHeight: 1.7 }}>"Every great business started with one person who decided to try."</div>
            </div>
            <div style={{ position: "absolute", inset: 0, background: "#080809", opacity: phase >= 4 ? 1 : 0, transition: "opacity 0.9s ease", pointerEvents: "none" }} />
        </div>
    );
}
