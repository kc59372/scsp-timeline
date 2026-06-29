import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { fetchMilestoneAdmin } from "@/lib/milestones";
import { EditForm } from "@/components/admin/EditForm";

export const dynamic = "force-dynamic";

export default async function EditMilestone({ params }: { params: { id: string } }) {
  const cookie = cookies().toString();
  const milestone = await fetchMilestoneAdmin(params.id, cookie);
  if (!milestone) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="font-mono text-xs text-gray-500 hover:text-blue-400">
        ← Back to queue
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Edit Entry</h1>
      <p className="mt-1 text-sm text-gray-400">
        Status: <span className="font-mono uppercase">{milestone.entryStatus}</span> · review and
        correct fields before approving.
      </p>
      <EditForm milestone={milestone} />
    </main>
  );
}
