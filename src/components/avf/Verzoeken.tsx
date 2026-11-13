import Link from "next/link";
import { CheckCircle2, MessageSquareWarning, RefreshCw } from "lucide-react";
import { rolNaam } from "@/components/avf/Sectie";
import type { Verzoek, VerzoekStatus } from "@/lib/beoordeling";
import { formatMoment } from "@/lib/tijd";

const LABEL: Record<VerzoekStatus, { tekst: string; klasse: string; icoon: typeof CheckCircle2 }> = {
  open: { tekst: "Open", klasse: "bg-actie text-black", icoon: MessageSquareWarning },
  aangepast: { tekst: "Aangepast", klasse: "bg-ingediend text-black", icoon: RefreshCw },
  afgehandeld: { tekst: "Afgehandeld", klasse: "bg-goedgekeurd text-black", icoon: CheckCircle2 },
};

/** Statuslabel van een verbeterverzoek, met icoon en tekst (nooit alleen kleur). */
export function VerzoekLabel({ status }: { status: VerzoekStatus }) {
  const l = LABEL[status];
  const Icoon = l.icoon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-han px-2 py-0.5 text-xs font-bold ${l.klasse}`}>
      <Icoon aria-hidden className="size-3.5" /> {l.tekst}
    </span>
  );
}

/**
 * De verbeterverzoeken van de stuurgroep voor de projectgroep (alleen lezen). Open en aangepaste verzoeken staan erbij.
 * "Aangepast" betekent dat het systeem heeft gezien dat er na het verzoek iets is opgeslagen.
 */
export function VerzoekenLijst({
  verzoeken, onderdeelNamen, kop = "Verbeterverzoeken van de stuurgroep",
}: {
  verzoeken: Verzoek[];
  onderdeelNamen?: Record<string, { naam: string; href: string }>;
  kop?: string;
}) {
  const zichtbaar = verzoeken.filter((v) => v.status !== "afgehandeld");
  if (zichtbaar.length === 0) return null;
  return (
    <section aria-label={kop} className="rounded-han border-2 border-actie bg-vlak p-4">
      <h2 className="text-xl">{kop}</h2>
      <ul className="mt-2 flex flex-col gap-3">
        {zichtbaar.map((v) => {
          const onderdeel = v.onderdeelId ? onderdeelNamen?.[v.onderdeelId] : undefined;
          return (
            <li key={v.id} className="rounded-han border border-rand p-3">
              <div className="flex flex-wrap items-center gap-2">
                <VerzoekLabel status={v.status} />
                <span className="text-sm text-zacht">Voor {rolNaam(v.rol) ?? v.rol}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-tekst">{v.tekst}</p>
              {onderdeel && (
                <Link href={onderdeel.href} className="mt-1 inline-flex min-h-aanraak items-center font-bold text-kop underline">
                  Bij onderdeel: {onderdeel.naam}
                </Link>
              )}
              <p className="text-sm text-zacht">
                {v.doorNaam} · {formatMoment(v.createdAt)}
                {v.status === "aangepast" && " · jullie hebben hier daarna iets in opgeslagen"}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
