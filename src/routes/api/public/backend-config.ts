import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/backend-config")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env["SUPABASE_URL"];
        const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];

        if (!url || !publishableKey) {
          return new Response("throw new Error('Backend configuration unavailable');", {
            status: 503,
            headers: { "content-type": "application/javascript; charset=utf-8" },
          });
        }

        const config = JSON.stringify({ url, publishableKey }).replaceAll("<", "\\u003c");
        return new Response(`globalThis.__BARA_BACKEND_CONFIG__=${config};`, {
          headers: {
            "content-type": "application/javascript; charset=utf-8",
            "cache-control": "no-store, max-age=0",
          },
        });
      },
    },
  },
});