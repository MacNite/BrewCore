"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "./theme-toggle";
import { PwaRuntime } from "./pwa-runtime";

/** Desktop navigation. */
const NAV = [
  { href: "/", key: "home" },
  { href: "/coffees", key: "coffees" },
  { href: "/recipes", key: "recipes" },
  { href: "/brews", key: "history" },
  { href: "/grinders", key: "grinders" },
  { href: "/more", key: "more" },
] as const;

/**
 * Mobile navigation (§38): Home · Coffee · Brew · Recipes · More, with a
 * persistent centre Brew button so starting a brew is always one tap away.
 */
const MOBILE_NAV = [
  { href: "/", key: "home", icon: "⌂" },
  { href: "/coffees", key: "coffees", icon: "◍" },
  { href: "/brew/new", key: "brew", icon: "▶", brew: true },
  { href: "/recipes", key: "recipes", icon: "☰" },
  { href: "/more", key: "more", icon: "⋯" },
] as const;

export function AppShell({ displayName, children }: { displayName: string; children: React.ReactNode }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const isCurrent = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <>
      <a className="skip-link" href="#main">
        {t("skipToContent")}
      </a>
      <div className="shell">
        <header className="topbar">
          <Link className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              B
            </span>
            BrewCore
          </Link>

          <nav className="nav" aria-label={t("main")}>
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} aria-current={isCurrent(item.href) ? "page" : undefined}>
                {t(item.key)}
              </Link>
            ))}
          </nav>

          <div className="topbar-actions">
            <PwaRuntime />
            <Link className="btn btn-primary desktop-only" href="/brew/new">
              {t("startBrew")}
            </Link>
            <ThemeToggle />
            <Link href="/settings" className="icon-btn" title={displayName} aria-label={t("account")}>
              <span aria-hidden="true" className="brand-mark" style={{ width: 34, height: 34, borderRadius: "50%", fontSize: 13 }}>
                {initials}
              </span>
            </Link>
          </div>
        </header>

        <main id="main">{children}</main>
      </div>

      <nav className="bottom-nav" aria-label={t("main")}>
        {MOBILE_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={"brew" in item ? "brew-button" : undefined}
            aria-current={isCurrent(item.href) ? "page" : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            {t(item.key)}
          </Link>
        ))}
      </nav>
    </>
  );
}
