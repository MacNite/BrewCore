/**
 * The guided-brew state machine (§22, Phase 3).
 *
 * Pure and deterministic: every transition takes the current state and an
 * event carrying `now` (wall-clock ms) and returns the next state. There are no
 * timers in here and no database code. All timing is derived from timestamps:
 * the brew clock is `now - brewStartedAt - totalPausedMs`, so a throttled or
 * backgrounded tab, a late tick or a page restore still lands on the right
 * time and the right step.
 *
 * The state is plain JSON so it can be written to IndexedDB after every change
 * and restored after a reload (§23).
 *
 * Steps:
 *  - A *preparation* step (PREPARE / ADD_COFFEE / TARE with no timing and no
 *    water target) can be confirmed before the timer starts.
 *  - A step is *due* when its duration has run out (`durationSeconds`, measured
 *    on the brew clock from when the step began) or, without a duration, when
 *    the brew clock reaches `targetElapsedSeconds`. Untimed steps are never due.
 *  - A due step with `autoAdvance` (and not `requiresConfirmation`) moves on by
 *    itself at the exact moment it became due, even if the tick that notices it
 *    arrives late; otherwise the state becomes STEP_COMPLETE and waits for Next.
 *    The last step never auto-advances: finishing is always the user's call.
 */
import { elapsedMs } from "./timer";

export const LIVE_STATE_VERSION = 1;

export type LiveStatus = "READY" | "RUNNING" | "PAUSED" | "STEP_COMPLETE" | "FINISHED" | "ABORTED";

export interface LiveStep {
  recipeStepId: string | null;
  position: number;
  type: string;
  title: string | null;
  instruction: string;
  durationSeconds: number | null;
  targetElapsedSeconds: number | null;
  targetElapsedMaxSeconds: number | null;
  /** Cumulative scale target after this step, already scaled for this brew. */
  waterTargetG: number | null;
  temperatureC: number | null;
  requiresConfirmation: boolean;
  autoAdvance: boolean;
}

export interface StepRecord {
  stepIndex: number;
  /** Wall-clock ms; null for a step that was skipped without being reached. */
  startedAt: number | null;
  completedAt: number | null;
  /** Brew-clock ms; null for steps confirmed before the timer started. */
  startedElapsedMs: number | null;
  completedElapsedMs: number | null;
  skipped: boolean;
}

export interface LiveOverrides {
  waterActualG?: number | null;
  beverageWeightG?: number | null;
  notes?: string | null;
}

export interface LiveBrewState {
  version: typeof LIVE_STATE_VERSION;
  brewId: string;
  status: LiveStatus;
  steps: LiveStep[];
  /** One client-generated id per step, so a re-sent completion is idempotent. */
  resultIds: string[];
  currentStepIndex: number;
  brewStartedAt: number | null;
  /** Wall-clock ms when the current step began (null before the timer starts). */
  stepStartedAt: number | null;
  /** Brew-clock position when the current step began. */
  stepStartedElapsedMs: number;
  pausedAt: number | null;
  totalPausedMs: number;
  statusBeforePause: "RUNNING" | "STEP_COMPLETE" | null;
  finishedAt: number | null;
  abortedAt: number | null;
  currentWeight: number | null;
  manualOverrides: LiveOverrides;
  /** Sorted by stepIndex; at most one record per step. */
  completedSteps: StepRecord[];
  updatedAt: number;
}

export type LiveEvent =
  | { type: "START"; now: number }
  | { type: "TICK"; now: number }
  | { type: "PAUSE"; now: number }
  | { type: "RESUME"; now: number }
  | { type: "NEXT"; now: number }
  | { type: "PREVIOUS"; now: number }
  | { type: "SKIP"; now: number }
  | { type: "FINISH"; now: number }
  | { type: "ABORT"; now: number }
  | { type: "SET_WEIGHT"; now: number; weightG: number | null }
  | { type: "SET_OVERRIDES"; now: number; overrides: LiveOverrides };

const PREPARATION_TYPES = new Set(["PREPARE", "ADD_COFFEE", "TARE"]);

export function isPreparationStep(step: LiveStep): boolean {
  return (
    PREPARATION_TYPES.has(step.type) &&
    step.durationSeconds === null &&
    step.targetElapsedSeconds === null &&
    step.waterTargetG === null
  );
}

export function createLiveBrew(input: { brewId: string; steps: LiveStep[]; resultIds: string[]; now: number }): LiveBrewState {
  if (input.steps.length === 0) throw new RangeError("A guided brew needs at least one step");
  if (input.resultIds.length !== input.steps.length) throw new RangeError("One result id per step is required");
  return {
    version: LIVE_STATE_VERSION,
    brewId: input.brewId,
    status: "READY",
    steps: input.steps,
    resultIds: input.resultIds,
    currentStepIndex: 0,
    brewStartedAt: null,
    stepStartedAt: null,
    stepStartedElapsedMs: 0,
    pausedAt: null,
    totalPausedMs: 0,
    statusBeforePause: null,
    finishedAt: null,
    abortedAt: null,
    currentWeight: null,
    manualOverrides: {},
    completedSteps: [],
    updatedAt: input.now,
  };
}

export const isTerminal = (state: LiveBrewState) => state.status === "FINISHED" || state.status === "ABORTED";

/** The brew clock in ms. Frozen while paused and after finish/abort. */
export function brewElapsedMs(state: LiveBrewState, now: number): number {
  return elapsedMs(
    {
      startedAt: state.brewStartedAt,
      totalPausedMs: state.totalPausedMs,
      pausedAt: state.pausedAt,
      stoppedAt: state.finishedAt ?? state.abortedAt,
    },
    now,
  );
}

/** Brew-clock ms at which the current step becomes due, or null if untimed. */
export function stepDueElapsedMs(state: LiveBrewState): number | null {
  const step = state.steps[state.currentStepIndex];
  if (!step || state.brewStartedAt === null) return null;
  if (step.durationSeconds !== null) return state.stepStartedElapsedMs + step.durationSeconds * 1000;
  if (step.targetElapsedSeconds !== null) return Math.max(step.targetElapsedSeconds * 1000, state.stepStartedElapsedMs);
  return null;
}

function withRecord(records: StepRecord[], record: StepRecord): StepRecord[] {
  return [...records.filter((entry) => entry.stepIndex !== record.stepIndex), record].sort((a, b) => a.stepIndex - b.stepIndex);
}

/** Records the current step as done at (`wall`, `elapsed`) and moves to `nextIndex`. */
function moveTo(state: LiveBrewState, nextIndex: number, wall: number, elapsed: number | null, skipped: boolean): LiveBrewState {
  const record: StepRecord = {
    stepIndex: state.currentStepIndex,
    startedAt: state.stepStartedAt,
    completedAt: wall,
    startedElapsedMs: state.brewStartedAt === null ? null : state.stepStartedElapsedMs,
    completedElapsedMs: elapsed,
    skipped,
  };
  return {
    ...state,
    completedSteps: withRecord(state.completedSteps, record),
    currentStepIndex: nextIndex,
    stepStartedAt: state.brewStartedAt === null ? null : wall,
    stepStartedElapsedMs: elapsed ?? 0,
  };
}

/** Applies every step boundary that has passed by `now` (auto-advance, STEP_COMPLETE). */
function settle(state: LiveBrewState, now: number): LiveBrewState {
  if (state.status !== "RUNNING") return state;
  let current = state;
  // Bounded by the number of steps: each iteration either advances or stops.
  for (let guard = 0; guard <= current.steps.length; guard++) {
    const due = stepDueElapsedMs(current);
    if (due === null) break;
    const elapsed = brewElapsedMs(current, now);
    if (elapsed < due) break;
    const step = current.steps[current.currentStepIndex];
    const isLast = current.currentStepIndex === current.steps.length - 1;
    if (step.autoAdvance && !step.requiresConfirmation && !isLast) {
      // The wall-clock moment the step actually became due, not when the tick
      // arrived: a late tick must not stretch the step it ends.
      const wallAtDue = now - (elapsed - due);
      current = moveTo(current, current.currentStepIndex + 1, wallAtDue, due, false);
      continue;
    }
    current = { ...current, status: "STEP_COMPLETE" };
    break;
  }
  return current;
}

function closePause(state: LiveBrewState, now: number): LiveBrewState {
  if (state.pausedAt === null) return state;
  return { ...state, totalPausedMs: state.totalPausedMs + Math.max(0, now - state.pausedAt), pausedAt: null };
}

function finish(state: LiveBrewState, now: number): LiveBrewState {
  const unpaused = closePause(state, now);
  const elapsed = brewElapsedMs(unpaused, now);
  let records = withRecord(unpaused.completedSteps, {
    stepIndex: unpaused.currentStepIndex,
    startedAt: unpaused.stepStartedAt,
    completedAt: now,
    startedElapsedMs: unpaused.stepStartedElapsedMs,
    completedElapsedMs: elapsed,
    skipped: false,
  });
  // Steps never reached are recorded as skipped, so the history says so.
  for (let index = unpaused.currentStepIndex + 1; index < unpaused.steps.length; index++) {
    records = withRecord(records, {
      stepIndex: index,
      startedAt: null,
      completedAt: null,
      startedElapsedMs: null,
      completedElapsedMs: null,
      skipped: true,
    });
  }
  return { ...unpaused, status: "FINISHED", finishedAt: now, statusBeforePause: null, completedSteps: records };
}

const running = (status: LiveStatus) => status === "RUNNING" || status === "STEP_COMPLETE";

export function transition(state: LiveBrewState, event: LiveEvent): LiveBrewState {
  const next = reduce(state, event);
  return next === state ? state : { ...next, updatedAt: event.now };
}

function reduce(state: LiveBrewState, event: LiveEvent): LiveBrewState {
  const { now } = event;
  if (isTerminal(state)) return state;
  const step = state.steps[state.currentStepIndex];
  const isLast = state.currentStepIndex === state.steps.length - 1;

  switch (event.type) {
    case "START": {
      if (state.status !== "READY") return state;
      return settle({ ...state, status: "RUNNING", brewStartedAt: now, stepStartedAt: now, stepStartedElapsedMs: 0 }, now);
    }

    case "TICK": {
      const settled = settle(state, now);
      return settled.status === state.status && settled.currentStepIndex === state.currentStepIndex ? state : settled;
    }

    case "PAUSE": {
      if (!running(state.status)) return state;
      const settled = settle(state, now);
      return { ...settled, status: "PAUSED", pausedAt: now, statusBeforePause: settled.status as "RUNNING" | "STEP_COMPLETE" };
    }

    case "RESUME": {
      if (state.status !== "PAUSED") return state;
      const resumed = closePause(state, now);
      return settle({ ...resumed, status: state.statusBeforePause ?? "RUNNING", statusBeforePause: null }, now);
    }

    case "NEXT":
    case "SKIP": {
      const skipped = event.type === "SKIP";
      if (state.status === "READY") {
        if (!isPreparationStep(step) || isLast) return state;
        return moveTo(state, state.currentStepIndex + 1, now, null, skipped);
      }
      if (!running(state.status)) return state;
      if (isLast) {
        const finished = finish(state, now);
        if (!skipped) return finished;
        return {
          ...finished,
          completedSteps: finished.completedSteps.map((record) =>
            record.stepIndex === state.currentStepIndex ? { ...record, skipped: true } : record,
          ),
        };
      }
      const elapsed = brewElapsedMs(state, now);
      return settle({ ...moveTo(state, state.currentStepIndex + 1, now, elapsed, skipped), status: "RUNNING" }, now);
    }

    case "PREVIOUS": {
      if (state.currentStepIndex === 0) return state;
      if (state.status !== "READY" && !running(state.status)) return state;
      const target = state.currentStepIndex - 1;
      const started = state.brewStartedAt !== null;
      const elapsed = started ? brewElapsedMs(state, now) : 0;
      const moved: LiveBrewState = {
        ...state,
        // The step being returned to is redone, and the one being left was
        // never completed: neither keeps a record.
        completedSteps: state.completedSteps.filter((record) => record.stepIndex < target),
        currentStepIndex: target,
        stepStartedAt: started ? now : null,
        stepStartedElapsedMs: elapsed,
        status: started ? "RUNNING" : "READY",
      };
      return settle(moved, now);
    }

    case "FINISH": {
      if (!running(state.status) && state.status !== "PAUSED") return state;
      return finish(state.status === "PAUSED" ? state : settle(state, now), now);
    }

    case "ABORT": {
      const closed = closePause(state, now);
      return { ...closed, status: "ABORTED", abortedAt: now, statusBeforePause: null };
    }

    case "SET_WEIGHT":
      return { ...state, currentWeight: event.weightG };

    case "SET_OVERRIDES":
      return { ...state, manualOverrides: { ...state.manualOverrides, ...event.overrides } };
  }
}

// ---------------------------------------------------------------------------
// Derived view for the UI
// ---------------------------------------------------------------------------

export interface LiveView {
  status: LiveStatus;
  brewElapsedMs: number;
  stepElapsedMs: number;
  /** Time left in the current step, when it has a duration or a target. */
  stepRemainingMs: number | null;
  stepIndex: number;
  stepCount: number;
  step: LiveStep;
  nextStep: LiveStep | null;
  /** Cumulative target and the derived amount to add in this step (§15). */
  waterTargetG: number | null;
  waterAddG: number | null;
  /** True once the brew clock is past the step's target range. */
  behindTarget: boolean;
  isPreparation: boolean;
  can: { start: boolean; pause: boolean; resume: boolean; next: boolean; previous: boolean; skip: boolean; finish: boolean; abort: boolean };
}

function previousWaterTarget(steps: LiveStep[], index: number): number {
  for (let i = index - 1; i >= 0; i--) {
    const target = steps[i].waterTargetG;
    if (target !== null) return target;
  }
  return 0;
}

export function view(state: LiveBrewState, now: number): LiveView {
  const step = state.steps[state.currentStepIndex];
  const brew = brewElapsedMs(state, now);
  const started = state.brewStartedAt !== null;
  const stepElapsed = started ? Math.max(0, brew - state.stepStartedElapsedMs) : 0;
  const due = stepDueElapsedMs(state);
  const limit = step.targetElapsedMaxSeconds ?? step.targetElapsedSeconds;
  const isLast = state.currentStepIndex === state.steps.length - 1;
  const preparation = isPreparationStep(step);
  const active = state.status === "RUNNING" || state.status === "STEP_COMPLETE";
  const terminal = isTerminal(state);
  const add =
    step.waterTargetG === null
      ? null
      : Math.round((step.waterTargetG - previousWaterTarget(state.steps, state.currentStepIndex)) * 10) / 10;

  return {
    status: state.status,
    brewElapsedMs: brew,
    stepElapsedMs: stepElapsed,
    stepRemainingMs: due === null ? null : Math.max(0, due - brew),
    stepIndex: state.currentStepIndex,
    stepCount: state.steps.length,
    step,
    nextStep: state.steps[state.currentStepIndex + 1] ?? null,
    waterTargetG: step.waterTargetG,
    waterAddG: add,
    behindTarget: started && limit !== null && brew > limit * 1000,
    isPreparation: preparation,
    can: {
      start: state.status === "READY",
      pause: active,
      resume: state.status === "PAUSED",
      next: active || (state.status === "READY" && preparation && !isLast),
      previous: !terminal && state.status !== "PAUSED" && state.currentStepIndex > 0,
      skip: active || (state.status === "READY" && preparation && !isLast),
      finish: active || state.status === "PAUSED",
      abort: !terminal,
    },
  };
}

// ---------------------------------------------------------------------------
// Completion payload (§57)
// ---------------------------------------------------------------------------

export interface CompletionStep {
  id: string;
  recipeStepId: string | null;
  position: number;
  type: string;
  startedAt: string | null;
  completedAt: string | null;
  targetWeightG: number | null;
  targetDurationSeconds: number | null;
  actualDurationSeconds: number | null;
  skipped: boolean;
}

export interface CompletionPayload {
  brewId: string;
  startedAt: string;
  completedAt: string;
  actualDurationSeconds: number;
  waterActualG: number | null;
  beverageWeightG: number | null;
  notes: string | null;
  steps: CompletionStep[];
}

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

/** Builds the idempotent completion request from a FINISHED state. */
export function completionPayload(state: LiveBrewState): CompletionPayload {
  if (state.status !== "FINISHED" || state.brewStartedAt === null || state.finishedAt === null) {
    throw new Error("Only a finished brew can be completed");
  }
  const byIndex = new Map(state.completedSteps.map((record) => [record.stepIndex, record]));
  return {
    brewId: state.brewId,
    startedAt: iso(state.brewStartedAt)!,
    completedAt: iso(state.finishedAt)!,
    actualDurationSeconds: Math.round(brewElapsedMs(state, state.finishedAt) / 1000),
    waterActualG: state.manualOverrides.waterActualG ?? null,
    beverageWeightG: state.manualOverrides.beverageWeightG ?? null,
    notes: state.manualOverrides.notes?.trim() || null,
    steps: state.steps.map((step, index) => {
      const record = byIndex.get(index);
      const duration =
        record && record.startedElapsedMs !== null && record.completedElapsedMs !== null
          ? Math.round((record.completedElapsedMs - record.startedElapsedMs) / 1000)
          : null;
      return {
        id: state.resultIds[index],
        recipeStepId: step.recipeStepId,
        position: step.position,
        type: step.type,
        startedAt: iso(record?.startedAt ?? null),
        completedAt: iso(record?.completedAt ?? null),
        targetWeightG: step.waterTargetG,
        targetDurationSeconds: step.durationSeconds,
        actualDurationSeconds: duration,
        skipped: record ? record.skipped : true,
      };
    }),
  };
}
