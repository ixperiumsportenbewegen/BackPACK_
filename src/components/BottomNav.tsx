"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Flame, Menu, Tent, Wallet } from "lucide-react";
import type { Accountsoort } from "@/lib/label";

interface Item {
  href: string;
  label: string;
  icoon: typeof Tent;
}

function itemsVoor(soort: Accountsoort): Item[] {
  const items: Item[] = [
    { href: "/", label: "Onze meerdaagse", icoon: Tent },
    { href: "/belevenissen", label: "Belevenissen", icoon: Flame },
  ];
  if (soort === "projectgroep") items.push({ href: "/budget", label: "Budget", icoon: Wallet });
  if (soort === "stuurgroep" || soort === "docent") items.push({ href: "/stuurgroep", label: "Stuurgroep", icoon: Compass });
  items.push({ href: "/meer", label: "Meer", icoon: Menu });
  return items;
}

/** Onderste balk op telefoon, zijbalk op laptop. Studenten zien geen derde knop. */
export function BottomNav({ soort }: { soort: Accountsoort }) {
  const pad = usePathname();
  const items = itemsVoor(soort);

  return (
    <nav
      aria-label="Hoofdmenu"
      className="print:hidden fixed inset-x-0 bottom-0 z-20 border-t border-rand bg-vlak pb-[env(safe-area-inset-bottom)] md:inset-y-0 md:right-auto md:w-60 md:border-r md:border-t-0 md:pt-24"
    >
      <ul className="grid auto-cols-fr grid-flow-col md:flex md:flex-col md:gap-1 md:p-3">
        {items.map(({ href, label, icoon: Icoon }) => {
          const actief = href === "/" ? pad === "/" : pad.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={actief ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs font-medium leading-tight md:min-h-aanraak md:flex-row md:justify-start md:gap-3 md:rounded-han md:px-3 md:text-base ${
                  actief ? "bg-merk text-op-merk md:rounded-han" : "text-kop"
                }`}
              >
                <Icoon aria-hidden className="size-6 shrink-0" strokeWidth={1.75} />
                <span className="text-center md:text-left">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
