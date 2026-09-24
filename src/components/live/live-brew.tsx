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
import { deleteLocalBrew, enqueue, getLocalBrew, putLocalBrew } from "@/lib/offline/db";
import { warmOfflineCache } from "@/lib/offline/offline-cache";
import { PwaRuntime, requestSync } from "@/components/pwa-runtime";
import { useWakeLock } from "./use-wake-lock";
import { playTone, unlockAudio, vibrate } from "./cues";
import { PostBrew } from "./post-brew";

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
  const progress = v.stepRemainingMs !== null && v.step.durationSeconds ? 1 - v.stepRemainingMs / (v.step.durationSeconds * 1000) : null;

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
        <span>
          {brew.snapshot.name}
          {brew.coffeeName ? ` · ${brew.coffeeName}` : ""}
        </span>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <PwaRuntime />
          <span className="live-status" data-status={v.status}>
            {t(`status.${v.status}`)}
          </span>
        </span>
      </header>

      {restored ? (
        <p className="notice notice-success" role="status" style={{ maxWidth: 640, margin: "12px auto 0", width: "100%" }}>
          {t("restored")}
        </p>
      ) : null}

      <main className="live-main" id="main">
        <div className="live-clock" role="timer" aria-label={t("brewTime")}>
          {formatClock(v.brewElapsedMs)}
        </div>

        <div>
          <div className="live-step-label">
            {stepLabel} · {t("stepOf", { number: v.stepIndex + 1, count: v.stepCount })}
          </div>
          <p className="live-instruction">{v.step.instruction}</p>
        </div>

        {v.waterTargetG !== null ? (
          <div>
            <div className="live-subtle">{t("pourTo")}</div>
            <div className="live-target">{grams(v.waterTargetG)}</div>
            {v.waterAddG !== null && v.waterAddG > 0 ? <div className="live-subtle">{t("add", { grams: grams(v.waterAddG) })}</div> : null}
          </div>
        ) : null}

        <div className="live-info">
          {v.stepRemainingMs !== null && v.status !== "READY" ? (
            <span>
              {t("remaining")} <strong>{formatClock(v.stepRemainingMs + 999)}</strong>
            </span>
          ) : null}
          {targetTime ? (
            <span>
              {t("targetTime")} <strong>{targetTime}</strong>
            </span>
          ) : null}
          {v.behindTarget ? <strong className="badge badge-warm">{t("behindTarget")}</strong> : null}
          {v.status === "STEP_COMPLETE" ? <strong className="badge badge-accent">{t("stepComplete")}</strong> : null}
        </div>

        {progress !== null && v.status !== "READY" ? (
          <div className="live-progress" aria-hidden="true">
            <span style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
          </div>
        ) : null}

        {v.nextStep ? (
          <div className="live-next">
            {t("nextUp")}: <strong>{stepTypes(v.nextStep.type as StepType)}</strong> — {v.nextStep.instruction}
            {v.nextStep.durationSeconds ? ` (${formatSeconds(v.nextStep.durationSeconds)})` : ""}
          </div>
        ) : null}

        <div className="live-subtle small">
          {[
            `${brew.coffeeDoseG.toFixed(1).replace(".", sep)} g → ${displayGrams(brew.waterTargetG)} g`,
            brew.waterTemperatureC !== null ? `${brew.waterTemperatureC} °C` : null,
            brew.grindSettingText,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </main>

      <div className="live-controls">
        <button type="button" className="btn btn-primary primary" onClick={primary.onClick} autoFocus>
          {primary.label}
        </button>
        <button type="button" className="btn" onClick={() => act("PREVIOUS")} disabled={!v.can.previous}>
          ← {t("previous")}
        </button>
        {v.status === "READY" && v.can.next ? (
          <button type="button" className="btn" onClick={() => act("START")}>
            {t("startNow")}
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => act(v.status === "PAUSED" ? "RESUME" : "PAUSE")} disabled={!v.can.pause && !v.can.resume}>
            {v.status === "PAUSED" ? `▶ ${t("resume")}` : `❚❚ ${t("pause")}`}
          </button>
        )}
        <button type="button" className="btn" onClick={() => act("SKIP")} disabled={!v.can.skip || isLast}>
          {t("skip")} →
        </button>
      </div>

      <div className="live-secondary">
        <button type="button" className="btn btn-danger" onClick={() => abortDialog.current?.showModal()}>
          {t("cancel")}
        </button>
        <button type="button" className="btn" onClick={openFinish} disabled={!v.can.finish}>
          {t("finish")}
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
