import Link from "next/link";
import { ChevronLeft, ExternalLink, Mountain, Pencil } from "lucide-react";
import { AfdrukKnop } from "@/components/avf/AfdrukKnop";
import { PaginaKop } from "@/components/PaginaKop";
import { laadBergtoppen, zichtbareBergtoppen } from "@/lib/bergtoppen";
import { getProfiel } from "@/lib/profiel";
import { formatMoment } from "@/lib/tijd";

export const metadata = { title: "De 10 bergtoppen · BackPACK_" };

/** De gedragsafspraken van het cluster: voor iedereen in het cluster te lezen zodra ze gepubliceerd zijn. */
export default async function Bergtoppen() {
  const profiel = (await getProfiel())!;
  const cluster = profiel.cluster;
  const kanBewerken = profiel.soort === "stuurgroep" || profiel.soort === "docent";

  if (!cluster) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
          <ChevronLeft aria-hidden className="size-5" /> Onze meerdaagse
        </Link>
        <p className="rounded-han border border-rand bg-vlak p-4 text-tekst">Kies eerst een cluster op het startscherm.</p>
      </div>
    );
  }

  const publicatie = await zichtbareBergtoppen(cluster.id);
  const { inschrijfLink } = await laadBergtoppen(cluster.id);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/" className="print:hidden flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Onze meerdaagse
      </Link>
      <div className="print:hidden"><PaginaKop titel="De 10 bergtoppen" foto="wandeling-schemer-staand" /></div>
      <h1 className="hidden text-3xl print:block">De 10 bergtoppen van de Ardennen · {cluster.naam}</h1>

      {!publicatie ? (
        <>
          <p className="rounded-han border border-rand bg-vlak p-4 text-tekst">
            De gedragsafspraken van {cluster.naam} worden voorbereid door de stuurgroep (Veiligheid & Welzijn). Zodra ze zijn gepubliceerd, lees je ze hier.
          </p>
          {kanBewerken && (
            <Link href="/bergtoppen/bewerken" className="flex min-h-aanraak items-center justify-center gap-2 rounded-han bg-merk px-4 font-bold text-op-merk">
              <Pencil aria-hidden className="size-5" /> De bergtoppen invullen
            </Link>
          )}
        </>
      ) : (
        <>
          <p className="text-zacht">
            Dit zijn de gedragsafspraken van {cluster.naam}: de 10 bergtoppen van de Ardennen. We nemen ze samen mee de berg op.
            Gepubliceerd {formatMoment(publicatie.gepubliceerdOp)}{publicatie.gepubliceerdDoor ? ` door ${publicatie.gepubliceerdDoor}` : ""}.
          </p>

          <ol className="flex flex-col gap-3">
            {publicatie.inhoud.toppen.map((t) => (
              <li key={t.nummer} className="flex gap-3 rounded-han border border-rand bg-vlak p-4 break-inside-avoid">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-kop font-heading text-lg font-bold text-white">{t.nummer}</span>
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-xl"><Mountain aria-hidden className="size-5 shrink-0 text-merk" /> {t.titel}</h2>
                  <p className="mt-1 whitespace-pre-line text-tekst">{t.afspraak}</p>
                </div>
              </li>
            ))}
          </ol>

          {publicatie.inhoud.toelichting && (
            <section aria-label="Toelichting" className="rounded-han border-2 border-kop bg-vlak p-4 break-inside-avoid">
              {publicatie.inhoud.toelichting_titel && <h2 className="text-xl">{publicatie.inhoud.toelichting_titel}</h2>}
              <p className="mt-1 whitespace-pre-line text-tekst">{publicatie.inhoud.toelichting}</p>
            </section>
          )}

          <section aria-label="Ondertekenen" className="print:hidden flex flex-col gap-2 rounded-han border border-rand bg-vlak p-4">
            <h2 className="text-xl">Ondertekenen</h2>
            {inschrijfLink ? (
              <>
                <p className="text-tekst">Door je in te schrijven voor de meerdaagse onderteken je deze afspraken. Dat doe je in het inschrijfformulier.</p>
                <a href={inschrijfLink} target="_blank" rel="noreferrer" className="flex min-h-aanraak items-center justify-center gap-2 rounded-han bg-merk px-4 font-bold text-op-merk">
                  <ExternalLink aria-hidden className="size-5" /> Ondertekenen via het inschrijfformulier
                </a>
              </>
            ) : (
              <p className="text-tekst">Je ondertekent de afspraken in het inschrijfformulier. De link daarnaartoe volgt.</p>
            )}
          </section>

          <div className="print:hidden grid gap-2 sm:grid-cols-2">
            <AfdrukKnop />
            {kanBewerken && (
              <Link href="/bergtoppen/bewerken" className="flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
                <Pencil aria-hidden className="size-5" /> De bergtoppen bewerken
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
