"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getProfiel } from "@/lib/profiel";
import { maakBeheerClient } from "@/lib/supabase/beheer";
import { maakServerClient } from "@/lib/supabase/server";

const ALFABET = "abcdefghjkmnpqrstuvwxyz23456789"; // zonder tekens die op elkaar lijken

/** Een wachtwoord als abcd-efgh-jkmn: goed te dicteren en te typen op een telefoon. */
function nieuwWachtwoord(): string {
  const groep = () => Array.from({ length: 4 }, () => ALFABET[randomInt(ALFABET.length)]).join("");
  return `${groep()}-${groep()}-${groep()}`;
}

async function docent() {
  const profiel = await getProfiel();
  return profiel && profiel.soort === "docent" ? profiel : null;
}

export type ResetResultaat =
  | { status: "ok"; gebruikersnaam: string; wachtwoord: string }
  | { status: "fout"; melding: string };

/**
 * Maakt een nieuw wachtwoord voor een account en trekt alle sessies van dat account in, zodat iedereen
 * opnieuw moet inloggen. Alleen de docent; het wachtwoord wordt één keer getoond en nergens bewaard.
 */
export async function wachtwoordResetten(accountId: string): Promise<ResetResultaat> {
  const profiel = await docent();
  if (!profiel) return { status: "fout", melding: "Alleen de docent kan wachtwoorden resetten." };
  const beheer = maakBeheerClient();
  if (!beheer) return { status: "fout", melding: "Wachtwoorden resetten is nog niet ingesteld op de server (de geheime sleutel ontbreekt)." };

  const supabase = await maakServerClient();
  const { data: account } = await supabase.from("account").select("id, gebruikersnaam, soort, cluster_id").eq("id", accountId).maybeSingle();
  if (!account) return { status: "fout", melding: "Dit account bestaat niet." };
  if (account.soort === "docent") return { status: "fout", melding: "Het docentaccount reset je niet hier: dan log je jezelf uit." };

  const wachtwoord = nieuwWachtwoord();
  const { error } = await beheer.auth.admin.updateUserById(account.id, { password: wachtwoord });
  if (error) return { status: "fout", melding: "Het wachtwoord kon niet worden aangepast. Probeer het opnieuw." };
  await beheer.rpc("account_sessies_verwijderen", { p_user_id: account.id });
  await beheer.from("wijziging").insert({
    tabel: "account", record_id: account.id, actie: "wachtwoord_gereset", account_id: null, naam: "Docent",
    cluster_id: account.cluster_id, details: { gebruikersnaam: account.gebruikersnaam },
  });
  revalidatePath("/beheer");
  return { status: "ok", gebruikersnaam: account.gebruikersnaam, wachtwoord };
}

export type LinkResultaat = { status: "ok" } | { status: "fout"; melding: string };

function geldigeLink(tekst: string): string | null | "ongeldig" {
  const t = tekst.trim();
  if (t === "") return null;
  return /^https:\/\/\S+$/.test(t) && t.length <= 1000 ? t : "ongeldig";
}

/** Teams-link en Forms-link van een cluster (docent). Een lege waarde haalt de link weg. */
export async function clusterLinksOpslaan(clusterId: string, teams: string, forms: string): Promise<LinkResultaat> {
  if (!(await docent())) return { status: "fout", melding: "Alleen de docent kan de links aanpassen." };
  const t = geldigeLink(teams);
  const f = geldigeLink(forms);
  if (t === "ongeldig" || f === "ongeldig") return { status: "fout", melding: "Een link begint met https:// en bevat geen spaties." };
  const supabase = await maakServerClient();
  const { data, error } = await supabase.from("cluster").update({ teams_link: t }).eq("id", clusterId).select("id");
  if (error || !data?.length) return { status: "fout", melding: "De Teams-link kon niet worden opgeslagen." };
  const res = await supabase.rpc("cluster_forms_link_zetten", { p_cluster_id: clusterId, p_link: f as string, p_naam: "Docent" });
  if (res.error || !(res.data as { ok: boolean }).ok) return { status: "fout", melding: "De Forms-link kon niet worden opgeslagen." };
  revalidatePath("/", "layout");
  return { status: "ok" };
}

/** De Forms-link van het eigen cluster (Communicatie & Financiën, of de docent). */
export async function formsLinkOpslaan(clusterId: string, link: string, naam: string): Promise<LinkResultaat> {
  const profiel = await getProfiel();
  if (!profiel || (profiel.soort !== "stuurgroep" && profiel.soort !== "docent")) return { status: "fout", melding: "Alleen de stuurgroep kan de Forms-link instellen." };
  if (!naam.trim()) return { status: "fout", melding: "Vul eerst je naam in." };
  const l = geldigeLink(link);
  if (l === "ongeldig") return { status: "fout", melding: "Een link begint met https:// en bevat geen spaties." };
  const supabase = await maakServerClient();
  const { data, error } = await supabase.rpc("cluster_forms_link_zetten", { p_cluster_id: clusterId, p_link: l as string, p_naam: naam.trim().slice(0, 60) });
  if (error) return { status: "fout", melding: "Alleen Communicatie & Financiën van dit cluster (en de docent) kan de Forms-link instellen." };
  if (!(data as { ok: boolean }).ok) return { status: "fout", melding: "De link kon niet worden opgeslagen." };
  revalidatePath("/", "layout");
  return { status: "ok" };
}
