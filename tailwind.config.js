/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      colors: {
        ink: { 950: "#05060f", 900: "#0a0c1b", 800: "#121530", 700: "#1c2045" },
      },
      keyframes: {
        aurora: {
          "0%,100%": { transform: "translate(0,0) scale(1)" },
          "33%": { transform: "translate(6%,-8%) scale(1.15)" },
          "66%": { transform: "translate(-6%,6%) scale(0.95)" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        rise: { "0%": { opacity: 0, transform: "translateY(16px)" }, "100%": { opacity: 1, transform: "none" } },
        flow: { "0%": { backgroundPosition: "0% 50%" }, "100%": { backgroundPosition: "200% 50%" } },
      },
      animation: {
        aurora: "aurora 18s ease-in-out infinite",
        shimmer: "shimmer 1.6s infinite",
        rise: "rise .6s cubic-bezier(.2,.8,.2,1) both",
        flow: "flow 2.5s linear infinite",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
