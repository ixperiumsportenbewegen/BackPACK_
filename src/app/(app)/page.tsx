/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ChevronRight, CircleDashed } from "lucide-react";
import { STUURGROEPROL_VOLGORDE } from "@/config/projectgroeprollen";
import { getProfiel } from "@/lib/profiel";
import { maakServerClient } from "@/lib/supabase/server";
import { STANDAARD_SFEERBEELD, themaBeeldUrl } from "@/lib/themaBeeld";
import { kiesCluster } from "./actions";

const STARTDATUM = new Date("2027-06-28T00:00:00+02:00");

function dagenTot(datum: Date): number {
  return Math.ceil((datum.getTime() - Date.now()) / 86_400_000);
}

export default async function OnzeMeerdaagse() {
  const profiel = (await getProfiel())!;
  const thema = profiel.thema;
  const heeftThema = Boolean(thema?.naam);
  const dagen = dagenTot(STARTDATUM);
  const supabase = await maakServerClient();
  const { data: groepen } = await supabase
    .from("projectgroep").select("id, nummer, naam").eq("cluster_id", profiel.cluster?.id ?? "").order("nummer");
  const toonStand = profiel.soort === "stuurgroep" || profiel.soort === "docent";
  const { data: rollen } = toonStand
    ? await supabase.from("stuurgroeprol").select("code, naam").eq("cluster_id", profiel.cluster?.id ?? "")
    : { data: null };
  const rollenGesorteerd = [...(rollen ?? [])].sort(
    (a, b) => STUURGROEPROL_VOLGORDE.indexOf(a.code) - STUURGROEPROL_VOLGORDE.indexOf(b.code),
  );
  const sfeer = themaBeeldUrl(thema?.sfeerbeeld_pad ?? STANDAARD_SFEERBEELD, 1600);

  return (
    <div className="flex flex-col gap-6">
      {profiel.soort === "docent" && (
        <section aria-label="Cluster kiezen">
          <p className="mb-2 text-sm font-medium text-zacht">Cluster</p>
          <div className="flex gap-2">
            {profiel.alleClusters.map((c) => {
              const actief = c.code === profiel.cluster?.code;
              return (
                <form key={c.code} action={kiesCluster} className="flex-1">
                  <input type="hidden" name="code" value={c.code} />
                  <button
                    type="submit"
                    aria-pressed={actief}
                    className={`min-h-aanraak w-full rounded-han border-2 px-3 font-bold ${
                      actief ? "border-merk bg-merk text-op-merk" : "border-rand bg-vlak text-kop"
                    }`}
                  >
                    {c.code}
                  </button>
                </form>
              );
            })}
          </div>
        </section>
      )}

      <section className="relative overflow-hidden rounded-han bg-kop text-white">
        {sfeer && <img src={sfeer} alt="" className="absolute inset-0 size-full object-cover opacity-60" />}
        <div className="relative flex min-h-56 flex-col justify-end gap-2 bg-gradient-to-t from-black/80 to-transparent p-4">
          <h1 className="text-3xl !text-white">{heeftThema ? thema!.naam : "Kies jullie meerdaagsethema"}</h1>
          {heeftThema && thema!.verhaal && <p className="text-white">{thema!.verhaal}</p>}
          {heeftThema && thema!.slogan && <p className="font-medium text-white">{thema!.slogan}</p>}
        </div>
      </section>

      <section className="rounded-han border border-rand bg-vlak p-4">
        <p className="text-sm font-medium text-zacht">Ardennen-meerdaagse · 28–30 juni 2027</p>
        <p className="mt-1 font-heading text-3xl font-bold text-kop">
          {dagen > 0 ? `Nog ${dagen} dagen` : "Het is zover"}
        </p>
      </section>

      <section aria-labelledby="belevenissen-kop" className="flex flex-col gap-3">
        <div className="flex items-end justify-between">
          <h2 id="belevenissen-kop" className="text-xl">Belevenissen</h2>
          <Link href="/belevenissen" className="flex min-h-aanraak items-center font-medium text-kop underline">
            Alles bekijken
          </Link>
        </div>
        <p className="text-zacht">
          Jullie BackPACK_ is nog leeg. Zodra de projectgroepen hun belevenis invullen, verschijnt die hier.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {(groepen ?? []).map((g) => (
            <li key={g.id}>
              <Link
                href="/belevenissen"
                className="flex min-h-aanraak items-center gap-3 rounded-han border border-rand bg-vlak p-4"
              >
                <span className="flex-1">
                  <span className="block font-bold text-kop">{g.naam}</span>
                  <span className="block text-sm text-zacht">Nog geen belevenis ingevuld</span>
                  <span className="mt-1 inline-flex items-center gap-1 rounded-han bg-rand px-2 py-0.5 text-xs font-bold text-kop">
                    <CircleDashed aria-hidden className="size-3.5" /> In ontwikkeling
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-5 text-kop" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {profiel.soort === "projectgroep" && (
        <section aria-label="Snel naar" className="grid gap-3 sm:grid-cols-2">
          <Link href="/meer/rolverdeling" className="flex min-h-aanraak items-center justify-between rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
            Rolverdeling invullen <ChevronRight aria-hidden className="size-5" />
          </Link>
          <Link href="/budget" className="flex min-h-aanraak items-center justify-between rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
            Budget <ChevronRight aria-hidden className="size-5" />
          </Link>
        </section>
      )}

      {toonStand && (
        <section aria-labelledby="stand-kop" className="rounded-han border border-rand bg-vlak p-4">
          <h2 id="stand-kop" className="text-xl">Stand van zaken per rol</h2>
          <ul className="mt-2 divide-y divide-rand">
            {rollenGesorteerd.map((r) => (
              <li key={r.code} className="flex items-center justify-between gap-3 py-3">
                <span className="font-medium text-kop">{r.naam}</span>
                <span className="text-sm text-zacht">Nog niets te melden</span>
              </li>
            ))}
          </ul>
          <Link href="/stuurgroep" className="mt-2 flex min-h-aanraak items-center font-bold text-kop underline">
            Naar de werkpagina&apos;s
          </Link>
        </section>
      )}
    </div>
  );
}
