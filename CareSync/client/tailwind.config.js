/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#173a45',
        teal: {
          25: '#f5fbf9',
          950: '#123b45',
        },
      },
    },
  },
  plugins: [],
};
