"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/admin/login" })}
      className="rounded-md border border-edge px-3 py-1.5 text-xs text-gray-700 hover:border-gray-300 hover:text-ink"
    >
      Sign out
    </button>
  );
}
