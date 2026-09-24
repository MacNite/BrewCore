import { describe, expect, it } from "vitest";
import { vesselLevel } from "./vessel";

// Rinse, bloom to 45 g, pour to 150 g, pour to 250 g, drawdown.
const steps = [{ waterTargetG: null }, { waterTargetG: 45 }, { waterTargetG: 150 }, { waterTargetG: 250 }, { waterTargetG: null }];

describe("vessel level", () => {
  it("is empty before any water", () => {
    expect(vesselLevel(steps, 0, "READY", 250)).toEqual({ level: 0, marker: null });
  });

  it("marks the pour target and fills to it once the step runs", () => {
    expect(vesselLevel(steps, 1, "READY", 250)).toEqual({ level: 0, marker: 0.18 });
    expect(vesselLevel(steps, 1, "RUNNING", 250)).toEqual({ level: 0.18, marker: 0.18 });
    expect(vesselLevel(steps, 2, "PAUSED", 250)).toEqual({ level: 0.6, marker: 0.6 });
  });

  it("keeps the last cumulative target through steps without water", () => {
    expect(vesselLevel(steps, 4, "RUNNING", 250)).toEqual({ level: 1, marker: null });
  });

  it("never overflows when a target exceeds the brew's water", () => {
    expect(vesselLevel([{ waterTargetG: 300 }], 0, "RUNNING", 250)).toEqual({ level: 1, marker: 1 });
  });

  it("stays empty for a recipe without water targets", () => {
    expect(vesselLevel([{ waterTargetG: null }], 0, "RUNNING", 0)).toEqual({ level: 0, marker: null });
  });
});
