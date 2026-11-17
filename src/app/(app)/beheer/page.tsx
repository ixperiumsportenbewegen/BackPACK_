import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ChevronLeft, Download, FileSpreadsheet } from "lucide-react";
import { PaginaKop } from "@/components/PaginaKop";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";
import { BeheerPaneel, type ClusterBeheer } from "./BeheerPaneel";

export const metadata = { title: "Beheer · BackPACK_" };

/** Beheer voor de docent: alles exporteren, links per cluster en wachtwoorden resetten. */
export default async function Beheer() {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "docent") redirect("/");

  const supabase = await maakServerClient();
  const [{ data: clusters }, { data: accounts }] = await Promise.all([
    supabase.from("cluster").select("id, code, naam, teams_link, forms_link").order("code", { ascending: false }),
    supabase
      .from("account")
      .select("id, gebruikersnaam, soort, cluster_id, projectgroep:projectgroep_id(nummer, naam), stuurgroeprol:stuurgroeprol_id(naam)")
      .neq("soort", "docent").order("gebruikersnaam"),
  ]);

  const perCluster: ClusterBeheer[] = (clusters ?? []).map((c) => ({
    id: c.id, code: c.code, naam: c.naam, teamsLink: c.teams_link, formsLink: c.forms_link,
    accounts: (accounts ?? []).filter((a) => a.cluster_id === c.id).map((a) => {
      const pg = a.projectgroep as unknown as { naam: string } | null;
      const rol = a.stuurgroeprol as unknown as { naam: string } | null;
      return {
        id: a.id, gebruikersnaam: a.gebruikersnaam, soort: a.soort as "stuurgroep" | "projectgroep" | "student",
        label: a.soort === "projectgroep" ? (pg?.naam ?? "Projectgroep") : a.soort === "stuurgroep" ? `Stuurgroep · ${rol?.naam ?? ""}` : "Studenten",
      };
    }),
  }));

  return (
    <div className="flex flex-col gap-5">
      <Link href="/meer" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Meer
      </Link>
      <PaginaKop titel="Beheer" foto="ochtend-tentterrein" />

      <section aria-labelledby="export-kop" className="rounded-han border-2 border-kop bg-vlak p-4">
        <h2 id="export-kop" className="text-xl">Alles exporteren</h2>
        <p className="mt-1 text-tekst">
          Download alle gegevens van beide clusters: AVF&apos;s, budget, materialen, het logboek en meer. Afbeeldingen zitten er niet in.
          Elke week maakt GitHub ook automatisch een export en bewaart die 90 dagen.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <a href="/api/export?formaat=json" className="flex min-h-aanraak items-center justify-center gap-2 rounded-han bg-merk px-4 font-bold text-op-merk">
            <Download aria-hidden className="size-5" /> Exporteren als JSON
          </a>
          <a href="/api/export?formaat=excel" className="flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
            <FileSpreadsheet aria-hidden className="size-5" /> Exporteren als Excel
          </a>
        </div>
      </section>

      <Link href="/beheer/activiteit" className="flex min-h-aanraak items-center gap-3 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
        <Activity aria-hidden className="size-5" strokeWidth={1.75} /> Activiteit: wie heeft ingelogd en gewerkt
      </Link>

      <BeheerPaneel clusters={perCluster} />
    </div>
  );
}
