"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, TriangleAlert } from "lucide-react";
import { avfIndienen } from "@/app/(app)/beoordeling-actions";
import { AVF_NAAM_SLEUTEL, NaamVeld, useNaam } from "@/components/NaamVeld";

export interface OpenVerzoek {
  id: string;
  sectie: string;
  tekst: string;
}

/**
 * Het indienformulier: naam, vanaf versie 2 een wijzigingssamenvatting, en als er nog verbeterverzoeken open staan
 * een melding met wat er nog openstaat. Toch indienen kan, maar alleen met een bewuste bevestiging.
 */
export function IndienenFormulier({ versie, openVerzoeken }: { versie: number; openVerzoeken: OpenVerzoek[] }) {
  const router = useRouter();
  const [naam, setNaam] = useNaam(AVF_NAAM_SLEUTEL);
  const [samenvatting, setSamenvatting] = useState("");
  const [bevestigd, setBevestigd] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [ontbrekend, setOntbrekend] = useState<string[]>([]);
  const [open, setOpen] = useState<OpenVerzoek[]>(openVerzoeken);

  const metSamenvatting = versie >= 1; // dit is dan versie 2 of hoger

  async function verstuur(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    setOntbrekend([]);
    if (!naam.trim()) return setFout("Vul eerst je naam in.");
    if (metSamenvatting && !samenvatting.trim()) return setFout("Beschrijf kort wat jullie hebben aangepast sinds de vorige keer.");
    if (open.length > 0 && !bevestigd) return setFout("Vink aan dat je toch wilt indienen, of pas eerst de genoemde onderdelen aan.");
    setBezig(true);
    const res = await avfIndienen(naam, samenvatting, bevestigd);
    setBezig(false);
    if (res.status === "ok") return router.refresh();
    if (res.status === "ontbreekt") return setOntbrekend(res.ontbrekend);
    if (res.status === "open_verzoeken") {
      setOpen(res.verzoeken);
      return setFout("Er staan nog verbeterverzoeken open die jullie niet hebben aangepast. Lees ze hieronder.");
    }
    setFout(res.melding);
  }

  return (
    <form onSubmit={verstuur} className="flex flex-col gap-4 rounded-han border-2 border-kop bg-vlak p-4">
      <h2 className="text-xl">Indienen</h2>

      {open.length > 0 && (
        <div role="alert" className="rounded-han border-2 border-actie p-3">
          <p className="flex items-center gap-2 font-bold text-kop">
            <TriangleAlert aria-hidden className="size-5 shrink-0" /> Hier is nog niets aan aangepast
          </p>
          <p className="text-sm text-zacht">De stuurgroep vroeg om aanpassingen. Het systeem ziet nog geen wijziging op deze plekken.</p>
          <ul className="mt-2 flex flex-col gap-2">
            {open.map((v) => (
              <li key={v.id} className="rounded-han border border-rand p-2">
                <Link href={`/avf/${v.sectie}`} className="font-bold text-kop underline">Sectie {v.sectie}</Link>
                <p className="whitespace-pre-wrap text-tekst">{v.tekst}</p>
              </li>
            ))}
          </ul>
          <label className="mt-3 flex min-h-aanraak items-start gap-3 font-medium text-kop">
            <input
              type="checkbox" checked={bevestigd} onChange={(e) => setBevestigd(e.target.checked)}
              className="mt-1 size-6 shrink-0"
            />
            Ik dien toch in. We hebben dit bewust niet aangepast, bijvoorbeeld omdat het al goed was.
          </label>
        </div>
      )}

      <NaamVeld naam={naam} setNaam={setNaam} label="Wie dient in? (jouw naam)" />

      {metSamenvatting && (
        <label className="flex flex-col gap-1 font-medium text-kop">
          Wat hebben jullie aangepast?
          <textarea
            value={samenvatting} onChange={(e) => setSamenvatting(e.target.value)} rows={4} maxLength={1000}
            placeholder="Bijvoorbeeld: weerplan aangescherpt en veiligheid bij de romp aangevuld."
            className="rounded-han border-2 border-zacht bg-vlak p-3 text-base font-normal text-tekst"
          />
          <span className="text-sm font-normal text-zacht">De stuurgroep leest dit bij de nieuwe versie.</span>
        </label>
      )}

      {ontbrekend.length > 0 && (
        <div role="alert" className="rounded-han border-2 border-fout p-3">
          <p className="font-bold text-kop">Nog niet compleet</p>
          <ul className="list-disc pl-5 text-tekst">{ontbrekend.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}
      {fout && <p role="alert" className="font-bold text-fout">{fout}</p>}

      <button
        type="submit" disabled={bezig}
        className="flex min-h-aanraak items-center justify-center gap-2 rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60"
      >
        <Send aria-hidden className="size-5" /> {bezig ? "Bezig met indienen…" : `Dien het AVF in${metSamenvatting ? ` (versie ${versie + 1})` : ""}`}
      </button>
      <p className="text-sm text-zacht">Na het indienen kunnen jullie het AVF lezen maar niet meer wijzigen, tot de stuurgroep het beoordeeld heeft.</p>
    </form>
  );
}
