import { Window } from 'happy-dom';

/**
 * Unit-test global setup.
 *
 * Node 26 exposes no global `localStorage`, but components and zustand
 * persist read it at module load. A happy-dom window's storage is installed
 * here, before any test module import, so store modules bind a working
 * implementation.
 */
const window = new Window();
if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: window.localStorage,
    configurable: true,
    writable: true,
  });
}
