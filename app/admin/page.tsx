import { cookies } from "next/headers";
import { fetchMilestonesAdmin } from "@/lib/milestones";
import { AdminQueue } from "@/components/admin/AdminQueue";
import { SignOutButton } from "@/components/admin/SignOutButton";

export const metadata = { title: "Admin — Review Queue" };

// Always render fresh (depends on session + live data).
export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const cookie = cookies().toString();
  const { items, total } = await fetchMilestonesAdmin(cookie, {
    status: "PENDING",
    category: searchParams.category,
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Admin</p>
          <h1 className="mt-2 text-2xl font-bold">Pending Review Queue</h1>
          <p className="mt-1 text-sm text-gray-400">
            {total} pending {total === 1 ? "entry" : "entries"} awaiting review. Nothing
            here is public until approved.
          </p>
        </div>
        <SignOutButton />
      </div>

      <div className="mt-8">
        <AdminQueue items={items} />
      </div>
    </main>
  );
}
