"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Kopieert een tekst naar het klembord, zodat je hem in Teams kunt plakken. Lukt dat niet, dan toont de browser de tekst om zelf te kopiëren. */
export function KopieerKnop({ tekst, label = "Kopieer voor Teams", klein = false }: { tekst: string; label?: string; klein?: boolean }) {
  const [gedaan, setGedaan] = useState(false);
  async function kopieer() {
    try {
      await navigator.clipboard.writeText(tekst);
      setGedaan(true);
      setTimeout(() => setGedaan(false), 2500);
    } catch {
      window.prompt("Kopieer deze tekst:", tekst);
    }
  }
  return (
    <button
      type="button" onClick={() => void kopieer()}
      className={`flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop ${klein ? "text-sm" : ""}`}
    >
      {gedaan ? <Check aria-hidden className="size-5" /> : <Copy aria-hidden className="size-5" />} {gedaan ? "Gekopieerd" : label}
    </button>
  );
}
