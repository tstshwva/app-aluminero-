import { answerAssistant } from "./assistantEngine.js";
import { enterpriseOperations } from "./enterpriseFirebase.js";
import { decimal, text } from "./enterpriseDomain.js";
import { readStaffOverHttps } from "./staffLookup.js";
import { readWithDeadline } from "./readDeadline.js";
import { CustomProvider, initializeAppCheck } from "firebase/app-check";
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
import { initializeApp, getApps } from "firebase/app";
import {
  initializeAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import {
  initializeFirestore,
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  orderBy,
  runTransaction,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

import { profileFields } from "./profile.js";

const instances = new Map();
const getDoc = (reference) =>
  readWithDeadline(() => getDocFromServer(reference));
const getDocs = (reference) =>
  readWithDeadline(() => getDocsFromServer(reference));

export function createFirebaseClient({
  config,
  storage,
  audience,
  getAssistantAppCheckToken,
  forceLongPolling = false,
}) {
  const name = "aluformix-" + audience;
  if (!instances.has(name)) {
    const app =
      getApps().find((item) => item.name === name) ??
      initializeApp(config, name);
    const persistence = class {
      static type = "LOCAL";
      type = "LOCAL";
      async _isAvailable() {
        await storage.get();
        return true;
      }
      async _set(_key, data) {
        await storage.save(JSON.stringify(data));
      }
      async _get() {
        try {
          return JSON.parse(await storage.get());
        } catch {
          return null;
        }
      }
      async _remove() {
        await storage.clear();
      }
      _addListener() {}
      _removeListener() {}
    };
    instances.set(name, {
      app,
      auth: initializeAuth(app, { persistence }),
      db: initializeFirestore(
        app,
        forceLongPolling
          ? {
              experimentalForceLongPolling: true,
              experimentalLongPollingOptions: { timeoutSeconds: 25 },
            }
          : {},
      ),
    });
  }

  const { app, auth, db } = instances.get(name);
  const orders = collection(db, "pedidos");
  const products = collection(db, "catalogo");
  const company = audience === "empresa";
  const roleDoc = (uid) => doc(db, "aluf_staff", uid);

  async function account(user) {
    if (!user) return null;
    let staff;
    try {
      staff = (await getDoc(roleDoc(user.uid))).data();
    } catch (error) {
      if (!["unavailable", "deadline-exceeded"].includes(error.code))
        throw error;
      try {
        staff = await readStaffOverHttps(config.projectId, user);
      } catch (failure) {
        if (["permission-denied", "unauthenticated"].includes(failure.code))
          throw failure;
        throw Object.assign(
          new Error(
            "No pudimos verificar tu cuenta con el servidor. Comprueba el acceso a internet y vuelve a intentar.",
          ),
          { code: "unavailable" },
        );
      }
    }
    const role =
      staff?.active === true &&
      ["Administrador", "Operador"].includes(staff.role)
        ? staff.role
        : "Cliente";
    if (company !== (role !== "Cliente")) {
      await signOut(auth);
      throw new Error("Esta cuenta no corresponde a esta aplicación.");
    }
    return {
      id: user.uid,
      name: user.displayName || user.email,
      email: user.email,
      role,
    };
  }

  function orderQuery(status) {
    const user = auth.currentUser;
    if (!user) throw new Error("Inicia sesión para continuar.");
    const filters = [];
    if (!company) filters.push(where("ownerUid", "==", user.uid));
    if (status) filters.push(where("status", "==", status));
    return query(orders, ...filters);
  }

  const readOrder = (snapshot) => {
    const value = snapshot.data();
    return {
      ...value,
      id: snapshot.id,
      user_id: value.walkIn ? null : value.ownerUid,
      customer_id: value.customerId ?? value.ownerUid,
      customer_name:
        value.customerName ??
        value.notes?.match(/(?:^|\n)Contacto: ([^\n]+)/)?.[1] ??
        "",
      customer_phone:
        value.customerPhone ??
        value.notes?.match(/(?:^|\n)Teléfono: ([^\n]+)/)?.[1] ??
        "",
      created_at: value.createdAt?.toDate()?.toISOString() ?? null,
      delivery_address: value.deliveryAddress || null,
    };
  };

  const list = (snapshot) =>
    snapshot.docs
      .map(readOrder)
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  const cachedReads = new Map();

  function readCached(key, read) {
    const cached = cachedReads.get(key);
    if (cached && cached.expires > Date.now()) return cached.promise;
    const entry = { expires: Date.now() + 30000 };
    entry.promise = Promise.resolve()
      .then(read)
      .catch((error) => {
        if (cachedReads.get(key) === entry) cachedReads.delete(key);
        throw error;
      });
    cachedReads.set(key, entry);
    return entry.promise;
  }

  async function catalog() {
    return readCached("catalog", async () => {
      const snapshot = await getDocs(query(products, orderBy("name")));
      return snapshot.docs.map((item) => ({ ...item.data(), id: item.id }));
    });
  }

  async function orderDetail(id) {
    const snapshot = await getDoc(doc(orders, String(id)));
    if (!snapshot.exists()) throw new Error("El pedido no existe.");
    const order = readOrder(snapshot);
    const allProducts = await catalog();
    const productMap = new Map(
      allProducts.map((product) => [String(product.id), product]),
    );
    return {
      order,
      items: order.items.map((item, index) => ({
        ...item,
        id: String(index + 1),
        product_id: item.productId,
        product_name:
          productMap.get(String(item.productId))?.name ??
          "Producto no disponible",
        product_code: productMap.get(String(item.productId))?.code ?? "",
        unit_price:
          item.unitPrice ??
          productMap.get(String(item.productId))?.price ??
          "0.00",
        cut_length_mm: item.cutLengthMm ?? null,
      })),
      quote: order.quote ?? null,
      history: order.history ?? [],
      payments: order.payments ?? [],
    };
  }

  async function enterpriseDashboard() {
    if (!company) throw new Error("El panel requiere una cuenta de Empresa.");
    const [snapshot, products] = await Promise.all([
      getDocs(orderQuery()),
      catalog(),
    ]);
    const pendingOrders = list(snapshot);
    const counts = new Map();
    for (const { status } of pendingOrders) {
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    return {
      total: pendingOrders.length,
      pendientes: counts.get("Solicitado") ?? 0,
      orders: Array.from(counts, ([status, count]) => ({ status, count })),
      lowStock: products.filter(
        (p) =>
          p.active !== 0 &&
          Number(p.stock) - Number(p.reserved ?? 0) <= Number(p.minimum_stock),
      ),
    };
  }

  const operations = enterpriseOperations({
    db,
    auth,
    config,
    invalidate: () => cachedReads.clear(),
  });
  return {
    ...operations,
    cloud: true,
    async offlineIdentity() {
      await auth.authStateReady();
      return auth.currentUser?.uid ?? null;
    },
    async assistant(question, image, history = [], options = {}) {
      if (!auth.currentUser)
        throw new Error("Inicia sesión para usar el asistente.");
      const owner = auth.currentUser.uid;
      const result = await answerAssistant({
        question,
        image,
        history,
        ...options,
        readCatalog: catalog,
        createModel: (settings, requestOptions) => {
          if (!getAssistantAppCheckToken)
            throw new Error(
              "El asistente requiere una versión con verificación de seguridad configurada.",
            );
          const aiName = app.name + "-assistant";
          let aiApp = getApps().find((item) => item.name === aiName);
          if (!aiApp) {
            aiApp = initializeApp(app.options, aiName);
            initializeAppCheck(aiApp, {
              provider: new CustomProvider({
                getToken: getAssistantAppCheckToken,
              }),
              isTokenAutoRefreshEnabled: false,
            });
          }
          return getGenerativeModel(
            getAI(aiApp, { backend: new GoogleAIBackend() }),
            settings,
            requestOptions,
          );
        },
      });
      if (auth.currentUser?.uid !== owner)
        throw new Error("La sesión cambió. Vuelve a abrir el asistente.");
      return result;
    },
    catalog,
    async categories() {
      return readCached("categories", async () => {
        const snapshot = await getDocs(
          query(collection(db, "categorias"), orderBy("nombre")),
        );
        return snapshot.docs.map((category) => ({
          ...category.data(),
          id: category.id,
          name: category.data().nombre,
        }));
      });
    },
    enterpriseDashboard,
    dashboard: enterpriseDashboard,
    async products(search = "") {
      const term = search.trim().toLowerCase();
      return (await catalog()).filter((product) =>
        [product.name, product.code].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(term),
        ),
      );
    },
    async product(id) {
      const snapshot = await getDoc(doc(products, String(id)));
      if (!snapshot.exists()) throw new Error("El producto no existe.");
      return { ...snapshot.data(), id: snapshot.id };
    },
    async profile() {
      const user = auth.currentUser;
      if (!user) throw new Error("Inicia sesión para continuar.");
      const snapshot = await getDoc(doc(db, "usuarios", user.uid));
      return { ...snapshot.data(), ...(await account(user)) };
    },
    async saveProfile(body) {
      const user = auth.currentUser;
      if (!user) throw new Error("Inicia sesión para continuar.");
      const displayName = String(body.name ?? "")
        .trim()
        .slice(0, 120);
      if (!displayName)
        throw Object.assign(new Error("Escribe tu nombre."), { field: "name" });
      if (!company) {
        const ref = doc(db, "usuarios", user.uid);
        try {
          // Transacción: sin conexión falla en vez de quedarse esperando.
          await runTransaction(db, async (transaction) => {
            transaction.set(ref, profileFields(body), { merge: true });
          });
        } catch (error) {
          if (error.code !== "permission-denied") throw error;
          throw new Error(
            "El perfil todavía no se puede guardar en el servidor. Puedes escribir tus datos al hacer un encargo.",
          );
        }
      }
      await updateProfile(user, { displayName });
    },
    orderDetail,
    order: orderDetail,
    async login(email, password) {
      const { user } = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      ).catch((error) => {
        if (
          [
            "auth/invalid-credential",
            "auth/user-not-found",
            "auth/wrong-password",
          ].includes(error.code)
        )
          throw new Error("El correo o la contraseña son incorrectos.");
        throw error;
      });
      return account(user);
    },
    async register({ email, password, name: displayName, inviteCode }) {
      if (company) {
        const code = inviteCode?.trim().toLowerCase();
        if (!/^[a-f0-9]{32}$/.test(code ?? ""))
          throw new Error("Ingresa el código de invitación de Empresa.");
        const address = email.trim().toLowerCase();
        const { user } = await createUserWithEmailAndPassword(
          auth,
          address,
          password,
        ).catch((error) => {
          if (error.code !== "auth/email-already-in-use") throw error;
          return signInWithEmailAndPassword(auth, address, password);
        });
        try {
          await updateProfile(user, { displayName: displayName.trim() });
          const batch = writeBatch(db);
          batch.update(doc(db, "aluf_invites", code), { usedBy: user.uid });
          batch.set(roleDoc(user.uid), {
            active: true,
            role: "Operador",
            inviteCode: code,
          });
          await batch.commit();
          return { id: user.uid };
        } catch (error) {
          if (error.code !== "permission-denied") throw error;
          throw Object.assign(
            new Error("El código no es válido, ya se usó o venció."),
            { field: "inviteCode" },
          );
        } finally {
          await signOut(auth);
        }
      }
      const { user } = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      try {
        await updateProfile(user, { displayName: displayName.trim() });
      } finally {
        await signOut(auth);
      }
      return { id: user.uid, role: "Cliente" };
    },
    async current() {
      await auth.authStateReady();
      return account(auth.currentUser);
    },
    logout: () => signOut(auth),
    recovery: (email) => sendPasswordResetEmail(auth, email.trim()),
    async createOrder({
      requestKey,
      expectedOwnerUid,
      fulfillment,
      deliveryAddress,
      notes,
      items,
      customerId,
    }) {
      if (!auth.currentUser) throw new Error("Inicia sesión como comprador.");
      if (!/^[0-9a-fA-F-]{36}$/.test(requestKey ?? ""))
        throw new Error("El identificador del encargo no es válido.");
      if (!["Entrega", "Recoger"].includes(fulfillment))
        throw new Error("Elige cómo recibir el encargo.");
      text(notes, "las indicaciones", 2000, true);
      text(deliveryAddress, "la dirección", 500, fulfillment !== "Entrega");
      if (!Array.isArray(items) || !items.length || items.length > 50)
        throw new Error("Selecciona entre 1 y 50 materiales.");
      for (const item of items) {
        text(item.productId, "el producto", 150);
        if (decimal(item.quantity, 3) <= 0)
          throw new Error("La cantidad debe ser mayor que cero.");
      }
      let customer;
      if (company) {
        customer = (await operations.customers()).find(
          (item) => item.id === String(customerId),
        );
        if (!customer) throw new Error("Selecciona un cliente registrado.");
      }
      const ref = doc(orders, requestKey);
      const ownerUid = auth.currentUser.uid;
      if (expectedOwnerUid && expectedOwnerUid !== ownerUid)
        throw new Error("Abre la sesión que guardó este encargo.");
      return runTransaction(db, async (transaction) => {
        const existing = await transaction.get(ref);
        if (!existing.exists()) {
          transaction.set(ref, {
            ownerUid,
            ...(company
              ? {
                  walkIn: true,
                  customerId: customer.id,
                  customerName: customer.name,
                  customerPhone: customer.phone ?? "",
                }
              : {}),
            fulfillment,
            deliveryAddress:
              fulfillment === "Entrega" ? (deliveryAddress ?? "").trim() : "",
            notes: notes ?? "",
            items,
            status: "Solicitado",
            createdAt: serverTimestamp(),
          });
        }
        return { id: ref.id };
      });
    },
    async orders(status) {
      return list(await getDocs(orderQuery(status)));
    },
    subscribeOrders(status, callback, onError) {
      return onSnapshot(
        orderQuery(status),
        (snapshot) =>
          callback(list(snapshot), {
            fromCache: snapshot.metadata?.fromCache === true,
          }),
        onError,
      );
    },
  };
}
