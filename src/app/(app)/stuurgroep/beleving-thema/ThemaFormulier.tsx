"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Trash2, TriangleAlert } from "lucide-react";
import { themaVeldOpslaan, type ThemaVeld } from "./actions";
import { maakBrowserClient } from "@/lib/supabase/client";
import { verkleinAfbeelding } from "@/lib/afbeelding";
import { HAN_ACCENTEN, MIN_CONTRAST, contrastRatio, kleurOpAccent } from "@/lib/thema";
import { OUTDOOR_FOTOS, STANDAARD_SFEERBEELD, themaBeeldUrl } from "@/lib/themaBeeld";

export interface ThemaWaarden {
  naam: string | null;
  verhaal: string | null;
  slogan: string | null;
  accentkleur: string | null;
  sfeerbeeld_pad: string | null;
  logo_pad: string | null;
}

type Melding = { soort: "bezig" | "ok" | "fout" | "waarschuwing"; tekst: string };
type Conflict = { huidig: string | null; door: string | null; mijn: string | null };

const NAAM_SLEUTEL = "backpack_themanaam";
const LICHT_BEELD = 0.6;

export function ThemaFormulier({
  clusterId,
  clusterNaam,
  begin,
}: {
  clusterId: string;
  clusterNaam: string;
  begin: ThemaWaarden;
}) {
  const router = useRouter();
  const [opgeslagen, setOpgeslagen] = useState<ThemaWaarden>(begin);
  const [concept, setConcept] = useState<ThemaWaarden>(begin);
  const [meldingen, setMeldingen] = useState<Partial<Record<ThemaVeld, Melding>>>({});
  const [conflicten, setConflicten] = useState<Partial<Record<ThemaVeld, Conflict>>>({});
  const [wie, setWie] = useState("");

  useEffect(() => {
    try {
      // Eenmalig na het laden: opslag in de browser bestaat niet op de server.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWie(localStorage.getItem(NAAM_SLEUTEL) ?? "");
    } catch {
      /* opslag niet beschikbaar: dan blijft het veld leeg */
    }
  }, []);

  function zetMelding(veld: ThemaVeld, m: Melding | undefined) {
    setMeldingen((vorige) => ({ ...vorige, [veld]: m }));
  }

  const bewaar = useCallback(
    async (veld: ThemaVeld, nieuw: string | null, oudOverride?: string | null): Promise<boolean> => {
      if (!wie.trim()) {
        zetMelding(veld, { soort: "fout", tekst: "Vul hierboven eerst je naam in." });
        return false;
      }
      const oud = oudOverride !== undefined ? oudOverride : opgeslagen[veld];
      zetMelding(veld, { soort: "bezig", tekst: "Bezig met opslaan…" });
      const res = await themaVeldOpslaan(veld, oud, nieuw, wie);
      if (res.status === "ok") {
        setOpgeslagen((o) => ({ ...o, [veld]: res.nieuw }));
        setConcept((c) => ({ ...c, [veld]: res.nieuw }));
        setConflicten((c) => ({ ...c, [veld]: undefined }));
        zetMelding(veld, { soort: "ok", tekst: "Opgeslagen" });
        router.refresh();
        return true;
      }
      if (res.status === "conflict") {
        setConflicten((c) => ({ ...c, [veld]: { huidig: res.huidig, door: res.door, mijn: nieuw } }));
        zetMelding(veld, { soort: "waarschuwing", tekst: "Iemand anders heeft dit net gewijzigd." });
        return false;
      }
      zetMelding(veld, { soort: "fout", tekst: res.melding });
      return false;
    },
    [wie, opgeslagen, router],
  );

  function onNaamVeranderd(waarde: string) {
    setWie(waarde);
    try {
      localStorage.setItem(NAAM_SLEUTEL, waarde);
    } catch {
      /* niet erg */
    }
  }

  function bewaarTekst(veld: "naam" | "verhaal" | "slogan") {
    const nieuw = (concept[veld] ?? "").trim() || null;
    if (nieuw === opgeslagen[veld]) return;
    void bewaar(veld, nieuw);
  }

  async function uploadAfbeelding(veld: "sfeerbeeld_pad" | "logo_pad", bestand: File) {
    if (!wie.trim()) {
      zetMelding(veld, { soort: "fout", tekst: "Vul hierboven eerst je naam in." });
      return;
    }
    zetMelding(veld, { soort: "bezig", tekst: "Foto verkleinen en uploaden…" });
    try {
      const klein = await verkleinAfbeelding(bestand, veld === "logo_pad" ? 600 : 1600);
      const pad = `cluster/${clusterId}/${veld === "logo_pad" ? "logo" : "sfeerbeeld"}-${Date.now()}.${klein.extensie}`;
      const supabase = maakBrowserClient();
      const { error } = await supabase.storage
        .from("thema")
        .upload(pad, klein.blob, { contentType: klein.blob.type, cacheControl: "31536000" });
      if (error) {
        zetMelding(veld, { soort: "fout", tekst: "Uploaden is niet gelukt. Probeer het opnieuw." });
        return;
      }
      const oudPad = opgeslagen[veld];
      const gelukt = await bewaar(veld, pad);
      if (!gelukt) {
        await supabase.storage.from("thema").remove([pad]);
        return;
      }
      if (oudPad?.startsWith("cluster/")) await supabase.storage.from("thema").remove([oudPad]);
      if (veld === "sfeerbeeld_pad" && klein.helderheidOnder > LICHT_BEELD) {
        zetMelding(veld, {
          soort: "waarschuwing",
          tekst: "Opgeslagen, maar dit beeld is erg licht. De witte themanaam wordt daardoor slecht leesbaar. Kies liever een rustiger of donkerder beeld.",
        });
      }
    } catch (e) {
      zetMelding(veld, { soort: "fout", tekst: e instanceof Error ? e.message : "Dit bestand kan niet worden gebruikt." });
    }
  }

  async function verwijderAfbeelding(veld: "sfeerbeeld_pad" | "logo_pad") {
    const oudPad = opgeslagen[veld];
    const gelukt = await bewaar(veld, null);
    if (gelukt && oudPad?.startsWith("cluster/")) await maakBrowserClient().storage.from("thema").remove([oudPad]);
  }

  const accent = concept.accentkleur ?? "#E50056";
  const tekstKleur = kleurOpAccent(accent);
  const ratio = contrastRatio(accent, tekstKleur);
  const sfeerUrl = themaBeeldUrl(opgeslagen.sfeerbeeld_pad ?? STANDAARD_SFEERBEELD, 800);
  const logoUrl = themaBeeldUrl(opgeslagen.logo_pad);

  return (
    <div className="flex flex-col gap-6">
      {/* Naam */}
      <section className="rounded-han border border-rand bg-vlak p-4">
        <label className="flex flex-col gap-1 font-medium text-kop">
          Wie werkt hier? (jouw naam)
          <input
            value={wie}
            onChange={(e) => onNaamVeranderd(e.target.value)}
            autoComplete="off"
            maxLength={60}
            placeholder="Bijvoorbeeld Sanne"
            className="min-h-aanraak rounded-han border-2 border-zacht bg-vlak px-3 text-base font-normal text-tekst"
          />
        </label>
        <p className="mt-2 text-sm text-zacht">
          Jullie delen één account. Met je naam zien anderen wie het laatst iets wijzigde. Dit onthoudt je telefoon.
        </p>
      </section>

      {/* Live voorbeeld */}
      <section aria-label="Voorbeeld" className="overflow-hidden rounded-han border border-rand bg-vlak">
        <div className="flex items-center gap-3 border-b-4 bg-vlak px-4 py-3" style={{ borderColor: accent }}>
          {logoUrl && <img src={logoUrl} alt="" className="h-8 w-auto max-w-24 object-contain" />}
          <p className="font-heading text-lg font-bold text-kop">{concept.naam?.trim() || "Naam van jullie thema"}</p>
        </div>
        <div className="relative bg-kop">
          {sfeerUrl && <img src={sfeerUrl} alt="" className="h-36 w-full object-cover opacity-70" />}
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 to-transparent p-3 text-white">
            <p className="font-heading text-xl font-bold">{concept.naam?.trim() || "Kies jullie meerdaagsethema"}</p>
            {concept.slogan?.trim() && <p className="text-sm font-medium">{concept.slogan}</p>}
          </div>
        </div>
        <div className="px-4 py-3">
          <span
            className="inline-block rounded-han px-3 py-1 text-sm font-bold"
            style={{ backgroundColor: accent, color: tekstKleur }}
          >
            Zo ziet een knop of label eruit
          </span>
        </div>
      </section>

      {/* Tekstvelden */}
      <section className="flex flex-col gap-4 rounded-han border border-rand bg-vlak p-4">
        <h2 className="text-xl">Het thema van {clusterNaam}</h2>
        <TekstVeld
          label="Naam van het thema"
          waarde={concept.naam ?? ""}
          onChange={(v) => setConcept((c) => ({ ...c, naam: v }))}
          onBlur={() => bewaarTekst("naam")}
          melding={meldingen.naam}
          conflict={conflicten.naam}
          maxLength={60}
          onNeemOver={(c) => { setConcept((x) => ({ ...x, naam: c.huidig })); setOpgeslagen((o) => ({ ...o, naam: c.huidig })); setConflicten((k) => ({ ...k, naam: undefined })); zetMelding("naam", undefined); router.refresh(); }}
          onBewaarMijn={(c) => void bewaar("naam", c.mijn, c.huidig)}
        />
        <TekstVeld
          label="Korte verhaallijn"
          waarde={concept.verhaal ?? ""}
          onChange={(v) => setConcept((c) => ({ ...c, verhaal: v }))}
          onBlur={() => bewaarTekst("verhaal")}
          melding={meldingen.verhaal}
          conflict={conflicten.verhaal}
          maxLength={600}
          meerRegels
          onNeemOver={(c) => { setConcept((x) => ({ ...x, verhaal: c.huidig })); setOpgeslagen((o) => ({ ...o, verhaal: c.huidig })); setConflicten((k) => ({ ...k, verhaal: undefined })); zetMelding("verhaal", undefined); router.refresh(); }}
          onBewaarMijn={(c) => void bewaar("verhaal", c.mijn, c.huidig)}
        />
        <TekstVeld
          label="Slogan (mag leeg)"
          waarde={concept.slogan ?? ""}
          onChange={(v) => setConcept((c) => ({ ...c, slogan: v }))}
          onBlur={() => bewaarTekst("slogan")}
          melding={meldingen.slogan}
          conflict={conflicten.slogan}
          maxLength={80}
          onNeemOver={(c) => { setConcept((x) => ({ ...x, slogan: c.huidig })); setOpgeslagen((o) => ({ ...o, slogan: c.huidig })); setConflicten((k) => ({ ...k, slogan: undefined })); zetMelding("slogan", undefined); router.refresh(); }}
          onBewaarMijn={(c) => void bewaar("slogan", c.mijn, c.huidig)}
        />
      </section>

      {/* Accentkleur */}
      <section className="rounded-han border border-rand bg-vlak p-4">
        <h2 className="text-xl">Accentkleur</h2>
        <p className="mt-1 text-sm text-zacht">Uit de HAN-kleuren. De tekst op de kleur wordt automatisch wit of zwart.</p>
        <div role="radiogroup" aria-label="Accentkleur" className="mt-3 grid grid-cols-2 gap-2">
          {HAN_ACCENTEN.map((a) => {
            const gekozen = concept.accentkleur?.toLowerCase() === a.hex.toLowerCase();
            const tekst = kleurOpAccent(a.hex);
            return (
              <button
                key={a.hex}
                type="button"
                role="radio"
                aria-checked={gekozen}
                onClick={() => {
                  setConcept((c) => ({ ...c, accentkleur: a.hex }));
                  void bewaar("accentkleur", a.hex);
                }}
                className={`flex min-h-aanraak items-center justify-center gap-2 rounded-han border-4 px-3 font-bold ${
                  gekozen ? "border-kop" : "border-transparent"
                }`}
                style={{ backgroundColor: a.hex, color: tekst }}
              >
                {gekozen && <Check aria-hidden className="size-5" />}
                {a.naam}
              </button>
            );
          })}
        </div>
        <p className={`mt-3 flex items-center gap-2 text-sm font-medium ${ratio >= MIN_CONTRAST ? "text-kop" : "text-fout"}`}>
          {ratio >= MIN_CONTRAST ? <Check aria-hidden className="size-4" /> : <TriangleAlert aria-hidden className="size-4" />}
          Contrast {tekstKleur === "#FFFFFF" ? "witte" : "zwarte"} tekst: {ratio.toFixed(1)} op 1
          {ratio >= MIN_CONTRAST ? " (goed leesbaar)" : " (te laag, kies een andere kleur)"}
        </p>
        <MeldingRegel melding={meldingen.accentkleur} />
      </section>

      {/* Sfeerbeeld */}
      <section className="rounded-han border border-rand bg-vlak p-4">
        <h2 className="text-xl">Sfeerbeeld</h2>
        <p className="mt-1 text-sm text-zacht">
          Upload een eigen foto of kies een outdoorfoto. Kies een rustig, helder beeld met herkenbare buitensfeer.
          Geen donkere, fantasy- of AI-beelden: we zijn de HAN, niet de Efteling. Foto&apos;s waarop mensen herkenbaar zijn
          alleen met hun akkoord.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <BestandKnop
            label="Eigen foto uploaden"
            onKies={(f) => void uploadAfbeelding("sfeerbeeld_pad", f)}
          />
          {opgeslagen.sfeerbeeld_pad && (
            <button
              type="button"
              onClick={() => void verwijderAfbeelding("sfeerbeeld_pad")}
              className="flex min-h-aanraak items-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop"
            >
              <Trash2 aria-hidden className="size-5" /> Standaardbeeld gebruiken
            </button>
          )}
        </div>
        <p className="mt-4 text-sm font-medium text-kop">Of kies een outdoorfoto:</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {OUTDOOR_FOTOS.map((f) => {
            const pad = `fotos/${f.id}`;
            const gekozen = opgeslagen.sfeerbeeld_pad === pad;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={gekozen}
                onClick={() => void bewaar("sfeerbeeld_pad", pad)}
                className={`overflow-hidden rounded-han border-4 text-left ${gekozen ? "border-kop" : "border-transparent"}`}
              >
                <img src={`/fotos/${f.id}-800.webp`} alt="" className="h-24 w-full object-cover" loading="lazy" />
                <span className="block bg-vlak px-2 py-1 text-xs font-medium text-kop">{f.label}</span>
              </button>
            );
          })}
        </div>
        <ConflictBlok
          conflict={conflicten.sfeerbeeld_pad}
          onNeemOver={(c) => { setOpgeslagen((o) => ({ ...o, sfeerbeeld_pad: c.huidig })); setConflicten((k) => ({ ...k, sfeerbeeld_pad: undefined })); zetMelding("sfeerbeeld_pad", undefined); router.refresh(); }}
          onBewaarMijn={(c) => void bewaar("sfeerbeeld_pad", c.mijn, c.huidig)}
          beeld
        />
        <MeldingRegel melding={meldingen.sfeerbeeld_pad} />
      </section>

      {/* Logo */}
      <section className="rounded-han border border-rand bg-vlak p-4">
        <h2 className="text-xl">Logo (mag leeg)</h2>
        <p className="mt-1 text-sm text-zacht">Komt naast de naam in de kopbalk. Liefst een PNG met transparante achtergrond.</p>
        {logoUrl && <img src={logoUrl} alt="Huidig logo" className="mt-3 h-16 w-auto max-w-40 object-contain" />}
        <div className="mt-3 flex flex-wrap gap-2">
          <BestandKnop label={logoUrl ? "Ander logo uploaden" : "Logo uploaden"} onKies={(f) => void uploadAfbeelding("logo_pad", f)} />
          {logoUrl && (
            <button
              type="button"
              onClick={() => void verwijderAfbeelding("logo_pad")}
              className="flex min-h-aanraak items-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop"
            >
              <Trash2 aria-hidden className="size-5" /> Logo verwijderen
            </button>
          )}
        </div>
        <ConflictBlok
          conflict={conflicten.logo_pad}
          onNeemOver={(c) => { setOpgeslagen((o) => ({ ...o, logo_pad: c.huidig })); setConflicten((k) => ({ ...k, logo_pad: undefined })); zetMelding("logo_pad", undefined); router.refresh(); }}
          onBewaarMijn={(c) => void bewaar("logo_pad", c.mijn, c.huidig)}
          beeld
        />
        <MeldingRegel melding={meldingen.logo_pad} />
      </section>
    </div>
  );
}

function MeldingRegel({ melding }: { melding?: Melding }) {
  if (!melding) return <p aria-live="polite" className="min-h-6" />;
  const kleur = melding.soort === "fout" ? "text-fout" : "text-kop";
  return (
    <p aria-live="polite" role={melding.soort === "fout" ? "alert" : undefined} className={`mt-2 min-h-6 text-sm font-medium ${kleur}`}>
      {melding.soort === "ok" && <Check aria-hidden className="mr-1 inline size-4" />}
      {melding.soort === "waarschuwing" && <TriangleAlert aria-hidden className="mr-1 inline size-4" />}
      {melding.tekst}
    </p>
  );
}

function ConflictBlok({
  conflict, onNeemOver, onBewaarMijn, beeld,
}: {
  conflict?: Conflict;
  onNeemOver: (c: Conflict) => void;
  onBewaarMijn: (c: Conflict) => void;
  beeld?: boolean;
}) {
  if (!conflict) return null;
  return (
    <div role="alert" className="mt-3 rounded-han border-2 border-kop bg-vlak p-3">
      <p className="font-medium text-kop">
        {conflict.door ? `${conflict.door} heeft` : "Iemand anders heeft"} dit net gewijzigd
        {beeld ? "." : `. Nu staat er: “${conflict.huidig ?? "(leeg)"}”`}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => onNeemOver(conflict)} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
          Hun versie houden
        </button>
        <button type="button" onClick={() => onBewaarMijn(conflict)} className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk">
          Mijn versie bewaren
        </button>
      </div>
    </div>
  );
}

function TekstVeld({
  label, waarde, onChange, onBlur, melding, conflict, maxLength, meerRegels, onNeemOver, onBewaarMijn,
}: {
  label: string;
  waarde: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  melding?: Melding;
  conflict?: Conflict;
  maxLength: number;
  meerRegels?: boolean;
  onNeemOver: (c: Conflict) => void;
  onBewaarMijn: (c: Conflict) => void;
}) {
  const gedeeld = "w-full rounded-han border-2 border-zacht bg-vlak px-3 text-base font-normal text-tekst";
  return (
    <div>
      <label className="flex flex-col gap-1 font-medium text-kop">
        {label}
        {meerRegels ? (
          <textarea value={waarde} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} maxLength={maxLength} rows={4} className={`${gedeeld} py-2`} />
        ) : (
          <input value={waarde} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} maxLength={maxLength} className={`${gedeeld} min-h-aanraak`} />
        )}
      </label>
      <ConflictBlok conflict={conflict} onNeemOver={onNeemOver} onBewaarMijn={onBewaarMijn} />
      <MeldingRegel melding={melding} />
    </div>
  );
}

function BestandKnop({ label, onKies }: { label: string; onKies: (f: File) => void }) {
  return (
    <label className="flex min-h-aanraak cursor-pointer items-center gap-2 rounded-han bg-merk px-4 font-bold text-op-merk focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-kop">
      <ImagePlus aria-hidden className="size-5" />
      {label}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onKies(f);
        }}
      />
    </label>
  );
}
