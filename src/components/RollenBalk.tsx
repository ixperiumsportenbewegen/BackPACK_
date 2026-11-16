"use client";

import { useEffect, useRef } from "react";

/**
 * Een rij knoppen die zijwaarts scrolt (in plaats van over meerdere regels te lopen) en vanzelf naar de
 * knop met aria-current="page" springt, zodat je altijd ziet welke rol je bekijkt.
 * De balk is `relative`: anders vallen verborgen schermlezertekst (sr-only) buiten de balk en maakt die de hele
 * pagina zijwaarts scrollbaar. Er wordt alleen in de balk zelf gescrold, nooit in de pagina.
 */
export function RollenBalk({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const balk = ref.current;
    const huidige = balk?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!balk || !huidige) return;
    const midden = huidige.offsetLeft + huidige.offsetWidth / 2;
    balk.scrollLeft = Math.max(0, midden - balk.clientWidth / 2);
  }, []);

  return (
    <nav ref={ref} aria-label={label} className="relative -mx-4 overflow-x-auto px-4 pb-1" data-testid="rollenbalk">
      <ul className="flex w-max gap-2">{children}</ul>
    </nav>
  );
}
