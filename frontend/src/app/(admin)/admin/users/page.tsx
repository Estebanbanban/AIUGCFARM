import { getUsersTable } from "@/lib/admin/queries";
import { UsersTable } from "@/components/admin/UsersTable";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; plan?: string; active?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const perPage = 20;

  const { rows, total } = await getUsersTable({
    page,
    perPage,
    search: params.search ?? "",
    planFilter: params.plan ?? "",
    activeOnly: params.active === "1",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">{total} utilisateurs au total</p>
      </div>
      <UsersTable rows={rows} total={total} page={page} perPage={perPage} />
    </div>
  );
}
