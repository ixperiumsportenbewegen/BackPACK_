/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ChevronLeft, Pencil } from "lucide-react";
import { AfdrukKnop } from "@/components/avf/AfdrukKnop";
import { PaginaKop } from "@/components/PaginaKop";
import { PaklijstLezen } from "@/components/paklijst/PaklijstLezen";
import { PAKLIJST_BLOKKEN } from "@/config/paklijst";
import { alleSpullen, laadPaklijst } from "@/lib/paklijst";
import { getProfiel } from "@/lib/profiel";
import { formatMoment } from "@/lib/tijd";

export const metadata = { title: "Persoonlijke paklijst · BackPACK_" };

/** De persoonlijke paklijst van het eigen cluster: wat neem je mee? Voor iedereen in het cluster te lezen en af te vinken. */
export default async function PersoonlijkePaklijst() {
  const profiel = (await getProfiel())!;
  const cluster = profiel.cluster;
  const kanBewerken = profiel.soort === "stuurgroep" || profiel.soort === "docent";

  if (!cluster) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/meer" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
          <ChevronLeft aria-hidden className="size-5" /> Meer
        </Link>
        <p className="rounded-han border border-rand bg-vlak p-4 text-tekst">Kies eerst een cluster op het startscherm.</p>
      </div>
    );
  }

  const paklijst = await laadPaklijst(cluster.id);
  const leeg = alleSpullen(paklijst).length === 0;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/meer" className="print:hidden flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Meer
      </Link>
      <div className="print:hidden"><PaginaKop titel="Persoonlijke paklijst" foto="wandeling-schemer-staand" /></div>
      <div className="hidden items-center justify-between gap-4 print:flex">
        <h1 className="text-4xl">Paklijst · {cluster.naam}</h1>
        <img src="/logo/han-woordmerk-descriptor-400.png" alt="HAN University of Applied Sciences" className="h-12 w-auto" />
      </div>
      <p className="text-zacht">
        Wat neem je mee naar de Ardennen-meerdaagse van {cluster.naam}? Vink af terwijl je pakt. Wat je afvinkt, blijft alleen op deze telefoon staan.
        {paklijst.bijgewerkt && ` Laatst bijgewerkt ${formatMoment(paklijst.bijgewerkt.moment)}${paklijst.bijgewerkt.naam ? ` door ${paklijst.bijgewerkt.naam}` : ""}.`}
      </p>

      {leeg ? (
        <p className="rounded-han border border-rand bg-vlak p-4 text-tekst">
          De paklijst van {cluster.naam} wordt gemaakt door de stuurgroep (Logistiek &amp; Facilitair). Zodra er items op staan, zie je ze hier.
        </p>
      ) : (
        <nav aria-label="Onderdelen van de paklijst" className="print:hidden flex gap-2">
          {PAKLIJST_BLOKKEN.map((b) => (
            <a key={b.code} href={`#${b.code}`} className="flex min-h-aanraak items-center rounded-han border-2 border-rand bg-vlak px-3 text-sm font-bold text-kop">{b.naam}</a>
          ))}
        </nav>
      )}

      <div className="print:hidden grid gap-2 sm:grid-cols-2">
        {!leeg && <AfdrukKnop />}
        {kanBewerken && (
          <Link href="/meer/paklijst/bewerken" className="flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
            <Pencil aria-hidden className="size-5" /> De paklijst bewerken
          </Link>
        )}
      </div>

      <PaklijstLezen clusterId={cluster.id} categorieen={paklijst.categorieen} />
    </div>
  );
}
