"use client";

import { Button } from "@/components/ui/button";

export function ReportActions({ filename, headers, rows }: { filename: string; headers: string[]; rows: string[][] }) {
  function download() {
    const csv = [headers, ...rows]
      .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="no-print flex gap-2">
      <Button type="button" variant="outline" className="h-10" onClick={download}>Download CSV</Button>
      <Button type="button" className="h-10" onClick={() => window.print()}>Print</Button>
    </div>
  );
}
