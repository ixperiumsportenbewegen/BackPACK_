import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PaginaKop } from "@/components/PaginaKop";
import { BergtoppenFormulier } from "@/components/bergtoppen/BergtoppenFormulier";
import { BewerkerKader, OvernemenPaneel } from "@/components/plan/PlanEditor";
import { laadBergtoppen } from "@/lib/bergtoppen";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";
import { bergtoppenOvernemen } from "../../bergtoppen-actions";

export const metadata = { title: "Bergtoppen bewerken · BackPACK_" };

/** De 10 bergtoppen invullen en publiceren: de stuurgroep van het cluster en de docent. Velden slaan op terwijl je typt. */
export default async function BergtoppenBewerken() {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "stuurgroep" && profiel.soort !== "docent") redirect("/bergtoppen");
  const cluster = profiel.cluster;
  if (!cluster) redirect("/bergtoppen");

  const bergtoppen = await laadBergtoppen(cluster.id);
  let bronnen: { id: string; naam: string }[] = [];
  if (profiel.soort === "docent") {
    const { data } = await (await maakServerClient()).from("cluster").select("id, naam, code").order("code", { ascending: false });
    bronnen = (data ?? []).filter((c) => c.id !== cluster.id).map((c) => ({ id: c.id, naam: c.naam }));
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/bergtoppen" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> De 10 bergtoppen
      </Link>
      <PaginaKop titel="Bergtoppen bewerken" foto="wandeling-schemer-staand" />
      <p className="text-zacht">
        Je bewerkt de gedragsafspraken van {cluster.naam}. Wat je invult is een concept: studenten zien het pas als je het publiceert.
        Pas je daarna iets aan, dan zien zij de vorige versie tot je opnieuw publiceert.
      </p>
      <BewerkerKader opslagSleutel="backpack_bergtoppennaam">
        <BergtoppenFormulier
          clusterId={cluster.id} clusterNaam={cluster.naam} velden={bergtoppen.velden}
          inschrijfLink={bergtoppen.inschrijfLink} publicatie={bergtoppen.publicatie}
        />
        {profiel.soort === "docent" && bronnen.length > 0 && (
          <OvernemenPaneel
            naarClusterId={cluster.id} naarNaam={cluster.naam} bronnen={bronnen} onderwerp="bergtoppenlijst"
            uitleg="De link naar het inschrijfformulier en wat al gepubliceerd is blijven staan. Het overgenomen deel is een concept."
            actie={bergtoppenOvernemen}
          />
        )}
      </BewerkerKader>
    </div>
  );
}
