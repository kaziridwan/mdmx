"use client";

/** Temporary stand-in for views that land later in the 0.4.0 milestones. */
export function PlaceholderView({ title }: { title: string }) {
  return (
    <div className="mdmx-dash-view">
      <header className="mdmx-dash-view-head">
        <h1>{title}</h1>
      </header>
      <div className="mdmx-dash-empty">
        <p>This surface isn't wired up yet.</p>
      </div>
    </div>
  );
}
