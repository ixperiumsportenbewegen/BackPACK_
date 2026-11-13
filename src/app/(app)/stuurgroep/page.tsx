import { redirect } from "next/navigation";
import { getProfiel } from "@/lib/profiel";

export const metadata = { title: "Stuurgroep · BackPACK_" };

export default async function Stuurgroep() {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "stuurgroep" && profiel.soort !== "docent") redirect("/");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl">Stuurgroep</h1>
      {profiel.stuurgroeprol && (
        <p className="font-medium text-kop">Jullie rol: {profiel.stuurgroeprol.naam}</p>
      )}
      <p className="rounded-han border border-rand bg-vlak p-4 text-zacht">
        Hier komen de werkpagina&apos;s van de stuurgroep.
      </p>
    </div>
  );
}
