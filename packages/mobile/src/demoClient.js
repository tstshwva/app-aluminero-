import catalogData from "@aluformix/catalog/data";
// Cliente de demostración: misma interfaz que createClient de @aluformix/client,
// pero con datos de ejemplo en memoria. Solo se usa cuando EXPO_PUBLIC_DEMO=1.
// No se conecta a la API ni guarda nada en el teléfono.

class DemoError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (message, status = 400) => {
  throw new DemoError(status, message);
};
const money = (n) => (Math.round(Number(n) * 100) / 100).toFixed(2);
const qty = (n) => Number(n).toFixed(3);
const copy = (value) => JSON.parse(JSON.stringify(value));
const stamp = () => {
  const d = new Date(),
    z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
};
const DECIMAL = /^(0|[1-9][0-9]{0,8})(\.[0-9]{1,3})?$/;
const MONEY = /^(0|[1-9][0-9]{0,8})(\.[0-9]{1,2})?$/;
const RATE = /^0(\.[0-9]{1,4})?$/;
const TRANSITIONS = {
  Confirmado: "Preparando",
  Preparando: "Listo",
  Listo: "Entregado",
};

function seed() {
  const products = [
    [
      1,
      1,
      "PERF-3",
      'Perfil serie 3" corredizo',
      "barra",
      "Natural",
      6100,
      "612.50",
      "40",
      "10",
      "Riel inferior para ventana corrediza.",
    ],
    [
      2,
      1,
      "TUB-1X1",
      'Tubo cuadrado 1"',
      "barra",
      "Blanco",
      6100,
      "389.00",
      "6",
      "8",
      "Tubo de aluminio de 1 × 1 pulgada.",
    ],
    [
      3,
      1,
      "ANG-3/4",
      'Ángulo 3/4"',
      "barra",
      "Bronce",
      6100,
      "214.00",
      "25",
      "5",
      null,
    ],
    [
      4,
      2,
      "VID-6CL",
      "Vidrio claro 6 mm",
      "m²",
      "Claro",
      null,
      "540.00",
      "30",
      "6",
      "Hoja de vidrio flotado.",
    ],
    [
      5,
      3,
      "RUE-35",
      "Rueda para corrediza 35",
      "pieza",
      "Natural",
      null,
      "38.00",
      "120",
      "30",
      null,
    ],
    [
      6,
      3,
      "CHAP-SC",
      "Chapa de seguridad",
      "pieza",
      "Negro",
      null,
      "265.00",
      "3",
      "5",
      null,
    ],
  ].map(
    ([
      id,
      category_id,
      code,
      name,
      unit,
      finish,
      length_mm,
      price,
      stock,
      minimum,
      description,
    ]) => ({
      id,
      category_id,
      code,
      name,
      unit,
      finish,
      length_mm,
      price,
      stock: qty(stock),
      reserved: "0.000",
      minimum_stock: qty(minimum),
      description,
      image_url: null,
      active: 1,
    }),
  );
  const importedCategories = [];
  catalogData.productos
    .filter((p) => p.codigo)
    .forEach((p, i) => {
      let c = importedCategories.find((x) => x.name === p.categoria_bd);
      if (!c) {
        c = { id: 10 + importedCategories.length, name: p.categoria_bd };
        importedCategories.push(c);
      }
      products.push({
        id: 100 + i,
        category_id: c.id,
        code: p.codigo,
        name: p.nombre,
        unit: p.unidad,
        finish: p.acabados.length ? p.acabados.join(", ") : "Por confirmar",
        length_mm: p.longitud_mm,
        price: "0.00",
        stock: "0.000",
        reserved: "0.000",
        minimum_stock: "0.000",
        description: p.descripcion,
        image_url: null,
        active: 1,
      });
    });
  const item = (id, productId, quantity, unitPrice, cut = null) => {
    const p = products.find((x) => x.id === productId);
    return {
      id,
      product_id: p.id,
      product_name: p.name,
      product_code: p.code,
      finish: p.finish,
      quantity: qty(quantity),
      unit_price: money(unitPrice),
      cut_length_mm: cut,
    };
  };
  const db = {
    seq: {
      order: 1003,
      item: 10,
      product: Math.max(...products.map(({ id }) => id)) + 1,
      category: Math.max(3, ...importedCategories.map(({ id }) => id)) + 1,
      customer: 4,
      notification: 3,
      movement: 3,
      payment: 2,
    },
    company: {
      name: "Aluminios del Sureste (demostración)",
      phone: "999 123 4567",
      address: "Calle 60 #245, Centro",
      tax_rate: "0.1600",
    },
    users: [
      {
        id: 1,
        name: "Joel Canche",
        email: "cliente@demo.mx",
        role: "Cliente",
        phone: "999 555 0101",
        business_name: "Taller Canche",
        tax_id: null,
        address: "Calle 21 #110, Col. México",
      },
      {
        id: 2,
        name: "Ana López",
        email: "admin@demo.mx",
        role: "Administrador",
        phone: null,
      },
    ],
    categories: [
      { id: 1, name: "Perfiles" },
      { id: 2, name: "Vidrio" },
      { id: 3, name: "Herrajes" },
      ...importedCategories,
    ],
    products,
    favorites: { 1: [1] },
    customers: [
      { id: 1, name: "Joel Canche", phone: "999 555 0101", user_id: 1 },
      { id: 2, name: "Taller Ramírez", phone: "999 222 3344", user_id: null },
      { id: 3, name: "Herrería Pech", phone: "999 678 1122", user_id: null },
    ],
    movements: [
      {
        id: 1,
        product_id: 2,
        type: "Entrada",
        quantity: "10.000",
        reason: "Compra a proveedor",
        created_at: "2026-11-02 10:15",
      },
      {
        id: 2,
        product_id: 2,
        type: "Salida",
        quantity: "4.000",
        reason: "Entrega encargo #1000",
        created_at: "2026-11-04 12:40",
      },
    ],
    orders: [
      {
        id: 1000,
        user_id: 1,
        customer_id: 1,
        status: "Entregado",
        fulfillment: "Recoger",
        delivery_address: null,
        notes: null,
        created_at: "2026-11-03 09:20",
        items: [item(1, 2, 4, 389)],
        history: [
          { status: "Solicitado", created_at: "2026-11-03 09:20", note: null },
          { status: "Cotizado", created_at: "2026-11-03 11:02", note: null },
          { status: "Confirmado", created_at: "2026-11-03 11:30", note: null },
          { status: "Entregado", created_at: "2026-11-04 12:40", note: null },
        ],
        payments: [
          {
            id: 1,
            amount: "1805.04",
            reference: "Transferencia 8841",
            created_at: "2026-11-04 12:38",
          },
        ],
        quote: null,
      },
      {
        id: 1001,
        user_id: 1,
        customer_id: 1,
        status: "Cotizado",
        fulfillment: "Entrega",
        delivery_address: "Calle 21 #110, Col. México",
        notes: "Entregar por la mañana.",
        created_at: "2026-11-07 16:05",
        items: [item(2, 1, 6, 612.5), item(3, 5, 12, 38)],
        history: [
          { status: "Solicitado", created_at: "2026-11-07 16:05", note: null },
          { status: "Cotizado", created_at: "2026-11-08 09:12", note: null },
        ],
        payments: [],
        quote: null,
      },
      {
        id: 1002,
        user_id: null,
        customer_id: 2,
        status: "Solicitado",
        fulfillment: "Recoger",
        delivery_address: null,
        notes: "El cliente llamó por teléfono.",
        created_at: "2026-11-08 10:30",
        items: [item(4, 4, 3, 540), item(5, 3, 5, 214, 1500)],
        history: [
          { status: "Solicitado", created_at: "2026-11-08 10:30", note: null },
        ],
        payments: [],
        quote: null,
      },
    ],
    notifications: [
      {
        id: 1,
        user_role: "Cliente",
        order_id: 1001,
        message: "Tu encargo #1001 tiene una cotización lista para revisar.",
        created_at: "2026-11-08 09:12",
        read_at: null,
      },
      {
        id: 2,
        user_role: "Empresa",
        order_id: 1002,
        message: "Nueva solicitud #1002 de Taller Ramírez.",
        created_at: "2026-11-08 10:30",
        read_at: null,
      },
    ],
  };
  makeQuote(db.orders[0], "0.1600", "250.00", "Aceptada");
  makeQuote(db.orders[1], "0.1600", "150.00");
  return db;
}

function makeQuote(order, taxRate, shipping, status = "Enviada") {
  const subtotal = order.items.reduce(
    (s, i) => s + Number(i.quantity) * Number(i.unit_price),
    0,
  );
  const tax = subtotal * Number(taxRate);
  const total = subtotal + tax + Number(shipping);
  const paid = order.payments.reduce((s, p) => s + Number(p.amount), 0);
  order.quote = {
    status,
    revision: (order.quote?.revision ?? 0) + 1,
    tax_rate: taxRate,
    subtotal: money(subtotal),
    tax: money(tax),
    shipping: money(shipping),
    total: money(total),
    paid: money(paid),
    balance: money(total - paid),
  };
}

export function createDemoClient(audience) {
  const db = seed();
  let session = null;
  const delay = () => new Promise((resolve) => setTimeout(resolve, 150));
  const company = () => audience === "empresa";
  const me = () =>
    session ?? fail("Tu sesión terminó. Inicia sesión de nuevo.", 401);
  const product = (id) =>
    db.products.find((p) => p.id === Number(id)) ??
    fail("No se encontró el producto.", 404);
  const available = (p) => qty(Number(p.stock) - Number(p.reserved));
  const view = (p) => ({ ...copy(p), available: available(p) });
  const customer = (id) => db.customers.find((c) => c.id === Number(id));
  const visible = (o) => company() || o.user_id === me().id;
  const order = (id) => {
    const o = db.orders.find((x) => x.id === Number(id));
    if (!o || !visible(o)) fail("No se encontró el encargo.", 404);
    return o;
  };
  const summary = (o) => {
    const c = customer(o.customer_id);
    return {
      id: o.id,
      user_id: o.user_id,
      customer_name: c?.name,
      customer_phone: c?.phone,
      status: o.status,
      fulfillment: o.fulfillment,
      delivery_address: o.delivery_address,
      notes: o.notes,
      created_at: o.created_at,
      total: o.quote?.total ?? null,
    };
  };
  const notify = (role, orderId, message) =>
    db.notifications.unshift({
      id: db.seq.notification++,
      user_role: role,
      order_id: orderId,
      message,
      created_at: stamp(),
      read_at: null,
    });
  const status = (o, next, note = null) => {
    o.status = next;
    o.history.push({ status: next, created_at: stamp(), note: note || null });
  };
  const reserve = (o, sign) =>
    o.items.forEach((i) => {
      const p = product(i.product_id);
      p.reserved = qty(Number(p.reserved) + sign * Number(i.quantity));
    });
  const staff = () => {
    if (!company()) fail("No tienes permiso para esta operación.", 403);
  };
  const adminOnly = () => {
    if (me().role !== "Administrador")
      fail("Solo un administrador puede hacerlo.", 403);
  };
  const api = {
    demo: true,
    async enterDemo() {
      await delay();
      session = copy(
        db.users.find(
          (u) => u.role === (company() ? "Administrador" : "Cliente"),
        ),
      );
      return copy(session);
    },
    async current() {
      return session ? copy(session) : null;
    },
    async logout() {
      session = null;
    },
    async changePassword() {
      fail("Cambia tu contraseña en la app conectada.", 409);
    },
    async register() {
      fail("Crea tu cuenta desde la app conectada.", 409);
    },
    async recovery() {
      fail("Recupera tu cuenta desde la app conectada.", 409);
    },
    async reset() {
      fail("Restablece tu contraseña en la app conectada.", 409);
    },
    async products(search) {
      await delay();
      me();
      const text = String(search ?? "").toLowerCase();
      return db.products
        .filter(
          (p) =>
            (company() || p.active) &&
            (!text || `${p.name} ${p.code}`.toLowerCase().includes(text)),
        )
        .map(view);
    },
    async product(id) {
      await delay();
      return view(product(id));
    },
    async categories() {
      return copy(db.categories);
    },
    async createCategory(name) {
      staff();
      const clean = String(name ?? "").trim();
      if (!clean) fail("Escribe el nombre de la categoría.");
      if (
        db.categories.some((c) => c.name.toLowerCase() === clean.toLowerCase())
      )
        fail("Esa categoría ya existe.", 409);
      const created = { id: db.seq.category++, name: clean };
      db.categories.push(created);
      return copy(created);
    },
    async saveProduct(id, body) {
      await delay();
      staff();
      if (
        !String(body.code ?? "").trim() ||
        !String(body.name ?? "").trim() ||
        !String(body.unit ?? "").trim()
      )
        fail("Completa código, nombre y presentación.");
      if (!MONEY.test(String(body.price)))
        fail("Revisa el precio.");
      if (body.imageUrl && !/^https:\/\//.test(body.imageUrl))
        fail("La imagen debe usar una dirección HTTPS.");
      if (db.products.some((p) => p.code === body.code && p.id !== Number(id)))
        fail("Ya existe un producto con ese código.", 409);
      const values = {
        category_id: Number(body.categoryId),
        code: body.code.trim(),
        name: body.name.trim(),
        description: body.description || null,
        unit: body.unit.trim(),
        finish: body.finish,
        length_mm: body.lengthMm ? Number(body.lengthMm) : null,
        price: money(body.price),
        minimum_stock: qty(body.minimumStock || 0),
        image_url: body.imageUrl || null,
        active: body.active ? 1 : 0,
      };
      if (id) Object.assign(product(id), values);
      else
        db.products.push({
          id: db.seq.product++,
          stock: "0.000",
          reserved: "0.000",
          ...values,
        });
      return {};
    },
    async inventory(id, quantity, reason) {
      staff();
      const p = product(id);
      if (!DECIMAL.test(String(quantity)) || Number(quantity) <= 0)
        fail("Indica una cantidad mayor que cero.");
      if (!String(reason ?? "").trim()) fail("Escribe el motivo.");
      p.stock = qty(Number(p.stock) + Number(quantity));
      db.movements.push({
        id: db.seq.movement++,
        product_id: p.id,
        type: "Entrada",
        quantity: qty(quantity),
        reason,
        created_at: stamp(),
      });
    },
    async adjustment(id, stock, reason) {
      adminOnly();
      const p = product(id);
      if (!DECIMAL.test(String(stock))) fail("Revisa la existencia total.");
      if (Number(stock) < Number(p.reserved))
        fail("La existencia no puede quedar por debajo de lo reservado.", 409);
      if (!String(reason ?? "").trim()) fail("Escribe el motivo.");
      const diff = Number(stock) - Number(p.stock);
      p.stock = qty(stock);
      db.movements.push({
        id: db.seq.movement++,
        product_id: p.id,
        type: "Ajuste",
        quantity: qty(diff),
        reason,
        created_at: stamp(),
      });
    },
    async movements(id) {
      staff();
      return copy(
        db.movements.filter((m) => m.product_id === Number(id)).reverse(),
      );
    },
    async favorites() {
      const ids = db.favorites[me().id] ?? [];
      return db.products.filter((p) => ids.includes(p.id)).map(view);
    },
    async favorite(id, enabled) {
      const ids = (db.favorites[me().id] ??= []).filter(
        (x) => x !== Number(id),
      );
      if (enabled) ids.push(product(id).id);
      db.favorites[me().id] = ids;
    },
    async profile() {
      return copy(me());
    },
    async saveProfile(body) {
      const user = me();
      if (!String(body.name ?? "").trim()) fail("Escribe tu nombre.");
      Object.assign(user, {
        name: body.name,
        phone: body.phone ?? user.phone,
        business_name: body.businessName ?? user.business_name,
        tax_id: body.taxId || null,
        address: body.address ?? user.address,
      });
    },
    async company() {
      return copy(db.company);
    },
    async saveCompany(body) {
      adminOnly();
      if (!RATE.test(String(body.taxRate))) fail("Revisa la tasa de impuesto.");
      Object.assign(db.company, {
        name: body.name || null,
        phone: body.phone || null,
        address: body.address || null,
        tax_rate: body.taxRate,
      });
    },
    async customers() {
      staff();
      return copy(db.customers);
    },
    async createCustomer(name, phone) {
      staff();
      if (!String(name ?? "").trim() || !String(phone ?? "").trim())
        fail("Escribe nombre y teléfono del cliente.");
      db.customers.push({
        id: db.seq.customer++,
        name: name.trim(),
        phone: phone.trim(),
        user_id: null,
      });
    },
    async orders(filter) {
      await delay();
      me();
      return db.orders
        .filter((o) => visible(o) && (!filter || o.status === filter))
        .sort((a, b) => b.id - a.id)
        .map(summary);
    },
    async order(id) {
      await delay();
      const o = order(id);
      return {
        order: summary(o),
        items: copy(o.items),
        quote: copy(o.quote),
        history: copy(o.history),
        payments: copy(o.payments),
      };
    },
    async createOrder(body) {
      await delay();
      const user = me();
      let customerId;
      if (company()) {
        customerId = Number(body.customerId);
        if (!customer(customerId)) fail("Selecciona al cliente.");
      } else {
        customerId = db.customers.find((c) => c.user_id === user.id)?.id;
        if (!customerId) {
          customerId = db.seq.customer++;
          db.customers.push({
            id: customerId,
            name: user.name,
            phone: user.phone,
            user_id: user.id,
          });
        }
      }
      if (
        body.fulfillment === "Entrega" &&
        !String(body.deliveryAddress ?? "").trim()
      )
        fail("Escribe la dirección de entrega.");
      if (!body.items?.length) fail("Agrega al menos un material.");
      const items = body.items.map((i) => {
        if (!DECIMAL.test(String(i.quantity)) || Number(i.quantity) <= 0)
          fail("Indica una cantidad mayor que cero, con hasta tres decimales.");
        const p = product(i.productId);
        if (!p.active)
          fail("Un material está desactivado. Revisa el catálogo.");
        return {
          id: db.seq.item++,
          product_id: p.id,
          product_name: p.name,
          product_code: p.code,
          finish: i.finish ?? p.finish,
          quantity: qty(i.quantity),
          unit_price: p.price,
          cut_length_mm: i.cutLengthMm ? Number(i.cutLengthMm) : null,
        };
      });
      const created = {
        id: db.seq.order++,
        user_id: customer(customerId).user_id,
        customer_id: customerId,
        status: "Solicitado",
        fulfillment: body.fulfillment,
        delivery_address:
          body.fulfillment === "Entrega" ? body.deliveryAddress : null,
        notes: body.notes || null,
        created_at: stamp(),
        items,
        history: [{ status: "Solicitado", created_at: stamp(), note: null }],
        payments: [],
        quote: null,
      };
      db.orders.push(created);
      notify(
        "Empresa",
        created.id,
        `Nueva solicitud #${created.id} de ${customer(customerId).name}.`,
      );
      return { id: created.id };
    },
    async quote(id, body) {
      await delay();
      staff();
      const o = order(id);
      if (!["Solicitado", "Cotizado"].includes(o.status))
        fail("Este encargo ya no se puede cotizar.", 409);
      if (!RATE.test(String(body.taxRate))) fail("Revisa la tasa de impuesto.");
      if (!MONEY.test(String(body.shipping))) fail("Revisa el costo de envío.");
      for (const price of body.prices) {
        const i = o.items.find((x) => String(x.id) === String(price.itemId));
        if (!i || !MONEY.test(String(price.unitPrice ?? "")))
          fail("Revisa los precios cotizados.");
      }
      body.prices.forEach((price) => {
        o.items.find((x) => String(x.id) === String(price.itemId)).unit_price =
          money(price.unitPrice);
      });
      makeQuote(o, body.taxRate, body.shipping);
      if (o.status !== "Cotizado") status(o, "Cotizado");
      if (o.user_id)
        notify(
          "Cliente",
          o.id,
          `Tu encargo #${o.id} tiene una cotización lista para revisar.`,
        );
    },
    async acceptQuote(id, revision) {
      await delay();
      const o = order(id);
      if (o.status !== "Cotizado" || !o.quote)
        fail("Este encargo no tiene una cotización pendiente.", 409);
      if (Number(revision) !== o.quote.revision)
        fail("La cotización cambió. Actualiza el encargo para revisarla.", 409);
      for (const i of o.items) {
        const p = product(i.product_id);
        if (Number(available(p)) < Number(i.quantity))
          fail(`No hay existencias suficientes de ${p.code}.`, 409);
      }
      reserve(o, 1);
      o.quote.status = "Aceptada";
      status(o, "Confirmado");
      notify("Empresa", o.id, `Se aceptó la cotización del encargo #${o.id}.`);
    },
    async orderStatus(id, next, note) {
      await delay();
      const o = order(id);
      if (next === "Cancelado") {
        if (["Entregado", "Cancelado"].includes(o.status))
          fail("Este encargo ya no se puede cancelar.", 409);
        if (!company() && !["Solicitado", "Cotizado"].includes(o.status))
          fail("Este encargo ya no se puede cancelar desde la app.", 409);
        if (o.payments.length)
          fail(
            "No se cancela un encargo con pagos pendientes de resolver.",
            409,
          );
        if (["Confirmado", "Preparando", "Listo"].includes(o.status))
          reserve(o, -1);
        status(o, "Cancelado", note);
        notify(
          company() ? "Cliente" : "Empresa",
          o.id,
          `El encargo #${o.id} fue cancelado.`,
        );
        return;
      }
      staff();
      if (TRANSITIONS[o.status] !== next)
        fail("Ese cambio de estado no es válido.", 409);
      if (next === "Entregado")
        o.items.forEach((i) => {
          const p = product(i.product_id);
          p.stock = qty(Number(p.stock) - Number(i.quantity));
          p.reserved = qty(Number(p.reserved) - Number(i.quantity));
          db.movements.push({
            id: db.seq.movement++,
            product_id: p.id,
            type: "Salida",
            quantity: i.quantity,
            reason: `Entrega encargo #${o.id}`,
            created_at: stamp(),
          });
        });
      status(o, next, note);
      if (o.user_id)
        notify("Cliente", o.id, `Tu encargo #${o.id} cambió a: ${next}.`);
    },
    async payment(id, body) {
      await delay();
      staff();
      const o = order(id);
      if (
        !o.quote ||
        !["Confirmado", "Preparando", "Listo", "Entregado"].includes(o.status)
      )
        fail("Este encargo no admite pagos.", 409);
      if (!MONEY.test(String(body.amount ?? "")) || Number(body.amount) <= 0)
        fail("Indica un importe válido.");
      if (!String(body.reference ?? "").trim())
        fail("Escribe la referencia del pago.");
      if (Number(body.amount) > Number(o.quote.balance) + 1e-9)
        fail("El pago supera el saldo pendiente.", 409);
      o.payments.push({
        id: db.seq.payment++,
        amount: money(body.amount),
        reference: body.reference.trim(),
        created_at: stamp(),
      });
      o.quote.paid = money(Number(o.quote.paid) + Number(body.amount));
      o.quote.balance = money(Number(o.quote.total) - Number(o.quote.paid));
    },
    async notifications() {
      await delay();
      const user = me();
      return copy(
        db.notifications.filter((n) =>
          company()
            ? n.user_role === "Empresa"
            : n.user_role === "Cliente" &&
              db.orders.find((o) => o.id === n.order_id)?.user_id === user.id,
        ),
      );
    },
    async readNotification(id) {
      const n = db.notifications.find((x) => x.id === Number(id));
      if (n && !n.read_at) n.read_at = stamp();
    },
    async dashboard() {
      await delay();
      staff();
      const counts = {};
      db.orders.forEach(
        (o) => (counts[o.status] = (counts[o.status] ?? 0) + 1),
      );
      return {
        orders: Object.entries(counts).map(([s, count]) => ({
          status: s,
          count,
        })),
        lowStock: db.products
          .filter(
            (p) => p.active && Number(available(p)) <= Number(p.minimum_stock),
          )
          .map(view),
      };
    },
    async assistant(question) {
      await delay();
      if (!String(question ?? "").trim()) fail("Escribe tu pregunta.");
      fail("El asistente no está disponible en el modo demostración.", 503);
    },
    async createStaff() {
      fail("Crea cuentas de personal desde la app conectada.", 409);
    },
    async registerPush() {
      fail(
        "Las notificaciones del teléfono no funcionan en el modo demostración.",
        503,
      );
    },
    async disablePush() {
      fail("Los avisos del teléfono se gestionan en la app conectada.", 503);
    },
  };
  return api;
}
