import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Dev: npm run dev on :5173, API calls go to uvicorn on :8000. Production: FastAPI serves dist/.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
});
