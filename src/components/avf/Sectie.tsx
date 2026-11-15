import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AVF_VELDEN, SECTIES, eigenarenVanSectie, type SectieCode } from "@/config/avf-velden";
import { PROJECTGROEPROLLEN } from "@/config/projectgroeprollen";
import type { VoortgangStatus } from "@/lib/avfVoortgang";
import { StatusLabel } from "@/components/avf/StatusLabel";

export function rolNaam(code: string | null | undefined): string | null {
  return PROJECTGROEPROLLEN.find((r) => r.code === code)?.naam ?? null;
}

/** Kop van een sectiescherm met terugknop, voortgang en de eigenaren van de sectie. */
export function SectieKop({ sectie, status, ontbrekend }: { sectie: SectieCode; status: VoortgangStatus; ontbrekend: string[] }) {
  const s = SECTIES.find((x) => x.code === sectie)!;
  const eigenaren = eigenarenVanSectie(sectie).map((r) => rolNaam(r)).filter(Boolean);
  // Per projectgroeprol de velden van deze sectie waar die rol eigenaar van is
  const wieVultWat = eigenaren
    .map((naam) => ({
      rol: naam as string,
      velden: [...new Set(AVF_VELDEN.filter((v) => v.sectie === sectie && rolNaam(v.pgRol) === naam).map((v) => v.label))],
    }))
    .filter((w) => w.velden.length > 0);
  return (
    <div className="flex flex-col gap-2">
      <Link href="/avf" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Jullie AVF
      </Link>
      <p className="text-sm font-bold uppercase text-zacht">Sectie {sectie}</p>
      <h1 className="text-3xl">{s.naam}</h1>
      <p className="text-zacht">{s.uitleg}</p>
      <div className="flex flex-wrap items-center gap-2">
        <StatusLabel status={status} />
        {eigenaren.length > 0 && <span className="text-sm text-zacht">Eigenaar: {eigenaren.join(", ")}</span>}
      </div>
      {wieVultWat.length > 0 && (
        <details className="rounded-han border border-rand bg-vlak p-3" data-testid="wie-vult-wat">
          <summary className="min-h-aanraak cursor-pointer py-2 font-bold text-kop">Wie vult wat in?</summary>
          <ul className="flex flex-col gap-2 text-tekst">
            {wieVultWat.map((w) => (
              <li key={w.rol}>
                <span className="font-bold text-kop">{w.rol}</span>
                <span className="block text-sm text-zacht">{w.velden.join(" · ")}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {ontbrekend.length > 0 && status !== "niet_gestart" && (
        <details className="rounded-han border border-rand bg-vlak p-3">
          <summary className="min-h-aanraak cursor-pointer py-2 font-bold text-kop">Nog nodig voor deze sectie ({ontbrekend.length})</summary>
          <ul className="list-disc pl-5 text-tekst">
            {ontbrekend.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
