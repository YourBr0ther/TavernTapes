/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3A1078',
          light: '#4E0F9E',
          dark: '#2A0B5A',
        },
        secondary: {
          DEFAULT: '#FFD700',
          light: '#FFE44D',
          dark: '#B39700',
        },
      },
    },
  },
  plugins: [],
} 