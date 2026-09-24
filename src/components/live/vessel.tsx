import { useId } from "react";
import type { VesselLevel } from "@/lib/brewing/vessel";

const SIZE = 300;
const C = SIZE / 2;
const R = 118; // the cup
const RING = 140; // the step timer around it
const RING_LENGTH = 2 * Math.PI * RING;
// Below the clock and its caption; higher up the label would cross them.
const LABEL_MIN_Y = C + 50;

// One wave period is 160 px; the path runs two periods past each side so the
// sideways drift can loop seamlessly.
const WAVE = `M-160 0${" q40 -7 80 0 t80 0".repeat(5)} L 640 ${SIZE} L -160 ${SIZE} Z`;

/** Height (from the SVG top) of the liquid surface for a 0–1 level. */
const surfaceY = (level: number) => C + R + 10 - (2 * R + 10) * level;

/**
 * The Live Brew centrepiece: a cup filled to the planned water and ringed by
 * the step timer. Purely presentational; everything shown is also on screen as
 * text, so it is hidden from assistive technology.
 */
export function Vessel({
  level,
  stepProgress,
  running,
  markerLabel,
  children,
}: {
  level: VesselLevel;
  /** 0–1 of the current step's duration, or null for an untimed step. */
  stepProgress: number | null;
  running: boolean;
  markerLabel: string | null;
  children: React.ReactNode;
}) {
  const clip = useId();
  const markerY = level.marker !== null ? C + R - 2 * R * level.marker : null;
  const half = markerY !== null ? Math.sqrt(Math.max(0, R * R - (markerY - C) ** 2)) : 0;
  const progress = stepProgress === null ? 0 : Math.min(1, Math.max(0, stepProgress));

  return (
    <div className="live-vessel" data-running={running}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" focusable="false">
        <defs>
          <clipPath id={clip}>
            <circle cx={C} cy={C} r={R} />
          </clipPath>
        </defs>
        <circle className="vessel-body" cx={C} cy={C} r={R} />
        <g clipPath={`url(#${clip})`}>
          <g className="vessel-liquid" style={{ transform: `translateY(${surfaceY(level.level)}px)` }}>
            <g transform="translate(0 -5)">
              <path className="vessel-wave vessel-crest" d={WAVE} />
            </g>
            <path className="vessel-wave" d={WAVE} style={{ animationDelay: "-2.5s" }} />
          </g>
        </g>
        {markerY !== null && half > 24 ? (
          <>
            {/* Notches at the rim keep the target line clear of the clock. */}
            <line className="vessel-marker" x1={C - half} x2={C - half + 22} y1={markerY} y2={markerY} />
            <line className="vessel-marker" x1={C + half - 22} x2={C + half} y1={markerY} y2={markerY} />
            {markerLabel && markerY > LABEL_MIN_Y ? (
              <text className="vessel-marker-label" x={C + half - 26} y={markerY + 4} textAnchor="end">
                {markerLabel}
              </text>
            ) : null}
          </>
        ) : null}
        <circle className="vessel-track" cx={C} cy={C} r={RING} />
        {stepProgress !== null ? (
          <circle
            className="vessel-ring"
            cx={C}
            cy={C}
            r={RING}
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - progress)}
            transform={`rotate(-90 ${C} ${C})`}
          />
        ) : null}
      </svg>
      <div className="vessel-center">{children}</div>
    </div>
  );
}
