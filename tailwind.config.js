/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        dark: {
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          600: '#475569',
        },
        brand: {
          50:  '#fff7ed',
          100: '#ffedd5',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
        },
        // MODIFIÉ : la palette "orange" est réécrite en vert — c'est LE
        // changement qui fait basculer toute l'app d'un coup, puisque
        // chaque écran utilise des classes Tailwind bg-orange-500,
        // text-orange-600, focus:ring-orange-500, etc. Rien d'autre à
        // toucher ailleurs dans le code.
        orange: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22a559', // vert principal — proche du logo Ougoul
          600: '#16803c',
          700: '#116530',
          800: '#0f5028',
          900: '#0d4222',
        },
      }
    },
  },
  plugins: [],
}