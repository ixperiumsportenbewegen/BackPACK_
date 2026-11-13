"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

/** Een knop in een formulier met een serveractie: toont "Bezig…" en kan niet dubbel worden aangetikt. */
export function SubmitKnop({
  children, bezigTekst = "Bezig…", className, pressed,
}: { children: React.ReactNode; bezigTekst?: string; className?: string; pressed?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} aria-pressed={pressed} className={`${className ?? ""} disabled:opacity-70`}>
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2"><Loader2 aria-hidden className="size-5 animate-spin" /> {bezigTekst}</span>
      ) : children}
    </button>
  );
}
