import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ChevronLeft, CircleAlert, Hourglass } from "lucide-react";
import { AvfStatusLabel } from "@/components/BelevenisKaart";
import { SECTIES } from "@/config/avf-velden";
import { laadEigenAvf } from "@/lib/avfData";
import { voortgangPerSectie } from "@/lib/avfVoortgang";
import { laadVerzoeken } from "@/lib/beoordeling";
import { getProfiel } from "@/lib/profiel";
import { IndienenFormulier } from "./IndienenFormulier";

export const metadata = { title: "Indienen · BackPACK_" };

export default async function IndienenPagina() {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "projectgroep") redirect("/belevenissen");
  const avf = await laadEigenAvf();
  if (!avf) redirect("/");

  const voortgang = voortgangPerSectie(avf.inhoud);
  const problemen = voortgang.filter((v) => v.ontbrekend.length > 0);
  const verzoeken = await laadVerzoeken(avf.id);
  const open = verzoeken.filter((v) => v.status === "open").map((v) => ({ id: v.id, sectie: v.sectie, tekst: v.tekst }));
  const kanIndienen = avf.status === "in_ontwikkeling" || avf.status === "aanpassing_gevraagd";

  return (
    <div className="flex flex-col gap-4">
      <Link href="/avf" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Jullie AVF
      </Link>
      <h1 className="text-3xl">AVF indienen</h1>
      <div className="flex flex-wrap items-center gap-2">
        <AvfStatusLabel status={avf.status} />
        <span className="text-zacht">{avf.inhoud.titel?.trim() || "Nog geen titel"}</span>
      </div>

      {avf.status === "ingediend" && (
        <p role="status" className="flex items-start gap-2 rounded-han border-2 border-kop bg-vlak p-4 font-medium text-kop">
          <Hourglass aria-hidden className="mt-0.5 size-5 shrink-0" />
          Jullie AVF is ingediend (versie {avf.versie}). De stuurgroep gaat het beoordelen. Jullie krijgen op deze plek te zien of er aanpassingen nodig zijn.
        </p>
      )}
      {avf.status === "goedgekeurd" && (
        <p role="status" className="flex items-start gap-2 rounded-han border-2 border-goedgekeurd bg-vlak p-4 font-medium text-kop">
          <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0" />
          {avf.opnieuwTeControleren
            ? "Jullie AVF was goedgekeurd, maar jullie hebben iets belangrijks gewijzigd. De stuurgroep kijkt er opnieuw naar."
            : "Jullie AVF is goedgekeurd. Jullie kunnen het nog bewerken. Bij een belangrijke wijziging kijkt de stuurgroep er opnieuw naar."}
        </p>
      )}
      {avf.status === "aanpassing_gevraagd" && (
        <p role="status" className="flex items-start gap-2 rounded-han border-2 border-actie bg-vlak p-4 font-medium text-kop">
          <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          De stuurgroep vraagt om aanpassingen. Lees de verbeterverzoeken in de secties, pas aan en dien daarna opnieuw in.
        </p>
      )}

      {kanIndienen && (
        <section className="rounded-han border border-rand bg-vlak p-4" aria-label="Controlelijst">
          <h2 className="text-xl">Controlelijst</h2>
          {problemen.length === 0 ? (
            <p className="mt-1 flex items-center gap-2 font-bold text-kop">
              <CheckCircle2 aria-hidden className="size-5" /> Alle verplichte velden zijn ingevuld.
            </p>
          ) : (
            <>
              <p className="mt-1 text-tekst">Dit moet nog worden ingevuld voordat je kunt indienen:</p>
              <ul className="mt-2 flex flex-col gap-3">
                {problemen.map((p) => (
                  <li key={p.sectie}>
                    <Link href={`/avf/${p.sectie}`} className="inline-flex min-h-aanraak items-center font-bold text-kop underline">
                      Sectie {p.sectie} · {SECTIES.find((s) => s.code === p.sectie)?.naam}
                    </Link>
                    <ul className="list-disc pl-5 text-tekst">{p.ontbrekend.map((o) => <li key={o.sleutel}>{o.melding}</li>)}</ul>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {kanIndienen && problemen.length === 0 && <IndienenFormulier versie={avf.versie} openVerzoeken={open} />}
    </div>
  );
}
