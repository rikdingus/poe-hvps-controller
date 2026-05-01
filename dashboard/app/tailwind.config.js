/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f172a',
        card: '#1e293b',
        accent: '#38bdf8',
        secondary: '#f59e0b',
        error: '#ef4444',
      },
    },
  },
  plugins: [],
}
