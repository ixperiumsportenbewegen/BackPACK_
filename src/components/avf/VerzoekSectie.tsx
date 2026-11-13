import { VerzoekFormulier, VerzoekKnoppen } from "@/components/avf/VerzoekFormulier";
import { VerzoekLabel } from "@/components/avf/Verzoeken";
import { rolNaam } from "@/components/avf/Sectie";
import { eigenarenVanSectie, type SectieCode } from "@/config/avf-velden";
import type { Verzoek } from "@/lib/beoordeling";
import { formatMoment } from "@/lib/tijd";

export interface VerzoekContext {
  avfId: string;
  /** false zolang het AVF nog in ontwikkeling is. */
  actief: boolean;
  verzoeken: Verzoek[];
  /** Komt van het dashboard: opent het formulier bij deze sectie met de juiste rol en het juiste veld. */
  focus?: { sectie: string; rol: string | null; veld: string | null };
}

/** Bestaande verbeterverzoeken en het formulier voor een nieuwe, bij een sectie of onderdeel in de leesweergave. */
export function VerzoekSectie({ ctx, sectie, onderdeelId = null }: { ctx: VerzoekContext; sectie: SectieCode; onderdeelId?: string | null }) {
  const lijst = ctx.verzoeken.filter((v) => v.sectie === sectie && v.onderdeelId === onderdeelId);
  const focus = ctx.focus?.sectie === sectie && !onderdeelId ? ctx.focus : undefined;
  const standaardRol = focus?.rol ?? eigenarenVanSectie(sectie)[0] ?? "projectleider";
  return (
    <div className="print:hidden mt-3 flex flex-col gap-2" id={onderdeelId ? undefined : `verzoek-${sectie}`}>
      {lijst.length > 0 && (
        <ul className="flex flex-col gap-2">
          {lijst.map((v) => (
            <li key={v.id} className="rounded-han border border-rand bg-vlak p-3">
              <div className="flex flex-wrap items-center gap-2">
                <VerzoekLabel status={v.status} />
                <span className="text-sm text-zacht">Voor {rolNaam(v.rol) ?? v.rol}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-tekst">{v.tekst}</p>
              <p className="text-sm text-zacht">
                {v.doorNaam} · {formatMoment(v.createdAt)}
                {v.status === "aangepast" && v.aangepastOp && ` · aangepast ${formatMoment(v.aangepastOp)}`}
              </p>
              <VerzoekKnoppen id={v.id} status={v.status} />
            </li>
          ))}
        </ul>
      )}
      <div>
        <VerzoekFormulier
          avfId={ctx.avfId} sectie={sectie} onderdeelId={onderdeelId} veldSleutel={focus?.veld ?? null}
          standaardRol={standaardRol} startOpen={Boolean(focus)} actief={ctx.actief}
        />
      </div>
    </div>
  );
}
