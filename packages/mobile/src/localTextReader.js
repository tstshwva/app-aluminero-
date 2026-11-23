export const localTextAvailable = false;
export async function readLocalText() {
  throw new Error('La lectura local requiere el APK Android actualizado.');
}
