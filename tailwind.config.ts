import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // SCSP Space Race-inspired dark palette
        ink: "#0a0e14",
        panel: "#11161f",
        edge: "#1e2735",
        accent: "#3b82f6",
        signal: "#22d3ee",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
