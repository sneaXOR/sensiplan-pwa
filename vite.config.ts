import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
    base: '/sensiplan-pwa/', // Pour GitHub Pages
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icons/*.png'],
            manifest: {
                name: 'SensiPlan - Suivi de Fertilité',
                short_name: 'SensiPlan',
                description: 'Application de suivi de fertilité SensiPlan offline-first',
                theme_color: '#4a7c59',
                background_color: '#ffffff',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/',
                icons: [
                    {
                        src: 'icons/icon-192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: 'icons/icon-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable',
                    },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                            },
                        },
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@sensiplan/rule-engine': path.resolve(__dirname, './packages/rule-engine/src/index.ts'),
        },
    },
    build: {
        target: 'es2020',
        sourcemap: true,
    },
});
