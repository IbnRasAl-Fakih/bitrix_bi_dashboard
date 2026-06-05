/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#1d70f7',
          600: '#155bd4',
          700: '#1748a6'
        }
      },
      boxShadow: {
        panel: '0 14px 36px rgba(30, 47, 78, 0.08)'
      }
    }
  },
  plugins: []
};
