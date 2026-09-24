import { describe, expect, it } from "vitest";
import {
  brewElapsedMs,
  completionPayload,
  createLiveBrew,
  transition,
  view,
  type LiveBrewState,
  type LiveEvent,
  type LiveStep,
} from "./state-machine";

const step = (overrides: Partial<LiveStep>): LiveStep => ({
  recipeStepId: null,
  position: 0,
  type: "CUSTOM",
  title: null,
  instruction: "",
  durationSeconds: null,
  targetElapsedSeconds: null,
  targetElapsedMaxSeconds: null,
  waterTargetG: null,
  temperatureC: null,
  requiresConfirmation: false,
  autoAdvance: false,
  ...overrides,
});

/** The V60 example from §89. */
const v60: LiveStep[] = [
  step({ position: 1, type: "PREPARE", instruction: "Rinse filter", requiresConfirmation: true }),
  step({ position: 2, type: "ADD_COFFEE", instruction: "Add 20 g coffee", requiresConfirmation: true }),
  step({ position: 3, type: "TARE", instruction: "Tare", requiresConfirmation: true }),
  step({ position: 4, type: "BLOOM", instruction: "Pour to 60 g", waterTargetG: 60, durationSeconds: 45, autoAdvance: true }),
  step({ position: 5, type: "POUR", instruction: "Pour to 200 g", waterTargetG: 200, targetElapsedSeconds: 75, autoAdvance: true }),
  step({ position: 6, type: "POUR", instruction: "Pour to 320 g", waterTargetG: 320, targetElapsedSeconds: 105 }),
  step({ position: 7, type: "DRAW_DOWN", instruction: "Drawdown", targetElapsedSeconds: 165, targetElapsedMaxSeconds: 195 }),
  step({ position: 8, type: "SERVE", instruction: "Serve" }),
];

const T0 = 1_750_000_000_000;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `result-${i}`);
const fresh = (steps = v60) => createLiveBrew({ brewId: "brew-1", steps, resultIds: ids(steps.length), now: T0 });

function run(state: LiveBrewState, ...events: LiveEvent[]) {
  return events.reduce(transition, state);
}

/** Confirms the three preparation steps and starts the timer at `at`. */
function started(at = T0 + 10_000) {
  return run(fresh(), { type: "NEXT", now: T0 + 1000 }, { type: "NEXT", now: T0 + 2000 }, { type: "NEXT", now: T0 + 3000 }, { type: "START", now: at });
}

describe("ready state and preparation", () => {
  it("opens READY on the first step with the clock at zero", () => {
    const state = fresh();
    expect(state.status).toBe("READY");
    expect(view(state, T0 + 60_000).brewElapsedMs).toBe(0);
  });

  it("confirms preparation steps without starting the clock", () => {
    const state = run(fresh(), { type: "NEXT", now: T0 + 1000 }, { type: "NEXT", now: T0 + 2000 });
    expect(state.status).toBe("READY");
    expect(state.currentStepIndex).toBe(2);
    expect(state.brewStartedAt).toBeNull();
    expect(state.completedSteps.map((r) => r.stepIndex)).toEqual([0, 1]);
  });

  it("does not advance past a brewing step before the timer starts", () => {
    const ready = run(fresh(), { type: "NEXT", now: 1 }, { type: "NEXT", now: 2 }, { type: "NEXT", now: 3 });
    expect(ready.currentStepIndex).toBe(3);
    expect(transition(ready, { type: "NEXT", now: 4 })).toBe(ready);
    expect(view(ready, 4).can.next).toBe(false);
    expect(view(ready, 4).can.start).toBe(true);
  });

  it("rejects pause before start", () => {
    const state = fresh();
    expect(transition(state, { type: "PAUSE", now: T0 })).toBe(state);
  });
});

describe("normal running", () => {
  it("derives elapsed time from timestamps", () => {
    const state = started(T0 + 10_000);
    expect(state.status).toBe("RUNNING");
    expect(brewElapsedMs(state, T0 + 10_000 + 12_345)).toBe(12_345);
  });

  it("shows the bloom target and the derived amount to add", () => {
    const v = view(started(), T0 + 11_000);
    expect(v.step.type).toBe("BLOOM");
    expect(v.waterTargetG).toBe(60);
    expect(v.waterAddG).toBe(60);
    expect(v.stepRemainingMs).toBe(44_000);
    expect(v.nextStep?.type).toBe("POUR");
  });
});

describe("step transitions", () => {
  it("auto-advances the bloom at exactly 45 s", () => {
    const start = T0 + 10_000;
    const state = transition(started(start), { type: "TICK", now: start + 45_000 });
    expect(state.currentStepIndex).toBe(4);
    expect(state.stepStartedElapsedMs).toBe(45_000);
    expect(view(state, start + 45_000).waterAddG).toBe(140);
  });

  it("handles a late browser tick without stretching the step", () => {
    const start = T0 + 10_000;
    // The tab was throttled: the first tick after the bloom arrives at 60 s.
    const state = transition(started(start), { type: "TICK", now: start + 60_000 });
    expect(state.currentStepIndex).toBe(4);
    const bloom = state.completedSteps.find((r) => r.stepIndex === 3)!;
    expect(bloom.completedElapsedMs).toBe(45_000);
    expect(bloom.completedAt).toBe(start + 45_000);
    expect(state.stepStartedAt).toBe(start + 45_000);
  });

  it("crosses several auto-advance boundaries in one late tick", () => {
    const start = T0 + 10_000;
    // Bloom ends at 45 s, the first pour's target is 1:15; one tick at 1:20.
    const state = transition(started(start), { type: "TICK", now: start + 80_000 });
    expect(state.currentStepIndex).toBe(5);
    expect(state.stepStartedElapsedMs).toBe(75_000);
    expect(state.status).toBe("RUNNING");
  });

  it("waits in STEP_COMPLETE for a step without auto advance", () => {
    const start = T0 + 10_000;
    const state = transition(started(start), { type: "TICK", now: start + 110_000 });
    expect(state.currentStepIndex).toBe(5);
    expect(state.status).toBe("STEP_COMPLETE");
    // The clock keeps running while waiting.
    expect(brewElapsedMs(state, start + 120_000)).toBe(120_000);
    const next = transition(state, { type: "NEXT", now: start + 112_000 });
    expect(next.status).toBe("RUNNING");
    expect(next.currentStepIndex).toBe(6);
  });

  it("advances manually before a step is due", () => {
    const start = T0 + 10_000;
    const state = transition(started(start), { type: "NEXT", now: start + 30_000 });
    expect(state.currentStepIndex).toBe(4);
    expect(state.completedSteps.find((r) => r.stepIndex === 3)?.completedElapsedMs).toBe(30_000);
  });

  it("goes back to the previous step and redoes it", () => {
    const start = T0 + 10_000;
    const state = run(started(start), { type: "NEXT", now: start + 30_000 }, { type: "PREVIOUS", now: start + 32_000 });
    expect(state.currentStepIndex).toBe(3);
    expect(state.stepStartedElapsedMs).toBe(32_000);
    expect(state.completedSteps.some((r) => r.stepIndex === 3)).toBe(false);
  });

  it("skips a step and records it as skipped", () => {
    const start = T0 + 10_000;
    const state = transition(started(start), { type: "SKIP", now: start + 5_000 });
    expect(state.currentStepIndex).toBe(4);
    expect(state.completedSteps.find((r) => r.stepIndex === 3)?.skipped).toBe(true);
  });

  it("never auto-advances a step that requires confirmation", () => {
    const steps = [step({ durationSeconds: 10, autoAdvance: true, requiresConfirmation: true }), step({})];
    const state = run(fresh(steps), { type: "START", now: T0 }, { type: "TICK", now: T0 + 20_000 });
    expect(state.currentStepIndex).toBe(0);
    expect(state.status).toBe("STEP_COMPLETE");
  });

  it("never auto-finishes on the last step", () => {
    const steps = [step({ durationSeconds: 10, autoAdvance: true })];
    const state = run(fresh(steps), { type: "START", now: T0 }, { type: "TICK", now: T0 + 20_000 });
    expect(state.status).toBe("STEP_COMPLETE");
  });

  it("finishes when Next is pressed on the last step", () => {
    const steps = [step({}), step({})];
    const state = run(fresh(steps), { type: "START", now: T0 }, { type: "NEXT", now: T0 + 1000 }, { type: "NEXT", now: T0 + 2000 });
    expect(state.status).toBe("FINISHED");
    expect(state.finishedAt).toBe(T0 + 2000);
  });
});

describe("pause and resume", () => {
  it("freezes the clock while paused and excludes the pause afterwards", () => {
    const start = T0 + 10_000;
    const paused = transition(started(start), { type: "PAUSE", now: start + 20_000 });
    expect(paused.status).toBe("PAUSED");
    expect(brewElapsedMs(paused, start + 50_000)).toBe(20_000);
    const resumed = transition(paused, { type: "RESUME", now: start + 50_000 });
    expect(resumed.status).toBe("RUNNING");
    expect(resumed.totalPausedMs).toBe(30_000);
    expect(brewElapsedMs(resumed, start + 55_000)).toBe(25_000);
  });

  it("does not let a step become due while paused", () => {
    const start = T0 + 10_000;
    const state = run(started(start), { type: "PAUSE", now: start + 40_000 }, { type: "TICK", now: start + 100_000 });
    expect(state.currentStepIndex).toBe(3);
    const resumed = run(state, { type: "RESUME", now: start + 100_000 }, { type: "TICK", now: start + 104_000 });
    expect(resumed.currentStepIndex).toBe(3);
    const due = transition(resumed, { type: "TICK", now: start + 105_000 });
    expect(due.currentStepIndex).toBe(4);
  });

  it("adds up multiple pauses", () => {
    const start = T0;
    const state = run(
      fresh([step({}), step({})]),
      { type: "START", now: start },
      { type: "PAUSE", now: start + 10_000 },
      { type: "RESUME", now: start + 15_000 },
      { type: "PAUSE", now: start + 20_000 },
      { type: "RESUME", now: start + 30_000 },
    );
    expect(state.totalPausedMs).toBe(15_000);
    expect(brewElapsedMs(state, start + 40_000)).toBe(25_000);
  });

  it("returns to STEP_COMPLETE when paused while waiting", () => {
    const steps = [step({ durationSeconds: 5 }), step({})];
    const state = run(
      fresh(steps),
      { type: "START", now: T0 },
      { type: "TICK", now: T0 + 6000 },
      { type: "PAUSE", now: T0 + 7000 },
      { type: "RESUME", now: T0 + 9000 },
    );
    expect(state.status).toBe("STEP_COMPLETE");
  });

  it("ignores next while paused", () => {
    const paused = transition(started(), { type: "PAUSE", now: T0 + 20_000 });
    expect(transition(paused, { type: "NEXT", now: T0 + 21_000 })).toBe(paused);
  });
});

describe("finish, abort and restore", () => {
  it("finishes from a pause without counting the pause", () => {
    const start = T0;
    const state = run(
      fresh([step({}), step({})]),
      { type: "START", now: start },
      { type: "PAUSE", now: start + 60_000 },
      { type: "FINISH", now: start + 90_000 },
    );
    expect(state.status).toBe("FINISHED");
    expect(brewElapsedMs(state, start + 999_999)).toBe(60_000);
  });

  it("marks unreached steps as skipped on finish", () => {
    const start = T0 + 10_000;
    const state = transition(started(start), { type: "FINISH", now: start + 20_000 });
    const payload = completionPayload(state);
    expect(payload.steps).toHaveLength(8);
    expect(payload.steps.slice(4).every((s) => s.skipped)).toBe(true);
    expect(payload.steps[3].skipped).toBe(false);
    expect(payload.steps[3].actualDurationSeconds).toBe(20);
  });

  it("aborts from any active state and ignores later events", () => {
    const aborted = transition(started(), { type: "ABORT", now: T0 + 30_000 });
    expect(aborted.status).toBe("ABORTED");
    expect(transition(aborted, { type: "RESUME", now: T0 + 31_000 })).toBe(aborted);
    expect(transition(fresh(), { type: "ABORT", now: T0 }).status).toBe("ABORTED");
  });

  it("restores from JSON and continues on the right time", () => {
    const start = T0 + 10_000;
    const saved = JSON.parse(JSON.stringify(started(start))) as LiveBrewState;
    // Page reload 50 s in; the first tick after restore settles the bloom.
    const restored = transition(saved, { type: "TICK", now: start + 50_000 });
    expect(restored.currentStepIndex).toBe(4);
    expect(view(restored, start + 50_000).brewElapsedMs).toBe(50_000);
  });

  it("builds an idempotent completion payload with client timestamps", () => {
    const start = T0 + 10_000;
    const finished = run(
      started(start),
      { type: "SET_OVERRIDES", now: start + 1, overrides: { waterActualG: 318, notes: "  tasty " } },
      { type: "FINISH", now: start + 180_000 },
    );
    const a = completionPayload(finished);
    const b = completionPayload(JSON.parse(JSON.stringify(finished)));
    expect(a).toEqual(b);
    expect(a.startedAt).toBe(new Date(start).toISOString());
    expect(a.completedAt).toBe(new Date(start + 180_000).toISOString());
    expect(a.actualDurationSeconds).toBe(180);
    expect(a.waterActualG).toBe(318);
    expect(a.notes).toBe("tasty");
    expect(a.steps.map((s) => s.id)).toEqual(ids(8));
  });

  it("refuses to build a payload before the brew is finished", () => {
    expect(() => completionPayload(started())).toThrow();
  });
});

describe("view", () => {
  it("flags a brew that is behind the target range", () => {
    const steps = [step({ targetElapsedSeconds: 10, targetElapsedMaxSeconds: 20 })];
    const state = transition(fresh(steps), { type: "START", now: T0 });
    expect(view(state, T0 + 15_000).behindTarget).toBe(false);
    expect(view(state, T0 + 25_000).behindTarget).toBe(true);
  });
});
