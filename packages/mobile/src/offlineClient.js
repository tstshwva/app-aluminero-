import { localAssistantHelp } from "../../client/src/assistantContext.js";
const networkFailure = (error) =>
  ["unavailable", "deadline-exceeded", "auth/network-request-failed"].includes(
    error?.code,
  );
const missing = () =>
  new Error(
    "Sin conexión. Abre esta sección con internet una vez para descargar sus datos.",
  );

export function withOfflineData(base, store, isOnline) {
  const readMethods = [
    "catalog",
    "products",
    "categories",
    "product",
    "profile",
    "orderDetail",
    "order",
    "orders",
    "dashboard",
    "enterpriseDashboard",
    "customers",
    "company",
    "notifications",
    "favorites",
    "movements",
  ];
  const api = { ...base, offlineStore: store };
  let syncing;
  const identity = () => base.offlineIdentity();
  const scoped = (uid, name, args = []) => JSON.stringify([uid, name, args]);
  async function session() {
    const uid = await identity();
    if (!uid) return null;
    return store.get(scoped(uid, "session"));
  }
  api.current = async (...args) => {
    if (!(await isOnline())) return session();
    try {
      const user = await base.current(...args);
      if (user) await store.set(scoped(user.id, "session"), user);
      return user;
    } catch (error) {
      if (networkFailure(error)) return session();
      throw error;
    }
  };
  // El escáner consulta únicamente la copia de esta cuenta, sin esperas de red.
  async function offlineList(name) {
    const uid = await identity();
    if (!uid) throw new Error("Inicia sesión para continuar.");
    const value =
      name === "products"
        ? ((await store.get(scoped(uid, name, [""]))) ??
          (await store.get(scoped(uid, name, []))))
        : await store.get(scoped(uid, name, []));
    if ((await identity()) !== uid)
      throw new Error("La sesión cambió. Vuelve a abrir el escáner.");
    if (value === null)
      throw new Error(
        "Abre el catálogo con conexión una vez para guardar los materiales en este teléfono. Después podrás buscarlos sin internet.",
      );
    return value;
  }
  api.offlineProducts = () => offlineList("products");
  api.offlineCategories = () => offlineList("categories");
  api.login = async (...args) => {
    if (!(await isOnline()))
      throw new Error(
        "El primer inicio de sesión requiere internet. Conserva tu sesión abierta para trabajar sin conexión.",
      );
    const user = await base.login(...args);
    await store.set(scoped(user.id, "session"), user);
    return user;
  };
  for (const name of readMethods) {
    if (typeof base[name] !== "function") continue;
    api[name] = async (...args) => {
      const uid = await identity();
      if (!uid) throw new Error("Inicia sesión para continuar.");
      // products() y products("") consultan el mismo catálogo completo.
      const normalizedArgs =
        name === "products" ? [String(args[0] ?? "").trim()] : args;
      const cacheKey = scoped(uid, name, normalizedArgs);
      let remoteError;
      if (name === "profile") {
        const pending = await store.get(scoped(uid, "pendingProfile"));
        if (pending)
          return {
            ...((await store.get(cacheKey)) ?? (await session()) ?? {}),
            name: pending.name,
            phone: pending.phone ?? "",
            business_name: pending.businessName ?? "",
            tax_id: pending.taxId ?? "",
            address: pending.address ?? "",
          };
      }
      if (await isOnline()) {
        try {
          if ((await identity()) !== uid)
            throw new Error("La sesión cambió. Vuelve a abrir la sección.");
          const value = await base[name](...args);
          if ((await identity()) !== uid)
            throw new Error("La sesión cambió. Vuelve a abrir la sección.");
          await store.set(cacheKey, value);
          return value;
        } catch (error) {
          if (!networkFailure(error)) throw error;
          remoteError = error;
        }
      }
      let value = await store.get(cacheKey);
      if (value === null && name === "products") {
        const all =
          (await store.get(scoped(uid, "products", [""]))) ??
          (await store.get(scoped(uid, "products", [])));
        if (all)
          value = all.filter((p) =>
            [p.name, p.code].some((v) =>
              String(v ?? "")
                .toLowerCase()
                .includes(
                  String(args[0] ?? "")
                    .trim()
                    .toLowerCase(),
                ),
            ),
          );
      }
      if (value === null && name === "product") {
        const all =
          (await store.get(scoped(uid, "products", []))) ??
          (await store.get(scoped(uid, "products", [""])));
        value =
          all?.find((product) => String(product.id) === String(args[0])) ??
          null;
      }
      if (value === null && name === "orders" && args[0]) {
        const all = await store.get(scoped(uid, "orders", []));
        if (all) value = all.filter((order) => order.status === args[0]);
      }
      if (value === null && name === "profile") value = await session();
      if (value === null) {
        if (remoteError)
          throw Object.assign(
            new Error(
              "No pudimos actualizar esta sección desde Firebase y todavía no hay una copia descargada. Reintenta; tener internet no garantiza acceso al servicio.",
            ),
            { code: remoteError.code, cause: remoteError },
          );
        throw missing();
      }
      return value;
    };
  }
  for (const name of [
    "register",
    "recovery",
    "createOrder",
    "saveCompany",
    "createCategory",
    "saveProduct",
    "inventory",
    "adjustment",
    "createCustomer",
    "quote",
    "acceptQuote",
    "orderStatus",
    "payment",
    "readNotification",
    "registerPush",
    "disablePush",
    "createStaff",
  ]) {
    if (!base[name]) continue;
    api[name] = async (...args) => {
      if (!(await isOnline()))
        throw new Error(
          name === "assistant"
            ? "El chat necesita internet. Puedes usar el catálogo descargado y el lector local de texto."
            : "Esta operación necesita internet. Conserva tu sesión para usar los datos descargados.",
        );
      return base[name](...args);
    };
  }
  if (base.assistant)
    api.assistant = async (question, image, history = [], options = {}) => {
      const uid = await identity();
      if (!uid) throw new Error("Inicia sesión para continuar.");
      if (
        typeof question !== "string" ||
        !question.trim() ||
        question.trim().length > 1000
      )
        throw new Error("Escribe una pregunta de hasta 1000 caracteres.");
      if (!image && typeof question === "string") {
        const help = localAssistantHelp(question);
        if (help) return help;
      }
      if (!(await isOnline()))
        throw new Error(
          "El chat necesita internet. Puedes usar la guía de la app, el catálogo descargado y el lector local.",
        );
      const snapshot =
        (await store.get(scoped(uid, "products", [""]))) ??
        (await store.get(scoped(uid, "products", [])));
      if ((await identity()) !== uid)
        throw new Error("La sesión cambió. Vuelve a abrir el asistente.");
      const result = await base.assistant(question, image, history, {
        ...options,
        catalogSnapshot: snapshot ?? undefined,
      });
      if ((await identity()) !== uid)
        throw new Error("La sesión cambió. Vuelve a abrir el asistente.");
      return result;
    };
  const originalSave = base.saveProfile;
  if (originalSave)
    api.saveProfile = async (body) => {
      const uid = await identity();
      if (!uid) throw new Error("Inicia sesión para continuar.");
      if (!String(body.name ?? "").trim())
        throw Object.assign(new Error("Escribe tu nombre."), { field: "name" });
      if (await isOnline()) {
        try {
          if ((await identity()) !== uid)
            throw new Error("La sesión cambió. Vuelve a abrir el perfil.");
          await originalSave(body);
          await store.remove(scoped(uid, "pendingProfile"));
          return;
        } catch (error) {
          if (!networkFailure(error)) throw error;
        }
      }
      const previous =
        (await store.get(scoped(uid, "profile"))) ?? (await session()) ?? {};
      await store.set(scoped(uid, "pendingProfile"), body);
      await store.set(scoped(uid, "profile"), {
        ...previous,
        name: body.name,
        phone: body.phone ?? "",
        business_name: body.businessName ?? "",
        tax_id: body.taxId ?? "",
        address: body.address ?? "",
      });
    };
  api.syncOffline = () =>
    (syncing ??= (async () => {
      if (!(await isOnline())) return;
      const uid = await identity();
      if (!uid) return;
      const pending = await store.get(scoped(uid, "pendingProfile"));
      if (pending) {
        if ((await identity()) !== uid) return;
        await originalSave(pending);
        // Una edición nueva durante el envío permanece en la cola.
        if (
          JSON.stringify(await store.get(scoped(uid, "pendingProfile"))) ===
          JSON.stringify(pending)
        )
          await store.remove(scoped(uid, "pendingProfile"));
      }
    })().finally(() => {
      syncing = null;
    }));
  api.logout = async () => {
    const uid = await identity();
    await base.logout();
    if (uid) await store.remove(scoped(uid, "session"));
  };
  if (base.subscribeOrders)
    api.subscribeOrders = (status, callback, onError) => {
      let active = true;
      const owner = identity();
      const args = status ? [status] : [];
      void api
        .orders(...args)
        .then((value) => {
          if (active) callback(value);
        })
        .catch((error) => {
          if (active) onError?.(error);
        });
      const unsubscribe = base.subscribeOrders(
        status,
        async (orders, metadata = {}) => {
          if (metadata.fromCache) return;
          const uid = await identity();
          if (!uid || !active || uid !== (await owner)) return;
          try {
            await store.set(scoped(uid, "orders", args), orders);
          } catch {}
          if (active) callback(orders);
        },
        (error) => {
          if (active && !networkFailure(error)) onError?.(error);
        },
      );
      return () => {
        active = false;
        unsubscribe();
      };
    };
  return api;
}
