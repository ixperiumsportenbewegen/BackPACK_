import ExcelJS from "exceljs";
import type { Export } from "@/lib/exporteren";

function naarCel(w: unknown): string | number | boolean | null {
  if (w === null || w === undefined) return null;
  if (typeof w === "number" || typeof w === "boolean") return w;
  if (typeof w === "string") return w.length > 32000 ? `${w.slice(0, 32000)}…` : w;
  const tekst = JSON.stringify(w);
  return tekst.length > 32000 ? `${tekst.slice(0, 32000)}…` : tekst;
}

/** Een Excel-werkmap met een tabblad per tabel. Gegevens die uit lijsten bestaan (jsonb) staan als tekst. */
export async function exportNaarExcel(data: Export): Promise<Buffer> {
  const werkmap = new ExcelJS.Workbook();
  werkmap.creator = "BackPACK_";
  werkmap.created = new Date(data.gemaaktOp);

  const overzicht = werkmap.addWorksheet("Overzicht");
  overzicht.addRow(["Export van BackPACK_", data.gemaaktOp]);
  overzicht.addRow([]);
  overzicht.addRow(["Tabblad", "Aantal rijen"]).font = { bold: true };
  for (const [naam, aantal] of Object.entries(data.aantallen)) overzicht.addRow([naam, aantal]);
  overzicht.columns = [{ width: 32 }, { width: 18 }];

  for (const [naam, rijen] of Object.entries(data.tabellen)) {
    const blad = werkmap.addWorksheet(naam.slice(0, 31));
    const kolommen = [...new Set(rijen.flatMap((r) => Object.keys(r)))];
    if (kolommen.length === 0) {
      blad.addRow(["(geen gegevens)"]);
      continue;
    }
    blad.addRow(kolommen).font = { bold: true };
    blad.views = [{ state: "frozen", ySplit: 1 }];
    for (const r of rijen) blad.addRow(kolommen.map((k) => naarCel(r[k])));
    blad.columns = kolommen.map((k) => ({ width: Math.min(40, Math.max(12, k.length + 2)) }));
  }
  return Buffer.from(await werkmap.xlsx.writeBuffer());
}
