export const localTextAvailable = false;
export async function readLocalText() {
  throw new Error("La lectura local requiere el APK Android actualizado.");
}
export async function readPhotoBase64(photo) {
  if (!photo?.base64) throw new Error("Vuelve a fotografiar la hoja.");
  return photo.base64;
}
