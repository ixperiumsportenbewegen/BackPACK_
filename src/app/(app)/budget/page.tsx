import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PaginaKop } from "@/components/PaginaKop";
import { AanvraagKaart } from "@/components/budget/FinancieelPlan";
import { LosseAanvraagStarten } from "@/components/budget/LosseAanvraagStarten";
import { laadEigenAvf } from "@/lib/avfData";
import { euro, laadBudgetAvf, laadResterend, STATUS_NAAM } from "@/lib/budget";
import { getProfiel } from "@/lib/profiel";

export const metadata = { title: "Budget · BackPACK_" };

/** Budget voor de projectgroep: eigen aanvragen met besluit, de resterende ruimte van het cluster en losse aanvragen. */
export default async function Budget() {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "projectgroep") redirect("/");
  const avf = await laadEigenAvf();
  if (!avf || !profiel.cluster) redirect("/");

  const [aanvragen, resterend] = await Promise.all([laadBudgetAvf(avf.id), laadResterend(profiel.cluster.id)]);
  const plan = aanvragen.find((a) => a.soort === "avf");
  const losse = aanvragen.filter((a) => a.soort === "los");
  const formsLink = profiel.cluster.forms_link;

  return (
    <div className="flex flex-col gap-4">
      <PaginaKop titel="Budget" foto="bivak-zeil" />

      <section className="rounded-han border-2 border-kop bg-vlak p-4" aria-label="Ruimte in het cluster">
        <p className="text-sm font-medium text-zacht">Nog te verdelen in {profiel.cluster.naam}</p>
        <p className="font-heading text-4xl font-bold text-kop">{euro(resterend)}</p>
        <p className="text-sm text-zacht">Het budget is voor het hele cluster. Je ziet hier alleen jullie eigen aanvragen en wat er nog over is.</p>
      </section>

      {plan && (
        <section className="flex flex-col gap-2" aria-labelledby="plan-kop">
          <h2 id="plan-kop" className="text-xl">Financieel plan van het AVF</h2>
          {plan.status === "concept" ? (
            <p className="rounded-han border border-rand bg-vlak p-4 text-tekst">
              {avf.status === "goedgekeurd" && plan.bedragAangevraagd === 0
                ? "Jullie AVF is goedgekeurd zonder financieel plan. Extra kosten vraag je hieronder aan met een losse aanvraag."
                : "Het plan is nog niet aangevraagd. Het gaat mee met het indienen van het AVF."}{" "}
              <Link href="/avf/F" className="font-bold text-kop underline">Naar het financieel plan (sectie F)</Link>
            </p>
          ) : (
            <AanvraagKaart aanvraag={plan} losse={false} />
          )}
        </section>
      )}

      {avf.status === "goedgekeurd" ? (
        <LosseAanvraagStarten />
      ) : (
        <p className="rounded-han border border-rand bg-vlak p-4 text-zacht">Een losse aanvraag voor extra kosten kan pas als jullie AVF is goedgekeurd. Tot dan hoort alles in het financieel plan.</p>
      )}

      {losse.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="los-kop">
          <h2 id="los-kop" className="text-xl">Losse aanvragen</h2>
          {losse.map((a) => <AanvraagKaart key={`${a.id}-${a.updatedAt}`} aanvraag={a} losse />)}
        </section>
      )}

      <section className="rounded-han border border-rand bg-vlak p-4" aria-label="Declareren">
        <h2 className="text-xl">Aankopen en declareren</h2>
        <p className="mt-1 text-tekst">Aankopen doen jullie zelf. Declareren gaat via Microsoft Forms; de docenten betalen terug buiten de app. In de app staan geen bonnetjes of bankgegevens, en de app laat nooit zien of iets is ontvangen of betaald.</p>
        {formsLink ? (
          <a href={formsLink} target="_blank" rel="noreferrer" className="mt-2 flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
            <ExternalLink aria-hidden className="size-5" /> Open het declaratieformulier
          </a>
        ) : (
          <p className="mt-2 text-sm text-zacht">De link naar het declaratieformulier volgt.</p>
        )}
        <p className="mt-2 text-sm text-zacht">Status van jullie aanvragen: {[plan, ...losse].filter(Boolean).map((a) => STATUS_NAAM[a!.status].toLowerCase()).join(", ") || "geen"}.</p>
      </section>
    </div>
  );
}
