import { useEffect } from "react";
import { Alert, AppState } from "react-native";
import * as Updates from "expo-updates";
import * as Network from "expo-network";

export function useAppUpdates() {
  useEffect(() => {
    if (!Updates.isEnabled) return;
    let active = true;
    let checking = false;
    let lastCheck = 0;
    async function check() {
      if (checking || Date.now() - lastCheck < 300000) return;
      checking = true;
      lastCheck = Date.now();
      try {
        const network = await Network.getNetworkStateAsync();
        if (network.type !== Network.NetworkStateType.WIFI) return;
        const update = await Updates.checkForUpdateAsync();
        if (!active || !update.isAvailable) return;
        Alert.alert(
          "Actualización disponible",
          "Descarga las mejoras por Wi-Fi. Se aplicarán la próxima vez que abras Aluformix.",
          [
            { text: "Después", style: "cancel" },
            {
              text: "Descargar",
              onPress: async () => {
                try {
                  const current = await Network.getNetworkStateAsync();
                  if (current.type !== Network.NetworkStateType.WIFI) {
                    Alert.alert(
                      "Conecta Wi-Fi",
                      "La descarga espera una conexión Wi-Fi.",
                    );
                    return;
                  }
                  await Updates.fetchUpdateAsync();
                  if (active)
                    Alert.alert(
                      "Actualización descargada",
                      "Las mejoras se aplicarán al volver a abrir la app.",
                    );
                } catch {
                  if (active)
                    Alert.alert(
                      "Descarga pendiente",
                      "No se pudo descargar. Puedes seguir usando la app.",
                    );
                }
              },
            },
          ],
        );
      } catch {
        // La versión instalada sigue disponible si falla el servicio.
      } finally {
        checking = false;
      }
    }
    void check();
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => {
      active = false;
      listener.remove();
    };
  }, []);
}
