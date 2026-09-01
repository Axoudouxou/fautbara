import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { brokeredPreviewStorage } from "@/integrations/supabase/previewAuthStorage";

declare global {
  interface Window {
    __BARA_BACKEND_CONFIG__?: {
      url?: string;
      publishableKey?: string;
    };
  }
}

function isNewApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createCloudFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewApiKey(apiKey) && headers.get("Authorization") === `Bearer ${apiKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

function createCloudClient() {
  const runtimeConfig = typeof window === "undefined" ? undefined : window.__BARA_BACKEND_CONFIG__;
  const serverUrl = typeof window === "undefined" ? process.env["SUPABASE_URL"] : undefined;
  const serverPublishableKey =
    typeof window === "undefined" ? process.env["SUPABASE_PUBLISHABLE_KEY"] : undefined;
  const url = runtimeConfig?.url ?? import.meta.env["VITE_SUPABASE_URL"] ?? serverUrl;
  const publishableKey =
    runtimeConfig?.publishableKey ??
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
    serverPublishableKey;

  if (!url || !publishableKey) {
    throw new Error("La configuration du backend BARA est indisponible.");
  }

  return createClient<Database>(url, publishableKey, {
    global: { fetch: createCloudFetch(publishableKey) },
    auth: {
      storage: brokeredPreviewStorage(),
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let cloudClient: ReturnType<typeof createCloudClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createCloudClient>, {
  get(_, property, receiver) {
    cloudClient ??= createCloudClient();
    return Reflect.get(cloudClient, property, receiver);
  },
});