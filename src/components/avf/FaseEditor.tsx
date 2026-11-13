"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { onderdeelToevoegen, onderdeelVerplaatsen, onderdeelVerwijderen } from "@/app/(app)/avf/actions";
import { AfbeeldingVeld } from "@/components/avf/AfbeeldingVeld";
import { useAvfEditor } from "@/components/avf/AvfEditor";
import { TekstVeld } from "@/components/avf/Velden";
import { OPRUIMEN_VELDEN } from "@/config/avf-velden";
import { PROJECTGROEPROLLEN } from "@/config/projectgroeprollen";
import type { AvfGegevens } from "@/lib/avfData";

type Fase = "kop" | "romp" | "staart";
const FASEN: { code: Fase; label: string; uitleg: string }[] = [
  { code: "kop", label: "Kop", uitleg: "Het begin: welkom, uitleg en opwarming." },
  { code: "romp", label: "Romp", uitleg: "Het hoofdgedeelte van de belevenis." },
  { code: "staart", label: "Staart", uitleg: "De afsluiting: uitlopen, terugblik en opruimen." },
];

const naamVan = (code: string) => PROJECTGROEPROLLEN.find((r) => r.code === code)?.naam ?? null;

/** Sectie D voor één fase: fasevelden, opruimen en de lijst met onderdelen. */
export function FaseEditor({ fase, avf }: { fase: Fase; avf: AvfGegevens }) {
  const router = useRouter();
  const { naam, vergrendeld } = useAvfEditor();
  const [fout, setFout] = useState<string | null>(null);
  const [bevestig, setBevestig] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const f = avf.fasen.find((x) => x.fase === fase)!;
  const onderdelen = avf.onderdelen.filter((o) => o.fase === fase);
  const huidig = FASEN.find((x) => x.code === fase)!;

  async function voegToe() {
    setFout(null);
    if (!naam.trim()) { setFout("Vul bovenaan eerst je naam in."); return; }
    setBezig(true);
    const res = await onderdeelToevoegen(fase, naam);
    if (res.status === "ok") router.push(`/avf/onderdeel/${res.id}`); // blijft 'bezig' tot de nieuwe pagina er is
    else { setBezig(false); setFout(res.melding); }
  }

  async function verplaats(id: string, richting: -1 | 1) {
    setFout(null);
    if (!naam.trim()) { setFout("Vul bovenaan eerst je naam in."); return; }
    setBezig(true);
    const res = await onderdeelVerplaatsen(id, richting, naam);
    setBezig(false);
    if (res.status === "ok") router.refresh();
    else setFout(res.melding);
  }

  async function verwijder(id: string) {
    setFout(null);
    if (!naam.trim()) { setFout("Vul bovenaan eerst je naam in."); return; }
    setBezig(true);
    const res = await onderdeelVerwijderen(id, naam);
    setBezig(false);
    if (res.status === "ok") { setBevestig(null); router.refresh(); }
    else setFout(res.melding);
  }

  const eigenaarPB = naamVan("programma_beleving");

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Fase" className="grid grid-cols-3 gap-2">
        {FASEN.map((x) => (
          <Link
            key={x.code} href={`/avf/D?fase=${x.code}`} scroll={false} aria-current={x.code === fase ? "page" : undefined}
            className={`flex min-h-aanraak items-center justify-center rounded-han border-2 font-bold ${x.code === fase ? "border-kop bg-kop text-white" : "border-zacht bg-vlak text-kop"}`}
          >
            {x.label}
          </Link>
        ))}
      </nav>
      <p className="text-zacht">{huidig.uitleg}</p>

      <section className="flex flex-col gap-4 rounded-han border border-rand bg-vlak p-4">
        <h2 className="text-xl">{huidig.label}: verloop</h2>
        <TekstVeld doel={{ soort: "fase", fase, kolom: "organisatievorm" }} begin={f.organisatievorm} label="Organisatievorm" eigenaar={eigenaarPB} meerRegels maxLengte={1000} />
        <AfbeeldingVeld
          doel={{ soort: "fase", fase, kolom: "overzichtstekening_pad" }} begin={f.overzichtstekening_pad}
          avfId={avf.id} clusterId={avf.clusterId} label="Overzichtstekening (organisatie)" prefix={`tekening-${fase}`}
          uitleg="Een foto of tekening van de opstelling. Alleen afbeeldingen, geen pdf's of Word-bestanden."
        />
        {f.overzichtstekening_pad && (
          <TekstVeld doel={{ soort: "fase", fase, kolom: "overzichtstekening_bijschrift" }} begin={f.overzichtstekening_bijschrift} label="Bijschrift bij de tekening" maxLengte={200} />
        )}
        <TekstVeld doel={{ soort: "fase", fase, kolom: "coachen_instructies" }} begin={f.coachen_instructies} label="Coachen en instructies" eigenaar={eigenaarPB} meerRegels maxLengte={2000} />
        <TekstVeld doel={{ soort: "fase", fase, kolom: "stemgebruik_houding" }} begin={f.stemgebruik_houding} label="Stemgebruik en houding" eigenaar={eigenaarPB} meerRegels maxLengte={1000} />
      </section>

      <section className="flex flex-col gap-4 rounded-han border border-rand bg-vlak p-4">
        <h2 className="text-xl">Opruimen volgens de 6 W&apos;s</h2>
        <p className="-mt-2 text-sm font-medium text-zacht">Eigenaar: {naamVan("corvee_communicatie")}</p>
        {OPRUIMEN_VELDEN.map((w) => (
          <TekstVeld
            key={w.sleutel}
            doel={{ soort: "opruimen", fase, sleutel: w.sleutel }}
            begin={(f.opruimen?.[w.sleutel] as string | null | undefined) ?? null}
            label={w.label}
            maxLengte={300}
          />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl">Onderdelen van de {huidig.label.toLowerCase()}</h2>
        <p className="text-sm text-zacht">Minstens één onderdeel per fase. Open een onderdeel om het uit te werken.</p>
        {onderdelen.length === 0 && <p className="rounded-han bg-achtergrond p-3 text-zacht">Nog geen onderdelen in de {huidig.label.toLowerCase()}.</p>}
        <ol className="flex flex-col gap-2">
          {onderdelen.map((o, n) => (
            <li key={o.id} className="rounded-han border-2 border-rand bg-vlak p-2">
              <div className="flex items-center gap-2">
                <Link href={`/avf/onderdeel/${o.id}`} className="flex min-h-aanraak flex-1 items-center gap-2 px-1">
                  <span className="flex-1">
                    <span className="block font-bold text-kop">{n + 1}. {o.naam?.trim() || "Onderdeel zonder naam"}</span>
                    <span className="block text-sm text-zacht">{o.duur_minuten ? `${o.duur_minuten} minuten` : "Duur nog niet ingevuld"}</span>
                  </span>
                  <ChevronRight aria-hidden className="size-5 text-kop" />
                </Link>
                {!vergrendeld && (
                  <div className="flex">
                    <button type="button" aria-label="Omhoog" disabled={n === 0 || bezig} onClick={() => void verplaats(o.id, -1)} className="flex size-aanraak items-center justify-center text-kop disabled:opacity-30">
                      <ArrowUp aria-hidden className="size-5" />
                    </button>
                    <button type="button" aria-label="Omlaag" disabled={n === onderdelen.length - 1 || bezig} onClick={() => void verplaats(o.id, 1)} className="flex size-aanraak items-center justify-center text-kop disabled:opacity-30">
                      <ArrowDown aria-hidden className="size-5" />
                    </button>
                  </div>
                )}
              </div>
              {!vergrendeld && (
                bevestig === o.id ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2 px-1">
                    <span className="font-medium text-kop">Zeker weten?</span>
                    <button type="button" onClick={() => void verwijder(o.id)} disabled={bezig} className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">{bezig ? "Bezig…" : "Ja, verwijderen"}</button>
                    <button type="button" onClick={() => setBevestig(null)} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">Nee</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setBevestig(o.id)} className="flex min-h-aanraak items-center gap-2 px-1 text-sm font-bold text-kop underline">
                    <Trash2 aria-hidden className="size-4" /> Verwijderen
                  </button>
                )
              )}
            </li>
          ))}
        </ol>
        {!vergrendeld && (
          <button type="button" onClick={() => void voegToe()} disabled={bezig} className="flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop disabled:opacity-60">
            {bezig ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Plus aria-hidden className="size-5" />} {bezig ? "Bezig…" : "Onderdeel toevoegen"}
          </button>
        )}
        {fout && <p role="alert" className="font-medium text-fout">{fout}</p>}
      </section>
    </div>
  );
}
