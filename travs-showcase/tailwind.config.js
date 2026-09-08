export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#10201a',
        lagoon: '#0f766e',
        palm: '#1f7a4d',
        shell: '#f7fbf8',
        coral: '#ef7f5f',
        sun: '#f8c35d',
      },
      boxShadow: {
        soft: '0 24px 80px rgba(16, 32, 26, 0.14)',
        glass: '0 18px 60px rgba(15, 118, 110, 0.16)',
      },
    },
  },
  plugins: [],
};
