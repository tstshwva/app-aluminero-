import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function formError(field, message) {
  return Object.assign(new Error(message), { field });
}

export function FieldIssue({ message }) {
  return message ? <Text style={validationStyles.hint}>{message}</Text> : null;
}

export function Notice({ issue, onDismiss, dark }) {
  if (!issue) return null;
  return (
    <View
      style={[validationStyles.notice, dark && validationStyles.darkNotice]}
    >
      <View
        style={validationStyles.copy}
        accessibilityLiveRegion="assertive"
        accessibilityRole="alert"
      >
        <Text
          style={[validationStyles.title, dark && validationStyles.darkText]}
        >
          Revisa los datos
        </Text>
        <Text
          style={[validationStyles.detail, dark && validationStyles.darkText]}
        >
          {issue.message}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar aviso"
        onPress={onDismiss}
        hitSlop={6}
        style={validationStyles.close}
      >
        <Text
          style={[validationStyles.title, dark && validationStyles.darkText]}
        >
          Cerrar
        </Text>
      </Pressable>
    </View>
  );
}

export const validationStyles = StyleSheet.create({
  invalid: { borderWidth: 2, borderColor: "#d63e4b" },
  hint: {
    alignSelf: "flex-start",
    backgroundColor: "#fff1f2",
    borderRadius: 5,
    color: "#961d30",
    fontSize: 13,
    padding: 6,
    marginBottom: 6,
  },
  notice: {
    alignSelf: "center",
    width: "94%",
    maxWidth: 620,
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: "#d63e4b",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    marginVertical: 7,
  },
  darkNotice: { backgroundColor: "#39212a" },
  darkText: { color: "#ffd6db" },
  copy: { flex: 1 },
  title: { fontWeight: "800", color: "#8c1730" },
  detail: { color: "#751b2b", marginTop: 3 },
  close: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
});
