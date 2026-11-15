const TZ = "Europe/Amsterdam";

/** De kalenderdag ("2026-11-15") op een moment, in Nederlandse tijd (dus niet in UTC). */
export function nlDag(moment: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(moment);
}

/**
 * Hoeveel kalenderdagen het nog is tot een dag ("2027-06-28"), in Nederlandse tijd. Er wordt niet in blokken van
 * 24 uur geteld: tussen winter en zomer zit een tijdwisseling, waardoor het getal anders een uur te vroeg zou
 * springen. Vandaag is 0, morgen is 1; een dag die voorbij is geeft een negatief getal.
 */
export function dagenTot(doelDag: string, nu: Date = new Date()): number {
  return Math.round((Date.parse(doelDag) - Date.parse(nlDag(nu))) / 86_400_000);
}

/** "2027-06-28" wordt "maandag 28 juni". */
export function formatDag(dag: string): string {
  return new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${dag}T00:00:00Z`));
}

/** "19:30:00" wordt "19:30". */
export function formatTijd(tijd: string): string {
  return tijd.slice(0, 5);
}

export function formatTijdvak(t: { dag: string; starttijd: string; eindtijd: string }): string {
  return `${formatDag(t.dag)} · ${formatTijd(t.starttijd)}–${formatTijd(t.eindtijd)}`;
}

/** "5 minuten geleden", "gisteren om 14:30" enz. */
export function formatMoment(iso: string, nu: Date = new Date()): string {
  const d = new Date(iso);
  const minuten = Math.round((nu.getTime() - d.getTime()) / 60000);
  if (minuten < 1) return "zojuist";
  if (minuten < 60) return `${minuten} ${minuten === 1 ? "minuut" : "minuten"} geleden`;
  const tijd = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(d);
  const dag = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", timeZone: TZ }).format(d);
  const dagVan = (x: Date) => new Intl.DateTimeFormat("nl-NL", { year: "numeric", month: "numeric", day: "numeric", timeZone: TZ }).format(x);
  if (dagVan(d) === dagVan(nu)) return `vandaag om ${tijd}`;
  return `${dag} om ${tijd}`;
}
