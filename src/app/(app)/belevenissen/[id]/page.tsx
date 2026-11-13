/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AfdrukKnop } from "@/components/avf/AfdrukKnop";
import { AvfLeesweergave } from "@/components/avf/AvfLeesweergave";
import { AvfStatusLabel } from "@/components/BelevenisKaart";
import { laadAvf } from "@/lib/avfData";
import { maakServerClient } from "@/lib/supabase/server";
import { formatTijdvak } from "@/lib/tijd";
import { themaBeeldUrl } from "@/lib/themaBeeld";

export const metadata = { title: "AVF lezen · BackPACK_" };

/**
 * Het volledige AVF om te lezen en af te drukken (PDF-01). Alleen voor de eigen projectgroep, de stuurgroep van het
 * cluster en de docent: voor alle anderen geeft de database niets terug en tonen we een 404.
 */
export default async function AvfLezen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const avf = await laadAvf(id);
  if (!avf) notFound();

  const supabase = await maakServerClient();
  const [{ data: thema }, { data: cluster }] = await Promise.all([
    supabase.from("meerdaagsethema").select("naam, slogan, sfeerbeeld_pad, logo_pad").eq("cluster_id", avf.clusterId).maybeSingle(),
    supabase.from("cluster").select("naam, code").eq("id", avf.clusterId).maybeSingle(),
  ]);
  const sfeer = themaBeeldUrl(thema?.sfeerbeeld_pad ?? "fotos/vallei-viaduct", 1600);
  const logo = themaBeeldUrl(thema?.logo_pad);

  return (
    <article className="flex flex-col gap-6">
      <Link href="/belevenissen" className="print:hidden flex min-h-aanraak items-center gap-1 font-medium text-kop">
        <ChevronLeft aria-hidden className="size-5" /> Belevenissen
      </Link>
      <AfdrukKnop />

      <header className="break-inside-avoid overflow-hidden rounded-han border border-rand">
        <div className="flex items-center justify-between gap-3 bg-vlak p-3">
          <img src="/logo/han-woordmerk-descriptor-400.png" alt="HAN University of Applied Sciences" className="h-7 w-auto" />
          <div className="flex items-center gap-2 text-right">
            {logo && <img src={logo} alt="" className="h-9 w-auto max-w-20 object-contain" />}
            <span className="font-heading text-lg font-bold text-kop">{thema?.naam || "BackPACK_"}</span>
          </div>
        </div>
        {sfeer && <img src={sfeer} alt="" className="h-40 w-full object-cover" />}
        <div className="border-t-4 border-thema bg-vlak p-4">
          <p className="text-sm font-medium text-zacht">Ardennen-meerdaagse · 28–30 juni 2027 · {cluster?.naam}</p>
          <h1 className="text-3xl">{avf.inhoud.titel?.trim() || "Nog geen titel"}</h1>
          {thema?.slogan && <p className="font-medium text-kop">{thema.slogan}</p>}
          <p className="mt-1 text-tekst">{avf.projectgroepNaam}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <AvfStatusLabel status={avf.status} />
            <span className="text-tekst">{avf.tijdvak ? formatTijdvak(avf.tijdvak) : "Nog niet ingepland"}</span>
            {avf.locatie && <span className="text-tekst">· {avf.locatie}</span>}
          </div>
        </div>
      </header>

      <AvfLeesweergave avf={avf} />
    </article>
  );
}
