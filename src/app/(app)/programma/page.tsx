import Link from "next/link";
import { ChevronLeft, Pencil } from "lucide-react";
import { PaginaKop } from "@/components/PaginaKop";
import { ProgrammaWeergave } from "@/components/ProgrammaWeergave";
import { getProfiel } from "@/lib/profiel";
import { dagOndertitels } from "@/lib/programma";
import { laadProgramma } from "@/lib/programmaData";

export const metadata = { title: "Programma · BackPACK_" };

export default async function ProgrammaPagina() {
  const profiel = (await getProfiel())!;
  const { regels, toegewezen } = profiel.cluster ? await laadProgramma(profiel.cluster.id) : { regels: [], toegewezen: [] };
  const beheerder = profiel.soort === "stuurgroep" || profiel.soort === "docent";

  return (
    <div className="flex flex-col gap-4">
      <Link href="/" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Onze meerdaagse
      </Link>
      <PaginaKop titel="Programma" foto="ochtend-tentterrein" />
      <p className="text-zacht">
        Het vaste programma van de meerdaagse (28–30 juni 2027). Zes tijdvakken zijn voor de belevenissen van de projectgroepen.
        {profiel.projectgroep && " Wat voor jullie projectgroep geldt, heeft een gekleurde rand."}
      </p>
      {beheerder && (
        <Link href="/stuurgroep/programma" className="flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
          <Pencil aria-hidden className="size-5" /> Programma beheren en groepen toewijzen
        </Link>
      )}
      {regels.length === 0 ? (
        <p className="rounded-han border border-rand bg-vlak p-4 text-zacht">Het programma is nog niet ingevuld.</p>
      ) : (
        <ProgrammaWeergave regels={regels} toegewezen={toegewezen} eigenGroep={profiel.projectgroep?.nummer ?? null} ondertitels={dagOndertitels(profiel.cluster?.code)} />
      )}
    </div>
  );
}
