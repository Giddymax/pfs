"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

type ImportError = { row: number; name: string; reason: string };
type ImportResult = { imported: number; failed: number; errors: ImportError[] };

export function ClientExcelButtons() {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      {/* Export */}
      <a
        href="/api/clients/export"
        download
        className="inline-flex items-center gap-1.5 rounded-md border border-[#0A2240]/15 bg-white px-3.5 py-2.5 text-[13px] font-medium text-[#0A2240]/65 transition-colors hover:bg-[#0A2240]/5 hover:text-[#0A2240]"
      >
        <Download size={14} />
        Export Excel
      </a>

      {/* Import trigger */}
      <button
        type="button"
        onClick={() => setImportOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#0033AA]/20 bg-white px-3.5 py-2.5 text-[13px] font-medium text-[#0033AA] transition-colors hover:bg-[#0033AA]/5"
      >
        <Upload size={14} />
        Import Excel
      </button>

      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
    </>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pickFile(f: File) {
    setFile(f);
    setResult(null);
    setError(null);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) pickFile(f);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }

  async function handleImport() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/clients/import", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed. Please try again.");
      setResult(json as ImportResult);
      if (json.imported > 0) router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleClose() {
    setFile(null);
    setResult(null);
    setError(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">

        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-[#0033AA]">Import clients from Excel</h3>
            <p className="mt-0.5 text-[12.5px] text-[#0A2240]/45">
              Upload a .xlsx file. Existing clients are not affected.
            </p>
          </div>
          <button type="button" onClick={handleClose} aria-label="Close" className="text-[#0A2240]/35 hover:text-[#0A2240]">
            <X size={18} />
          </button>
        </div>

        {/* Template download */}
        <a
          href="/api/clients/import"
          download
          className="mb-4 flex items-center gap-2 rounded-md border border-dashed border-[#0033AA]/20 bg-[#0033AA]/[0.03] px-3.5 py-2.5 text-[12.5px] font-medium text-[#0033AA] transition-colors hover:bg-[#0033AA]/[0.06]"
        >
          <FileSpreadsheet size={14} />
          Download import template
          <span className="ml-auto text-[11px] font-normal text-[#0A2240]/40">Includes sample row</span>
        </a>

        {/* Drop zone */}
        {!result && (
          <div
            className={`relative mb-4 cursor-pointer rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
              dragging
                ? "border-[#0033AA] bg-[#0033AA]/[0.06]"
                : file
                ? "border-[#1F6E4A]/40 bg-[#1F6E4A]/[0.04]"
                : "border-[#0A2240]/15 hover:border-[#0033AA]/30 hover:bg-[#0033AA]/[0.025]"
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={onFileChange}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet size={28} className="text-[#1F6E4A]" />
                <p className="text-[13px] font-medium text-[#0A2240]">{file.name}</p>
                <p className="text-[12px] text-[#0A2240]/45">{(file.size / 1024).toFixed(1)} KB — click to change</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload size={28} className="text-[#0A2240]/25" />
                <p className="text-[13px] font-medium text-[#0A2240]/55">Drop your .xlsx file here</p>
                <p className="text-[12px] text-[#0A2240]/35">or click to browse</p>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-3 rounded-md border border-[#1F6E4A]/20 bg-[#1F6E4A]/[0.06] px-4 py-3">
              <CheckCircle size={18} className="shrink-0 text-[#1F6E4A]" />
              <div>
                <p className="text-[13px] font-semibold text-[#0A2240]">
                  {result.imported} client{result.imported !== 1 ? "s" : ""} imported successfully
                </p>
                {result.failed > 0 && (
                  <p className="text-[12px] text-[#963522]">{result.failed} row{result.failed !== 1 ? "s" : ""} skipped due to errors</p>
                )}
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-md border border-[#B3432B]/15 bg-[#B3432B]/[0.03]">
                <table className="w-full text-left text-[12px]">
                  <thead className="border-b border-[#B3432B]/15 bg-[#B3432B]/[0.04]">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-[#963522]/70">Row</th>
                      <th className="px-3 py-2 font-semibold text-[#963522]/70">Name</th>
                      <th className="px-3 py-2 font-semibold text-[#963522]/70">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#B3432B]/10">
                    {result.errors.map((e) => (
                      <tr key={e.row}>
                        <td className="px-3 py-1.5 text-[#0A2240]/55">{e.row}</td>
                        <td className="px-3 py-1.5 font-medium text-[#0A2240]">{e.name}</td>
                        <td className="px-3 py-1.5 text-[#963522]">{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]"
          >
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleImport}
              disabled={!file || uploading}
              className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#002884] disabled:opacity-50"
            >
              {uploading && <Loader2 size={14} className="animate-spin" />}
              {uploading ? "Importing…" : "Import"}
            </button>
          )}
          {result && result.failed > 0 && (
            <button
              type="button"
              onClick={() => { setResult(null); setFile(null); }}
              className="rounded-md border border-[#0033AA]/20 px-4 py-2 text-[13px] font-medium text-[#0033AA] hover:bg-[#0033AA]/5"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
