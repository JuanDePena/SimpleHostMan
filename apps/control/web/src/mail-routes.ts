import {
  noticeReturnTo
} from "./api-client.js";
import {
  parseMailAliasForm,
  parseMailboxForm,
  parseMailboxQuotaForm,
  parseMailDomainForm,
  parseMailPolicyForm
} from "./desired-state.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { readFormBody, redirect } from "./request.js";
import { requireSessionToken } from "./route-helpers.js";
import type { WebRouteHandler } from "./web-route-context.js";

function mailboxCredentialReturnTo(args: {
  returnTo: string | null;
  message: string;
  revealId?: string;
}): string {
  const location = noticeReturnTo(
    args.returnTo ?? buildDashboardViewUrl("mail"),
    args.message,
    "success"
  );

  if (!args.revealId) {
    return location;
  }

  const url = new URL(location, "http://localhost");
  url.searchParams.set("mailCredentialReveal", args.revealId);
  return `${url.pathname}${url.search}`;
}

export const handleMailRoute: WebRouteHandler = async ({
  api,
  request,
  response,
  url,
  requireSession
}) => {
  if (request.method === "POST" && url.pathname === "/resources/mail/domains/upsert") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const next = parseMailDomainForm(form);
    await api.upsertMailDomain(token, next);
    redirect(
      response,
      noticeReturnTo(
        form.get("returnTo") ?? buildDashboardViewUrl("mail"),
        `Saved mail domain ${next.domainName}.`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/policy/upsert") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const next = parseMailPolicyForm(form);
    await api.upsertMailPolicy(token, next);
    redirect(
      response,
      noticeReturnTo(
        form.get("returnTo") ?? buildDashboardViewUrl("mail"),
        "Saved mail anti-spam policy.",
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/domains/delete") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const domainName = form.get("domainName")?.trim() ?? "";
    await api.deleteMailDomain(token, domainName);
    redirect(
      response,
      noticeReturnTo(
        form.get("returnTo") ?? buildDashboardViewUrl("mail"),
        `Deleted mail domain ${domainName}.`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/mailboxes/upsert") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const next = parseMailboxForm(form);
    const result = await api.upsertMailbox(token, next);

    const storageBytesRaw = form.get("storageBytes")?.trim() ?? "";

    if (storageBytesRaw.length > 0) {
      const quotaForm = new URLSearchParams();
      quotaForm.set("mailboxAddress", next.address);
      quotaForm.set("storageBytes", storageBytesRaw);
      await api.upsertMailboxQuota(token, parseMailboxQuotaForm(quotaForm));
    } else {
      await api.deleteMailboxQuota(token, next.address);
    }

    redirect(
      response,
      mailboxCredentialReturnTo({
        returnTo: form.get("returnTo"),
        revealId: result.revealId,
        message:
          result.action === "generated"
            ? `Generated mailbox credential for ${next.address}.`
            : result.action === "rotated"
              ? `Rotated mailbox credential for ${next.address}.`
              : `Saved mailbox ${next.address}.`
      })
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/mailboxes/delete") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const address = form.get("address")?.trim() ?? "";
    await api.deleteMailbox(token, address);
    redirect(
      response,
      noticeReturnTo(
        form.get("returnTo") ?? buildDashboardViewUrl("mail"),
        `Deleted mailbox ${address}.`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/mailboxes/reset-credential") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const mailboxAddress = form.get("mailboxAddress")?.trim() ?? "";
    await api.resetMailboxCredential(token, { mailboxAddress });
    redirect(
      response,
      noticeReturnTo(
        form.get("returnTo") ?? buildDashboardViewUrl("mail"),
        `Marked mailbox credential as reset-required for ${mailboxAddress}.`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/mailboxes/rotate-credential") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const mailboxAddress = form.get("mailboxAddress")?.trim() ?? "";
    const result = await api.rotateMailboxCredential(token, { mailboxAddress });
    redirect(
      response,
      mailboxCredentialReturnTo({
        returnTo: form.get("returnTo"),
        revealId: result.revealId,
        message: `Rotated mailbox credential for ${mailboxAddress}.`
      })
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/aliases/upsert") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const next = parseMailAliasForm(form);
    await api.upsertMailAlias(token, next);
    redirect(
      response,
      noticeReturnTo(
        form.get("returnTo") ?? buildDashboardViewUrl("mail"),
        `Saved mail alias ${next.address}.`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/aliases/delete") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const address = form.get("address")?.trim() ?? "";
    await api.deleteMailAlias(token, address);
    redirect(
      response,
      noticeReturnTo(
        form.get("returnTo") ?? buildDashboardViewUrl("mail"),
        `Deleted mail alias ${address}.`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/quotas/upsert") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const next = parseMailboxQuotaForm(form);
    await api.upsertMailboxQuota(token, next);
    redirect(
      response,
      noticeReturnTo(
        form.get("returnTo") ?? buildDashboardViewUrl("mail"),
        `Saved mailbox quota for ${next.mailboxAddress}.`,
        "success"
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/resources/mail/quotas/delete") {
    const token = await requireSessionToken({ requireSession });
    const form = await readFormBody(request);
    const mailboxAddress = form.get("mailboxAddress")?.trim() ?? "";
    await api.deleteMailboxQuota(token, mailboxAddress);
    redirect(
      response,
      noticeReturnTo(
        form.get("returnTo") ?? buildDashboardViewUrl("mail"),
        `Deleted mailbox quota for ${mailboxAddress}.`,
        "success"
      )
    );
    return true;
  }

  return false;
};
