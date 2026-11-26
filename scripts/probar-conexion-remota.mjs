// Pruebas reales de solo lectura. No crea cuentas ni modifica producción.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
const project = "alumineroapp-9244c";
const results = [];
async function check(name, run) {
  const start = Date.now();
  try {
    const detail = await run();
    results.push({ prueba: name, ok: true, ms: Date.now() - start, ...detail });
  } catch {
    // Nunca imprimir excepciones con URL que pueda contener una API key.
    results.push({ prueba: name, ok: false, ms: Date.now() - start });
    process.exitCode = 1;
  }
}
const request = (url, options = {}) =>
  fetch(url, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
for (const audience of ["cliente", "empresa"]) {
  await check("Firebase Auth HTTPS / " + audience, async () => {
    const key = process.env["ALUFORMIX_" + audience.toUpperCase() + "_API_KEY"];
    assert.ok(key, "Configuración ausente");
    const response = await request(
      "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" +
        encodeURIComponent(key),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "probe-" + randomUUID() + "@connection.invalid",
          password: randomUUID(),
          returnSecureToken: true,
        }),
      },
    );
    const data = await response.json();
    assert.equal(response.status, 400);
    assert.ok(
      ["INVALID_LOGIN_CREDENTIALS", "EMAIL_NOT_FOUND"].includes(
        data?.error?.message,
      ),
    );
    return { http: response.status, servicioAccesible: true, loginReal: false };
  });
}
await check("Firestore HTTPS rechaza lectura sin autenticar", async () => {
  const r = await request(
    "https://firestore.googleapis.com/v1/projects/" +
      project +
      "/databases/(default)/documents/usuarios/connection-probe-check",
  );
  const body = await r.json();
  console.log(JSON.stringify({ firestoreHttp: r.status, firestoreStatus: /^[A-Z_]+$/.test(body.error?.status ?? "") ? body.error.status : "otro" }));
  assert.ok([401, 403].includes(r.status));
  assert.ok(["PERMISSION_DENIED", "UNAUTHENTICATED"].includes(body.error?.status));
  return { http: r.status, sesionAutenticadaProbada: false };
});
const targets = [
  [
    "cliente",
    "df93c9b7-6495-4d0c-bd94-fdd9f9424c7b",
    "4e0ff4053cc281eefb3abdeeaf8f162cda50f2d1",
  ],
  [
    "empresa",
    "95264e62-bdaf-47df-b46d-6955eb95e7c3",
    "0cbe0fb47c7682fddf15caf15b3b30737ed81a2a",
  ],
];
for (const [audience, expoProject, runtime] of targets) {
  await check("Actualización Expo y hash / " + audience, async () => {
    const r = await request("https://u.expo.dev/" + expoProject, {
      headers: {
        "expo-platform": "android",
        "expo-runtime-version": runtime,
        "expo-channel-name": audience + "-production",
        "expo-protocol-version": "1",
        accept: "multipart/mixed,application/expo+json,application/json",
      },
    });
    assert.equal(r.status, 200);
    const body = await r.text();
    const boundary = r.headers
      .get("content-type")
      ?.match(/boundary="?([^;"\s]+)/)?.[1];
    assert.ok(boundary);
    const parts = {};
    for (const part of body.split("--" + boundary)) {
      const name = part.match(/name="([^"]+)"/)?.[1];
      if (name)
        parts[name] = JSON.parse(
          part.slice(part.indexOf("\r\n\r\n") + 4).trim(),
        );
    }
    const manifest = parts.manifest;
    assert.equal(manifest.runtimeVersion, runtime);
    const asset = manifest.launchAsset;
    const bundle = await request(asset.url, {
      headers: parts.extensions?.assetRequestHeaders?.[asset.key] ?? {},
    });
    assert.equal(bundle.status, 200);
    const bytes = Buffer.from(await bundle.arrayBuffer());
    assert.equal(
      createHash("sha256").update(bytes).digest("base64url"),
      asset.hash,
    );
    return { http: 200, updateId: manifest.id, hashVerificado: true };
  });
}
console.log(
  JSON.stringify(
    {
      entorno: process.env.GITHUB_ACTIONS
        ? "GitHub Actions remoto"
        : "ejecución local",
      resultados: results,
    },
    null,
    2,
  ),
);
