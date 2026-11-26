import { CameraView, useCameraPermissions } from "expo-camera";
import { localTextAvailable, readLocalText } from "./localTextReader";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View, Image } from "react-native";
import { Text, TextInput } from "./Typography";

const ChatMessage = React.memo(function ChatMessage({
  message,
  dark,
  onProduct,
  disabled,
}) {
  const ink = dark ? "#f2f2f2" : "#102c46",
    muted = dark ? "#b9c9d8" : "#526b82";
  return (
    <View
      style={{
        alignSelf: message.role === "user" ? "flex-end" : "flex-start",
        maxWidth: "94%",
        padding: 15,
        borderRadius: 18,
        backgroundColor:
          message.role === "user" ? "#006fe5" : dark ? "#19344b" : "#e1effc",
      }}
    >
      <Text
        style={{
          fontSize: 12,
          marginBottom: 5,
          color: message.role === "user" ? "white" : muted,
        }}
      >
        {message.role === "user"
          ? "Tú"
          : ["guide", "local"].includes(message.source)
            ? "Guía de Aluformix · sin conexión"
            : "Asistente"}
      </Text>
      <Text
        selectable
        style={{
          fontSize: 16,
          lineHeight: 24,
          color: message.role === "user" ? "white" : ink,
        }}
      >
        {message.text}
      </Text>
      {message.role === "assistant" &&
        (message.products ?? []).map((product) => (
          <Pressable
            key={product.id}
            accessibilityRole="button"
            accessibilityLabel={"Ver " + product.name}
            disabled={disabled || !onProduct}
            onPress={() => onProduct?.(product)}
            style={{
              padding: 12,
              marginTop: 8,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: muted,
            }}
          >
            <Text style={{ color: ink, fontWeight: "700" }}>
              {product.name}
            </Text>
            <Text style={{ color: muted }}>
              Código {product.code} · {product.unit}
            </Text>
            {product.review && (
              <Text style={{ color: muted }}>Coincidencia por confirmar</Text>
            )}
            <Text style={{ color: dark ? "#8ec8ff" : "#0066bd" }}>
              Ver material →
            </Text>
          </Pressable>
        ))}
    </View>
  );
});

export default function AssistantChat({
  client,
  messages,
  onMessages,
  dark,
  onCatalog,
  onCamera,
  onProduct,
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const local = client.assistantMode === "local-ocr";
  const camera = useRef(null);
  const mounted = useRef(true);
  const request = useRef(null);
  const [partial, setPartial] = useState("");
  const captureLock = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const busy = sending || capturing;
  const [error, setError] = useState("");
  const locked = useRef(false);
  const ink = dark ? "#f2f2f2" : "#102c46";
  const muted = dark ? "#b9c9d8" : "#526b82";
  const button = (label, action, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={action}
      style={{
        padding: 14,
        borderRadius: 14,
        backgroundColor: disabled ? "#7294b5" : "#006fe5",
        marginVertical: 5,
      }}
    >
      <Text style={{ color: "white", fontWeight: "700", textAlign: "center" }}>
        {label}
      </Text>
    </Pressable>
  );
  async function send() {
    const question = draft.trim();
    if (!question || locked.current || captureLock.current) return;
    locked.current = true;
    setSending(true);
    setError("");
    setPartial("");
    const controller = new AbortController();
    request.current = controller;
    try {
      if (!client.assistant)
        throw new Error("El asistente no está disponible en esta versión.");
      const result = await client.assistant(
        question,
        local ? undefined : photo?.base64,
        messages,
        {
          recognizedText: local ? photo?.recognizedText : undefined,
          visualChat: true,
          signal: controller.signal,
          onPartial: (text) => {
            if (
              mounted.current &&
              request.current === controller &&
              !controller.signal.aborted
            )
              setPartial(text);
          },
        },
      );
      if (!mounted.current) return;
      if (controller.signal.aborted)
        throw new Error(
          "La respuesta se detuvo. Tu pregunta sigue disponible.",
        );
      if (!result?.answer?.trim())
        throw new Error("No llegó una respuesta. Intenta de nuevo.");
      onMessages(
        [
          ...messages,
          { role: "user", text: question },
          {
            role: "assistant",
            text: result.answer,
            products: result.products ?? [],
            suggestions: result.suggestions ?? [],
            source: result.source ?? "cloud",
          },
        ].slice(-40),
      );
      setDraft("");
      setPhoto(null);
      setPartial("");
    } catch (failure) {
      if (!mounted.current) return;
      setError(
        failure.message ||
          "No se pudo enviar. Tu pregunta sigue escrita para reintentar.",
      );
    } finally {
      if (request.current === controller) request.current = null;
      locked.current = false;
      if (mounted.current) setSending(false);
    }
  }
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 27, fontWeight: "800", color: ink }}>
        {local ? "Guía de materiales" : "Tu asistente Aluformix"}
      </Text>
      <Text style={{ color: muted }}>
        {local
          ? "Lee tu lista en el teléfono y busca materiales en tu catálogo guardado. También te orientamos para usar la app."
          : "Pregunta sobre materiales, tu proyecto o cómo usar la app. Podemos resolverlo paso a paso."}
      </Text>
      {!messages.length && (
        <View
          style={{
            padding: 16,
            borderRadius: 18,
            backgroundColor: dark ? "#19344b" : "#e1effc",
          }}
        >
          <Text style={{ color: ink }}>Hola, ¿en qué puedo ayudarte hoy?</Text>
          {[
            "¿Cómo hago un encargo?",
            "Ayúdame a elegir materiales",
            "¿Cómo leo mi lista con la cámara?",
          ].map((question) => (
            <Pressable
              key={question}
              accessibilityRole="button"
              onPress={() => setDraft(question)}
              style={{ paddingVertical: 12 }}
            >
              <Text style={{ color: dark ? "#8ec8ff" : "#0066bd" }}>
                {question}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {messages.map((message, index) => (
        <ChatMessage
          key={index}
          message={message}
          dark={dark}
          onProduct={onProduct}
          disabled={busy}
        />
      ))}
      {!sending && messages.at(-1)?.role === "assistant" && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(messages.at(-1).suggestions ?? []).slice(0, 3).map((question) => (
            <Pressable
              key={question}
              accessibilityRole="button"
              onPress={() => setDraft(question)}
              style={{
                padding: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: muted,
              }}
            >
              <Text style={{ color: ink }}>{question}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {!!partial && (
        <View
          style={{
            padding: 15,
            borderRadius: 18,
            backgroundColor: dark ? "#19344b" : "#e1effc",
          }}
        >
          <Text style={{ color: muted, fontSize: 12 }}>
            {sending
              ? "Asistente · respondiendo"
              : "Respuesta parcial, sin completar"}
          </Text>
          <Text
            selectable
            style={{ color: ink, fontSize: 16, lineHeight: 24, marginTop: 5 }}
          >
            {partial}
          </Text>
        </View>
      )}
      {sending && (
        <View
          accessibilityLiveRegion="polite"
          style={{ flexDirection: "row", gap: 8 }}
        >
          <ActivityIndicator color="#007bff" />
          <Text style={{ color: muted }}>Buscando una respuesta para ti…</Text>
        </View>
      )}
      {sending && button("Detener respuesta", () => request.current?.abort())}
      {capturing && (
        <View
          accessibilityLiveRegion="polite"
          style={{ flexDirection: "row", gap: 8 }}
        >
          <ActivityIndicator color="#007bff" />
          <Text style={{ color: muted }}>
            Leyendo el texto de la foto en este teléfono…
          </Text>
        </View>
      )}
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ color: dark ? "#ffb4b4" : "#a51d36", padding: 12 }}
        >
          {error}
        </Text>
      )}
      {cameraOpen && permission?.granted && (
        <>
          <CameraView
            ref={camera}
            facing="back"
            style={{ height: 280, borderRadius: 16 }}
            onCameraReady={() => setCameraReady(true)}
            onMountError={() => {
              setCameraReady(false);
              setCameraOpen(false);
              setError("No se pudo abrir la cámara. Intenta otra vez.");
            }}
          />
          {button(
            capturing ? "Tomando foto…" : "Usar esta foto",
            async () => {
              if (captureLock.current || !cameraReady || !camera.current)
                return;
              captureLock.current = true;
              setCapturing(true);
              try {
                const picture = await camera.current.takePictureAsync({
                  base64: !local,
                  quality: local ? 0.8 : 0.4,
                });
                if (!mounted.current) return;
                setCameraOpen(false);
                const recognizedText = local
                  ? await readLocalText(picture.uri)
                  : undefined;
                if (!mounted.current) return;
                if (local && !recognizedText.trim())
                  throw new Error(
                    "No se encontró texto legible. Enfoca solo la hoja, con buena luz, o escribe la lista.",
                  );
                if (local && recognizedText.length > 4000)
                  throw new Error(
                    "La hoja contiene demasiado texto. Fotografía una parte de la lista.",
                  );
                setPhoto({ ...picture, recognizedText });
                setCameraOpen(false);
                setDraft((current) =>
                  current.trim()
                    ? current
                    : local
                      ? "Busca los materiales de esta lista"
                      : "¿Qué materiales me recomiendas para algo como lo de esta foto?",
                );
              } catch (failure) {
                if (mounted.current)
                  setError(
                    local
                      ? failure.message ||
                          "No se pudo leer la hoja. Intenta otra vez."
                      : "No se pudo tomar la foto. Intenta otra vez.",
                  );
              } finally {
                captureLock.current = false;
                if (mounted.current) setCapturing(false);
              }
            },
            capturing || !cameraReady,
          )}
          {button("Cerrar cámara", () => setCameraOpen(false), capturing)}
        </>
      )}
      {!!photo && (
        <>
          <Image
            accessibilityLabel="Foto adjunta para consultar"
            source={{ uri: photo.uri }}
            style={{ height: 180, borderRadius: 16 }}
            resizeMode="contain"
          />
          {button("Quitar foto", () => setPhoto(null), busy)}
          {local && (
            <>
              <Text style={{ color: muted }}>
                Revisa y corrige el texto antes de consultar. La foto permanece
                en el teléfono.
              </Text>
              <TextInput
                accessibilityLabel="Texto leído de la foto"
                multiline
                maxLength={4000}
                editable={!busy}
                value={photo.recognizedText}
                onChangeText={(text) =>
                  setPhoto((previous) =>
                    previous ? { ...previous, recognizedText: text } : previous,
                  )
                }
                style={{
                  color: ink,
                  borderColor: muted,
                  borderWidth: 1,
                  padding: 12,
                  borderRadius: 12,
                  minHeight: 100,
                }}
              />
            </>
          )}
        </>
      )}
      {button(
        local
          ? "Fotografiar lista de materiales"
          : "Adjuntar foto de mi proyecto",
        async () => {
          try {
            if (local && !localTextAvailable) {
              setError(
                "Esta instalación no tiene lector local. Instala el APK actualizado o escribe los materiales.",
              );
              return;
            }
            const access = permission?.granted
              ? permission
              : await requestPermission();
            if (!mounted.current) return;
            if (!access.granted) {
              setError(
                "Habilita el permiso de cámara en Ajustes para adjuntar una foto.",
              );
              return;
            }
            setError("");
            setCameraReady(false);
            setCameraOpen(true);
          } catch {
            setError("No se pudo solicitar el permiso de cámara.");
          }
        },
        busy,
      )}
      <TextInput
        accessibilityLabel="Escribe tu mensaje al asistente"
        multiline
        maxLength={1000}
        editable={!busy}
        value={draft}
        onChangeText={setDraft}
        placeholder="Escribe tu pregunta…"
        placeholderTextColor={muted}
        style={{
          color: ink,
          borderColor: "#879bac",
          borderWidth: 1,
          borderRadius: 16,
          padding: 15,
          minHeight: 90,
          textAlignVertical: "top",
        }}
      />
      {button(
        sending
          ? "Respondiendo…"
          : error
            ? "Reintentar envío"
            : "Enviar mensaje",
        send,
        busy || !draft.trim(),
      )}
      <Text style={{ color: muted, fontSize: 12 }}>
        {local
          ? "La lectura y la guía se procesan en este teléfono. Descarga el catálogo una vez con internet. No enviamos preguntas ni fotos a un servicio generativo. Revisa las coincidencias; esta guía no responde preguntas generales."
          : "La guía de uso funciona sin internet. Las consultas y fotos necesitan conexión y se procesan en un servicio externo. Evita compartir contraseñas o datos personales."}
      </Text>
      {button("Buscar materiales en el catálogo", onCatalog, busy)}
      {button("Leer lista con la cámara", onCamera, busy)}
      {!!messages.length &&
        button(
          "Nueva conversación",
          () => {
            onMessages([]);
            setDraft("");
            setError("");
            setPhoto(null);
            setPartial("");
          },
          busy,
        )}
    </View>
  );
}
