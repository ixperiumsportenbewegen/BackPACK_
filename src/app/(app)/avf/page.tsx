import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock, FileText, MapPin, Send } from "lucide-react";
import { AvfStatusLabel } from "@/components/BelevenisKaart";
import { StatusLabel } from "@/components/avf/StatusLabel";
import { VerzoekLabel } from "@/components/avf/Verzoeken";
import { PaginaKop } from "@/components/PaginaKop";
import { SECTIES, eigenarenVanSectie } from "@/config/avf-velden";
import { rolNaam } from "@/components/avf/Sectie";
import { laadEigenAvf } from "@/lib/avfData";
import { laadVerzoekenVoorGroep } from "@/lib/beoordeling";
import { samenvatting, voortgangPerSectie } from "@/lib/avfVoortgang";
import { getProfiel } from "@/lib/profiel";
import { formatMoment, formatTijdvak } from "@/lib/tijd";

export const metadata = { title: "Jullie AVF · BackPACK_" };

export default async function AvfOverzicht() {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "projectgroep") redirect("/belevenissen");
  const avf = await laadEigenAvf();
  if (!avf) redirect("/");

  const voortgang = voortgangPerSectie(avf.inhoud);
  const verzoeken = (await laadVerzoekenVoorGroep(avf.id, avf.status)).filter((v) => v.status !== "afgehandeld");
  const { compleet, totaal } = samenvatting(voortgang);
  const leeg = compleet === 0 && voortgang.every((v) => v.status === "niet_gestart" || v.status === "nvt");

  return (
    <div className="flex flex-col gap-4">
      <Link href="/belevenissen" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Belevenissen
      </Link>
      <PaginaKop titel="Jullie AVF" foto="klimmen-staand" />

      <section className="rounded-han border border-rand bg-vlak p-4">
        <p className="text-sm font-medium text-zacht">{avf.projectgroepNaam}</p>
        <h2 className="text-2xl">{avf.inhoud.titel?.trim() || "Nog geen titel"}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <AvfStatusLabel status={avf.status} />
          <span className="font-bold text-kop">
            {leeg ? "Jullie BackPACK_ is nog leeg. Begin met sectie A." : `${compleet} van ${totaal} vakken ingepakt`}
          </span>
        </div>
        <div className="mt-3 border-t border-rand pt-3">
          <p className="flex items-center gap-2 text-tekst">
            <Clock aria-hidden className="size-4 shrink-0" />
            {avf.tijdvak ? formatTijdvak(avf.tijdvak) : "Nog niet ingepland"}
          </p>
          <p className="mt-1 flex items-center gap-2 text-tekst">
            <MapPin aria-hidden className="size-4 shrink-0" />
            {avf.locatie ?? "Locatie nog niet gekozen: kies camping of bivak in sectie A"}
          </p>
          <p className="mt-1 text-sm text-zacht">Het tijdvak bepaalt de stuurgroep. De locatie (camping of bivak) kiezen jullie zelf in sectie A.</p>
        </div>
        {avf.status === "ingediend" && <p className="mt-3 font-medium text-kop">Dit AVF is ingediend en kan niet meer worden gewijzigd. De stuurgroep beoordeelt het.</p>}
        {avf.status === "aanpassing_gevraagd" && <p className="mt-3 font-medium text-kop">De stuurgroep vraagt om aanpassingen. Zie de secties met een open verbeterverzoek.</p>}
        {avf.opnieuwTeControleren && <p className="mt-3 font-medium text-kop">Opnieuw te controleren: jullie hebben iets belangrijks gewijzigd na de goedkeuring.</p>}
      </section>

      <Link href={`/belevenissen/${avf.id}`} className="flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
        <FileText aria-hidden className="size-5" /> Het hele AVF lezen of afdrukken
      </Link>

      <Link href="/avf/indienen" className="flex min-h-aanraak items-center justify-between gap-2 rounded-han bg-merk px-4 font-bold text-op-merk">
        <span className="flex items-center gap-2"><Send aria-hidden className="size-5" /> {avf.status === "ingediend" ? "Stand van het indienen" : avf.status === "goedgekeurd" ? "Status van de goedkeuring" : "Indienen"}</span>
        <ChevronRight aria-hidden className="size-5" />
      </Link>

      <ul className="flex flex-col gap-2">
        {SECTIES.map((s) => {
          const v = voortgang.find((x) => x.sectie === s.code)!;
          const bijgewerkt = avf.sectieBijgewerkt[s.code];
          const eigenaren = eigenarenVanSectie(s.code).map((r) => rolNaam(r)).filter(Boolean).join(", ");
          return (
            <li key={s.code}>
              <Link href={`/avf/${s.code}`} className="flex min-h-aanraak items-center gap-3 rounded-han border border-rand bg-vlak p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-han bg-kop font-heading text-xl font-bold text-white">{s.code}</span>
                <span className="flex-1">
                  <span className="block font-bold text-kop">{s.naam}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2">
                    <StatusLabel status={v.status} />
                    {verzoeken.some((z) => z.sectie === s.code && z.status === "open") ? <VerzoekLabel status="open" /> : verzoeken.some((z) => z.sectie === s.code && z.status === "aangepast") ? <VerzoekLabel status="aangepast" /> : null}
                  </span>
                  <span className="mt-1 block text-sm text-zacht">Eigenaar: {eigenaren}</span>
                  {bijgewerkt && (
                    <span className="block text-sm text-zacht">
                      Laatst gewijzigd door {bijgewerkt.naam || "onbekend"} · {formatMoment(bijgewerkt.updated_at)}
                    </span>
                  )}
                </span>
                <ChevronRight aria-hidden className="size-5 text-kop" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
