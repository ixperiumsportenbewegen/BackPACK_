"use client";

import { useState } from "react";
import { Check, TriangleAlert } from "lucide-react";
import type { VeldDoel, Waarde } from "@/app/(app)/avf/actions";
import { useAvfEditor } from "@/components/avf/AvfEditor";
import { useVeld, type Conflict, type Melding } from "@/components/avf/useVeld";

export function MeldingRegel({ melding }: { melding: Melding | null }) {
  if (!melding) return <p aria-live="polite" className="min-h-6" />;
  return (
    <p
      aria-live="polite"
      role={melding.soort === "fout" ? "alert" : undefined}
      className={`mt-1 min-h-6 text-sm font-medium ${melding.soort === "fout" ? "text-fout" : "text-kop"}`}
    >
      {melding.soort === "ok" && <Check aria-hidden className="mr-1 inline size-4" />}
      {melding.soort === "waarschuwing" && <TriangleAlert aria-hidden className="mr-1 inline size-4" />}
      {melding.tekst}
    </p>
  );
}

function weergave(w: Waarde): string {
  if (w === null || w === "") return "(leeg)";
  if (w === true) return "Ja";
  if (w === false) return "Nee";
  return String(w);
}

export function ConflictBlok({ conflict, onHun, onMijn }: { conflict: Conflict | null; onHun: () => void; onMijn: () => void }) {
  if (!conflict) return null;
  return (
    <div role="alert" className="mt-2 rounded-han border-2 border-kop bg-vlak p-3">
      <p className="font-medium text-kop">Iemand anders heeft dit net gewijzigd. Nu staat er: “{weergave(conflict.huidig)}”</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={onHun} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
          Hun versie houden
        </button>
        <button type="button" onClick={onMijn} className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk">
          Mijn versie bewaren
        </button>
      </div>
    </div>
  );
}

/** Kleine regel onder het label: welke projectgroeprol eigenaar is van dit veld. */
export function Eigenaar({ rol }: { rol?: string | null }) {
  if (!rol) return null;
  return <span className="block text-xs font-medium text-zacht">Eigenaar: {rol}</span>;
}

const INVOER = "w-full rounded-han border-2 border-zacht bg-vlak px-3 text-base font-normal text-tekst disabled:bg-achtergrond disabled:text-zacht";

interface TekstProps {
  doel: VeldDoel;
  begin: string | number | null;
  label: string;
  hulp?: string;
  eigenaar?: string | null;
  maxLengte?: number;
  meerRegels?: boolean;
  getal?: boolean;
  uitgeschakeld?: boolean;
  /** Wordt aangeroepen na een geslaagde opslag. */
  bijOpgeslagen?: (w: Waarde) => void;
}

export function TekstVeld({ doel, begin, label, hulp, eigenaar, maxLengte, meerRegels, getal, uitgeschakeld, bijOpgeslagen }: TekstProps) {
  const { vergrendeld } = useAvfEditor();
  const v = useVeld(doel, begin);
  const [tekst, setTekst] = useState(begin === null ? "" : String(begin));
  const uit = vergrendeld || uitgeschakeld;

  async function bijVerlaten() {
    const t = tekst.trim();
    const nieuw: Waarde = t === "" ? null : getal ? Number(t) : t;
    if (nieuw === v.opgeslagen) return;
    if (await v.opslaan(nieuw)) bijOpgeslagen?.(nieuw);
  }

  return (
    <div>
      <label className="flex flex-col gap-1 font-bold text-kop">
        <span>{label}</span>
        <Eigenaar rol={eigenaar} />
        {hulp && <span className="text-sm font-normal text-zacht">{hulp}</span>}
        {meerRegels ? (
          <textarea
            value={tekst} onChange={(e) => setTekst(e.target.value)} onBlur={bijVerlaten}
            maxLength={maxLengte} rows={4} disabled={uit} className={`${INVOER} py-2`}
          />
        ) : (
          <input
            value={tekst} onChange={(e) => setTekst(e.target.value)} onBlur={bijVerlaten}
            maxLength={maxLengte} disabled={uit} className={`${INVOER} min-h-aanraak`}
            {...(getal ? { type: "number", inputMode: "numeric" as const, min: 0 } : { type: "text" })}
          />
        )}
      </label>
      {maxLengte && meerRegels && (
        <p className="mt-1 text-right text-xs text-zacht">{tekst.length} van {maxLengte} tekens</p>
      )}
      <ConflictBlok
        conflict={v.conflict}
        onHun={() => { setTekst(v.conflict?.huidig === null || v.conflict?.huidig === undefined ? "" : String(v.conflict.huidig)); v.resetNaar(v.conflict?.huidig ?? null); }}
        onMijn={() => { if (v.conflict) void v.opslaan(v.conflict.mijn, v.conflict.huidig).then((ok) => ok && bijOpgeslagen?.(v.conflict?.mijn ?? null)); }}
      />
      <MeldingRegel melding={v.melding} />
    </div>
  );
}

interface JaNeeProps {
  doel: VeldDoel;
  begin: boolean | null;
  label: string;
  hulp?: string;
  eigenaar?: string | null;
  uitgeschakeld?: boolean;
  bijOpgeslagen?: (w: boolean | null) => void;
}

export function JaNeeVeld({ doel, begin, label, hulp, eigenaar, uitgeschakeld, bijOpgeslagen }: JaNeeProps) {
  const { vergrendeld } = useAvfEditor();
  const v = useVeld(doel, begin);
  const uit = vergrendeld || uitgeschakeld;

  async function kies(w: boolean) {
    if (w === v.opgeslagen) return;
    if (await v.opslaan(w)) bijOpgeslagen?.(w);
  }

  return (
    <div>
      <p className="font-bold text-kop">{label}</p>
      <Eigenaar rol={eigenaar} />
      {hulp && <p className="text-sm text-zacht">{hulp}</p>}
      <div role="radiogroup" aria-label={label} className="mt-2 grid grid-cols-2 gap-2">
        {[true, false].map((w) => (
          <button
            key={String(w)} type="button" role="radio" aria-checked={v.opgeslagen === w} disabled={uit}
            onClick={() => void kies(w)}
            className={`flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 px-3 font-bold disabled:opacity-60 ${
              v.opgeslagen === w ? "border-kop bg-kop text-white" : "border-zacht bg-vlak text-kop"
            }`}
          >
            {v.opgeslagen === w && <Check aria-hidden className="size-5" />}
            {w ? "Ja" : "Nee"}
          </button>
        ))}
      </div>
      <ConflictBlok
        conflict={v.conflict}
        onHun={() => v.resetNaar(v.conflict?.huidig ?? null)}
        onMijn={() => { if (v.conflict) void v.opslaan(v.conflict.mijn, v.conflict.huidig).then((ok) => ok && bijOpgeslagen?.(v.conflict?.mijn as boolean | null)); }}
      />
      <MeldingRegel melding={v.melding} />
    </div>
  );
}

interface KeuzeProps {
  doel: VeldDoel;
  begin: string | null;
  label: string;
  opties: string[];
  hulp?: string;
  eigenaar?: string | null;
}

export function KeuzeVeld({ doel, begin, label, opties, hulp, eigenaar }: KeuzeProps) {
  const { vergrendeld } = useAvfEditor();
  const v = useVeld(doel, begin);
  return (
    <div>
      <p className="font-bold text-kop">{label}</p>
      <Eigenaar rol={eigenaar} />
      {hulp && <p className="text-sm text-zacht">{hulp}</p>}
      <div role="radiogroup" aria-label={label} className="mt-2 grid grid-cols-2 gap-2">
        {opties.map((o) => (
          <button
            key={o} type="button" role="radio" aria-checked={v.opgeslagen === o} disabled={vergrendeld}
            onClick={() => { if (o !== v.opgeslagen) void v.opslaan(o); }}
            className={`flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 px-3 font-bold disabled:opacity-60 ${
              v.opgeslagen === o ? "border-kop bg-kop text-white" : "border-zacht bg-vlak text-kop"
            }`}
          >
            {v.opgeslagen === o && <Check aria-hidden className="size-5" />}
            {o}
          </button>
        ))}
      </div>
      <ConflictBlok
        conflict={v.conflict}
        onHun={() => v.resetNaar(v.conflict?.huidig ?? null)}
        onMijn={() => { if (v.conflict) void v.opslaan(v.conflict.mijn, v.conflict.huidig); }}
      />
      <MeldingRegel melding={v.melding} />
    </div>
  );
}
