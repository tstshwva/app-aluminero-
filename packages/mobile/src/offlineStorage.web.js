// La vista web conserva únicamente una caché durante la sesión del navegador.
export function createOfflineStore() {
  const values = new Map();
  return {
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      values.set(key, value);
    },
    remove: async (key) => {
      values.delete(key);
    },
  };
}
