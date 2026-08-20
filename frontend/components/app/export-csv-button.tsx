"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportCsv } from "@/lib/csv";

/** Small "Export CSV" button; downloads the given rows as a CSV file. */
export function ExportCsvButton({
  filename,
  rows,
  label = "Export CSV",
}: {
  filename: string;
  rows: Record<string, unknown>[];
  label?: string;
}) {
  return (
    <Button variant="outline" size="sm" onClick={() => exportCsv(filename, rows)} disabled={rows.length === 0}>
      <Download className="size-3.5" /> {label}
    </Button>
  );
}
