import { CheckCircle2, CircleDashed, CircleDot, Minus } from "lucide-react";
import type { VoortgangStatus } from "@/lib/avfVoortgang";

const LABELS: Record<VoortgangStatus, { tekst: string; klasse: string; icoon: typeof CheckCircle2 }> = {
  niet_gestart: { tekst: "Niet gestart", klasse: "bg-rand text-kop", icoon: CircleDashed },
  onvolledig: { tekst: "Onvolledig", klasse: "bg-actie text-black", icoon: CircleDot },
  compleet: { tekst: "Compleet", klasse: "bg-goedgekeurd text-black", icoon: CheckCircle2 },
  nvt: { tekst: "Komt later", klasse: "bg-rand text-kop", icoon: Minus },
};

/** Voortgangslabel met icoon en tekst (nooit alleen kleur). */
export function StatusLabel({ status }: { status: VoortgangStatus }) {
  const l = LABELS[status];
  const Icoon = l.icoon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-han px-2 py-0.5 text-xs font-bold ${l.klasse}`}>
      <Icoon aria-hidden className="size-3.5" /> {l.tekst}
    </span>
  );
}
