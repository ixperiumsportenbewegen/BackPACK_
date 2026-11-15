"use client";

import { useEffect, useRef } from "react";

/**
 * Een rij knoppen die zijwaarts scrolt (in plaats van over meerdere regels te lopen) en vanzelf naar de
 * knop met aria-current="page" springt, zodat je altijd ziet welke rol je bekijkt.
 */
export function RollenBalk({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    ref.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, []);

  return (
    <nav ref={ref} aria-label={label} className="-mx-4 overflow-x-auto px-4 pb-1" data-testid="rollenbalk">
      <ul className="flex w-max gap-2">{children}</ul>
    </nav>
  );
}
