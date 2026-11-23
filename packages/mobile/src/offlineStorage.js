import { File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import {
  AESEncryptionKey,
  AESSealedData,
  aesEncryptAsync,
  aesDecryptAsync,
} from "expo-crypto";

// Dos copias cifradas conservan la última escritura válida si se interrumpe el proceso.
export function createOfflineStore(audience) {
  let ready,
    state,
    key,
    writes = Promise.resolve();
  const slots = [0, 1].map(
    (i) => new File(Paths.document, `.aluformix-${audience}-offline-${i}`),
  );
  const initialize = () =>
    (ready ??= (async () => {
      const name = `aluformix.${audience}.offline-key`;
      const stored = await SecureStore.getItemAsync(name);
      if (stored) key = await AESEncryptionKey.import(stored, "base64");
      else {
        key = await AESEncryptionKey.generate();
        await SecureStore.setItemAsync(name, await key.encoded("base64"), {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
      }
      const copies = await Promise.all(
        slots.map(async (file) => {
          if (!file.exists) return null;
          try {
            const bytes = await aesDecryptAsync(
              AESSealedData.fromCombined(await file.text()),
              key,
            );
            const value = JSON.parse(new TextDecoder().decode(bytes));
            return Number.isSafeInteger(value.revision) && value.entries
              ? value
              : null;
          } catch {
            return null;
          }
        }),
      );
      const valid = copies
        .filter(Boolean)
        .sort((a, b) => b.revision - a.revision);
      if (!valid.length && slots.some((file) => file.exists))
        throw new Error(
          "No se pudo recuperar el almacenamiento cifrado. No borres los datos de la app.",
        );
      state = valid[0] ?? { revision: 0, entries: {} };
    })());
  function change(operation) {
    const task = writes.then(async () => {
      await initialize();
      const next = {
        revision: state.revision + 1,
        entries: { ...state.entries },
      };
      operation(next.entries);
      const sealed = await aesEncryptAsync(
        new TextEncoder().encode(JSON.stringify(next)),
        key,
      );
      slots[next.revision % 2].write(await sealed.combined("base64"));
      state = next;
    });
    writes = task.catch(() => {});
    return task;
  }
  return {
    async get(name) {
      await writes;
      await initialize();
      return state.entries[name] ?? null;
    },
    set(name, value) {
      return change((entries) => {
        entries[name] = value;
      });
    },
    remove(name) {
      return change((entries) => {
        delete entries[name];
      });
    },
  };
}
