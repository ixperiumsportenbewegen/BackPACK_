"use server";

import { redirect } from "next/navigation";
import { maakServerClient } from "@/lib/supabase/server";
import { naarEmail } from "@/lib/gebruikersnaam";

export interface LoginStatus {
  fout?: string;
}

export async function inloggen(_vorige: LoginStatus, formData: FormData): Promise<LoginStatus> {
  const gebruikersnaam = String(formData.get("gebruikersnaam") ?? "").trim();
  const wachtwoord = String(formData.get("wachtwoord") ?? "");
  const blijfIngelogd = formData.get("blijf") === "on";

  if (!gebruikersnaam || !wachtwoord) {
    return { fout: "Vul je gebruikersnaam en wachtwoord in." };
  }

  const supabase = await maakServerClient(blijfIngelogd);
  const { error } = await supabase.auth.signInWithPassword({
    email: naarEmail(gebruikersnaam),
    password: wachtwoord,
  });
  if (error) return { fout: "Gebruikersnaam of wachtwoord klopt niet." };

  redirect("/");
}
