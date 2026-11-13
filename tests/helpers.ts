import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

export const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const opties = { auth: { autoRefreshToken: false, persistSession: false } };

/** Alleen voor controle van de uitkomst in tests; nooit in de app. */
export const admin = createClient(URL, SERVICE, opties);

/** Niet ingelogde bezoeker. */
export function anoniem(): SupabaseClient {
  return createClient(URL, ANON, opties);
}

function wachtwoorden(): Record<string, string> {
  const pad = "seed/wachtwoorden.local.json";
  if (!existsSync(pad)) {
    throw new Error("seed/wachtwoorden.local.json ontbreekt: draai eerst `npm run seed`");
  }
  return JSON.parse(readFileSync(pad, "utf8"));
}

const cache = new Map<string, SupabaseClient>();

/** Ingelogd als het testaccount met deze gebruikersnaam. */
export async function inloggenAls(gebruikersnaam: string): Promise<SupabaseClient> {
  const bestaand = cache.get(gebruikersnaam);
  if (bestaand) return bestaand;
  const wachtwoord = wachtwoorden()[gebruikersnaam];
  if (!wachtwoord) throw new Error(`Geen wachtwoord voor ${gebruikersnaam}`);
  const client = createClient(URL, ANON, opties);
  const { error } = await client.auth.signInWithPassword({
    email: `${gebruikersnaam}@ardennen.invalid`,
    password: wachtwoord,
  });
  if (error) throw new Error(`Inloggen als ${gebruikersnaam} mislukt: ${error.message}`);
  cache.set(gebruikersnaam, client);
  return client;
}

/** Alle tabellen uit opdracht 1. */
export const TABELLEN = [
  "editie", "cluster", "cluster_budget", "meerdaagsethema", "stuurgroeprol",
  "projectgroep", "projectgroep_rol", "account", "wijziging",
] as const;

export async function clusterId(code: string): Promise<string> {
  const { data, error } = await admin.from("cluster").select("id").eq("code", code).single();
  if (error) throw new Error(error.message);
  return data.id;
}
