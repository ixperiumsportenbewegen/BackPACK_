"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { maakServerClient } from "@/lib/supabase/server";

export async function uitloggen() {
  const supabase = await maakServerClient();
  // Alleen dit apparaat uitloggen: het account wordt gedeeld, dus andere telefoons van de groep blijven ingelogd.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

/** Alleen voor de docent: kiest welk cluster getoond wordt (VD, VC of TEST). */
export async function kiesCluster(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  if (!["VD", "VC", "TEST"].includes(code)) return;
  (await cookies()).set("docent_cluster", code, { path: "/", sameSite: "lax", httpOnly: true });
  revalidatePath("/", "layout");
}
