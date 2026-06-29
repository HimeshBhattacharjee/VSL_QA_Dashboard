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
            colors: {
                'vsl-red': '#CF181F',
                'accent-primary': '#CF181F',
                brand: {
                    primary: '#CF181F',
                    'primary-hover': '#A9141A',
                    'primary-deep': '#7F0D12',
                    'primary-light': '#FF7A7F',
                    'primary-soft': '#FEF2F2',
                    'primary-muted': '#FEE2E2',
                },
            },
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
