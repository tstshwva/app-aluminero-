import { useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
import * as Updates from "expo-updates";
import * as Network from "expo-network";
import { canAttemptNetwork } from "./networkState";

export const appRevision = "26 nov · 1";

export function useAppUpdates() {
  const native = Updates.useUpdates();
  const latest = useRef(native);
  latest.current = native;
  const actions = useRef({});
  const [status, setStatus] = useState({ phase: "idle" });
  useEffect(() => {
    if (!Updates.isEnabled) return;
    let active = true,
      checking = false,
      downloading = false,
      applying = false;
    let prompting = false,
      lastCheck = 0,
      pending = false;
    const show = (value) => {
      if (active) setStatus(value);
    };
    const ready = () => {
      pending = true;
      show({
        phase: "ready",
        message:
          "Descarga completa. Aplica la actualización para usar los cambios.",
      });
    };
    async function apply() {
      if (
        !active ||
        applying ||
        downloading ||
        !(pending || latest.current.isUpdatePending)
      )
        return;
      applying = true;
      show({
        phase: "applying",
        message: "Reiniciando para aplicar la actualización…",
      });
      try {
        await Updates.reloadAsync();
      } catch {
        applying = false;
        show({
          phase: "ready",
          message:
            "No se pudo reiniciar. Pulsa Aplicar otra vez o cierra completamente la app y ábrela.",
        });
      }
    }
    async function download(wasWifi) {
      if (!active || downloading || applying) return;
      downloading = true;
      try {
        const network = await Network.getNetworkStateAsync();
        if (!canAttemptNetwork(network)) throw new Error("offline");
        if (wasWifi && network.type !== Network.NetworkStateType.WIFI) {
          prompting = false;
          lastCheck = 0;
          show({
            phase: "error",
            message:
              "La red cambió a datos móviles. Pulsa Reintentar para confirmar su uso.",
          });
          return;
        }
        show({
          phase: "downloading",
          message: "Descargando la actualización. Puedes seguir usando la app.",
        });
        const result = await Updates.fetchUpdateAsync();
        if (!active) return;
        // Una promesa resuelta no garantiza una descarga nueva.
        if (
          result?.isNew === true ||
          result?.isRollBackToEmbedded === true ||
          latest.current.isUpdatePending
        ) {
          ready();
          Alert.alert(
            "Actualización descargada",
            "Los cambios se aplican al reiniciar. Guarda primero cualquier formulario abierto.",
            [
              { text: "Después", style: "cancel" },
              { text: "Aplicar ahora", onPress: apply },
            ],
          );
        } else {
          lastCheck = 0;
          show({
            phase: "error",
            message:
              "El servicio no entregó una versión nueva para aplicar. Pulsa Reintentar; tu versión instalada sigue disponible.",
          });
        }
      } catch {
        lastCheck = 0;
        show({
          phase: "error",
          message:
            "No se completó la descarga. Reintenta con otra red o más tarde. Tus datos siguen guardados.",
        });
      } finally {
        downloading = false;
        prompting = false;
      }
    }
    async function check(manual = false) {
      if (!active || checking || prompting || downloading || applying) return;
      if (pending || latest.current.isUpdatePending) {
        ready();
        return;
      }
      if (!manual && Date.now() - lastCheck < 300000) return;
      checking = true;
      try {
        const network = await Network.getNetworkStateAsync();
        if (!canAttemptNetwork(network)) {
          if (manual)
            show({
              phase: "error",
              message: "Conecta Wi-Fi o datos para buscar actualizaciones.",
            });
          return;
        }
        if (manual)
          show({ phase: "checking", message: "Buscando actualizaciones…" });
        const result = await Updates.checkForUpdateAsync();
        lastCheck = Date.now();
        if (!active) return;
        if (!result.isAvailable && !result.isRollBackToEmbedded) {
          if (manual)
            show({
              phase: "current",
              message:
                "Esta instalación ya tiene la última actualización compatible.",
            });
          return;
        }
        prompting = true;
        show({
          phase: "available",
          message: "Hay una actualización disponible. Confirma su descarga.",
        });
        const wifi = network.type === Network.NetworkStateType.WIFI;
        Alert.alert(
          "Actualización disponible",
          wifi
            ? "¿Quieres descargar las mejoras? Podrás ver el estado y aplicarlas al terminar."
            : "La descarga usará datos móviles. Puedes esperar a tener Wi-Fi.",
          [
            {
              text: "Después",
              style: "cancel",
              onPress: () => {
                prompting = false;
                show({ phase: "idle" });
              },
            },
            { text: "Descargar", onPress: () => download(wifi) },
          ],
          {
            cancelable: true,
            onDismiss: () => {
              prompting = false;
            },
          },
        );
      } catch {
        lastCheck = 0;
        if (manual)
          show({
            phase: "error",
            message:
              "No pudimos consultar el servicio de actualizaciones. Reintenta con otra red o más tarde.",
          });
      } finally {
        checking = false;
      }
    }
    actions.current = { check: () => check(true), apply };
    if (Updates.isEmergencyLaunch)
      show({
        phase: "error",
        message:
          "La última actualización no pudo arrancar. Se abrió una versión de respaldo; busca una actualización o instala el APK más reciente sin borrar tus datos.",
      });
    else void check();
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    const network = Network.addNetworkStateListener((state) => {
      if (canAttemptNetwork(state)) void check();
    });
    return () => {
      active = false;
      actions.current = {};
      app.remove();
      network.remove();
    };
  }, []);
  useEffect(() => {
    if (native.isUpdatePending && !native.isRestarting)
      setStatus({
        phase: "ready",
        message: "Actualización descargada y pendiente de aplicar.",
      });
  }, [native.isUpdatePending, native.isRestarting]);
  return {
    ...status,
    enabled: Updates.isEnabled,
    revision: appRevision,
    updateId: Updates.updateId?.slice(0, 8),
    progress:
      native.isDownloading && Number.isFinite(native.downloadProgress)
        ? Math.round(native.downloadProgress * 100)
        : null,
    check: () => actions.current.check?.(),
    apply: () => actions.current.apply?.(),
    dismiss: () =>
      setStatus({ phase: native.isUpdatePending ? "ready" : "idle" }),
  };
}
