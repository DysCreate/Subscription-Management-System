import Link from "next/link";

export default function AppShell({
  children,
  active,
  eyebrow,
  title,
  description,
}: {
  children: React.ReactNode;
  active: "dashboard" | "portal";
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">s</span>
          <span>subloop<span className="brand-period">.</span></span>
        </Link>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <Link className={`nav-link ${active === "dashboard" ? "active" : ""}`} href="/">
            <span className="nav-icon">▦</span> Finance overview
          </Link>
          <Link className={`nav-link ${active === "portal" ? "active" : ""}`} href="/portal">
            <span className="nav-icon">◉</span> Customer portal
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">?</span>
            <strong>Need a hand?</strong>
            <span>Explore the demo guide to learn your way around.</span>
            <Link href="/#demo-guide">View demo guide <span aria-hidden="true">→</span></Link>
          </div>
          <div className="profile">
            <div className="avatar">WS</div>
            <div><strong>Workspace</strong><span>Account</span></div>
            <span className="profile-menu" aria-hidden="true">···</span>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">SubLoop <span>/</span> {active === "dashboard" ? "Overview" : "Customer portal"}</div>
          <div className="topbar-right"><span className="live-dot" /> <span>Workspace</span><span className="topbar-divider" /> <button className="icon-button" aria-label="Notifications">♧</button></div>
        </header>
        <div className="page-container">
          <div className="page-heading">
            <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>
            <div className="heading-actions">{active === "dashboard" ? <span className="date-chip">◷ &nbsp;This month</span> : <div className="avatar customer-avatar">CU</div>}</div>
          </div>
          {children}
          <footer className="page-footer"><span>© 2026 SubLoop · Subscription operations, made simple.</span><span>Privacy &nbsp;·&nbsp; Support</span></footer>
        </div>
      </main>
    </div>
  );
}
