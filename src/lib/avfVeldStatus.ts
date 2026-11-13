/**
 * Stand van één AVF-veld voor het stuurgroepdashboard: leeg, deels ingevuld of ingevuld.
 * Leest de veldenlijst uit src/config/avf-velden.ts. Velden per fase of onderdeel tellen samen.
 */
import { OPRUIMEN_VELDEN, WEER_SCENARIOS, type AvfVeld } from "@/config/avf-velden";
import type { AvfGegevens } from "@/lib/avfData";
import { isGevuld, leesWaarde, type Json } from "@/lib/avfVoortgang";

export type VeldStand = "leeg" | "deels" | "ingevuld" | "later";

function samen(gevuld: number, totaal: number): VeldStand {
  if (totaal === 0 || gevuld === 0) return "leeg";
  return gevuld === totaal ? "ingevuld" : "deels";
}

export function veldStand(avf: AvfGegevens, v: AvfVeld): VeldStand {
  if (v.veldtype === "later") return "later";
  const inhoud = avf.inhoud;

  if (v.niveau === "fase") {
    const gevuld = avf.fasen.filter((f) => {
      if (v.sleutel === "opruimen") return OPRUIMEN_VELDEN.every((w) => isGevuld((f.opruimen as Json)?.[w.sleutel]));
      return isGevuld((f as unknown as Json)[v.sleutel]);
    }).length;
    return samen(gevuld, avf.fasen.length);
  }

  if (v.niveau === "onderdeel") {
    const lijst = avf.onderdelen;
    if (v.sleutel === "onderdelen") {
      const fasenMet = new Set(lijst.map((o) => o.fase)).size;
      return samen(fasenMet, 3);
    }
    if (lijst.length === 0) return "leeg";
    const gevuld = lijst.filter((o) => {
      const nvt = new Set(o.niet_van_toepassing ?? []);
      const ok = (kolom: string) => nvt.has(kolom) || isGevuld(o[kolom]);
      switch (v.sleutel) {
        case "naam": return isGevuld(o.naam) && isGevuld(o.duur_minuten) && isGevuld(o.beschrijving);
        case "differentiatie": return ["individu_moeilijker", "individu_makkelijker", "groep_moeilijker", "groep_makkelijker"].some(ok);
        case "usv": return ["usv_uitdagend", "usv_speelbaar"].some(ok);
        default: return ok(v.sleutel);
      }
    }).length;
    return samen(gevuld, lijst.length);
  }

  switch (v.sleutel) {
    case "tijdvak": return avf.tijdvak ? "ingevuld" : "leeg";
    case "locatie": return isGevuld(avf.locatie) ? "ingevuld" : "leeg";
    case "projectgroep_rol": return samen(inhoud.rollenIngevuld, 6);
    case "veiligheid.weer.*": {
      const weer = (inhoud.veiligheid.weer ?? {}) as Record<string, Json>;
      return samen(WEER_SCENARIOS.filter((s) => typeof weer[s.sleutel]?.relevant === "boolean").length, WEER_SCENARIOS.length);
    }
    case "veiligheid.risicos[]": {
      const r = inhoud.veiligheid.risicos;
      return Array.isArray(r) && r.some((x) => isGevuld((x as Json).risico)) ? "ingevuld" : "leeg";
    }
    case "veiligheid.ehbo.maatregelen": {
      const aanvullend = leesWaarde(inhoud, "veiligheid.ehbo.aanvullend");
      if (aanvullend === false) return "ingevuld";
      return aanvullend === true && isGevuld(leesWaarde(inhoud, v.sleutel)) ? "ingevuld" : "leeg";
    }
    default:
      return isGevuld(leesWaarde(inhoud, v.sleutel)) ? "ingevuld" : "leeg";
  }
}
