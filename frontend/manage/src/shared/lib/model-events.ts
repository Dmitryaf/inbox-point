export type Cleanup = () => void;
export const listeners = new Set<Cleanup>();
export const watchers = new Set<Cleanup>();
let version = 0;
export const getVersion = (): number => version;
let queued = false;
let publishing = false;

export function notify(): void {
  if (queued) {
    return;
  }
  queued = true;
  queueMicrotask(publish);
}

export function publish(): void {
  if (!queued || publishing) {
    return;
  }
  publishing = true;
  queued = false;
  version += 1;
  try {
    for (const watcher of [...watchers]) {
      watcher();
    }
    for (const listener of [...listeners]) {
      listener();
    }
  } finally {
    publishing = false;
  }
}
