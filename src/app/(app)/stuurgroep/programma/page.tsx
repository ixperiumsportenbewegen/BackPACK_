import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PaginaKop } from "@/components/PaginaKop";
import { getProfiel } from "@/lib/profiel";
import { laadProgramma } from "@/lib/programmaData";
import { maakServerClient } from "@/lib/supabase/server";
import { ProgrammaBeheer, type GroepRij } from "./ProgrammaBeheer";

export const metadata = { title: "Programma beheren · BackPACK_" };

export default async function ProgrammaBeherenPagina() {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "stuurgroep" && profiel.soort !== "docent") redirect("/programma");
  const cluster = profiel.cluster;
  if (!cluster) redirect("/");

  const supabase = await maakServerClient();
  const [{ regels }, { data: avfs }] = await Promise.all([
    laadProgramma(cluster.id),
    supabase.from("avf").select("id, titel, programma_regel_id, locatie_tekst, projectgroep:projectgroep_id(nummer, naam)").eq("cluster_id", cluster.id),
  ]);
  const groepen: GroepRij[] = (avfs ?? [])
    .map((a) => {
      const pg = a.projectgroep as unknown as { nummer: number; naam: string };
      return { avfId: a.id, nummer: pg.nummer, naam: pg.naam, titel: a.titel, regelId: a.programma_regel_id, locatie: a.locatie_tekst };
    })
    .sort((a, b) => a.nummer - b.nummer);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/stuurgroep" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Stuurgroep
      </Link>
      <PaginaKop titel="Programma beheren" foto="ochtend-tentterrein" />
      <p className="text-zacht">
        Programma &amp; Kwaliteit beheert het programma van {cluster.naam}. Alle stuurgroepaccounts en de docent mogen tijden, locaties en toewijzingen aanpassen.
      </p>
      <ProgrammaBeheer regels={regels} groepen={groepen} />
    </div>
  );
}
