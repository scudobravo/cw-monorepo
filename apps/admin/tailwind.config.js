/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        admin: {
          bg: "#0a0a12",
          card: "#12121c",
          border: "rgba(255,255,255,0.08)",
          muted: "#6b6b8a",
          accent: "#818cf8",
        },
      },
    },
  },
  plugins: [],
};
