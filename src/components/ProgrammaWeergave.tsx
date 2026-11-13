import { Flag, Lock, Mountain, Users } from "lucide-react";
import { AvfStatusLabel, type AvfStatus } from "@/components/BelevenisKaart";
import { formatGroepNummers, isAangepast, type ProgrammaRegel } from "@/lib/programma";
import { formatDag, formatTijd } from "@/lib/tijd";

export interface ToegewezenBelevenis {
  regelId: string;
  groepNummer: number;
  groepNaam: string;
  titel: string | null;
  status: AvfStatus;
}

const DAGKLEUREN = ["bg-han-oranje", "bg-han-groen", "bg-han-blauw"] as const;

/**
 * Het programma per dag, zoals op de programmaschermen. Vaste activiteiten zijn rustig grijs; de zes belevenisvakken
 * vallen op met een zwarte rand en een balk met de verantwoordelijke projectgroep. Aangepaste tijden hebben een
 * uitroepteken met de oorspronkelijke tijd. `eigenGroep` markeert wat voor de eigen projectgroep geldt.
 */
export function ProgrammaWeergave({
  regels, toegewezen, eigenGroep, ondertitels,
}: {
  regels: ProgrammaRegel[];
  toegewezen: ToegewezenBelevenis[];
  eigenGroep?: number | null;
  ondertitels: Record<string, string>;
}) {
  const perDag = new Map<string, ProgrammaRegel[]>();
  for (const r of [...regels].sort((a, b) => a.volgorde - b.volgorde)) {
    perDag.set(r.dag, [...(perDag.get(r.dag) ?? []), r]);
  }

  return (
    <div className="flex flex-col gap-8">
      <ul className="flex flex-wrap gap-x-5 gap-y-2 rounded-han border border-rand bg-vlak p-3 text-sm text-kop" aria-label="Uitleg van het programma">
        <li className="flex items-center gap-2"><span className="inline-block h-5 w-8 rounded-han border border-rand bg-achtergrond" /> Vaste activiteit</li>
        <li className="flex items-center gap-2"><span className="inline-block h-5 w-8 rounded-han border-2 border-kop bg-vlak" /> Belevenis van een projectgroep</li>
        <li className="flex items-center gap-2">
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-kop font-heading text-xs font-black text-white" aria-hidden>!</span> Tijd aangepast
        </li>
      </ul>

      {[...perDag.entries()].map(([dag, lijst], i) => (
        <section key={dag} aria-labelledby={`dag-${dag}`}>
          <h2 id={`dag-${dag}`} className={`flex items-baseline justify-between rounded-han px-4 py-3 text-3xl capitalize text-black ${DAGKLEUREN[i % DAGKLEUREN.length]}`}>
            <span>{formatDag(dag).split(" ")[0]}</span>{" "}
            <span className="text-xl normal-case">{formatDag(dag).split(" ").slice(1).join(" ")}</span>
          </h2>
          {ondertitels[dag] && <p className="mt-2 text-zacht">{ondertitels[dag]}</p>}
          <ol className="mt-3 flex flex-col gap-2">
            {lijst.map((r) => {
              const belevenis = r.soort === "belevenis";
              const wie = belevenis ? toegewezen.find((t) => t.regelId === r.id) : undefined;
              const aangepast = isAangepast(r);
              const eigenOrganisatie = !!eigenGroep && wie?.groepNummer === eigenGroep;
              const eigenMee = !!eigenGroep && r.deelnemers.includes(eigenGroep);
              const eigenRR = !!eigenGroep && r.rocks_rivers_groepen.includes(eigenGroep);
              const markering = eigenOrganisatie || eigenMee || eigenRR;
              return (
                <li key={r.id} className="grid grid-cols-[5.5rem_1fr] items-start gap-2">
                  <div className={`flex flex-col items-center justify-start gap-1 rounded-han px-2 py-3 text-center font-heading text-base font-bold leading-tight ${aangepast ? "bg-actie text-black" : "bg-kop text-white"}`}>
                    <span>{formatTijd(r.starttijd)}–<br />{formatTijd(r.eindtijd)}</span>
                    {aangepast && (
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-kop font-heading text-sm font-black text-white">
                        <span aria-hidden>!</span>
                        <span className="sr-only">Tijd aangepast</span>
                      </span>
                    )}
                  </div>
                  <div className={`overflow-hidden rounded-han ${markering ? "border-4 border-thema" : belevenis ? "border-2 border-kop" : "border border-rand"} ${belevenis ? "bg-vlak" : "bg-achtergrond"}`}>
                    {belevenis && (
                      <p className={`flex items-center gap-2 px-3 py-2 text-sm font-bold uppercase tracking-wide ${wie ? "bg-kop text-white" : "bg-actie text-black"}`}>
                        <Lock aria-hidden className="size-4 shrink-0" />
                        {wie ? `${wie.groepNaam} is verantwoordelijk` : "Nog geen projectgroep toegewezen"}
                      </p>
                    )}
                    <div className="p-3">
                      <p className="font-bold text-kop">{r.titel}</p>
                      {aangepast && (
                        <p className="text-sm font-medium text-kop">
                          Tijd aangepast, was {formatTijd(r.oorspronkelijke_starttijd!)}–{formatTijd(r.oorspronkelijke_eindtijd!)}
                        </p>
                      )}
                      {!belevenis ? (
                        r.omschrijving && <p className="text-sm text-zacht">{r.omschrijving}</p>
                      ) : (
                        <div className="mt-1 flex flex-col gap-1 text-sm text-tekst">
                          {wie && (
                            <p className="flex items-start gap-2">
                              <Flag aria-hidden className="mt-0.5 size-4 shrink-0" />
                              <span>Belevenis: <strong>{wie.titel?.trim() || "nog geen titel"}</strong></span>
                            </p>
                          )}
                          {r.deelnemers.length > 0 && (
                            <p className="flex items-start gap-2">
                              <Users aria-hidden className="mt-0.5 size-4 shrink-0" />
                              <span>Doen mee: projectgroep {formatGroepNummers(r.deelnemers)}</span>
                            </p>
                          )}
                          {r.rocks_rivers_groepen.length > 0 && (
                            <p className="flex items-start gap-2">
                              <Mountain aria-hidden className="mt-0.5 size-4 shrink-0" />
                              <span>Tegelijk met Rocks &amp; Rivers: projectgroep {formatGroepNummers(r.rocks_rivers_groepen)}</span>
                            </p>
                          )}
                          {wie && <div><AvfStatusLabel status={wie.status} /></div>}
                        </div>
                      )}
                      {r.locatie && <p className="mt-1 text-sm text-zacht">{r.locatie}</p>}
                      {markering && (
                        <p className="mt-2 inline-block rounded-han bg-thema px-2 py-0.5 text-xs font-bold text-op-thema">
                          {eigenOrganisatie ? "Jullie organiseren dit" : eigenMee ? "Jullie doen mee" : "Jullie zijn bij Rocks & Rivers"}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
