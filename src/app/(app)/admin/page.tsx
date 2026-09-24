import { getLocale, getTranslations } from "next-intl/server";
import { requireAdminPage } from "@/server/page-guard";
import { adminOverview, invitationUrl } from "@/server/admin";
import { inviteUserAction, resetUserPasswordAction, revokeInvitationAction, setUserActiveAction, setUserRoleAction } from "@/server/admin-actions";
import { registrationMode } from "@/lib/env";
import { PageHead } from "@/components/ui";
import { ConfirmSubmit } from "@/components/form-bits";
import { formatDate, formatDateTime, type AppLocale } from "@/lib/format";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: t("title") };
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ token?: string; temporary?: string; error?: string }> }) {
  const admin = await requireAdminPage();
  const t = await getTranslations("admin");
  const locale = (await getLocale()) as AppLocale;
  const params = await searchParams;
  const { users, invitations } = await adminOverview();

  return (
    <>
      <PageHead title={t("title")} subtitle={t("registrationMode", { mode: registrationMode() })} />

      {params.token ? (
        <div className="notice notice-success" role="status">
          <div>
            <strong>{t("inviteCreated")}</strong>
            <p style={{ margin: "6px 0" }}>{t("inviteCopy")}</p>
            <input readOnly value={invitationUrl(params.token)} aria-label={t("inviteLink")} />
          </div>
        </div>
      ) : null}
      {params.temporary ? (
        <div className="notice notice-warn" role="status">
          <div>
            <strong>{t("temporaryPassword")}</strong>
            <p style={{ margin: "6px 0" }}>{t("temporaryHint")}</p>
            <code style={{ fontSize: "1.1rem" }}>{params.temporary}</code>
          </div>
        </div>
      ) : null}
      {params.error ? (
        <div className="notice notice-error" role="alert">
          {params.error === "self" ? t("errorSelf") : t("errorInvalid")}
        </div>
      ) : null}

      <div className="grid grid-2">
        <section className="card" aria-labelledby="invite-heading">
          <h2 id="invite-heading">{t("invite")}</h2>
          <form action={inviteUserAction}>
            <div className="field">
              <label htmlFor="invite-email">{t("email")}</label>
              <input id="invite-email" name="email" type="email" required />
            </div>
            <div className="field">
              <label htmlFor="invite-name">{t("name")}</label>
              <input id="invite-name" name="name" maxLength={80} />
            </div>
            <div className="field">
              <label htmlFor="invite-role">{t("role")}</label>
              <select id="invite-role" name="role" defaultValue="USER">
                <option value="USER">{t("roles.USER")}</option>
                <option value="ADMIN">{t("roles.ADMIN")}</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit">
              {t("createInvite")}
            </button>
          </form>
          {invitations.length > 0 ? (
            <>
              <h3 style={{ marginTop: 18 }}>{t("openInvites")}</h3>
              <ul className="list">
                {invitations.map((invitation) => (
                  <li key={invitation.id} className="list-item">
                    <div className="grow">
                      <div className="title">{invitation.email}</div>
                      <div className="meta">{t("expires", { date: formatDateTime(invitation.expiresAt, locale) })}</div>
                    </div>
                    <form action={revokeInvitationAction} className="inline-form">
                      <input type="hidden" name="invitationId" value={invitation.id} />
                      <button className="btn btn-danger" type="submit">
                        {t("revoke")}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section className="card" aria-labelledby="users-heading">
          <h2 id="users-heading">{t("users")}</h2>
          <ul className="list">
            {users.map((user) => (
              <li key={user.id} className="list-item" style={{ flexWrap: "wrap" }}>
                <div className="grow">
                  <div className="title">
                    {user.profile?.displayName ?? user.username} <span className="badge">{t(`roles.${user.role}`)}</span>
                    {!user.active ? <span className="badge badge-danger"> {t("inactive")}</span> : null}
                  </div>
                  <div className="meta">
                    {user.email} · {t("since", { date: formatDate(user.createdAt, locale) })} · {t("brewCount", { count: user._count.brews })}
                  </div>
                </div>
                {user.id !== admin.id ? (
                  <div className="tags">
                    <form action={setUserActiveAction} className="inline-form">
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="active" value={user.active ? "false" : "true"} />
                      <button className="btn" type="submit">
                        {user.active ? t("deactivate") : t("activate")}
                      </button>
                    </form>
                    <form action={setUserRoleAction} className="inline-form">
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="role" value={user.role === "ADMIN" ? "USER" : "ADMIN"} />
                      <button className="btn" type="submit">
                        {user.role === "ADMIN" ? t("makeUser") : t("makeAdmin")}
                      </button>
                    </form>
                    <form action={resetUserPasswordAction} className="inline-form">
                      <input type="hidden" name="userId" value={user.id} />
                      <ConfirmSubmit message={t("resetConfirm")} className="btn">
                        {t("resetPassword")}
                      </ConfirmSubmit>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
