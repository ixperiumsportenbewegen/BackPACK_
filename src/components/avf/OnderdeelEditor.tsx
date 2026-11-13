"use client";

import { useState } from "react";
import { nvtZetten } from "@/app/(app)/avf/actions";
import { AfbeeldingVeld } from "@/components/avf/AfbeeldingVeld";
import { useAvfEditor } from "@/components/avf/AvfEditor";
import { TekstVeld } from "@/components/avf/Velden";
import { PROJECTGROEPROLLEN } from "@/config/projectgroeprollen";
import type { OnderdeelRij } from "@/lib/avfData";

type Kolom =
  | "sociale_veiligheid" | "individu_moeilijker" | "individu_makkelijker" | "groep_moeilijker"
  | "groep_makkelijker" | "usv_uitdagend" | "usv_speelbaar" | "usv_veilig_aanvulling";

const naamVan = (code: string) => PROJECTGROEPROLLEN.find((r) => r.code === code)?.naam ?? null;

/** Een veld dat als "niet van toepassing" gemarkeerd kan worden. */
function NvtVeld({
  onderdeel, kolom, label, hulp, eigenaar, nvt, setNvt, meerRegels = true,
}: {
  onderdeel: OnderdeelRij;
  kolom: Kolom;
  label: string;
  hulp?: string;
  eigenaar?: string | null;
  nvt: boolean;
  setNvt: (aan: boolean) => void;
  meerRegels?: boolean;
}) {
  const { naam, vergrendeld } = useAvfEditor();
  const [fout, setFout] = useState<string | null>(null);

  async function zet(aan: boolean) {
    setFout(null);
    if (!naam.trim()) { setFout("Vul bovenaan eerst je naam in."); return; }
    const res = await nvtZetten(onderdeel.id, kolom, aan, naam);
    if (res.status === "ok") setNvt(aan);
    else setFout(res.melding);
  }

  return (
    <div>
      <TekstVeld
        doel={{ soort: "onderdeel", id: onderdeel.id, kolom }}
        begin={(onderdeel[kolom] as string | null) ?? null}
        label={label}
        hulp={hulp}
        eigenaar={eigenaar}
        meerRegels={meerRegels}
        maxLengte={kolom === "sociale_veiligheid" ? 1000 : 500}
        uitgeschakeld={nvt}
      />
      {!vergrendeld && (
        <label className="mt-1 flex min-h-aanraak items-center gap-3 text-tekst">
          <input type="checkbox" checked={nvt} onChange={(e) => void zet(e.target.checked)} className="size-6 accent-merk" />
          Niet van toepassing
        </label>
      )}
      {nvt && vergrendeld && <p className="text-sm text-zacht">Niet van toepassing</p>}
      {fout && <p role="alert" className="font-medium text-fout">{fout}</p>}
    </div>
  );
}

export function OnderdeelEditor({ onderdeel, avfId, clusterId }: { onderdeel: OnderdeelRij; avfId: string; clusterId: string }) {
  const [nvt, setNvt] = useState<Set<string>>(new Set(onderdeel.niet_van_toepassing ?? []));
  const zet = (kolom: Kolom) => (aan: boolean) =>
    setNvt((s) => {
      const n = new Set(s);
      if (aan) n.add(kolom); else n.delete(kolom);
      return n;
    });
  const eigenaarPB = naamVan("programma_beleving");
  const eigenaarVE = naamVan("veiligheid_ehbo");
  const p = (kolom: Kolom, label: string, extra: { hulp?: string; eigenaar?: string | null; meerRegels?: boolean } = {}) => (
    <NvtVeld key={kolom} onderdeel={onderdeel} kolom={kolom} label={label} nvt={nvt.has(kolom)} setNvt={zet(kolom)} {...extra} />
  );

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-han border border-rand bg-vlak p-4">
        <h2 className="text-xl">Het onderdeel</h2>
        <TekstVeld doel={{ soort: "onderdeel", id: onderdeel.id, kolom: "naam" }} begin={onderdeel.naam} label="Naam van het onderdeel" eigenaar={eigenaarPB} maxLengte={100} />
        <TekstVeld doel={{ soort: "onderdeel", id: onderdeel.id, kolom: "duur_minuten" }} begin={onderdeel.duur_minuten} label="Duur in minuten" getal />
        <TekstVeld doel={{ soort: "onderdeel", id: onderdeel.id, kolom: "beschrijving" }} begin={onderdeel.beschrijving} label="Beschrijving" meerRegels maxLengte={3000} hulp="Wat doen de deelnemers en wat doen de organisatoren?" />
        <AfbeeldingVeld
          doel={{ soort: "onderdeel", id: onderdeel.id, kolom: "afbeelding_pad" }} begin={onderdeel.afbeelding_pad}
          avfId={avfId} clusterId={clusterId} label="Afbeelding (mag leeg)" prefix={`onderdeel-${onderdeel.id.slice(0, 8)}`}
          uitleg="Alleen afbeeldingen, geen pdf's of Word-bestanden."
        />
        {onderdeel.afbeelding_pad && (
          <TekstVeld doel={{ soort: "onderdeel", id: onderdeel.id, kolom: "afbeelding_bijschrift" }} begin={onderdeel.afbeelding_bijschrift} label="Bijschrift bij de afbeelding" maxLengte={200} />
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-han border border-rand bg-vlak p-4">
        <h2 className="text-xl">Veiligheid</h2>
        {p("sociale_veiligheid", "Sociale veiligheid", { eigenaar: eigenaarVE, hulp: "Hoe zorg je dat iedereen zich veilig en welkom voelt?" })}
        <TekstVeld
          doel={{ soort: "onderdeel", id: onderdeel.id, kolom: "fysieke_veiligheid" }} begin={onderdeel.fysieke_veiligheid}
          label="Fysieke veiligheid" eigenaar={eigenaarVE} meerRegels maxLengte={1000}
          hulp="Verplicht: wat kan er misgaan en wat doe je eraan?"
        />
      </section>

      <section className="flex flex-col gap-4 rounded-han border border-rand bg-vlak p-4">
        <h2 className="text-xl">Differentiatie en groepsaanpassing</h2>
        <p className="-mt-2 text-sm font-medium text-zacht">Eigenaar: {eigenaarPB}</p>
        {p("individu_moeilijker", "Individu: moeilijker maken")}
        {p("individu_makkelijker", "Individu: makkelijker maken")}
        {p("groep_moeilijker", "Groep: moeilijker maken")}
        {p("groep_makkelijker", "Groep: makkelijker maken")}
      </section>

      <section className="flex flex-col gap-4 rounded-han border border-rand bg-vlak p-4">
        <h2 className="text-xl">USV</h2>
        {p("usv_uitdagend", "Uitdagend", { eigenaar: eigenaarPB })}
        {p("usv_speelbaar", "Speelbaar", { eigenaar: eigenaarPB })}
        <div className="rounded-han bg-achtergrond p-3">
          <p className="font-bold text-kop">Veilig</p>
          <p className="text-tekst">{onderdeel.fysieke_veiligheid?.trim() || <span className="text-zacht">Vul hierboven de fysieke veiligheid in; die staat hier dan ook.</span>}</p>
        </div>
        {p("usv_veilig_aanvulling", "Veilig: aanvulling (alleen als er meer nodig is)", { eigenaar: eigenaarVE })}
      </section>
    </div>
  );
}
