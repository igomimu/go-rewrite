import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    base: './',
    plugins: [react()],
    server: {
        open: false,
    },
    build: {
        rollupOptions: {
            input: {
                main: 'index.html',
                background: 'src/background.ts',
            },
            output: {
                entryFileNames: '[name].js',
            },
        },
    },
})
