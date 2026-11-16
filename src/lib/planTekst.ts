/** Kleine hulpfuncties voor teksten in het calamiteitenplan (geen servercode, dus ook in tests te gebruiken). */

/** Het eerste telefoonnummer uit een tekst als tel:-link, bijvoorbeeld "tel:+32822124 11" zonder spaties, of null. */
export function telHref(tekst: string | null | undefined): string | null {
  if (!tekst) return null;
  const m = tekst.match(/\+?\d[\d\s().-]*\d/);
  if (!m) return null;
  const ruw = m[0].replace(/[^\d+]/g, "");
  const nummer = (ruw.startsWith("+") ? "+" : "") + ruw.replace(/\+/g, "");
  return nummer.replace(/\D/g, "").length >= 3 ? `tel:${nummer}` : null;
}

/** Een website uit een tekst als https-link ("www.voorbeeld.be" of "https://…"), of null als het geen webadres lijkt. */
export function webHref(tekst: string | null | undefined): string | null {
  const t = tekst?.trim();
  if (!t || /\s/.test(t)) return null;
  if (/^https:\/\//i.test(t)) return t;
  if (/^http:\/\//i.test(t)) return t.replace(/^http:/i, "https:");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(t) ? `https://${t}` : null;
}
