import type en from "../messages/en.json";
import type { Locale } from "./i18n/locales";

// Typed messages: a missing or misspelled key is a type error, not a runtime
// fallback string. `tests/i18n.test.ts` keeps de.json in step with en.json.
declare module "next-intl" {
  interface AppConfig {
    Messages: typeof en;
    Locale: Locale;
  }
}
