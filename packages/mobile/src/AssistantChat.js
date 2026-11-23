import React, { useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

export default function AssistantChat({ client, messages, onMessages, dark, onCatalog, onCamera }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const ink = dark ? "#f2f2f2" : "#102c46";
  const muted = dark ? "#b9c9d8" : "#526b82";
  const button = (label, action, disabled = false) => (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={action}
      style={{ padding: 14, borderRadius: 14, backgroundColor: disabled ? "#7294b5" : "#006fe5", marginVertical: 5 }}>
      <Text style={{ color: "white", fontWeight: "700", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
  async function send() {
    const question = draft.trim();
    if (!question || locked.current) return;
    locked.current = true;
    setSending(true);
    setError("");
    try {
      if (!client.assistant) throw new Error("El asistente no está disponible en esta versión.");
      const result = await client.assistant(question, undefined, messages.slice(-12));
      if (!result?.answer?.trim()) throw new Error("No llegó una respuesta. Intenta de nuevo.");
      onMessages([...messages, { role: "user", text: question }, { role: "assistant", text: result.answer }].slice(-40));
      setDraft("");
    } catch (failure) {
      setError(failure.message || "No se pudo enviar. Tu pregunta sigue escrita para reintentar.");
    } finally {
      locked.current = false;
      setSending(false);
    }
  }
  return <View style={{ gap: 10 }}>
    <Text style={{ fontSize: 27, fontWeight: "800", color: ink }}>Tu asistente Aluformix</Text>
    <Text style={{ color: muted }}>Pregunta sobre materiales, tu proyecto o cómo usar la app. Podemos resolverlo paso a paso.</Text>
    {!messages.length && <View style={{ padding: 16, borderRadius: 18, backgroundColor: dark ? "#19344b" : "#e1effc" }}>
      <Text style={{ color: ink }}>Hola, ¿en qué puedo ayudarte hoy?</Text>
      {["¿Cómo hago un encargo?", "Ayúdame a elegir materiales", "¿Cómo leo mi lista con la cámara?"].map(question =>
        <Pressable key={question} accessibilityRole="button" onPress={() => setDraft(question)} style={{ paddingVertical: 12 }}>
          <Text style={{ color: dark ? "#8ec8ff" : "#0066bd" }}>{question}</Text>
        </Pressable>)}
    </View>}
    {messages.map((message, index) => <View key={index} style={{
      alignSelf: message.role === "user" ? "flex-end" : "flex-start",
      maxWidth: "94%", padding: 15, borderRadius: 18,
      backgroundColor: message.role === "user" ? "#006fe5" : dark ? "#19344b" : "#e1effc",
    }}>
      <Text style={{ fontSize: 12, marginBottom: 5, color: message.role === "user" ? "white" : muted }}>{message.role === "user" ? "Tú" : "Asistente"}</Text>
      <Text selectable style={{ fontSize: 16, lineHeight: 24, color: message.role === "user" ? "white" : ink }}>{message.text}</Text>
    </View>)}
    {sending && <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: 8 }}>
      <ActivityIndicator color="#007bff" /><Text style={{ color: muted }}>Preparando respuesta…</Text>
    </View>}
    {!!error && <Text accessibilityRole="alert" style={{ color: dark ? "#ffb4b4" : "#a51d36", padding: 12 }}>{error}</Text>}
    <TextInput accessibilityLabel="Escribe tu mensaje al asistente" multiline maxLength={1000}
      editable={!sending} value={draft} onChangeText={setDraft} placeholder="Escribe tu pregunta…"
      placeholderTextColor={muted} style={{ color: ink, borderColor: "#879bac", borderWidth: 1, borderRadius: 16, padding: 15, minHeight: 90, textAlignVertical: "top" }} />
    {button(sending ? "Respondiendo…" : error ? "Reintentar envío" : "Enviar mensaje", send, sending || !draft.trim())}
    <Text style={{ color: muted, fontSize: 12 }}>Necesita internet. La conversación se procesa en un servicio externo. Evita compartir contraseñas o datos personales.</Text>
    {button("Buscar materiales en el catálogo", onCatalog, sending)}
    {button("Leer lista con la cámara", onCamera, sending)}
    {!!messages.length && button("Nueva conversación", () => { onMessages([]); setDraft(""); setError(""); }, sending)}
  </View>;
}
