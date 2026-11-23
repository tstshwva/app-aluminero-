import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  query,
  where,
  runTransaction,
  serverTimestamp,
  setDoc,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import {
  initializeAuth,
  inMemoryPersistence,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import {
  text,
  decimal,
  money,
  cents,
  calculateQuote,
  nextStatus,
} from "./enterpriseDomain.js";

export function enterpriseOperations({ db, auth, config, invalidate }) {
  const catalog = collection(db, "catalogo"),
    orders = collection(db, "pedidos");
  const settings = doc(db, "empresa", "configuracion");
  async function employee(admin = false) {
    if (!auth.currentUser) throw new Error("Inicia sesión para continuar.");
    const data = (
      await getDocFromServer(doc(db, "aluf_staff", auth.currentUser.uid))
    ).data();
    if (
      !data?.active ||
      !["Administrador", "Operador"].includes(data.role) ||
      (admin && data.role !== "Administrador")
    )
      throw new Error("Tu cuenta no tiene permiso para esta operación.");
    return auth.currentUser.uid;
  }
  const records = (snapshot) =>
    snapshot.docs.map((s) => ({
      ...s.data(),
      id: s.id,
      created_at:
        s.data().createdAt?.toDate?.().toISOString() ??
        s.data().created_at ??
        "",
    }));
  const history = (value, status, note, uid) => [
    ...(value.history ?? []).slice(-199),
    { status, note, created_at: new Date().toISOString(), actorUid: uid },
  ];
  async function changeInventory(id, amount, reason, adjust) {
    const uid = await employee(adjust),
      note = text(reason, "el motivo", 255);
    const quantity = decimal(amount, 3);
    if (!adjust && quantity <= 0)
      throw new Error("La entrada debe ser mayor que cero.");
    const ref = doc(catalog, String(id)),
      movement = doc(collection(ref, "movimientos"));
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error("El producto no existe.");
      const product = snapshot.data(),
        stock = adjust ? quantity : Number(product.stock ?? 0) + quantity;
      if (stock < Number(product.reserved ?? 0) || stock > 999999999.999)
        throw new Error(
          "La existencia no puede ser menor que el material reservado ni exceder el límite.",
        );
      transaction.update(ref, {
        stock: Number(stock.toFixed(3)),
        reserved: Number(product.reserved ?? 0),
        updatedAt: serverTimestamp(),
      });
      transaction.set(movement, {
        type: adjust ? "Ajuste" : "Entrada",
        quantity: adjust
          ? Number((stock - Number(product.stock ?? 0)).toFixed(3))
          : quantity,
        reason: note,
        actorUid: uid,
        createdAt: serverTimestamp(),
      });
    });
    invalidate();
  }
  return {
    async company() {
      const snapshot = await getDocFromServer(settings);
      return snapshot.exists()
        ? snapshot.data()
        : { name: "", phone: "", address: "", tax_rate: "0.16" };
    },
    async saveCompany(body) {
      await employee(true);
      await setDoc(settings, {
        name: text(body.name, "el nombre comercial"),
        phone: text(body.phone, "el teléfono", 25, true),
        address: text(body.address, "la dirección", 500, true),
        tax_rate: String(decimal(body.taxRate, 4, 1)),
        updatedAt: serverTimestamp(),
      });
    },
    async createCategory(name) {
      await employee(true);
      const result = await addDoc(collection(db, "categorias"), {
        nombre: text(name, "la categoría", 80),
      });
      invalidate();
      return { id: result.id };
    },
    async saveProduct(id, body) {
      await employee(true);
      const categoryId = text(body.categoryId, "la categoría", 150);
      if (!(await getDocFromServer(doc(db, "categorias", categoryId))).exists())
        throw new Error("Selecciona una categoría existente.");
      const image = text(body.imageUrl, "la imagen", 1000, true);
      if (image) {
        let url;
        try {
          url = new URL(image);
        } catch {
          throw new Error("La imagen necesita una URL HTTPS válida.");
        }
        if (url.protocol !== "https:" || url.username || url.password)
          throw new Error("La imagen necesita una URL HTTPS válida.");
      }
      const product = {
        code: text(body.code, "el código", 40),
        name: text(body.name, "el nombre"),
        description: text(body.description, "la descripción", 2000, true),
        category_id: categoryId,
        unit: text(body.unit, "la presentación", 30),
        finish: text(body.finish, "el acabado", 60),
        price: money(body.price),
        minimum_stock: decimal(body.minimumStock, 3),
        length_mm:
          body.lengthMm == null || body.lengthMm === ""
            ? null
            : decimal(body.lengthMm, 3),
        image_url: image,
        active: body.active ? 1 : 0,
        updatedAt: serverTimestamp(),
      };
      const ref = id ? doc(catalog, String(id)) : doc(catalog);
      await runTransaction(db, async (transaction) => {
        const existing = await transaction.get(ref);
        if (id && !existing.exists())
          throw new Error("El producto ya no existe.");
        transaction.set(
          ref,
          {
            ...product,
            stock: Number(existing.data()?.stock ?? 0),
            reserved: Number(existing.data()?.reserved ?? 0),
          },
          { merge: true },
        );
      });
      invalidate();
      return { id: ref.id };
    },
    inventory: (id, quantity, reason) =>
      changeInventory(id, quantity, reason, false),
    adjustment: (id, stock, reason) => changeInventory(id, stock, reason, true),
    async movements(id) {
      await employee();
      return records(
        await getDocsFromServer(
          collection(doc(catalog, String(id)), "movimientos"),
        ),
      ).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async customers() {
      await employee();
      const manual = records(
        await getDocsFromServer(collection(db, "clientes")),
      );
      const requests = records(await getDocsFromServer(orders));
      const known = new Set(manual.map((c) => c.id));
      for (const order of requests) {
        if (!order.walkIn && order.ownerUid && !known.has(order.ownerUid)) {
          known.add(order.ownerUid);
          manual.push({
            id: order.ownerUid,
            name: order.customerName || "Cliente de la app",
            phone: order.customerPhone || "",
            business_name: "",
          });
        }
      }
      return manual.sort((a, b) => a.name.localeCompare(b.name));
    },
    async createCustomer(name, phone) {
      await employee();
      const value = text(phone, "el teléfono", 25);
      if (!/^[0-9 +()-]{10,25}$/.test(value))
        throw new Error("Revisa el teléfono.");
      const ref = await addDoc(collection(db, "clientes"), {
        name: text(name, "el nombre", 120),
        phone: value,
        business_name: "",
        createdAt: serverTimestamp(),
      });
      return { id: ref.id };
    },
    async quote(id, body) {
      const uid = await employee();
      const ref = doc(orders, String(id));
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) throw new Error("El encargo no existe.");
        const order = snapshot.data();
        if (!["Solicitado", "Cotizado"].includes(order.status))
          throw new Error("Este encargo ya no se puede cotizar.");
        const calculated = calculateQuote(
          order.items,
          body.prices,
          body.taxRate,
          body.shipping,
          order.quote,
        );
        transaction.update(ref, {
          ...calculated,
          status: "Cotizado",
          updatedAt: serverTimestamp(),
          history: history(order, "Cotizado", "Cotización enviada", uid),
        });
      });
    },
    async acceptQuote(id, revision) {
      const ref = doc(orders, String(id));
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Inicia sesión.");
      const isStaff =
        (await getDocFromServer(doc(db, "aluf_staff", uid))).data()?.active ===
        true;
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) throw new Error("El encargo no existe.");
        const order = snapshot.data();
        if (order.ownerUid !== uid && !(isStaff && order.walkIn))
          throw new Error("No puedes aceptar este encargo.");
        if (
          order.status !== "Cotizado" ||
          order.quote?.revision !== Number(revision)
        )
          throw new Error("La cotización cambió. Revisa la versión actual.");
        transaction.update(ref, {
          status: "Confirmado",
          quote: { ...order.quote, status: "Aceptada" },
          updatedAt: serverTimestamp(),
        });
      });
    },
    async orderStatus(id, status, note = "") {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Inicia sesión.");
      const ref = doc(orders, String(id));
      const staff =
        (await getDocFromServer(doc(db, "aluf_staff", uid))).data()?.active ===
        true;
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) throw new Error("El encargo no existe.");
        const order = snapshot.data();
        nextStatus(order.status, status);
        if (!staff) {
          if (
            order.ownerUid !== uid ||
            status !== "Cancelado" ||
            !["Solicitado", "Cotizado"].includes(order.status)
          )
            throw new Error("No puedes modificar este encargo.");
          transaction.update(ref, { status, updatedAt: serverTimestamp() });
          return;
        }
        if (status === "Entregado" && cents(order.quote?.balance ?? "0") > 0)
          throw new Error("Registra el pago pendiente antes de entregar.");
        const stockAction =
          status === "Preparando"
            ? "reserve"
            : order.inventoryReserved &&
                (status === "Cancelado" || status === "Entregado")
              ? status
              : null;
        const counts = new Map();
        for (const item of order.items)
          if (decimal(item.quantity, 3) <= 0)
            throw new Error("La cantidad debe ser mayor que cero.");
        for (const item of order.items)
          counts.set(
            String(item.productId),
            Number(
              (
                (counts.get(String(item.productId)) ?? 0) +
                decimal(item.quantity, 3)
              ).toFixed(3),
            ),
          );
        const inventory = [];
        if (stockAction)
          for (const [productId, quantity] of counts) {
            const productRef = doc(catalog, productId),
              product = await transaction.get(productRef);
            if (!product.exists()) throw new Error("Un producto ya no existe.");
            inventory.push({
              ref: productRef,
              product: product.data(),
              quantity,
            });
          }
        for (const { ref: productRef, product, quantity } of inventory) {
          const stock = Number(product.stock ?? 0),
            reserved = Number(product.reserved ?? 0);
          if (
            stockAction === "reserve" &&
            (product.active === 0 || stock - reserved < quantity)
          )
            throw new Error(
              "No hay material disponible para preparar el encargo.",
            );
          const nextReserved = Number(
            (
              reserved + (stockAction === "reserve" ? quantity : -quantity)
            ).toFixed(3),
          );
          if (nextReserved < 0)
            throw new Error(
              "Revisa las reservas de inventario antes de continuar.",
            );
          transaction.update(productRef, {
            stock:
              stockAction === "Entregado"
                ? Number((stock - quantity).toFixed(3))
                : stock,
            reserved: nextReserved,
            updatedAt: serverTimestamp(),
          });
          transaction.set(doc(collection(productRef, "movimientos")), {
            type:
              stockAction === "reserve"
                ? "Reserva"
                : stockAction === "Entregado"
                  ? "Salida"
                  : "Liberación",
            quantity,
            reason: "Encargo " + id,
            actorUid: uid,
            createdAt: serverTimestamp(),
          });
        }
        transaction.update(ref, {
          status,
          inventoryReserved:
            stockAction === "reserve"
              ? true
              : stockAction
                ? false
                : !!order.inventoryReserved,
          updatedAt: serverTimestamp(),
          history: history(
            order,
            status,
            text(note, "la nota", 500, true),
            uid,
          ),
        });
      });
      invalidate();
    },
    async payment(id, body) {
      const uid = await employee();
      const key = text(body.requestKey, "el identificador", 100),
        amount = cents(body.amount);
      if (amount <= 0) throw new Error("El pago debe ser mayor que cero.");
      const reference = text(body.reference, "la referencia", 120),
        ref = doc(orders, String(id));
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) throw new Error("El encargo no existe.");
        const order = snapshot.data(),
          payments = order.payments ?? [];
        if (payments.some((p) => p.id === key)) return;
        if (
          !["Confirmado", "Preparando", "Listo", "Entregado"].includes(
            order.status,
          ) ||
          !order.quote
        )
          throw new Error("El encargo no admite pagos todavía.");
        if (payments.length >= 200)
          throw new Error(
            "Se alcanzó el límite de comprobantes de este encargo.",
          );
        const balance = cents(order.quote.balance);
        if (amount > balance)
          throw new Error("El importe supera el saldo pendiente.");
        transaction.update(ref, {
          quote: {
            ...order.quote,
            paid: ((cents(order.quote.paid) + amount) / 100).toFixed(2),
            balance: ((balance - amount) / 100).toFixed(2),
          },
          payments: [
            ...payments,
            {
              id: key,
              amount: (amount / 100).toFixed(2),
              reference,
              created_at: new Date().toISOString(),
              actorUid: uid,
            },
          ],
          updatedAt: serverTimestamp(),
        });
      });
    },
    async notifications() {
      if (!auth.currentUser) throw new Error("Inicia sesión.");
      const uid = auth.currentUser.uid,
        staff =
          (await getDocFromServer(doc(db, "aluf_staff", uid))).data()
            ?.active === true;
      const snapshot = await getDocsFromServer(
        staff ? orders : query(orders, where("ownerUid", "==", uid)),
      );
      const read = await getDocsFromServer(
        collection(db, "usuarios", uid, "avisosLeidos"),
      );
      const readIds = new Set(read.docs.map((item) => item.id));
      return records(snapshot)
        .map((order) => ({
          id: order.id,
          order_id: order.id,
          message: `Encargo ${order.id.slice(0, 8)} · ${order.status}`,
          created_at: order.created_at,
          read_at: readIds.has(order.id) ? "Leída" : null,
        }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async readNotification(id) {
      if (!auth.currentUser) throw new Error("Inicia sesión.");
      await setDoc(
        doc(db, "usuarios", auth.currentUser.uid, "avisosLeidos", String(id)),
        { readAt: serverTimestamp() },
      );
    },
    async registerPush(token) {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Inicia sesión.");
      await setDoc(doc(db, "dispositivos", encodeURIComponent(token)), {
        ownerUid: uid,
        token: text(token, "el token", 300),
        updatedAt: serverTimestamp(),
      });
    },
    async disablePush(token) {
      await deleteDoc(doc(db, "dispositivos", encodeURIComponent(token)));
    },
    async createStaff(body) {
      await employee(true);
      const role = ["Administrador", "Operador"].includes(body.role)
        ? body.role
        : "Operador";
      if (String(body.password ?? "").length < 12 || body.password.length > 128)
        throw new Error("Usa una contraseña de 12 a 128 caracteres.");
      const temporary = initializeApp(
        config,
        "staff-" + doc(collection(db, "clientes")).id,
      );
      const secondary = initializeAuth(temporary, {
        persistence: inMemoryPersistence,
      });
      try {
        const { user } = await createUserWithEmailAndPassword(
          secondary,
          text(body.email, "el correo", 254),
          body.password,
        );
        await updateProfile(user, {
          displayName: text(body.name, "el nombre", 120),
        });
        await setDoc(doc(db, "aluf_staff", user.uid), { active: true, role });
        return { id: user.uid };
      } finally {
        await signOut(secondary);
        await deleteApp(temporary);
      }
    },
  };
}
