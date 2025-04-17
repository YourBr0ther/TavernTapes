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
          dark: '#2A0B58'
        },
        secondary: {
          DEFAULT: '#FFD700',
          light: '#FFE44D',
          dark: '#B39700'
        },
        background: {
          DEFAULT: '#1C1C1C',
          card: '#212121'
        }
      },
      fontFamily: {
        'sans': ['Inter', 'ui-sans-serif', 'system-ui'],
        'cinzel': ['Cinzel Decorative', 'serif']
      },
      boxShadow: {
        'glow': '0 0 10px rgba(255, 215, 0, 0.3)',
        'glow-lg': '0 0 20px rgba(255, 215, 0, 0.4)'
      },
      animation: {
        'pulse-gold': 'pulse-gold 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('tailwind-scrollbar')
  ]
} 