/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}', './src/sections/**/*.{js,ts,jsx,tsx,mdx}', './src/components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      backgroundImage: {
        'custom-gradient': 'linear-gradient(rgb(20, 20, 20) 0%, rgb(64, 2, 94) 15.26%, rgb(18, 0, 40) 45.75%, rgb(0, 0, 10) 98.77%)',
      },
    },
    container: {
      center: true,
      padding: {
        DEFAULT: '20px',
        lg: '80px',
      },
      screens: {
        sm: '375px',
        md: '768px',
        lg: '1200px',
      },
    },
    screens: {
      sm: '375px',
      md: '768px',
      lg: '1200px',
    },
  },
  daisyui: {
    themes: ['lofi'],
  },
  plugins: [require('daisyui')],
}
