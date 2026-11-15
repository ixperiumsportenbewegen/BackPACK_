import { CalendarClock } from "lucide-react";
import { deadlineNiveau, formatDeadline, resterendTekst } from "@/lib/deadlines";

/**
 * Een kleine regel bij een onderdeel van het AVF: "Deadline: nog 5 dagen". Met `volledig` staat ook de datum erbij.
 * Hoe urgenter, hoe vetter; de tekst zelf zegt het ook (kleur alleen is nooit genoeg).
 */
export function DeadlineLabel({ moment, volledig = false, nu = new Date() }: { moment: Date; volledig?: boolean; nu?: Date }) {
  const niveau = deadlineNiveau(moment, nu);
  const urgent = niveau === "dringend" || niveau === "verstreken";
  return (
    <span data-testid="deadline-label" data-niveau={niveau} className={`inline-flex flex-wrap items-center gap-1 text-sm ${urgent ? "font-bold text-kop" : "font-medium text-zacht"}`}>
      <CalendarClock aria-hidden className="size-4 shrink-0" />
      Deadline: {resterendTekst(moment, nu)}{volledig && <span className="font-normal"> · {formatDeadline(moment)}</span>}
    </span>
  );
}
