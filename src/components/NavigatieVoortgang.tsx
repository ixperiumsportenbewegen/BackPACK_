"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Laat zien dat er geladen wordt na een tik op een link: een streepje bovenaan en een iets lichtere pagina.
 * Er is geen React-status nodig: het zet alleen een kenmerk op <html> dat de stijl (globals.css) gebruikt.
 * Zodra het adres verandert (de nieuwe pagina is er) gaat het kenmerk weer weg.
 */
export function NavigatieVoortgang() {
  const pad = usePathname();
  const zoek = useSearchParams().toString();

  useEffect(() => {
    document.documentElement.removeAttribute("data-laden");
  }, [pad, zoek]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    function bijKlik(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const naar = new URL(a.href, window.location.href);
      if (naar.origin !== window.location.origin) return;
      // alleen een anker op dezelfde pagina: er wordt niets geladen
      if (naar.pathname === window.location.pathname && naar.search === window.location.search) return;
      document.documentElement.setAttribute("data-laden", "");
      clearTimeout(timer);
      // vangnet: het streepje blijft nooit eindeloos staan
      timer = setTimeout(() => document.documentElement.removeAttribute("data-laden"), 15000);
    }

    document.addEventListener("click", bijKlik, true);
    return () => {
      document.removeEventListener("click", bijKlik, true);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="laadstreep print:hidden fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-rand" role="progressbar" aria-label="Pagina wordt geladen">
      <span />
    </div>
  );
}
