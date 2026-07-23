import Link from "next/link";
import type { ReactNode } from "react";
import { auth, signOut } from "@/lib/auth";
import "./admin.css";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/articles", label: "Articles" },
  { href: "/admin/authors", label: "Authors" },
  { href: "/admin/topics", label: "Topic Inbox" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/affiliates", label: "Affiliates" },
  { href: "/admin/youtube-cleanup", label: "YouTube Cleanup" },
  { href: "/admin/ads", label: "Ads" },
  { href: "/admin/agents", label: "Agents" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session) {
    return <div className="admin-shell">{children}</div>;
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <Link href="/admin">SLS CMS</Link>
        </div>
        <nav className="admin-nav">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <form
          className="admin-signout"
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/admin/login" });
          }}
        >
          <button type="submit">Sign out</button>
        </form>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
