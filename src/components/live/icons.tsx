/** Stroke icons for the Live Brew controls. Decorative: every use has a text label. */
const paths = {
  close: "M6 6l12 12M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7",
  previous: "M19 20L9 12l10-8v16zM5 19V5",
  skip: "M5 4l10 8-10 8V4zM19 5v14",
  pause: "M9 5v14M15 5v14",
  play: "M7 4.5v15l12-7.5-12-7.5z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  bean: "M12 3c3.9 0 6 3.6 6 8.5S15.2 21 12 21s-6-4.6-6-9.5S8.1 3 12 3zM12 3c-2 3-2 6 0 9s2 6 0 9",
  drop: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z",
  thermometer: "M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z",
  grind: "M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 22, strokeWidth = 2 }: { name: IconName; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={paths[name]} />
    </svg>
  );
}
