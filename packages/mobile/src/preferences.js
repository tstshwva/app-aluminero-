// Preferencias de apariencia guardadas en el teléfono (no son datos sensibles,
// pero se usa el mismo almacenamiento seguro que la app ya incluye).
import * as SecureStore from "expo-secure-store";

const key = (audience) => `aluformix.${audience}.tema`;

export async function loadDarkMode(audience) {
  try {
    return (await SecureStore.getItemAsync(key(audience))) === "oscuro";
  } catch {
    return false;
  }
}

export async function saveDarkMode(audience, dark) {
  try {
    await SecureStore.setItemAsync(key(audience), dark ? "oscuro" : "claro");
  } catch {
    // Si no se puede guardar, el modo se aplica solo durante esta sesión.
  }
}
