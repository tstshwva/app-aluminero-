import { getApp } from "@react-native-firebase/app";
import { getToken, initializeAppCheck } from "@react-native-firebase/app-check";

let nativeAppCheck;

export async function getAssistantAppCheckToken() {
  nativeAppCheck ??= initializeAppCheck(getApp(), {
    provider: {
      providerOptions: {
        apple: { provider: "appAttestWithDeviceCheckFallback" },
      },
    },
    isTokenAutoRefreshEnabled: false,
  });
  const { token } = await getToken(await nativeAppCheck, false);
  const encoded = token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
  if (!encoded) throw new Error("App Check no devolvió un token válido.");
  const payload = JSON.parse(
    atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")),
  );
  const expireTimeMillis = payload.exp * 1000;
  if (!Number.isFinite(expireTimeMillis) || expireTimeMillis <= Date.now())
    throw new Error("App Check devolvió un token vencido.");
  return { token, expireTimeMillis };
}
