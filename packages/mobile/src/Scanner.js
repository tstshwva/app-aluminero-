import React, { useRef, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
export default function Scanner({ onScan, onClose, onManual }) {
  const [permission, requestPermission] = useCameraPermissions(),
    scanned = useRef(false);
  const [message, setMessage] = useState("");
  const openSettings = () =>
    Linking.openSettings().catch(() =>
      setMessage("Abre Ajustes y habilita Cámara para Aluformix."),
    );
  const button = (label, action) => (
    <Pressable
      onPress={action}
      accessibilityRole="button"
      style={{
        padding: 16,
        backgroundColor: "#007bff",
        borderRadius: 12,
        marginVertical: 8,
      }}
    >
      <Text style={{ color: "white", textAlign: "center", fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Escanear material</Text>
      <Text>
        Enfoca el código de barras o QR que contiene el código del catálogo. La
        cámara no calcula medidas.
      </Text>
      {!permission ? (
        <Text>Consultando permiso…</Text>
      ) : !permission.granted ? (
        <View>
          <Text>
            Necesitamos permiso de cámara. También puedes buscar el código
            manualmente.
          </Text>
          {permission.canAskAgain
            ? button("Permitir cámara", () =>
                requestPermission().catch(() =>
                  setMessage("No se pudo solicitar el permiso de cámara."),
                ),
              )
            : button("Abrir ajustes de cámara", openSettings)}
        </View>
      ) : (
        <CameraView
          style={{ height: 330, marginVertical: 16 }}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: [
              "qr",
              "ean13",
              "ean8",
              "code128",
              "code39",
              "upc_a",
              "upc_e",
            ],
          }}
          onBarcodeScanned={({ data }) => {
            const code = typeof data === "string" ? data.trim() : "";
            if (
              !code ||
              code.length > 40 ||
              /[\u0000-\u001f\u007f]/.test(code)
            ) {
              setMessage("Enfoca un código de catálogo válido.");
              return;
            }
            if (!scanned.current) {
              scanned.current = true;
              onScan(code);
            }
          }}
        />
      )}
      {!!message && <Text accessibilityLiveRegion="polite">{message}</Text>}
      {button("Buscar manualmente", onManual)}
      {button("Volver sin escanear", onClose)}
    </View>
  );
}
