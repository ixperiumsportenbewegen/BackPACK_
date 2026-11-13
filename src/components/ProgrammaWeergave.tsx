import { Flag, Mountain, Users } from "lucide-react";
import { AvfStatusLabel, type AvfStatus } from "@/components/BelevenisKaart";
import { formatGroepNummers, type ProgrammaRegel } from "@/lib/programma";
import { formatDag, formatTijd } from "@/lib/tijd";

export interface ToegewezenBelevenis {
  regelId: string;
  groepNummer: number;
  groepNaam: string;
  titel: string | null;
  status: AvfStatus;
}

/**
 * Het programma per dag, zoals op de programmaschermen. Voor een belevenis staat er welke groep het organiseert,
 * wie meedoet en wie met Rocks n Rivers is. `eigenGroep` markeert wat voor de eigen projectgroep geldt.
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
      {[...perDag.entries()].map(([dag, lijst]) => (
        <section key={dag} aria-labelledby={`dag-${dag}`}>
          <h2 id={`dag-${dag}`} className="text-2xl capitalize">{formatDag(dag)}</h2>
          {ondertitels[dag] && <p className="mt-1 text-zacht">{ondertitels[dag]}</p>}
          <ol className="mt-3 flex flex-col gap-2">
            {lijst.map((r) => {
              const wie = r.soort === "belevenis" ? toegewezen.find((t) => t.regelId === r.id) : undefined;
              const eigenOrganisatie = !!eigenGroep && wie?.groepNummer === eigenGroep;
              const eigenMee = !!eigenGroep && r.deelnemers.includes(eigenGroep);
              const eigenRR = !!eigenGroep && r.rocks_rivers_groepen.includes(eigenGroep);
              const markering = eigenOrganisatie || eigenMee || eigenRR;
              return (
                <li key={r.id} className="grid grid-cols-[5.5rem_1fr] gap-2">
                  <div className="rounded-han bg-kop px-2 py-3 text-center font-heading text-base font-bold leading-tight text-white">
                    {formatTijd(r.starttijd)}–<br />{formatTijd(r.eindtijd)}
                  </div>
                  <div className={`rounded-han border-2 bg-vlak p-3 ${markering ? "border-thema" : "border-rand"}`}>
                    <p className="font-bold text-kop">{r.titel}</p>
                    {r.soort === "vast" ? (
                      r.omschrijving && <p className="text-sm text-zacht">{r.omschrijving}</p>
                    ) : (
                      <div className="mt-1 flex flex-col gap-1 text-sm text-tekst">
                        <p className="flex items-start gap-2">
                          <Flag aria-hidden className="mt-0.5 size-4 shrink-0" />
                          <span>
                            {wie ? (
                              <>
                                <strong>{wie.groepNaam}</strong> organiseert{wie.titel ? `: ${wie.titel}` : ""}
                              </>
                            ) : (
                              <span className="font-medium text-kop">Nog niet toegewezen aan een projectgroep</span>
                            )}
                          </span>
                        </p>
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
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
