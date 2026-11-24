// Load state of ExoClick's ad-provider.js, shared by AdScript (which loads it)
// and every ExoClickAd slot (which waits for it). A slot learns straight away
// that the script was blocked (uBlock Origin blocks magsrv.com) instead of
// polling for window.AdProvider.

export type AdScriptStatus = 'idle' | 'loading' | 'ready' | 'failed';

let status: AdScriptStatus = 'idle';
const listeners = new Set<() => void>();

export const getAdScriptStatus = (): AdScriptStatus => status;

/** For useSyncExternalStore on the server: the script never loads there. */
export const getServerAdScriptStatus = (): AdScriptStatus => 'idle';

export function setAdScriptStatus(next: AdScriptStatus) {
  if (status === next) return;
  // A script that loaded stays loaded, whatever a late timeout says
  if (status === 'ready' && next === 'failed') return;
  status = next;
  listeners.forEach((listener) => listener());
}

export function subscribeAdScriptStatus(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
