import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { MateriaalMelding } from "@/lib/materialenTypes";

/** Waarschuwing voor een projectgroep: een gekozen materiaal is niet meer beschikbaar of er is een tekort. */
export function MateriaalMeldingen({ meldingen }: { meldingen: MateriaalMelding[] }) {
  if (meldingen.length === 0) return null;
  return (
    <section role="alert" aria-label="Let op bij de materialen" className="rounded-han border-2 border-actie bg-vlak p-4">
      <h2 className="flex items-center gap-2 text-xl"><TriangleAlert aria-hidden className="size-6" /> Let op bij jullie materialen</h2>
      <ul className="mt-2 list-disc pl-5 text-tekst">
        {meldingen.map((m) => <li key={m.materiaal}>{m.tekst}</li>)}
      </ul>
      <p className="mt-2 text-sm text-zacht">Kies iets anders of vraag meer aan bij sectie F, zodat jullie er op tijd op kunnen anticiperen.</p>
      <Link href="/avf/F" className="mt-2 flex min-h-aanraak items-center justify-center rounded-han bg-merk px-4 font-bold text-op-merk">Naar de materialen (sectie F)</Link>
    </section>
  );
}
