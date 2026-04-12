export type WorkspaceCache = {
  staff?: unknown[];
  financeItems?: unknown[];
  financeSettings?: unknown;
  schedule?: Record<string, unknown>;
  updatedAt?: string;
};

function getCacheKey(scope: string) {
  return `biz-manager-cache:${scope}`;
}

export function readWorkspaceCache<T extends WorkspaceCache = WorkspaceCache>(scope: string): T | null {
  if (typeof window === "undefined" || !scope) return null;

  try {
    const raw = window.localStorage.getItem(getCacheKey(scope));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function patchWorkspaceCache(scope: string, patch: Partial<WorkspaceCache>) {
  if (typeof window === "undefined" || !scope) return;

  try {
    const previous = readWorkspaceCache(scope) ?? {};
    const next: WorkspaceCache = {
      ...previous,
      ...patch,
      schedule:
        previous.schedule || patch.schedule
          ? {
              ...(previous.schedule ?? {}),
              ...(patch.schedule ?? {}),
            }
          : undefined,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(getCacheKey(scope), JSON.stringify(next));
  } catch {}
}
