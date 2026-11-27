import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { DatabaseOffline } from "@/modules/dashboard/components/database-offline";
import { isDatabaseReachable } from "@/modules/dashboard/queries/shared";
import { AccessNotice, getSettingsAccess } from "@/modules/people/components/settings-access";
import { SectorsPanel } from "@/modules/people/components/sectors-panel";
import { listSectors } from "@/modules/people/queries";
import { SettingsSkeleton } from "../settings-skeleton";

export const metadata: Metadata = { title: "Setores" };

export default function SetoresPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SectorsContent />
    </Suspense>
  );
}

async function SectorsContent() {
  if (!(await isDatabaseReachable(db))) return <DatabaseOffline />;
  const [access, sectors] = await Promise.all([getSettingsAccess(), listSectors(db)]);
  return (
    <div className="space-y-4">
      <AccessNotice access={access} />
      <SectorsPanel sectors={sectors} canEdit={access.canEdit} />
    </div>
  );
}
