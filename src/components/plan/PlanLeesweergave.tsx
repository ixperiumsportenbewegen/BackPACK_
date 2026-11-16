import { PLAN_SECTIES, type PlanSectie, type PlanVeld } from "@/config/calamiteitenplan";
import type { Plan, PlanItem } from "@/lib/calamiteitenplan";
import { telHref, webHref } from "@/lib/planTekst";

/** De waarde van een veld: telefoonnummers en websites als link, de rest als tekst met regelafbrekingen. */
function Waarde({ veld, tekst }: { veld: PlanVeld; tekst: string }) {
  const tel = veld.soort === "tel" ? telHref(tekst) : null;
  const web = veld.soort === "link" ? webHref(tekst) : null;
  if (tel) {
    return <a href={tel} className="font-bold text-kop underline">{tekst}</a>;
  }
  if (web) {
    return <a href={web} target="_blank" rel="noreferrer" className="break-all font-bold text-kop underline">{tekst}</a>;
  }
  return <p className="whitespace-pre-wrap text-tekst">{tekst}</p>;
}

function VeldRij({ veld, tekst }: { veld: PlanVeld; tekst: string | undefined }) {
  if (!tekst) return null;
  return (
    <div className="print:break-inside-avoid">
      <p className="text-sm font-bold text-zacht">{veld.label}</p>
      <Waarde veld={veld} tekst={tekst} />
    </div>
  );
}

function ItemKaart({ sectie, item, nummer }: { sectie: PlanSectie; item: PlanItem; nummer: number }) {
  const lijst = sectie.lijst!;
  const titel = item.velden[lijst.titelVeld];
  const overige = lijst.velden.filter((v) => v.sleutel !== lijst.titelVeld);
  return (
    <li className="rounded-han border border-rand bg-vlak p-3 print:break-inside-avoid">
      <h3 className="text-lg">{titel ?? `${lijst.itemNaam} ${nummer}`}</h3>
      <div className="mt-1 flex flex-col gap-2">
        {overige.map((v) => <VeldRij key={v.sleutel} veld={v} tekst={item.velden[v.sleutel]} />)}
      </div>
    </li>
  );
}

/** Het plan om te lezen: alle onderdelen onder elkaar (zodat afdrukken of opslaan als pdf alles meeneemt). */
export function PlanLeesweergave({ plan }: { plan: Plan }) {
  return (
    <div className="flex flex-col gap-6">
      {PLAN_SECTIES.map((sectie) => {
        const velden = (sectie.velden ?? []).filter((v) => plan.velden[v.sleutel]);
        const items = sectie.lijst ? (plan.lijsten[sectie.lijst.sleutel] ?? []).filter((i) => Object.keys(i.velden).length > 0) : [];
        const leeg = velden.length === 0 && items.length === 0;
        return (
          <section key={sectie.code} id={sectie.code} aria-labelledby={`kop-${sectie.code}`} className="scroll-mt-24 rounded-han border border-rand bg-vlak p-4 print:break-inside-avoid-page">
            <h2 id={`kop-${sectie.code}`} className="text-xl">{sectie.naam}</h2>
            {leeg ? (
              <p className="mt-1 text-zacht">Nog niet ingevuld.</p>
            ) : (
              <div className="mt-2 flex flex-col gap-3">
                {sectie.velden?.map((v) => <VeldRij key={v.sleutel} veld={v} tekst={plan.velden[v.sleutel]} />)}
                {sectie.lijst && items.length > 0 && (
                  <ol className="flex flex-col gap-2">
                    {items.map((item, n) => <ItemKaart key={item.id} sectie={sectie} item={item} nummer={n + 1} />)}
                  </ol>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
