import { createBrowserClient } from "@supabase/ssr";

/** Supabase-client in de browser, met de sessie van de ingelogde gebruiker (anon key, nooit de service role). */
export function maakBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
