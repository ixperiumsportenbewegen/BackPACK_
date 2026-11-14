import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PaginaKop } from "@/components/PaginaKop";
import { getProfiel } from "@/lib/profiel";
import { laadAanvragenCluster, laadMaterialen } from "@/lib/materialen";
import { AanvragenBeheer } from "./AanvragenBeheer";

export const metadata = { title: "Materiaalaanvragen · BackPACK_" };

/** Aanvragen van projectgroepen om een materiaal of meer voorraad, voor Logistiek & Facilitair (en de rest van de stuurgroep). */
export default async function AanvragenPagina() {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "stuurgroep" && profiel.soort !== "docent") redirect("/");
  const cluster = profiel.cluster;
  if (!cluster) redirect("/");

  const [aanvragen, materialen] = await Promise.all([laadAanvragenCluster(cluster.id), laadMaterialen()]);
  const perId = new Map(materialen.map((m) => [m.id, m.naam]));
  const metNaam = aanvragen.map((a) => ({ ...a, naamMateriaal: a.materiaalId ? (perId.get(a.materiaalId) ?? "Materiaal") : null }));

  return (
    <div className="flex flex-col gap-4">
      <Link href="/stuurgroep/materialen" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Materialenlijst
      </Link>
      <PaginaKop titel="Materiaalaanvragen" foto="ochtend-tentterrein" />
      <p className="text-zacht">Projectgroepen van {cluster.naam} vragen hier materiaal aan dat ontbreekt of waarvan er te weinig is.</p>
      <AanvragenBeheer open={metNaam.filter((a) => a.status === "open")} afgehandeld={metNaam.filter((a) => a.status !== "open")} />
    </div>
  );
}
