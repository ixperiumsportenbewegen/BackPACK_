import { CalendarClock, CircleAlert, Clock, TriangleAlert } from "lucide-react";
import type { DeadlineNiveau } from "@/lib/deadlines";

const STIJL: Record<DeadlineNiveau, { klasse: string; icoon: typeof Clock }> = {
  ruim: { klasse: "bg-rand text-kop", icoon: CalendarClock },
  binnenkort: { klasse: "bg-ingediend text-black", icoon: Clock },
  dringend: { klasse: "bg-actie text-black", icoon: TriangleAlert },
  verstreken: { klasse: "border-2 border-kop bg-vlak text-kop", icoon: CircleAlert },
};

/** Hoe lang het nog duurt, met kleur, icoon en tekst (kleur alleen is nooit genoeg). */
export function DeadlineBadge({ niveau, tekst }: { niveau: DeadlineNiveau; tekst: string }) {
  const s = STIJL[niveau];
  const Icoon = s.icoon;
  return (
    <span data-niveau={niveau} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-han px-2 py-0.5 text-sm font-bold ${s.klasse}`}>
      <Icoon aria-hidden className="size-4" /> {tekst}
    </span>
  );
}
