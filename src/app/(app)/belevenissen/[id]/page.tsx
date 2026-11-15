/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { AfdrukKnop } from "@/components/avf/AfdrukKnop";
import { StapNavigatie } from "@/components/avf/StapNavigatie";
import { AvfLeesweergave } from "@/components/avf/AvfLeesweergave";
import { AvfStatusLabel, OpnieuwLabel } from "@/components/BelevenisKaart";
import { BeoordelingsPaneel } from "@/components/avf/BeoordelingsPaneel";
import { ThemacheckBlok } from "@/components/avf/ThemacheckBlok";
import { STUURGROEPROL_VOLGORDE } from "@/config/projectgroeprollen";
import { laadThemachecks, laadVerzoeken, laadVersies } from "@/lib/beoordeling";
import { laadAvf, laadKaarten } from "@/lib/avfData";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";
import { formatMoment, formatTijdvak } from "@/lib/tijd";
import { themaBeeldUrl } from "@/lib/themaBeeld";

export const metadata = { title: "AVF lezen · BackPACK_" };

/**
 * Het volledige AVF om te lezen en af te drukken (PDF-01). Alleen voor de eigen projectgroep, de stuurgroep van het
 * cluster en de docent: voor alle anderen geeft de database niets terug en tonen we een 404.
 */
export default async function AvfLezen({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; sectie?: string; rol?: string; veld?: string }>;
}) {
  const { id } = await params;
  const zoek = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const avf = await laadAvf(id);
  if (!avf) notFound();

  const supabase = await maakServerClient();
  const [{ data: thema }, { data: cluster }] = await Promise.all([
    supabase.from("meerdaagsethema").select("naam, slogan, sfeerbeeld_pad, logo_pad").eq("cluster_id", avf.clusterId).maybeSingle(),
    supabase.from("cluster").select("naam, code").eq("id", avf.clusterId).maybeSingle(),
  ]);
  // Stuurgroep en docent kunnen van belevenis naar belevenis bladeren
  const profiel = await getProfiel();
  const kanBladeren = profiel?.soort === "stuurgroep" || profiel?.soort === "docent";
  const kaarten = kanBladeren ? await laadKaarten(avf.clusterId) : [];
  const nr = kaarten.findIndex((k) => k.id === avf.id);
  const buur = (k: (typeof kaarten)[number] | undefined) =>
    k ? { href: `/belevenissen/${k.id}`, label: `${k.groepNaam}${k.titel ? ` · ${k.titel}` : ""}` } : null;
  const sfeer = themaBeeldUrl(thema?.sfeerbeeld_pad ?? "fotos/vallei-viaduct", 1600);
  const logo = themaBeeldUrl(thema?.logo_pad);

  // Beoordelen: alleen stuurgroep en docent
  const beoordelen = Boolean(kanBladeren);
  const [verzoeken, versies, checks, { data: avfRij }, { data: stuurRollen }] = await Promise.all([
    laadVerzoeken(avf.id), laadVersies(avf.id), beoordelen ? laadThemachecks(avf.id) : Promise.resolve([]),
    supabase.from("avf").select("ingediend_op, ingediend_door_naam, goedgekeurd_op, goedgekeurd_door_naam").eq("id", avf.id).single(),
    beoordelen ? supabase.from("stuurgroeprol").select("code, naam").eq("cluster_id", avf.clusterId) : Promise.resolve({ data: [] }),
  ]);
  const rollen = [...(stuurRollen ?? [])].sort((a, b) => STUURGROEPROL_VOLGORDE.indexOf(a.code) - STUURGROEPROL_VOLGORDE.indexOf(b.code));
  const tab = zoek.tab === "versies" ? "versies" : "avf";
  const tabKlasse = (actief: boolean) =>
    `flex min-h-aanraak flex-1 items-center justify-center rounded-han border-2 px-3 font-bold ${actief ? "border-merk bg-merk text-op-merk" : "border-rand bg-vlak text-kop"}`;

  return (
    <article className="flex flex-col gap-6">
      <Link href="/belevenissen" className="print:hidden flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Belevenissen
      </Link>
      <AfdrukKnop />

      <header className="break-inside-avoid overflow-hidden rounded-han border border-rand">
        <div className="flex items-center justify-between gap-3 bg-vlak p-3">
          <img src="/logo/han-woordmerk-descriptor-400.png" alt="HAN University of Applied Sciences" className="h-7 w-auto" />
          <div className="flex items-center gap-2 text-right">
            {logo && <img src={logo} alt="" className="h-9 w-auto max-w-20 object-contain" />}
            <span className="font-heading text-lg font-bold text-kop">{thema?.naam || "BackPACK_"}</span>
          </div>
        </div>
        {sfeer && <img src={sfeer} alt="" className="h-40 w-full object-cover" />}
        <div className="border-t-4 border-thema bg-vlak p-4">
          <p className="text-sm font-medium text-zacht">Ardennen-meerdaagse · 28–30 juni 2027 · {cluster?.naam}</p>
          <h1 className="text-3xl">{avf.inhoud.titel?.trim() || "Nog geen titel"}</h1>
          {thema?.slogan && <p className="font-medium text-kop">{thema.slogan}</p>}
          <p className="mt-1 text-tekst">{avf.projectgroepNaam}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <AvfStatusLabel status={avf.status} />
            {avf.opnieuwTeControleren && <OpnieuwLabel />}
            <span className="text-tekst">{avf.tijdvak ? formatTijdvak(avf.tijdvak) : "Nog niet ingepland"}</span>
            {avf.locatie && <span className="text-tekst">· {avf.locatie}</span>}
          </div>
        </div>
      </header>

      {beoordelen && (
        <nav aria-label="Weergave" className="print:hidden flex gap-2">
          <Link href={`/belevenissen/${avf.id}`} aria-current={tab === "avf" ? "page" : undefined} className={tabKlasse(tab === "avf")}>AVF</Link>
          <Link href={`/belevenissen/${avf.id}?tab=versies`} aria-current={tab === "versies" ? "page" : undefined} className={tabKlasse(tab === "versies")}>
            Versies ({versies.length})
          </Link>
        </nav>
      )}

      {beoordelen && tab === "versies" ? (
        <section aria-label="Versies" className="print:hidden flex flex-col gap-3">
          <h2 className="text-xl">Versies</h2>
          {versies.length === 0 && <p className="rounded-han border border-rand bg-vlak p-4 text-zacht">Dit AVF is nog niet ingediend.</p>}
          <ol className="flex flex-col gap-3">
            {versies.map((v) => (
              <li key={v.id} className="rounded-han border border-rand bg-vlak p-4">
                <p className="font-bold text-kop">Versie {v.versie}</p>
                <p className="text-sm text-zacht">Ingediend door {v.ingediendDoorNaam} · {formatMoment(v.createdAt)}</p>
                <p className="mt-1 whitespace-pre-wrap text-tekst">
                  {v.wijzigingssamenvatting ?? (v.versie === 1 ? "Eerste indiening." : "Geen samenvatting.")}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <>
          {/* Eerst het AVF zelf lezen; het besluit en de themachecks staan eronder. Hier alleen een korte stand en een sprong. */}
          {beoordelen && (
            <a
              href="#beoordelen"
              className="print:hidden flex min-h-aanraak items-center justify-between gap-3 rounded-han border-2 border-kop bg-vlak px-4 py-2 font-bold text-kop"
              data-testid="naar-beoordelen"
            >
              <span>
                Beoordelen · {verzoeken.filter((v) => v.status === "open").length} open · {verzoeken.filter((v) => v.status === "aangepast").length} aangepast
              </span>
              <ChevronDown aria-hidden className="size-5 shrink-0" />
            </a>
          )}
          <AvfLeesweergave
            avf={avf}
            verzoeken={beoordelen ? { avfId: avf.id, actief: avf.status !== "in_ontwikkeling", verzoeken, focus: zoek.sectie ? { sectie: zoek.sectie.toUpperCase(), rol: zoek.rol ?? null, veld: zoek.veld ?? null } : undefined } : undefined}
          />
          {beoordelen && (
            <div id="beoordelen" className="print:hidden flex scroll-mt-24 flex-col gap-4">
              <BeoordelingsPaneel
                avfId={avf.id} status={avf.status} opnieuw={avf.opnieuwTeControleren}
                open={verzoeken.filter((v) => v.status === "open").length}
                aangepast={verzoeken.filter((v) => v.status === "aangepast").length}
                ingediend={avfRij?.ingediend_op ? `Versie ${avf.versie} ingediend door ${avfRij.ingediend_door_naam ?? "onbekend"} · ${formatMoment(avfRij.ingediend_op)}` : null}
                goedgekeurd={avfRij?.goedgekeurd_op ? `Goedgekeurd door ${avfRij.goedgekeurd_door_naam ?? "onbekend"} · ${formatMoment(avfRij.goedgekeurd_op)}` : null}
              />
              <ThemacheckBlok avfId={avf.id} rollen={rollen} checks={checks} eigenRol={profiel?.stuurgroeprol?.code ?? null} actief={avf.status !== "in_ontwikkeling"} />
            </div>
          )}
        </>
      )}

      <StapNavigatie
        vorige={buur(kaarten[nr - 1])} volgende={buur(kaarten[nr + 1])}
        terug={{ href: "/belevenissen", label: "Terug naar alle belevenissen" }} laatsteLabel="Klaar: naar alle belevenissen"
      />
    </article>
  );
}
