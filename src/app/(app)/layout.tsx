import { AppShell } from "@/components/app-shell";
import { requirePageUser } from "@/server/page-guard";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return <AppShell displayName={user.displayName}>{children}</AppShell>;
}
