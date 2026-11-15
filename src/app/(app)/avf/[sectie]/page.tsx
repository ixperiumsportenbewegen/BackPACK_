import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AvfEditor } from "@/components/avf/AvfEditor";
import { FaseEditor } from "@/components/avf/FaseEditor";
import { LijstEditor, type LijstItem } from "@/components/avf/Lijsten";
import { SectieKop, rolNaam } from "@/components/avf/Sectie";
import { EnkeleKeuzeVeld, JaNeeVeld, MeerKeuzeVeld, TekstVeld } from "@/components/avf/Velden";
import { EhboBlok, WeerEditor } from "@/components/avf/WeerEditor";
import { StapNavigatie } from "@/components/avf/StapNavigatie";
import { BelevenisKaart } from "@/components/BelevenisKaart";
import { VerzoekenLijst } from "@/components/avf/Verzoeken";
import { laadVerzoekenVoorGroep } from "@/lib/beoordeling";
import { MaterialenEditor } from "@/components/avf/MaterialenEditor";
import { FinancieelPlanInAvf } from "@/components/budget/FinancieelPlan";
import { laadBudgetAvf } from "@/lib/budget";
import { laadAanvragen, laadAvfMaterialen, laadBeschikbaarheid, laadCategorieen, laadLijstStatus, laadMaterialen } from "@/lib/materialen";
import { AVF_VELDEN, SECTIES, veldenVanSectie, type AvfVeld, type SectieCode } from "@/config/avf-velden";
import { laadEigenAvf, type AvfGegevens } from "@/lib/avfData";
import { leesWaarde, sectieVoortgang } from "@/lib/avfVoortgang";
import { buren } from "@/lib/avfNavigatie";
import { getProfiel } from "@/lib/profiel";
import { formatTijdvak } from "@/lib/tijd";
import type { JsonSectie, VeldDoel } from "../actions";

export const metadata = { title: "AVF · BackPACK_" };

function doelVoor(v: AvfVeld): VeldDoel {
  const delen = v.sleutel.split(".");
  if (delen.length === 1) return { soort: "kolom", kolom: delen[0] as never };
  return { soort: "json", sectie: delen[0] as JsonSectie, pad: delen.slice(1) };
}

/** Eenvoudige velden van een sectie, gegenereerd uit de veldenlijst. */
function Velden({ velden, avf }: { velden: AvfVeld[]; avf: AvfGegevens }) {
  return (
    <div className="flex flex-col gap-5">
      {velden.map((v) => {
        const w = leesWaarde(avf.inhoud, v.sleutel);
        const eigenaar = rolNaam(v.pgRol);
        if (v.veldtype === "jaNee") {
          return <JaNeeVeld key={v.sleutel} doel={doelVoor(v)} begin={typeof w === "boolean" ? w : null} label={v.label} hulp={v.hulp} eigenaar={eigenaar} />;
        }
        if (v.veldtype === "keuze") {
          return (
            <EnkeleKeuzeVeld
              key={v.sleutel} doel={doelVoor(v)} begin={(w as string | null) ?? null} label={v.label} hulp={v.hulp} eigenaar={eigenaar}
              opties={(v.opties ?? []).map((o) => ({ waarde: o.toLowerCase(), label: o }))}
            />
          );
        }
        if (v.veldtype === "meerkeuze") {
          return <MeerKeuzeVeld key={v.sleutel} doel={doelVoor(v)} begin={(w as string | null) ?? null} label={v.label} hulp={v.hulp} eigenaar={eigenaar} opties={v.opties ?? []} />;
        }
        return (
          <TekstVeld
            key={v.sleutel}
            doel={doelVoor(v)}
            begin={(w as string | number | null | undefined) ?? null}
            label={v.label}
            hulp={v.hulp}
            eigenaar={eigenaar}
            maxLengte={v.maxLengte}
            meerRegels={v.veldtype === "lang"}
            getal={v.veldtype === "getal"}
          />
        );
      })}
    </div>
  );
}

const LOCATIE_VELDEN = new Set(["locatie_keuze", "locatie_detail"]);
const EENVOUDIG = new Set(["tekst", "lang", "getal", "keuze", "meerkeuze", "jaNee"]);

export default async function SectiePagina({
  params, searchParams,
}: {
  params: Promise<{ sectie: string }>;
  searchParams: Promise<{ fase?: string }>;
}) {
  const { sectie } = await params;
  const code = sectie.toUpperCase() as SectieCode;
  if (!SECTIES.some((s) => s.code === code)) notFound();

  const profiel = (await getProfiel())!;
  if (profiel.soort !== "projectgroep") redirect("/belevenissen");
  const avf = await laadEigenAvf();
  if (!avf) redirect("/");

  const voortgang = sectieVoortgang(code, avf.inhoud);
  const vergrendeld = avf.status === "ingediend";
  const verzoeken = (await laadVerzoekenVoorGroep(avf.id, avf.status)).filter((v) => v.sectie === code);
  const onderdeelNamen = Object.fromEntries(
    avf.onderdelen.map((o, n) => [o.id, { naam: o.naam?.trim() || `Onderdeel ${n + 1}`, href: `/avf/onderdeel/${o.id}` }]),
  );
  const faseParam = (await searchParams).fase;
  const fase = (["kop", "romp", "staart"] as const).find((f) => f === faseParam) ?? "kop";
  const kop = <SectieKop sectie={code} status={voortgang.status} ontbrekend={voortgang.ontbrekend.map((o) => o.melding)} />;
  const inhoud = avf.inhoud;

  let inhoudBlok: React.ReactNode = null;

  if (code === "A") {
    const eenvoudig = veldenVanSectie("A", "avf").filter((v) => EENVOUDIG.has(v.veldtype));
    inhoudBlok = (
      <>
        <section className="rounded-han border border-rand bg-vlak p-4">
          <h2 className="text-xl">Jullie tijdvak</h2>
          {avf.tijdvak ? (
            <>
              <p className="mt-1 font-bold text-kop">{formatTijdvak(avf.tijdvak)}</p>
              <p className="text-tekst">{avf.tijdvak.titel}</p>
            </>
          ) : (
            <p className="mt-1 font-bold text-kop">Nog niet ingepland</p>
          )}
          {avf.tijdvak?.locatie && <p className="mt-1 text-tekst">Het programma plaatst dit tijdvak op: {avf.tijdvak.locatie}</p>}
          <p className="mt-2 text-sm text-zacht">
            Het tijdvak bepaalt de stuurgroep. De locatie (camping of bivak) kiezen jullie hieronder zelf.
          </p>
        </section>
        {/* De locatie staat vooraan: die bepaalt welke materialen er beschikbaar zijn (sectie F). */}
        <Velden velden={eenvoudig.filter((v) => LOCATIE_VELDEN.has(v.sleutel))} avf={avf} />
        <Velden velden={eenvoudig.filter((v) => !LOCATIE_VELDEN.has(v.sleutel))} avf={avf} />
        <section aria-label="Zo zien andere groepen jullie belevenis" className="flex flex-col gap-2">
          <h2 className="text-xl">Zo zien andere groepen jullie belevenis</h2>
          <p className="text-sm text-zacht">Dit zijn de enige gegevens die andere projectgroepen en studenten van jullie AVF zien.</p>
          <BelevenisKaart
            k={{
              groepNaam: avf.projectgroepNaam, titel: inhoud.titel, verschijningsvorm: inhoud.verschijningsvorm,
              samenvatting: inhoud.publieke_samenvatting, tijdvak: avf.tijdvak, status: avf.status,
            }}
          />
        </section>
      </>
    );
  } else if (code === "B" || code === "H") {
    inhoudBlok = <Velden velden={veldenVanSectie(code, "avf").filter((v) => EENVOUDIG.has(v.veldtype))} avf={avf} />;
  } else if (code === "C") {
    const doelen = (inhoud.doelen.persoonlijk as LijstItem[] | undefined) ?? [];
    inhoudBlok = (
      <>
        <Velden velden={veldenVanSectie("C", "avf").filter((v) => EENVOUDIG.has(v.veldtype))} avf={avf} />
        <section className="flex flex-col gap-2">
          <h2 className="text-xl">Persoonlijke leerdoelen</h2>
          <p className="text-sm text-zacht">Per organiserende student één doel. Mag leeg.</p>
          <LijstEditor
            sectie="doelen" pad={["persoonlijk"]} begin={doelen} itemNaam="Leerdoel" toevoegenLabel="Leerdoel toevoegen"
            leegTekst="Nog geen persoonlijke leerdoelen."
            eigenaar={rolNaam("projectleider")}
            velden={[{ sleutel: "naam", label: "Naam van de student", maxLengte: 60 }, { sleutel: "doel", label: "Leerdoel", meerRegels: true, maxLengte: 400 }]}
          />
        </section>
      </>
    );
  } else if (code === "D") {
    inhoudBlok = <FaseEditor key={fase} fase={fase} avf={avf} />;
  } else if (code === "E") {
    const weer = ((inhoud.veiligheid.weer as Record<string, never>) ?? {});
    const ehbo = ((inhoud.veiligheid.ehbo as Record<string, unknown>) ?? {});
    const risicos = (inhoud.veiligheid.risicos as LijstItem[] | undefined) ?? [];
    const eigenaar = rolNaam("veiligheid_ehbo");
    inhoudBlok = (
      <>
        <section className="flex flex-col gap-2">
          <h2 className="text-xl">Risico&apos;s</h2>
          <p className="text-sm text-zacht">Overkoepelende risico&apos;s van de hele belevenis, met de maatregel en wie die uitvoert.</p>
          <LijstEditor
            sectie="veiligheid" pad={["risicos"]} begin={risicos} itemNaam="Risico" toevoegenLabel="Risico toevoegen"
            leegTekst="Nog geen risico's. Minstens één risico is nodig."
            eigenaar={eigenaar}
            velden={[
              { sleutel: "risico", label: "Risico", meerRegels: true, maxLengte: 300 },
              { sleutel: "maatregel", label: "Maatregel", meerRegels: true, maxLengte: 300 },
              { sleutel: "wie", label: "Wie voert de maatregel uit?", maxLengte: 100 },
            ]}
          />
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-xl">Weer</h2>
          <p className="text-sm text-zacht">Weeg alle vier de scenario&apos;s af. Niet relevant is ook een antwoord.</p>
          <WeerEditor begin={weer} />
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-xl">EHBO</h2>
          <EhboBlok aanvullend={typeof ehbo.aanvullend === "boolean" ? ehbo.aanvullend : null} maatregelen={(ehbo.maatregelen as string | null) ?? null} />
        </section>
      </>
    );
  } else if (code === "F") {
    const locatie = (avf.inhoud.locatie_keuze === "camping" || avf.inhoud.locatie_keuze === "bivak") ? avf.inhoud.locatie_keuze : null;
    const [lijstStatus, materialen, regels, beschikbaar, categorieen, aanvragen, budget] = await Promise.all([
      laadLijstStatus(), laadMaterialen(), laadAvfMaterialen(avf.id), locatie ? laadBeschikbaarheid(avf.id) : Promise.resolve({}), laadCategorieen(), laadAanvragen(avf.id), laadBudgetAvf(avf.id),
    ]);
    const plan = budget.find((b) => b.soort === "avf");
    inhoudBlok = (
      <>
        <MaterialenEditor
          locatie={locatie} tijdvak={avf.tijdvak ? formatTijdvak(avf.tijdvak) : null} lijstDefinitief={lijstStatus.status === "definitief"}
          materialen={materialen} regels={regels} beschikbaar={beschikbaar} categorieVolgorde={categorieen.map((c) => c.naam)} aanvragen={aanvragen}
        />
        {plan && (
          <section className="flex flex-col gap-2" aria-labelledby="plan-kop">
            <h2 id="plan-kop" className="text-xl">Financieel plan</h2>
            {plan.status === "concept" && avf.status === "goedgekeurd" && (
              <p className="rounded-han border border-rand bg-vlak p-3 text-tekst">Het AVF is goedgekeurd, dus het financieel plan ligt vast. Extra kosten vraag je aan bij <a href="/budget" className="font-bold text-kop underline">Budget</a> met een losse aanvraag.</p>
            )}
            <FinancieelPlanInAvf aanvraag={plan} avfBewerkbaar={avf.status === "in_ontwikkeling" || avf.status === "aanpassing_gevraagd"} />
          </section>
        )}
      </>
    );
  } else if (code === "G") {
    const velden = AVF_VELDEN.filter((v) => v.sectie === "G" && EENVOUDIG.has(v.veldtype));
    inhoudBlok = (
      <>
        <section className="rounded-han border border-rand bg-vlak p-4">
          <h2 className="text-xl">Rolverdeling</h2>
          <p className="mt-1 text-tekst">{inhoud.rollenIngevuld} van de 6 rollen hebben een naam.</p>
          <p className="text-sm text-zacht">Eigenaar: {rolNaam("projectleider")}. Voor indienen moeten alle zes rollen een naam hebben.</p>
          <Link href="/meer/rolverdeling" className="mt-2 flex min-h-aanraak items-center font-bold text-kop underline">
            Rolverdeling invullen
          </Link>
        </section>
        <Velden velden={velden} avf={avf} />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {kop}
      <VerzoekenLijst verzoeken={verzoeken} onderdeelNamen={onderdeelNamen} />
      <AvfEditor vergrendeld={vergrendeld}>{inhoudBlok}</AvfEditor>
      <StapNavigatie {...buren(code === "D" ? `D-${fase}` : code)} />
    </div>
  );
}
