import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AvfStatusLabel } from "@/components/BelevenisKaart";
import { StatusLabel } from "@/components/avf/StatusLabel";
import { SECTIES } from "@/config/avf-velden";
import type { AvfGegevens } from "@/lib/avfData";
import { samenvatting, voortgangPerSectie } from "@/lib/avfVoortgang";
import { formatTijdvak } from "@/lib/tijd";

/** Het blok "Jullie AVF": status, voortgang per sectie, open verbeterverzoeken volgen in opdracht 4. */
export function JullieAvfBlok({ avf, kop = "h2" }: { avf: AvfGegevens; kop?: "h2" | "h3" }) {
  const Kop = kop;
  const voortgang = voortgangPerSectie(avf.inhoud);
  const { compleet, totaal } = samenvatting(voortgang);
  const leeg = compleet === 0 && voortgang.every((v) => v.status === "niet_gestart" || v.status === "nvt");

  return (
    <section className="rounded-han border-2 border-thema bg-vlak p-4" aria-label="Jullie AVF">
      <Kop className="text-xl">Jullie AVF</Kop>
      <p className="mt-1 text-lg font-bold text-kop">{avf.inhoud.titel?.trim() || "Nog geen titel"}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <AvfStatusLabel status={avf.status} />
        <span className="font-medium text-kop">{leeg ? "Jullie BackPACK_ is nog leeg. Begin met sectie A." : `${compleet} van ${totaal} vakken ingepakt`}</span>
      </div>
      <p className="mt-1 text-sm text-zacht">{avf.tijdvak ? formatTijdvak(avf.tijdvak) : "Nog niet ingepland"}</p>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {SECTIES.map((s) => {
          const v = voortgang.find((x) => x.sectie === s.code)!;
          return (
            <li key={s.code}>
              <Link href={`/avf/${s.code}`} className="flex min-h-aanraak items-center gap-2 rounded-han border border-rand px-2 py-1">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-han bg-kop font-heading font-bold text-white">{s.code}</span>
                <span className="flex flex-col">
                  <span className="text-sm font-bold leading-tight text-kop">{s.naam}</span>
                  <StatusLabel status={v.status} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href="/avf" className="mt-3 flex min-h-aanraak items-center justify-center gap-1 rounded-han bg-merk px-4 font-bold text-op-merk">
        Verder met het AVF <ChevronRight aria-hidden className="size-5" />
      </Link>
    </section>
  );
}
