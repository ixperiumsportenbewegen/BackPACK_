import Link from "next/link";
import { CalendarDays, FileText } from "lucide-react";
import { BelevenisKaart, OpnieuwLabel } from "@/components/BelevenisKaart";
import { laadStanden } from "@/lib/beoordeling";
import { JullieAvfBlok } from "@/components/JullieAvfBlok";
import { PaginaKop } from "@/components/PaginaKop";
import { laadEigenAvf, laadKaarten } from "@/lib/avfData";
import { getProfiel } from "@/lib/profiel";

export const metadata = { title: "Belevenissen · BackPACK_" };

export default async function Belevenissen() {
  const profiel = (await getProfiel())!;
  const kaarten = profiel.cluster ? await laadKaarten(profiel.cluster.id) : [];
  const eigenNummer = profiel.projectgroep?.nummer;
  const eigenAvf = profiel.soort === "projectgroep" ? await laadEigenAvf() : null;
  const anderen = kaarten.filter((k) => k.projectgroepNummer !== eigenNummer);
  const leesbaar = profiel.soort === "stuurgroep" || profiel.soort === "docent";
  const standen = leesbaar && profiel.cluster ? await laadStanden(profiel.cluster.id) : {};

  return (
    <div className="flex flex-col gap-4">
      <PaginaKop titel="Belevenissen" foto="rotswand-klimmen" />
      <Link href="/programma" className="flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
        <CalendarDays aria-hidden className="size-5" /> Bekijk het programma
      </Link>

      {eigenAvf && <JullieAvfBlok avf={eigenAvf} />}

      <section aria-labelledby="andere-kop" className="flex flex-col gap-3">
        <h2 id="andere-kop" className="text-xl">{eigenAvf ? "De andere belevenissen" : "Alle belevenissen"}</h2>
        <p className="text-zacht">
          {leesbaar
            ? "Alle zes belevenissen van het cluster met status. Open een belevenis om het hele AVF te lezen."
            : "Van de andere belevenissen zie je alleen de titel en een korte omschrijving. Zo blijft het een verrassing."}
        </p>
        {anderen.length === 0 && <p className="rounded-han border border-rand bg-vlak p-4 text-zacht">Er zijn nog geen belevenissen.</p>}
        <ul className="flex flex-col gap-3">
          {anderen.map((k) => (
            <li key={k.id}>
              <BelevenisKaart k={k} />
              {leesbaar && standen[k.id] && (standen[k.id].opnieuwTeControleren || standen[k.id].open > 0 || standen[k.id].aangepast > 0) && (
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-kop">
                  {standen[k.id].opnieuwTeControleren && <OpnieuwLabel />}
                  {standen[k.id].open > 0 && <span>{standen[k.id].open} open {standen[k.id].open === 1 ? "verbeterverzoek" : "verbeterverzoeken"}</span>}
                  {standen[k.id].aangepast > 0 && <span>{standen[k.id].aangepast} aangepast door de groep</span>}
                </p>
              )}
              {leesbaar && (
                <Link href={`/belevenissen/${k.id}`} className="mt-1 flex min-h-aanraak items-center gap-2 font-bold text-kop underline">
                  <FileText aria-hidden className="size-5" /> Het hele AVF lezen
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
