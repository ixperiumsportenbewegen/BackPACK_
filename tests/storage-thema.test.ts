/**
 * Afscherming van Storage-bucket `thema` (docs/rechtenmatrix.md):
 * lezen = hele cluster en docent; schrijven = stuurgroep van het cluster en docent.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anoniem, clusterId, inloggenAls } from "./helpers";

// Een geldige PNG van 1x1 pixel
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let VD: string, VC: string;
const opgeruimd: string[] = [];

async function uploadAdmin(pad: string) {
  const { error } = await admin.storage.from("thema").upload(pad, PNG, { contentType: "image/png", upsert: true });
  expect(error).toBeNull();
  opgeruimd.push(pad);
}

beforeAll(async () => {
  VD = await clusterId("VD");
  VC = await clusterId("VC");
  await uploadAdmin(`cluster/${VD}/afscherming-test.png`);
  await uploadAdmin(`cluster/${VC}/afscherming-test.png`);
});

afterAll(async () => {
  await admin.storage.from("thema").remove(opgeruimd);
});

describe("Storage thema: lezen", () => {
  it("elk account van VD kan het VD-bestand lezen", async () => {
    for (const naam of ["vd-stuur-beleving", "vd-groep-1", "vd-student"]) {
      const { data, error } = await (await inloggenAls(naam)).storage.from("thema").download(`cluster/${VD}/afscherming-test.png`);
      expect(error, naam).toBeNull();
      expect(data?.size, naam).toBeGreaterThan(0);
    }
  });

  it("accounts van VC en TEST kunnen het VD-bestand niet lezen", async () => {
    for (const naam of ["vc-stuur-beleving", "vc-groep-1", "vc-student", "test-stuur", "test-student"]) {
      const { error } = await (await inloggenAls(naam)).storage.from("thema").download(`cluster/${VD}/afscherming-test.png`);
      expect(error, naam).not.toBeNull();
    }
  });

  it("de lijst van een ander cluster is leeg", async () => {
    const { data } = await (await inloggenAls("vd-groep-1")).storage.from("thema").list(`cluster/${VC}`);
    expect(data ?? []).toHaveLength(0);
  });

  it("de docent leest beide clusters", async () => {
    const client = await inloggenAls("docent");
    for (const id of [VD, VC]) {
      const { error } = await client.storage.from("thema").download(`cluster/${id}/afscherming-test.png`);
      expect(error).toBeNull();
    }
  });

  it("niet-ingelogd kan niets lezen", async () => {
    const { error } = await anoniem().storage.from("thema").download(`cluster/${VD}/afscherming-test.png`);
    expect(error).not.toBeNull();
  });
});

describe("Storage thema: schrijven", () => {
  it("de stuurgroep kan uploaden, vervangen en verwijderen in het eigen cluster", async () => {
    const client = await inloggenAls("vd-stuur-beleving");
    const pad = `cluster/${VD}/stuurgroep-upload.png`;
    opgeruimd.push(pad);
    const up = await client.storage.from("thema").upload(pad, PNG, { contentType: "image/png" });
    expect(up.error).toBeNull();
    const vervang = await client.storage.from("thema").upload(pad, PNG, { contentType: "image/png", upsert: true });
    expect(vervang.error).toBeNull();
    const del = await client.storage.from("thema").remove([pad]);
    expect(del.error).toBeNull();
    const { data } = await admin.storage.from("thema").list(`cluster/${VD}`);
    expect(data?.some((f) => f.name === "stuurgroep-upload.png")).toBe(false);
  });

  it("de stuurgroep kan niet uploaden naar een ander cluster", async () => {
    const pad = `cluster/${VC}/ongewenst.png`;
    opgeruimd.push(pad);
    const { error } = await (await inloggenAls("vd-stuur-beleving")).storage.from("thema").upload(pad, PNG, { contentType: "image/png" });
    expect(error).not.toBeNull();
  });

  it("een projectgroep, een student en niet-ingelogd kunnen niet uploaden", async () => {
    const pad = `cluster/${VD}/ongewenst.png`;
    opgeruimd.push(pad);
    for (const naam of ["vd-groep-1", "vd-student"]) {
      const { error } = await (await inloggenAls(naam)).storage.from("thema").upload(pad, PNG, { contentType: "image/png" });
      expect(error, naam).not.toBeNull();
    }
    const { error } = await anoniem().storage.from("thema").upload(pad, PNG, { contentType: "image/png" });
    expect(error).not.toBeNull();
  });

  it("een projectgroep kan bestaande bestanden niet overschrijven of verwijderen", async () => {
    const client = await inloggenAls("vd-groep-1");
    const pad = `cluster/${VD}/afscherming-test.png`;
    const over = await client.storage.from("thema").upload(pad, PNG, { contentType: "image/png", upsert: true });
    expect(over.error).not.toBeNull();
    await client.storage.from("thema").remove([pad]);
    const { data } = await admin.storage.from("thema").list(`cluster/${VD}`);
    expect(data?.some((f) => f.name === "afscherming-test.png")).toBe(true);
  });

  it("alleen afbeeldingen zijn toegestaan", async () => {
    const pad = `cluster/${VD}/script.html`;
    opgeruimd.push(pad);
    const { error } = await (await inloggenAls("vd-stuur-beleving")).storage
      .from("thema").upload(pad, Buffer.from("<script>alert(1)</script>"), { contentType: "text/html" });
    expect(error).not.toBeNull();
  });

  it("de docent kan in beide clusters uploaden", async () => {
    const client = await inloggenAls("docent");
    for (const id of [VD, VC]) {
      const pad = `cluster/${id}/docent-upload.png`;
      opgeruimd.push(pad);
      const { error } = await client.storage.from("thema").upload(pad, PNG, { contentType: "image/png", upsert: true });
      expect(error).toBeNull();
    }
  });
});

describe("Thema: bestandspaden", () => {
  it("sfeerbeeld_pad accepteert alleen cluster/ of fotos/", async () => {
    const client = await inloggenAls("vd-stuur-beleving");
    const fout = await client.from("meerdaagsethema").update({ sfeerbeeld_pad: "https://example.com/x.png" }).eq("cluster_id", VD).select();
    expect(fout.error).not.toBeNull();
  });
});
