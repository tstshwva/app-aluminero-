// Versión para navegador: la preferencia de tema se guarda en localStorage.
// Solo guarda «claro» u «oscuro»; nunca datos de la cuenta.
const key = (audience) => `aluformix.${audience}.tema`;

export async function loadDarkMode(audience) {
  try {
    return globalThis.localStorage?.getItem(key(audience)) === "oscuro";
  } catch {
    return false;
  }
}

export async function saveDarkMode(audience, dark) {
  try {
    globalThis.localStorage?.setItem(key(audience), dark ? "oscuro" : "claro");
  } catch {
    // Navegación privada o almacenamiento bloqueado: solo para esta sesión.
  }
}

// Estado de los avisos del teléfono (en web no se pueden activar, pero se
// mantiene la misma interfaz que la versión nativa).
const pushKey = (audience) => `aluformix.${audience}.avisos`;

export async function loadPushEnabled(audience) {
  try {
    return globalThis.localStorage?.getItem(pushKey(audience)) === "activos";
  } catch {
    return false;
  }
}

export async function savePushEnabled(audience, enabled) {
  try {
    globalThis.localStorage?.setItem(
      pushKey(audience),
      enabled ? "activos" : "inactivos",
    );
  } catch {
    // Navegación privada o almacenamiento bloqueado: solo para esta sesión.
  }
}
