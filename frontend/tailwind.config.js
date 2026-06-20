/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        jarvis: {
          bg:       "var(--j-bg)",
          surface:  "var(--j-surface)",
          border:   "var(--j-border)",
          accent:   "var(--j-accent)",
          text1:    "var(--j-text-1)",
          text2:    "var(--j-text-2)",
          text3:    "var(--j-text-3)",
          // legacy aliases kept for backward compat
          cyan:        "#22d3ee",
          "cyan-dim":  "#0e7490",
          muted:       "#374151",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "Fira Code", "Consolas", "monospace"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      boxShadow: {
        "glow-sm":  "0 0 10px rgba(34,211,238,0.15)",
        "glow-md":  "0 0 20px rgba(34,211,238,0.2)",
        "glow-lg":  "0 0 32px rgba(34,211,238,0.25)",
        "card-dark":"0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
        "card-hover":"0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,211,238,0.1)",
        "card-light":"0 1px 4px rgba(0,0,0,0.06), 0 2px 16px rgba(0,0,0,0.04)",
      },
      animation: {
        "fade-in":    "fadeIn 0.25s ease-out both",
        "fade-up":    "fadeUp 0.35s ease-out both",
        "slide-in-left": "slideInLeft 0.3s ease-out both",
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
        "shimmer":    "shimmer 1.6s ease-in-out infinite",
        "ping-slow":  "ping 2.5s cubic-bezier(0,0,0.2,1) infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        slideInLeft: {
          from: { opacity: "0", transform: "translateX(-12px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        pulseGlow: {
          "0%, 100%": { textShadow: "0 0 6px rgba(34,211,238,0.3)" },
          "50%":       { textShadow: "0 0 18px rgba(34,211,238,0.7)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.34,1.56,0.64,1)",
      },
    },
  },
  plugins: [],
};
