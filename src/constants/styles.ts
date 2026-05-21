export const DESIGN_TOKENS = {
  // Use semantic Tekori tokens. Avoid hardcoded component colors unless necessary.
  colors: {
    background: "var(--color-bg-soft)",
    surfacePrimary: "var(--color-surface)",
    surfaceElevated: "var(--color-surface-elevated)",
    surfaceControl: "rgba(7,26,47,0.045)",
    brandOrange: "var(--tekori-gold)",
    emberHighlight: "var(--tekori-amber)",
    deepEmber: "var(--color-accent-hover)",
    intelligenceBlue: "var(--tekori-muted-text)",
    positiveGreen: "var(--color-success)",
    warningAmber: "var(--tekori-amber)",
    destructiveRed: "#D96A55",
    neutralData: "var(--tekori-muted-text)",
    textPrimary: "var(--color-text)",
    textSecondary: "var(--color-text-soft)",
    textMuted: "var(--color-text-muted)",
    textDisabled: "rgba(7,26,47,0.48)",
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
  @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Manrope:wght@400;500;600;700;800&display=swap');
  :root {
    --foundry-bg: ${DESIGN_TOKENS.colors.background};
    --foundry-bg-app: ${DESIGN_TOKENS.colors.background};
    --foundry-surface-primary: ${DESIGN_TOKENS.colors.surfacePrimary};
    --foundry-surface-elevated: ${DESIGN_TOKENS.colors.surfaceElevated};
    --foundry-surface-control: ${DESIGN_TOKENS.colors.surfaceControl};
    --foundry-gold: ${DESIGN_TOKENS.colors.brandOrange};
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
  body { min-height: 100vh; min-height: -webkit-fill-available; overscroll-behavior: none; font-family: var(--tekori-font-ui); }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(7,26,47,0.1); border-radius: 2px; }
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
  Legal: { bg: "rgba(142,160,181,0.12)", text: "var(--tekori-muted-text)" },
  Strategy: { bg: "rgba(216,155,43,0.12)", text: "var(--tekori-gold)" },
  Market: { bg: "rgba(72,187,120,0.12)", text: "var(--color-success)" },
  Finance: { bg: "rgba(244,182,66,0.12)", text: "var(--tekori-amber)" },
} as const;
