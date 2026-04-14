import { type WebLocale } from "./request.js";
import { authCopyByLocale } from "./web-copy-auth.js";
import { navigationCopyByLocale } from "./web-copy-navigation.js";
import { operationsCopyByLocale } from "./web-copy-operations.js";
import { resourcesCopyByLocale } from "./web-copy-resources.js";

export const copyByLocale = {
  en: {
    ...authCopyByLocale.en,
    ...navigationCopyByLocale.en,
    ...operationsCopyByLocale.en,
    ...resourcesCopyByLocale.en
  },
  es: {
    ...authCopyByLocale.es,
    ...navigationCopyByLocale.es,
    ...operationsCopyByLocale.es,
    ...resourcesCopyByLocale.es
  }
} satisfies Record<WebLocale, Record<string, string>>;

export type WebCopy = (typeof copyByLocale)[WebLocale];
