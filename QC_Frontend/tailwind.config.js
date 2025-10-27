/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './index.html',
        './pages/**/*.{js,jsx,ts,tsx}',
        './components/**/*.{js,jsx,ts,tsx}',
        './src/**/*.{js,jsx,ts,tsx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                'poppins': ['Poppins', 'sans-serif'],
            },
            animation: {
                'slide-in-right': 'slideInRight 0.3s ease forwards',
            },
            animation: {
                wave: 'wave 0.6s ease-in-out infinite',
            },
            keyframes: {
                slideInRight: {
                    from: { transform: 'translateX(100%)', opacity: '0' },
                    to: { transform: 'translateX(0)', opacity: '1' },
                },
                wave: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-8px)' },
                }
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
            }
        },
    },
    plugins: [require("tailwindcss-animate")],
}