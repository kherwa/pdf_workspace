// Stub browser globals for tests running in Node environment.
// useFileSystem.ts accesses window.electronAPI at module scope.
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    electronAPI: {},
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    localStorage: { getItem: () => null, setItem: () => {} },
  }
}
