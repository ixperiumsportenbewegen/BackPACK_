/* eslint-disable @next/next/no-img-element */
import { getProfiel } from "@/lib/profiel";
import { STANDAARD_SFEERBEELD, themaBeeldUrl } from "@/lib/themaBeeld";
import { kiesCluster } from "./actions";

const STARTDATUM = new Date("2027-06-28T00:00:00+02:00");

function dagenTot(datum: Date): number {
  return Math.ceil((datum.getTime() - Date.now()) / 86_400_000);
}

export default async function OnzeMeerdaagse() {
  const profiel = (await getProfiel())!;
  const thema = profiel.thema;
  const heeftThema = Boolean(thema?.naam);
  const dagen = dagenTot(STARTDATUM);
  const sfeer = themaBeeldUrl(thema?.sfeerbeeld_pad ?? STANDAARD_SFEERBEELD, 1600);

  return (
    <div className="flex flex-col gap-6">
      {profiel.soort === "docent" && (
        <section aria-label="Cluster kiezen">
          <p className="mb-2 text-sm font-medium text-zacht">Cluster</p>
          <div className="flex gap-2">
            {profiel.alleClusters.map((c) => {
              const actief = c.code === profiel.cluster?.code;
              return (
                <form key={c.code} action={kiesCluster} className="flex-1">
                  <input type="hidden" name="code" value={c.code} />
                  <button
                    type="submit"
                    aria-pressed={actief}
                    className={`min-h-aanraak w-full rounded-han border-2 px-3 font-bold ${
                      actief ? "border-merk bg-merk text-op-merk" : "border-rand bg-vlak text-kop"
                    }`}
                  >
                    {c.code}
                  </button>
                </form>
              );
            })}
          </div>
        </section>
      )}

      <section className="relative overflow-hidden rounded-han bg-kop text-white">
        {sfeer && <img src={sfeer} alt="" className="absolute inset-0 size-full object-cover opacity-60" />}
        <div className="relative flex min-h-56 flex-col justify-end gap-2 bg-gradient-to-t from-black/80 to-transparent p-4">
          <h1 className="text-3xl !text-white">{heeftThema ? thema!.naam : "Kies jullie meerdaagsethema"}</h1>
          {heeftThema && thema!.verhaal && <p className="text-white">{thema!.verhaal}</p>}
          {heeftThema && thema!.slogan && <p className="font-medium text-white">{thema!.slogan}</p>}
        </div>
      </section>

      <section className="rounded-han border border-rand bg-vlak p-4">
        <p className="text-sm font-medium text-zacht">Ardennen-meerdaagse · 28–30 juni 2027</p>
        <p className="mt-1 font-heading text-3xl font-bold text-kop">
          {dagen > 0 ? `Nog ${dagen} dagen` : "Het is zover"}
        </p>
      </section>

      <section className="rounded-han border border-rand bg-vlak p-4">
        <h2 className="text-xl">Belevenissen</h2>
        <p className="mt-1 text-zacht">
          Jullie BackPACK_ is nog leeg. Hier komen straks de zes belevenissen van {profiel.cluster?.naam ?? "jullie cluster"}.
        </p>
      </section>
    </div>
  );
}
