import type { Config } from "tailwindcss";

// Palette drawn from the trade: lagoon teal for the brand, brass (keys, door
// furniture) for money waiting to come in, signboard red for what is late.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "system-ui", "sans-serif"],
      },
      colors: {
        ink: { 50: "#F4F5F2", 100: "#E9ECE7", 200: "#DDE2DB", 300: "#BAC3BC", 400: "#8A9591", 500: "#6A7672", 600: "#55625E", 700: "#3D4946", 800: "#2A3532", 900: "#16211F", 950: "#0E1716" },
        brand: { 50: "#EEF6F6", 100: "#D6EAEB", 200: "#AED5D8", 300: "#7DB9BE", 400: "#4A979E", 500: "#257B84", 600: "#14656E", 700: "#0F535B", 800: "#0D444B", 900: "#0B383E" },
        brass: { 50: "#FBF5E9", 100: "#F4E5C4", 200: "#E9CE93", 400: "#CFA046", 500: "#B47F20", 600: "#946718", 700: "#755214", 800: "#5B4012" },
        late: { 50: "#FCEFEC", 100: "#F8D9D2", 200: "#F0B4A8", 300: "#E48A78", 400: "#D5624D", 500: "#C2412D", 600: "#A53422", 700: "#85291B" },
        chart: { billed: "#00889C", collected: "#B47F20" },
      },
      boxShadow: {
        paper: "0 1px 1px rgba(22,33,31,.06), 0 12px 28px -12px rgba(22,33,31,.22), 0 40px 80px -40px rgba(22,33,31,.25)",
        pop: "0 8px 30px -8px rgba(22,33,31,.28)",
      },
    },
  },
  plugins: [],
};
export default config;
