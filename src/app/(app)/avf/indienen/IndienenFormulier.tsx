"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquareText, Send, TriangleAlert } from "lucide-react";
import { avfIndienen, avfTerFeedbackIndienen } from "@/app/(app)/beoordeling-actions";
import { AVF_NAAM_SLEUTEL, NaamVeld, useNaam } from "@/components/NaamVeld";

export interface OpenVerzoek {
  id: string;
  sectie: string;
  tekst: string;
}

type Soort = "feedback" | "definitief";

/**
 * Het indienformulier. Twee soorten indienen:
 *  - ter feedback: mag onvolledig; de stuurgroep geeft feedback en geeft het AVF daarna terug (zo vaak als nodig);
 *  - definitief: alleen als alle verplichte velden zijn ingevuld; alleen zo kan het AVF worden goedgekeurd.
 * Naam en een korte toelichting zijn nodig bij elke indiening ter feedback; bij definitief indienen vanaf versie 2.
 * Staan er nog verbeterverzoeken open waar niets aan is aangepast, dan is een bewuste bevestiging nodig.
 */
export function IndienenFormulier({
  versie, openVerzoeken, kanDefinitief,
}: { versie: number; openVerzoeken: OpenVerzoek[]; kanDefinitief: boolean }) {
  const router = useRouter();
  const [naam, setNaam] = useNaam(AVF_NAAM_SLEUTEL);
  const [samenvatting, setSamenvatting] = useState("");
  const [bevestigd, setBevestigd] = useState(false);
  const [bezig, setBezig] = useState<Soort | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [ontbrekend, setOntbrekend] = useState<string[]>([]);
  const [open, setOpen] = useState<OpenVerzoek[]>(openVerzoeken);

  const volgende = versie + 1;
  const eerder = versie >= 1; // er is al eerder ingediend: dit is versie 2 of hoger

  async function verstuur(soort: Soort) {
    setFout(null);
    setOntbrekend([]);
    if (!naam.trim()) return setFout("Vul eerst je naam in.");
    if (soort === "feedback" && !samenvatting.trim()) {
      return setFout("Beschrijf kort wat jullie hebben ingevuld of aangepast en waar jullie feedback op willen.");
    }
    if (soort === "definitief" && eerder && !samenvatting.trim()) {
      return setFout("Beschrijf kort wat jullie hebben aangepast sinds de vorige keer.");
    }
    if (open.length > 0 && !bevestigd) return setFout("Vink aan dat je toch wilt indienen, of pas eerst de genoemde onderdelen aan.");
    setBezig(soort);
    const res = soort === "feedback" ? await avfTerFeedbackIndienen(naam, samenvatting, bevestigd) : await avfIndienen(naam, samenvatting, bevestigd);
    setBezig(null);
    if (res.status === "ok") return router.refresh();
    if (res.status === "ontbreekt") return setOntbrekend(res.ontbrekend);
    if (res.status === "open_verzoeken") {
      setOpen(res.verzoeken);
      return setFout("Er staan nog verbeterverzoeken open die jullie niet hebben aangepast. Lees ze hieronder.");
    }
    setFout(res.melding);
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4 rounded-han border-2 border-kop bg-vlak p-4">
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

      <label className="flex flex-col gap-1 font-medium text-kop">
        {eerder ? "Wat hebben jullie aangepast?" : "Wat hebben jullie ingevuld?"}
        <textarea
          value={samenvatting} onChange={(e) => setSamenvatting(e.target.value)} rows={4} maxLength={1000}
          placeholder={eerder
            ? "Bijvoorbeeld: weerplan aangescherpt en veiligheid bij de romp aangevuld."
            : "Bijvoorbeeld: sectie A en B zijn klaar. Graag feedback op de beginsituatie."}
          className="rounded-han border-2 border-zacht bg-vlak p-3 text-base font-normal text-tekst"
        />
        <span className="text-sm font-normal text-zacht">
          De stuurgroep leest dit bij de nieuwe versie. Ter feedback indienen: vertel ook waar jullie feedback op willen.
          {eerder ? "" : " Bij definitief indienen mag je dit leeg laten."}
        </span>
      </label>

      {ontbrekend.length > 0 && (
        <div role="alert" className="rounded-han border-2 border-fout p-3">
          <p className="font-bold text-kop">Nog niet compleet</p>
          <ul className="list-disc pl-5 text-tekst">{ontbrekend.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}
      {fout && <p role="alert" className="font-bold text-fout">{fout}</p>}

      <div className="flex flex-col gap-2 rounded-han border border-rand p-3">
        <p className="font-bold text-kop">Nog niet klaar? Vraag feedback</p>
        <p className="text-sm text-zacht">
          Dien het AVF in zoals het nu is. De stuurgroep leest wat er al staat, geeft feedback en geeft het daarna terug.
          Daarna gaan jullie verder. Dat kan zo vaak als nodig. Een AVF dat ter feedback is ingediend, kan nog niet worden goedgekeurd.
        </p>
        <button
          type="button" disabled={bezig !== null} onClick={() => void verstuur("feedback")}
          className="flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop disabled:opacity-60"
        >
          <MessageSquareText aria-hidden className="size-5" />
          {bezig === "feedback" ? "Bezig met indienen…" : `Dien ter feedback in (versie ${volgende})`}
        </button>
      </div>

      <div className="flex flex-col gap-2 rounded-han border border-rand p-3">
        <p className="font-bold text-kop">Alles ingevuld? Dien definitief in</p>
        <p className="text-sm text-zacht">
          {kanDefinitief
            ? "Na het definitief indienen kunnen jullie het AVF lezen maar niet meer wijzigen, tot de stuurgroep het beoordeeld heeft."
            : "Definitief indienen kan pas als alle verplichte velden zijn ingevuld. Zie de controlelijst hierboven."}
        </p>
        <button
          type="button" disabled={bezig !== null || !kanDefinitief} onClick={() => void verstuur("definitief")}
          className="flex min-h-aanraak items-center justify-center gap-2 rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60"
        >
          <Send aria-hidden className="size-5" /> {bezig === "definitief" ? "Bezig met indienen…" : `Dien het AVF in${eerder ? ` (versie ${volgende})` : ""}`}
        </button>
      </div>
    </form>
  );
}
