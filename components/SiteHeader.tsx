import Link from "next/link";

/** SCSP-styled site header (ports legacy .site-header). */
export function SiteHeader() {
  return (
    <header className="relative overflow-hidden border-b border-edge">
      <div className="pointer-events-none absolute left-[10%] top-0 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.08)_0%,rgba(0,0,0,0)_70%)]" />
      <div className="relative z-10 mx-auto max-w-4xl px-6 py-10">
        <Link
          href="/"
          className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-blue-400 hover:text-blue-300"
        >
          Special Competitive Studies Project
        </Link>
        <nav className="mt-4 flex gap-5 text-sm">
          <Link href="/" className="text-gray-400 hover:text-gray-100">Home</Link>
          <Link href="/timeline" className="text-gray-400 hover:text-gray-100">Timeline</Link>
        </nav>
      </div>
    </header>
  );
}
