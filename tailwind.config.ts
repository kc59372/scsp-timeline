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
        // Light editorial palette (SCSP.ai report style) on a US-flag accent set
        paper: "#FFFFFF", // page background
        ink: "#00334E", // navy — headings / dark blocks / footer
        panel: "#F5F6F7", // light grey — cards / subtle sections
        raise: "#ECEEF0", // hover surface (one step darker than panel)
        edge: "#E3E6E9", // borders / dividers (light)
        accent: "#B31942", // light red — primary accent
        "accent-dark": "#851432", // darker red — hover / pressed
        signal: "#B31942", // legacy alias → red accent
        brand: "#0A3161", // flag blue
        navy: "#00334E",
        mist: "#F0F0F0", // light grey
        grey: "#7B7B7B", // grey — muted text
      },
      fontFamily: {
        sans: ["Outfit", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
