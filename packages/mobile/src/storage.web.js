// Versión para navegador (vista en la PC). SecureStore no existe en web, así
// que la sesión se guarda solo en memoria: se pierde al recargar la página y
// nunca se escribe en localStorage.
export function createSessionStorage() {
  let token = null;
  return {
    async get() {
      return token;
    },
    async save(value) {
      token = value;
    },
    async clear() {
      token = null;
    },
  };
}
