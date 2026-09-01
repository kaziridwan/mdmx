import Link from "next/link";

/** Shared chrome for the demo's public pages. */
export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-[1280px] items-center gap-4 border-b px-10 py-4 font-sans">
      <Link href="/" className="font-bold text-foreground no-underline">
        MDMX demo
      </Link>
      <nav className="ml-auto flex gap-4 text-sm">
        <Link href="/" className="text-muted-foreground no-underline hover:text-primary">
          Posts
        </Link>
        <Link href="/mdmx" className="text-muted-foreground no-underline hover:text-primary">
          Dashboard
        </Link>
      </nav>
    </header>
  );
}
