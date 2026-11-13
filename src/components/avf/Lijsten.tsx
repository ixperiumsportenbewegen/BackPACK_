"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { lijstToevoegen, lijstVerwijderen, type JsonSectie } from "@/app/(app)/avf/actions";
import { useAvfEditor } from "@/components/avf/AvfEditor";
import { TekstVeld } from "@/components/avf/Velden";

export interface LijstItem {
  id: string;
  [veld: string]: unknown;
}

export interface LijstVeld {
  sleutel: string;
  label: string;
  meerRegels?: boolean;
  maxLengte?: number;
}

/**
 * Een lijst met items (bijvoorbeeld risico's) waarvan elk veld apart wordt opgeslagen.
 * Items hebben een eigen id, zodat twee studenten tegelijk aan verschillende items kunnen werken.
 */
export function LijstEditor({
  sectie, pad, begin, velden, itemNaam, toevoegenLabel, leegTekst, eigenaar,
}: {
  sectie: JsonSectie;
  pad: string[];
  begin: LijstItem[];
  velden: LijstVeld[];
  itemNaam: string;
  toevoegenLabel: string;
  leegTekst: string;
  eigenaar?: string | null;
}) {
  const { naam, vergrendeld } = useAvfEditor();
  const [items, setItems] = useState<LijstItem[]>(begin);
  const [bevestig, setBevestig] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  async function voegToe() {
    if (!naam.trim()) { setFout("Vul bovenaan eerst je naam in."); return; }
    setBezig(true);
    setFout(null);
    const res = await lijstToevoegen(sectie, pad, {}, naam);
    setBezig(false);
    if (res.status === "ok") setItems((x) => [...x, { id: res.item.id }]);
    else setFout(res.melding);
  }

  async function verwijder(id: string) {
    if (!naam.trim()) { setFout("Vul bovenaan eerst je naam in."); return; }
    setBezig(true);
    const res = await lijstVerwijderen(sectie, pad, id, naam);
    setBezig(false);
    if (res.status === "ok") {
      setItems((x) => x.filter((i) => i.id !== id));
      setBevestig(null);
      setFout(null);
    } else setFout(res.melding);
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 && <p className="rounded-han bg-achtergrond p-3 text-zacht">{leegTekst}</p>}
      {items.map((item, n) => (
        <div key={item.id} className="rounded-han border-2 border-rand bg-vlak p-3">
          <p className="mb-2 font-bold text-kop">{itemNaam} {n + 1}</p>
          <div className="flex flex-col gap-3">
            {velden.map((v, i) => (
              <TekstVeld
                key={v.sleutel}
                doel={{ soort: "json", sectie, pad: [...pad, item.id, v.sleutel] }}
                begin={(item[v.sleutel] as string | null | undefined) ?? null}
                label={v.label}
                eigenaar={i === 0 ? eigenaar : undefined}
                meerRegels={v.meerRegels}
                maxLengte={v.maxLengte ?? 300}
              />
            ))}
          </div>
          {!vergrendeld && (
            bevestig === item.id ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="font-medium text-kop">Zeker weten?</span>
                <button type="button" onClick={() => void verwijder(item.id)} disabled={bezig} className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">
                  {bezig ? "Bezig…" : "Ja, verwijderen"}
                </button>
                <button type="button" onClick={() => setBevestig(null)} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
                  Nee
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setBevestig(item.id)} className="mt-2 flex min-h-aanraak items-center gap-2 font-bold text-kop underline">
                <Trash2 aria-hidden className="size-5" /> {itemNaam} verwijderen
              </button>
            )
          )}
        </div>
      ))}
      {!vergrendeld && (
        <button
          type="button" onClick={() => void voegToe()} disabled={bezig}
          className="flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop disabled:opacity-60"
        >
          {bezig ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Plus aria-hidden className="size-5" />} {bezig ? "Bezig…" : toevoegenLabel}
        </button>
      )}
      {fout && <p role="alert" className="font-medium text-fout">{fout}</p>}
    </div>
  );
}
