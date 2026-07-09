import Link from "next/link";

/** Shared chrome for the demo's public pages. */
export function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="site-header-brand">
        MDMX demo
      </Link>
      <nav className="site-header-nav">
        <Link href="/">Posts</Link>
        <Link href="/mdmx">Dashboard</Link>
      </nav>
    </header>
  );
}
