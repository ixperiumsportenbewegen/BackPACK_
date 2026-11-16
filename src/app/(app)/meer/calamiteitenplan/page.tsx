import Link from "next/link";
import { ChevronLeft, MessageCircle, Pencil, Phone } from "lucide-react";
import { AfdrukKnop } from "@/components/avf/AfdrukKnop";
import { PaginaKop } from "@/components/PaginaKop";
import { PlanLeesweergave } from "@/components/plan/PlanLeesweergave";
import { PLAN_SECTIES } from "@/config/calamiteitenplan";
import { laadPlan, planHeeftInhoud } from "@/lib/calamiteitenplan";
import { telHref } from "@/lib/planTekst";
import { getProfiel } from "@/lib/profiel";
import { formatMoment } from "@/lib/tijd";

export const metadata = { title: "Calamiteitenplan · BackPACK_" };

/** Het algemene calamiteitenplan (incl. EHBO) van het eigen cluster: voor iedereen in het cluster te lezen. */
export default async function Calamiteitenplan() {
  const profiel = (await getProfiel())!;
  const cluster = profiel.cluster;
  const kanBewerken = profiel.soort === "stuurgroep" || profiel.soort === "docent";

  if (!cluster) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/meer" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
          <ChevronLeft aria-hidden className="size-5" /> Meer
        </Link>
        <p className="rounded-han border border-rand bg-vlak p-4 text-tekst">Kies eerst een cluster op het startscherm.</p>
      </div>
    );
  }

  const plan = await laadPlan(cluster.id);
  const noodnummer = plan.velden.noodnummer;
  const noodHref = telHref(noodnummer);
  const heeftInhoud = planHeeftInhoud(plan) || Boolean(plan.groepsappLink);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/meer" className="print:hidden flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Meer
      </Link>
      <div className="print:hidden"><PaginaKop titel="Calamiteitenplan" foto="ochtend-tentterrein" /></div>
      <h1 className="hidden text-3xl print:block">Calamiteitenplan · {cluster.naam}</h1>
      <p className="text-zacht">
        Het algemene calamiteitenplan (inclusief EHBO) van {cluster.naam}. Het geldt voor alle belevenissen.
        {plan.bijgewerkt && ` Laatst bijgewerkt ${formatMoment(plan.bijgewerkt.moment)}${plan.bijgewerkt.naam ? ` door ${plan.bijgewerkt.naam}` : ""}.`}
      </p>

      {(noodnummer || plan.groepsappLink) && (
        <div className="print:hidden flex flex-col gap-2">
          {noodnummer && (
            noodHref ? (
              <a href={noodHref} className="flex min-h-aanraak items-center justify-center gap-2 rounded-han bg-merk px-4 py-3 text-lg font-bold text-op-merk">
                <Phone aria-hidden className="size-6" /> Bel het noodnummer: {noodnummer}
              </a>
            ) : (
              <p className="rounded-han border-2 border-merk bg-vlak p-3 text-lg font-bold text-kop">Noodnummer: {noodnummer}</p>
            )
          )}
          {plan.groepsappLink && (
            <a href={plan.groepsappLink} target="_blank" rel="noreferrer" className="flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
              <MessageCircle aria-hidden className="size-5" /> Open de groepsapp voor noodmeldingen
            </a>
          )}
        </div>
      )}

      {!heeftInhoud && (
        <p className="rounded-han border border-rand bg-vlak p-4 text-tekst">
          Het calamiteitenplan van {cluster.naam} wordt ingevuld door de stuurgroep (Veiligheid & Welzijn). Zodra er iets in staat, zie je het hier.
        </p>
      )}

      <nav aria-label="Onderdelen van het plan" className="print:hidden -mx-4 overflow-x-auto px-4 pb-1">
        <ul className="flex w-max gap-2">
          {PLAN_SECTIES.map((s) => (
            <li key={s.code} className="shrink-0">
              <a href={`#${s.code}`} className="flex min-h-aanraak items-center whitespace-nowrap rounded-han border-2 border-rand bg-vlak px-3 text-sm font-bold text-kop">{s.naam}</a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="print:hidden grid gap-2 sm:grid-cols-2">
        <AfdrukKnop />
        {kanBewerken && (
          <Link href="/meer/calamiteitenplan/bewerken" className="flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
            <Pencil aria-hidden className="size-5" /> Het plan bewerken
          </Link>
        )}
      </div>

      <PlanLeesweergave plan={plan} />
    </div>
  );
}
