import { SubmitKnop } from "@/components/SubmitKnop";
import { PaginaKop } from "@/components/PaginaKop";
import Link from "next/link";
import { CalendarClock, CalendarDays, FileText, Package, Palette, Settings, Users } from "lucide-react";
import { getProfiel } from "@/lib/profiel";
import { uitloggen } from "../actions";

export const metadata = { title: "Meer · BackPACK_" };

export default async function Meer() {
  const profiel = (await getProfiel())!;
  const teams = profiel.cluster?.teams_link;

  return (
    <div className="flex flex-col gap-4">
      <PaginaKop titel="Meer" foto="wandeling-schemer-staand" />

      <section className="rounded-han border border-rand bg-vlak p-4">
        <p className="text-sm font-medium text-zacht">Ingelogd als</p>
        <p className="font-heading text-2xl font-bold text-kop">{profiel.label}</p>
      </section>

      <Link
        href="/programma"
        className="flex min-h-aanraak items-center gap-3 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop"
      >
        <CalendarDays aria-hidden className="size-5" strokeWidth={1.75} />
        Programma van de meerdaagse
      </Link>

      {profiel.soort === "docent" && (
        <Link
          href="/beheer"
          className="flex min-h-aanraak items-center gap-3 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop"
        >
          <Settings aria-hidden className="size-5" strokeWidth={1.75} />
          Beheer: wachtwoorden, links en export
        </Link>
      )}

      {(profiel.soort === "stuurgroep" || profiel.soort === "docent") && (
        <Link
          href="/stuurgroep/beleving-thema"
          className="flex min-h-aanraak items-center gap-3 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop"
        >
          <Palette aria-hidden className="size-5" strokeWidth={1.75} />
          Meerdaagsethema instellen
        </Link>
      )}

      {(profiel.soort === "stuurgroep" || profiel.soort === "docent") && (
        <Link
          href="/stuurgroep/deadlines"
          className="flex min-h-aanraak items-center gap-3 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop"
        >
          <CalendarClock aria-hidden className="size-5" strokeWidth={1.75} />
          Deadlines instellen
        </Link>
      )}

      {(profiel.soort === "stuurgroep" || profiel.soort === "docent") && (
        <Link
          href="/stuurgroep/materialen"
          className="flex min-h-aanraak items-center gap-3 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop"
        >
          <Package aria-hidden className="size-5" strokeWidth={1.75} />
          Materialenlijst
        </Link>
      )}

      {profiel.soort === "projectgroep" && (
        <Link
          href="/avf"
          className="flex min-h-aanraak items-center gap-3 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop"
        >
          <FileText aria-hidden className="size-5" strokeWidth={1.75} />
          Jullie AVF
        </Link>
      )}

      {profiel.soort === "projectgroep" && (
        <Link
          href="/meer/rolverdeling"
          className="flex min-h-aanraak items-center gap-3 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop"
        >
          <Users aria-hidden className="size-5" strokeWidth={1.75} />
          Rolverdeling van jullie projectgroep
        </Link>
      )}

      {teams && (
        <a
          href={teams}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-aanraak items-center justify-center rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop"
        >
          Open Teams
        </a>
      )}

      <form action={uitloggen}>
        <SubmitKnop bezigTekst="Bezig met uitloggen…" className="min-h-aanraak w-full rounded-han bg-merk px-4 text-lg font-bold text-op-merk">
          Uitloggen
        </SubmitKnop>
      </form>
    </div>
  );
}
