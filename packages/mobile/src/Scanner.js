import React, { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
export default function Scanner({ onScan, onClose }) {
  const [permission, requestPermission] = useCameraPermissions(),
    scanned = useRef(false);
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
          {permission.canAskAgain &&
            button("Permitir cámara", requestPermission)}
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
            if (!scanned.current) {
              scanned.current = true;
              onScan(String(data).slice(0, 150));
            }
          }}
        />
      )}
      {button("Volver sin escanear", onClose)}
    </View>
  );
}
