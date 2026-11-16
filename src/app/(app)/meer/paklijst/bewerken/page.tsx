import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PaginaKop } from "@/components/PaginaKop";
import { PaklijstEditor } from "@/components/paklijst/PaklijstEditor";
import { BewerkerKader, OvernemenPaneel } from "@/components/plan/PlanEditor";
import { laadPaklijst } from "@/lib/paklijst";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";
import { paklijstOvernemen } from "../../../paklijst-actions";

export const metadata = { title: "Paklijst bewerken · BackPACK_" };

/** De paklijst bewerken: de stuurgroep van het cluster en de docent. Velden slaan op terwijl je typt. */
export default async function PaklijstBewerken() {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "stuurgroep" && profiel.soort !== "docent") redirect("/meer/paklijst");
  const cluster = profiel.cluster;
  if (!cluster) redirect("/meer/paklijst");

  const paklijst = await laadPaklijst(cluster.id);
  let bronnen: { id: string; naam: string }[] = [];
  if (profiel.soort === "docent") {
    const { data } = await (await maakServerClient()).from("cluster").select("id, naam, code").order("code", { ascending: false });
    bronnen = (data ?? []).filter((c) => c.id !== cluster.id).map((c) => ({ id: c.id, naam: c.naam }));
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/meer/paklijst" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Persoonlijke paklijst
      </Link>
      <PaginaKop titel="Paklijst bewerken" foto="wandeling-schemer-staand" />
      <p className="text-zacht">
        Je bewerkt de persoonlijke paklijst van {cluster.naam}. De categorieën staan er al; voeg zelf spullen en aantallen toe, of plak een hele lijst
        in een categorie. Iedereen in het cluster leest wat je hier invult en kan het afvinken op de eigen telefoon.
      </p>
      <BewerkerKader opslagSleutel="backpack_paklijstnaam">
        <PaklijstEditor clusterId={cluster.id} categorieen={paklijst.categorieen} />
        {profiel.soort === "docent" && bronnen.length > 0 && (
          <OvernemenPaneel naarClusterId={cluster.id} naarNaam={cluster.naam} bronnen={bronnen} onderwerp="paklijst" actie={paklijstOvernemen} />
        )}
      </BewerkerKader>
    </div>
  );
}
