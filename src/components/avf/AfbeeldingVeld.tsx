"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import type { VeldDoel } from "@/app/(app)/avf/actions";
import { useAvfEditor } from "@/components/avf/AvfEditor";
import { useVeld } from "@/components/avf/useVeld";
import { MeldingRegel, ConflictBlok } from "@/components/avf/Velden";
import { verkleinAfbeelding } from "@/lib/afbeelding";
import { maakBrowserClient } from "@/lib/supabase/client";

/**
 * Een afbeelding bij een fase (organisatietekening) of onderdeel. De foto wordt in de browser
 * verkleind (maximaal 1600 px, WebP, zonder EXIF) en daarna in de afgeschermde map van het AVF bewaard.
 * Alleen afbeeldingen, geen pdf's of Word-bestanden.
 */
export function AfbeeldingVeld({
  doel, begin, avfId, clusterId, label, prefix, uitleg,
}: {
  doel: VeldDoel;
  begin: string | null;
  avfId: string;
  clusterId: string;
  label: string;
  prefix: string;
  uitleg?: string;
}) {
  const { naam, vergrendeld } = useAvfEditor();
  const v = useVeld(doel, begin);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const pad = typeof v.opgeslagen === "string" ? v.opgeslagen : null;

  async function upload(bestand: File) {
    setFout(null);
    if (!naam.trim()) { setFout("Vul bovenaan eerst je naam in."); return; }
    setBezig(true);
    try {
      const klein = await verkleinAfbeelding(bestand, 1600);
      const nieuwPad = `cluster/${clusterId}/avf/${avfId}/${prefix}-${Date.now()}.${klein.extensie}`;
      const supabase = maakBrowserClient();
      const { error } = await supabase.storage.from("avf").upload(nieuwPad, klein.blob, { contentType: klein.blob.type, cacheControl: "31536000" });
      if (error) { setFout("Uploaden is niet gelukt. Probeer het opnieuw."); return; }
      const oud = pad;
      if (await v.opslaan(nieuwPad)) {
        if (oud) await supabase.storage.from("avf").remove([oud]);
      } else {
        await supabase.storage.from("avf").remove([nieuwPad]);
      }
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Dit bestand kan niet worden gebruikt.");
    } finally {
      setBezig(false);
    }
  }

  async function verwijder() {
    const oud = pad;
    if (await v.opslaan(null) && oud) await maakBrowserClient().storage.from("avf").remove([oud]);
  }

  return (
    <div>
      <p className="font-bold text-kop">{label}</p>
      {uitleg && <p className="text-sm text-zacht">{uitleg}</p>}
      {pad && <img src={`/api/avf/${pad}`} alt={label} className="mt-2 max-h-72 w-auto max-w-full rounded-han border border-rand object-contain" />}
      {!vergrendeld && (
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="flex min-h-aanraak cursor-pointer items-center gap-2 rounded-han bg-merk px-4 font-bold text-op-merk focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-kop">
            <ImagePlus aria-hidden className="size-5" />
            {bezig ? "Bezig…" : pad ? "Andere afbeelding" : "Afbeelding toevoegen"}
            <input
              type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={bezig}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }}
            />
          </label>
          {pad && (
            <button type="button" onClick={() => void verwijder()} className="flex min-h-aanraak items-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">
              <Trash2 aria-hidden className="size-5" /> Verwijderen
            </button>
          )}
        </div>
      )}
      <ConflictBlok conflict={v.conflict} onHun={() => v.resetNaar(v.conflict?.huidig ?? null)} onMijn={() => { if (v.conflict) void v.opslaan(v.conflict.mijn, v.conflict.huidig); }} />
      <MeldingRegel melding={v.melding} />
      {fout && <p role="alert" className="font-medium text-fout">{fout}</p>}
    </div>
  );
}
