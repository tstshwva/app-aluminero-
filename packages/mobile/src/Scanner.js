import {
  localTextAvailable,
  readLocalText,
  readPhotoBase64,
} from "./localTextReader";
import React, { useRef, useState } from "react";
import { Image, Linking, Pressable, View } from "react-native";
import { Text, TextInput } from "./Typography";
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
  const [photoForReview, setPhotoForReview] = useState(null);
  const [improving, setImproving] = useState(false);
  const [listText, setListText] = useState(initialText);
  const [message, setMessage] = useState("");
  const [torch, setTorch] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const ink = dark ? "#f2f2f2" : "#102c46";
  // Colores secundarios que también se adaptan al modo oscuro.
  const soft = dark ? "#242424" : "#e1effc",
    softInk = dark ? "#6cb2ff" : "#0066bd",
    outline = dark ? "#6cb2ff" : "#0066cc",
    note = dark ? "#cccccc" : "#31546e",
    hint = dark ? "#8c8c8c" : "#657b91";
  const openSettings = () =>
    Linking.openSettings().catch(() =>
      setMessage("Abre Ajustes y habilita Cámara para Aluformix."),
    );
  // Verde: paso para empezar. Solo borde: opcional.
  const button = (label, action, secondary = false, kind, icon) => (
    <Pressable
      onPress={action}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: kind === "outline" ? 14 : 16,
        borderWidth: kind === "outline" ? 2 : 0,
        borderColor: outline,
        backgroundColor:
          kind === "outline"
            ? dark
              ? "#121212"
              : "#ffffff"
            : kind === "start"
              ? "#0b7a55"
              : secondary
                ? soft
                : "#006fe5",
        borderRadius: 12,
        marginVertical: 8,
      }}
    >
      {!!icon && (
        <Image
          source={icon}
          accessible={false}
          resizeMode="contain"
          style={{
            width: 22,
            height: 22,
            tintColor: kind === "outline" ? outline : "#ffffff",
          }}
        />
      )}
      <Text
        style={{
          color: kind === "outline" ? outline : secondary ? softInk : "white",
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
        Lee tu hoja y revisa los materiales.
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
        Enfoca solo la hoja, con buena luz y sin objetos encima. Revisa cada
        renglón antes de buscar los materiales en el catálogo.
      </Text>
      {!localTextAvailable && !!onReadList && (
        <Text style={{ color: note }}>
          En esta instalación, fotografiar envía la foto para leerla con
          internet. También puedes escribir la lista manualmente.
        </Text>
      )}
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
            ? button(
                "Permitir cámara",
                () =>
                  requestPermission().catch(() =>
                    setMessage("No se pudo solicitar el permiso de cámara."),
                  ),
                false,
                "start",
                require("../assets/icon-camera.png"),
              )
            : button(
                "Abrir ajustes de cámara",
                openSettings,
                false,
                "start",
                require("../assets/icon-camera.png"),
              )}
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
          enableTorch={torch}
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
      {permission?.granted && !cameraFailed && (
        <>
          <Text style={{ color: note }}>
            Para leer mejor: llena el cuadro con la hoja, sosténla de frente,
            con buena luz y sin sombras.
          </Text>
          {button(
            torch ? "Apagar luz" : "Encender luz",
            () => setTorch(!torch),
            true,
          )}
        </>
      )}
      {(localTextAvailable || !!onReadList) &&
        permission?.granted &&
        !cameraFailed &&
        button(
          improving
            ? "Mejorando lectura…"
            : reading
              ? "Leyendo hoja…"
              : "Fotografiar hoja escrita",
          async () => {
            if (reading) return;
            setReading(true);
            setMessage("");
            try {
              const photo = await camera.current.takePictureAsync({
                base64: !localTextAvailable,
                quality: 0.8,
              });
              setPhotoForReview(photo);
              const text = localTextAvailable
                ? await readLocalText(photo.uri)
                : String(await onReadList(photo.base64)).trim();
              setListText(text);
              if (!text)
                setMessage(
                  "No encontramos texto legible. Acerca la hoja, mejora la luz y vuelve a fotografiarla.",
                );
            } catch (error) {
              setMessage(
                error.message ||
                  "No se pudo leer la lista. Revisa la conexión o escribe los materiales abajo.",
              );
            } finally {
              setReading(false);
            }
          },
        )}
      {!!photoForReview && !!onReadList && (
        <>
          <Text style={{ color: note, marginTop: 8 }}>
            {localTextAvailable
              ? "Si la letra salió mal, puedes releer esta misma foto con internet. Solo al elegir esta opción se enviará la foto para mejorar la lectura y se reemplazará el texto."
              : "Puedes volver a leer esta foto con internet. Se enviará la imagen y se reemplazará el texto actual."}
          </Text>
          {button(
            "Mejorar letra manuscrita (usa internet)",
            async () => {
              if (reading) return;
              setReading(true);
              setImproving(true);
              setMessage("");
              try {
                const text = String(
                  await onReadList(await readPhotoBase64(photoForReview)),
                ).trim();
                if (!text)
                  throw new Error(
                    "No se pudo distinguir la letra. Acerca la hoja o corrige el texto manualmente.",
                  );
                setListText(text);
              } catch (error) {
                setMessage(
                  error.message ||
                    "No se pudo mejorar la foto. Tu lectura anterior sigue disponible.",
                );
              } finally {
                setReading(false);
                setImproving(false);
              }
            },
            true,
          )}
        </>
      )}
      {!!sampleList &&
        button(
          "Ver ejemplo",
          () => onList(sampleList),
          false,
          "outline",
          require("../assets/icon-orders.png"),
        )}
      <Text style={{ color: ink, marginTop: 12 }}>
        Revisa o escribe tu lista, un material por renglón
      </Text>
      <TextInput
        multiline
        editable={!reading}
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
      {button("Buscar materiales de la lista", () => {
        if (listText.trim()) onList(listText.trim());
        else setMessage("Escribe al menos un material.");
      })}
      {button("Buscar manualmente", onManual)}
      {button("Volver sin escanear", onClose, true)}
    </View>
  );
}
