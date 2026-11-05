import { File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
export function createSessionStorage(audience) {
  const key = `aluformix.${audience}.session`;
  let ready;
  const initialize = () =>
    (ready ??= (async () => {
      const marker = new File(
        Paths.document,
        `.aluformix-${audience}-installation`,
      );
      if (!marker.exists) {
        await SecureStore.deleteItemAsync(key);
        marker.write("initialized");
      }
    })());
  return {
    async get() {
      await initialize();
      return SecureStore.getItemAsync(key);
    },
    async save(token) {
      await initialize();
      await SecureStore.setItemAsync(key, token, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    },
    async clear() {
      await initialize();
      await SecureStore.deleteItemAsync(key);
    },
  };
}
