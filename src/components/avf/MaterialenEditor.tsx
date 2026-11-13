"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, TriangleAlert } from "lucide-react";
import {
  aanvullendToevoegen, materiaalAantalWijzigen, materiaalKiezen, materiaalVerwijderen,
} from "@/app/(app)/materiaal-actions";
import { useAvfEditor } from "@/components/avf/AvfEditor";
import { locatieNaam, tekort, vraagVan, type AvfMateriaal, type Beschikbaarheid, type Materiaal } from "@/lib/materialenTypes";

const FASEN = [
  { code: "", naam: "Hele belevenis" },
  { code: "kop", naam: "Kop" },
  { code: "romp", naam: "Romp" },
  { code: "staart", naam: "Staart" },
] as const;

const INVOER = "min-h-aanraak rounded-han border-2 border-zacht bg-vlak px-3 text-base text-tekst";

function Regel({
  r, materiaal, b, eigenVraag, locatie, naam, vergrendeld, onFout,
}: {
  r: AvfMateriaal; materiaal: Materiaal | undefined; b: Beschikbaarheid | undefined; eigenVraag: number;
  locatie: string; naam: string; vergrendeld: boolean; onFout: (m: string | null) => void;
}) {
  const router = useRouter();
  const [aantal, setAantal] = useState(String(r.aantal));
  const [bezig, setBezig] = useState(false);
  const [bevestig, setBevestig] = useState(false);

  async function bewaarAantal() {
    const n = Number(aantal);
    if (n === r.aantal) return;
    onFout(null);
    setBezig(true);
    const res = await materiaalAantalWijzigen(r.id, n, naam);
    setBezig(false);
    if (res.status === "ok") router.refresh();
    else { onFout(res.melding); setAantal(String(r.aantal)); }
  }

  async function verwijder() {
    onFout(null);
    setBezig(true);
    const res = await materiaalVerwijderen(r.id, naam);
    setBezig(false);
    if (res.status === "ok") router.refresh();
    else onFout(res.melding);
  }

  const tk = b ? tekort(eigenVraag, b) : 0;
  const titel = materiaal?.naam ?? r.omschrijving ?? "Materiaal";
  return (
    <li className="rounded-han border-2 border-rand bg-vlak p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 font-bold text-kop">{titel}{!materiaal && " (eigen materiaal)"}</span>
        <label className="flex items-center gap-2 text-sm font-medium text-kop">
          Aantal
          <input
            type="number" inputMode="numeric" min={1} max={9999} value={aantal} disabled={vergrendeld || bezig}
            onChange={(e) => setAantal(e.target.value)} onBlur={() => void bewaarAantal()}
            className={`${INVOER} w-24`} aria-label={`Aantal ${titel}`}
          />
        </label>
      </div>
      {materiaal && !materiaal.actief && (
        <p role="alert" className="mt-2 flex items-start gap-2 font-medium text-kop">
          <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" /> Dit materiaal is niet meer beschikbaar. Kies iets anders of overleg met de stuurgroep.
        </p>
      )}
      {r.aantalGecorrigeerd !== null && (
        <p className="mt-2 text-sm font-medium text-kop">De stuurgroep heeft dit aantal aangepast naar {r.aantalGecorrigeerd}.</p>
      )}
      {tk > 0 && (
        <p role="alert" className="mt-2 flex items-start gap-2 font-medium text-kop">
          <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          Tekort van {tk}. Op de {locatie.toLowerCase()} ligt {b!.voorraad}
          {b!.anderen > 0 ? ` en een andere belevenis gebruikt op hetzelfde moment ${b!.anderen}` : ""}. Jullie hebben {eigenVraag} nodig.
        </p>
      )}
      {!vergrendeld && (
        bevestig ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-medium text-kop">Zeker weten?</span>
            <button type="button" onClick={() => void verwijder()} disabled={bezig} className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">
              {bezig ? "Bezig…" : "Ja, verwijderen"}
            </button>
            <button type="button" onClick={() => setBevestig(false)} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">Nee</button>
          </div>
        ) : (
          <button type="button" onClick={() => setBevestig(true)} className="mt-1 flex min-h-aanraak items-center gap-2 text-sm font-bold text-kop underline">
            <Trash2 aria-hidden className="size-4" /> Verwijderen
          </button>
        )
      )}
    </li>
  );
}

/**
 * Sectie F: materialen kiezen uit de lijst van de stuurgroep. Per materiaal zie je wat er op jullie locatie ligt en wat
 * andere belevenissen op hetzelfde moment gebruiken. Een tekort is een waarschuwing en blokkeert niets.
 */
export function MaterialenEditor({
  locatie, tijdvak, lijstDefinitief, materialen, regels, beschikbaar,
}: {
  locatie: "camping" | "bivak" | null;
  tijdvak: string | null;
  lijstDefinitief: boolean;
  materialen: Materiaal[];
  regels: AvfMateriaal[];
  beschikbaar: Record<string, Beschikbaarheid>;
}) {
  const router = useRouter();
  const { naam, vergrendeld } = useAvfEditor();
  const [materiaalId, setMateriaalId] = useState("");
  const [fase, setFase] = useState("");
  const [aantal, setAantal] = useState("1");
  const [omschrijving, setOmschrijving] = useState("");
  const [aantalEigen, setAantalEigen] = useState("1");
  const [bezig, setBezig] = useState<"lijst" | "eigen" | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const perId = new Map(materialen.map((m) => [m.id, m]));
  const locatieTekst = locatieNaam(locatie);

  if (!locatie) {
    return (
      <section className="rounded-han border-2 border-actie bg-vlak p-4">
        <h2 className="text-xl">Kies eerst de locatie</h2>
        <p className="mt-1 text-tekst">Om materialen te kiezen moeten we weten of de belevenis op de camping of op het bivak is. Dat bepaalt wat er beschikbaar is.</p>
        <Link href="/avf/A" className="mt-2 flex min-h-aanraak items-center justify-center rounded-han bg-merk px-4 font-bold text-op-merk">Naar sectie A</Link>
      </section>
    );
  }

  async function voegToe(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    if (!naam.trim()) return setFout("Vul bovenaan eerst je naam in.");
    if (!materiaalId) return setFout("Kies eerst een materiaal.");
    setBezig("lijst");
    const res = await materiaalKiezen(materiaalId, fase || null, Number(aantal), naam);
    setBezig(null);
    if (res.status === "ok") { setMateriaalId(""); setAantal("1"); router.refresh(); }
    else setFout(res.melding);
  }

  async function voegEigenToe(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    if (!naam.trim()) return setFout("Vul bovenaan eerst je naam in.");
    setBezig("eigen");
    const res = await aanvullendToevoegen(omschrijving, Number(aantalEigen), naam);
    setBezig(null);
    if (res.status === "ok") { setOmschrijving(""); setAantalEigen("1"); router.refresh(); }
    else setFout(res.melding);
  }

  const lijstRegels = regels.filter((r) => r.materiaalId);
  const eigenRegels = regels.filter((r) => !r.materiaalId);
  const vraagPerMateriaal = new Map<string, number>();
  for (const id of new Set(lijstRegels.map((r) => r.materiaalId!))) {
    vraagPerMateriaal.set(id, vraagVan(lijstRegels.filter((r) => r.materiaalId === id)));
  }
  const keuzes = materialen.filter((m) => m.actief);
  const categorieen = [...new Set(keuzes.map((m) => m.categorie ?? "Overig"))];

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-han border border-rand bg-vlak p-4">
        <p className="font-bold text-kop">Locatie: {locatieTekst}</p>
        {tijdvak && <p className="text-tekst">Jullie tijdvak: {tijdvak}</p>}
        <p className="mt-1 text-sm text-zacht">
          Materialen worden na afloop teruggebracht en kunnen daarna opnieuw worden gebruikt. Een tekort ontstaat alleen als jullie
          en een andere belevenis op dezelfde locatie tegelijk te veel nodig hebben. <Link href="/avf/A" className="font-bold text-kop underline">Locatie wijzigen</Link>
        </p>
      </section>

      {!lijstDefinitief ? (
        <p role="status" className="rounded-han border-2 border-kop bg-vlak p-4 font-medium text-kop">
          De materialenlijst is nog niet klaar. Logistiek &amp; Facilitair van de stuurgroep maakt hem eerst definitief. Daarna kunnen jullie hier materialen kiezen.
        </p>
      ) : (
        !vergrendeld && (
          <form onSubmit={voegToe} className="flex flex-col gap-3 rounded-han border-2 border-kop bg-vlak p-4">
            <h2 className="text-xl">Materiaal kiezen</h2>
            <label className="flex flex-col gap-1 font-medium text-kop">
              Materiaal
              <select value={materiaalId} onChange={(e) => setMateriaalId(e.target.value)} className={`${INVOER} font-normal`}>
                <option value="">Kies een materiaal</option>
                {categorieen.map((c) => (
                  <optgroup key={c} label={c}>
                    {keuzes.filter((m) => (m.categorie ?? "Overig") === c).map((m) => {
                      const b = beschikbaar[m.id];
                      const vrij = b ? Math.max(0, b.voorraad - b.anderen) : null;
                      return <option key={m.id} value={m.id}>{m.naam}{vrij !== null ? ` (${vrij} beschikbaar)` : ""}</option>;
                    })}
                  </optgroup>
                ))}
              </select>
            </label>
            {materiaalId && beschikbaar[materiaalId] && (
              <p className="text-sm text-zacht">
                Op de {locatieTekst.toLowerCase()} ligt {beschikbaar[materiaalId].voorraad}.
                {beschikbaar[materiaalId].anderen > 0 && ` Een andere belevenis gebruikt op jullie moment ${beschikbaar[materiaalId].anderen}.`}
                {perId.get(materiaalId)?.opmerking && ` ${perId.get(materiaalId)!.opmerking}`}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 font-medium text-kop">
                Aantal
                <input type="number" inputMode="numeric" min={1} max={9999} value={aantal} onChange={(e) => setAantal(e.target.value)} className={`${INVOER} font-normal`} />
              </label>
              <label className="flex flex-col gap-1 font-medium text-kop">
                Waarvoor
                <select value={fase} onChange={(e) => setFase(e.target.value)} className={`${INVOER} font-normal`}>
                  {FASEN.map((f) => <option key={f.code} value={f.code}>{f.naam}</option>)}
                </select>
              </label>
            </div>
            <button type="submit" disabled={bezig !== null} className="flex min-h-aanraak items-center justify-center gap-2 rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">
              {bezig === "lijst" ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Plus aria-hidden className="size-5" />} {bezig === "lijst" ? "Bezig…" : "Toevoegen"}
            </button>
          </form>
        )
      )}

      {fout && <p role="alert" className="font-bold text-fout">{fout}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl">Gekozen materialen</h2>
        {lijstRegels.length === 0 && <p className="rounded-han bg-achtergrond p-3 text-zacht">Nog geen materialen gekozen. Leeg laten mag.</p>}
        {FASEN.map((f) => {
          const hier = lijstRegels.filter((r) => (r.fase ?? "") === f.code);
          if (hier.length === 0) return null;
          return (
            <div key={f.code || "alle"}>
              <h3 className="mb-1 text-lg">{f.naam}</h3>
              <ul className="flex flex-col gap-2">
                {hier.map((r) => (
                  <Regel
                    key={r.id} r={r} materiaal={perId.get(r.materiaalId!)} b={beschikbaar[r.materiaalId!]}
                    eigenVraag={vraagPerMateriaal.get(r.materiaalId!) ?? r.aantal} locatie={locatieTekst} naam={naam}
                    vergrendeld={vergrendeld} onFout={setFout}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl">Eigen materiaal</h2>
        <p className="text-sm text-zacht">Dingen die niet in de lijst staan, bijvoorbeeld zelfgemaakte spullen of iets wat jullie zelf meenemen. Dit telt niet mee voor de voorraad.</p>
        <ul className="flex flex-col gap-2">
          {eigenRegels.map((r) => (
            <Regel key={r.id} r={r} materiaal={undefined} b={undefined} eigenVraag={r.aantal} locatie={locatieTekst} naam={naam} vergrendeld={vergrendeld} onFout={setFout} />
          ))}
        </ul>
        {!vergrendeld && (
          <form onSubmit={voegEigenToe} className="flex flex-col gap-3 rounded-han border border-rand bg-vlak p-4">
            <label className="flex flex-col gap-1 font-medium text-kop">
              Wat is het?
              <input value={omschrijving} onChange={(e) => setOmschrijving(e.target.value)} maxLength={150} placeholder="Bijvoorbeeld: zelfgemaakte vlaggen" className={`${INVOER} font-normal`} />
            </label>
            <label className="flex flex-col gap-1 font-medium text-kop">
              Aantal
              <input type="number" inputMode="numeric" min={1} max={9999} value={aantalEigen} onChange={(e) => setAantalEigen(e.target.value)} className={`${INVOER} w-28 font-normal`} />
            </label>
            <button type="submit" disabled={bezig !== null} className="flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop disabled:opacity-60">
              {bezig === "eigen" ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Plus aria-hidden className="size-5" />} {bezig === "eigen" ? "Bezig…" : "Eigen materiaal toevoegen"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
