// A login boundary invalidates continuations, including responses arriving in another tab.
const key = 'memo.creation-session-generation';
let generation = 0;

function storedGeneration(): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function creationSession() {
  return { generation, stored: storedGeneration() };
}

export function endCreationSession(): void {
  generation += 1;
  try {
    localStorage.setItem(key, crypto.randomUUID());
  } catch {
    // Creation's journal boundary separately refuses writes when storage is unavailable.
  }
}

export function isCreationSession(current: ReturnType<typeof creationSession>): boolean {
  return current.generation === generation && current.stored === storedGeneration();
}
