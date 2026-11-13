import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, LayoutList } from "lucide-react";

interface Doel {
  href: string;
  label: string;
}

/**
 * Grote vorige- en volgende-knoppen onderaan een AVF-scherm, zodat je met één tik naar het
 * volgende of vorige stuk kunt. Wijzigingen zijn dan al opgeslagen, want elk veld bewaart zichzelf.
 */
export function StapNavigatie({
  vorige, volgende, terug = { href: "/avf", label: "Terug naar het overzicht van het AVF" }, laatsteLabel = "Klaar: naar het overzicht",
}: {
  vorige: Doel | null;
  volgende: Doel | null;
  terug?: Doel;
  laatsteLabel?: string;
}) {
  const knop = "flex min-h-16 flex-col justify-center rounded-han border-2 px-3 py-2";
  return (
    <nav aria-label="Vorige en volgende" className="print:hidden mt-4 flex flex-col gap-3 border-t-2 border-rand pt-4">
      <div className="grid grid-cols-2 gap-3">
        {vorige ? (
          <Link href={vorige.href} className={`${knop} border-kop bg-vlak text-kop`}>
            <span className="flex items-center gap-1 text-sm font-medium"><ArrowLeft aria-hidden className="size-4" /> Vorige</span>
            <span className="font-bold leading-tight">{vorige.label}</span>
          </Link>
        ) : (
          <Link href={terug.href} className={`${knop} border-kop bg-vlak text-kop`}>
            <span className="flex items-center gap-1 text-sm font-medium"><ArrowLeft aria-hidden className="size-4" /> Terug</span>
            <span className="font-bold leading-tight">Overzicht</span>
          </Link>
        )}
        {volgende ? (
          <Link href={volgende.href} className={`${knop} items-end border-merk bg-merk text-right text-op-merk`}>
            <span className="flex items-center gap-1 text-sm font-medium">Volgende <ArrowRight aria-hidden className="size-4" /></span>
            <span className="font-bold leading-tight">{volgende.label}</span>
          </Link>
        ) : (
          <Link href={terug.href} className={`${knop} items-end border-merk bg-merk text-right text-op-merk`}>
            <span className="flex items-center gap-1 text-sm font-medium">Klaar <Check aria-hidden className="size-4" /></span>
            <span className="font-bold leading-tight">{laatsteLabel}</span>
          </Link>
        )}
      </div>
      <Link href={terug.href} className="flex min-h-aanraak items-center justify-center gap-2 font-bold text-kop underline">
        <LayoutList aria-hidden className="size-5" /> {terug.label}
      </Link>
    </nav>
  );
}
