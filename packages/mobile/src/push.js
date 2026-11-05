import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
export async function registerPush(client) {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId)
    throw new Error(
      "Falta configurar el proyecto de notificaciones de esta app y sus credenciales nativas.",
    );
  if (!Device.isDevice)
    throw new Error("Activa las notificaciones desde un teléfono físico.");
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("encargos", {
      name: "Encargos",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted)
    permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "No se autorizó el permiso. Puedes seguir consultando los avisos dentro de la app.",
    );
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await client.registerPush(token);
  return token;
}
export async function disablePush(client) {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await client.disablePush(token);
}
