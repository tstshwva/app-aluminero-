// Tipografía de la app: Barlow. Cada grosor es una familia propia, porque
// Android no combina bien fontWeight con fuentes cargadas.
import React from "react";
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
} from "react-native";
import { useFonts } from "expo-font";

let ready = false;
const SCALE = 1.06; // Barlow se ve un poco más pequeña que la fuente del sistema.

// Devuelve true cuando se puede dibujar: con Barlow o, si falla, con la fuente
// del sistema.
export function useAppFonts() {
  const [loaded, error] = useFonts({
    "Barlow-500": require("@expo-google-fonts/barlow/500Medium/Barlow_500Medium.ttf"),
    "Barlow-600": require("@expo-google-fonts/barlow/600SemiBold/Barlow_600SemiBold.ttf"),
    "Barlow-700": require("@expo-google-fonts/barlow/700Bold/Barlow_700Bold.ttf"),
    "Barlow-800": require("@expo-google-fonts/barlow/800ExtraBold/Barlow_800ExtraBold.ttf"),
  });
  ready = loaded && !error;
  return loaded || !!error;
}

function withFont(style) {
  if (!ready) return style;
  const flat = StyleSheet.flatten(style) ?? {};
  const weight =
    flat.fontWeight === "bold" ? 700 : Number(flat.fontWeight) || 500;
  return {
    ...flat,
    ...(flat.fontSize
      ? { fontSize: Math.round(flat.fontSize * SCALE * 10) / 10 }
      : null),
    fontWeight: "normal",
    fontFamily: "Barlow-" + Math.min(800, Math.max(500, weight)),
  };
}

export function Text({ style, ...props }) {
  return <NativeText {...props} style={withFont(style)} />;
}
export function TextInput({ style, ...props }) {
  return <NativeTextInput {...props} style={withFont(style)} />;
}
