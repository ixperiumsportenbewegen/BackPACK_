"use client";

import { useCallback, useState } from "react";
import { slaVeldOp, type VeldDoel, type Waarde } from "@/app/(app)/avf/actions";
import { useAvfEditor } from "@/components/avf/AvfEditor";

export type Melding = { soort: "bezig" | "ok" | "fout" | "waarschuwing"; tekst: string };
export type Conflict = { huidig: Waarde; mijn: Waarde };

/**
 * Bewaart één veld en houdt bij wat er is opgeslagen. Heeft iemand anders het veld intussen
 * gewijzigd, dan wordt er niets overschreven en komt er een `conflict` met de huidige waarde.
 */
export function useVeld(doel: VeldDoel, begin: Waarde) {
  const { naam } = useAvfEditor();
  const [opgeslagen, setOpgeslagen] = useState<Waarde>(begin);
  const [melding, setMelding] = useState<Melding | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);

  const opslaan = useCallback(
    async (nieuw: Waarde, oud: Waarde = opgeslagen): Promise<boolean> => {
      if (!naam.trim()) {
        setMelding({ soort: "fout", tekst: "Vul bovenaan eerst je naam in." });
        return false;
      }
      setMelding({ soort: "bezig", tekst: "Bezig met opslaan…" });
      const res = await slaVeldOp(doel, oud, nieuw, naam);
      if (res.status === "ok") {
        setOpgeslagen(res.nieuw);
        setConflict(null);
        setMelding({ soort: "ok", tekst: "Opgeslagen" });
        return true;
      }
      if (res.status === "conflict") {
        setConflict({ huidig: res.huidig, mijn: nieuw });
        setMelding({ soort: "waarschuwing", tekst: "Iemand anders heeft dit net gewijzigd." });
        return false;
      }
      setMelding({ soort: "fout", tekst: res.melding });
      return false;
    },
    [doel, naam, opgeslagen],
  );

  const resetNaar = useCallback((w: Waarde) => {
    setOpgeslagen(w);
    setConflict(null);
    setMelding(null);
  }, []);

  return { opgeslagen, melding, conflict, opslaan, resetNaar };
}
