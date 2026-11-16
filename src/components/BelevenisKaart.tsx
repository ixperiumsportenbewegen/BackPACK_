import { CheckCircle2, CircleDashed, Clock, RotateCw, Send, TriangleAlert, Users } from "lucide-react";
import { aantalPersonen } from "@/lib/namen";
import { formatTijdvak } from "@/lib/tijd";

export type AvfStatus = "in_ontwikkeling" | "ingediend" | "aanpassing_gevraagd" | "goedgekeurd";

const STATUS: Record<AvfStatus, { tekst: string; klasse: string; icoon: typeof CheckCircle2 }> = {
  in_ontwikkeling: { tekst: "In ontwikkeling", klasse: "bg-rand text-kop", icoon: CircleDashed },
  ingediend: { tekst: "Ingediend", klasse: "bg-ingediend text-black", icoon: Send },
  aanpassing_gevraagd: { tekst: "Aanpassing gevraagd", klasse: "bg-actie text-black", icoon: TriangleAlert },
  goedgekeurd: { tekst: "Goedgekeurd", klasse: "bg-goedgekeurd text-black", icoon: CheckCircle2 },
};

/**
 * Het statuslabel. Is de laatste indiening ter feedback (`tussentijds`), dan staat er "Ter feedback ingediend" en na het
 * teruggeven "Feedback teruggegeven". Andere groepen en studenten zien alleen de gewone status (publieke kaart).
 */
export function AvfStatusLabel({ status, tussentijds = false }: { status: AvfStatus; tussentijds?: boolean }) {
  const s =
    tussentijds && status === "ingediend" ? { ...STATUS.ingediend, tekst: "Ter feedback ingediend" }
    : tussentijds && status === "aanpassing_gevraagd" ? { ...STATUS.aanpassing_gevraagd, tekst: "Feedback teruggegeven" }
    : STATUS[status];
  const Icoon = s.icoon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-han px-2 py-0.5 text-xs font-bold ${s.klasse}`}>
      <Icoon aria-hidden className="size-3.5" /> {s.tekst}
    </span>
  );
}

/** Label voor een goedgekeurd AVF waarin daarna iets belangrijks is gewijzigd. */
export function OpnieuwLabel() {
  return (
    <span className="inline-flex items-center gap-1 rounded-han border-2 border-kop bg-vlak px-2 py-0.5 text-xs font-bold text-kop">
      <RotateCw aria-hidden className="size-3.5" /> Opnieuw te controleren
    </span>
  );
}

export interface KaartGegevens {
  groepNaam: string;
  titel: string | null;
  verschijningsvorm: string | null;
  samenvatting: string | null;
  tijdvak: { dag: string; starttijd: string; eindtijd: string } | null;
  status: AvfStatus;
  /** De namen van de groepsleden; alleen tonen als dit is meegegeven. */
  leden?: string[];
}

/** De publieke kaart van een belevenis: alleen wat andere groepen en studenten mogen zien. */
export function BelevenisKaart({ k, kop = "h3" }: { k: KaartGegevens; kop?: "h2" | "h3" }) {
  const Kop = kop;
  return (
    <article className="rounded-han border border-rand bg-vlak p-4">
      <p className="text-sm font-medium text-zacht">{k.groepNaam}</p>
      <Kop className="text-xl">{k.titel?.trim() || "Nog geen titel"}</Kop>
      {k.verschijningsvorm && <p className="text-sm font-bold text-kop">{k.verschijningsvorm}</p>}
      <p className="mt-1 text-tekst">
        {k.samenvatting?.trim() || <span className="text-zacht">Nog geen omschrijving.</span>}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <AvfStatusLabel status={k.status} />
        <span className="inline-flex items-center gap-1 text-sm text-kop">
          <Clock aria-hidden className="size-4" />
          {k.tijdvak ? formatTijdvak(k.tijdvak) : "Nog niet ingepland"}
        </span>
      </div>
      {k.leden && (
        <p className="mt-3 flex items-start gap-2 text-sm text-tekst">
          <Users aria-hidden className="mt-0.5 size-4 shrink-0 text-kop" />
          {k.leden.length > 0 ? (
            <span>
              <span className="font-bold text-kop">{aantalPersonen(k.leden.length)}: </span>
              {k.leden.join(", ")}
            </span>
          ) : (
            <span className="text-zacht">Nog geen namen ingevuld</span>
          )}
        </p>
      )}
    </article>
  );
}
