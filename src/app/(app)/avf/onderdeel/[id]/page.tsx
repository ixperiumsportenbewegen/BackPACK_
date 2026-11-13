import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AvfEditor } from "@/components/avf/AvfEditor";
import { OnderdeelEditor } from "@/components/avf/OnderdeelEditor";
import { StapNavigatie } from "@/components/avf/StapNavigatie";
import { laadEigenAvf } from "@/lib/avfData";
import { getProfiel } from "@/lib/profiel";

export const metadata = { title: "Onderdeel · BackPACK_" };

const FASE_LABEL = { kop: "Kop", romp: "Romp", staart: "Staart" } as const;

export default async function OnderdeelPagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "projectgroep") redirect("/belevenissen");
  const avf = await laadEigenAvf();
  if (!avf) redirect("/");
  const onderdeel = avf.onderdelen.find((o) => o.id === id);
  if (!onderdeel) notFound();
  const inFase = avf.onderdelen.filter((o) => o.fase === onderdeel.fase).sort((a, b) => a.volgorde - b.volgorde);
  const nr = inFase.findIndex((o) => o.id === onderdeel.id);
  const buur = (o: (typeof inFase)[number] | undefined) =>
    o ? { href: `/avf/onderdeel/${o.id}`, label: `${inFase.indexOf(o) + 1}. ${o.naam?.trim() || "Onderdeel zonder naam"}` } : null;
  const terugNaarFase = { href: `/avf/D?fase=${onderdeel.fase}`, label: `Terug naar de ${FASE_LABEL[onderdeel.fase].toLowerCase()} met alle onderdelen` };

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/avf/D?fase=${onderdeel.fase}`} className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Sectie D · {FASE_LABEL[onderdeel.fase]}
      </Link>
      <h1 className="text-3xl">{onderdeel.naam?.trim() || "Onderdeel zonder naam"}</h1>
      <AvfEditor vergrendeld={avf.status === "ingediend"}>
        <OnderdeelEditor key={onderdeel.id} onderdeel={onderdeel} avfId={avf.id} clusterId={avf.clusterId} />
      </AvfEditor>
      <StapNavigatie vorige={buur(inFase[nr - 1])} volgende={buur(inFase[nr + 1])} terug={terugNaarFase} laatsteLabel={`Klaar: naar de ${FASE_LABEL[onderdeel.fase].toLowerCase()}`} />
    </div>
  );
}
