import Link from "next/link";
import { redirect } from "next/navigation";
import { Bandage, Camera, ChevronRight, Compass, Flame } from "lucide-react";
import { PaginaKop } from "@/components/PaginaKop";
import { NamenRegel } from "@/components/NamenRegel";
import { STUURGROEPROL_VOLGORDE } from "@/config/projectgroeprollen";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";
import { stuurgroepRolOpslaan } from "../namen-actions";

export const metadata = { title: "Stuurgroep · BackPACK_" };

// De vier vakken van PACK en hun rollen (docs/huisstijl.md). Elke rol heeft een eigen rolweergave.
const PACK = [
  { letter: "P", naam: "Pleister", icoon: Bandage, rollen: [
    { code: "veiligheid_welzijn", naam: "Veiligheid & Welzijn" }, { code: "logistiek_facilitair", naam: "Logistiek & Facilitair" } ] },
  { letter: "A", naam: "Aansteker", icoon: Flame, rollen: [
    { code: "beleving_thema", naam: "Beleving & Thema" }, { code: "programma_kwaliteit", naam: "Programma & Kwaliteit" } ] },
  { letter: "C", naam: "Camera", icoon: Camera, rollen: [{ code: "communicatie_financien", naam: "Communicatie & Financiën" }] },
  { letter: "K", naam: "Kompas", icoon: Compass, rollen: [{ code: "projectleiding", naam: "Projectleiding" }] },
] as const;

export default async function Stuurgroep({ searchParams }: { searchParams: Promise<{ alle?: string }> }) {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "stuurgroep" && profiel.soort !== "docent") redirect("/");
  // Een stuurgroepaccount opent standaard op de eigen rol; het overzicht van alle rollen staat achter "Overzicht".
  const { alle } = await searchParams;
  if (profiel.soort === "stuurgroep" && profiel.stuurgroeprol && !alle) redirect(`/stuurgroep/rol/${profiel.stuurgroeprol.code}`);

  const supabase = await maakServerClient();
  const { data: rollen } = await supabase
    .from("stuurgroeprol").select("id, code, naam, focus, studenten, updated_at").eq("cluster_id", profiel.cluster?.id ?? "");
  const gesorteerd = [...(rollen ?? [])].sort(
    (a, b) => STUURGROEPROL_VOLGORDE.indexOf(a.code) - STUURGROEPROL_VOLGORDE.indexOf(b.code),
  );

  return (
    <div className="flex flex-col gap-4">
      <PaginaKop titel="Stuurgroep" foto="ochtend-tentterrein" />
      <p className="text-zacht">De rollen van de stuurgroep, ingedeeld in de vier vakken van BackPACK_. Elke rol ziet de velden van alle zes belevenissen die bij de rol horen.</p>

      {PACK.map((vak) => {
        const Icoon = vak.icoon;
        return (
          <section key={vak.letter} className="rounded-han border border-rand bg-vlak p-4">
            <h2 className="flex items-center gap-3 text-xl">
              <Icoon aria-hidden className="size-6 text-merk" strokeWidth={1.75} />
              <span><span className="text-merk">{vak.letter}</span> · {vak.naam}</span>
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              {vak.rollen.map((rol) => {
                const eigen = profiel.stuurgroeprol?.code === rol.code;
                const href = `/stuurgroep/rol/${rol.code}`;
                const inhoud = (
                  <>
                    <span className="flex-1">
                      <span className="block font-bold text-kop">{rol.naam}</span>
                      <span className="block text-sm text-zacht">
                        {eigen ? "Jullie rol" : "Open de rolweergave"}
                      </span>
                    </span>
                    {href && <ChevronRight aria-hidden className="size-5 text-kop" />}
                  </>
                );
                return (
                  <li key={rol.code}>
                    {href ? (
                      <Link href={href} className={`flex min-h-aanraak items-center gap-3 rounded-han border-2 px-3 py-2 ${eigen ? "border-merk" : "border-rand"}`}>
                        {inhoud}
                      </Link>
                    ) : (
                      <div className={`flex min-h-aanraak items-center gap-3 rounded-han border-2 px-3 py-2 ${eigen ? "border-merk" : "border-rand"}`}>
                        {inhoud}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl">Onze stuurgroep</h2>
        <p className="text-zacht">
          {profiel.soort === "docent"
            ? "De studenten per rol. Als docent kun je alle namen aanpassen."
            : "De studenten per rol. Je past alleen de namen bij jullie eigen rol aan."}
        </p>
        {gesorteerd.map((rol) => (
          <NamenRegel
            key={rol.id}
            label={rol.naam}
            uitleg={rol.focus ?? undefined}
            beginNamen={rol.studenten}
            beginUpdatedAt={rol.updated_at}
            kanBewerken={profiel.soort === "docent" || profiel.stuurgroeprol?.code === rol.code}
            opslaan={stuurgroepRolOpslaan.bind(null, rol.id)}
          />
        ))}
      </section>
    </div>
  );
}
