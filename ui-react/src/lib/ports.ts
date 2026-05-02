export const UI_DEV_PORT = 3001
export const BACKEND_DEV_PORT = 8001
export const BACKEND_DEV_ORIGIN = 'http://localhost:8001'
export const BACKEND_DOCKER_ORIGIN = 'http://localhost:3001'

export function getServerBackendOrigin() {
  return process.env.OCRUX_ORIGIN || BACKEND_DEV_ORIGIN
}

export function getBrowserBackendOrigin() {
  return import.meta.env.VITE_OCRUX_ORIGIN || ''
}
