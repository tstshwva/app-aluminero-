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
  const button = (label, action, secondary = false) => (
    <Pressable
      onPress={action}
      accessibilityRole="button"
      style={{
        padding: 16,
        backgroundColor: secondary ? "#e1effc" : "#006fe5",
        borderRadius: 12,
        marginVertical: 8,
      }}
    >
      <Text
        style={{
          color: secondary ? "#0066bd" : "white",
          textAlign: "center",
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View>
      <Text
        style={{
          fontSize: 27,
          fontWeight: "800",
          color: "#102c46",
          marginTop: 12,
        }}
      >
        Escanear material
      </Text>
      <Text style={{ color: "#526b82", marginVertical: 6 }}>
        Lectura de códigos del catálogo.
      </Text>
      <Text
        style={{
          color: "#31546e",
          backgroundColor: "#e1effc",
          padding: 12,
          borderRadius: 10,
          marginVertical: 8,
        }}
      >
        Enfoca el código de barras o QR del material. Verifica el resultado en
        el catálogo.
      </Text>
      {!permission?.granted && (
        <View
          style={{
            minHeight: 175,
            marginVertical: 8,
            borderRadius: 14,
            backgroundColor: "#102c46",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>
            Escáner de materiales
          </Text>
        </View>
      )}
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
          style={{
            height: 300,
            marginVertical: 8,
            borderRadius: 14,
            overflow: "hidden",
          }}
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
      {button("Volver sin escanear", onClose, true)}
    </View>
  );
}
