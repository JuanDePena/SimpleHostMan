import { type WebLocale } from "./request.js";
import { type WebCopyDictionary } from "./web-copy-types.js";

export const authCopyByLocale = {
  en: {
    appName: "SimpleHostPanel",
    eyebrow: "SimpleHostPanel admin",
    loginTitle: "SimpleHostPanel Login",
    loginHeading: "SHP Login",
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
    appName: "SimpleHostPanel",
    eyebrow: "Administración SHP",
    loginTitle: "Acceso a SimpleHostPanel",
    loginHeading: "SHP Login",
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
