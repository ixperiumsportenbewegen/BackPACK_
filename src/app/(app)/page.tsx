import { SubmitKnop } from "@/components/SubmitKnop";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { BelevenisKaart } from "@/components/BelevenisKaart";
import { JullieAvfBlok } from "@/components/JullieAvfBlok";
import { STUURGROEPROL_VOLGORDE } from "@/config/projectgroeprollen";
import { laadEigenAvf, laadKaarten } from "@/lib/avfData";
import { laadStanden } from "@/lib/beoordeling";
import { euro, laadClusterBudget, laadResterend } from "@/lib/budget";
import { getProfiel } from "@/lib/profiel";
import { dagenTot } from "@/lib/tijd";
import { maakServerClient } from "@/lib/supabase/server";
import { STANDAARD_SFEERBEELD, themaBeeldUrl } from "@/lib/themaBeeld";
import { kiesCluster } from "./actions";

const STARTDAG = "2027-06-28"; // eerste dag van de meerdaagse

export default async function OnzeMeerdaagse() {
  const profiel = (await getProfiel())!;
  const thema = profiel.thema;
  const heeftThema = Boolean(thema?.naam);
  const dagen = dagenTot(STARTDAG);
  const supabase = await maakServerClient();
  const kaarten = profiel.cluster ? await laadKaarten(profiel.cluster.id) : [];
  const eigenAvf = profiel.soort === "projectgroep" ? await laadEigenAvf() : null;
  const toonStand = profiel.soort === "stuurgroep" || profiel.soort === "docent";
  const { data: rollen } = toonStand
    ? await supabase.from("stuurgroeprol").select("code, naam").eq("cluster_id", profiel.cluster?.id ?? "")
    : { data: null };
  const rollenGesorteerd = [...(rollen ?? [])].sort(
    (a, b) => STUURGROEPROL_VOLGORDE.indexOf(a.code) - STUURGROEPROL_VOLGORDE.indexOf(b.code),
  );
  const standen = toonStand && profiel.cluster ? Object.values(await laadStanden(profiel.cluster.id)) : [];
  const wachten = standen.filter((s) => s.status === "ingediend" || s.opnieuwTeControleren).length;
  const openVerzoeken = standen.reduce((n, s) => n + s.open, 0);
  const zonderLocatie = toonStand && profiel.cluster
    ? ((await supabase.from("avf").select("id").eq("cluster_id", profiel.cluster.id).is("locatie_keuze", null)).data ?? []).length
    : 0;
  const openAanvragen = toonStand && profiel.cluster
    ? ((await supabase.from("materiaal_aanvraag").select("id, avf:avf_id!inner(cluster_id)").eq("status", "open").eq("avf.cluster_id", profiel.cluster.id)).data ?? []).length
    : 0;
  const budgetOpen = toonStand && profiel.cluster
    ? ((await supabase.from("budgetaanvraag").select("id").eq("cluster_id", profiel.cluster.id).eq("status", "aangevraagd")).data ?? []).length
    : 0;
  const budgetTotaal = toonStand && profiel.cluster ? await laadClusterBudget(profiel.cluster.id) : null;
  const budgetRest = toonStand && profiel.cluster ? await laadResterend(profiel.cluster.id) : null;
  const regelVoor = (code: string): string => {
    if (code === "communicatie_financien") {
      return [
        budgetRest !== null && budgetTotaal !== null ? `Budget: ${euro(budgetRest)} van ${euro(budgetTotaal)} vrij` : null,
        budgetOpen > 0 ? `${budgetOpen} ${budgetOpen === 1 ? "aanvraag wacht" : "aanvragen wachten"} op een besluit` : null,
      ].filter(Boolean).join(" · ") || "Nog niets te melden";
    }
    if (code === "logistiek_facilitair") return [
      zonderLocatie > 0 ? `${zonderLocatie} ${zonderLocatie === 1 ? "belevenis heeft" : "belevenissen hebben"} nog geen locatie` : "Alle locaties gekozen",
      openAanvragen > 0 ? `${openAanvragen} open materiaalaanvraag${openAanvragen === 1 ? "" : "en"}` : null,
    ].filter(Boolean).join(" · ");
    if (code !== "programma_kwaliteit" && code !== "projectleiding") return "Nog niets te melden";
    const delen = [
      wachten > 0 ? `${wachten} ${wachten === 1 ? "AVF wacht" : "AVF's wachten"} op beoordeling` : null,
      openVerzoeken > 0 ? `${openVerzoeken} open ${openVerzoeken === 1 ? "verbeterverzoek" : "verbeterverzoeken"}` : null,
    ].filter(Boolean);
    return delen.length ? delen.join(" · ") : "Niets te beoordelen";
  };
  const sfeer = themaBeeldUrl(thema?.sfeerbeeld_pad ?? STANDAARD_SFEERBEELD, 1600);

  return (
    <div className="flex flex-col gap-6">
      {profiel.soort === "docent" && (
        <section id="cluster" aria-label="Cluster kiezen" className="scroll-mt-24">
          <p className="mb-2 text-sm font-medium text-zacht">Cluster</p>
          <div className="flex gap-2">
            {profiel.alleClusters.map((c) => {
              const actief = c.code === profiel.cluster?.code;
              return (
                <form key={c.code} action={kiesCluster} className="flex-1">
                  <input type="hidden" name="code" value={c.code} />
                  <SubmitKnop
                    pressed={actief} bezigTekst="Bezig…"
                    className={`min-h-aanraak w-full rounded-han border-2 px-3 font-bold ${
                      actief ? "border-merk bg-merk text-op-merk" : "border-rand bg-vlak text-kop"
                    }`}
                  >
                    {c.code}
                  </SubmitKnop>
                </form>
              );
            })}
          </div>
        </section>
      )}

      {/* Zonder thema is het eigen AVF het belangrijkste: dat staat dan bovenaan. */}
      {eigenAvf && !heeftThema && <JullieAvfBlok avf={eigenAvf} />}

      <section className="relative overflow-hidden rounded-han bg-kop text-white" data-testid="thema-blok">
        {sfeer && <img src={sfeer} alt="" className="absolute inset-0 size-full object-cover opacity-60" />}
        <div className={`relative flex ${heeftThema ? "min-h-56" : "min-h-28"} flex-col justify-end gap-2 bg-gradient-to-t from-black/80 to-transparent p-4`}>
          <h1 className={`${heeftThema ? "text-3xl" : "text-2xl"} !text-white`}>{heeftThema ? thema!.naam : "Meerdaagsethema nog niet gekozen"}</h1>
          {!heeftThema && (
            <p className="text-sm text-white">
              Jullie meerdaagsethema is nog niet gekozen en nog niet ingevuld. De stuurgroep (Beleving & Thema) kiest het thema.
              Zodra dat is gebeurd, zie je hier de naam, het verhaal en het sfeerbeeld.
            </p>
          )}
          {!heeftThema && (profiel.soort === "stuurgroep" || profiel.soort === "docent") && (
            <Link
              href="/stuurgroep/beleving-thema"
              className="mt-1 flex min-h-aanraak items-center justify-center rounded-han bg-white px-4 font-bold text-kop"
            >
              Thema kiezen
            </Link>
          )}
          {heeftThema && thema!.verhaal && <p className="text-white">{thema!.verhaal}</p>}
          {heeftThema && thema!.slogan && <p className="font-medium text-white">{thema!.slogan}</p>}
        </div>
      </section>

      <section className="rounded-han border border-rand bg-vlak p-4">
        <p className="text-sm font-medium text-zacht">Ardennen-meerdaagse · 28–30 juni 2027</p>
        <p className="mt-1 font-heading text-3xl font-bold text-kop">
          {dagen > 0 ? `Nog ${dagen} ${dagen === 1 ? "dag" : "dagen"}` : "Het is zover"}
        </p>
      </section>

      {eigenAvf && heeftThema && <JullieAvfBlok avf={eigenAvf} />}

      <section aria-labelledby="belevenissen-kop" className="flex flex-col gap-3">
        <div className="flex items-end justify-between">
          <h2 id="belevenissen-kop" className="text-xl">Belevenissen</h2>
          <Link href="/belevenissen" className="flex min-h-aanraak items-center font-medium text-kop underline">
            Alles bekijken
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {kaarten.map((k) => (
            <li key={k.id}>
              <BelevenisKaart k={k} />
            </li>
          ))}
        </ul>
        <Link href="/programma" className="flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
          <CalendarDays aria-hidden className="size-5" /> Bekijk het programma
        </Link>
      </section>

      {profiel.soort === "projectgroep" && (
        <section aria-label="Snel naar" className="grid gap-3 sm:grid-cols-2">
          <Link href="/meer/rolverdeling" className="flex min-h-aanraak items-center justify-between rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
            {eigenAvf && eigenAvf.inhoud.rollenIngevuld >= 6 ? "Rolverdeling bekijken" : "Rolverdeling invullen"} <ChevronRight aria-hidden className="size-5" />
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
                <Link href={`/stuurgroep/rol/${r.code}`} className="flex min-h-aanraak items-center font-medium text-kop underline">{r.naam}</Link>
                <span className="text-right text-sm text-zacht">{regelVoor(r.code)}</span>
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
