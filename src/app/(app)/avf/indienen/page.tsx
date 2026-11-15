import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Hourglass } from "lucide-react";
import { AvfStatusLabel } from "@/components/BelevenisKaart";
import { SECTIES } from "@/config/avf-velden";
import { laadEigenAvf } from "@/lib/avfData";
import { ontbrekendLink, voortgangPerSectie } from "@/lib/avfVoortgang";
import { laadVerzoekenVoorGroep } from "@/lib/beoordeling";
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
  const aantalOpen = problemen.reduce((n, p) => n + p.ontbrekend.length, 0);
  const verzoeken = await laadVerzoekenVoorGroep(avf.id, avf.status);
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
              <p className="mt-1 text-lg font-bold text-kop" data-testid="controle-samenvatting">
                Nog {aantalOpen} {aantalOpen === 1 ? "punt" : "punten"} open in {problemen.length} {problemen.length === 1 ? "sectie" : "secties"}
              </p>
              <p className="text-sm text-zacht">Tik op een punt om het meteen in te vullen. Open een sectie om te zien wat er nog mist.</p>
              <ul className="mt-3 flex flex-col gap-2">
                {problemen.map((p) => (
                  <li key={p.sectie}>
                    <details open={p.ontbrekend.length <= 3} className="rounded-han border border-rand">
                      <summary className="flex min-h-aanraak cursor-pointer items-center justify-between gap-2 px-3 font-bold text-kop">
                        <span>Sectie {p.sectie} · {SECTIES.find((s) => s.code === p.sectie)?.naam}</span>
                        <span className="rounded-han bg-rand px-2 py-0.5 text-sm">{p.ontbrekend.length} open</span>
                      </summary>
                      <ul className="flex flex-col border-t border-rand">
                        {p.ontbrekend.map((o) => (
                          <li key={o.sleutel} className="border-b border-rand last:border-b-0">
                            <Link
                              href={ontbrekendLink(p.sectie, o.sleutel)}
                              className="flex min-h-aanraak items-center justify-between gap-2 px-3 py-2 text-tekst"
                            >
                              <span>{o.melding}</span>
                              <ChevronRight aria-hidden className="size-5 shrink-0 text-kop" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </details>
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
