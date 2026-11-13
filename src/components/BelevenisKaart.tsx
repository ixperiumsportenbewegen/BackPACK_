import { CheckCircle2, CircleDashed, Clock, Send, TriangleAlert } from "lucide-react";
import { formatTijdvak } from "@/lib/tijd";

export type AvfStatus = "in_ontwikkeling" | "ingediend" | "aanpassing_gevraagd" | "goedgekeurd";

const STATUS: Record<AvfStatus, { tekst: string; klasse: string; icoon: typeof CheckCircle2 }> = {
  in_ontwikkeling: { tekst: "In ontwikkeling", klasse: "bg-rand text-kop", icoon: CircleDashed },
  ingediend: { tekst: "Ingediend", klasse: "bg-ingediend text-black", icoon: Send },
  aanpassing_gevraagd: { tekst: "Aanpassing gevraagd", klasse: "bg-actie text-black", icoon: TriangleAlert },
  goedgekeurd: { tekst: "Goedgekeurd", klasse: "bg-goedgekeurd text-black", icoon: CheckCircle2 },
};

export function AvfStatusLabel({ status }: { status: AvfStatus }) {
  const s = STATUS[status];
  const Icoon = s.icoon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-han px-2 py-0.5 text-xs font-bold ${s.klasse}`}>
      <Icoon aria-hidden className="size-3.5" /> {s.tekst}
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
    </article>
  );
}
