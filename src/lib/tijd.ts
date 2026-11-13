const TZ = "Europe/Amsterdam";

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
