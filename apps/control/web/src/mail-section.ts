import { type DashboardData } from "./api-client.js";
import { getMailSectionCopy } from "./mail-section-copy.js";
import { buildMailSectionModel } from "./mail-section-model.js";
import { renderMailSectionContent } from "./mail-section-panels.js";
import { type WebLocale } from "./request.js";
import {
  type MailCredentialRevealViewModel,
  type MailSectionCopy,
  type MailSectionRenderers
} from "./mail-section-types.js";

export function renderMailSection(
  data: DashboardData,
  copy: MailSectionCopy,
  locale: WebLocale,
  focus: string | undefined,
  returnTo: string,
  mailCredentialReveal: MailCredentialRevealViewModel | undefined,
  renderers: MailSectionRenderers
): string {
  const mailCopy = getMailSectionCopy(locale);
  const model = buildMailSectionModel(data, focus);

  return renderMailSectionContent({
    copy,
    data,
    locale,
    mailCopy,
    mailCredentialReveal,
    model,
    renderers,
    returnTo
  });
}
