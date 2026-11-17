"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mountain } from "lucide-react";
import {
  bergtopVeldOpslaan, bergtoppenIntrekken, bergtoppenPubliceren, inschrijfLinkOpslaan, type PubliceerResultaat,
} from "@/app/(app)/bergtoppen-actions";
import type { PlanResultaat } from "@/app/(app)/calamiteitenplan-actions";
import { OpslaanVeld, usePlanNaam } from "@/components/plan/PlanEditor";
import { BERGTOP_MAX, toppenNummers, topSleutel } from "@/config/bergtoppen";
import { bergtoppenOntbreekt, conceptVerschilt, toppenIngevuld, type BergtoppenInhoud } from "@/lib/bergtoppenStatus";

interface Props {
  clusterId: string;
  clusterNaam: string;
  velden: Record<string, string>;
  inschrijfLink: string | null;
  publicatie: { versie: number; zichtbaar: boolean; gepubliceerdOp: string; gepubliceerdDoor: string | null; inhoud: BergtoppenInhoud } | null;
}

/** Het invulformulier van de 10 bergtoppen: titel en afspraak per top, een toelichting, de link naar het inschrijfformulier en publiceren. */
export function BergtoppenFormulier({ clusterId, velden, inschrijfLink, publicatie, clusterNaam }: Props) {
  const opslaan = (sleutel: string) => (oud: string, nieuw: string, naam: string) => bergtopVeldOpslaan(clusterId, sleutel, oud, nieuw, naam);

  return (
    <div className="flex flex-col gap-4">
      <PubliceerPaneel clusterId={clusterId} clusterNaam={clusterNaam} velden={velden} publicatie={publicatie} />

      <ol className="flex flex-col gap-4">
        {toppenNummers.map((n) => (
          <li key={n}>
            <section aria-labelledby={`top-kop-${n}`} className="flex flex-col gap-2 rounded-han border border-rand bg-vlak p-4">
              <h2 id={`top-kop-${n}`} className="flex items-center gap-2 text-xl">
                <Mountain aria-hidden className="size-5" /> Top {n}
              </h2>
              <OpslaanVeld
                id={`top-${n}-titel`} label={`Titel van top ${n}`} hulp="Een korte, krachtige naam, bijvoorbeeld een kernwoord."
                soort="kort" maxLengte={BERGTOP_MAX.titel} begin={velden[topSleutel(n, "titel")] ?? null} opslaan={opslaan(topSleutel(n, "titel"))}
              />
              <OpslaanVeld
                id={`top-${n}-afspraak`} label={`Afspraak van top ${n}`} hulp="Wat spreken we met elkaar af? Schrijf het concreet, in een of twee zinnen."
                soort="lang" maxLengte={BERGTOP_MAX.afspraak} begin={velden[topSleutel(n, "afspraak")] ?? null} opslaan={opslaan(topSleutel(n, "afspraak"))}
              />
            </section>
          </li>
        ))}
      </ol>

      <section aria-labelledby="toelichting-kop" className="flex flex-col gap-2 rounded-han border border-rand bg-vlak p-4">
        <h2 id="toelichting-kop" className="text-xl">Toelichting onder de toppen</h2>
        <p className="text-sm text-zacht">Een tekstblok onder de 10 toppen, bijvoorbeeld over het dal: wat doen we als het even niet goed gaat?</p>
        <OpslaanVeld
          id="toelichting-titel" label="Titel van de toelichting" soort="kort" maxLengte={BERGTOP_MAX.toelichtingTitel}
          begin={velden.toelichting_titel ?? null} opslaan={opslaan("toelichting_titel")}
        />
        <OpslaanVeld
          id="toelichting" label="Toelichting" soort="lang" maxLengte={BERGTOP_MAX.toelichting}
          begin={velden.toelichting ?? null} opslaan={opslaan("toelichting")}
        />
      </section>

      <section aria-labelledby="inschrijf-kop" className="flex flex-col gap-2 rounded-han border border-rand bg-vlak p-4">
        <h2 id="inschrijf-kop" className="text-xl">Ondertekenen</h2>
        <p className="text-sm text-zacht">
          Studenten ondertekenen de afspraken in het inschrijfformulier. BackPACK_ linkt alleen door; er worden geen namen of handtekeningen bewaard.
        </p>
        <InschrijfLinkVeld clusterId={clusterId} begin={inschrijfLink} />
      </section>
    </div>
  );
}

function InschrijfLinkVeld({ clusterId, begin }: { clusterId: string; begin: string | null }) {
  return (
    <OpslaanVeld
      id="inschrijf-link" label="Link naar het inschrijfformulier" soort="link" maxLengte={1000} begin={begin}
      hulp="Een link die begint met https://. Laat leeg als het formulier er nog niet is: studenten zien dan dat de link volgt."
      opslaan={(_oud, nieuw, naam) => inschrijfLinkOpslaan(clusterId, nieuw, naam)}
    />
  );
}

function PubliceerPaneel({ clusterId, clusterNaam, velden, publicatie }: Pick<Props, "clusterId" | "clusterNaam" | "velden" | "publicatie">) {
  const router = useRouter();
  const { naam } = usePlanNaam();
  const [bezig, setBezig] = useState(false);
  const [bericht, setBericht] = useState<{ fout: boolean; tekst: string } | null>(null);

  const ontbreekt = bergtoppenOntbreekt(velden);
  const klaar = ontbreekt.length === 0;
  const gepubliceerd = publicatie?.zichtbaar === true;
  const verschilt = gepubliceerd && conceptVerschilt(velden, publicatie!.inhoud);
  const ingevuld = toppenIngevuld(velden);

  async function uitvoeren(actie: () => Promise<PlanResultaat | PubliceerResultaat>, ok: string) {
    setBericht(null);
    if (!naam.trim()) return setBericht({ fout: true, tekst: "Vul bovenaan eerst je naam in." });
    setBezig(true);
    const res = await actie();
    setBezig(false);
    if (res.status === "ok") {
      setBericht({ fout: false, tekst: ok });
      router.refresh();
    } else setBericht({ fout: true, tekst: res.status === "fout" ? res.melding : "Iemand anders was net bezig. Probeer het opnieuw." });
  }

  let status: string;
  if (!gepubliceerd && publicatie) status = `Ingetrokken: studenten zien de bergtoppen niet. Laatst gepubliceerd was versie ${publicatie.versie}.`;
  else if (!gepubliceerd) status = klaar ? "Alles is ingevuld. Studenten zien de bergtoppen pas als jullie ze publiceren." : `Nog niet gepubliceerd. ${ingevuld} van de 10 toppen zijn ingevuld.`;
  else if (verschilt) status = `Gepubliceerd (versie ${publicatie!.versie}). Jullie concept wijkt af: studenten zien nog de vorige versie tot je opnieuw publiceert.`;
  else status = `Gepubliceerd (versie ${publicatie!.versie}) en het concept is gelijk aan wat studenten zien.`;

  return (
    <section aria-labelledby="publiceer-kop" className="flex flex-col gap-3 rounded-han border-2 border-kop bg-vlak p-4">
      <h2 id="publiceer-kop" className="text-xl">Publiceren</h2>
      <p data-testid="bergtoppen-status" className="text-tekst">{status}</p>
      {!klaar && <p className="text-sm text-zacht">Nog nodig voor publiceren: {ontbreekt.join(", ")}.</p>}
      {bericht && <p role={bericht.fout ? "alert" : "status"} className={`font-bold ${bericht.fout ? "text-fout" : "text-kop"}`}>{bericht.tekst}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button" disabled={bezig || !klaar || (gepubliceerd && !verschilt)}
          onClick={() => void uitvoeren(() => bergtoppenPubliceren(clusterId, naam), "Gepubliceerd. Studenten van het cluster zien nu deze versie.")}
          className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60"
        >
          {bezig ? "Bezig…" : gepubliceerd ? "Opnieuw publiceren" : "Publiceren voor " + clusterNaam}
        </button>
        {gepubliceerd && (
          <button
            type="button" disabled={bezig}
            onClick={() => void uitvoeren(() => bergtoppenIntrekken(clusterId, naam), "Ingetrokken. Studenten zien de bergtoppen niet meer.")}
            className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop disabled:opacity-60"
          >
            Intrekken
          </button>
        )}
      </div>
    </section>
  );
}
