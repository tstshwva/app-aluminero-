import { useEffect } from "react";
import { Alert, AppState } from "react-native";
import * as Updates from "expo-updates";
import * as Network from "expo-network";

export function useAppUpdates() {
  useEffect(() => {
    if (!Updates.isEnabled) return;
    let active = true;
    let checking = false;
    let prompting = false;
    let lastCheck = 0;
    const connected = network => network.isConnected && network.isInternetReachable !== false;
    async function check() {
      if (checking || prompting || Date.now() - lastCheck < 300000) return;
      checking = true;
      try {
        const network = await Network.getNetworkStateAsync();
        if (!connected(network)) return;
        const update = await Updates.checkForUpdateAsync();
        lastCheck = Date.now();
        if (!active || !update.isAvailable) return;
        prompting = true;
        Alert.alert("Actualización disponible",
          network.type === Network.NetworkStateType.WIFI
            ? "Hay mejoras disponibles. ¿Quieres descargarlas?"
            : "Hay mejoras disponibles. La descarga usará datos móviles. Puedes esperar a tener Wi-Fi.",
          [
            { text: "Después", style: "cancel", onPress: () => { prompting = false; } },
            { text: "Descargar", onPress: async () => {
              try {
                const current = await Network.getNetworkStateAsync();
                if (!connected(current)) throw new Error("Sin conexión");
                // Si cambió de Wi-Fi a datos, solicita permiso antes de descargar.
                if (network.type === Network.NetworkStateType.WIFI && current.type !== Network.NetworkStateType.WIFI) {
                  if (active) Alert.alert("La red cambió", "Vuelve a abrir la app para confirmar la descarga con datos móviles.");
                  lastCheck = 0;
                  return;
                }
                await Updates.fetchUpdateAsync();
                if (active) Alert.alert("Actualización lista", "Reinicia Aluformix para aplicar las mejoras.", [
                  { text: "Después", style: "cancel" },
                  { text: "Aplicar ahora", onPress: async () => {
                    try { await Updates.reloadAsync(); }
                    catch { if (active) Alert.alert("Reinicio pendiente", "Cierra completamente Aluformix y vuelve a abrirla."); }
                  } },
                ]);
              } catch {
                lastCheck = 0;
                if (active) Alert.alert("Descarga pendiente", "No se pudo descargar. Puedes seguir usando la app y reintentar al volver a abrirla.");
              } finally { prompting = false; }
            } },
          ], { cancelable: true, onDismiss: () => { prompting = false; } });
      } catch {
        // Un fallo de conexión no bloquea el uso de la versión instalada.
      } finally { checking = false; }
    }
    void check();
    const listener = AppState.addEventListener("change", state => { if (state === "active") void check(); });
    const networkListener = Network.addNetworkStateListener(network => { if (connected(network)) void check(); });
    return () => { active = false; networkListener.remove(); listener.remove(); };
  }, []);
}
