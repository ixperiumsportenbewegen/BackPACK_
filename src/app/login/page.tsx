import Image from "next/image";
import { LoginForm } from "./LoginForm";
import { Woordmerk } from "@/components/Woordmerk";

export const metadata = { title: "Inloggen · BackPACK_" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-vlak md:my-8 md:min-h-0 md:rounded-han md:border md:border-rand">
      <div className="flex flex-col gap-5 px-4 pb-6 pt-6">
        <Image
          src="/logo/han-sport-en-bewegen-400.png"
          alt="HAN Sport en Bewegen"
          width={400}
          height={134}
          priority
          className="h-auto w-56"
        />
        <div>
          <h1 className="text-4xl">
            <Woordmerk />
          </h1>
          <p className="mt-2 text-zacht">
            Pleister, Aansteker, Camera en Kompas: alles in je BackPACK_
          </p>
        </div>
      </div>
      <Image
        src="/fotos/wandeling-schemer-staand-800.webp"
        alt="Wandelaars in de Ardennen bij schemering"
        width={600}
        height={800}
        priority
        className="h-48 w-full object-cover object-center"
      />
      <div className="px-4 py-6">
        <LoginForm />
      </div>
    </main>
  );
}
