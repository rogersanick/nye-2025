/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: '#060917',
        moonlight: '#eef2ff',
        gold: '#f7d46a',
        ice: '#7dd3fc',
        aurora: '#a78bfa',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'ny-gradient':
          'radial-gradient(circle at 18% 18%, rgba(247,212,106,0.14), transparent 55%), radial-gradient(circle at 78% 30%, rgba(125,211,252,0.14), transparent 60%), radial-gradient(circle at 45% 85%, rgba(167,139,250,0.14), transparent 60%), linear-gradient(160deg, #060917 0%, #0b1030 100%)',
      },
    },
  },
  plugins: [],
}
