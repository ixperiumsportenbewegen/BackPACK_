import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import { NavigatieVoortgang } from "@/components/NavigatieVoortgang";
import { BottomNav } from "@/components/BottomNav";
import { Kopbalk } from "@/components/Kopbalk";
import { getProfiel } from "@/lib/profiel";
import { kleurOpAccent } from "@/lib/thema";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profiel = await getProfiel();
  if (!profiel) redirect("/login");

  // Het meerdaagsethema overschrijft alleen de accentkleur bovenop de HAN-basis.
  const accent = profiel.thema?.accentkleur;
  const themaStijl = (
    accent && /^#[0-9A-Fa-f]{6}$/.test(accent)
      ? { "--kleur-thema": accent, "--kleur-op-thema": kleurOpAccent(accent) }
      : {}
  ) as CSSProperties;

  return (
    <div style={themaStijl} className="min-h-dvh">
      <Suspense fallback={null}><NavigatieVoortgang /></Suspense>
      <BottomNav soort={profiel.soort} />
      <div className="md:pl-60 print:pl-0">
        <Kopbalk profiel={profiel} />
        <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 md:pb-10 print:max-w-none print:p-0">{children}</main>
      </div>
      {/* Het HAN-logo staat op de laptop linksboven in de zijbalk */}
      <div className="fixed left-0 top-0 z-30 hidden h-24 w-60 items-start bg-vlak p-4 md:flex print:hidden">
        <Image
          src="/logo/han-woordmerk-descriptor-400.png"
          alt="HAN University of Applied Sciences"
          width={400}
          height={88}
          className="h-7 w-auto"
        />
      </div>
    </div>
  );
}
