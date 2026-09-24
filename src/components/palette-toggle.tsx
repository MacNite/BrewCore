"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/** Colour palettes; each has a light and a dark variant in globals.css (§70). */
type Palette = "classic" | "roast";
const PALETTES: Palette[] = ["classic", "roast"];

export function PaletteToggle() {
  const t = useTranslations("settings");
  const [palette, setPalette] = useState<Palette>("classic");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("brewcore-palette") as Palette | null;
      if (stored && PALETTES.includes(stored)) setPalette(stored);
    } catch {
      /* Storage can be unavailable in private windows; the default still works. */
    }
  }, []);

  function apply(next: Palette) {
    setPalette(next);
    document.documentElement.setAttribute("data-palette", next);
    try {
      localStorage.setItem("brewcore-palette", next);
    } catch {
      /* Ignore: the choice simply will not persist. */
    }
  }

  return (
    <div role="group" aria-label={t("palette")} className="palette-options">
      {PALETTES.map((option) => (
        <button key={option} type="button" className="palette-option" data-palette-option={option} aria-pressed={palette === option} onClick={() => apply(option)}>
          <span className="palette-swatch" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="palette-name">{t(`palettes.${option}`)}</span>
        </button>
      ))}
    </div>
  );
}
