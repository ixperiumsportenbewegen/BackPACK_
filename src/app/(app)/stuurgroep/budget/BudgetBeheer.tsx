"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, TriangleAlert } from "lucide-react";
import { budgetBesluit, budgetBesteedZetten, clusterBudgetZetten } from "@/app/(app)/budget-actions";
import { NaamVeld, useNaam } from "@/components/NaamVeld";
import { euro, leesBedrag, STATUS_NAAM, type BudgetAanvraagMetGroep } from "@/lib/budgetTypes";
import { formatMoment } from "@/lib/tijd";

const INVOER = "min-h-aanraak rounded-han border-2 border-zacht bg-vlak px-3 text-base text-tekst disabled:bg-achtergrond";

function RegelsTabel({ a }: { a: BudgetAanvraagMetGroep }) {
  return (
    <table className="mt-1 w-full table-fixed text-left text-sm">
      <tbody>
        {a.regels.map((r, i) => (
          <tr key={i} className="border-t border-rand"><td className="py-1 pr-2">{r.omschrijving}</td><td className="w-24 py-1 text-right">{euro(r.bedrag)}</td></tr>
        ))}
        <tr className="border-t-2 border-kop"><th scope="row" className="py-1 text-left">Totaal</th><td className="py-1 text-right font-bold text-kop">{euro(a.bedragAangevraagd)}</td></tr>
      </tbody>
    </table>
  );
}

function BesluitKaart({ a, naam, resterend, melding }: { a: BudgetAanvraagMetGroep; naam: string; resterend: number | null; melding: (m: string) => void }) {
  const router = useRouter();
  const [bedrag, setBedrag] = useState(String(a.bedragAangevraagd).replace(".", ","));
  const [toelichting, setToelichting] = useState("");
  const [bezig, setBezig] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const gevraagd = leesBedrag(bedrag);
  const boven = resterend !== null && typeof gevraagd === "number" && gevraagd > resterend;

  async function doe(besluit: "toegekend" | "teruggegeven" | "afgewezen") {
    setFout(null);
    if (!naam.trim()) return setFout("Vul bovenaan eerst je naam in.");
    if (besluit === "toegekend" && (gevraagd === "ongeldig" || gevraagd === null)) return setFout("Vul een bedrag in.");
    setBezig(besluit);
    const res = await budgetBesluit(a.id, besluit, besluit === "toegekend" ? (gevraagd as number) : null, toelichting, naam);
    setBezig(null);
    if (res.status === "ok") {
      if (res.bovenResterend) melding(`${a.groepNaam}: toegekend. Let op: dit bedrag gaat boven de resterende ruimte van het cluster.`);
      router.refresh();
    } else setFout(res.melding);
  }

  return (
    <li className="rounded-han border-2 border-actie bg-vlak p-3">
      <p className="text-sm font-medium text-zacht">{a.groepNaam}{a.titel ? ` · ${a.titel}` : ""}</p>
      <p className="text-lg font-bold text-kop">{a.soort === "avf" ? "Financieel plan" : (a.omschrijving ?? "Losse aanvraag")}: {euro(a.bedragAangevraagd)}</p>
      {a.toelichting && <p className="text-tekst">{a.toelichting}</p>}
      <RegelsTabel a={a} />
      <label className="mt-3 flex flex-col gap-1 text-sm font-medium text-kop">
        Toe te kennen bedrag (€)
        <input value={bedrag} onChange={(e) => setBedrag(e.target.value)} inputMode="decimal" className={`${INVOER} w-36`} />
      </label>
      {boven && (
        <p role="status" className="mt-1 flex items-start gap-2 text-sm font-medium text-kop">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> Dit is meer dan de resterende ruimte ({euro(resterend)}). Toekennen kan, maar het cluster komt dan boven het budget uit.
        </p>
      )}
      <label className="mt-2 flex flex-col gap-1 text-sm font-medium text-kop">
        Toelichting aan de groep (verplicht bij teruggeven, afwijzen of een lager bedrag)
        <textarea value={toelichting} onChange={(e) => setToelichting(e.target.value)} rows={2} maxLength={500} className={`${INVOER} py-2 font-normal`} />
      </label>
      {fout && <p role="alert" className="mt-1 font-bold text-fout">{fout}</p>}
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <button type="button" onClick={() => void doe("toegekend")} disabled={bezig !== null} className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">{bezig === "toegekend" ? "Bezig…" : "Toekennen"}</button>
        <button type="button" onClick={() => void doe("teruggegeven")} disabled={bezig !== null} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop disabled:opacity-60">{bezig === "teruggegeven" ? "Bezig…" : "Teruggeven"}</button>
        <button type="button" onClick={() => void doe("afgewezen")} disabled={bezig !== null} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop disabled:opacity-60">{bezig === "afgewezen" ? "Bezig…" : "Afwijzen"}</button>
      </div>
    </li>
  );
}

function BesteedVeld({ a, naam }: { a: BudgetAanvraagMetGroep; naam: string }) {
  const router = useRouter();
  const [waarde, setWaarde] = useState(a.besteed === null ? "" : String(a.besteed).replace(".", ","));
  const [fout, setFout] = useState<string | null>(null);

  async function bewaar() {
    const b = leesBedrag(waarde);
    if (b === "ongeldig") return setFout("Vul een bedrag in.");
    if (b === a.besteed) return;
    if (!naam.trim()) return setFout("Vul bovenaan eerst je naam in.");
    setFout(null);
    const res = await budgetBesteedZetten(a.id, b, naam);
    if (res.status === "ok") router.refresh(); else setFout(res.melding);
  }

  return (
    <label className="mt-2 flex flex-col gap-1 text-sm font-medium text-kop">
      Besteed (€), handmatig na de aankoop
      <input value={waarde} onChange={(e) => setWaarde(e.target.value)} onBlur={() => void bewaar()} inputMode="decimal" placeholder="–" className={`${INVOER} w-36`} />
      {fout && <span role="alert" className="font-bold text-fout">{fout}</span>}
    </label>
  );
}

export interface Samenvatting {
  totaal: number | null;
  resterend: number | null;
  clusterId: string;
}

/** Budgetoverzicht en besluiten voor de stuurgroep (Communicatie & Financiën) en de docent. */
export function BudgetBeheer({
  samenvatting, aanvragen, formsLink, teamsLink,
}: { samenvatting: Samenvatting; aanvragen: BudgetAanvraagMetGroep[]; formsLink: string | null; teamsLink: string | null }) {
  const router = useRouter();
  const [naam, setNaam] = useNaam();
  const [totaal, setTotaal] = useState(samenvatting.totaal === null ? "" : String(samenvatting.totaal).replace(".", ","));
  const [bericht, setBericht] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const open = aanvragen.filter((a) => a.status === "aangevraagd");
  const klaar = aanvragen.filter((a) => a.status !== "aangevraagd" && a.status !== "concept");
  const telt = (f: (a: BudgetAanvraagMetGroep) => number) => aanvragen.reduce((s, a) => s + f(a), 0);
  const toegekend = telt((a) => (a.status === "toegekend" ? (a.bedragToegekend ?? 0) : 0));
  const inBehandeling = telt((a) => (a.status === "aangevraagd" ? a.bedragAangevraagd : 0));
  const besteed = telt((a) => (a.status === "toegekend" ? (a.besteed ?? 0) : 0));
  const rest = samenvatting.resterend;

  const perGroep = [...new Map(aanvragen.map((a) => [a.projectgroepId, a])).values()]
    .map((g) => {
      const eigen = aanvragen.filter((a) => a.projectgroepId === g.projectgroepId);
      return {
        id: g.projectgroepId, naam: g.groepNaam, nummer: g.groepNummer,
        aangevraagd: eigen.reduce((s, a) => s + (a.status === "aangevraagd" || a.status === "toegekend" ? a.bedragAangevraagd : 0), 0),
        toegekend: eigen.reduce((s, a) => s + (a.status === "toegekend" ? (a.bedragToegekend ?? 0) : 0), 0),
        besteed: eigen.reduce((s, a) => s + (a.status === "toegekend" ? (a.besteed ?? 0) : 0), 0),
      };
    })
    .sort((x, y) => x.nummer - y.nummer);

  async function bewaarTotaal() {
    setFout(null);
    const b = leesBedrag(totaal);
    if (b === null || b === "ongeldig") return setFout("Vul een bedrag in.");
    if (b === samenvatting.totaal) return;
    const res = await clusterBudgetZetten(samenvatting.clusterId, b);
    if (res.status === "ok") { setBericht("Het clusterbudget is aangepast."); router.refresh(); } else setFout(res.melding);
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-han border border-rand bg-vlak p-4"><NaamVeld naam={naam} setNaam={setNaam} label="Wie werkt hier? (jouw naam)" /></section>

      <section aria-label="Overzicht" className="grid grid-cols-2 gap-3">
        <div className="col-span-2 rounded-han border-2 border-kop bg-vlak p-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-zacht">
            Budget van het cluster (€)
            <input value={totaal} onChange={(e) => setTotaal(e.target.value)} onBlur={() => void bewaarTotaal()} inputMode="decimal" className={`${INVOER} text-xl font-bold text-kop`} />
          </label>
        </div>
        {[
          { label: "Toegekend", waarde: toegekend }, { label: "In behandeling", waarde: inBehandeling },
          { label: "Besteed", waarde: besteed }, { label: "Nog over", waarde: rest },
        ].map((k) => (
          <div key={k.label} className="rounded-han border border-rand bg-vlak p-3">
            <p className="text-sm font-medium text-zacht">{k.label}</p>
            <p className={`font-heading text-2xl font-bold ${k.label === "Nog over" && (k.waarde ?? 0) < 0 ? "text-fout" : "text-kop"}`}>{euro(k.waarde)}</p>
          </div>
        ))}
      </section>
      {rest !== null && (rest < 0 || inBehandeling > rest) && (
        <p role="status" className="flex items-start gap-2 rounded-han border-2 border-actie bg-vlak p-3 font-medium text-kop">
          <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          {rest < 0 ? `Het cluster is ${euro(-rest)} boven het budget.` : `De aanvragen in behandeling (${euro(inBehandeling)}) zijn meer dan wat er nog over is (${euro(rest)}).`}
        </p>
      )}
      {bericht && <p role="status" className="rounded-han border-2 border-goedgekeurd bg-vlak p-3 font-medium text-kop">{bericht}</p>}
      {fout && <p role="alert" className="font-bold text-fout">{fout}</p>}

      <section aria-labelledby="open-kop" className="flex flex-col gap-3">
        <h2 id="open-kop" className="text-xl">Aanvragen om te beoordelen ({open.length})</h2>
        {open.length === 0 ? <p className="rounded-han border border-rand bg-vlak p-4 text-zacht">Er zijn geen aanvragen die op een besluit wachten.</p> : (
          <ul className="flex flex-col gap-3">{open.map((a) => <BesluitKaart key={a.id} a={a} naam={naam} resterend={rest} melding={setBericht} />)}</ul>
        )}
      </section>

      <section aria-labelledby="groep-kop" className="flex flex-col gap-2">
        <h2 id="groep-kop" className="text-xl">Per belevenis</h2>
        <div className="overflow-hidden rounded-han border border-rand bg-vlak">
          <table className="w-full table-fixed text-left">
            <thead className="bg-achtergrond text-xs font-bold uppercase text-zacht">
              <tr>
                <th scope="col" className="py-1 pl-3">Groep</th>
                <th scope="col" className="w-[4.5rem] px-1 text-right">Gevraagd</th>
                <th scope="col" className="w-[4.5rem] px-1 text-right">Toegekend</th>
                <th scope="col" className="w-[4.5rem] px-1 pr-3 text-right">Besteed</th>
              </tr>
            </thead>
            <tbody>
              {perGroep.map((g) => (
                <tr key={g.id} className="border-t border-rand text-sm">
                  <td className="py-2 pl-3 font-medium text-kop">{g.naam}</td>
                  <td className="px-1 text-right">{euro(g.aangevraagd)}</td>
                  <td className="px-1 text-right">{euro(g.toegekend)}</td>
                  <td className="px-1 pr-3 text-right">{euro(g.besteed)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-kop text-sm font-bold text-kop">
                <th scope="row" className="py-2 pl-3 text-left">Totaal</th>
                <td className="px-1 text-right">{euro(perGroep.reduce((s, g) => s + g.aangevraagd, 0))}</td>
                <td className="px-1 text-right">{euro(toegekend)}</td>
                <td className="px-1 pr-3 text-right">{euro(besteed)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-zacht">Gevraagd telt aanvragen in behandeling en toegekende aanvragen, zonder dubbeltelling. De app claimt nooit dat een declaratie is ontvangen of betaald.</p>
      </section>

      {klaar.length > 0 && (
        <details className="rounded-han border border-rand bg-vlak">
          <summary className="flex min-h-aanraak cursor-pointer items-center px-4 font-bold text-kop">Afgehandelde aanvragen ({klaar.length})</summary>
          <ul className="flex flex-col gap-3 border-t border-rand p-3">
            {klaar.map((a) => (
              <li key={a.id} className="rounded-han border border-rand p-3">
                <p className="text-sm font-medium text-zacht">{a.groepNaam}</p>
                <p className="font-bold text-kop">{a.soort === "avf" ? "Financieel plan" : (a.omschrijving ?? "Losse aanvraag")}: {STATUS_NAAM[a.status]}</p>
                <p className="text-tekst">Aangevraagd {euro(a.bedragAangevraagd)}{a.status === "toegekend" ? `, toegekend ${euro(a.bedragToegekend)}` : ""}</p>
                {a.besluitToelichting && <p className="text-tekst">{a.besluitToelichting}</p>}
                <p className="text-sm text-zacht">{a.besluitDoorNaam}{a.besluitOp ? ` · ${formatMoment(a.besluitOp)}` : ""}</p>
                <RegelsTabel a={a} />
                {a.status === "toegekend" && <BesteedVeld a={a} naam={naam} />}
              </li>
            ))}
          </ul>
        </details>
      )}

      <section className="rounded-han border border-rand bg-vlak p-4" aria-label="Declareren">
        <h2 className="text-xl">Declareren</h2>
        <p className="mt-1 text-tekst">Aankopen doen studenten zelf. Declareren gaat via Microsoft Forms en de docenten betalen terug buiten de app. Er staan geen bankgegevens of bonnetjes in de app.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {formsLink ? <a href={formsLink} target="_blank" rel="noreferrer" className="flex min-h-aanraak items-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop"><ExternalLink aria-hidden className="size-5" /> Declaratieformulier</a> : <p className="text-sm text-zacht">De Forms-link is nog niet ingesteld (de docent doet dat).</p>}
          {teamsLink && <a href={teamsLink} target="_blank" rel="noreferrer" className="flex min-h-aanraak items-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop"><ExternalLink aria-hidden className="size-5" /> Teams</a>}
        </div>
      </section>
    </div>
  );
}
