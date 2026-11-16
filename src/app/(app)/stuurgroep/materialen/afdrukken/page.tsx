import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AfdrukKnop } from "@/components/avf/AfdrukKnop";
import { getProfiel } from "@/lib/profiel";
import { laadCategorieen, laadLijstStatus, laadMaterialen } from "@/lib/materialen";
import { totaalVoorraad } from "@/lib/materialenTypes";
import { formatMoment } from "@/lib/tijd";

export const metadata = { title: "Materialenlijst afdrukken · BackPACK_" };

/** De totale materialenlijst als schoon overzicht om af te drukken of als PDF op te slaan. */
export default async function MaterialenAfdrukken({ searchParams }: { searchParams: Promise<{ papier?: string }> }) {
  const { papier } = await searchParams;
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "stuurgroep" && profiel.soort !== "docent") redirect("/");

  const [status, materialen, categorieen] = await Promise.all([laadLijstStatus(), laadMaterialen(), laadCategorieen()]);
  const actief = materialen.filter((m) => m.actief);
  const definitief = status.status === "definitief";
  const groepen = categorieen
    .map((c) => ({ c, items: actief.filter((m) => m.categorie === c.naam) }))
    .filter((g) => g.items.length > 0);
  const papierLocatie = papier === "camping" || papier === "bivak" ? papier : null;
  const vandaag = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }).format(new Date());

  if (papierLocatie) {
    // Materiaalcontrole om met pen in te vullen: plan uit de lijst, de rest leeg
    const naam = papierLocatie === "camping" ? "camping" : "bivak";
    return (
      <article className="flex flex-col gap-5">
        <Link href="/stuurgroep/materialen/paklijst" className="print:hidden flex min-h-aanraak items-center gap-1 font-medium text-kop">
          <ChevronLeft aria-hidden className="size-5" /> Materiaalcontrole
        </Link>
        <AfdrukKnop />
        <header className="break-inside-avoid border-b-4 border-thema pb-3">
          <p className="text-sm font-medium text-zacht">Ardennen-meerdaagse · 28–30 juni 2027</p>
          <h1 className="text-3xl">Materiaalcontrole {naam}</h1>
          <p className="mt-1 text-tekst">Vul Mee, Aanwezig en Retour in. Zet bij een verschil een opmerking. Afgedrukt op {vandaag}.</p>
        </header>
        {groepen.map(({ c, items }) => (
          <section key={c.id} className="break-inside-avoid">
            <h2 className="mb-1 border-b-2 border-kop text-xl">{c.naam}</h2>
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th scope="col" className="border border-rand p-1">Materiaal</th>
                  <th scope="col" className="w-14 border border-rand p-1 text-center">Plan</th>
                  <th scope="col" className="w-14 border border-rand p-1 text-center">Mee</th>
                  <th scope="col" className="w-16 border border-rand p-1 text-center">Aanwezig</th>
                  <th scope="col" className="w-14 border border-rand p-1 text-center">Retour</th>
                  <th scope="col" className="w-1/4 border border-rand p-1">Opmerking</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id} className="h-9">
                    <td className="border border-rand p-1 font-medium">{m.naam}</td>
                    <td className="border border-rand p-1 text-center font-bold">{(papierLocatie === "camping" ? m.voorraadCamping : m.voorraadBivak) ?? "–"}</td>
                    <td className="border border-rand p-1" /><td className="border border-rand p-1" /><td className="border border-rand p-1" /><td className="border border-rand p-1" />
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </article>
    );
  }

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
            ? `Gepubliceerd${status.definitiefDoorNaam ? ` door ${status.definitiefDoorNaam}` : ""}${status.definitiefOp ? ` (${formatMoment(status.definitiefOp)})` : ""}.`
            : "CONCEPT: deze lijst is nog niet gepubliceerd. De voorraad op de camping en het bivak is een inschatting."}
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
                <th scope="col" className="w-14 border border-rand p-1 text-center text-xs">Camping</th>
                <th scope="col" className="w-14 border border-rand p-1 text-center text-xs">Bivak</th>
                <th scope="col" className="w-14 border border-rand p-1 text-center text-xs">Totaal</th>
                <th scope="col" className="w-1/4 border border-rand p-1 text-xs">Opmerking</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td className="border border-rand p-1 font-medium">{m.naam}</td>
                  <td className="border border-rand p-1 text-center">{m.voorraadCamping ?? "–"}</td>
                  <td className="border border-rand p-1 text-center">{m.voorraadBivak ?? "–"}</td>
                  <td className="border border-rand p-1 text-center font-bold">{totaalVoorraad(m) ?? "–"}</td>
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
