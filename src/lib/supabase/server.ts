import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase-client voor server-code, met de sessie van de ingelogde gebruiker.
 * Met `blijfIngelogd = false` krijgt de sessie een sessiecookie (weg bij sluiten browser).
 */
export async function maakServerClient(blijfIngelogd = true) {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(lijst) {
          try {
            for (const { name, value, options } of lijst) {
              const opts = blijfIngelogd ? options : { ...options, maxAge: undefined, expires: undefined };
              cookieStore.set(name, value, opts);
            }
          } catch {
            // Aanroep vanuit een server component: de proxy ververst de sessie al.
          }
        },
      },
    },
  );
}
