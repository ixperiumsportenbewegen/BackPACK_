"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { losseAanvraagMaken } from "@/app/(app)/budget-actions";
import { NaamVeld, useNaam } from "@/components/NaamVeld";

/** Start een losse aanvraag voor extra kosten (alleen na goedkeuring van het AVF). */
export function LosseAanvraagStarten() {
  const router = useRouter();
  const [naam, setNaam] = useNaam();
  const [omschrijving, setOmschrijving] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    setBezig(true);
    const res = await losseAanvraagMaken(omschrijving, naam);
    setBezig(false);
    if (res.status === "ok") { setOmschrijving(""); router.refresh(); } else setFout(res.melding);
  }

  return (
    <form onSubmit={start} className="flex flex-col gap-3 rounded-han border-2 border-kop bg-vlak p-4">
      <h2 className="text-xl">Losse aanvraag</h2>
      <p className="text-sm text-zacht">Voor extra kosten na de goedkeuring van jullie AVF. Eerst beschrijf je waarvoor, daarna vul je de bedragen in en dien je in.</p>
      <NaamVeld naam={naam} setNaam={setNaam} label="Wie werkt hier? (jouw naam)" />
      <label className="flex flex-col gap-1 font-medium text-kop">
        Waarvoor?
        <input value={omschrijving} onChange={(e) => setOmschrijving(e.target.value)} maxLength={150} placeholder="Bijvoorbeeld: extra materiaal voor de romp" className="min-h-aanraak rounded-han border-2 border-zacht bg-vlak px-3 text-base font-normal text-tekst" />
      </label>
      {fout && <p role="alert" className="font-bold text-fout">{fout}</p>}
      <button type="submit" disabled={bezig} className="flex min-h-aanraak items-center justify-center gap-2 rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">
        {bezig ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Plus aria-hidden className="size-5" />} {bezig ? "Bezig…" : "Losse aanvraag starten"}
      </button>
    </form>
  );
}
