import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "./Typography";

export function UpdateStatus({ update }) {
  if (!update.enabled) return null;
  const busy = ["downloading", "applying", "checking"].includes(update.phase);
  return (
    <SafeAreaView edges={["bottom"]} style={styles.area}>
      <View style={styles.row}>
        <Text style={styles.version}>
          Revisión {update.revision}
          {update.updateId ? ` · ${update.updateId}` : ""}
        </Text>
        {!busy && (
          <Pressable
            accessibilityRole="button"
            onPress={update.phase === "ready" ? update.apply : update.check}
            style={styles.button}
          >
            <Text style={styles.link}>
              {update.phase === "ready"
                ? "Aplicar"
                : update.phase === "error"
                  ? "Reintentar"
                  : "Actualizar"}
            </Text>
          </Pressable>
        )}
      </View>
      {!!update.message && (
        <View style={styles.row} accessibilityLiveRegion="polite">
          {busy && <ActivityIndicator size="small" color="#007bff" />}
          <Text
            style={[styles.detail, update.phase === "error" && styles.error]}
          >
            {update.message}
            {update.progress !== null && update.phase === "downloading"
              ? ` ${update.progress}%`
              : ""}
          </Text>
          {!busy && update.phase !== "ready" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar estado de actualización"
              onPress={update.dismiss}
              style={styles.button}
            >
              <Text style={styles.link}>Cerrar</Text>
            </Pressable>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  area: {
    backgroundColor: "#eef6ff",
    borderTopWidth: 1,
    borderTopColor: "#cbdbe8",
    paddingHorizontal: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  version: { flex: 1, fontSize: 11, color: "#526b82" },
  button: { minHeight: 40, justifyContent: "center", paddingHorizontal: 8 },
  link: { fontSize: 13, color: "#0066ba", fontWeight: "700" },
  detail: { flex: 1, fontSize: 13, color: "#23455e", paddingVertical: 6 },
  error: { color: "#961d30" },
});
