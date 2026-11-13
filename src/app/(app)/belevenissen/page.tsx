import { PaginaKop } from "@/components/PaginaKop";

export const metadata = { title: "Belevenissen · BackPACK_" };

export default function Belevenissen() {
  return (
    <div className="flex flex-col gap-4">
      <PaginaKop titel="Belevenissen" foto="rotswand-klimmen" />
      <p className="rounded-han border border-rand bg-vlak p-4 text-zacht">
        Hier komen de zes belevenissen van jullie cluster te staan.
      </p>
    </div>
  );
}
