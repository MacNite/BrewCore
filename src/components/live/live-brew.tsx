"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { LiveBrew } from "@/server/brews";
import {
  completionPayload,
  createLiveBrew,
  isTerminal,
  transition,
  view,
  type LiveBrewState,
  type LiveEvent,
} from "@/lib/brewing/state-machine";
import { formatClock, formatSeconds } from "@/lib/brewing/timer";
import { displayGrams } from "@/lib/brewing/scaling";
import type { StepType } from "@/lib/brewing/recipe";
import { vesselLevel } from "@/lib/brewing/vessel";
import { deleteLocalBrew, enqueue, getLocalBrew, putLocalBrew } from "@/lib/offline/db";
import { warmOfflineCache } from "@/lib/offline/offline-cache";
import { PwaRuntime, requestSync } from "@/components/pwa-runtime";
import { useWakeLock } from "./use-wake-lock";
import { playTone, unlockAudio, vibrate } from "./cues";
import { PostBrew } from "./post-brew";
import { Icon } from "./icons";
import { Vessel } from "./vessel";

const TICK_MS = 250;

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));

type Phase = "loading" | "live" | "finishing" | "done-remote" | "aborted-remote";

export function LiveBrewScreen({ brew, cues }: { brew: LiveBrew; cues: { sound: boolean; vibration: boolean } }) {
  const t = useTranslations("live");
  const stepTypes = useTranslations("stepTypes");
  const locale = useLocale();
  const router = useRouter();
  const [state, setState] = useState<LiveBrewState | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [now, setNow] = useState(() => Date.now());
  const [restored, setRestored] = useState(false);
  const [flash, setFlash] = useState(false);
  const stateRef = useRef<LiveBrewState | null>(null);
  const announcer = useRef<HTMLDivElement>(null);
  const abortDialog = useRef<HTMLDialogElement>(null);
  const finishDialog = useRef<HTMLDialogElement>(null);

  const context = { recipeName: brew.snapshot.name, coffeeName: brew.coffeeName, grinderName: brew.grinderName };

  const persist = useCallback(
    (next: LiveBrewState) => {
      void putLocalBrew({ brewId: brew.id, state: next, context, savedAt: Date.now() });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [brew.id],
  );

  /** The one way state changes: pure transition, then persist (§23). */
  const dispatch = useCallback(
    (event: LiveEvent) => {
      const current = stateRef.current;
      if (!current) return current;
      const next = transition(current, event);
      if (next === current) return current;
      stateRef.current = next;
      setState(next);
      persist(next);
      return next;
    },
    [persist],
  );

  // Load: local state wins; otherwise start fresh from the server snapshot.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await getLocalBrew(brew.id);
      if (cancelled) return;
      if (local && local.state.brewId === brew.id) {
        stateRef.current = local.state;
        setState(local.state);
        setRestored(local.state.status !== "READY");
        setPhase(local.state.status === "FINISHED" ? "finishing" : "live");
        return;
      }
      if (brew.status === "COMPLETED") return setPhase("done-remote");
      if (brew.status === "ABORTED") return setPhase("aborted-remote");
      const fresh = createLiveBrew({
        brewId: brew.id,
        steps: brew.snapshot.steps,
        resultIds: brew.snapshot.steps.map(() => newId()),
        now: Date.now(),
      });
      stateRef.current = fresh;
      setState(fresh);
      persist(fresh);
      setPhase("live");
    })();
    void warmOfflineCache();
    return () => {
      cancelled = true;
    };
  }, [brew.id, brew.status, brew.snapshot.steps, persist]);

  // The display clock. Timing itself is derived from timestamps (§22); this
  // only decides how often the screen re-reads it.
  useEffect(() => {
    if (!state || isTerminal(state) || state.status === "READY") return;
    const timer = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      dispatch({ type: "TICK", now: at });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [state?.status, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Catch up immediately when the tab comes back, and save on the way out (§74).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        const at = Date.now();
        setNow(at);
        dispatch({ type: "TICK", now: at });
      } else if (stateRef.current) {
        persist(stateRef.current);
      }
    };
    const onPageHide = () => stateRef.current && persist(stateRef.current);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [dispatch, persist]);

  const active = Boolean(state && !isTerminal(state) && state.status !== "READY");
  useWakeLock(active);

  // Guard against accidental navigation while brewing (§21).
  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);

  // Cues and announcements on every step change (§72).
  const cueKey = state ? `${state.currentStepIndex}:${state.status === "STEP_COMPLETE"}` : "";
  const lastCue = useRef<string>("");
  useEffect(() => {
    if (!state || !cueKey) return;
    if (lastCue.current && lastCue.current !== cueKey && state.status !== "READY" && !isTerminal(state)) {
      if (cues.sound) playTone();
      if (cues.vibration) vibrate();
      setFlash(true);
      window.setTimeout(() => setFlash(false), 700);
      const step = state.steps[state.currentStepIndex];
      if (announcer.current) {
        announcer.current.textContent =
          state.status === "STEP_COMPLETE" ? t("announceStepDone") : t("announceStep", { number: state.currentStepIndex + 1, instruction: step.instruction });
      }
    }
    lastCue.current = cueKey;
  }, [cueKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = (type: "START" | "PAUSE" | "RESUME" | "NEXT" | "PREVIOUS" | "SKIP") => {
    if (type === "START") unlockAudio();
    const at = Date.now();
    setNow(at);
    const next = dispatch({ type, now: at });
    if (next?.status === "FINISHED") void onFinished(next);
  };

  /** Finish: pause the clock while the optional actual weights are entered. */
  const openFinish = () => {
    const at = Date.now();
    setNow(at);
    if (stateRef.current?.status !== "PAUSED") dispatch({ type: "PAUSE", now: at });
    finishDialog.current?.showModal();
  };
  const cancelFinish = () => {
    finishDialog.current?.close();
    const at = Date.now();
    setNow(at);
    dispatch({ type: "RESUME", now: at });
  };
  const confirmFinish = (form: FormData) => {
    const number = (key: string) => {
      const text = String(form.get(key) ?? "").trim().replace(",", ".");
      const value = Number(text);
      return text && Number.isFinite(value) && value > 0 ? value : null;
    };
    const at = Date.now();
    dispatch({ type: "SET_OVERRIDES", now: at, overrides: { waterActualG: number("waterActualG"), beverageWeightG: number("beverageWeightG") } });
    const next = dispatch({ type: "FINISH", now: at });
    finishDialog.current?.close();
    if (next?.status === "FINISHED") void onFinished(next);
  };

  /** Completion goes through the outbox, online or not (§57). */
  const onFinished = async (finished: LiveBrewState) => {
    setPhase("finishing");
    await enqueue({ kind: "complete", brewId: brew.id, url: `/api/brews/${brew.id}/complete`, body: completionPayload(finished) });
    requestSync();
  };

  const confirmAbort = async () => {
    abortDialog.current?.close();
    const at = Date.now();
    dispatch({ type: "ABORT", now: at });
    await enqueue({ kind: "abort", brewId: brew.id, url: `/api/brews/${brew.id}/abort`, body: { abortedAt: new Date(at).toISOString() } });
    await deleteLocalBrew(brew.id);
    requestSync();
    router.push("/");
  };

  if (phase === "loading" || !state) {
    return (
      <div className="live" aria-busy="true">
        <p className="live-subtle" style={{ margin: "auto" }}>
          {t("loading")}
        </p>
      </div>
    );
  }

  if (phase === "done-remote" || phase === "aborted-remote") {
    return (
      <div className="live">
        <main className="live-main" id="main">
          <h1>{phase === "done-remote" ? t("alreadyComplete") : t("alreadyAborted")}</h1>
          <div className="form-actions" style={{ justifyContent: "center" }}>
            <Link className="btn btn-primary btn-large" href={`/brews/${brew.id}`}>
              {t("viewBrew")}
            </Link>
            <Link className="btn btn-large" href="/">
              {t("home")}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (phase === "finishing" && state.status === "FINISHED") {
    return <PostBrew brew={brew} state={state} onDone={() => deleteLocalBrew(brew.id)} />;
  }

  const v = view(state, now);
  const stepLabel = stepTypes(v.step.type as StepType);
  const isLast = v.stepIndex === v.stepCount - 1;
  const sep = locale === "de" ? "," : ".";
  const grams = (value: number) => `${displayGrams(value)} g`;
  const targetTime =
    v.step.targetElapsedSeconds !== null
      ? v.step.targetElapsedMaxSeconds !== null
        ? `${formatSeconds(v.step.targetElapsedSeconds)}–${formatSeconds(v.step.targetElapsedMaxSeconds)}`
        : formatSeconds(v.step.targetElapsedSeconds)
      : null;
  const showRemaining = v.stepRemainingMs !== null && v.status !== "READY";
  // Share of the step's time used, for timed steps and steps with a target time alike.
  const stepProgress = showRemaining ? v.stepElapsedMs / Math.max(1, v.stepElapsedMs + v.stepRemainingMs!) : null;
  const level = vesselLevel(state.steps, v.stepIndex, v.status, brew.waterTargetG);

  let primary: { label: string; onClick: () => void; disabled?: boolean };
  if (v.status === "READY") {
    primary = v.can.next ? { label: t("done"), onClick: () => act("NEXT") } : { label: t("startTimer"), onClick: () => act("START") };
  } else if (v.status === "PAUSED") {
    primary = { label: t("resume"), onClick: () => act("RESUME") };
  } else {
    primary = isLast ? { label: t("finish"), onClick: openFinish } : { label: v.status === "STEP_COMPLETE" ? t("nextStepReady") : t("next"), onClick: () => act("NEXT") };
  }

  return (
    <div className={flash ? "live live-flash" : "live"}>
      <div ref={announcer} className="sr-only" aria-live="assertive" />
      <header className="live-top">
        <button type="button" className="live-round" onClick={() => abortDialog.current?.showModal()} aria-label={t("cancel")} title={t("cancel")}>
          <Icon name="close" size={20} />
        </button>
        <span className="live-title">
          {brew.snapshot.name}
          {brew.coffeeName ? ` · ${brew.coffeeName}` : ""}
        </span>
        <PwaRuntime />
        <span className="live-status" data-status={v.status}>
          {t(`status.${v.status}`)}
        </span>
        <button type="button" className="live-round" onClick={openFinish} disabled={!v.can.finish} aria-label={t("finish")} title={t("finish")}>
          <Icon name="check" size={20} />
        </button>
      </header>

      <ol className="live-steps" aria-hidden="true">
        {state.steps.map((step, index) => (
          <li key={index} data-state={index < v.stepIndex ? "done" : index === v.stepIndex ? "current" : "todo"} />
        ))}
      </ol>

      {restored ? (
        <p className="notice notice-success" role="status" style={{ maxWidth: 640, margin: "12px auto 0", width: "100%" }}>
          {t("restored")}
        </p>
      ) : null}

      <main className="live-main" id="main">
        <div>
          <div className="live-step-label">{t("stepLabel", { number: v.stepIndex + 1, count: v.stepCount })}</div>
          <h1 className="live-step-type">{stepLabel}</h1>
          <p className="live-instruction">{v.step.instruction}</p>
        </div>

        <Vessel level={level} stepProgress={stepProgress} running={v.status === "RUNNING"} markerLabel={v.waterTargetG !== null ? grams(v.waterTargetG) : null}>
          {showRemaining ? (
            <>
              <div className="live-clock" role="timer" aria-label={t("remaining")}>
                {formatClock(v.stepRemainingMs! + 999)}
              </div>
              <div className="live-clock-sub">
                {t("remaining")} · {t("total", { time: formatClock(v.brewElapsedMs) })}
              </div>
            </>
          ) : (
            <>
              <div className="live-clock" role="timer" aria-label={t("brewTime")}>
                {formatClock(v.brewElapsedMs)}
              </div>
              <div className="live-clock-sub">{t("brewTime")}</div>
            </>
          )}
        </Vessel>

        <div className="live-cards">
          {v.waterTargetG !== null ? (
            <div className="live-card">
              <span className="live-card-label">{t("pourTo")}</span>
              <span className="live-target">{grams(v.waterTargetG)}</span>
              {v.waterAddG !== null && v.waterAddG > 0 ? <span className="live-add">{t("add", { grams: grams(v.waterAddG) })}</span> : null}
            </div>
          ) : null}
          <div className="live-card" style={v.waterTargetG === null ? { gridColumn: "span 2" } : undefined}>
            <ul className="live-facts">
              <li>
                <Icon name="bean" size={18} />
                <span className="sr-only">{t("dose")}</span>
                {brew.coffeeDoseG.toFixed(1).replace(".", sep)} g
              </li>
              <li>
                <Icon name="drop" size={18} />
                <span className="sr-only">{t("water")}</span>
                {displayGrams(brew.waterTargetG)} g
              </li>
              {brew.waterTemperatureC !== null ? (
                <li>
                  <Icon name="thermometer" size={18} />
                  <span className="sr-only">{t("temperature")}</span>
                  {brew.waterTemperatureC} °C
                </li>
              ) : null}
              {brew.grindSettingText ? (
                <li>
                  <Icon name="grind" size={18} />
                  <span className="sr-only">{t("grind")}</span>
                  {brew.grindSettingText}
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        {targetTime || v.behindTarget || v.status === "STEP_COMPLETE" ? (
          <div className="live-info">
            {targetTime ? (
              <span>
                {t("targetTime")} <strong>{targetTime}</strong>
              </span>
            ) : null}
            {v.behindTarget ? <strong className="badge badge-warm">{t("behindTarget")}</strong> : null}
            {v.status === "STEP_COMPLETE" ? <strong className="badge badge-accent">{t("stepComplete")}</strong> : null}
          </div>
        ) : null}

        {v.nextStep ? (
          <div className="live-next">
            {t("nextUp")}: <strong>{stepTypes(v.nextStep.type as StepType)}</strong> — {v.nextStep.instruction}
            {v.nextStep.durationSeconds ? ` (${formatSeconds(v.nextStep.durationSeconds)})` : ""}
          </div>
        ) : null}
      </main>

      <div className="live-controls">
        <button type="button" className="live-control" onClick={() => act("PREVIOUS")} disabled={!v.can.previous}>
          <span>
            <Icon name="previous" size={20} />
          </span>
          <span>{t("previous")}</span>
        </button>
        {v.status === "READY" && v.can.next ? (
          <button type="button" className="live-control live-pause" onClick={() => act("START")}>
            <span>
              <Icon name="play" size={26} />
            </span>
            <span>{t("startNow")}</span>
          </button>
        ) : (
          <button
            type="button"
            className="live-control live-pause"
            onClick={() => act(v.status === "PAUSED" ? "RESUME" : "PAUSE")}
            disabled={!v.can.pause && !v.can.resume}
          >
            <span>
              <Icon name={v.status === "PAUSED" ? "play" : "pause"} size={26} strokeWidth={2.6} />
            </span>
            <span>{v.status === "PAUSED" ? t("resume") : t("pause")}</span>
          </button>
        )}
        <button type="button" className="live-control" onClick={() => act("SKIP")} disabled={!v.can.skip || isLast}>
          <span>
            <Icon name="skip" size={20} />
          </span>
          <span>{t("skip")}</span>
        </button>
        <button type="button" className="btn btn-primary primary" onClick={primary.onClick} autoFocus>
          {primary.label}
          <Icon name="arrow" size={20} />
        </button>
      </div>

      <dialog ref={abortDialog} className="app-dialog" aria-labelledby="abort-title">
        <h2 id="abort-title">{t("abortTitle")}</h2>
        <p>{t("abortBody")}</p>
        <div className="form-actions">
          <button type="button" className="btn btn-danger" onClick={() => void confirmAbort()}>
            {t("abortConfirm")}
          </button>
          <button type="button" className="btn" onClick={() => abortDialog.current?.close()} autoFocus>
            {t("keepBrewing")}
          </button>
        </div>
      </dialog>

      <dialog ref={finishDialog} className="app-dialog" aria-labelledby="finish-title" onCancel={(e) => { e.preventDefault(); cancelFinish(); }}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            confirmFinish(new FormData(event.currentTarget));
          }}
        >
          <h2 id="finish-title">{t("finishTitle")}</h2>
          <p className="muted">{t("finishBody", { time: formatClock(view(state, now).brewElapsedMs) })}</p>
          <div className="row">
            <div className="field">
              <label htmlFor="waterActualG">{t("waterActual")}</label>
              <input id="waterActualG" name="waterActualG" inputMode="decimal" placeholder={String(displayGrams(brew.waterTargetG))} />
            </div>
            <div className="field">
              <label htmlFor="beverageWeightG">{t("beverageWeight")}</label>
              <input id="beverageWeightG" name="beverageWeightG" inputMode="decimal" />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-large" autoFocus>
              {t("completeBrew")}
            </button>
            <button type="button" className="btn" onClick={cancelFinish}>
              {t("keepBrewing")}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
