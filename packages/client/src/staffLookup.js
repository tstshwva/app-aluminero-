export async function readStaffOverHttps(projectId, user, fetcher = fetch) {
  const token = await user.getIdToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const path = "https://firestore.googleapis.com/v1/projects/" +
      encodeURIComponent(projectId) + "/databases/(default)/documents/aluf_staff/" + encodeURIComponent(user.uid);
    const response = await fetcher(path, { headers: { Authorization: "Bearer " + token }, signal: controller.signal });
    if (response.status === 404) return null;
    if (!response.ok) throw Object.assign(new Error("No se pudo verificar el acceso de la cuenta."), {
      code: response.status === 403 ? "permission-denied" : response.status === 401 ? "unauthenticated" : "unavailable",
    });
    const document = await response.json();
    return { active: document.fields?.active?.booleanValue === true, role: document.fields?.role?.stringValue };
  } finally {
    clearTimeout(timer);
  }
}
