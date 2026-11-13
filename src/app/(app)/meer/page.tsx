import { getProfiel } from "@/lib/profiel";
import { uitloggen } from "../actions";

export const metadata = { title: "Meer · Backpack_" };

export default async function Meer() {
  const profiel = (await getProfiel())!;
  const teams = profiel.cluster?.teams_link;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl">Meer</h1>

      <section className="rounded-han border border-rand bg-vlak p-4">
        <p className="text-sm font-medium text-zacht">Ingelogd als</p>
        <p className="font-heading text-2xl font-bold text-kop">{profiel.label}</p>
      </section>

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
        <button
          type="submit"
          className="min-h-aanraak w-full rounded-han bg-merk px-4 text-lg font-bold text-op-merk"
        >
          Uitloggen
        </button>
      </form>
    </div>
  );
}
