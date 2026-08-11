import { Suspense } from "react";
import InventoryClient from "./client";

export const metadata = { title: "Inventory" };

export default function InventoryPage() {
  return (
    <Suspense fallback={<div style={{ padding: "var(--sp-8)", color: "var(--tx-tertiary)" }}>Loading…</div>}>
      <InventoryClient />
    </Suspense>
  );
}
