import { SectieStrip } from "@/components/avf/SectieStrip";
import { SECTIES } from "@/config/avf-velden";
import { laadEigenAvf } from "@/lib/avfData";
import { voortgangPerSectie } from "@/lib/avfVoortgang";
import { getProfiel } from "@/lib/profiel";

/** Alle AVF-schermen van de projectgroep krijgen dezelfde sectiebalk bovenaan. */
export default async function AvfLayout({ children }: { children: React.ReactNode }) {
  const profiel = await getProfiel();
  if (profiel?.soort !== "projectgroep") return <>{children}</>;
  const avf = await laadEigenAvf();
  if (!avf) return <>{children}</>;

  const voortgang = voortgangPerSectie(avf.inhoud);
  const items = SECTIES.map((s) => ({
    code: s.code,
    naam: s.naam,
    status: voortgang.find((v) => v.sectie === s.code)!.status,
  }));

  return (
    <>
      <SectieStrip items={items} />
      {children}
    </>
  );
}
