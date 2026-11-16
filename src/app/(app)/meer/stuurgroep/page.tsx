import Link from "next/link";
import { ChevronLeft, Users } from "lucide-react";
import { PaginaKop } from "@/components/PaginaKop";
import { STUURGROEPROL_VOLGORDE } from "@/config/projectgroeprollen";
import { getProfiel } from "@/lib/profiel";
import { aantalPersonen, splitNamen } from "@/lib/namen";
import { maakServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Stuurgroep · BackPACK_" };

/** Wie zit er in de stuurgroep? Voor iedereen in het cluster: de onderwerpen (rollen) met de namen van de leden. */
export default async function StuurgroepOverzicht() {
  const profiel = (await getProfiel())!;
  const supabase = await maakServerClient();
  const { data } = await supabase
    .from("stuurgroeprol").select("code, naam, focus, studenten").eq("cluster_id", profiel.cluster?.id ?? "");
  const rollen = [...(data ?? [])].sort(
    (a, b) => STUURGROEPROL_VOLGORDE.indexOf(a.code) - STUURGROEPROL_VOLGORDE.indexOf(b.code),
  );

  return (
    <div className="flex flex-col gap-4">
      <Link href="/meer" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Meer
      </Link>
      <PaginaKop titel="Stuurgroep" foto="ochtend-tentterrein" />
      <p className="text-zacht">
        De stuurgroep van jullie cluster: elk onderwerp met de studenten die er verantwoordelijk voor zijn. Heb je een vraag
        over een onderwerp? Zoek deze studenten dan op.
      </p>
      {rollen.length === 0 && <p className="rounded-han border border-rand bg-vlak p-4 text-zacht">Er zijn nog geen rollen.</p>}
      <ul className="flex flex-col gap-3">
        {rollen.map((rol) => {
          const namen = splitNamen(rol.studenten);
          const eigen = profiel.stuurgroeprol?.code === rol.code;
          return (
            <li key={rol.code} className={`rounded-han border bg-vlak p-4 ${eigen ? "border-2 border-merk" : "border-rand"}`}>
              <h2 className="text-xl">{rol.naam}{eigen && <span className="text-base font-normal text-zacht"> · jullie rol</span>}</h2>
              {rol.focus && <p className="text-sm text-zacht">{rol.focus}</p>}
              <p className="mt-2 flex items-start gap-2 text-tekst">
                <Users aria-hidden className="mt-1 size-4 shrink-0 text-kop" />
                {namen.length > 0 ? (
                  <span>
                    <span className="font-bold text-kop">{aantalPersonen(namen.length)}: </span>
                    {namen.join(", ")}
                  </span>
                ) : (
                  <span className="text-zacht">Nog geen namen ingevuld</span>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
