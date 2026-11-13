import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, MapPinOff, TriangleAlert } from "lucide-react";
import { PaginaKop } from "@/components/PaginaKop";
import { getProfiel } from "@/lib/profiel";
import {
  laadClusterMaterialen, laadContext, laadMaterialen, locatieNaam, vraagVan, type AvfMateriaal,
} from "@/lib/materialen";
import { maakServerClient } from "@/lib/supabase/server";
import { formatTijdvak } from "@/lib/tijd";
import { CorrectieVeld, NaamVoorCorrecties } from "./CorrectieVeld";

export const metadata = { title: "Behoefte en tekorten · BackPACK_" };

const FASE_NAAM: Record<string, string> = { kop: "kop", romp: "romp", staart: "staart" };

/**
 * Behoefte en tekorten per belevenis van het cluster. Een tekort is er alleen als belevenissen op dezelfde locatie
 * tegelijk meer nodig hebben dan er ligt (VD en VC samen), of als één belevenis al meer vraagt dan de voorraad.
 */
export default async function BehoeftePagina() {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "stuurgroep" && profiel.soort !== "docent") redirect("/");
  const cluster = profiel.cluster;
  if (!cluster) redirect("/");

  const supabase = await maakServerClient();
  const [{ data: avfs }, regels, materialen, context] = await Promise.all([
    supabase.from("avf")
      .select("id, titel, locatie_keuze, locatie_detail, projectgroep:projectgroep_id(nummer, naam), programma_regel:programma_regel_id(dag, starttijd, eindtijd)")
      .eq("cluster_id", cluster.id),
    laadClusterMaterialen(cluster.id),
    laadMaterialen(),
    laadContext(cluster.id),
  ]);
  const perId = new Map(materialen.map((m) => [m.id, m]));
  const belevenissen = (avfs ?? [])
    .map((a) => {
      const pg = a.projectgroep as unknown as { nummer: number; naam: string };
      const tv = a.programma_regel as unknown as { dag: string; starttijd: string; eindtijd: string } | null;
      return { id: a.id, nummer: pg.nummer, naam: pg.naam, titel: a.titel, locatie: a.locatie_keuze, detail: a.locatie_detail, tijdvak: tv };
    })
    .sort((x, y) => x.nummer - y.nummer);

  const zonderLocatie = belevenissen.filter((b) => !b.locatie);
  const kaarten = belevenissen.map((b) => {
    const eigen = regels.filter((r) => r.avfId === b.id);
    const lijst = eigen.filter((r) => r.materiaalId);
    const perMateriaal = [...new Set(lijst.map((r) => r.materiaalId!))].map((mid) => {
      const rijen = lijst.filter((r) => r.materiaalId === mid);
      const c = context[`${b.id}:${mid}`];
      const vraag = vraagVan(rijen);
      const tk = c ? Math.max(0, vraag + c.anderen - c.voorraad) : 0;
      return { mid, naam: perId.get(mid)?.naam ?? "Materiaal", rijen, vraag, c, tk };
    });
    return { b, perMateriaal, eigenMateriaal: eigen.filter((r) => !r.materiaalId) as AvfMateriaal[] };
  });
  const tekorten = kaarten.flatMap((k) => k.perMateriaal.filter((p) => p.tk > 0).map((p) => ({ k, p })));

  return (
    <div className="flex flex-col gap-4">
      <Link href="/stuurgroep/materialen" className="flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Materialenlijst
      </Link>
      <PaginaKop titel="Behoefte en tekorten" foto="ochtend-tentterrein" />
      <p className="text-zacht">
        Materialen worden hergebruikt. Er is alleen een tekort als twee belevenissen op dezelfde locatie tegelijk te veel nodig hebben (VD en VC samen)
        of als één belevenis meer vraagt dan er ligt. Je kunt een aantal corrigeren: het getal van de groep blijft zichtbaar.
      </p>

      <section className="rounded-han border border-rand bg-vlak p-4"><NaamVoorCorrecties /></section>

      <section aria-labelledby="loc-kop" className="rounded-han border-2 border-kop bg-vlak p-4">
        <h2 id="loc-kop" className="flex items-center gap-2 text-xl"><MapPinOff aria-hidden className="size-6" /> Locatie nog niet gekozen</h2>
        {zonderLocatie.length === 0 ? (
          <p className="mt-1 text-tekst">Alle belevenissen hebben een locatie gekozen.</p>
        ) : (
          <>
            <p className="mt-1 text-tekst">Zonder locatie kunnen deze groepen geen materialen kiezen. Vraag ze snel camping of bivak te kiezen in sectie A van hun AVF.</p>
            <ul className="mt-2 list-disc pl-5 text-tekst">
              {zonderLocatie.map((b) => <li key={b.id}>{b.naam}{b.titel ? ` · ${b.titel}` : ""}</li>)}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="tekort-kop" className="rounded-han border border-rand bg-vlak p-4">
        <h2 id="tekort-kop" className="flex items-center gap-2 text-xl"><TriangleAlert aria-hidden className="size-6" /> Tekorten</h2>
        {tekorten.length === 0 ? (
          <p className="mt-1 text-tekst">Geen tekorten.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {tekorten.map(({ k, p }) => (
              <li key={`${k.b.id}-${p.mid}`} className="rounded-han border-2 border-actie p-3">
                <p className="font-bold text-kop">{p.naam}: tekort van {p.tk}</p>
                <p className="text-tekst">
                  {k.b.naam}, {locatieNaam(k.b.locatie).toLowerCase()}{k.b.tijdvak ? ` · ${formatTijdvak(k.b.tijdvak)}` : ""}.
                  Nodig {p.vraag}{p.c && p.c.anderen > 0 ? ` plus ${p.c.anderen} voor een andere belevenis op hetzelfde moment` : ""}, voorraad {p.c?.voorraad ?? 0}.
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="bel-kop" className="flex flex-col gap-3">
        <h2 id="bel-kop" className="text-xl">Per belevenis</h2>
        <ul className="flex flex-col gap-4">
          {kaarten.map(({ b, perMateriaal, eigenMateriaal }) => (
            <li key={b.id} className="rounded-han border border-rand bg-vlak p-4">
              <p className="text-sm font-medium text-zacht">{b.naam}</p>
              <h3 className="text-lg font-bold text-kop">{b.titel?.trim() || "Nog geen titel"}</h3>
              <p className="text-tekst">
                {b.locatie ? `${locatieNaam(b.locatie)}${b.detail ? ` · ${b.detail}` : ""}` : "Locatie nog niet gekozen"}
                {b.tijdvak ? ` · ${formatTijdvak(b.tijdvak)}` : " · nog niet ingepland"}
              </p>
              {perMateriaal.length === 0 && eigenMateriaal.length === 0 && <p className="mt-2 text-zacht">Nog geen materialen gekozen.</p>}
              <ul className="mt-2 flex flex-col gap-2">
                {perMateriaal.map((p) => (
                  <li key={p.mid} className={`rounded-han border-2 p-3 ${p.tk > 0 ? "border-actie" : "border-rand"}`}>
                    <p className="font-bold text-kop">{p.naam}</p>
                    <p className="text-sm text-zacht">
                      Voorraad {p.c?.voorraad ?? "?"}{p.c && p.c.anderen > 0 ? ` · anderen tegelijk ${p.c.anderen}` : ""}{p.tk > 0 ? ` · tekort ${p.tk}` : ""}
                    </p>
                    <ul className="mt-1 flex flex-col gap-2">
                      {p.rijen.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-3">
                          <span className="text-tekst">{r.fase ? FASE_NAAM[r.fase] : "hele belevenis"}</span>
                          <CorrectieVeld id={r.id} aantal={r.aantal} gecorrigeerd={r.aantalGecorrigeerd} titel={`${p.naam} ${r.fase ?? "hele belevenis"}`} />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              {eigenMateriaal.length > 0 && (
                <div className="mt-2">
                  <p className="font-bold text-kop">Eigen materiaal (telt niet mee voor de voorraad)</p>
                  <ul className="list-disc pl-5 text-tekst">{eigenMateriaal.map((r) => <li key={r.id}>{r.omschrijving}: {r.aantal}</li>)}</ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
