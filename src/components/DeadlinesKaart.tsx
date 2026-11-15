import Link from "next/link";
import { CalendarClock, CheckCircle2, ChevronRight } from "lucide-react";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { laadAvf, laadKaarten, type AvfGegevens } from "@/lib/avfData";
import { laadDeadlines } from "@/lib/deadlineData";
import {
  deadlineNiveau, deadlineStand, formatDeadline, naamVanOnderdeel, resterendTekst, type DeadlineRij,
} from "@/lib/deadlines";
import type { Profiel } from "@/lib/profiel";

/** Waar een groep een onderdeel invult. */
export function deadlineHref(onderdeel: string): string {
  if (onderdeel === "indienen") return "/avf/indienen";
  if (onderdeel === "materiaal") return "/avf/F";
  if (onderdeel === "budget") return "/budget";
  return `/avf/${onderdeel}`;
}

interface Regel {
  deadline: DeadlineRij;
  afgerond: boolean;
  /** Voor een projectgroep: de eigen stand. */
  eigen: { klaar: boolean; tekst: string } | null;
  /** Voor stuurgroep en docent: hoeveel groepen klaar zijn en wie nog niet. */
  groepen: { klaar: number; totaal: number; open: string[] } | null;
}

/**
 * De kaart "Deadlines" op het startscherm: wat moet wanneer af en hoe lang het nog duurt. Een projectgroep ziet de
 * eigen stand, de stuurgroep en de docent zien hoeveel groepen klaar zijn. Een deadline blokkeert niets.
 */
export async function DeadlinesKaart({ profiel, eigenAvf }: { profiel: Profiel; eigenAvf: AvfGegevens | null }) {
  const cluster = profiel.cluster;
  if (!cluster) return null;
  const beheert = profiel.soort === "stuurgroep" || profiel.soort === "docent";
  const deadlines = await laadDeadlines(cluster.id);

  if (deadlines.length === 0) {
    if (!beheert) return null;
    return (
      <section aria-labelledby="deadlines-kop" className="rounded-han border border-rand bg-vlak p-4" data-testid="deadlines-kaart">
        <h2 id="deadlines-kop" className="flex items-center gap-2 text-xl"><CalendarClock aria-hidden className="size-6" strokeWidth={1.75} /> Deadlines</h2>
        <p className="mt-1 text-tekst">Er zijn nog geen deadlines. Stel ze in, zodat iedereen weet wanneer elk deel van het AVF af moet zijn.</p>
        <Link href="/stuurgroep/deadlines" className="mt-3 flex min-h-aanraak items-center justify-center rounded-han bg-merk px-4 font-bold text-op-merk">
          Deadlines instellen
        </Link>
      </section>
    );
  }

  let avfs: AvfGegevens[] = [];
  if (beheert) {
    const kaarten = await laadKaarten(cluster.id);
    avfs = (await Promise.all(kaarten.map((k) => laadAvf(k.id)))).filter((a): a is AvfGegevens => a !== null);
  }

  const regels: Regel[] = deadlines.map((d) => {
    if (beheert) {
      const standen = avfs.map((a) => ({ a, s: deadlineStand(d.onderdeel, a) }));
      const klaar = standen.filter((x) => x.s.klaar).length;
      return {
        deadline: d, afgerond: avfs.length > 0 && klaar === avfs.length, eigen: null,
        groepen: { klaar, totaal: avfs.length, open: standen.filter((x) => !x.s.klaar).map((x) => x.a.projectgroepNaam) },
      };
    }
    const eigen = eigenAvf ? deadlineStand(d.onderdeel, eigenAvf) : null;
    return { deadline: d, afgerond: Boolean(eigen?.klaar), eigen, groepen: null };
  });

  const nu = new Date();
  const actief = regels.filter((r) => !r.afgerond);
  const afgerond = regels.filter((r) => r.afgerond);

  return (
    <section aria-labelledby="deadlines-kop" className="rounded-han border border-rand bg-vlak p-4" data-testid="deadlines-kaart">
      <h2 id="deadlines-kop" className="flex items-center gap-2 text-xl"><CalendarClock aria-hidden className="size-6" strokeWidth={1.75} /> Deadlines</h2>

      {actief.length === 0 ? (
        <p className="mt-1 flex items-center gap-2 font-bold text-kop"><CheckCircle2 aria-hidden className="size-5" /> Alles is op tijd of klaar. Goed bezig!</p>
      ) : (
        <ul className="mt-1 divide-y divide-rand">
          {actief.map((r) => {
            const niveau = deadlineNiveau(r.deadline.moment, nu);
            return (
              <li key={r.deadline.onderdeel} data-testid={`deadline-${r.deadline.onderdeel}`} className="flex flex-col gap-1 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-kop">{naamVanOnderdeel(r.deadline.onderdeel)}</p>
                    <p className="text-sm text-zacht">{formatDeadline(r.deadline.moment)}</p>
                  </div>
                  <DeadlineBadge niveau={niveau} tekst={resterendTekst(r.deadline.moment, nu)} />
                </div>
                {r.eigen && (
                  <Link href={deadlineHref(r.deadline.onderdeel)} className="flex min-h-aanraak items-center justify-between gap-2 text-tekst">
                    <span>Jullie stand: <span className="font-medium">{r.eigen.tekst}</span></span>
                    <ChevronRight aria-hidden className="size-5 shrink-0 text-kop" />
                  </Link>
                )}
                {r.groepen && (
                  <p className="text-tekst">
                    <span className="font-medium">{r.groepen.klaar} van {r.groepen.totaal} groepen klaar</span>
                    {r.groepen.open.length > 0 && r.groepen.open.length <= 4 && <span className="block text-sm text-zacht">Nog open: {r.groepen.open.join(", ")}</span>}
                  </p>
                )}
                {r.deadline.toelichting && <p className="text-sm text-zacht">{r.deadline.toelichting}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {afgerond.length > 0 && (
        <details className="mt-1 border-t border-rand">
          <summary className="flex min-h-aanraak cursor-pointer items-center font-medium text-kop">{afgerond.length} {afgerond.length === 1 ? "onderdeel" : "onderdelen"} klaar</summary>
          <ul className="flex flex-col gap-1 pb-2">
            {afgerond.map((r) => (
              <li key={r.deadline.onderdeel} data-testid={`deadline-klaar-${r.deadline.onderdeel}`} className="flex items-center justify-between gap-2 text-tekst">
                <span>{naamVanOnderdeel(r.deadline.onderdeel)} <span className="text-sm text-zacht">· {formatDeadline(r.deadline.moment)}</span></span>
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-bold text-kop"><CheckCircle2 aria-hidden className="size-4" /> Klaar</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {beheert && (
        <Link href="/stuurgroep/deadlines" className="mt-2 flex min-h-aanraak items-center font-bold text-kop underline">Deadlines beheren</Link>
      )}
    </section>
  );
}
