import { useState } from "react";
import { FileText, CandlestickChart, GraduationCap, Users, ArrowRight, Target } from "lucide-react";
import { ChatsCircle, Notebook, Briefcase, UserSound } from "@phosphor-icons/react";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface AppTourScreenProps {
  profileName?: string;
  onComplete: () => void;
}

// ─────────────────────────────────────────────────────────────
// TOUR STEPS
// ─────────────────────────────────────────────────────────────
const TOUR_STEPS = [
  {
    id: "welcome",
    label: null,
    title: null,
    body: null,
  },
  {
    id: "forge",
    icon: ChatsCircle,
    iconColor: "#E8622A",
    label: "The Forge",
    title: "Your AI Business Mentor",
    body: "Have real conversations with Forge — your AI co-founder. Get stage-specific advice, work through blockers, and stay focused on what moves the needle.",
    highlight: "Stage-by-stage. Always in your corner.",
  },
  {
    id: "hub",
    icon: Target,
    iconColor: "#48BB78",
    label: "The Hub",
    title: "Your Command Center",
    body: "Track your progress across all 6 stages, monitor your budget and runway, and log key business decisions as you build.",
    highlight: "Everything in one place.",
  },
  {
    id: "tools",
    icon: null,
    iconColor: null,
    label: "Your Toolkit",
    title: "Powerful Tools, Built In",
    body: null,
    highlight: null,
    tools: [
      { Icon: Notebook, label: "Journal", desc: "Capture decisions & reflections" },
      { Icon: Briefcase, label: "Briefings", desc: "Stage-specific intelligence" },
      { Icon: UserSound, label: "Pitch Practice", desc: "Sharpen your pitch with AI" },
      { Icon: FileText, label: "Documents", desc: "Investor-ready docs" },
      { Icon: CandlestickChart, label: "Market Intel", desc: "Real-time market research" },
      { Icon: GraduationCap, label: "Academy", desc: "Learn the fundamentals" },
    ],
  },
  {
    id: "finish",
    icon: null,
    label: null,
    title: null,
    body: null,
  },
];

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export default function AppTourScreen({ profileName, onComplete }: AppTourScreenProps) {
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  const total = TOUR_STEPS.length;
  const current = TOUR_STEPS[step];

  const goNext = () => {
    if (step < total - 1) {
      setStep((s) => s + 1);
    } else {
      handleDone();
    }
  };

  const goBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleDone = () => {
    setExiting(true);
    setTimeout(onComplete, 600);
  };

  const isLast = step === total - 1;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "#080809",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: exiting ? 0 : 1,
        transition: "opacity 0.6s ease",
        overflow: "hidden",
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(232,98,42,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Content area */}
      <div
        key={step}
        style={{
          width: "100%",
          maxWidth: 480,
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          animation: "tourFadeSlideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
      >
        {current.id === "welcome" && <WelcomeSlide name={profileName} />}
        {current.id === "forge" && <FeatureSlide step={current as any} />}
        {current.id === "hub" && <FeatureSlide step={current as any} />}
        {current.id === "tools" && <ToolsSlide step={current as any} />}
        {current.id === "finish" && <FinishSlide name={profileName} />}
      </div>

      {/* Progress dots */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          display: "flex",
          gap: 6,
          alignItems: "center",
        }}
      >
        {TOUR_STEPS.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === step ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: i === step ? "#E8622A" : "rgba(255,255,255,0.15)",
              transition: "all 0.3s ease",
            }}
          />
        ))}
      </div>

      {/* Navigation */}
      <div
        style={{
          position: "absolute",
          bottom: 48,
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px",
          gap: 12,
        }}
      >
        {/* Back button */}
        {step > 0 && !isLast && (
          <button
            onClick={goBack}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              color: "rgba(240,237,232,0.5)",
              fontSize: 14,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
              padding: "12px 20px",
              cursor: "pointer",
              minWidth: 80,
            }}
          >
            Back
          </button>
        )}

        {/* Next / Let's Go button */}
        <button
          onClick={goNext}
          style={{
            flex: step > 0 && !isLast ? 1 : undefined,
            minWidth: step > 0 && !isLast ? undefined : 220,
            background: isLast ? "linear-gradient(135deg, #E8622A 0%, #d4541e 100%)" : "rgba(232,98,42,0.15)",
            border: `1px solid ${isLast ? "transparent" : "rgba(232,98,42,0.35)"}`,
            borderRadius: 14,
            color: isLast ? "#fff" : "#E8622A",
            fontSize: 15,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 600,
            padding: "14px 28px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.2s ease",
            letterSpacing: isLast ? "0.02em" : "normal",
          }}
        >
          {isLast ? (
            <>
              Enter the Forge
              <ArrowRight size={16} />
            </>
          ) : step === 0 ? (
            "Show Me Around"
          ) : (
            "Next"
          )}
        </button>

        {/* Skip (only on early steps) */}
        {step > 0 && !isLast && (
          <button
            onClick={handleDone}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(240,237,232,0.3)",
              fontSize: 13,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
              padding: "12px 8px",
              cursor: "pointer",
            }}
          >
            Skip
          </button>
        )}
      </div>

      <style>{`
        @keyframes tourFadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SLIDES
// ─────────────────────────────────────────────────────────────
function WelcomeSlide({ name }: { name?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      {/* Flame icon */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "rgba(232,98,42,0.12)",
          border: "1px solid rgba(232,98,42,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 32px",
          fontSize: 32,
        }}
      >
        🔥
      </div>

      <div
        style={{
          fontSize: 11,
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 600,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "#E8622A",
          marginBottom: 16,
        }}
      >
        Welcome to Foundry
      </div>

      <h1
        style={{
          fontSize: "clamp(28px, 8vw, 40px)",
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 700,
          color: "#F0EDE8",
          lineHeight: 1.15,
          marginBottom: 20,
          letterSpacing: "-0.5px",
        }}
      >
        {name ? `You're in, ${name}.` : "You're in."}
      </h1>

      <p
        style={{
          fontSize: 16,
          fontFamily: "'Lora', Georgia, serif",
          fontStyle: "italic",
          color: "rgba(240,237,232,0.55)",
          lineHeight: 1.7,
          maxWidth: 320,
          margin: "0 auto",
        }}
      >
        Let's take 30 seconds to show you around — everything you need to build something real.
      </p>
    </div>
  );
}

function FeatureSlide({ step }: { step: typeof TOUR_STEPS[number] & { icon: any; iconColor: string; label: string; title: string; body: string; highlight: string } }) {
  const Icon = step.icon;
  return (
    <div style={{ textAlign: "center" }}>
      {/* Icon circle */}
      <div
        style={{
          width: 68,
          height: 68,
          borderRadius: "50%",
          background: `${step.iconColor}18`,
          border: `1px solid ${step.iconColor}30`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 32px",
        }}
      >
        <Icon size={28} color={step.iconColor} strokeWidth={1.5} />
      </div>

      <div
        style={{
          fontSize: 11,
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 600,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: step.iconColor,
          marginBottom: 14,
        }}
      >
        {step.label}
      </div>

      <h2
        style={{
          fontSize: "clamp(24px, 7vw, 34px)",
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 700,
          color: "#F0EDE8",
          lineHeight: 1.2,
          marginBottom: 18,
          letterSpacing: "-0.3px",
        }}
      >
        {step.title}
      </h2>

      <p
        style={{
          fontSize: 15,
          fontFamily: "'Lora', Georgia, serif",
          color: "rgba(240,237,232,0.6)",
          lineHeight: 1.75,
          maxWidth: 360,
          margin: "0 auto 24px",
        }}
      >
        {step.body}
      </p>

      {step.highlight && (
        <div
          style={{
            display: "inline-block",
            background: `${step.iconColor}12`,
            border: `1px solid ${step.iconColor}25`,
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500,
            color: step.iconColor,
            letterSpacing: "0.01em",
          }}
        >
          {step.highlight}
        </div>
      )}
    </div>
  );
}

function ToolsSlide({ step }: { step: any }) {
  return (
    <div style={{ textAlign: "center", width: "100%" }}>
      <div
        style={{
          fontSize: 11,
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 600,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "#E8622A",
          marginBottom: 14,
        }}
      >
        {step.label}
      </div>

      <h2
        style={{
          fontSize: "clamp(22px, 6vw, 30px)",
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 700,
          color: "#F0EDE8",
          lineHeight: 1.2,
          marginBottom: 28,
          letterSpacing: "-0.3px",
        }}
      >
        {step.title}
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          width: "100%",
        }}
      >
        {step.tools.map(({ Icon, label, desc }: any) => (
          <div
            key={label}
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: "14px 14px",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 8,
              textAlign: "left",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "rgba(232,98,42,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={17} color="#E8622A" strokeWidth={1.5} />
            </div>
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 600,
                  color: "#F0EDE8",
                  marginBottom: 2,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "'DM Sans', sans-serif",
                  color: "rgba(240,237,232,0.4)",
                  lineHeight: 1.4,
                }}
              >
                {desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinishSlide({ name }: { name?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(232,98,42,0.2) 0%, rgba(232,98,42,0.05) 100%)",
          border: "1px solid rgba(232,98,42,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 36px",
          fontSize: 36,
        }}
      >
        🚀
      </div>

      <div
        style={{
          fontSize: 11,
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 600,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "#E8622A",
          marginBottom: 16,
        }}
      >
        You're Ready
      </div>

      <h2
        style={{
          fontSize: "clamp(26px, 7.5vw, 38px)",
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 700,
          color: "#F0EDE8",
          lineHeight: 1.15,
          marginBottom: 20,
          letterSpacing: "-0.5px",
        }}
      >
        Time to build something real.
      </h2>

      <p
        style={{
          fontSize: 15,
          fontFamily: "'Lora', Georgia, serif",
          fontStyle: "italic",
          color: "rgba(240,237,232,0.5)",
          lineHeight: 1.75,
          maxWidth: 300,
          margin: "0 auto",
        }}
      >
        Your Forge is waiting. Every great business started with one conversation.
      </p>
    </div>
  );
}
