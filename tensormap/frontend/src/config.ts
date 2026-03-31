/** Socket.IO targets the FastAPI server directly (separate from Vite’s /api proxy). */
export const SOCKET_ORIGIN =
  import.meta.env.VITE_SOCKET_ORIGIN ?? 'http://localhost:8000';
