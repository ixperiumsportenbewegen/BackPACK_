"use client";

import { Printer } from "lucide-react";

export function AfdrukKnop() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden flex min-h-aanraak items-center justify-center gap-2 rounded-han bg-merk px-4 font-bold text-op-merk"
    >
      <Printer aria-hidden className="size-5" /> Afdrukken of opslaan als PDF
    </button>
  );
}
