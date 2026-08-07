/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        felt: "#0a5c3e",
        rail: "#3a1d0e",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
