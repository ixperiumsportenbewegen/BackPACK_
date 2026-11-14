"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { aanvraagAfhandelen } from "@/app/(app)/materiaal-actions";
import { NaamVeld, useNaam } from "@/components/NaamVeld";
import type { Aanvraag } from "@/lib/materialenTypes";
import { formatMoment } from "@/lib/tijd";

export type AanvraagMetGroep = Aanvraag & { groepNaam: string; naamMateriaal: string | null };

function Kaart({ a, naam }: { a: AanvraagMetGroep; naam: string }) {
  const router = useRouter();
  const [uitkomst, setUitkomst] = useState("");
  const [bezig, setBezig] = useState<"afgehandeld" | "afgewezen" | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  async function doe(status: "afgehandeld" | "afgewezen") {
    setFout(null);
    if (!naam.trim()) return setFout("Vul bovenaan eerst je naam in.");
    setBezig(status);
    const res = await aanvraagAfhandelen(a.id, status, uitkomst, naam);
    setBezig(null);
    if (res.status === "ok") router.refresh();
    else setFout(res.melding);
  }

  return (
    <li className="rounded-han border-2 border-actie bg-vlak p-3">
      <p className="text-sm font-medium text-zacht">{a.groepNaam}</p>
      <p className="text-lg font-bold text-kop">
        {a.naamMateriaal ?? a.omschrijving}: {a.aantal} nodig{a.naamMateriaal ? "" : " (niet in de lijst)"}
      </p>
      {a.toelichting && <p className="text-tekst">{a.toelichting}</p>}
      <p className="text-sm text-zacht">{a.doorNaam} · {formatMoment(a.createdAt)}</p>
      <label className="mt-2 flex flex-col gap-1 text-sm font-medium text-kop">
        Antwoord aan de groep (verplicht bij afwijzen)
        <textarea
          value={uitkomst} onChange={(e) => setUitkomst(e.target.value)} rows={2} maxLength={500}
          className="rounded-han border-2 border-zacht bg-vlak p-2 text-base font-normal text-tekst"
        />
      </label>
      {fout && <p role="alert" className="mt-1 font-bold text-fout">{fout}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => void doe("afgehandeld")} disabled={bezig !== null} className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">
          {bezig === "afgehandeld" ? "Bezig…" : "Afgehandeld"}
        </button>
        <button type="button" onClick={() => void doe("afgewezen")} disabled={bezig !== null} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop disabled:opacity-60">
          {bezig === "afgewezen" ? "Bezig…" : "Afwijzen"}
        </button>
      </div>
    </li>
  );
}

/** Open aanvragen van projectgroepen om af te handelen, en de afgehandelde ervoor. */
export function AanvragenBeheer({ open, afgehandeld }: { open: AanvraagMetGroep[]; afgehandeld: AanvraagMetGroep[] }) {
  const [naam, setNaam] = useNaam();
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-han border border-rand bg-vlak p-4">
        <NaamVeld naam={naam} setNaam={setNaam} label="Wie werkt hier? (jouw naam)" />
      </section>

      <section aria-labelledby="open-kop" className="flex flex-col gap-3">
        <h2 id="open-kop" className="text-xl">Open aanvragen ({open.length})</h2>
        {open.length === 0 ? (
          <p className="rounded-han border border-rand bg-vlak p-4 text-zacht">Er zijn geen open aanvragen.</p>
        ) : (
          <>
            <p className="text-sm text-zacht">
              Pas eerst zo nodig de <Link href="/stuurgroep/materialen" className="font-bold text-kop underline">materialenlijst</Link> aan (toevoegen of de voorraad verhogen)
              en markeer de aanvraag daarna als afgehandeld. De groep ziet het antwoord bij haar aanvraag.
            </p>
            <ul className="flex flex-col gap-3">{open.map((a) => <Kaart key={a.id} a={a} naam={naam} />)}</ul>
          </>
        )}
      </section>

      {afgehandeld.length > 0 && (
        <details className="rounded-han border border-rand bg-vlak">
          <summary className="flex min-h-aanraak cursor-pointer items-center px-4 font-bold text-kop">Afgehandeld ({afgehandeld.length})</summary>
          <ul className="flex flex-col gap-2 border-t border-rand p-3">
            {afgehandeld.map((a) => (
              <li key={a.id} className="rounded-han border border-rand p-3">
                <p className="text-sm font-medium text-zacht">{a.groepNaam}</p>
                <p className="font-bold text-kop">{a.naamMateriaal ?? a.omschrijving}: {a.aantal} · {a.status === "afgehandeld" ? "Afgehandeld" : "Afgewezen"}</p>
                {a.uitkomst && <p className="text-tekst">{a.uitkomst}</p>}
                <p className="text-sm text-zacht">{a.afgehandeldDoorNaam}{a.afgehandeldOp ? ` · ${formatMoment(a.afgehandeldOp)}` : ""}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
