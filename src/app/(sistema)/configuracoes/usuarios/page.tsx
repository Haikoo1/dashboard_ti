import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { DatabaseOffline } from "@/modules/dashboard/components/database-offline";
import { isDatabaseReachable } from "@/modules/dashboard/queries/shared";
import { AccessNotice, getSettingsAccess } from "@/modules/people/components/settings-access";
import { UsersPanel } from "@/modules/people/components/users-panel";
import { listSectors, listUsers } from "@/modules/people/queries";
import { SettingsSkeleton } from "../settings-skeleton";

export const metadata: Metadata = { title: "Usuários" };

export default function UsuariosPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <UsersContent />
    </Suspense>
  );
}

async function UsersContent() {
  if (!(await isDatabaseReachable(db))) return <DatabaseOffline />;
  const [access, users, sectors] = await Promise.all([getSettingsAccess(), listUsers(db), listSectors(db)]);
  return (
    <div className="space-y-4">
      <AccessNotice access={access} />
      <UsersPanel users={users} sectors={sectors} canEdit={access.canEdit} />
    </div>
  );
}
