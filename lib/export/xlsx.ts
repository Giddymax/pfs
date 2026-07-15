import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

/**
 * Builds a downloadable .xlsx NextResponse from row objects. Column order
 * follows the keys of the first row (json_to_sheet's behaviour), so build
 * each row as a plain object with human-readable header names as keys.
 */
export function xlsxResponse(
  rows: Record<string, unknown>[],
  opts: { sheetName: string; filename: string; colWidths?: number[] }
): NextResponse {
  return xlsxMultiSheetResponse([{ sheetName: opts.sheetName, rows, colWidths: opts.colWidths }], opts.filename);
}

/** Same as xlsxResponse, but writes multiple sheets into one workbook. */
export function xlsxMultiSheetResponse(
  sheets: { sheetName: string; rows: Record<string, unknown>[]; colWidths?: number[] }[],
  filename: string
): NextResponse {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows);
    if (sheet.colWidths) {
      ws["!cols"] = sheet.colWidths.map((wch) => ({ wch }));
    }
    XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName);
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
