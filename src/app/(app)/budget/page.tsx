import { redirect } from "next/navigation";
import { PaginaKop } from "@/components/PaginaKop";
import { getProfiel } from "@/lib/profiel";

export const metadata = { title: "Budget · BackPACK_" };

export default async function Budget() {
  const profiel = (await getProfiel())!;
  if (profiel.soort !== "projectgroep") redirect("/");

  return (
    <div className="flex flex-col gap-4">
      <PaginaKop titel="Budget" foto="bivak-zeil" />
      <p className="rounded-han border border-rand bg-vlak p-4 text-zacht">
        Hier komen straks jullie budgetaanvragen en de resterende ruimte van het cluster.
      </p>
    </div>
  );
}
