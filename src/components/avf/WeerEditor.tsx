"use client";

import Link from "next/link";
import { useState } from "react";
import { JaNeeVeld, TekstVeld } from "@/components/avf/Velden";
import { WEER_SCENARIOS, WEER_VELDEN } from "@/config/avf-velden";

type Scenario = { relevant?: boolean | null; [veld: string]: unknown };

/** De vier weerscenario's. Een scenario moet worden afgewogen: relevant (met maatregel enz.) of niet relevant. */
export function WeerEditor({ begin, eigenaar }: { begin: Record<string, Scenario>; eigenaar?: string | null }) {
  const [relevant, setRelevant] = useState<Record<string, boolean | null>>(
    Object.fromEntries(WEER_SCENARIOS.map((s) => [s.sleutel, typeof begin[s.sleutel]?.relevant === "boolean" ? (begin[s.sleutel].relevant as boolean) : null])),
  );

  return (
    <div className="flex flex-col gap-4">
      {WEER_SCENARIOS.map((s, n) => {
        const data = begin[s.sleutel] ?? {};
        return (
          <section key={s.sleutel} className="rounded-han border-2 border-rand bg-vlak p-3">
            <h3 className="text-lg">{s.label}</h3>
            <div className="mt-2 flex flex-col gap-3">
              <JaNeeVeld
                doel={{ soort: "json", sectie: "veiligheid", pad: ["weer", s.sleutel, "relevant"] }}
                begin={typeof data.relevant === "boolean" ? data.relevant : null}
                label="Is dit scenario relevant voor jullie belevenis?"
                hulp={s.hulp || undefined}
                eigenaar={n === 0 ? eigenaar : undefined}
                bijOpgeslagen={(w) => setRelevant((r) => ({ ...r, [s.sleutel]: w }))}
              />
              {relevant[s.sleutel] === true &&
                WEER_VELDEN.map((f) => (
                  <TekstVeld
                    key={f.sleutel}
                    doel={{ soort: "json", sectie: "veiligheid", pad: ["weer", s.sleutel, f.sleutel] }}
                    begin={(data[f.sleutel] as string | null | undefined) ?? null}
                    label={f.label}
                    meerRegels={f.sleutel !== "beslisser"}
                    maxLengte={f.sleutel === "beslisser" ? 100 : 500}
                  />
                ))}
              {relevant[s.sleutel] === false && <p className="text-sm text-zacht">Niet relevant: er hoeft niets te worden ingevuld.</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** De EHBO-vraag: ja geeft een veld voor de maatregelen, nee verwijst naar het algemene EHBO-plan. */
export function EhboBlok({
  aanvullend, maatregelen, eigenaar, planKlaar = false,
}: { aanvullend: boolean | null; maatregelen: string | null; eigenaar?: string | null; planKlaar?: boolean }) {
  const [ja, setJa] = useState<boolean | null>(aanvullend);
  return (
    <div className="flex flex-col gap-3">
      <JaNeeVeld
        doel={{ soort: "json", sectie: "veiligheid", pad: ["ehbo", "aanvullend"] }}
        begin={aanvullend}
        label="Zijn aanvullende EHBO-maatregelen nodig?"
        eigenaar={eigenaar}
        bijOpgeslagen={setJa}
      />
      {ja === true && (
        <TekstVeld
          doel={{ soort: "json", sectie: "veiligheid", pad: ["ehbo", "maatregelen"] }}
          begin={maatregelen}
          label="Welke maatregelen? (wie, waar, middelen)"
          meerRegels
          maxLengte={1000}
        />
      )}
      {ja === false && (
        <p className="rounded-han bg-achtergrond p-3 text-kop">
          Voor deze belevenis geldt het algemene calamiteitenplan (inclusief EHBO).{" "}
          {planKlaar ? (
            <Link href="/meer/calamiteitenplan" className="font-bold underline">Open het calamiteitenplan</Link>
          ) : (
            "Het calamiteitenplan volgt."
          )}
        </p>
      )}
    </div>
  );
}
