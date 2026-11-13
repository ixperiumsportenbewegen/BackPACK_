/** Gebruikersnamen worden intern een e-mailadres (e-mailbevestiging staat uit). */
export function naarEmail(gebruikersnaam: string): string {
  return `${gebruikersnaam.trim().toLowerCase()}@ardennen.invalid`;
}
