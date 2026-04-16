export const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:wght@300;400;500;600&display=swap');
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
`;

export const TAG_COLORS = {
  Legal: { bg: "rgba(99,179,237,0.12)", text: "#63B3ED" },
  Strategy: { bg: "rgba(232,98,42,0.12)", text: "#E8622A" },
  Market: { bg: "rgba(72,187,120,0.12)", text: "#48BB78" },
  Finance: { bg: "rgba(245,168,67,0.12)", text: "#F5A843" },
} as const;
