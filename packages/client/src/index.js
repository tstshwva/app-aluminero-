export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function apiUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      value.endsWith("/")
      ? url
      : null;
  } catch {
    return null;
  }
}
export function allowedRole(audience, role) {
  return audience === "empresa"
    ? ["Administrador", "Operador"].includes(role)
    : audience === "cliente" && role === "Cliente";
}
export function createClient({
  baseUrl,
  storage,
  fetchImpl = globalThis.fetch,
}) {
  const base = apiUrl(baseUrl);
  let generation = 0;
  let storageQueue = Promise.resolve();
  function sessionTask(action) {
    const result = storageQueue.then(action);
    storageQueue = result.catch(() => {});
    return result;
  }
  const clearGeneration = (ticket) =>
    sessionTask(async () => {
      if (ticket === generation) await storage.clear();
    });
  const clearToken = (token, ticket) =>
    sessionTask(async () => {
      if (ticket !== generation || (await storage.get()) !== token)
        return false;
      await storage.clear();
      return true;
    });
  async function request(
    path,
    { method = "GET", body, authorization = true, token: override } = {},
  ) {
    if (!base)
      throw new ApiError(
        503,
        "La conexión HTTPS con la empresa todavía no está configurada.",
      );
    const url = new URL(path, base);
    if (url.origin !== base.origin || url.protocol !== "https:")
      throw new ApiError(400, "Destino no autorizado.");
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const ticket = generation;
    const token = authorization
      ? (override ?? (await sessionTask(() => storage.get())))
      : null;
    if (token) headers.Authorization = `Bearer ${token}`;
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetchImpl(url.href, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "error",
        signal: controller.signal,
      });
      if (response.redirected)
        throw new ApiError(502, "El servicio intentó redirigir la conexión.");
      const result =
        response.status === 204
          ? null
          : await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401 && authorization) {
          const cleared = await clearToken(token, ticket);
          if (!cleared || ticket !== generation)
            throw new ApiError(409, "La sesión cambió. Actualiza la pantalla.");
        }
        throw new ApiError(
          response.status,
          result?.error ?? "No fue posible completar la solicitud.",
        );
      }
      return result;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        503,
        "No pudimos conectar mediante HTTPS. Revisa tu conexión y el certificado del servicio.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  return {
    async login(email, password, audience) {
      const ticket = ++generation;
      const session = await request("api/auth/login", {
        method: "POST",
        body: { email, password },
        authorization: false,
      });
      if (
        !session ||
        !/^[0-9A-F]{64}$/i.test(session.accessToken ?? "") ||
        !allowedRole(audience, session.user?.role)
      ) {
        if (session?.accessToken)
          await request("api/auth/logout", {
            method: "POST",
            body: {},
            token: session.accessToken,
          }).catch(() => {});
        throw new ApiError(
          403,
          "Esta cuenta no corresponde a esta aplicación.",
        );
      }
      try {
        await sessionTask(async () => {
          if (ticket !== generation) throw new Error("Solicitud reemplazada.");
          await storage.save(session.accessToken);
        });
        if (ticket !== generation) throw new Error("Solicitud reemplazada.");
      } catch {
        await clearGeneration(ticket);
        await request("api/auth/logout", {
          method: "POST",
          body: {},
          token: session.accessToken,
        }).catch(() => {});
        throw new ApiError(
          503,
          "No pudimos guardar la sesión de forma segura.",
        );
      }
      return session.user;
    },
    async register(body) {
      const account = await request("api/auth/register", {
        method: "POST",
        body,
        authorization: false,
      });
      if (
        account?.role !== "Cliente" ||
        !/^[1-9][0-9]*$/.test(account.id ?? "")
      ) {
        throw new ApiError(
          502,
          "El servidor no confirmó el registro. Intenta iniciar sesión para comprobarlo.",
        );
      }
      return account;
    },
    async current(audience) {
      const ticket = generation;
      const token = await sessionTask(() => storage.get());
      if (!token) return null;
      try {
        const user = await request("api/auth/me", { token });
        if (ticket !== generation)
          throw new ApiError(409, "La sesión cambió. Actualiza la pantalla.");
        if (!allowedRole(audience, user.role)) {
          await clearToken(token, ticket);
          return null;
        }
        return user;
      } catch (error) {
        if (error.status === 401) return null;
        throw error;
      }
    },
    async logout(all = false) {
      const ticket = ++generation;
      const token = await sessionTask(() => storage.get());
      try {
        if (!token) return;
        await request(`api/auth/${all ? "logout-all" : "logout"}`, {
          method: "POST",
          body: {},
          token,
        });
      } finally {
        await clearGeneration(ticket);
      }
    },
    async changePassword(currentPassword, newPassword) {
      const ticket = generation;
      await request("api/auth/change-password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      if (ticket === generation) {
        generation++;
        await clearGeneration(generation);
      }
    },
    recovery: (email) =>
      request("api/auth/forgot-password", {
        method: "POST",
        body: { email },
        authorization: false,
      }),
    async reset(token, password) {
      const ticket = generation;
      await request("api/auth/reset-password", {
        method: "POST",
        body: { token, password },
        authorization: false,
      });
      if (ticket === generation) {
        generation++;
        await clearGeneration(generation);
      }
    },
    products: (search) =>
      request(`api/products?search=${encodeURIComponent(search ?? "")}`),
    customers: () => request("api/customers"),
    createCustomer: (name, phone) =>
      request("api/customers", { method: "POST", body: { name, phone } }),
    product: (productId) =>
      request(`api/products/${encodeURIComponent(productId)}`),
    categories: () => request("api/categories"),
    createCategory: (name) =>
      request("api/categories", { method: "POST", body: { name } }),
    saveProduct: (productId, body) =>
      request(
        productId
          ? `api/products/${encodeURIComponent(productId)}`
          : "api/products",
        { method: productId ? "PUT" : "POST", body },
      ),
    inventory: (productId, quantity, reason) =>
      request(`api/products/${encodeURIComponent(productId)}/inventory`, {
        method: "POST",
        body: { quantity, reason },
      }),
    adjustment: (productId, stock, reason) =>
      request(`api/products/${encodeURIComponent(productId)}/adjustment`, {
        method: "POST",
        body: { stock, reason },
      }),
    movements: (productId) =>
      request(`api/products/${encodeURIComponent(productId)}/movements`),
    favorites: () => request("api/favorites"),
    favorite: (productId, enabled) =>
      request(`api/favorites/${encodeURIComponent(productId)}`, {
        method: enabled ? "PUT" : "DELETE",
        ...(enabled ? { body: {} } : {}),
      }),
    profile: () => request("api/profile"),
    saveProfile: (body) => request("api/profile", { method: "PUT", body }),
    company: () => request("api/company"),
    saveCompany: (body) => request("api/company", { method: "PUT", body }),
    orders: (status) =>
      request(`api/orders?status=${encodeURIComponent(status ?? "")}`),
    order: (orderId) => request(`api/orders/${encodeURIComponent(orderId)}`),
    createOrder: (body) => request("api/orders", { method: "POST", body }),
    quote: (orderId, body) =>
      request(`api/orders/${encodeURIComponent(orderId)}/quote`, {
        method: "POST",
        body,
      }),
    acceptQuote: (orderId, revision) =>
      request(`api/orders/${encodeURIComponent(orderId)}/accept`, {
        method: "POST",
        body: { revision: Number(revision) },
      }),
    orderStatus: (orderId, status, note) =>
      request(`api/orders/${encodeURIComponent(orderId)}/status`, {
        method: "POST",
        body: { status, note },
      }),
    payment: (orderId, body) =>
      request(`api/orders/${encodeURIComponent(orderId)}/payments`, {
        method: "POST",
        body,
      }),
    notifications: () => request("api/notifications"),
    registerPush: (token) =>
      request("api/push-device", { method: "PUT", body: { token } }),
    disablePush: (token) =>
      request("api/push-device", { method: "DELETE", body: { token } }),
    readNotification: (notificationId) =>
      request(`api/notifications/${encodeURIComponent(notificationId)}/read`, {
        method: "POST",
        body: {},
      }),
    dashboard: () => request("api/dashboard"),
    assistant: (question) =>
      request("api/assistant", { method: "POST", body: { question } }),
    createStaff: (body) => request("api/auth/staff", { method: "POST", body }),
  };
}
