"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";
import { budgetAanvraagIndienen, budgetRegelsOpslaan } from "@/app/(app)/budget-actions";
import { useAvfEditor } from "@/components/avf/AvfEditor";
import { NaamVeld, useNaam } from "@/components/NaamVeld";
import { useAutoBewaar } from "@/components/useAutoBewaar";
import { euro, leesBedrag, STATUS_NAAM, type BudgetAanvraag, type BudgetRegel } from "@/lib/budgetTypes";
import { formatMoment } from "@/lib/tijd";

const INVOER = "min-h-aanraak rounded-han border-2 border-zacht bg-vlak px-3 text-base text-tekst disabled:bg-achtergrond";

interface RegelState {
  omschrijving: string;
  bedrag: string;
}

const naarState = (regels: BudgetRegel[]): RegelState[] => regels.map((r) => ({ omschrijving: r.omschrijving, bedrag: String(r.bedrag).replace(".", ",") }));

/** Zet de invoer om naar regels; leeg gelaten regels vallen weg. null = er staat iets onvolledigs in. */
function naarRegels(rijen: RegelState[]): BudgetRegel[] | null {
  const regels: BudgetRegel[] = [];
  for (const r of rijen) {
    const leeg = r.omschrijving.trim() === "" && r.bedrag.trim() === "";
    if (leeg) continue;
    const b = leesBedrag(r.bedrag);
    if (r.omschrijving.trim() === "" || b === null || b === "ongeldig") return null;
    regels.push({ omschrijving: r.omschrijving.trim(), bedrag: b });
  }
  return regels;
}

const KLEUR: Record<BudgetAanvraag["status"], string> = {
  concept: "bg-rand text-kop", aangevraagd: "bg-ingediend text-black", toegekend: "bg-goedgekeurd text-black", teruggegeven: "bg-actie text-black", afgewezen: "bg-actie text-black",
};

/** Het financieel plan (of een losse aanvraag): regels met bedragen, het totaal en wat er met de aanvraag is gebeurd. */
export function FinancieelPlan({
  aanvraag, naam, bewerkbaar, losse = false, uitleg,
}: { aanvraag: BudgetAanvraag; naam: string; bewerkbaar: boolean; losse?: boolean; uitleg?: string }) {
  const router = useRouter();
  const [rijen, setRijen] = useState<RegelState[]>(() => naarState(aanvraag.regels));
  const [omschrijving, setOmschrijving] = useState(aanvraag.omschrijving ?? "");
  const [toelichting, setToelichting] = useState(aanvraag.toelichting ?? "");
  const verwacht = useRef(aanvraag.updatedAt);
  const bewaard = useRef(JSON.stringify([naarRegels(naarState(aanvraag.regels)), aanvraag.omschrijving ?? "", aanvraag.toelichting ?? ""]));
  const [bezig, setBezig] = useState<"opslaan" | "indienen" | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [opgeslagen, setOpgeslagen] = useState(false);

  const regels = naarRegels(rijen);
  const totaal = (regels ?? []).reduce((s, r) => s + r.bedrag, 0);
  const onvolledig = regels === null;

  async function bewaar(nieuweRijen: RegelState[] = rijen) {
    const r = naarRegels(nieuweRijen);
    if (r === null) return; // er staat nog iets onvolledigs in; pas opslaan als elke regel compleet is
    const sleutel = JSON.stringify([r, omschrijving.trim(), toelichting.trim()]);
    if (sleutel === bewaard.current) return;
    if (!naam.trim()) return setFout("Vul bovenaan eerst je naam in.");
    setFout(null);
    setBezig("opslaan");
    const res = await budgetRegelsOpslaan(aanvraag.id, r, omschrijving, toelichting, naam, verwacht.current);
    setBezig(null);
    if (res.status === "ok") {
      verwacht.current = res.updatedAt;
      bewaard.current = sleutel;
      setOpgeslagen(true);
      router.refresh();
    } else if (res.status === "conflict") {
      setFout("Iemand anders heeft dit plan net gewijzigd. Ververs de pagina om het laatste te zien.");
    } else setFout(res.melding);
  }

  async function dienIn() {
    setFout(null);
    if (!naam.trim()) return setFout("Vul bovenaan eerst je naam in.");
    setBezig("indienen");
    const res = await budgetAanvraagIndienen(aanvraag.id, naam);
    setBezig(null);
    if (res.status === "ok") router.refresh();
    else setFout(res.melding);
  }

  const wijzig = (i: number, veld: keyof RegelState, waarde: string) => {
    setOpgeslagen(false);
    setRijen((x) => x.map((r, n) => (n === i ? { ...r, [veld]: waarde } : r)));
  };
  const verwijder = (i: number) => {
    const nieuw = rijen.filter((_, n) => n !== i);
    setRijen(nieuw);
    void bewaar(nieuw);
  };

  const kanIndienen = bewerkbaar && (losse || aanvraag.status === "teruggegeven");

  // Opslaan terwijl je typt, zodat niets verloren gaat als je direct daarna doorklikt.
  useAutoBewaar(JSON.stringify([rijen, omschrijving, toelichting]), () => bewaar(), { actief: bewerkbaar });

  return (
    <section className="flex flex-col gap-3 rounded-han border border-rand bg-vlak p-4" aria-label={losse ? (aanvraag.omschrijving ?? "Losse aanvraag") : "Financieel plan"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-kop">{losse ? (aanvraag.omschrijving ?? "Losse aanvraag") : "Financieel plan"}</h3>
        <span className={`rounded-han px-2 py-0.5 text-xs font-bold ${KLEUR[aanvraag.status]}`}>{STATUS_NAAM[aanvraag.status]}</span>
      </div>
      {uitleg && <p className="text-sm text-zacht">{uitleg}</p>}

      {aanvraag.status === "toegekend" && (
        <p className="font-medium text-kop">
          Toegekend: {euro(aanvraag.bedragToegekend)}{aanvraag.bedragToegekend !== aanvraag.bedragAangevraagd ? ` (aangevraagd ${euro(aanvraag.bedragAangevraagd)})` : ""}
          {aanvraag.besluitDoorNaam && ` · ${aanvraag.besluitDoorNaam}${aanvraag.besluitOp ? `, ${formatMoment(aanvraag.besluitOp)}` : ""}`}
        </p>
      )}
      {aanvraag.status === "aangevraagd" && <p className="font-medium text-kop">Aangevraagd: {euro(aanvraag.bedragAangevraagd)}. De stuurgroep beslist hierover.</p>}
      {(aanvraag.status === "teruggegeven" || aanvraag.status === "afgewezen") && (
        <p role="status" className="font-medium text-kop">
          {aanvraag.status === "teruggegeven" ? "De stuurgroep heeft dit teruggegeven" : "De stuurgroep heeft dit afgewezen"}
          {aanvraag.besluitToelichting ? `: ${aanvraag.besluitToelichting}` : "."}
          {aanvraag.status === "teruggegeven" && " Pas het aan en dien opnieuw in."}
        </p>
      )}
      {aanvraag.status === "toegekend" && aanvraag.besluitToelichting && <p className="text-tekst">Toelichting: {aanvraag.besluitToelichting}</p>}

      {losse && bewerkbaar && (
        <label className="flex flex-col gap-1 font-medium text-kop">
          Waarvoor?
          <input value={omschrijving} onChange={(e) => { setOmschrijving(e.target.value); setOpgeslagen(false); }} onBlur={() => void bewaar()} maxLength={150} className={`${INVOER} font-normal`} />
        </label>
      )}

      <table className="w-full table-fixed text-left">
        <thead className="text-xs font-bold uppercase text-zacht">
          <tr><th scope="col" className="py-1">Omschrijving</th><th scope="col" className="w-28 px-1">Bedrag (€)</th><th scope="col" className="w-11"><span className="sr-only">Verwijderen</span></th></tr>
        </thead>
        <tbody>
          {rijen.map((r, i) => (
            <tr key={i} className="border-t border-rand">
              <td className="py-1 pr-1">
                {bewerkbaar ? (
                  <input value={r.omschrijving} onChange={(e) => wijzig(i, "omschrijving", e.target.value)} onBlur={() => void bewaar()} maxLength={100} aria-label={`Omschrijving regel ${i + 1}`} className={`${INVOER} w-full`} />
                ) : <span className="text-tekst">{r.omschrijving}</span>}
              </td>
              <td className="px-1 py-1">
                {bewerkbaar ? (
                  <input value={r.bedrag} onChange={(e) => wijzig(i, "bedrag", e.target.value)} onBlur={() => void bewaar()} inputMode="decimal" aria-label={`Bedrag regel ${i + 1}`} className={`${INVOER} w-full text-right`} />
                ) : <span className="block text-right font-medium text-kop">{euro(leesBedrag(r.bedrag) as number | null)}</span>}
              </td>
              <td className="pr-1">
                {bewerkbaar && (
                  <button type="button" onClick={() => verwijder(i)} aria-label={`Verwijder regel ${i + 1}`} className="flex size-aanraak items-center justify-center rounded-han text-kop">
                    <Trash2 aria-hidden className="size-5" />
                  </button>
                )}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-kop">
            <th scope="row" className="py-2 text-left font-bold text-kop">Totaal</th>
            <td className="px-1 text-right text-lg font-bold text-kop" aria-live="polite">{euro(totaal)}</td>
            <td />
          </tr>
        </tbody>
      </table>

      {bewerkbaar && (
        <button type="button" onClick={() => { setRijen((x) => [...x, { omschrijving: "", bedrag: "" }]); setOpgeslagen(false); }} className="flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
          <Plus aria-hidden className="size-5" /> Regel toevoegen
        </button>
      )}
      {bewerkbaar && losse && (
        <label className="flex flex-col gap-1 font-medium text-kop">
          Toelichting (optioneel)
          <textarea value={toelichting} onChange={(e) => { setToelichting(e.target.value); setOpgeslagen(false); }} onBlur={() => void bewaar()} rows={2} maxLength={500} className={`${INVOER} py-2 font-normal`} />
        </label>
      )}
      {bewerkbaar && onvolledig && <p className="text-sm font-medium text-kop">Elke regel heeft een omschrijving en een bedrag nodig. Daarna wordt het opgeslagen.</p>}
      <p aria-live="polite" className="min-h-5 text-sm font-medium text-kop">
        {bezig === "opslaan" ? "Bezig met opslaan…" : opgeslagen ? "Opgeslagen" : ""}
      </p>
      {fout && <p role="alert" className="font-bold text-fout">{fout}</p>}
      {kanIndienen && (
        <button type="button" onClick={() => void dienIn()} disabled={bezig !== null || onvolledig || totaal <= 0} className="flex min-h-aanraak items-center justify-center gap-2 rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">
          {bezig === "indienen" ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Send aria-hidden className="size-5" />} {bezig === "indienen" ? "Bezig…" : aanvraag.status === "teruggegeven" ? "Opnieuw indienen" : "Aanvraag indienen"}
        </button>
      )}
    </section>
  );
}

/** Het financieel plan binnen het AVF: gebruikt de naam en vergrendeling van het AVF-scherm. */
export function FinancieelPlanInAvf({ aanvraag, avfBewerkbaar }: { aanvraag: BudgetAanvraag; avfBewerkbaar: boolean }) {
  const { naam, vergrendeld } = useAvfEditor();
  const planBewerkbaar = (aanvraag.status === "concept" && avfBewerkbaar && !vergrendeld) || aanvraag.status === "teruggegeven";
  return (
    <FinancieelPlan
      aanvraag={aanvraag} naam={naam} bewerkbaar={planBewerkbaar}
      uitleg={
        aanvraag.status === "concept"
          ? "Vul in wat jullie verwachten uit te geven. Het plan gaat mee met het indienen van het AVF; de stuurgroep beslist over het bedrag. Leeg laten mag. Na goedkeuring van het AVF ligt het plan vast."
          : undefined
      }
    />
  );
}

/** Een aanvraag op de budgetpagina (heeft een eigen naamveld). Het plan van het AVF zelf bewerk je in sectie F, tenzij het is teruggegeven. */
export function AanvraagKaart({ aanvraag, losse }: { aanvraag: BudgetAanvraag; losse: boolean }) {
  const [naam, setNaam] = useNaam();
  const bewerkbaar = (losse && aanvraag.status === "concept") || aanvraag.status === "teruggegeven";
  return (
    <div className="flex flex-col gap-2">
      {bewerkbaar && <NaamVeld naam={naam} setNaam={setNaam} label="Wie werkt hier? (jouw naam)" />}
      <FinancieelPlan aanvraag={aanvraag} naam={naam} bewerkbaar={bewerkbaar} losse={losse} />
    </div>
  );
}
