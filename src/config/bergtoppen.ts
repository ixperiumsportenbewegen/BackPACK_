/** De 10 bergtoppen van de Ardennen: de gedragsafspraken van een cluster. Precies 10 vaste toppen, elk met een titel en een afspraak. */
export const AANTAL_TOPPEN = 10;

export const BERGTOP_MAX = { titel: 80, afspraak: 300, toelichtingTitel: 80, toelichting: 3000 } as const;

export const toppenNummers = Array.from({ length: AANTAL_TOPPEN }, (_, i) => i + 1);

export const topSleutel = (nummer: number, soort: "titel" | "afspraak") => `top_${nummer}_${soort}`;
