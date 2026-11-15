import Image from "next/image";
import Link from "next/link";
import { Woordmerk } from "@/components/Woordmerk";

export const metadata = { title: "Pagina niet gevonden · BackPACK_" };

/** Een foute link of oude bladwijzer: gewoon in de huisstijl, met één knop terug naar het begin. */
export default function NietGevonden() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-10">
      <Image
        src="/logo/han-woordmerk-descriptor-400.png"
        alt="HAN University of Applied Sciences"
        width={400}
        height={88}
        className="h-7 w-auto self-start"
      />
      <p className="text-sm font-bold uppercase text-zacht">404</p>
      <h1 className="text-3xl">Deze pagina bestaat niet</h1>
      <p className="text-tekst">
        De link is niet goed of de pagina is verplaatst. Ga terug naar het begin van <Woordmerk />.
      </p>
      <Link href="/" className="flex min-h-aanraak items-center justify-center rounded-han bg-merk px-4 font-bold text-op-merk">
        Terug naar het begin
      </Link>
    </main>
  );
}
