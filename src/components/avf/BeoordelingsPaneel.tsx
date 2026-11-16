"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Hourglass, TriangleAlert } from "lucide-react";
import { aanpassingVragen, goedkeuren } from "@/app/(app)/beoordeling-actions";
import { NaamVeld, useNaam } from "@/components/NaamVeld";

type Status = "in_ontwikkeling" | "ingediend" | "aanpassing_gevraagd" | "goedgekeurd";

/** Knoppen "Aanpassing vragen" en "Goedkeuren" met naam, voor stuurgroep en docent. */
export function BeoordelingsPaneel({
  avfId, status, opnieuw, tussentijds, open, aangepast, ingediend, goedgekeurd,
}: {
  avfId: string;
  status: Status;
  opnieuw: boolean;
  /** De laatste indiening was ter feedback: de stuurgroep geeft het AVF terug in plaats van het goed te keuren. */
  tussentijds: boolean;
  open: number;
  aangepast: number;
  ingediend: string | null;
  goedgekeurd: string | null;
}) {
  const router = useRouter();
  const [naam, setNaam] = useNaam();
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [bevestigOpen, setBevestigOpen] = useState<number | null>(null);

  const terFeedback = status === "ingediend" && tussentijds;
  const kanVragen = status === "ingediend" || status === "goedgekeurd";
  const kanGoedkeuren = (status === "ingediend" && !tussentijds) || (status === "goedgekeurd" && opnieuw);
  // Bij een indiening ter feedback mag de stuurgroep ook zonder verbeterverzoek teruggeven.
  const kanTerugGeven = kanVragen && (open > 0 || terFeedback);

  async function vraag() {
    setFout(null);
    setBezig(true);
    const res = await aanpassingVragen(avfId, naam);
    setBezig(false);
    if (res.status === "ok") router.refresh();
    else setFout(res.melding);
  }

  async function keur(bevestigd: boolean) {
    setFout(null);
    setBezig(true);
    const res = await goedkeuren(avfId, naam, bevestigd);
    setBezig(false);
    if (res.status === "ok") {
      setBevestigOpen(null);
      router.refresh();
    } else if (res.status === "open_verzoeken") setBevestigOpen(res.aantal);
    else setFout(res.melding);
  }

  return (
    <section aria-label="Beoordelen" className="flex flex-col gap-3 rounded-han border-2 border-kop bg-vlak p-4">
      <h2 className="text-xl">Beoordelen</h2>

      {status === "in_ontwikkeling" && (
        <p className="flex items-start gap-2 text-tekst"><Hourglass aria-hidden className="mt-0.5 size-5 shrink-0" /> De groep is nog bezig. Beoordelen kan zodra het AVF is ingediend.</p>
      )}
      {terFeedback && (
        <p className="flex items-start gap-2 text-tekst">
          <Hourglass aria-hidden className="mt-0.5 size-5 shrink-0" />
          Dit AVF is ter feedback ingediend en nog niet compleet. Lees wat er al staat en plaats verbeterverzoeken. Geef het daarna terug aan de groep. Goedkeuren kan pas na een definitieve indiening.
        </p>
      )}
      {status === "aanpassing_gevraagd" && (
        <p className="flex items-start gap-2 text-tekst"><Hourglass aria-hidden className="mt-0.5 size-5 shrink-0" /> De groep past het AVF aan. Je ziet het hier weer zodra het opnieuw is ingediend.</p>
      )}
      {ingediend && <p className="text-sm text-zacht">{ingediend}</p>}
      {goedgekeurd && status === "goedgekeurd" && (
        <p className="flex items-start gap-2 font-medium text-kop"><CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0" /> {goedgekeurd}</p>
      )}
      {opnieuw && (
        <p className="flex items-start gap-2 font-bold text-kop">
          <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" /> Opnieuw te controleren: de groep heeft na de goedkeuring iets belangrijks gewijzigd.
        </p>
      )}
      <p className="text-sm text-zacht">
        {open} open · {aangepast} aangepast door de groep
      </p>

      {(kanVragen || kanGoedkeuren) && (
        <>
          <NaamVeld naam={naam} setNaam={setNaam} label="Wie beoordeelt? (jouw naam)" />
          {bevestigOpen !== null && (
            <div role="alert" className="rounded-han border-2 border-actie p-3">
              <p className="font-bold text-kop">Er {bevestigOpen === 1 ? "staat nog 1 verzoek" : `staan nog ${bevestigOpen} verzoeken`} open.</p>
              <p className="text-tekst">Bij goedkeuren worden alle verzoeken afgehandeld. Weet je het zeker?</p>
              <button type="button" disabled={bezig} onClick={() => keur(true)} className="mt-2 min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">
                Toch goedkeuren
              </button>
            </div>
          )}
          {fout && <p role="alert" className="font-bold text-fout">{fout}</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {kanGoedkeuren && (
              <button type="button" disabled={bezig} onClick={() => keur(false)} className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">
                {status === "goedgekeurd" ? "Opnieuw goedkeuren" : "Goedkeuren"}
              </button>
            )}
            {kanVragen && (
              <button
                type="button" disabled={bezig || !kanTerugGeven} onClick={vraag}
                className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop disabled:opacity-60"
              >
                {terFeedback ? "Feedback teruggeven" : "Aanpassing vragen"}
              </button>
            )}
          </div>
          {kanVragen && open > 0 && <p className="text-sm text-zacht">De groep ziet de verbeterverzoeken pas nadat je op {terFeedback ? "Feedback teruggeven" : "Aanpassing vragen"} hebt getikt.</p>}
          {kanVragen && open === 0 && !terFeedback && <p className="text-sm text-zacht">Aanpassing vragen kan zodra je minstens één verbeterverzoek hebt geplaatst bij een sectie of onderdeel.</p>}
          {terFeedback && open === 0 && <p className="text-sm text-zacht">Je kunt ook teruggeven zonder verbeterverzoek, bijvoorbeeld als het er goed uitziet. De groep kan dan verder.</p>}
        </>
      )}
    </section>
  );
}
