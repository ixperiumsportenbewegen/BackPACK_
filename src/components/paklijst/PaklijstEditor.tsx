"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ListPlus, Plus, Trash2 } from "lucide-react";
import {
  paklijstCategorieHernoemen, paklijstCategorieToevoegen, paklijstCategorieVerplaatsen, paklijstCategorieVerwijderen,
  paklijstLijstPlakken, paklijstSpulToevoegen, paklijstSpulVeldOpslaan, paklijstSpulVerplaatsen, paklijstSpulVerwijderen,
} from "@/app/(app)/paklijst-actions";
import type { PlanResultaat } from "@/app/(app)/calamiteitenplan-actions";
import { OpslaanVeld, usePlanNaam } from "@/components/plan/PlanEditor";
import { PAKLIJST_BLOKKEN, type PaklijstBlokCode } from "@/config/paklijst";
import type { PaklijstCategorie, PaklijstSpul } from "@/lib/paklijst";

const KNOP = "flex min-h-aanraak min-w-aanraak items-center justify-center rounded-han border-2 border-rand bg-vlak text-kop disabled:opacity-50";

type Uitkomst = PlanResultaat | { status: "ok"; id: string } | { status: "ok"; aantal: number } | { status: "fout"; melding: string };

/** Een bewerking uitvoeren (met de naam van wie invult), de pagina verversen en een eventuele fout tonen. */
function useBewerking() {
  const router = useRouter();
  const { naam } = usePlanNaam();
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  async function uitvoeren(actie: () => Promise<Uitkomst>): Promise<Uitkomst | null> {
    setFout(null);
    if (!naam.trim()) {
      setFout("Vul bovenaan eerst je naam in.");
      return null;
    }
    setBezig(true);
    const res = await actie();
    setBezig(false);
    if (res.status === "ok") router.refresh();
    else if (res.status === "fout") setFout(res.melding);
    else setFout("Iemand anders heeft dit net gewijzigd. Ververs de pagina.");
    return res;
  }
  return { naam, bezig, fout, setFout, uitvoeren };
}

/** Het vinkje "Optioneel" van een item. Slaat direct op. */
function OptioneelVeld({ clusterId, spul }: { clusterId: string; spul: PaklijstSpul }) {
  const { naam, bezig, fout, uitvoeren } = useBewerking();
  const [aan, setAan] = useState(spul.optioneel);
  return (
    <div>
      <label className="flex min-h-aanraak items-center gap-2 font-medium text-kop">
        <input
          type="checkbox" checked={aan} disabled={bezig} className="size-6"
          onChange={async (e) => {
            const nieuw = e.target.checked;
            const oud = aan;
            setAan(nieuw);
            const res = await uitvoeren(() => paklijstSpulVeldOpslaan(clusterId, spul.id, "optioneel", oud ? "ja" : "", nieuw ? "ja" : "", naam));
            if (!res || res.status !== "ok") setAan(oud);
          }}
        />
        Optioneel
      </label>
      {fout && <p role="alert" className="text-sm font-bold text-fout">{fout}</p>}
    </div>
  );
}

/** Een item (of een onderdeel van een item) om te bewerken: naam, aantal, toelichting en optioneel. */
function SpulEditor({
  clusterId, categorie, spul, nummer, aantalBroers, onderdeel = false,
}: { clusterId: string; categorie: PaklijstCategorie; spul: PaklijstSpul; nummer: number; aantalBroers: number; onderdeel?: boolean }) {
  const { naam, bezig, fout, uitvoeren } = useBewerking();
  const [verwijderen, setVerwijderen] = useState(false);
  const wat = onderdeel ? "onderdeel" : "item";
  const label = `${categorie.naam}, ${wat} ${nummer}`;
  const opslaan = (veld: "naam" | "aantal" | "toelichting") => (oud: string, nieuw: string, wie: string) =>
    paklijstSpulVeldOpslaan(clusterId, spul.id, veld, oud, nieuw, wie);

  return (
    <li className={`rounded-han border-2 border-rand bg-vlak p-3 ${onderdeel ? "bg-achtergrond" : ""}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <OpslaanVeld
            id={`spul-${spul.id}-naam`} label={`${label}, naam`} ariaLabel={`${label}, naam`} soort="kort" maxLengte={150}
            begin={spul.naam} compact placeholder={onderdeel ? "Naam van het onderdeel" : "Naam van het item"} opslaan={opslaan("naam")}
          />
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" disabled={bezig || nummer === 1} aria-label={`${label} omhoog`} className={KNOP}
            onClick={() => void uitvoeren(() => paklijstSpulVerplaatsen(clusterId, spul.id, true, naam))}>
            <ArrowUp aria-hidden className="size-5" />
          </button>
          <button type="button" disabled={bezig || nummer === aantalBroers} aria-label={`${label} omlaag`} className={KNOP}
            onClick={() => void uitvoeren(() => paklijstSpulVerplaatsen(clusterId, spul.id, false, naam))}>
            <ArrowDown aria-hidden className="size-5" />
          </button>
          <button type="button" disabled={bezig} aria-label={`${label} verwijderen`} className={KNOP} onClick={() => setVerwijderen(!verwijderen)}>
            <Trash2 aria-hidden className="size-5" />
          </button>
        </div>
      </div>
      <div className="mt-1 grid grid-cols-[1fr_auto] items-center gap-2">
        <OpslaanVeld
          id={`spul-${spul.id}-aantal`} label={`${label}, aantal`} ariaLabel={`${label}, aantal`} soort="kort" maxLengte={40}
          begin={spul.aantal} compact placeholder="Aantal (bijvoorbeeld 2)" opslaan={opslaan("aantal")}
        />
        <OptioneelVeld clusterId={clusterId} spul={spul} />
      </div>
      <div className="mt-1">
        <OpslaanVeld
          id={`spul-${spul.id}-toelichting`} label={`${label}, toelichting`} ariaLabel={`${label}, toelichting`} soort="kort" maxLengte={500}
          begin={spul.toelichting} compact placeholder="Toelichting of tip (mag leeg)" opslaan={opslaan("toelichting")}
        />
      </div>

      {verwijderen && (
        <div role="alert" className="mt-2 rounded-han border-2 border-actie p-3">
          <p className="font-bold text-kop">{onderdeel ? "Dit onderdeel verwijderen?" : "Dit item met zijn onderdelen verwijderen?"}</p>
          <p className="text-sm text-zacht">De inhoud blijft bewaard in het logboek, maar verdwijnt van de lijst.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={bezig} className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60"
              onClick={() => void uitvoeren(() => paklijstSpulVerwijderen(clusterId, spul.id, naam))}>
              Ja, verwijderen
            </button>
            <button type="button" className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop" onClick={() => setVerwijderen(false)}>
              Annuleren
            </button>
          </div>
        </div>
      )}

      {!onderdeel && (
        <div className="mt-2 border-l-2 border-rand pl-3">
          {spul.onderdelen.length > 0 && (
            <ul className="flex flex-col gap-2">
              {spul.onderdelen.map((o, n) => (
                <SpulEditor key={o.id} clusterId={clusterId} categorie={categorie} spul={o} nummer={n + 1} aantalBroers={spul.onderdelen.length} onderdeel />
              ))}
            </ul>
          )}
          <button type="button" disabled={bezig} onClick={() => void uitvoeren(() => paklijstSpulToevoegen(clusterId, categorie.id, spul.id, naam))}
            className="mt-2 flex min-h-aanraak items-center gap-2 rounded-han border-2 border-rand bg-vlak px-3 text-sm font-bold text-kop disabled:opacity-60">
            <Plus aria-hidden className="size-4" /> Onderdeel toevoegen aan {label}
          </button>
        </div>
      )}
      {fout && <p role="alert" className="mt-1 font-bold text-fout">{fout}</p>}
    </li>
  );
}

/** Een lijst plakken: elke regel wordt een item; een streepje of inspringen maakt een onderdeel; | scheidt naam, aantal en toelichting. */
function PlakPaneel({ clusterId, categorie }: { clusterId: string; categorie: PaklijstCategorie }) {
  const { naam, bezig, fout, uitvoeren } = useBewerking();
  const [tekst, setTekst] = useState("");
  const [bericht, setBericht] = useState<string | null>(null);
  return (
    <details className="rounded-han border border-rand p-3">
      <summary className="flex min-h-aanraak cursor-pointer items-center gap-2 font-bold text-kop"><ListPlus aria-hidden className="size-5" /> Plak een lijst in {categorie.naam}</summary>
      <p className="mt-1 text-sm text-zacht">
        Elke regel wordt een item. Begin een regel met een streepje (-) of spring in om er een onderdeel van het item erboven van te maken.
        Met een rechte streep scheid je naam, aantal en toelichting, bijvoorbeeld: Slaapzak | 1 | warm genoeg.
      </p>
      <label className="mt-2 block font-medium text-kop" htmlFor={`plak-${categorie.id}`}>Lijst voor {categorie.naam}</label>
      <textarea
        id={`plak-${categorie.id}`} value={tekst} onChange={(e) => setTekst(e.target.value)} rows={6} maxLength={20000}
        className="mt-1 w-full rounded-han border-2 border-zacht bg-vlak p-3 text-base text-tekst"
        placeholder={"Slaapzak | 1\nToilettas\n- Tandenborstel\n- Tandpasta"}
      />
      {bericht && <p role="status" className="mt-1 font-bold text-kop">{bericht}</p>}
      {fout && <p role="alert" className="mt-1 font-bold text-fout">{fout}</p>}
      <button
        type="button" disabled={bezig || tekst.trim() === ""}
        onClick={async () => {
          setBericht(null);
          const res = await uitvoeren(() => paklijstLijstPlakken(clusterId, categorie.id, tekst, naam));
          if (res && res.status === "ok" && "aantal" in res) {
            setTekst("");
            setBericht(`${res.aantal} ${res.aantal === 1 ? "regel" : "regels"} toegevoegd.`);
          }
        }}
        className="mt-2 min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60"
      >
        Toevoegen aan {categorie.naam}
      </button>
    </details>
  );
}

function CategorieKaart({
  clusterId, categorie, positie, aantalInBlok,
}: { clusterId: string; categorie: PaklijstCategorie; positie: number; aantalInBlok: number }) {
  const { naam, bezig, fout, uitvoeren } = useBewerking();
  const [verwijderen, setVerwijderen] = useState(false);
  const aantal = categorie.spullen.length + categorie.spullen.reduce((n, s) => n + s.onderdelen.length, 0);
  return (
    <details className="rounded-han border border-rand bg-vlak p-3" open={aantalInBlok === 1}>
      <summary className="flex min-h-aanraak cursor-pointer flex-col justify-center">
        <span className="text-xl font-bold text-kop">{categorie.naam}</span>
        <span className="text-sm text-zacht">{aantal === 0 ? "Nog geen items" : `${aantal} ${aantal === 1 ? "regel" : "regels"}`}</span>
      </summary>

      <div className="mt-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <OpslaanVeld
            id={`cat-${categorie.id}`} label="Naam van de categorie" soort="kort" maxLengte={80} begin={categorie.naam}
            opslaan={(oud, nieuw, wie) => paklijstCategorieHernoemen(clusterId, categorie.id, oud, nieuw, wie)}
          />
        </div>
        <div className="flex shrink-0 gap-1 pt-6">
          <button type="button" disabled={bezig || positie === 1} aria-label={`Categorie ${categorie.naam} omhoog`} className={KNOP}
            onClick={() => void uitvoeren(() => paklijstCategorieVerplaatsen(clusterId, categorie.id, true, naam))}>
            <ArrowUp aria-hidden className="size-5" />
          </button>
          <button type="button" disabled={bezig || positie === aantalInBlok} aria-label={`Categorie ${categorie.naam} omlaag`} className={KNOP}
            onClick={() => void uitvoeren(() => paklijstCategorieVerplaatsen(clusterId, categorie.id, false, naam))}>
            <ArrowDown aria-hidden className="size-5" />
          </button>
          <button type="button" disabled={bezig} aria-label={`Categorie ${categorie.naam} verwijderen`} className={KNOP} onClick={() => setVerwijderen(!verwijderen)}>
            <Trash2 aria-hidden className="size-5" />
          </button>
        </div>
      </div>

      {verwijderen && (
        <div role="alert" className="mt-2 rounded-han border-2 border-actie p-3">
          <p className="font-bold text-kop">Deze categorie verwijderen{aantal > 0 ? ` met alle ${aantal} regels erin` : ""}?</p>
          <p className="text-sm text-zacht">De inhoud blijft bewaard in het logboek, maar verdwijnt van de lijst.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={bezig} className="min-h-aanraak rounded-han bg-merk px-4 font-bold text-op-merk disabled:opacity-60"
              onClick={() => void uitvoeren(() => paklijstCategorieVerwijderen(clusterId, categorie.id, naam))}>
              Ja, verwijderen
            </button>
            <button type="button" className="min-h-aanraak rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop" onClick={() => setVerwijderen(false)}>
              Annuleren
            </button>
          </div>
        </div>
      )}

      <ul className="mt-3 flex flex-col gap-2">
        {categorie.spullen.map((s, n) => (
          <SpulEditor key={s.id} clusterId={clusterId} categorie={categorie} spul={s} nummer={n + 1} aantalBroers={categorie.spullen.length} />
        ))}
      </ul>
      {fout && <p role="alert" className="mt-2 font-bold text-fout">{fout}</p>}
      <div className="mt-3 flex flex-col gap-2">
        <button type="button" disabled={bezig} onClick={() => void uitvoeren(() => paklijstSpulToevoegen(clusterId, categorie.id, null, naam))}
          className="flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop disabled:opacity-60">
          <Plus aria-hidden className="size-5" /> Item toevoegen aan {categorie.naam}
        </button>
        <PlakPaneel clusterId={clusterId} categorie={categorie} />
      </div>
    </details>
  );
}

function CategorieToevoegen({ clusterId, blok }: { clusterId: string; blok: PaklijstBlokCode }) {
  const { naam, bezig, fout, uitvoeren } = useBewerking();
  const [categorie, setCategorie] = useState("");
  const naamBlok = PAKLIJST_BLOKKEN.find((b) => b.code === blok)!.naam;
  return (
    <div className="flex flex-col gap-2 rounded-han border border-dashed border-zacht p-3">
      <label htmlFor={`nieuwe-cat-${blok}`} className="font-medium text-kop">Nieuwe categorie in {naamBlok}</label>
      <input
        id={`nieuwe-cat-${blok}`} value={categorie} onChange={(e) => setCategorie(e.target.value)} maxLength={80} autoComplete="off"
        placeholder="Bijvoorbeeld: Fietsspullen" className="min-h-aanraak rounded-han border-2 border-zacht bg-vlak px-3 text-base text-tekst"
      />
      {fout && <p role="alert" className="font-bold text-fout">{fout}</p>}
      <button
        type="button" disabled={bezig || categorie.trim() === ""}
        onClick={async () => {
          const res = await uitvoeren(() => paklijstCategorieToevoegen(clusterId, blok, categorie, naam));
          if (res && res.status === "ok") setCategorie("");
        }}
        className="flex min-h-aanraak items-center justify-center gap-2 rounded-han border-2 border-kop bg-vlak px-4 font-bold text-kop disabled:opacity-60"
      >
        <Plus aria-hidden className="size-5" /> Categorie toevoegen aan {naamBlok}
      </button>
    </div>
  );
}

/** Het bewerkscherm van de paklijst: per blok de categorieën met hun items. */
export function PaklijstEditor({ clusterId, categorieen }: { clusterId: string; categorieen: PaklijstCategorie[] }) {
  return (
    <div className="flex flex-col gap-8">
      {PAKLIJST_BLOKKEN.map((blok) => {
        const cats = categorieen.filter((c) => c.blok === blok.code);
        return (
          <section key={blok.code} aria-labelledby={`bewerk-blok-${blok.code}`} className="flex flex-col gap-3">
            <div>
              <h2 id={`bewerk-blok-${blok.code}`} className="text-2xl">{blok.naam}</h2>
              <p className="text-sm text-zacht">{blok.uitleg}</p>
            </div>
            {cats.map((c, n) => <CategorieKaart key={c.id} clusterId={clusterId} categorie={c} positie={n + 1} aantalInBlok={cats.length} />)}
            <CategorieToevoegen clusterId={clusterId} blok={blok.code} />
          </section>
        );
      })}
    </div>
  );
}
