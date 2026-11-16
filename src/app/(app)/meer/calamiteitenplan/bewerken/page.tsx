import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PaginaKop } from "@/components/PaginaKop";
import { GroepsappLinkVeld, OvernemenPaneel, PlanBewerker, PlanLijstEditor, PlanTekstVeld } from "@/components/plan/PlanEditor";
import { PLAN_SECTIES } from "@/config/calamiteitenplan";
import { planOvernemen } from "../../../calamiteitenplan-actions";
import { laadPlan } from "@/lib/calamiteitenplan";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Calamiteitenplan bewerken · BackPACK_" };

/** Het plan bewerken: de stuurgroep van het cluster en de docent. Velden slaan op terwijl je typt. */
export default async function CalamiteitenplanBewerken() {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "stuurgroep" && profiel.soort !== "docent") redirect("/meer/calamiteitenplan");
  const cluster = profiel.cluster;
  if (!cluster) redirect("/meer/calamiteitenplan");

  const plan = await laadPlan(cluster.id);
  let bronnen: { id: string; naam: string }[] = [];
  if (profiel.soort === "docent") {
    const { data } = await (await maakServerClient()).from("cluster").select("id, naam, code").order("code", { ascending: false });
    bronnen = (data ?? []).filter((c) => c.id !== cluster.id).map((c) => ({ id: c.id, naam: c.naam }));
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/meer/calamiteitenplan" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Calamiteitenplan
      </Link>
      <PaginaKop titel="Plan bewerken" foto="ochtend-tentterrein" />
      <p className="text-zacht">
        Je bewerkt het calamiteitenplan van {cluster.naam}. Iedereen in het cluster leest wat je hier invult. Zet geen privégegevens
        van studenten of medische gegevens per persoon in het plan.
      </p>
      <PlanBewerker>
        {PLAN_SECTIES.map((sectie) => (
          <section key={sectie.code} aria-labelledby={`bewerk-${sectie.code}`} className="flex flex-col gap-3 rounded-han border border-rand bg-vlak p-4">
            <div>
              <h2 id={`bewerk-${sectie.code}`} className="text-xl">{sectie.naam}</h2>
              <p className="text-sm text-zacht">{sectie.uitleg}</p>
            </div>
            {sectie.velden?.map((v) => <PlanTekstVeld key={v.sleutel} clusterId={cluster.id} veld={v} begin={plan.velden[v.sleutel] ?? null} />)}
            {sectie.groepsapp && <GroepsappLinkVeld clusterId={cluster.id} begin={plan.groepsappLink} />}
            {sectie.lijst && <PlanLijstEditor clusterId={cluster.id} lijst={sectie.lijst} items={plan.lijsten[sectie.lijst.sleutel] ?? []} />}
          </section>
        ))}
        {profiel.soort === "docent" && bronnen.length > 0 && <OvernemenPaneel naarClusterId={cluster.id} naarNaam={cluster.naam} bronnen={bronnen} onderwerp="plan" uitleg="De groepsapp-link wordt niet meegekopieerd." actie={planOvernemen} />}
      </PlanBewerker>
    </div>
  );
}
