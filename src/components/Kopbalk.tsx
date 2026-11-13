/* eslint-disable @next/next/no-img-element */
import Image from "next/image";
import { Woordmerk } from "@/components/Woordmerk";
import type { Profiel } from "@/lib/profiel";
import { themaBeeldUrl } from "@/lib/themaBeeld";

/** Witte kopbalk: HAN-logo links, thema (naam en logo) of BackPACK_ en accountlabel rechts, accentbalk onderaan. */
export function Kopbalk({ profiel }: { profiel: Profiel }) {
  const themaNaam = profiel.thema?.naam;
  const logo = themaBeeldUrl(profiel.thema?.logo_pad);
  return (
    <header className="print:hidden sticky top-0 z-10 border-b-4 border-thema bg-vlak">
      <div className="mx-auto flex min-h-16 max-w-3xl items-center justify-between gap-3 px-4 py-2">
        <Image
          src="/logo/han-woordmerk-descriptor-400.png"
          alt="HAN University of Applied Sciences"
          width={400}
          height={88}
          priority
          className="h-6 w-auto md:hidden"
        />
        <div className="flex min-w-0 items-center gap-2 md:ml-auto">
          {logo && <img src={logo} alt="" className="h-9 w-auto max-w-16 shrink-0 object-contain" />}
          <div className="min-w-0 text-right">
            <p className="truncate text-lg leading-tight">
              {themaNaam ? <span className="font-heading font-bold text-kop">{themaNaam}</span> : <Woordmerk />}
            </p>
            <p className="truncate text-sm font-medium text-zacht">{profiel.label}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
