/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        shield: {
          green: "#22c55e",
          yellow: "#eab308",
          red: "#ef4444",
          gray: "#9ca3af",
        },
      },
    },
  },
  plugins: [],
};
