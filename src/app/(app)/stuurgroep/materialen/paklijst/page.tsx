import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PaginaKop } from "@/components/PaginaKop";
import { getProfiel } from "@/lib/profiel";
import { laadCategorieen, laadLijstStatus, laadMaterialen, laadTellingen } from "@/lib/materialen";
import { Paklijst } from "./Paklijst";

export const metadata = { title: "Paklijst · BackPACK_" };

/** De paklijst voor de meerdaagse (inpakken, op locatie, retour). Alle stuurgroepen en de docent mogen hem invullen. */
export default async function PaklijstPagina() {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "stuurgroep" && profiel.soort !== "docent") redirect("/");

  const [materialen, categorieen, tellingen, status] = await Promise.all([laadMaterialen(), laadCategorieen(), laadTellingen(), laadLijstStatus()]);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/stuurgroep/materialen" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Materialenlijst
      </Link>
      <PaginaKop titel="Paklijst" foto="ochtend-tentterrein" />
      <p className="text-zacht">
        Houd bij wat er echt meegaat, wat er op de locatie is en wat er terugkomt, per locatie. Wat er echt is telt direct mee voor de projectgroepen:
        als er minder is dan gepland, krijgen zij daar een melding van.
      </p>
      {status.status !== "definitief" && (
        <p role="status" className="rounded-han border-2 border-actie bg-vlak p-3 font-medium text-kop">De materialenlijst is nog niet gepubliceerd. De aantallen die je hier invult zijn dus nog voorlopig.</p>
      )}
      <Paklijst materialen={materialen} categorieen={categorieen} tellingen={tellingen} />
    </div>
  );
}
