/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#070b18',
          900: '#0b1120',
          800: '#111a2e',
          700: '#182238',
          600: '#243350',
        },
        brand: {
          400: '#7c9bff',
          500: '#5b7cfa',
          600: '#4a63e8',
          700: '#3b4fc4',
        },
        violet: {
          500: '#8b5cf6',
          600: '#7c3aed',
        },
        role: {
          admin: '#7c3aed',
          hod: '#0f9d78',
          faculty: '#2563eb',
          student: '#e0672b',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(91, 124, 250, 0.25)',
      },
    },
  },
  plugins: [],
}
