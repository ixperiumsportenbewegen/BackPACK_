"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Lock } from "lucide-react";

const NAAM_SLEUTEL = "backpack_avfnaam";

interface EditorContext {
  naam: string;
  vergrendeld: boolean;
}

const Context = createContext<EditorContext>({ naam: "", vergrendeld: false });

export function useAvfEditor(): EditorContext {
  return useContext(Context);
}

/**
 * Omhult een AVF-scherm: vraagt één keer per telefoon om de naam van wie invult
 * (komt in "laatst gewijzigd door") en maakt alle velden alleen-lezen als het AVF is ingediend.
 */
export function AvfEditor({ vergrendeld, children }: { vergrendeld: boolean; children: React.ReactNode }) {
  const [naam, setNaam] = useState("");

  useEffect(() => {
    try {
      // Eenmalig na het laden: opslag in de browser bestaat niet op de server.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNaam(localStorage.getItem(NAAM_SLEUTEL) ?? "");
    } catch {
      /* opslag niet beschikbaar: dan blijft het veld leeg */
    }
  }, []);

  function wijzig(waarde: string) {
    setNaam(waarde);
    try {
      localStorage.setItem(NAAM_SLEUTEL, waarde);
    } catch {
      /* niet erg */
    }
  }

  return (
    <Context.Provider value={{ naam, vergrendeld }}>
      <div className="flex flex-col gap-4">
        {vergrendeld ? (
          <p role="status" className="flex items-start gap-2 rounded-han border-2 border-kop bg-vlak p-3 font-medium text-kop">
            <Lock aria-hidden className="mt-0.5 size-5 shrink-0" />
            Dit AVF is ingediend. Je kunt het lezen, maar niet meer wijzigen.
          </p>
        ) : (
          <section className="rounded-han border border-rand bg-vlak p-4">
            <label className="flex flex-col gap-1 font-medium text-kop">
              Wie werkt hier? (jouw naam)
              <input
                value={naam}
                onChange={(e) => wijzig(e.target.value)}
                autoComplete="off"
                maxLength={60}
                placeholder="Bijvoorbeeld Sanne"
                className="min-h-aanraak rounded-han border-2 border-zacht bg-vlak px-3 text-base font-normal text-tekst"
              />
            </label>
            <p className="mt-2 text-sm text-zacht">
              Jullie delen één account. Met je naam zien anderen wie het laatst iets wijzigde. Wijzigingen worden direct opgeslagen.
            </p>
          </section>
        )}
        {children}
      </div>
    </Context.Provider>
  );
}
