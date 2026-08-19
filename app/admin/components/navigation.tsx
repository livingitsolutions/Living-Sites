"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Organization } from "@livingsites/domain";

export function AdminNavigation({ organization, navigation }: { organization?: Organization; navigation: Array<{ label: string; href: string }> }) {
  const pathname = usePathname();
  const links = organization ? navigation : [{ label: "Organizations", href: "/admin" }];
  const content = <><Link className="brand" href="/admin"><span className="brand-mark">LS</span><span>Living Sites</span></Link>{organization ? <div className="sidebar-org"><small>Organization</small><strong>{organization.name}</strong></div> : null}<nav aria-label="Admin navigation">{links.map((item) => { const active = item.href === "/admin" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`); return <Link key={item.href} href={item.href} className={active ? "nav-link active" : "nav-link"} aria-current={active ? "page" : undefined}><span className="nav-dot" aria-hidden="true" />{item.label}</Link>; })}</nav></>;
  return <><aside className="admin-sidebar">{content}</aside><details className="mobile-navigation"><summary><span className="brand-mark">LS</span><span>Menu</span></summary><div className="mobile-navigation-panel">{content}</div></details></>;
}
