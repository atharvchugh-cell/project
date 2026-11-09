/**
 * The multiplayer room this device is currently in, so saves and AI requests
 * can tell the server which room they belong to. The server decides what
 * Classroom means; this only carries the id and a UI hint.
 */
export interface ActiveRoom { id: string; classroom: boolean }

let active: ActiveRoom | null = null;
const listeners = new Set<() => void>();

export function setActiveRoom(room: ActiveRoom | null) {
  active = room;
  listeners.forEach(l => l());
}
export function getActiveRoom(): ActiveRoom | null { return active; }
export function subscribeActiveRoom(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
