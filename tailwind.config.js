/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.jsx",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // 🌑 Base (Dark UI)
        "background": "#0B0B0B",
        "surface": "#1A1A1A",
        "surface-alt": "#2A2A2A",
        "border": "#333333",

        // 📝 Text
        "text-primary": "#FFFFFF",
        "text-secondary": "#B3B3B3",
        "text-muted": "#7A7A7A",

        // 🌿 Accent (Green System)
        "accent": "#4ADE80", // main
        "accent-hover": "#22C55E", // pressed
        "accent-soft": "#163D2A", // subtle bg
        "accent-glow": "#86EFAC", // highlight
      },
    },
  },
  plugins: [],
};
