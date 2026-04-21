import { useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { Archive, ArrowRight, Flame, Menu, Rocket, Settings, Target } from "lucide-react";
import { Icons } from "../icons";
import Logo from "./Logo";

interface AppTourScreenProps {
  profileName?: string;
  onComplete: () => void;
}

type IconComponent = ComponentType<any>;

type GuideStep = {
  id: string;
  kind: "welcome" | "hub" | "forge" | "menu" | "finish";
  title?: string;
  eyebrow?: string;
  body?: string;
  location?: string;
  useFor?: string;
  accent?: string;
  targetLabel?: string;
  targetSub?: string;
  targetIcon?: IconComponent;
};

const MENU_ITEMS: Array<{ label: string; sub: string; icon: IconComponent }> = [
  { label: "Forge Academy", sub: "Deep founder learning hub", icon: Icons.sidebar.academy },
  { label: "Archive", sub: "Saved conversation snapshots", icon: Archive },
  { label: "Founder's Journal", sub: "Private writing space", icon: Icons.sidebar.journal },
  { label: "Monday Briefings", sub: "Weekly Forge updates", icon: Icons.sidebar.briefings },
  { label: "Pitch Practice", sub: "Simulate investor meetings", icon: Icons.sidebar.pitchPractice },
  { label: "Document Production", sub: "Professional documents", icon: Icons.sidebar.documents },
  { label: "Market Intelligence", sub: "Daily industry briefing", icon: Icons.sidebar.marketIntel },
  { label: "Co-Founder Mode", sub: "Shared team workspace", icon: Icons.sidebar.cofounder },
  { label: "Settings", sub: "Account, billing, and policies", icon: Settings },
];

const TOUR_STEPS: GuideStep[] = [
  { id: "welcome", kind: "welcome" },
  {
    id: "hub",
    kind: "hub",
    eyebrow: "The Hub",
    title: "This is your command center.",
    body: "Track stage progress, budget, milestones, and decisions from one place before jumping into execution.",
    location: "You land here after onboarding, and you can always come back here as your home base.",
    useFor: "Use it when you want the big-picture view of your business instead of a single conversation or tool.",
    accent: "#48BB78",
  },
  {
    id: "forge",
    kind: "forge",
    eyebrow: "Forge",
    title: "This is where the real coaching happens.",
    body: "Talk with Forge stage by stage, work through blockers, complete goals, and get pushed toward the next concrete move.",
    location: "Open it from the Hub by entering your current stage, or tap the Forge bubble when it makes sense.",
    useFor: "Use it whenever you need direction, strategy, or help finishing a milestone.",
    accent: "#E8622A",
  },
  {
    id: "academy",
    kind: "menu",
    eyebrow: "Menu Tool",
    title: "Forge Academy gives you the deeper why.",
    body: "Learn the fundamentals behind what Forge is telling you so you can make sharper decisions on your own.",
    location: "From the Hub, open the top-left menu and choose Forge Academy.",
    useFor: "Use it when you want to study a concept, not just solve the next immediate problem.",
    accent: "#E8622A",
    targetLabel: "Forge Academy",
    targetSub: "Deep founder learning hub",
    targetIcon: Icons.sidebar.academy,
  },
  {
    id: "archive",
    kind: "menu",
    eyebrow: "Menu Tool",
    title: "Archive stores the conversations worth keeping.",
    body: "Save useful Forge threads and pull them back up later instead of hunting through old messages.",
    location: "From the Hub menu, choose Archive.",
    useFor: "Use it when a conversation became a reusable asset and you want to revisit it later.",
    accent: "#D0A35B",
    targetLabel: "Archive",
    targetSub: "Saved conversation snapshots",
    targetIcon: Archive,
  },
  {
    id: "journal",
    kind: "menu",
    eyebrow: "Menu Tool",
    title: "The Journal is for private founder thinking.",
    body: "Capture reflections, document hard moments, and write things that help you think clearly without turning them into tasks.",
    location: "From the Hub menu, choose Founder's Journal.",
    useFor: "Use it when you need clarity, not another chat response.",
    accent: "#A780D9",
    targetLabel: "Founder's Journal",
    targetSub: "Private writing space",
    targetIcon: Icons.sidebar.journal,
  },
  {
    id: "briefings",
    kind: "menu",
    eyebrow: "Menu Tool",
    title: "Monday Briefings keep the week focused.",
    body: "Get a tighter strategic summary of what matters right now for your stage instead of relying on memory.",
    location: "From the Hub menu, choose Monday Briefings.",
    useFor: "Use it when you want a quick weekly reset and a sharper sense of priorities.",
    accent: "#4C8BF5",
    targetLabel: "Monday Briefings",
    targetSub: "Weekly Forge updates",
    targetIcon: Icons.sidebar.briefings,
  },
  {
    id: "pitch",
    kind: "menu",
    eyebrow: "Menu Tool",
    title: "Pitch Practice is for saying it out loud.",
    body: "Rehearse your pitch, pressure-test your message, and tighten your wording before investors, partners, or customers hear it.",
    location: "From the Hub menu, choose Pitch Practice.",
    useFor: "Use it when you need reps, confidence, and cleaner language.",
    accent: "#E8622A",
    targetLabel: "Pitch Practice",
    targetSub: "Simulate investor meetings",
    targetIcon: Icons.sidebar.pitchPractice,
  },
  {
    id: "documents",
    kind: "menu",
    eyebrow: "Menu Tool",
    title: "Document Production turns raw thinking into usable assets.",
    body: "Generate polished business documents without starting from a blank page each time.",
    location: "From the Hub menu, choose Document Production.",
    useFor: "Use it when strategy needs to become something you can actually send or present.",
    accent: "#D97447",
    targetLabel: "Document Production",
    targetSub: "Professional documents",
    targetIcon: Icons.sidebar.documents,
  },
  {
    id: "market",
    kind: "menu",
    eyebrow: "Menu Tool",
    title: "Market Intelligence keeps you grounded in reality.",
    body: "Use it to look outward at demand, competitors, and the market instead of operating from assumptions alone.",
    location: "From the Hub menu, choose Market Intelligence.",
    useFor: "Use it when you need research to validate or challenge your next move.",
    accent: "#4CAF8A",
    targetLabel: "Market Intelligence",
    targetSub: "Daily industry briefing",
    targetIcon: Icons.sidebar.marketIntel,
  },
  {
    id: "cofounder",
    kind: "menu",
    eyebrow: "Menu Tool",
    title: "Co-Founder Mode is the shared workspace.",
    body: "Bring another person into the process so decisions, chats, and direction stop living in one founder's head.",
    location: "From the Hub menu, choose Co-Founder Mode.",
    useFor: "Use it when you're building with a partner or teammate and need alignment.",
    accent: "#6CA9FF",
    targetLabel: "Co-Founder Mode",
    targetSub: "Shared team workspace",
    targetIcon: Icons.sidebar.cofounder,
  },
  {
    id: "settings",
    kind: "menu",
    eyebrow: "Menu Tool",
    title: "Settings is where account-level control lives.",
    body: "Manage account details, notifications, billing, support, and the operational side of your workspace.",
    location: "From the Hub menu, choose Settings.",
    useFor: "Use it when you're changing how Foundry works for you, not what you're building inside it.",
    accent: "#B8B2AA",
    targetLabel: "Settings",
    targetSub: "Account, billing, and policies",
    targetIcon: Settings,
  },
  { id: "finish", kind: "finish" },
];

export default function AppTourScreen({ profileName, onComplete }: AppTourScreenProps) {
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  const total = TOUR_STEPS.length;
  const current = TOUR_STEPS[step];
  const isLast = step === total - 1;

  const finish = () => {
    setExiting(true);
    setTimeout(onComplete, 600);
  };

  const goNext = () => {
    if (step < total - 1) {
      setStep((s) => s + 1);
      return;
    }
    finish();
  };

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
      <div
        style={{
          position: "absolute",
          width: 560,
          height: 560,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(232,98,42,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      <div
        key={current.id}
        style={{
          width: "100%",
          maxWidth: 1120,
          padding: "28px 20px 190px",
          minHeight: "100%",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "tourFadeSlideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
      >
        {current.kind === "welcome" && <WelcomeSlide name={profileName} />}
        {current.kind === "hub" && <HubGuideSlide step={current} />}
        {current.kind === "forge" && <ForgeGuideSlide step={current} />}
        {current.kind === "menu" && <MenuGuideSlide step={current} />}
        {current.kind === "finish" && <FinishSlide />}
      </div>

      <div style={{ position: "absolute", bottom: 132, display: "flex", gap: 6, alignItems: "center", padding: "0 24px", maxWidth: "100%" }}>
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

      <div
        style={{
          position: "absolute",
          bottom: 28,
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px max(20px, calc(8px + env(safe-area-inset-bottom)))",
          gap: 12,
        }}
      >
        {step > 0 && !isLast && <button onClick={() => setStep((s) => s - 1)} style={navSecondaryButton}>Back</button>}

        <button
          onClick={goNext}
          style={{
            ...navPrimaryButton,
            flex: step > 0 && !isLast ? 1 : undefined,
            minWidth: step > 0 && !isLast ? undefined : 240,
            background: isLast ? "linear-gradient(135deg, #E8622A 0%, #d4541e 100%)" : "rgba(232,98,42,0.15)",
            border: `1px solid ${isLast ? "transparent" : "rgba(232,98,42,0.35)"}`,
            color: isLast ? "#fff" : "#E8622A",
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
            "Next Screen"
          )}
        </button>

        {step > 0 && !isLast && <button onClick={finish} style={navSkipButton}>Skip</button>}
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

function WelcomeSlide({ name }: { name?: string }) {
  return (
    <div style={{ textAlign: "center", width: "100%", maxWidth: 560 }}>
      <div style={heroIconWrap}>
        <Logo variant="flame" style={{ width: 36, height: 36, objectFit: "contain" }} />
      </div>
      <div style={eyebrowStyle("#E8622A")}>Welcome to Foundry</div>
      <h1 style={heroTitleStyle}>{name ? `You're in, ${name}.` : "You're in."}</h1>
      <p style={heroBodyStyle}>This quick walkthrough shows where each core screen lives and what you would actually use it for.</p>
    </div>
  );
}

function HubGuideSlide({ step }: { step: GuideStep }) {
  return (
    <GuidedLayout
      accent={step.accent!}
      preview={(
        <div style={mockWindowStyle}>
          <MockWindowHeader title="Hub" />
          <div style={{ padding: 18, display: "grid", gap: 12 }}>
            <div style={{ ...mockCardStyle, borderColor: "rgba(76,175,138,0.32)", background: "rgba(76,175,138,0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: "#F0EDE8", fontWeight: 600 }}>Current Stage</div>
                <Target size={15} color="#48BB78" />
              </div>
              <div style={{ fontSize: 20, color: "#F0EDE8", fontFamily: "'Playfair Display', Georgia, serif" }}>Stage 2</div>
              <div style={{ fontSize: 12, color: "#9CA39A", marginTop: 6 }}>Planning • 3 of 5 milestones complete</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={mockCardStyle}><div style={mockLabelStyle}>Budget</div><div style={mockValueStyle}>$4,800</div></div>
              <div style={mockCardStyle}><div style={mockLabelStyle}>Runway</div><div style={mockValueStyle}>14 weeks</div></div>
            </div>
            <div style={mockCardStyle}>
              <div style={mockLabelStyle}>Recent Decision</div>
              <div style={{ fontSize: 13, color: "#DAD4CB", lineHeight: 1.6 }}>Focus launch on local meal-prep subscriptions before adding corporate orders.</div>
            </div>
          </div>
        </div>
      )}
      callout={<CalloutCard step={step} />}
    />
  );
}

function ForgeGuideSlide({ step }: { step: GuideStep }) {
  return (
    <GuidedLayout
      accent={step.accent!}
      preview={(
        <div style={mockWindowStyle}>
          <MockWindowHeader title="Forge" />
          <div style={{ padding: 16, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["Milestones", "Budget", "Strategy"].map((item, index) => (
                <div key={item} style={{ padding: "6px 10px", borderRadius: 999, fontSize: 11, color: index === 0 ? "#E8622A" : "#8D857B", border: `1px solid ${index === 0 ? "rgba(232,98,42,0.32)" : "rgba(255,255,255,0.08)"}`, background: index === 0 ? "rgba(232,98,42,0.1)" : "rgba(255,255,255,0.03)" }}>
                  {item}
                </div>
              ))}
            </div>
            <MockBubble role="forge" text="You have enough signal to validate pricing this week. Let's tighten the offer before you build more." />
            <MockBubble role="user" text="What should I test first?" />
            <MockBubble role="forge" text="Start with one paid offer, one audience, and one conversion path. Keep the test narrow enough to actually learn from it." />
          </div>
        </div>
      )}
      callout={<CalloutCard step={step} />}
    />
  );
}

function MenuGuideSlide({ step }: { step: GuideStep }) {
  return <GuidedLayout accent={step.accent!} preview={<SidebarPreview targetLabel={step.targetLabel!} />} callout={<CalloutCard step={step} />} />;
}

function FinishSlide() {
  return (
    <div style={{ textAlign: "center", width: "100%", maxWidth: 560 }}>
      <div style={heroIconWrap}><Rocket size={34} color="#E8622A" strokeWidth={1.6} /></div>
      <div style={eyebrowStyle("#E8622A")}>You're Ready</div>
      <h2 style={heroTitleStyle}>Now you know where to go.</h2>
      <p style={heroBodyStyle}>Use the Hub to orient, Forge to move, and the menu tools when you need depth, structure, practice, or research.</p>
    </div>
  );
}

function GuidedLayout({ preview, callout, accent }: { preview: ReactNode; callout: ReactNode; accent: string }) {
  return (
    <div style={{ width: "100%", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <div style={{ flex: "1 1 420px", maxWidth: 520, minWidth: 280 }}>{preview}</div>
      <div style={{ width: 52, height: 52, borderRadius: "50%", border: `1px solid ${accent}30`, background: `${accent}12`, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
        <ArrowRight size={22} color={accent} />
      </div>
      <div style={{ flex: "1 1 320px", maxWidth: 420, minWidth: 280 }}>{callout}</div>
    </div>
  );
}

function SidebarPreview({ targetLabel }: { targetLabel: string }) {
  return (
    <div style={mockWindowStyle}>
      <MockWindowHeader title="Hub Menu" />
      <div style={{ padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 10 }}>
          <Menu size={15} color="#9B9287" />
          <div style={{ fontSize: 12, color: "#F0EDE8", fontWeight: 600 }}>Foundry Navigation</div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {MENU_ITEMS.map(({ label, sub, icon: Icon }) => {
            const active = label === targetLabel;
            return (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, border: `1px solid ${active ? "rgba(232,98,42,0.35)" : "rgba(255,255,255,0.06)"}`, background: active ? "rgba(232,98,42,0.12)" : "rgba(255,255,255,0.025)", boxShadow: active ? "0 0 0 1px rgba(232,98,42,0.05) inset" : "none" }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: active ? "rgba(232,98,42,0.16)" : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={16} color={active ? "#E8622A" : "#C8C4BE"} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: active ? "#F0EDE8" : "#D3CDC4", fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 11, color: active ? "#C7A48E" : "#7C746A", marginTop: 2 }}>{sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CalloutCard({ step }: { step: GuideStep }) {
  const Icon = step.targetIcon || Flame;
  return (
    <div style={{ background: "rgba(12,12,14,0.94)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 22, padding: 24, boxShadow: "0 24px 70px rgba(0,0,0,0.3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: `${step.accent}18`, border: `1px solid ${step.accent}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={20} color={step.accent} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={eyebrowStyle(step.accent!)}>{step.eyebrow}</div>
          <div style={{ fontSize: 26, lineHeight: 1.2, color: "#F0EDE8", fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}>{step.title}</div>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75, color: "rgba(240,237,232,0.68)", fontFamily: "'Lora', Georgia, serif" }}>{step.body}</p>
      <div style={detailBoxStyle}>
        <div style={detailLabelStyle}>Where to find it</div>
        <div style={detailBodyStyle}>{step.location}</div>
      </div>
      <div style={detailBoxStyle}>
        <div style={detailLabelStyle}>What to use it for</div>
        <div style={detailBodyStyle}>{step.useFor}</div>
      </div>
    </div>
  );
}

function MockWindowHeader({ title }: { title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Logo variant="flame" style={{ width: 18, height: 18, objectFit: "contain" }} />
        <div style={{ fontSize: 12, color: "#F0EDE8", fontWeight: 600 }}>{title}</div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>{[0, 1, 2].map((dot) => <div key={dot} style={{ width: 6, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.14)" }} />)}</div>
    </div>
  );
}

function MockBubble({ role, text }: { role: "forge" | "user"; text: string }) {
  const isForge = role === "forge";
  return (
    <div style={{ display: "flex", justifyContent: isForge ? "flex-start" : "flex-end" }}>
      <div style={{ maxWidth: "85%", padding: "12px 14px", borderRadius: isForge ? "8px 18px 18px 18px" : "18px 8px 18px 18px", background: isForge ? "rgba(255,255,255,0.045)" : "rgba(232,98,42,0.14)", border: `1px solid ${isForge ? "rgba(255,255,255,0.08)" : "rgba(232,98,42,0.28)"}`, color: isForge ? "#E6E0D8" : "#F7E9E3", fontSize: 12, lineHeight: 1.65 }}>
        {text}
      </div>
    </div>
  );
}

const mockWindowStyle: CSSProperties = {
  width: "100%",
  background: "rgba(12,12,14,0.96)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 24,
  overflow: "hidden",
  boxShadow: "0 24px 70px rgba(0,0,0,0.28)",
};

const mockCardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  padding: 14,
};

const mockLabelStyle: CSSProperties = {
  fontSize: 11,
  color: "#8F877D",
  marginBottom: 6,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const mockValueStyle: CSSProperties = {
  fontSize: 18,
  color: "#F0EDE8",
  fontFamily: "'Playfair Display', Georgia, serif",
  fontWeight: 700,
};

const heroIconWrap: CSSProperties = {
  width: 78,
  height: 78,
  borderRadius: "50%",
  background: "rgba(232,98,42,0.12)",
  border: "1px solid rgba(232,98,42,0.25)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto 30px",
};

const heroTitleStyle: CSSProperties = {
  fontSize: "clamp(28px, 8vw, 42px)",
  fontFamily: "'Playfair Display', Georgia, serif",
  fontWeight: 700,
  color: "#F0EDE8",
  lineHeight: 1.15,
  margin: "0 0 18px 0",
  letterSpacing: "-0.4px",
};

const heroBodyStyle: CSSProperties = {
  fontSize: 16,
  fontFamily: "'Lora', Georgia, serif",
  color: "rgba(240,237,232,0.58)",
  lineHeight: 1.75,
  maxWidth: 400,
  margin: "0 auto",
};

const detailBoxStyle: CSSProperties = {
  marginTop: 16,
  padding: "14px 16px",
  borderRadius: 16,
  background: "rgba(255,255,255,0.028)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const detailLabelStyle: CSSProperties = {
  fontSize: 11,
  color: "#8F877D",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: 8,
  fontWeight: 600,
};

const detailBodyStyle: CSSProperties = {
  fontSize: 13,
  color: "#DDD7CF",
  lineHeight: 1.7,
};

const navPrimaryButton: CSSProperties = {
  borderRadius: 14,
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
};

const navSecondaryButton: CSSProperties = {
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
};

const navSkipButton: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "rgba(240,237,232,0.3)",
  fontSize: 13,
  fontFamily: "'DM Sans', sans-serif",
  fontWeight: 500,
  padding: "12px 8px",
  cursor: "pointer",
};

function eyebrowStyle(color: string): CSSProperties {
  return {
    fontSize: 11,
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 600,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color,
    marginBottom: 12,
  };
}
