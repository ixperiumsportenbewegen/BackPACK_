"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { themacheckZetten } from "@/app/(app)/beoordeling-actions";
import { NaamVeld, useNaam } from "@/components/NaamVeld";
import type { Themacheck } from "@/lib/beoordeling";
import { formatMoment } from "@/lib/tijd";

interface Rol {
  code: string;
  naam: string;
}

/**
 * Themachecks: per stuurgroeprol een akkoord of aandachtspunt. Elke rol vult de eigen check in.
 * Een aandachtspunt blokkeert het goedkeuren niet.
 */
export function ThemacheckBlok({
  avfId, rollen, checks, eigenRol, actief,
}: { avfId: string; rollen: Rol[]; checks: Themacheck[]; eigenRol: string | null; actief: boolean }) {
  const router = useRouter();
  const [naam, setNaam] = useNaam();
  const [bezig, setBezig] = useState<string | null>(null);
  const [fout, setFout] = useState<{ rol: string; tekst: string } | null>(null);
  const [concept, setConcept] = useState<Record<string, string>>({});

  async function zet(rol: string, oordeel: "akkoord" | "aandachtspunt") {
    setFout(null);
    setBezig(rol);
    const huidig = checks.find((c) => c.rol === rol);
    const res = await themacheckZetten(avfId, rol, oordeel, concept[rol] ?? huidig?.toelichting ?? "", naam);
    setBezig(null);
    if (res.status === "ok") router.refresh();
    else setFout({ rol, tekst: res.melding });
  }

  const gesorteerd = [...rollen].sort((a, b) => (a.code === eigenRol ? -1 : b.code === eigenRol ? 1 : 0));
  return (
    <section aria-label="Themachecks" className="flex flex-col gap-3 rounded-han border border-rand bg-vlak p-4">
      <h2 className="text-xl">Themachecks</h2>
      <p className="text-sm text-zacht">Elke rol van de stuurgroep kan aangeven of dit AVF akkoord is voor het eigen vakgebied. Een aandachtspunt blokkeert het goedkeuren niet.</p>
      {actief && <NaamVeld naam={naam} setNaam={setNaam} />}
      <ul className="flex flex-col gap-3">
        {gesorteerd.map((r) => {
          const c = checks.find((x) => x.rol === r.code);
          return (
            <li key={r.code} className={`rounded-han border-2 p-3 ${r.code === eigenRol ? "border-merk" : "border-rand"}`}>
              <p className="flex flex-wrap items-center gap-2 font-bold text-kop">
                {r.naam}{r.code === eigenRol && <span className="text-sm font-medium text-zacht">(jullie rol)</span>}
                {c && (
                  <span className={`inline-flex items-center gap-1 rounded-han px-2 py-0.5 text-xs font-bold text-black ${c.oordeel === "akkoord" ? "bg-goedgekeurd" : "bg-actie"}`}>
                    {c.oordeel === "akkoord" ? <CheckCircle2 aria-hidden className="size-3.5" /> : <TriangleAlert aria-hidden className="size-3.5" />}
                    {c.oordeel === "akkoord" ? "Akkoord" : "Aandachtspunt"}
                  </span>
                )}
              </p>
              {c?.toelichting && <p className="mt-1 whitespace-pre-wrap text-tekst">{c.toelichting}</p>}
              {c && <p className="text-sm text-zacht">{c.doorNaam} · {formatMoment(c.updatedAt)}</p>}
              {!c && <p className="text-sm text-zacht">Nog geen check.</p>}
              {actief && (
                <div className="mt-2 flex flex-col gap-2">
                  <textarea
                    aria-label={`Toelichting ${r.naam}`} rows={2} maxLength={1000}
                    value={concept[r.code] ?? c?.toelichting ?? ""} onChange={(e) => setConcept({ ...concept, [r.code]: e.target.value })}
                    placeholder="Toelichting (verplicht bij een aandachtspunt)"
                    className="rounded-han border-2 border-zacht bg-vlak p-2 text-base text-tekst"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={bezig === r.code} onClick={() => zet(r.code, "akkoord")} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-3 font-bold text-kop disabled:opacity-60">
                      Akkoord
                    </button>
                    <button type="button" disabled={bezig === r.code} onClick={() => zet(r.code, "aandachtspunt")} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-3 font-bold text-kop disabled:opacity-60">
                      Aandachtspunt
                    </button>
                  </div>
                  {fout?.rol === r.code && <p role="alert" className="font-bold text-fout">{fout.tekst}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
