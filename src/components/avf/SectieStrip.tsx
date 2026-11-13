"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, CircleDot, LayoutList, Minus } from "lucide-react";
import type { VoortgangStatus } from "@/lib/avfVoortgang";

export interface StripItem {
  code: string;
  naam: string;
  status: VoortgangStatus;
}

/**
 * Vaste balk bovenaan elk AVF-scherm met alle secties A t/m H. De huidige sectie is gemarkeerd, het icoon
 * toont de voortgang (compleet, onvolledig). Met één tik ga je naar elke sectie of terug naar het overzicht.
 */
export function SectieStrip({ items }: { items: StripItem[] }) {
  const pad = usePathname();
  const actiefRef = useRef<HTMLAnchorElement | null>(null);

  // Op de overzichtspagina staat de lijst zelf al; op onderdeelpagina's hoort sectie D bij het onderdeel
  const huidig = pad.startsWith("/avf/onderdeel/") ? "D" : pad.startsWith("/avf/") ? pad.split("/")[2]?.toUpperCase() : null;

  useEffect(() => {
    actiefRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [huidig]);

  if (pad === "/avf") return null;

  return (
    <nav
      aria-label="Secties van het AVF"
      className="print:hidden sticky top-[4.25rem] z-10 -mx-4 mb-4 border-b border-rand bg-vlak px-4 py-2"
    >
      <ul className="flex gap-2 overflow-x-auto pb-1">
        <li className="shrink-0">
          <Link href="/avf" className="flex min-h-aanraak items-center gap-1 rounded-han border-2 border-zacht bg-vlak px-3 font-bold text-kop">
            <LayoutList aria-hidden className="size-5" /> Overzicht
          </Link>
        </li>
        {items.map((s) => {
          const actief = s.code === huidig;
          const Icoon = s.status === "compleet" ? CheckCircle2 : s.status === "onvolledig" ? CircleDot : s.status === "nvt" ? Minus : null;
          return (
            <li key={s.code} className="shrink-0">
              <Link
                ref={actief ? actiefRef : undefined}
                href={`/avf/${s.code}`}
                aria-current={actief ? "page" : undefined}
                aria-label={`Sectie ${s.code}, ${s.naam}${s.status === "compleet" ? ", compleet" : s.status === "onvolledig" ? ", onvolledig" : ""}`}
                className={`flex min-h-aanraak min-w-aanraak items-center justify-center gap-1 rounded-han border-2 px-3 font-heading text-lg font-bold ${
                  actief ? "border-kop bg-kop text-white" : "border-zacht bg-vlak text-kop"
                }`}
              >
                {s.code}
                {Icoon && <Icoon aria-hidden className="size-4" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
