import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PaginaKop } from "@/components/PaginaKop";
import { getProfiel } from "@/lib/profiel";
import { laadCategorieen, laadLijstStatus, laadMaterialen } from "@/lib/materialen";
import { MateriaalBeheer } from "./MateriaalBeheer";

export const metadata = { title: "Materialenlijst · BackPACK_" };

export default async function MaterialenPagina() {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "stuurgroep" && profiel.soort !== "docent") redirect("/");

  const status = await laadLijstStatus();
  const logistiek = profiel.stuurgroeprol?.code === "logistiek_facilitair";
  const clusterCode = profiel.stuurgroeprol ? (profiel.cluster?.code ?? "") : "";
  // Zelfde regels als in de database: de docent en Logistiek & Facilitair van VD (en TEST) bouwen de lijst;
  // Logistiek & Facilitair van VC mag toevoegen zodra de lijst definitief is.
  const kanBeheren = profiel.soort === "docent" || (logistiek && (clusterCode === "VD" || clusterCode === "TEST"));
  const kanToevoegen = kanBeheren || (logistiek && clusterCode === "VC" && status.status === "definitief");
  const [materialen, categorieen] = await Promise.all([laadMaterialen(), laadCategorieen()]);
  const mag = kanBeheren || status.status === "definitief";

  return (
    <div className="flex flex-col gap-4">
      <Link href="/stuurgroep/rol/logistiek_facilitair" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Logistiek &amp; Facilitair
      </Link>
      <PaginaKop titel="Materialenlijst" foto="ochtend-tentterrein" />
      <p className="text-zacht">
        Eén lijst voor VD en VC. Logistiek &amp; Facilitair van VD schat per materiaal in hoeveel er op de camping en op het bivak aanwezig moet zijn en maakt de lijst
        daarna definitief. Dan kunnen projectgroepen kiezen en kan VC materialen toevoegen.
      </p>
      <Link href="/stuurgroep/materialen/behoefte" className="flex min-h-aanraak items-center justify-between rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
        Behoefte en tekorten per belevenis <ChevronRight aria-hidden className="size-5" />
      </Link>
      {mag ? (
        <MateriaalBeheer materialen={materialen} categorieen={categorieen} status={status} kanBeheren={kanBeheren} kanToevoegen={kanToevoegen} isDocent={profiel.soort === "docent"} />
      ) : (
        <p role="status" className="rounded-han border-2 border-kop bg-vlak p-4 font-medium text-kop">
          De materialenlijst wordt nog opgebouwd door Logistiek &amp; Facilitair van VD. Zodra hij definitief is, zie je hem hier en kun je materialen toevoegen die nog ontbreken.
        </p>
      )}
    </div>
  );
}
