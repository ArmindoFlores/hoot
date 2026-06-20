import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        headers: {
            "Cache-Control": "public, max-age=60",
        },
        cors: true,
    },
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, "index.html"),
                background: resolve(__dirname, "background.html"),
            },
        },
    },
});
