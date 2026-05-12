export const DESIGN_TOKENS = {
  colors: {
    background: "#080809",
    surfacePrimary: "#0E0F11",
    surfaceElevated: "#131416",
    surfaceControl: "rgba(255,255,255,0.045)",
    brandOrange: "#E8622A",
    emberHighlight: "#F5A843",
    deepEmber: "#B9461E",
    intelligenceBlue: "#63B3ED",
    positiveGreen: "#4CAF8A",
    warningAmber: "#D9B15D",
    destructiveRed: "#D96A55",
    neutralData: "#8B8FA3",
    textPrimary: "rgba(255,255,255,0.94)",
    textSecondary: "rgba(255,255,255,0.82)",
    textMuted: "rgba(255,255,255,0.64)",
    textDisabled: "rgba(255,255,255,0.42)",
  },
  radii: {
    control: "10px",
    card: "14px",
    command: "18px",
    pill: "999px",
  },
  motion: {
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    hover: "140ms",
    panel: "320ms",
    page: "380ms",
    progress: "850ms",
  },
} as const;

export const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:wght@300;400;500;600&display=swap');
  :root {
    --foundry-bg: ${DESIGN_TOKENS.colors.background};
    --foundry-bg-app: ${DESIGN_TOKENS.colors.background};
    --foundry-surface-primary: ${DESIGN_TOKENS.colors.surfacePrimary};
    --foundry-surface-elevated: ${DESIGN_TOKENS.colors.surfaceElevated};
    --foundry-surface-control: ${DESIGN_TOKENS.colors.surfaceControl};
    --foundry-orange: ${DESIGN_TOKENS.colors.brandOrange};
    --foundry-ember: ${DESIGN_TOKENS.colors.emberHighlight};
    --foundry-deep-ember: ${DESIGN_TOKENS.colors.deepEmber};
    --foundry-blue: ${DESIGN_TOKENS.colors.intelligenceBlue};
    --foundry-green: ${DESIGN_TOKENS.colors.positiveGreen};
    --foundry-amber: ${DESIGN_TOKENS.colors.warningAmber};
    --foundry-red: ${DESIGN_TOKENS.colors.destructiveRed};
    --foundry-semantic-intelligence: ${DESIGN_TOKENS.colors.intelligenceBlue};
    --foundry-semantic-positive: ${DESIGN_TOKENS.colors.positiveGreen};
    --foundry-semantic-warning: ${DESIGN_TOKENS.colors.warningAmber};
    --foundry-semantic-danger: ${DESIGN_TOKENS.colors.destructiveRed};
    --foundry-neutral-data: ${DESIGN_TOKENS.colors.neutralData};
    --foundry-text-primary: ${DESIGN_TOKENS.colors.textPrimary};
    --foundry-text-secondary: ${DESIGN_TOKENS.colors.textSecondary};
    --foundry-text-muted: ${DESIGN_TOKENS.colors.textMuted};
    --foundry-text-disabled: ${DESIGN_TOKENS.colors.textDisabled};
    --foundry-radius-control: ${DESIGN_TOKENS.radii.control};
    --foundry-radius-card: ${DESIGN_TOKENS.radii.card};
    --foundry-radius-command: ${DESIGN_TOKENS.radii.command};
    --foundry-radius-pill: ${DESIGN_TOKENS.radii.pill};
    --foundry-ease: ${DESIGN_TOKENS.motion.easing};
    --foundry-motion-hover: ${DESIGN_TOKENS.motion.hover};
    --foundry-motion-panel: ${DESIGN_TOKENS.motion.panel};
    --foundry-motion-page: ${DESIGN_TOKENS.motion.page};
    --foundry-motion-progress: ${DESIGN_TOKENS.motion.progress};
  }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  html { height: -webkit-fill-available; }
  body { min-height: 100vh; min-height: -webkit-fill-available; overscroll-behavior: none; font-family: 'Lora', Georgia, serif; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
  textarea { resize: none; outline: none; font: inherit; }
  input { outline: none; font: inherit; }
  button { outline: none; -webkit-tap-highlight-color: transparent; font: inherit; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes forgePulse { 0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
  @keyframes loadingFlameOrbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes micPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  @keyframes typingDot { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-4px); opacity: 1; } }
`;

export const TAG_COLORS = {
  Legal: { bg: "rgba(99,179,237,0.12)", text: "#63B3ED" },
  Strategy: { bg: "rgba(232,98,42,0.12)", text: "#E8622A" },
  Market: { bg: "rgba(72,187,120,0.12)", text: "#48BB78" },
  Finance: { bg: "rgba(245,168,67,0.12)", text: "#F5A843" },
} as const;
