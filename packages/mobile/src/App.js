import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { fetch as secureFetch } from "expo/fetch";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { createClient } from "@aluformix/client";
import { createSessionStorage } from "./storage";
import BusinessApp from "./BusinessApp";

// En el navegador, la página se declara en español para que no se ofrezca
// traducirla automáticamente (por ejemplo, «Cód.» se traducía como «Bacalao»).
if (Platform.OS === "web" && typeof document !== "undefined")
  document.documentElement.lang = "es-MX";

export default function AluformixApp({ audience }) {
  return (
    <SafeAreaProvider>
      <AppContent audience={audience} />
    </SafeAreaProvider>
  );
}

function AppContent({ audience }) {
  const storage = useMemo(() => createSessionStorage(audience), [audience]);
  const client = useMemo(
    () =>
      createClient({
        baseUrl: process.env.EXPO_PUBLIC_API_URL ?? "",
        storage,
        fetchImpl: secureFetch,
      }),
    [storage],
  );
  const [user, setUser] = useState(null),
    [mode, setMode] = useState("login"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [values, setValues] = useState({}),
    [show, setShow] = useState(false);
  const working = useRef(false),
    mounted = useRef(true);
  const change = (name, value) =>
    setValues((previous) => ({ ...previous, [name]: value }));
  function switchMode(next) {
    setMode(next);
    setValues({});
    setShow(false);
    setMessage("");
  }
  async function run(action) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      if (mounted.current) {
        setMessage(error.message ?? "No fue posible continuar.");
        if (error.status === 401) {
          setUser(null);
          setMode("login");
        }
      }
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    run(async () => setUser(await client.current(audience)));
    const listener = AppState.addEventListener("change", (state) => {
      setValues((previous) => ({
        ...previous,
        password: "",
        confirmation: "",
        currentPassword: "",
        token: "",
      }));
      setShow(false);
      if (state === "active")
        run(async () => {
          const current = await client.current(audience);
          setUser(current);
          if (!current) {
            setMode("login");
          }
        });
    });
    return () => {
      mounted.current = false;
      listener.remove();
    };
  }, [client, audience]);
  async function submit() {
    await run(async () => {
      const password = values.password ?? "";
      if (["register", "reset", "change"].includes(mode)) {
        if (password.length < 12 || password.length > 128)
          throw new Error("Usa una contraseña de 12 a 128 caracteres.");
        if (password !== values.confirmation)
          throw new Error("Las contraseñas no coinciden.");
      }
      if (mode === "login") {
        if (!values.email || !password)
          throw new Error("Escribe correo y contraseña.");
        const account = await client.login(values.email, password, audience);
        setValues({});
        setUser(account);
      } else if (mode === "register") {
        await client.register({
          name: values.name ?? "",
          phone: values.phone ?? "",
          email: values.email ?? "",
          password,
        });
        switchMode("login");
        setMessage("Cuenta creada. Inicia sesión.");
      } else if (mode === "forgot") {
        await client.recovery(values.email ?? "");
        switchMode("reset");
        setMessage(
          "Si la cuenta existe y el servicio está disponible, recibirás instrucciones por correo.",
        );
      } else if (mode === "reset") {
        await client.reset(values.token ?? "", password);
        switchMode("login");
        setMessage("Contraseña actualizada. Inicia sesión.");
      } else if (mode === "change") {
        await client.changePassword(values.currentPassword ?? "", password);
        setUser(null);
        switchMode("login");
        setMessage(
          "Contraseña actualizada. Las sesiones anteriores se cerraron.",
        );
      }
    });
  }
  function field(
    name,
    placeholder,
    { secret = false, keyboard = "default", maxLength = 128 } = {},
  ) {
    return (
      <TextInput
        key={name}
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor="#657b91"
        value={values[name] ?? ""}
        onChangeText={(value) => change(name, value)}
        secureTextEntry={secret && !show}
        autoCapitalize={
          secret || keyboard === "email-address" ? "none" : "sentences"
        }
        autoCorrect={!secret && keyboard === "default"}
        keyboardType={keyboard}
        maxLength={maxLength}
        editable={!busy}
        style={styles.input}
      />
    );
  }
  function button(label, action, secondary = false) {
    return (
      <Pressable
        key={label}
        accessibilityRole="button"
        disabled={busy}
        onPress={action}
        style={[
          styles.button,
          secondary && styles.secondary,
          busy && styles.disabled,
        ]}
      >
        <Text style={[styles.buttonText, secondary && styles.secondaryText]}>
          {label}
        </Text>
      </Pressable>
    );
  }
  async function logout(all) {
    await run(async () => {
      try {
        await client.logout(all);
        setMessage("Sesión cerrada.");
      } finally {
        setUser(null);
        setValues({});
        setMode("login");
      }
    });
  }
  const title = {
    login: "Inicia sesión",
    register: "Crea tu cuenta",
    forgot: "Recupera tu acceso",
    reset: "Nueva contraseña",
    change: "Cambia tu contraseña",
  }[mode];
  if (user && mode !== "change") {
    return (
      <SafeAreaView style={styles.businessScreen}>
        <StatusBar style="dark" />
        <BusinessApp
          key={user.id}
          client={client}
          user={user}
          audience={audience}
          busy={busy}
          run={run}
          message={message}
          onPassword={() => switchMode("change")}
          onLogout={logout}
          onUser={setUser}
        />
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <StatusBar style="dark" />
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <Image
              source={require("../assets/aluformix-logo.png")}
              style={styles.brandImage}
            />
            <View>
              <Text style={styles.logo}>ALUFORMIX</Text>
              <Text style={styles.subtitle}>
                {audience === "empresa" ? "EMPRESA" : "CLIENTE"}
              </Text>
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            {mode === "register" &&
              field("name", "Nombre completo", { maxLength: 120 })}
            {mode === "register" &&
              field("phone", "Teléfono", {
                keyboard: "phone-pad",
                maxLength: 25,
              })}
            {["login", "register", "forgot"].includes(mode) &&
              field("email", "Correo electrónico", {
                keyboard: "email-address",
                maxLength: 254,
              })}
            {mode === "reset" &&
              field("token", "Código de recuperación", {
                secret: true,
                maxLength: 64,
              })}
            {mode === "change" &&
              field("currentPassword", "Contraseña actual", { secret: true })}
            {mode !== "forgot" &&
              field(
                "password",
                mode === "login" ? "Contraseña" : "Nueva contraseña",
                { secret: true },
              )}
            {["register", "reset", "change"].includes(mode) &&
              field("confirmation", "Confirma la contraseña", { secret: true })}
            {mode !== "forgot" &&
              button(
                show ? "Ocultar contraseña" : "Mostrar contraseña",
                () => setShow(!show),
                true,
              )}
            {button(
              mode === "forgot"
                ? "Enviar instrucciones"
                : mode === "register"
                  ? "Crear cuenta"
                  : mode === "login"
                    ? "Iniciar sesión"
                    : "Guardar contraseña",
              submit,
            )}
            {mode === "login" &&
              audience === "cliente" &&
              button(
                "Crear cuenta de comprador",
                () => switchMode("register"),
                true,
              )}
            {mode === "login" &&
              button("Olvidé mi contraseña", () => switchMode("forgot"), true)}
            {mode === "forgot" &&
              button("Ya tengo un código", () => switchMode("reset"), true)}
            {mode !== "login" &&
              button(
                mode === "change" ? "Volver a mi cuenta" : "Volver al acceso",
                () => switchMode("login"),
                true,
              )}
          </View>
          {busy && <ActivityIndicator size="large" color="#007bff" />}
          {!!message && (
            <Text accessibilityLiveRegion="polite" style={styles.message}>
              {message}
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f2f6fb" },
  businessScreen: { flex: 1, backgroundColor: "#f2f6fb" },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 9,
  },
  brandImage: { width: 44, height: 44, borderRadius: 22 },
  container: {
    padding: 24,
    paddingTop: 28,
    paddingBottom: 48,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    gap: 14,
  },
  logo: { fontSize: 25, fontWeight: "800", color: "#07325a" },
  subtitle: {
    color: "#526b82",
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: "800",
  },
  title: {
    fontSize: 27,
    fontWeight: "700",
    color: "#102c46",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 16,
    gap: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#dce7f2",
  },
  input: {
    backgroundColor: "#fff",
    borderColor: "#bdcee0",
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: "#102c46",
    minHeight: 52,
  },
  button: {
    backgroundColor: "#007bff",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginVertical: 4,
  },
  secondary: { backgroundColor: "#e8f2ff" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryText: { color: "#0066cc" },
  disabled: { opacity: 0.5 },
  message: { color: "#334f68", fontSize: 15, lineHeight: 22 },
  name: { fontSize: 19, fontWeight: "700", color: "#102c46" },
  navigation: { marginVertical: 12 },
  empty: { paddingVertical: 24, color: "#526b82" },
});
