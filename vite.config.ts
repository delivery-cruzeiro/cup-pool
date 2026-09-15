import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
 base: '/_apps/cup-pool/',
	plugins: [react(), tsconfigPaths()],
	server: {
		host: true,
		port: 5176,
		proxy: {
			'/api': {
				changeOrigin: true,
				target: 'http://backend-api:4000',
			},
		},
		watch: {
			interval: 300,
			usePolling: true,
		},
	},
});
