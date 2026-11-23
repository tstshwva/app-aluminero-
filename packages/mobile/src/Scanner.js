import React, { useRef, useState } from "react";
import { Linking, Pressable, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Notice } from "./Feedback";
export default function Scanner({
  onScan,
  onClose,
  onManual,
  onReadList,
  onList,
  sampleList,
  initialText = "",
  dark,
}) {
  const [permission, requestPermission] = useCameraPermissions(),
    scanned = useRef(false);
  const camera = useRef(null);
  const [reading, setReading] = useState(false);
  const [listText, setListText] = useState(initialText);
  const [message, setMessage] = useState("");
  const [cameraFailed, setCameraFailed] = useState(false);
  const ink = dark ? "#f2f2f2" : "#102c46";
  // Colores secundarios que también se adaptan al modo oscuro.
  const soft = dark ? "#242424" : "#e1effc",
    softInk = dark ? "#6cb2ff" : "#0066bd",
    note = dark ? "#cccccc" : "#31546e",
    hint = dark ? "#8c8c8c" : "#657b91";
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
        backgroundColor: secondary ? soft : "#006fe5",
        borderRadius: 12,
        marginVertical: 8,
      }}
    >
      <Text
        style={{
          color: secondary ? softInk : "white",
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
          color: ink,
          marginTop: 12,
        }}
      >
        Escanear cotización
      </Text>
      <Text style={{ color: dark ? "#a6a6a6" : "#526b82", marginVertical: 6 }}>
        Códigos del catálogo y cotizaciones escritas en hoja.
      </Text>
      <Text
        style={{
          color: note,
          backgroundColor: soft,
          padding: 12,
          borderRadius: 10,
          marginVertical: 8,
        }}
      >
        Enfoca un código, o fotografía tu hoja: verás únicamente los materiales
        escritos en ella.
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
            Escanear cotización
          </Text>
        </View>
      )}
      {!permission ? (
        <Text style={{ color: ink }}>Consultando permiso…</Text>
      ) : !permission.granted ? (
        <View>
          <Text style={{ color: ink }}>
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
      ) : cameraFailed ? (
        button(
          "Reintentar cámara",
          () => {
            setMessage("");
            setCameraFailed(false);
          },
          true,
        )
      ) : (
        <CameraView
          ref={camera}
          style={{
            height: 300,
            marginVertical: 8,
            borderRadius: 14,
            overflow: "hidden",
          }}
          facing="back"
          onMountError={() => {
            setCameraFailed(true);
            setMessage(
              "La cámara no pudo iniciarse. Reintenta o busca el código manualmente.",
            );
          }}
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
            if (!scanned.current && !reading) {
              scanned.current = true;
              onScan(code);
            }
          }}
        />
      )}
      <Notice
        issue={message ? { message } : null}
        onDismiss={() => setMessage("")}
        dark={dark}
      />
      {!!onReadList &&
        permission?.granted &&
        !cameraFailed &&
        button(
          reading ? "Leyendo hoja…" : "Fotografiar hoja escrita",
          async () => {
            if (reading) return;
            setReading(true);
            setMessage("");
            try {
              const photo = await camera.current.takePictureAsync({
                base64: true,
                quality: 0.4,
              });
              const text = String(await onReadList(photo.base64)).trim();
              setListText(text);
              if (text) await onList(text);
              else setMessage("No encontramos texto legible en la hoja.");
            } catch {
              setMessage(
                "No se pudo leer la lista. Revisa la conexión o escribe los materiales abajo.",
              );
            } finally {
              setReading(false);
            }
          },
        )}
      {!!sampleList &&
        button("Probar con una hoja de ejemplo", () => onList(sampleList))}
      <Text style={{ color: ink, marginTop: 12 }}>
        Revisa o escribe tu lista, un material por renglón
      </Text>
      <TextInput
        multiline
        value={listText}
        onChangeText={setListText}
        maxLength={4000}
        accessibilityLabel="Lista de materiales"
        placeholder={"Riel de aluminio\nContramarco"}
        placeholderTextColor={hint}
        style={{
          minHeight: 120,
          color: ink,
          borderWidth: 1,
          borderColor: "#879bac",
          borderRadius: 12,
          padding: 12,
          marginVertical: 8,
        }}
      />
      {button("Buscar lista completa", () => {
        if (listText.trim()) onList(listText.trim());
        else setMessage("Escribe al menos un material.");
      })}
      {button("Buscar manualmente", onManual)}
      {button("Volver sin escanear", onClose, true)}
    </View>
  );
}
