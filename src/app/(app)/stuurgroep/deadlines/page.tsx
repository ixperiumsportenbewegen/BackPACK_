import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PaginaKop } from "@/components/PaginaKop";
import { laadDeadlines } from "@/lib/deadlineData";
import { getProfiel } from "@/lib/profiel";
import { DeadlinesBeheer } from "./DeadlinesBeheer";

export const metadata = { title: "Deadlines · BackPACK_" };

/** Deadlines instellen voor elk deel van het AVF: voor de stuurgroep van het cluster en de docent. */
export default async function DeadlinesPagina() {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "stuurgroep" && profiel.soort !== "docent") redirect("/");
  const cluster = profiel.cluster;
  if (!cluster) redirect("/");

  const deadlines = await laadDeadlines(cluster.id);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/stuurgroep/rol/projectleiding" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Projectleiding
      </Link>
      <PaginaKop titel="Deadlines" foto="ochtend-tentterrein" />
      <p className="text-zacht">
        Stel voor {cluster.naam} per onderdeel in wanneer het af moet zijn. Een deadline is een afspraak: groepen kunnen na de
        deadline gewoon doorwerken en indienen, maar iedereen ziet wanneer iets af moet zijn en hoe lang het nog duurt.
        Tijden zijn Nederlandse tijd.
      </p>
      <DeadlinesBeheer
        bestaand={deadlines.map((d) => ({
          onderdeel: d.onderdeel, momentIso: d.moment.toISOString(), toelichting: d.toelichting, updatedAt: d.updatedAt, door: d.gezetDoorNaam,
        }))}
      />
    </div>
  );
}
