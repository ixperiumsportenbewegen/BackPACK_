"use client";

import { useActionState } from "react";
import { inloggen, type LoginStatus } from "./actions";

const beginstatus: LoginStatus = {};

export function LoginForm() {
  const [status, actie, bezig] = useActionState(inloggen, beginstatus);

  return (
    <form action={actie} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1 font-medium text-kop">
        Gebruikersnaam
        <input
          name="gebruikersnaam"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          className="min-h-aanraak rounded-han border-2 border-zacht bg-vlak px-3 text-base font-normal text-tekst"
        />
      </label>
      <label className="flex flex-col gap-1 font-medium text-kop">
        Wachtwoord
        <input
          name="wachtwoord"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-aanraak rounded-han border-2 border-zacht bg-vlak px-3 text-base font-normal text-tekst"
        />
      </label>
      <label className="flex min-h-aanraak items-center gap-3 text-tekst">
        <input name="blijf" type="checkbox" defaultChecked className="size-6 accent-merk" />
        Ingelogd blijven
      </label>
      {status.fout && (
        <p role="alert" className="rounded-han border-2 border-fout bg-vlak p-3 font-medium text-kop">
          {status.fout}
        </p>
      )}
      <button
        type="submit"
        disabled={bezig}
        className="min-h-aanraak rounded-han bg-merk px-4 text-lg font-bold text-op-merk disabled:opacity-60"
      >
        {bezig ? "Bezig met inloggen…" : "Inloggen"}
      </button>
    </form>
  );
}
