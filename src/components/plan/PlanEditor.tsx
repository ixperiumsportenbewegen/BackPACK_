"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Plus, Trash2, TriangleAlert } from "lucide-react";
import {
  groepsappLinkOpslaan, planItemToevoegen, planItemVeldOpslaan, planItemVerplaatsen, planItemVerwijderen, planOvernemen, planVeldOpslaan,
  type PlanResultaat,
} from "@/app/(app)/calamiteitenplan-actions";
import { NaamVeld, useNaam } from "@/components/NaamVeld";
import { useAutoBewaar } from "@/components/useAutoBewaar";
import type { PlanLijst, PlanVeld, PlanVeldSoort } from "@/config/calamiteitenplan";
import type { PlanItem } from "@/lib/calamiteitenplan";

const NAAM_SLEUTEL = "backpack_plannaam";

const NaamContext = createContext<{ naam: string }>({ naam: "" });
const usePlanNaam = () => useContext(NaamContext);

/** Omhult het bewerkscherm: vraagt één keer per telefoon om de naam van wie invult (komt in het logboek). */
export function PlanBewerker({ children }: { children: React.ReactNode }) {
  const [naam, setNaam] = useNaam(NAAM_SLEUTEL);
  return (
    <NaamContext.Provider value={{ naam }}>
      <div className="flex flex-col gap-4">
        <section className="rounded-han border border-rand bg-vlak p-4">
          <NaamVeld naam={naam} setNaam={setNaam} label="Wie werkt hier? (jouw naam)" />
          <p className="mt-2 text-sm text-zacht">
            Jullie delen één account. Met je naam zien anderen wie het laatst iets wijzigde. Wijzigingen worden direct opgeslagen en
            staan meteen voor iedereen in het cluster zichtbaar.
          </p>
        </section>
        {children}
      </div>
    </NaamContext.Provider>
  );
}

type Melding = { soort: "bezig" | "ok" | "fout" | "waarschuwing"; tekst: string };

const schoon = (t: string | null | undefined) => (t ?? "").trim();

/**
 * Eén veld dat opslaat terwijl je typt en bij het verlaten. Heeft iemand anders het veld net gewijzigd, dan komt er een
 * waarschuwing met de huidige tekst in plaats van een overschrijving.
 */
function OpslaanVeld({
  id, label, ariaLabel, hulp, soort, maxLengte, begin, opslaan,
}: {
  id: string;
  label: string;
  ariaLabel?: string;
  hulp?: string;
  soort: PlanVeldSoort;
  maxLengte: number;
  begin: string | null;
  opslaan: (oud: string, nieuw: string, naam: string) => Promise<PlanResultaat>;
}) {
  const { naam } = usePlanNaam();
  const naamRef = useRef(naam);
  useEffect(() => {
    naamRef.current = naam;
  });
  const [tekst, setTekst] = useState(begin ?? "");
  const tekstRef = useRef(begin ?? "");
  const opgeslagenRef = useRef(schoon(begin));
  const [melding, setMelding] = useState<Melding | null>(null);
  const [conflict, setConflict] = useState<{ huidig: string | null; mijn: string } | null>(null);

  async function bewaarWaarde(nieuw: string) {
    if (!naamRef.current.trim()) {
      setMelding({ soort: "fout", tekst: "Vul bovenaan eerst je naam in." });
      return;
    }
    setMelding({ soort: "bezig", tekst: "Bezig met opslaan…" });
    const res = await opslaan(opgeslagenRef.current, nieuw, naamRef.current);
    if (res.status === "ok") {
      opgeslagenRef.current = nieuw;
      setConflict(null);
      setMelding({ soort: "ok", tekst: "Opgeslagen" });
    } else if (res.status === "conflict") {
      setConflict({ huidig: res.huidig, mijn: nieuw });
      setMelding({ soort: "waarschuwing", tekst: "Iemand anders heeft dit net gewijzigd." });
    } else {
      setMelding({ soort: "fout", tekst: res.melding });
    }
  }

  async function bewaar() {
    // de nieuwste waarden staan in refs, zodat een opslag die direct na een andere volgt niets oudere gebruikt
    const nieuw = schoon(tekstRef.current);
    if (nieuw === opgeslagenRef.current) return;
    await bewaarWaarde(nieuw);
  }

  const auto = useAutoBewaar(tekst, bewaar, { actief: !conflict });
  const gedeeld = {
    id, "aria-label": ariaLabel, value: tekst, maxLength: maxLengte, autoComplete: "off",
    onBlur: () => void auto.bewaarNu(),
    className: "w-full rounded-han border-2 border-zacht bg-vlak px-3 text-base text-tekst",
  };
  function wijzig(waarde: string) {
    tekstRef.current = waarde;
    setTekst(waarde);
  }

  return (
    <div>
      <label htmlFor={id} className="block font-medium text-kop">{label}</label>
      {hulp && <p className="text-sm text-zacht">{hulp}</p>}
      {soort === "lang" ? (
        <textarea {...gedeeld} rows={4} onChange={(e) => wijzig(e.target.value)} className={`${gedeeld.className} mt-1 py-2`} />
      ) : (
        <input
          {...gedeeld} onChange={(e) => wijzig(e.target.value)} className={`${gedeeld.className} mt-1 min-h-aanraak`}
          inputMode={soort === "tel" ? "tel" : soort === "link" ? "url" : "text"}
        />
      )}

      {conflict && (
        <div role="alert" className="mt-2 rounded-han border-2 border-kop bg-vlak p-3">
          <p className="font-medium text-kop">Iemand anders heeft dit net gewijzigd. Nu staat er: “{conflict.huidig ?? "(leeg)"}”</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                wijzig(conflict.huidig ?? "");
                opgeslagenRef.current = schoon(conflict.huidig);
                setConflict(null);
                setMelding(null);
              }}
              className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop"
            >
              Hun versie houden
            </button>
            <button
              type="button"
              onClick={() => {
                opgeslagenRef.current = schoon(conflict.huidig);
                void bewaarWaarde(conflict.mijn);
              }}
              className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk"
            >
              Mijn versie bewaren
            </button>
          </div>
        </div>
      )}

      <p
        aria-live="polite"
        role={melding?.soort === "fout" ? "alert" : undefined}
        className={`mt-1 min-h-5 text-sm font-medium ${melding?.soort === "fout" ? "text-fout" : "text-kop"}`}
      >
        {melding?.soort === "ok" && <Check aria-hidden className="mr-1 inline size-4" />}
        {melding?.soort === "waarschuwing" && <TriangleAlert aria-hidden className="mr-1 inline size-4" />}
        {melding?.tekst}
      </p>
    </div>
  );
}

/** Een los tekstveld van het plan. */
export function PlanTekstVeld({ clusterId, veld, begin }: { clusterId: string; veld: PlanVeld; begin: string | null }) {
  return (
    <OpslaanVeld
      id={`plan-${veld.sleutel}`} label={veld.label} hulp={veld.hulp} soort={veld.soort} maxLengte={veld.maxLengte} begin={begin}
      opslaan={(oud, nieuw, naam) => planVeldOpslaan(clusterId, veld.sleutel, oud, nieuw, naam)}
    />
  );
}

/** De link naar de groepsapp voor noodmeldingen. */
export function GroepsappLinkVeld({ clusterId, begin }: { clusterId: string; begin: string | null }) {
  return (
    <OpslaanVeld
      id="plan-groepsapp" label="Link naar de groepsapp (WhatsApp)" soort="link" maxLengte={1000} begin={begin}
      hulp="Een link die begint met https://. Iedereen in het cluster ziet hem bovenaan het plan. Laat leeg als er (nog) geen groepsapp is."
      opslaan={(_oud, nieuw, naam) => groepsappLinkOpslaan(clusterId, nieuw, naam)}
    />
  );
}

/** Een lijst met regels (contactpersonen, ziekenhuizen, situaties, …): toevoegen, wijzigen, verplaatsen en verwijderen. */
export function PlanLijstEditor({ clusterId, lijst, items }: { clusterId: string; lijst: PlanLijst; items: PlanItem[] }) {
  const router = useRouter();
  const { naam } = usePlanNaam();
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [teVerwijderen, setTeVerwijderen] = useState<string | null>(null);

  async function uitvoeren(actie: () => Promise<PlanResultaat | { status: "ok"; id: string } | { status: "fout"; melding: string }>) {
    setFout(null);
    if (!naam.trim()) return setFout("Vul bovenaan eerst je naam in.");
    setBezig(true);
    const res = await actie();
    setBezig(false);
    if (res.status === "ok") {
      setTeVerwijderen(null);
      router.refresh();
    } else if (res.status === "fout") setFout(res.melding);
    else setFout("Iemand anders heeft dit net gewijzigd. Ververs de pagina.");
  }

  const knop = "flex min-h-aanraak min-w-aanraak items-center justify-center rounded-han border-2 border-rand bg-vlak text-kop disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 && <p className="rounded-han border border-rand bg-vlak p-3 text-zacht">{lijst.leegTekst}</p>}
      <ol className="flex flex-col gap-3">
        {items.map((item, n) => (
          <li key={item.id} className="rounded-han border-2 border-rand bg-vlak p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg">{lijst.itemNaam} {n + 1}</h3>
              <div className="flex gap-1">
                <button type="button" disabled={bezig || n === 0} aria-label={`${lijst.itemNaam} ${n + 1} omhoog`} className={knop}
                  onClick={() => void uitvoeren(() => planItemVerplaatsen(clusterId, item.id, true, naam))}>
                  <ArrowUp aria-hidden className="size-5" />
                </button>
                <button type="button" disabled={bezig || n === items.length - 1} aria-label={`${lijst.itemNaam} ${n + 1} omlaag`} className={knop}
                  onClick={() => void uitvoeren(() => planItemVerplaatsen(clusterId, item.id, false, naam))}>
                  <ArrowDown aria-hidden className="size-5" />
                </button>
                <button type="button" disabled={bezig} aria-label={`${lijst.itemNaam} ${n + 1} verwijderen`} className={knop}
                  onClick={() => setTeVerwijderen(teVerwijderen === item.id ? null : item.id)}>
                  <Trash2 aria-hidden className="size-5" />
                </button>
              </div>
            </div>
            {teVerwijderen === item.id && (
              <div role="alert" className="mt-2 rounded-han border-2 border-actie p-3">
                <p className="font-bold text-kop">Deze regel verwijderen?</p>
                <p className="text-sm text-zacht">De inhoud blijft bewaard in het logboek, maar verdwijnt uit het plan.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" disabled={bezig} className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60"
                    onClick={() => void uitvoeren(() => planItemVerwijderen(clusterId, item.id, naam))}>
                    Ja, verwijderen
                  </button>
                  <button type="button" className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop" onClick={() => setTeVerwijderen(null)}>
                    Annuleren
                  </button>
                </div>
              </div>
            )}
            <div className="mt-2 flex flex-col gap-2">
              {lijst.velden.map((veld) => (
                <OpslaanVeld
                  key={veld.sleutel} id={`plan-${item.id}-${veld.sleutel}`} label={veld.label} ariaLabel={`${lijst.itemNaam} ${n + 1}, ${veld.label}`}
                  hulp={veld.hulp} soort={veld.soort} maxLengte={veld.maxLengte} begin={item.velden[veld.sleutel] ?? null}
                  opslaan={(oud, nieuw, wie) => planItemVeldOpslaan(clusterId, lijst.sleutel, item.id, veld.sleutel, oud, nieuw, wie)}
                />
              ))}
            </div>
          </li>
        ))}
      </ol>
      {fout && <p role="alert" className="font-bold text-fout">{fout}</p>}
      <button
        type="button" disabled={bezig} onClick={() => void uitvoeren(() => planItemToevoegen(clusterId, lijst.sleutel, naam))}
        className="flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop disabled:opacity-60"
      >
        <Plus aria-hidden className="size-5" /> {lijst.toevoegenLabel}
      </button>
    </div>
  );
}

/** Alleen voor de docent: het plan van een ander cluster overnemen (het plan van dit cluster wordt vervangen). */
export function OvernemenPaneel({ naarClusterId, naarNaam, bronnen }: { naarClusterId: string; naarNaam: string; bronnen: { id: string; naam: string }[] }) {
  const router = useRouter();
  const { naam } = usePlanNaam();
  const [bron, setBron] = useState(bronnen[0]?.id ?? "");
  const [bevestigd, setBevestigd] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [bericht, setBericht] = useState<{ fout: boolean; tekst: string } | null>(null);

  async function neemOver() {
    setBericht(null);
    if (!naam.trim()) return setBericht({ fout: true, tekst: "Vul bovenaan eerst je naam in." });
    setBezig(true);
    const res = await planOvernemen(bron, naarClusterId, naam);
    setBezig(false);
    if (res.status === "ok") {
      setBevestigd(false);
      setBericht({ fout: false, tekst: `Overgenomen: ${res.velden} tekstvelden en ${res.regels} regels.` });
      router.refresh();
    } else setBericht({ fout: true, tekst: res.melding });
  }

  return (
    <section aria-label="Plan overnemen" className="flex flex-col gap-3 rounded-han border-2 border-kop bg-vlak p-4">
      <h2 className="text-xl">Plan overnemen van een ander cluster</h2>
      <p className="text-tekst">Kopieert het hele calamiteitenplan van een ander cluster naar {naarNaam}. De groepsapp-link wordt niet meegekopieerd.</p>
      <label className="flex flex-col gap-1 font-medium text-kop">
        Overnemen van
        <select value={bron} onChange={(e) => setBron(e.target.value)} className="min-h-aanraak rounded-han border-2 border-zacht bg-vlak px-3 text-base font-normal text-tekst">
          {bronnen.map((b) => <option key={b.id} value={b.id}>{b.naam}</option>)}
        </select>
      </label>
      <label className="flex min-h-aanraak items-start gap-3 font-medium text-kop">
        <input type="checkbox" checked={bevestigd} onChange={(e) => setBevestigd(e.target.checked)} className="mt-1 size-6 shrink-0" />
        Ik weet dat het plan van {naarNaam} wordt vervangen. Wat er nu staat gaat verloren.
      </label>
      {bericht && <p role={bericht.fout ? "alert" : "status"} className={`font-bold ${bericht.fout ? "text-fout" : "text-kop"}`}>{bericht.tekst}</p>}
      <button
        type="button" disabled={bezig || !bevestigd || !bron} onClick={() => void neemOver()}
        className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60"
      >
        {bezig ? "Bezig met overnemen…" : "Plan overnemen"}
      </button>
    </section>
  );
}
