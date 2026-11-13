import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AfdrukKnop } from "@/components/avf/AfdrukKnop";
import { getProfiel } from "@/lib/profiel";
import { laadCategorieen, laadLijstStatus, laadMaterialen } from "@/lib/materialen";
import { formatMoment } from "@/lib/tijd";

export const metadata = { title: "Materialenlijst afdrukken · BackPACK_" };

/** De totale materialenlijst als schoon overzicht om af te drukken of als PDF op te slaan. */
export default async function MaterialenAfdrukken() {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "stuurgroep" && profiel.soort !== "docent") redirect("/");

  const [status, materialen, categorieen] = await Promise.all([laadLijstStatus(), laadMaterialen(), laadCategorieen()]);
  const actief = materialen.filter((m) => m.actief);
  const definitief = status.status === "definitief";
  const groepen = categorieen
    .map((c) => ({ c, items: actief.filter((m) => m.categorie === c.naam) }))
    .filter((g) => g.items.length > 0);
  const vandaag = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }).format(new Date());

  return (
    <article className="flex flex-col gap-5">
      <Link href="/stuurgroep/materialen" className="print:hidden flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Materialenlijst
      </Link>
      <AfdrukKnop />

      <header className="break-inside-avoid border-b-4 border-thema pb-3">
        <p className="text-sm font-medium text-zacht">Ardennen-meerdaagse · 28–30 juni 2027</p>
        <h1 className="text-3xl">Materialenlijst</h1>
        <p className="mt-1 text-tekst">
          {definitief
            ? `Definitief${status.definitiefDoorNaam ? `, gemaakt door ${status.definitiefDoorNaam}` : ""}${status.definitiefOp ? ` (${formatMoment(status.definitiefOp)})` : ""}.`
            : "CONCEPT: deze lijst is nog niet definitief. De voorraad op de camping en het bivak is een inschatting."}
          {" "}Afgedrukt op {vandaag}.
        </p>
      </header>

      {groepen.length === 0 && <p className="text-zacht">Er staan nog geen materialen in de lijst.</p>}
      {groepen.map(({ c, items }) => (
        <section key={c.id} className="break-inside-avoid">
          <h2 className="mb-1 border-b-2 border-kop text-xl">{c.naam}</h2>
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <thead>
              <tr>
                <th scope="col" className="border border-rand p-1">Materiaal</th>
                <th scope="col" className="w-20 border border-rand p-1 text-center">Camping</th>
                <th scope="col" className="w-20 border border-rand p-1 text-center">Bivak</th>
                <th scope="col" className="w-2/5 border border-rand p-1">Opmerking</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td className="border border-rand p-1 font-medium">{m.naam}</td>
                  <td className="border border-rand p-1 text-center">{m.voorraadCamping ?? "–"}</td>
                  <td className="border border-rand p-1 text-center">{m.voorraadBivak ?? "–"}</td>
                  <td className="border border-rand p-1 text-zacht">{m.opmerking ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </article>
  );
}
