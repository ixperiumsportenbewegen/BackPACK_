import { SubmitKnop } from "@/components/SubmitKnop";
import { PaginaKop } from "@/components/PaginaKop";
import Link from "next/link";
import { Backpack, CalendarClock, CalendarDays, FileText, MessageSquare, Mountain, Package, Palette, Settings, Siren, Users, UsersRound, type LucideIcon } from "lucide-react";
import { zichtbareBergtoppen } from "@/lib/bergtoppen";
import { getProfiel } from "@/lib/profiel";
import { uitloggen } from "../actions";

export const metadata = { title: "Meer · BackPACK_" };

const KNOP = "flex min-h-aanraak items-center gap-3 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop";

function MeerLink({ href, icoon: Icoon, children, opvallend = false }: { href: string; icoon: LucideIcon; children: React.ReactNode; opvallend?: boolean }) {
  return (
    <Link href={href} className={opvallend ? KNOP.replace("border-kop", "border-merk") : KNOP}>
      <Icoon aria-hidden className={`size-5 ${opvallend ? "text-merk" : ""}`} strokeWidth={1.75} />
      {children}
    </Link>
  );
}

/** Een groep knoppen onder een eigen kopje, zodat Meer overzichtelijk blijft. */
function Groep({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section aria-label={titel} className="flex flex-col gap-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-zacht">{titel}</h2>
      {children}
    </section>
  );
}

export default async function Meer() {
  const profiel = (await getProfiel())!;
  const teams = profiel.cluster?.teams_link;
  const bergtoppen = profiel.cluster ? await zichtbareBergtoppen(profiel.cluster.id) : null;
  const stuurgroep = profiel.soort === "stuurgroep" || profiel.soort === "docent";

  return (
    <div className="flex flex-col gap-6">
      <PaginaKop titel="Meer" foto="wandeling-schemer-staand" />

      <section className="rounded-han border border-rand bg-vlak p-4">
        <p className="text-sm font-medium text-zacht">Ingelogd als</p>
        <p className="font-heading text-2xl font-bold text-kop">{profiel.label}</p>
      </section>

      <Groep titel="Praktisch voor iedereen">
        <MeerLink href="/meer/calamiteitenplan" icoon={Siren} opvallend>Calamiteitenplan (incl. EHBO)</MeerLink>
        <MeerLink href="/meer/paklijst" icoon={Backpack}>Persoonlijke paklijst</MeerLink>
        {bergtoppen && <MeerLink href="/bergtoppen" icoon={Mountain}>De 10 bergtoppen (afspraken)</MeerLink>}
        <MeerLink href="/programma" icoon={CalendarDays}>Programma van de meerdaagse</MeerLink>
        <MeerLink href="/meer/stuurgroep" icoon={UsersRound}>Stuurgroep: onderwerpen en leden</MeerLink>
        {teams && (
          <a
            href={teams}
            target="_blank"
            rel="noopener noreferrer"
            className={KNOP}
          >
            <MessageSquare aria-hidden className="size-5" strokeWidth={1.75} />
            Open Teams
          </a>
        )}
      </Groep>

      {profiel.soort === "projectgroep" && (
        <Groep titel="Jullie projectgroep">
          <MeerLink href="/avf" icoon={FileText}>Jullie AVF</MeerLink>
          <MeerLink href="/meer/rolverdeling" icoon={Users}>Rolverdeling van jullie projectgroep</MeerLink>
        </Groep>
      )}

      {stuurgroep && (
        <Groep titel="Voor de stuurgroep">
          <MeerLink href="/stuurgroep/beleving-thema" icoon={Palette}>Meerdaagsethema instellen</MeerLink>
          <MeerLink href="/stuurgroep/deadlines" icoon={CalendarClock}>Deadlines instellen</MeerLink>
          <MeerLink href="/stuurgroep/materialen" icoon={Package}>Materialenlijst</MeerLink>
        </Groep>
      )}

      {profiel.soort === "docent" && (
        <Groep titel="Docent">
          <MeerLink href="/beheer" icoon={Settings}>Beheer: wachtwoorden, links en export</MeerLink>
        </Groep>
      )}

      <form action={uitloggen}>
        <SubmitKnop bezigTekst="Bezig met uitloggen…" className="min-h-aanraak w-full rounded-han bg-merk px-4 text-lg font-bold text-op-merk">
          Uitloggen
        </SubmitKnop>
      </form>
    </div>
  );
}
