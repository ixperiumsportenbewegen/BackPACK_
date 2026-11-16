import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bandage, Camera, ChevronRight, CircleCheck, CircleDashed, CircleDot, Compass, Flame, Hourglass, Users } from "lucide-react";
import { AvfStatusLabel, OpnieuwLabel } from "@/components/BelevenisKaart";
import { PaginaKop } from "@/components/PaginaKop";
import { RollenBalk } from "@/components/RollenBalk";
import { AVF_VELDEN, SECTIES, type SectieCode, type StuurgroepRolCode } from "@/config/avf-velden";
import { STUURGROEPROL_VOLGORDE } from "@/config/projectgroeprollen";
import { laadAvf, laadKaarten } from "@/lib/avfData";
import { sectieVoortgang } from "@/lib/avfVoortgang";
import { veldStand, type VeldStand } from "@/lib/avfVeldStatus";
import { laadVerzoekenCluster } from "@/lib/beoordeling";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";
import { formatMoment } from "@/lib/tijd";

export const metadata = { title: "Rolweergave · BackPACK_" };

const PACK_ICOON = { P: Bandage, A: Flame, C: Camera, K: Compass } as const;
const PACK_NAAM = { P: "Pleister", A: "Aansteker", C: "Camera", K: "Kompas" } as const;

const STAND: Record<VeldStand, { tekst: string; klasse: string; icoon: typeof CircleCheck }> = {
  leeg: { tekst: "Leeg", klasse: "bg-rand text-kop", icoon: CircleDashed },
  deels: { tekst: "Deels ingevuld", klasse: "bg-actie text-black", icoon: CircleDot },
  ingevuld: { tekst: "Ingevuld", klasse: "bg-goedgekeurd text-black", icoon: CircleCheck },
  later: { tekst: "Komt later", klasse: "bg-rand text-kop", icoon: Hourglass },
};

function StandLabel({ stand }: { stand: VeldStand }) {
  const s = STAND[stand];
  const Icoon = s.icoon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-han px-2 py-0.5 text-xs font-bold ${s.klasse}`}>
      <Icoon aria-hidden className="size-3.5" /> {s.tekst}
    </span>
  );
}

const ROLLEN: Record<StuurgroepRolCode, { naam: string; pack: "P" | "A" | "C" | "K" }> = {
  veiligheid_welzijn: { naam: "Veiligheid & Welzijn", pack: "P" },
  logistiek_facilitair: { naam: "Logistiek & Facilitair", pack: "P" },
  beleving_thema: { naam: "Beleving & Thema", pack: "A" },
  programma_kwaliteit: { naam: "Programma & Kwaliteit", pack: "A" },
  communicatie_financien: { naam: "Communicatie & Financiën", pack: "C" },
  projectleiding: { naam: "Projectleiding", pack: "K" },
};

function LinkKaart({ href, titel, uitleg }: { href: string; titel: string; uitleg: string }) {
  return (
    <Link href={href} className="flex min-h-aanraak items-center gap-3 rounded-han border-2 border-kop bg-vlak px-3 py-2">
      <span className="flex-1">
        <span className="block font-bold text-kop">{titel}</span>
        <span className="block text-sm text-zacht">{uitleg}</span>
      </span>
      <ChevronRight aria-hidden className="size-5 text-kop" />
    </Link>
  );
}

/**
 * Rolweergave van het stuurgroepdashboard: de zes belevenissen als kaarten met de velden die bij deze rol horen
 * (gelezen uit src/config/avf-velden.ts). Tik op een veld om in het AVF een verbeterverzoek te plaatsen.
 */
export default async function RolPagina({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!(STUURGROEPROL_VOLGORDE as readonly string[]).includes(code)) notFound();
  const rolCode = code as StuurgroepRolCode;
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "stuurgroep" && profiel.soort !== "docent") redirect("/");
  const cluster = profiel.cluster;
  if (!cluster) redirect("/");

  const supabase = await maakServerClient();
  const [kaarten, verzoeken, { data: rolRij }] = await Promise.all([
    laadKaarten(cluster.id),
    laadVerzoekenCluster(cluster.id),
    supabase.from("stuurgroeprol").select("focus, studenten").eq("cluster_id", cluster.id).eq("code", rolCode).maybeSingle(),
  ]);
  const avfs = (await Promise.all(kaarten.map((k) => laadAvf(k.id)))).filter((a): a is NonNullable<typeof a> => a !== null);

  const velden = AVF_VELDEN.filter((v) => v.sgRol === rolCode);
  const rol = ROLLEN[rolCode];
  const PackIcoon = PACK_ICOON[rol.pack];
  const eigen = profiel.stuurgroeprol?.code === rolCode;

  return (
    <div className="flex flex-col gap-4">
      <PaginaKop titel={rol.naam} foto="ochtend-tentterrein" />

      <RollenBalk label="Rollen van de stuurgroep">
        {STUURGROEPROL_VOLGORDE.map((c) => (
          <li key={c} className="shrink-0">
            <Link
              href={`/stuurgroep/rol/${c}`} aria-current={c === rolCode ? "page" : undefined}
              className={`flex min-h-aanraak items-center gap-1 whitespace-nowrap rounded-han border-2 px-3 text-sm font-bold ${c === rolCode ? "border-merk bg-merk text-op-merk" : "border-rand bg-vlak text-kop"}`}
            >
              <span aria-hidden>{ROLLEN[c].pack}</span> {ROLLEN[c].naam}
              {c === profiel.stuurgroeprol?.code && <span className="sr-only"> (jullie rol)</span>}
            </Link>
          </li>
        ))}
        <li className="shrink-0">
          <Link href="/stuurgroep?alle=1" className="flex min-h-aanraak items-center gap-1 whitespace-nowrap rounded-han border-2 border-rand bg-vlak px-3 text-sm font-bold text-kop">
            <Users aria-hidden className="size-4" /> Overzicht
          </Link>
        </li>
      </RollenBalk>

      <section className="rounded-han border border-rand bg-vlak p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-zacht">
          <PackIcoon aria-hidden className="size-5 text-merk" strokeWidth={1.75} /> {rol.pack} · {PACK_NAAM[rol.pack]}{eigen && " · jullie rol"}
        </p>
        {rolRij?.focus && <p className="mt-1 text-tekst">{rolRij.focus}</p>}
        {rolRij?.studenten && <p className="mt-1 text-sm text-zacht">Studenten: {rolRij.studenten}</p>}
      </section>

      {rolCode === "beleving_thema" && <LinkKaart href="/stuurgroep/beleving-thema" titel="Meerdaagsethema instellen" uitleg="Naam, verhaal, sfeerbeeld en accentkleur van jullie meerdaagse." />}
      {rolCode === "programma_kwaliteit" && <LinkKaart href="/stuurgroep/programma" titel="Programma beheren" uitleg="Tijden, activiteiten, toewijzing van de belevenissen en locaties." />}
      {rolCode === "projectleiding" && (
        <>
          <LinkKaart href="/stuurgroep/programma" titel="Dag en tijd per belevenis toewijzen" uitleg="Wijs elke projectgroep een tijdvak toe of wissel twee groepen." />
          <LinkKaart href="/stuurgroep/deadlines" titel="Deadlines" uitleg="Stel per onderdeel van het AVF in wanneer het af moet zijn." />
          <section className="rounded-han border border-rand bg-vlak p-4">
            <h2 className="text-xl">Rolverdelingen</h2>
            <ul className="mt-2 divide-y divide-rand">
              {avfs.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="font-medium text-kop">{a.projectgroepNaam}</span>
                  <span className="text-sm text-zacht">{a.inhoud.rollenIngevuld} van de 6 rollen een naam</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      {rolCode === "logistiek_facilitair" && (
        <>
          <LinkKaart href="/stuurgroep/materialen" titel="Materialenlijst" uitleg="De gedeelde lijst met voorraad op de camping en het bivak. Bouwen, definitief maken en aanvullen." />
          <LinkKaart href="/stuurgroep/materialen/aanvragen" titel="Aanvragen van projectgroepen" uitleg="Materiaal dat groepen missen of waarvan er te weinig is." />
          <LinkKaart href="/stuurgroep/materialen/behoefte" titel="Behoefte en tekorten" uitleg="Wat de belevenissen nodig hebben per locatie en moment, en correcties." />
          <LinkKaart href="/stuurgroep/materialen/paklijst" titel="Paklijst voor de meerdaagse" uitleg="Inpakken, op locatie en retour: wat er echt is, per locatie." />
          <section className="rounded-han border border-rand bg-vlak p-4">
            <h2 className="text-xl">Locatie per belevenis</h2>
            <p className="text-sm text-zacht">De projectgroepen kiezen zelf camping of bivak in sectie A. Hier zie je wie dat nog moet doen.</p>
            <ul className="mt-2 divide-y divide-rand">
              {avfs.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="font-medium text-kop">{a.projectgroepNaam}</span>
                  <span className={`text-sm ${a.locatie ? "text-zacht" : "font-bold text-kop"}`}>{a.locatie ?? "Nog niet gekozen"}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      {rolCode === "communicatie_financien" && (
        <LinkKaart href="/stuurgroep/budget" titel="Budget en aanvragen" uitleg="Het budget van het cluster, aanvragen van projectgroepen beoordelen en wat er nog over is." />
      )}
      {rolCode === "veiligheid_welzijn" && (
        <section className="rounded-han border border-rand bg-vlak p-4">
          <h2 className="text-xl">Weer en EHBO</h2>
          <p className="text-sm text-zacht">AVF&apos;s waarin de weerafweging of het EHBO-antwoord nog ontbreekt.</p>
          <ul className="mt-2 divide-y divide-rand">
            {avfs.map((a) => {
              const e = sectieVoortgang("E", a.inhoud);
              return (
                <li key={a.id} className="py-2">
                  <span className="font-medium text-kop">{a.projectgroepNaam}</span>{" "}
                  {e.ontbrekend.length === 0
                    ? <span className="text-sm text-zacht">Sectie E is compleet</span>
                    : <span className="text-sm text-tekst">{e.ontbrekend.length} dingen nog niet ingevuld in sectie E</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="matrix-kop" className="flex flex-col gap-3">
        <h2 id="matrix-kop" className="text-xl">De zes belevenissen</h2>
        <p className="text-zacht">Per belevenis zie je de velden die bij {rol.naam} horen. Tik op een veld om in het AVF een verbeterverzoek te plaatsen.</p>
        <ul className="flex flex-col gap-4">
          {avfs.map((a) => {
            const open = verzoeken.filter((v) => v.avfId === a.id && v.status === "open");
            const perSectie = SECTIES.map((s) => ({ s, velden: velden.filter((v) => v.sectie === s.code) })).filter((x) => x.velden.length > 0);
            // Samenvatting van de velden van deze rol; de velden zelf staan achter een uitklapblok.
            const stands = velden.map((v) => veldStand(a, v)).filter((x) => x !== "later");
            const aantalIngevuld = stands.filter((x) => x === "ingevuld").length;
            const aantalDeels = stands.filter((x) => x === "deels").length;
            const aantalLeeg = stands.filter((x) => x === "leeg").length;
            return (
              <li key={a.id} className="rounded-han border border-rand bg-vlak p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-zacht">{a.projectgroepNaam}</p>
                    <h3 className="text-lg font-bold text-kop">{a.inhoud.titel?.trim() || "Nog geen titel"}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AvfStatusLabel status={a.status} tussentijds={a.tussentijds} />
                    {a.opnieuwTeControleren && <OpnieuwLabel />}
                  </div>
                </div>
                <p className="mt-1 text-sm text-zacht">{open.length === 0 ? "Geen open verbeterverzoeken" : `${open.length} open ${open.length === 1 ? "verbeterverzoek" : "verbeterverzoeken"}`}</p>
                <Link href={`/belevenissen/${a.id}`} className="inline-flex min-h-aanraak items-center font-bold text-kop underline">Het hele AVF lezen en beoordelen</Link>

                <details className="mt-2 rounded-han border border-rand" data-testid={`velden-${a.id}`}>
                  <summary className="flex min-h-aanraak cursor-pointer flex-wrap items-center justify-between gap-2 px-3 font-bold text-kop">
                    <span>{aantalIngevuld} van {stands.length} velden ingevuld</span>
                    <span className="text-sm font-medium text-zacht">
                      {aantalDeels > 0 && `${aantalDeels} deels`}{aantalDeels > 0 && aantalLeeg > 0 && " · "}{aantalLeeg > 0 && `${aantalLeeg} leeg`}
                    </span>
                  </summary>
                <div className="px-3 pb-3">
                {perSectie.map(({ s, velden: sv }) => {
                  const bijgewerkt = a.sectieBijgewerkt[s.code];
                  return (
                    <div key={s.code} className="mt-2 border-t border-rand pt-2">
                      <p className="text-sm font-bold text-zacht">
                        Sectie {s.code} · {s.naam}
                        {bijgewerkt && <span className="font-normal"> · laatst gewijzigd door {bijgewerkt.naam || "onbekend"}, {formatMoment(bijgewerkt.updated_at)}</span>}
                      </p>
                      <ul className="mt-1 flex flex-col gap-1">
                        {sv.map((v) => {
                          const stand = veldStand(a, v);
                          const veldOpen = verzoeken.filter((z) => z.avfId === a.id && z.veldSleutel === v.sleutel && z.status !== "afgehandeld").length;
                          const href = stand === "later" ? null
                            : v.pgRol === null ? "/stuurgroep/programma"
                            : `/belevenissen/${a.id}?sectie=${s.code as SectieCode}&rol=${v.pgRol}&veld=${encodeURIComponent(v.sleutel)}#verzoek-${s.code}`;
                          const inhoud = (
                            <>
                              <span className="flex-1 text-tekst">{v.label}</span>
                              <span className="flex flex-wrap items-center justify-end gap-1">
                                <StandLabel stand={stand} />
                                {v.wezenlijk && a.opnieuwTeControleren && <OpnieuwLabel />}
                                {veldOpen > 0 && <span className="rounded-han bg-actie px-2 py-0.5 text-xs font-bold text-black">{veldOpen} verzoek{veldOpen > 1 ? "en" : ""}</span>}
                              </span>
                            </>
                          );
                          return (
                            <li key={`${v.niveau}-${v.sleutel}`}>
                              {href ? (
                                <Link href={href} className="flex min-h-aanraak items-center gap-2 rounded-han border border-rand px-2 py-1">{inhoud}</Link>
                              ) : (
                                <div className="flex min-h-aanraak items-center gap-2 rounded-han border border-rand px-2 py-1">{inhoud}</div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
                </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
