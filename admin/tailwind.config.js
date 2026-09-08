export default {
  content: [
    './resources/**/*.blade.php',
    './resources/**/*.jsx',
    './resources/**/*.js',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      colors: {
        travs: {
          green: '#1f7a4d',
          sky: '#39a7d8',
          mist: '#f5faf8',
          ink: '#14211b',
        },
      },
    },
  },
  plugins: [],
};
