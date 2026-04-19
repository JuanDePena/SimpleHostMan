import { type WebLocale } from "./request.js";
import { type WebCopyDictionary } from "./web-copy-types.js";

export const authCopyByLocale = {
  en: {
    appName: "SimpleHost",
    eyebrow: "SimpleHost admin",
    loginTitle: "SimpleHost Login",
    loginHeading: "SimpleHost Login",
    loginAccess: "Operator access",
    emailLabel: "Email",
    passwordLabel: "Password",
    signInLabel: "Sign in",
    signOutLabel: "Sign out",
    languageLabel: "Language",
    versionLabel: "Version",
    sidebarSearchPlaceholder: "Search navigation"
  },
  es: {
    appName: "SimpleHost",
    eyebrow: "Administración SimpleHost",
    loginTitle: "Acceso a SimpleHost",
    loginHeading: "SimpleHost Login",
    loginAccess: "Acceso de operador",
    emailLabel: "Correo",
    passwordLabel: "Contraseña",
    signInLabel: "Entrar",
    signOutLabel: "Salir",
    languageLabel: "Idioma",
    versionLabel: "Versión",
    sidebarSearchPlaceholder: "Buscar opción"
  }
} satisfies Record<WebLocale, WebCopyDictionary>;
