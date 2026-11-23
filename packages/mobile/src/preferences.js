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

// Recuerda si el usuario activó los avisos en este teléfono, para mostrar un
// solo botón (activar o desactivar) según el estado.
const pushKey = (audience) => `aluformix.${audience}.avisos`;

export async function loadPushEnabled(audience) {
  try {
    return (await SecureStore.getItemAsync(pushKey(audience))) === "activos";
  } catch {
    return false;
  }
}

export async function savePushEnabled(audience, enabled) {
  try {
    await SecureStore.setItemAsync(
      pushKey(audience),
      enabled ? "activos" : "inactivos",
    );
  } catch {
    // Si no se puede guardar, el estado se conoce solo durante esta sesión.
  }
}

// Datos de contacto del comprador para no pedirlos en cada encargo. Se guardan
// cifrados en el teléfono, por cuenta.
const contactKey = (userId) =>
  "aluformix.contacto." + String(userId).replace(/[^A-Za-z0-9._-]/g, "_");

export async function loadContact(userId) {
  try {
    return JSON.parse(
      (await SecureStore.getItemAsync(contactKey(userId))) ?? "{}",
    );
  } catch {
    return {};
  }
}

export async function saveContact(userId, contact) {
  try {
    await SecureStore.setItemAsync(contactKey(userId), JSON.stringify(contact));
  } catch {
    // Sin almacenamiento, se vuelven a pedir en el siguiente encargo.
  }
}
