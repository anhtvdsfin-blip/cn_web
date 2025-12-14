/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        fadeIn: {
          from: {
            opacity: '0',
            transform: 'translateY(6px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
      },
      animation: {
        marquee: 'marquee 20s linear infinite',
        fadeIn: 'fadeIn 0.32s ease-out',
      },
    },
  },
  plugins: [],
}
