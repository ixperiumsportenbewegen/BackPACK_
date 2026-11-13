import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { NamenRegel } from "@/components/NamenRegel";
import { PaginaKop } from "@/components/PaginaKop";
import { PROJECTGROEPROLLEN } from "@/config/projectgroeprollen";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";
import { projectgroepRolOpslaan } from "../../namen-actions";

export const metadata = { title: "Rolverdeling · BackPACK_" };

export default async function Rolverdeling() {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "projectgroep") redirect("/meer");

  const supabase = await maakServerClient();
  // Projectgroepen mogen de rolverdeling van andere groepen lezen; dit formulier toont alleen de eigen rijen.
  const { data: account } = await supabase.from("account").select("projectgroep_id").single();
  const { data: rijen } = await supabase
    .from("projectgroep_rol").select("rol, namen, updated_at").eq("projectgroep_id", account?.projectgroep_id ?? "");
  const perRol = new Map((rijen ?? []).map((r) => [r.rol as string, r]));

  return (
    <div className="flex flex-col gap-4">
      <Link href="/meer" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Meer
      </Link>
      <PaginaKop titel="Rolverdeling" foto="klimmen-staand" />
      <p className="text-zacht">
        Elke rol in jullie projectgroep heeft een verantwoordelijke. Vul de namen in. Het AVF kan pas worden ingediend als
        elke rol een naam heeft. Wijzigingen worden direct opgeslagen.
      </p>
      {PROJECTGROEPROLLEN.map((rol) => {
        const rij = perRol.get(rol.code);
        if (!rij) return null;
        return (
          <NamenRegel
            key={rol.code}
            label={rol.naam}
            uitleg={rol.taken}
            beginNamen={rij.namen}
            beginUpdatedAt={rij.updated_at}
            kanBewerken
            opslaan={projectgroepRolOpslaan.bind(null, rol.code)}
          />
        );
      })}
    </div>
  );
}
