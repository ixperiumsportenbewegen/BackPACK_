import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ChevronLeft, CircleDashed, LogIn } from "lucide-react";
import { KopieerKnop } from "@/components/KopieerKnop";
import { PaginaKop } from "@/components/PaginaKop";
import {
  herinneringTekst, samenvatting, SOORT_TEKST, stand, STAND_TEKST, type ActiviteitRij, type Stand,
} from "@/lib/activiteit";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";
import { formatMoment } from "@/lib/tijd";

export const metadata = { title: "Activiteit · BackPACK_" };
export const dynamic = "force-dynamic";

const CLUSTERS = ["VD", "VC", "TEST"];

const STATUS_TEKST: Record<string, string> = {
  in_ontwikkeling: "AVF in ontwikkeling", ingediend: "AVF ingediend", aanpassing_gevraagd: "Aanpassing gevraagd", goedgekeurd: "AVF goedgekeurd",
};

/** Kleur, icoon én tekst: kleur is nooit het enige signaal. */
const STAND_STIJL: Record<Stand, { klasse: string; Icoon: typeof CheckCircle2 }> = {
  gewerkt: { klasse: "bg-han-groen text-kop", Icoon: CheckCircle2 },
  ingelogd: { klasse: "bg-han-blauw text-kop", Icoon: LogIn },
  niet_ingelogd: { klasse: "bg-vlak border-2 border-kop text-kop", Icoon: CircleDashed },
};

/**
 * Activiteit per account voor de docent: wanneer is er voor het laatst ingelogd en gewerkt.
 * De gegevens komen uit de database-functie account_activiteit(), die alleen de docent mag aanroepen.
 */
export default async function Activiteit({ searchParams }: { searchParams: Promise<{ cluster?: string }> }) {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "docent") redirect("/");

  const { cluster: gekozen } = await searchParams;
  const code = CLUSTERS.includes((gekozen ?? "").toUpperCase()) ? (gekozen as string).toUpperCase() : "VD";

  const supabase = await maakServerClient();
  const { data, error } = await supabase.rpc("account_activiteit");
  const rijen = ((data ?? []) as ActiviteitRij[]).filter((r) => r.cluster_code === code);
  const nu = new Date();

  return (
    <div className="flex flex-col gap-5">
      <Link href="/beheer" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Beheer
      </Link>
      <PaginaKop titel="Activiteit" foto="ochtend-tentterrein" />

      <nav aria-label="Cluster" className="flex gap-2">
        {CLUSTERS.map((c) => (
          <Link
            key={c} href={`/beheer/activiteit?cluster=${c}`} aria-current={c === code ? "page" : undefined}
            className={`flex min-h-aanraak flex-1 items-center justify-center rounded-han border-2 border-kop font-bold ${c === code ? "bg-kop text-white" : "bg-vlak text-kop"}`}
          >
            {c}
          </Link>
        ))}
      </nav>

      {error && (
        <p role="alert" className="rounded-han border-2 border-kop bg-vlak p-4 font-medium text-kop">
          De activiteit kon niet worden geladen. Probeer het later opnieuw.
        </p>
      )}

      {!error && (
        <>
          <section aria-label="Samenvatting" className="grid gap-2 sm:grid-cols-3">
            {samenvatting(rijen).map((s) => (
              <div key={s.soort} className="rounded-han border-2 border-kop bg-vlak p-3">
                <h2 className="text-base">{SOORT_TEKST[s.soort]}</h2>
                <p className="mt-1 text-tekst"><span className="text-2xl font-bold text-kop">{s.gewerkt}</span> van {s.totaal} hebben gewerkt</p>
                <p className="text-sm text-zacht">{s.ingelogd} van {s.totaal} ooit ingelogd</p>
              </div>
            ))}
          </section>

          {herinneringTekst(rijen) && (
            <div>
              <KopieerKnop label="Kopieer herinnering voor Teams" tekst={herinneringTekst(rijen)} />
            </div>
          )}

          <ul className="flex flex-col gap-2">
            {rijen.map((r) => {
              const s = stand(r);
              const { klasse, Icoon } = STAND_STIJL[s];
              return (
                <li key={r.account_id} className="rounded-han border-2 border-rand bg-vlak p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-kop">{r.label}</p>
                      <p className="text-sm text-zacht">{r.gebruikersnaam}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-han px-2 py-1 text-sm font-bold ${klasse}`}>
                      <Icoon aria-hidden className="size-4" /> {STAND_TEKST[s]}
                    </span>
                  </div>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                    <dt className="text-zacht">Laatst ingelogd</dt>
                    <dd className="text-tekst">{r.laatst_ingelogd ? formatMoment(r.laatst_ingelogd, nu) : "nog niet"}</dd>
                    <dt className="text-zacht">Laatst gewerkt</dt>
                    <dd className="text-tekst">{r.laatst_gewerkt ? formatMoment(r.laatst_gewerkt, nu) : "nog niet"}</dd>
                    {r.avf_status && (
                      <>
                        <dt className="text-zacht">AVF</dt>
                        <dd className="text-tekst">{STATUS_TEKST[r.avf_status] ?? r.avf_status}{r.tussentijds ? " (ter feedback)" : ""}</dd>
                      </>
                    )}
                  </dl>
                </li>
              );
            })}
          </ul>

          <p className="text-sm text-zacht">
            Het is per gedeeld account, niet per persoon. Wie ingelogd blijft, verschijnt niet opnieuw bij &ldquo;Laatst ingelogd&rdquo;; kijk dan naar &ldquo;Laatst gewerkt&rdquo;.
            Voor stuurgroep tellen alleen acties die in het logboek komen (indienen, goedkeuren, budget, deadlines, paklijst enz.).
          </p>
        </>
      )}
    </div>
  );
}
