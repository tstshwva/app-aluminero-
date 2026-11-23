import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import * as Network from "expo-network";
import * as SecureStore from "expo-secure-store";

export function useOrderOutbox(client, ownerUid, enabled) {
  const [pending, setPending] = useState(null);
  const [wifiOnly, setWifiOnly] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const actions = useRef(null);

  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;
    const key = "aluformix.orders." + ownerUid;
    const preference = "aluformix.orders.wifi";
    let active = true;
    let syncing = false;
    let retryRequested = false;
    let writes = Promise.resolve();

    function serialize(operation) {
      const result = writes.then(operation);
      writes = result.catch(() => {});
      return result;
    }

    async function read() {
      return JSON.parse((await SecureStore.getItemAsync(key)) ?? "[]");
    }

    async function save(orders) {
      if (orders.length) {
        await SecureStore.setItemAsync(key, JSON.stringify(orders));
      } else {
        await SecureStore.deleteItemAsync(key);
      }
      if (active) setPending(orders);
    }

    async function sync() {
      if (!active) return;
      if (syncing) {
        retryRequested = true;
        return;
      }
      syncing = true;
      try {
        const orders = await serialize(read);
        for (const order of orders) {
          const network = await Network.getNetworkStateAsync();
          const onlyWifi = await SecureStore.getItemAsync(preference);
          if (
            !active ||
            !network.isConnected ||
            network.isInternetReachable === false ||
            (onlyWifi === "true" &&
              network.type !== Network.NetworkStateType.WIFI)
          )
            break;
          await client.createOrder({ ...order, expectedOwnerUid: ownerUid });
          await serialize(async () => {
            await save(
              (await read()).filter(
                (item) => item.requestKey !== order.requestKey,
              ),
            );
          });
        }
        if (active) setSyncError(false);
      } catch {
        if (active) setSyncError(true);
      } finally {
        syncing = false;
        if (retryRequested) {
          retryRequested = false;
          void sync();
        }
      }
    }

    actions.current = {
      async enqueue(order) {
        await serialize(async () => {
          if (!active) throw new Error("Vuelve a abrir esta pantalla.");
          const orders = await read();
          if (!orders.some((item) => item.requestKey === order.requestKey))
            await save([...orders, order]);
        }).catch(() => {
          throw new Error(
            "No se pudo guardar el encargo en el teléfono. Tus productos siguen en el carrito.",
          );
        });
        void sync();
      },
      async setWifi(value) {
        await SecureStore.setItemAsync(preference, String(value));
        if (active) setWifiOnly(value);
        void sync();
      },
      sync,
    };

    Promise.all([serialize(read), SecureStore.getItemAsync(preference)])
      .then(([orders, onlyWifi]) => {
        if (!active) return;
        setPending(orders);
        setWifiOnly(onlyWifi === "true");
        void sync();
      })
      .catch(() => {
        if (active) setSyncError(true);
      });
    const network = Network.addNetworkStateListener(() => void sync());
    const foreground = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    return () => {
      active = false;
      actions.current = null;
      network.remove();
      foreground.remove();
    };
  }, [client, ownerUid, enabled]);

  return { pending, wifiOnly, syncError, actions: actions.current };
}
