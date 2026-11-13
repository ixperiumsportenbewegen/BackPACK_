import Link from "next/link";
import { redirect } from "next/navigation";
import { Bandage, Camera, ChevronRight, Compass, Flame } from "lucide-react";
import { PaginaKop } from "@/components/PaginaKop";
import { getProfiel } from "@/lib/profiel";

export const metadata = { title: "Stuurgroep · BackPACK_" };

// De vier vakken van PACK en hun rollen (docs/huisstijl.md); de pagina's komen per opdracht.
const PACK = [
  {
    letter: "P", naam: "Pleister", icoon: Bandage,
    rollen: [
      { code: "veiligheid_welzijn", naam: "Veiligheid & Welzijn" },
      { code: "logistiek_facilitair", naam: "Logistiek & Facilitair" },
    ],
  },
  {
    letter: "A", naam: "Aansteker", icoon: Flame,
    rollen: [
      { code: "beleving_thema", naam: "Beleving & Thema", href: "/stuurgroep/beleving-thema" },
      { code: "programma_kwaliteit", naam: "Programma & Kwaliteit" },
    ],
  },
  { letter: "C", naam: "Camera", icoon: Camera, rollen: [{ code: "communicatie_financien", naam: "Communicatie & Financiën" }] },
  { letter: "K", naam: "Kompas", icoon: Compass, rollen: [{ code: "projectleiding", naam: "Projectleiding" }] },
] as const;

export default async function Stuurgroep() {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "stuurgroep" && profiel.soort !== "docent") redirect("/");

  return (
    <div className="flex flex-col gap-4">
      <PaginaKop titel="Stuurgroep" foto="ochtend-tentterrein" />
      <p className="text-zacht">De werkpagina&apos;s van de stuurgroep, ingedeeld in de vier vakken van BackPACK_.</p>

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
                const href = "href" in rol ? rol.href : undefined;
                const inhoud = (
                  <>
                    <span className="flex-1">
                      <span className="block font-bold text-kop">{rol.naam}</span>
                      <span className="block text-sm text-zacht">
                        {eigen ? "Jullie rol" : href ? "Open de werkpagina" : "Komt in een volgende stap"}
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
    </div>
  );
}
