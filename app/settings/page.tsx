"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import type { SettingsTab } from "@/components/SettingsModal";

const TABS: SettingsTab[] = ["profiel", "account", "weergave", "model", "data", "archief"];

// Instellingen zijn een popup (zoals bij Claude); deze route bestaat alleen
// als deeplink — hij opent de shell met de popup direct open.
function SettingsRoute() {
  const tabParam = useSearchParams().get("tab");
  const tab = TABS.includes(tabParam as SettingsTab) ? (tabParam as SettingsTab) : "profiel";
  return (
    <AppShell initialSettingsTab={tab}>
      <div className="h-full" />
    </AppShell>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsRoute />
    </Suspense>
  );
}
