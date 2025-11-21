import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        host: '0.0.0.0', // make it reachable on network
        port: 5173,
        strictPort: false, // optional
    }
})