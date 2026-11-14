"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { clusterLinksOpslaan, wachtwoordResetten } from "./actions";

const INVOER = "min-h-aanraak w-full rounded-han border-2 border-zacht bg-vlak px-3 text-base text-tekst";

export interface AccountRij {
  id: string;
  gebruikersnaam: string;
  label: string;
  soort: "stuurgroep" | "projectgroep" | "student";
}

export interface ClusterBeheer {
  id: string;
  code: string;
  naam: string;
  teamsLink: string | null;
  formsLink: string | null;
  accounts: AccountRij[];
}

/** De inloggegevens als korte tekst die de docent in Teams kan plakken voor de betreffende groep. */
function deeltekst(gebruikersnaam: string, wachtwoord: string): string {
  const site = typeof window !== "undefined" ? window.location.origin : "";
  return `BackPACK_ inloggen\nWebsite: ${site}\nGebruikersnaam: ${gebruikersnaam}\nWachtwoord: ${wachtwoord}\nLaat "Ingelogd blijven" aanstaan. Deel dit alleen met jullie eigen groep.`;
}

function KopieerKnop({ tekst }: { tekst: string }) {
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
    <button type="button" onClick={() => void kopieer()} className="flex min-h-aanraak items-center justify-center gap-2 rounded-han bg-merk px-4 font-bold text-op-merk">
      {gedaan ? <Check aria-hidden className="size-5" /> : <Copy aria-hidden className="size-5" />} {gedaan ? "Gekopieerd" : "Kopieer voor Teams"}
    </button>
  );
}

function Account({ a }: { a: AccountRij }) {
  const router = useRouter();
  const [bevestig, setBevestig] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [nieuw, setNieuw] = useState<string | null>(null);

  async function reset() {
    setFout(null);
    setBezig(true);
    const res = await wachtwoordResetten(a.id);
    setBezig(false);
    setBevestig(false);
    if (res.status === "ok") { setNieuw(res.wachtwoord); router.refresh(); } else setFout(res.melding);
  }

  return (
    <li className="rounded-han border border-rand bg-vlak p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold text-kop">{a.label}</p>
          <p className="text-sm text-zacht">{a.gebruikersnaam}</p>
        </div>
        {!bevestig && nieuw === null && (
          <button type="button" onClick={() => setBevestig(true)} className="flex min-h-aanraak items-center gap-2 rounded-han border-2 border-kop bg-vlak px-3 text-sm font-bold text-kop">
            <KeyRound aria-hidden className="size-4" /> Wachtwoord resetten
          </button>
        )}
      </div>
      {bevestig && (
        <div role="alert" className="mt-2 rounded-han border-2 border-kop p-3">
          <p className="font-bold text-kop">Nieuw wachtwoord voor {a.gebruikersnaam}?</p>
          <p className="text-tekst">Iedereen die nu met dit account is ingelogd, moet daarna opnieuw inloggen.</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => void reset()} disabled={bezig} className="flex min-h-aanraak items-center gap-2 rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">
              {bezig && <Loader2 aria-hidden className="size-5 animate-spin" />} {bezig ? "Bezig…" : "Ja, resetten"}
            </button>
            <button type="button" onClick={() => setBevestig(false)} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">Nee</button>
          </div>
        </div>
      )}
      {fout && <p role="alert" className="mt-2 font-bold text-fout">{fout}</p>}
      {nieuw !== null && (
        <div role="status" className="mt-2 rounded-han border-2 border-goedgekeurd p-3">
          <p className="text-sm font-medium text-zacht">Nieuw wachtwoord (je ziet het maar één keer)</p>
          <p className="font-mono text-2xl font-bold text-kop" data-testid="nieuw-wachtwoord">{nieuw}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <KopieerKnop tekst={deeltekst(a.gebruikersnaam, nieuw)} />
            <button type="button" onClick={() => setNieuw(null)} className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop">Klaar, verberg</button>
          </div>
        </div>
      )}
    </li>
  );
}

function Links({ c }: { c: ClusterBeheer }) {
  const router = useRouter();
  const [teams, setTeams] = useState(c.teamsLink ?? "");
  const [forms, setForms] = useState(c.formsLink ?? "");
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<{ fout: boolean; tekst: string } | null>(null);

  async function bewaar(e: React.FormEvent) {
    e.preventDefault();
    setMelding(null);
    setBezig(true);
    const res = await clusterLinksOpslaan(c.id, teams, forms);
    setBezig(false);
    if (res.status === "ok") { setMelding({ fout: false, tekst: "Opgeslagen" }); router.refresh(); } else setMelding({ fout: true, tekst: res.melding });
  }

  return (
    <form onSubmit={bewaar} className="flex flex-col gap-3 rounded-han border border-rand bg-vlak p-4">
      <h3 className="text-lg font-bold text-kop">Links van {c.naam}</h3>
      <label className="flex flex-col gap-1 font-medium text-kop">
        Teams-link
        <input value={teams} onChange={(e) => setTeams(e.target.value)} placeholder="https://teams.microsoft.com/…" inputMode="url" autoComplete="off" className={`${INVOER} font-normal`} />
      </label>
      <label className="flex flex-col gap-1 font-medium text-kop">
        Forms-link voor declaraties
        <input value={forms} onChange={(e) => setForms(e.target.value)} placeholder="https://forms.office.com/…" inputMode="url" autoComplete="off" className={`${INVOER} font-normal`} />
        <span className="text-sm font-normal text-zacht">De stuurgroep Communicatie &amp; Financiën van dit cluster kan deze link ook zelf instellen.</span>
      </label>
      <button type="submit" disabled={bezig} className="flex min-h-aanraak items-center justify-center gap-2 rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60">
        {bezig && <Loader2 aria-hidden className="size-5 animate-spin" />} {bezig ? "Bezig…" : "Links opslaan"}
      </button>
      {melding && <p role={melding.fout ? "alert" : "status"} className={`font-medium ${melding.fout ? "text-fout" : "text-kop"}`}>{melding.tekst}</p>}
    </form>
  );
}

/** Beheer voor de docent: links per cluster en wachtwoorden resetten per account. */
export function BeheerPaneel({ clusters }: { clusters: ClusterBeheer[] }) {
  return (
    <div className="flex flex-col gap-6">
      {clusters.map((c) => (
        <section key={c.id} aria-labelledby={`cluster-${c.code}`} className="flex flex-col gap-3">
          <h2 id={`cluster-${c.code}`} className="text-2xl">{c.naam} <span className="text-base font-normal text-zacht">({c.code})</span></h2>
          <Links c={c} />
          <details className="rounded-han border border-rand bg-vlak">
            <summary className="flex min-h-aanraak cursor-pointer items-center px-4 font-bold text-kop">Accounts en wachtwoorden ({c.accounts.length})</summary>
            <ul className="flex flex-col gap-2 border-t border-rand p-3">
              {c.accounts.map((a) => <Account key={a.id} a={a} />)}
            </ul>
          </details>
        </section>
      ))}
    </div>
  );
}
