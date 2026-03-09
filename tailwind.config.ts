import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#ff6b35",
          600: "#ea5a20",
          700: "#c2490a",
          800: "#9a3a0d",
          900: "#7c300e",
          950: "#431a06",
        },
        bg: "#0a0a0b",
        surface: { DEFAULT: "#1a1a1b", alt: "#1f1f23", hover: "#252526" },
        border: { DEFAULT: "#2a2a2b", light: "#3a3a3b" },
        text: { primary: "#e8dcc8", secondary: "#e8dcc8b3", muted: "#e8dcc873" },
        accent: { DEFAULT: "#ff6b35", hover: "#ff7d4d", dim: "#ff6b3540" },
      },
      fontFamily: {
        sans: ["DM Sans", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        display: ["Instrument Serif", "Georgia", "serif"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
    },
  },
  plugins: [],
};

export default config;
