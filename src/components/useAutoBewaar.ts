"use client";

import { useCallback, useEffect, useRef } from "react";

type Opties = {
  /** Hoe lang het veld stil moet zijn voordat er wordt opgeslagen (milliseconden). */
  vertraging?: number;
  /**
   * Zet op false als het veld niet te bewerken is, of als er niet automatisch mag worden opgeslagen
   * (bijvoorbeeld zolang er een waarschuwing over een gelijktijdige wijziging openstaat).
   */
  actief?: boolean;
};

/**
 * Slaat een veld op terwijl je typt: na een korte stilte, en meteen als je de pagina verlaat of de app
 * naar de achtergrond gaat. Zo gaat er niets verloren als je direct na het typen op een knop tikt.
 *
 * - `bewaar` moet zelf vergelijken met de laatst opgeslagen waarde en niets doen als er niets is veranderd.
 * - Er loopt nooit meer dan één opslag tegelijk, ook niet als je het veld verlaat terwijl de timer loopt:
 *   gebruik daarvoor `bewaarNu` (bijvoorbeeld bij `onBlur`). Wie doortypt tijdens het opslaan, wordt daarna opgeslagen.
 * - Is er nog iets niet opgeslagen terwijl de pagina sluit, dan waarschuwt de browser.
 */
export function useAutoBewaar(
  waarde: string,
  bewaar: () => void | Promise<unknown>,
  { vertraging = 1000, actief = true }: Opties = {},
): { bewaarNu: () => Promise<void> } {
  const bewaarRef = useRef(bewaar);
  const waardeRef = useRef(waarde);
  const laatsteWaarde = useRef(waarde);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bezig = useRef(false);
  const opnieuw = useRef(false);
  const onopgeslagen = useRef(false);
  const actiefRef = useRef(actief);

  // Altijd de nieuwste versie van de functie en de tekst gebruiken, ook in timers en bij het verlaten.
  useEffect(() => {
    bewaarRef.current = bewaar;
    waardeRef.current = waarde;
    actiefRef.current = actief;
  });

  const wisTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const voerUit = useCallback(async () => {
    if (bezig.current) {
      opnieuw.current = true;
      return;
    }
    bezig.current = true;
    const begin = waardeRef.current;
    try {
      do {
        opnieuw.current = false;
        await bewaarRef.current();
      } while (opnieuw.current);
    } finally {
      bezig.current = false;
      // is er tijdens het opslaan doorgetypt, dan staat er nog iets open
      onopgeslagen.current = waardeRef.current !== begin;
    }
  }, []);

  const bewaarNu = useCallback(async () => {
    wisTimer();
    await voerUit();
  }, [wisTimer, voerUit]);

  useEffect(() => {
    if (!actief) {
      wisTimer();
      return;
    }

    function nu() {
      wisTimer();
      if (onopgeslagen.current) void voerUit();
    }

    // Een nieuwe tekst: wachten tot het even stil is.
    if (waarde !== laatsteWaarde.current) {
      laatsteWaarde.current = waarde;
      onopgeslagen.current = true;
      wisTimer();
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
  }, [waarde, vertraging, actief, wisTimer, voerUit]);

  // Verlaat je het scherm binnen de app (bijvoorbeeld via de onderste knoppen), dan nog direct opslaan.
  useEffect(() => {
    return () => {
      wisTimer();
      if (actiefRef.current && onopgeslagen.current && !bezig.current) void bewaarRef.current();
    };
  }, [wisTimer]);

  return { bewaarNu };
}
