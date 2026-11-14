import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PaginaKop } from "@/components/PaginaKop";
import { getProfiel } from "@/lib/profiel";
import { laadBudgetCluster, laadClusterBudget, laadResterend } from "@/lib/budget";
import { BudgetBeheer } from "./BudgetBeheer";

export const metadata = { title: "Budget beheren · BackPACK_" };

/** Budgetoverzicht en aanvragen beoordelen: werkpagina van Communicatie & Financiën (alle stuurgroepen en de docent mogen het zien). */
export default async function BudgetBeherenPagina() {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "stuurgroep" && profiel.soort !== "docent") redirect("/");
  const cluster = profiel.cluster;
  if (!cluster) redirect("/");

  const [aanvragen, totaal, resterend] = await Promise.all([laadBudgetCluster(cluster.id), laadClusterBudget(cluster.id), laadResterend(cluster.id)]);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/stuurgroep/rol/communicatie_financien" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Communicatie &amp; Financiën
      </Link>
      <PaginaKop titel="Budget" foto="bivak-zeil" />
      <p className="text-zacht">Het budget van {cluster.naam}: aanvragen van de projectgroepen beoordelen, wat er is toegekend en wat er nog over is.</p>
      <BudgetBeheer
        samenvatting={{ totaal, resterend, clusterId: cluster.id }} aanvragen={aanvragen}
        formsLink={cluster.forms_link} teamsLink={cluster.teams_link}
      />
    </div>
  );
}
