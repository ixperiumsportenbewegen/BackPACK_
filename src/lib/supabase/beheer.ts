import { createClient } from "@supabase/supabase-js";

/**
 * Supabase-client met de service role key, alleen voor beheeracties op de server (bijvoorbeeld een wachtwoord resetten).
 * Nooit importeren in code die in de browser draait. De sleutel staat in SUPABASE_SERVICE_ROLE_KEY (niet openbaar).
 */
export function maakBeheerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sleutel = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !sleutel) return null;
  return createClient(url, sleutel, { auth: { autoRefreshToken: false, persistSession: false } });
}
