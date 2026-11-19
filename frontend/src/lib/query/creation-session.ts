// A login boundary invalidates continuations, including responses arriving in another tab.
export const CREATION_SESSION_KEY = 'memo.creation-session-generation';
let generation = 0;

function storedGeneration(): string | null {
  try {
    return localStorage.getItem(CREATION_SESSION_KEY);
  } catch {
    return null;
  }
}

export function creationSession() {
  return { generation, stored: storedGeneration() };
}

export function endCreationSession(boundary: 'changed' | 'paused' = 'changed'): void {
  generation += 1;
  try {
    localStorage.setItem(CREATION_SESSION_KEY, `${boundary}:${crypto.randomUUID()}`);
  } catch {
    // Creation's journal boundary separately refuses writes when storage is unavailable.
  }
}

export function isCreationSession(current: ReturnType<typeof creationSession>): boolean {
  return current.generation === generation && current.stored === storedGeneration();
}
