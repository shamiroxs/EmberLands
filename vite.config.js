import { defineConfig } from "vite"

export default {
    root: '.',
    server: {
      open: true,
    },
    build: {
      target: 'esnext'
    }
  }
  