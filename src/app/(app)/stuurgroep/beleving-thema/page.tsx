import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PaginaKop } from "@/components/PaginaKop";
import { getProfiel } from "@/lib/profiel";
import { ThemaFormulier } from "./ThemaFormulier";

export const metadata = { title: "Beleving & Thema · BackPACK_" };

export default async function BelevingThema() {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "stuurgroep" && profiel.soort !== "docent") redirect("/");
  const cluster = profiel.cluster;
  if (!cluster) redirect("/");

  const t = profiel.thema;
  return (
    <div className="flex flex-col gap-4">
      <Link href="/stuurgroep" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Stuurgroep
      </Link>
      <PaginaKop titel="Beleving & Thema" foto="vuur-avond" />
      <p className="text-zacht">
        Kies het meerdaagsethema van {cluster.naam}. Wat je hier invult is direct zichtbaar voor iedereen in jullie cluster,
        en niemand in een ander cluster ziet het.
      </p>
      <ThemaFormulier
        key={cluster.id}
        clusterId={cluster.id}
        clusterNaam={cluster.naam}
        begin={{
          naam: t?.naam ?? null,
          verhaal: t?.verhaal ?? null,
          slogan: t?.slogan ?? null,
          accentkleur: t?.accentkleur ?? null,
          sfeerbeeld_pad: t?.sfeerbeeld_pad ?? null,
          logo_pad: t?.logo_pad ?? null,
        }}
      />
    </div>
  );
}
