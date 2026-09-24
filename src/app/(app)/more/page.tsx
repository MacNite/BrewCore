import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageUser } from "@/server/page-guard";
import { PageHead } from "@/components/ui";
import { LogoutButton } from "@/components/logout-button";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("more") };
}

/** The mobile "More" tab (§38): everything that is not on the bottom bar. */
export default async function MorePage() {
  const user = await requirePageUser();
  const t = await getTranslations("nav");
  const links = [
    { href: "/brews", label: t("history") },
    { href: "/grinders", label: t("grinders") },
    { href: "/roasters", label: t("roasters") },
    { href: "/brewers", label: t("brewers") },
    { href: "/settings", label: t("settings") },
    ...(user.role === "ADMIN" ? [{ href: "/admin", label: t("admin") }] : []),
  ];
  return (
    <>
      <PageHead title={t("more")} />
      <ul className="list">
        {links.map((link) => (
          <li key={link.href}>
            <Link className="list-item" href={link.href}>
              <span className="grow title">{link.label}</span>
              <span aria-hidden="true">›</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="section">
        <LogoutButton className="btn btn-block" />
      </div>
    </>
  );
}
