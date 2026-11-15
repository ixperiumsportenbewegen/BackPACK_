"use client";

import { useEffect, useRef } from "react";

type Opties = {
  /** Hoe lang het veld stil moet zijn voordat er wordt opgeslagen (milliseconden). */
  vertraging?: number;
  /** Zet op false als het veld niet te bewerken is. */
  actief?: boolean;
};

/**
 * Slaat een veld op terwijl je typt: na een korte stilte, en meteen als je de pagina verlaat of de app
 * naar de achtergrond gaat. Zo gaat er niets verloren als je direct na het typen op een knop tikt.
 *
 * - `bewaar` moet zelf vergelijken met de laatst opgeslagen waarde en niets doen als er niets is veranderd.
 * - Er loopt nooit meer dan één opslag tegelijk: wie doortypt tijdens het opslaan, wordt daarna opgeslagen.
 * - Is er nog iets niet opgeslagen terwijl de pagina sluit, dan waarschuwt de browser.
 */
export function useAutoBewaar(
  waarde: string,
  bewaar: () => void | Promise<unknown>,
  { vertraging = 1000, actief = true }: Opties = {},
) {
  const bewaarRef = useRef(bewaar);
  const waardeRef = useRef(waarde);
  const laatsteWaarde = useRef(waarde);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bezig = useRef(false);
  const opnieuw = useRef(false);
  const onopgeslagen = useRef(false);

  // Altijd de nieuwste versie van de functie en de tekst gebruiken, ook in timers en bij het verlaten.
  useEffect(() => {
    bewaarRef.current = bewaar;
    waardeRef.current = waarde;
  });

  useEffect(() => {
    if (!actief) return;

    async function voerUit() {
      if (bezig.current) {
        opnieuw.current = true;
        return;
      }
      bezig.current = true;
      try {
        do {
          opnieuw.current = false;
          await bewaarRef.current();
        } while (opnieuw.current);
      } finally {
        bezig.current = false;
        onopgeslagen.current = false;
      }
    }

    function nu() {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (onopgeslagen.current) void voerUit();
    }

    // Een nieuwe tekst: wachten tot het even stil is.
    if (waarde !== laatsteWaarde.current) {
      laatsteWaarde.current = waarde;
      onopgeslagen.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void voerUit();
      }, vertraging);
    }

    function bijVerbergen() {
      if (document.visibilityState === "hidden") nu();
    }
    function bijSluiten(e: BeforeUnloadEvent) {
      if (onopgeslagen.current || bezig.current) {
        nu();
        e.preventDefault();
      }
    }
    document.addEventListener("visibilitychange", bijVerbergen);
    window.addEventListener("pagehide", nu);
    window.addEventListener("beforeunload", bijSluiten);
    return () => {
      document.removeEventListener("visibilitychange", bijVerbergen);
      window.removeEventListener("pagehide", nu);
      window.removeEventListener("beforeunload", bijSluiten);
    };
  }, [waarde, vertraging, actief]);

  // Verlaat je het scherm binnen de app (bijvoorbeeld via de onderste knoppen), dan nog direct opslaan.
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (onopgeslagen.current && !bezig.current) void bewaarRef.current();
    };
  }, []);
}
