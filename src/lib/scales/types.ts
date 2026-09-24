/**
 * Smart-scale architecture (§27) — designed now, implemented in v0.3.
 *
 * Scale-specific BLE protocols live behind adapters in `src/lib/scales/adapters/`
 * (none yet). The Live Brew UI only ever talks to this interface, and BrewCore
 * stays fully functional without any scale: manual mode is the baseline (§26).
 */
export interface ScaleAdapter {
  readonly id: string;
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  tare(): Promise<void>;
  getWeight(): number | null;
  /** Returns an unsubscribe function. */
  subscribe(callback: (weightG: number) => void): () => void;
}
