import Link from "next/link";

/** One breadcrumb past the root brand; the last item renders as plain text. */
export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Shared top bar for the CMS. The brand always links home; `crumbs` render as a
 * trail after it so every page (list, collection, editor) has a way back.
 */
export function CmsHeader({ crumbs = [] }: { crumbs?: Crumb[] }) {
  return (
    <header className="mdmx-cms-header">
      <nav className="mdmx-cms-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/" className="mdmx-cms-brand">
          MDMX
        </Link>
        {crumbs.map((crumb, i) => (
          <span key={i} className="mdmx-cms-crumb">
            <span className="mdmx-cms-sep" aria-hidden="true">
              /
            </span>
            {crumb.href ? (
              <Link href={crumb.href} className="mdmx-cms-crumb-link">
                {crumb.label}
              </Link>
            ) : (
              <span className="mdmx-cms-crumb-current" aria-current="page">
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>
    </header>
  );
}
