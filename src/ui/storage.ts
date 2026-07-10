// Generic persisted value backed by extension local storage. Used for both the
// theme and the view mode. Falls back to null when storage is unavailable
// (e.g. the demo page opened outside the extension).

export interface PersistentValue<T> {
  get(): Promise<T | null>;
  set(value: T): Promise<void>;
}

export function browserStorage<T extends string>(
  key: string,
  allowed: readonly T[],
): PersistentValue<T> {
  const area = globalThis.chrome?.storage?.local;
  return {
    async get() {
      if (!area) return null;
      const res = await area.get(key);
      const value = res?.[key];
      return allowed.includes(value as T) ? (value as T) : null;
    },
    async set(value) {
      if (!area) return;
      await area.set({ [key]: value });
    },
  };
}
