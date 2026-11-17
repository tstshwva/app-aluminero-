import { ApiError } from "./index.js";

const firebaseErrors = {
  INVALID_LOGIN_CREDENTIALS: [
    401,
    "El correo o la contraseña son incorrectos.",
  ],
  INVALID_PASSWORD: [401, "El correo o la contraseña son incorrectos."],
  EMAIL_NOT_FOUND: [401, "El correo o la contraseña son incorrectos."],
  USER_DISABLED: [401, "La cuenta está desactivada."],
  EMAIL_EXISTS: [409, "Este correo ya está registrado."],
  TOO_MANY_ATTEMPTS_TRY_LATER: [
    429,
    "Espera unos minutos antes de intentarlo de nuevo.",
  ],
  INVALID_REFRESH_TOKEN: [401, "Tu sesión terminó. Vuelve a iniciar sesión."],
  TOKEN_EXPIRED: [401, "Tu sesión terminó. Vuelve a iniciar sesión."],
  USER_NOT_FOUND: [401, "Tu sesión terminó. Vuelve a iniciar sesión."],
};

export function createFirebaseAuth({ apiKey, fetchImpl = globalThis.fetch }) {
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new ApiError(503, "Falta configurar Firebase Authentication.");
  }
  const key = encodeURIComponent(apiKey);

  async function request(url, body, contentType = "application/json") {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        redirect: "error",
        headers: { "Content-Type": contentType, Accept: "application/json" },
        body,
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) {
        const code = String(result?.error?.message ?? "").split(" : ")[0];
        const [status, message] = Object.hasOwn(firebaseErrors, code)
          ? firebaseErrors[code]
          : [503, "Firebase no pudo completar la solicitud de acceso."];
        throw new ApiError(status, message);
      }
      return result;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        503,
        "No pudimos conectar con Firebase. Revisa tu conexión a internet.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  const identity = (action, value) =>
    request(
      `https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${key}`,
      JSON.stringify(value),
    );

  function session(result, refreshed = false) {
    const uid = refreshed ? result?.user_id : result?.localId;
    const idToken = refreshed ? result?.id_token : result?.idToken;
    const refreshToken = refreshed
      ? result?.refresh_token
      : result?.refreshToken;
    const seconds = Number(refreshed ? result?.expires_in : result?.expiresIn);
    if (
      ![uid, idToken, refreshToken].every(
        (value) => typeof value === "string" && value,
      ) ||
      !Number.isSafeInteger(seconds) ||
      seconds <= 0 ||
      seconds > 86400
    ) {
      throw new ApiError(502, "Firebase no confirmó la sesión.");
    }
    return {
      uid,
      idToken,
      refreshToken,
      expiresAt: Date.now() + seconds * 1000,
    };
  }

  return {
    async signIn(email, password) {
      return session(
        await identity("signInWithPassword", {
          email: email.trim(),
          password,
          returnSecureToken: true,
        }),
      );
    },
    async register(email, password) {
      return session(
        await identity("signUp", {
          email: email.trim(),
          password,
          returnSecureToken: true,
        }),
      );
    },
    async refresh(refreshToken) {
      return session(
        await request(
          `https://securetoken.googleapis.com/v1/token?key=${key}`,
          new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
          }).toString(),
          "application/x-www-form-urlencoded",
        ),
        true,
      );
    },
    async recover(email) {
      await identity("sendOobCode", {
        requestType: "PASSWORD_RESET",
        email: email.trim(),
      });
    },
  };
}
