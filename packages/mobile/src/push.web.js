// Versión para navegador: las notificaciones del teléfono no existen en web.
export async function registerPush() {
  throw new Error(
    "Las notificaciones del teléfono solo se activan desde la app instalada en Android o iOS.",
  );
}
export async function disablePush() {}
