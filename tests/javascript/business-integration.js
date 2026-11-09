import { randomUUID } from "node:crypto";
import { rows } from "../../server/src/database.js";
import { createPushWorker } from "../../server/src/push.js";
export async function businessChecks({
  request,
  post,
  check,
  pool,
  buyer,
  admin,
  password,
}) {
  const call = (route, method, body, session = admin) =>
    request(route, { method, body, session });
  const buyerCall = (route, method, body) => call(route, method, body, buyer);
  const category = await post(
    "/api/categories",
    { name: "Negocio aislado" },
    admin,
  );
  check(
    category.status === 201,
    "Empresa crea categoría sin datos de demostración en base real",
  );
  check(
    (await post("/api/categories", { name: "Prohibida" }, buyer)).status ===
      403,
    "Comprador no modifica categorías",
  );
  const productBody = {
    categoryId: category.body.id,
    code: "FLOW-01",
    name: "Perfil de prueba aislada",
    description: "Solo en instancia temporal",
    unit: "barra",
    finish: "Natural",
    lengthMm: 6000,
    price: "400.00",
    minimumStock: "1.000",
    imageUrl: "https://example.invalid/material.png",
    active: true,
  };
  const product = await post("/api/products", productBody, admin);
  check(
    product.status === 201,
    "Producto se guarda con presentación, medida e imagen HTTPS",
  );
  const productId = product.body.id;
  check(
    (
      await post(
        "/api/products",
        { ...productBody, code: "BAD", imageUrl: "http://invalid.test/x" },
        admin,
      )
    ).status === 400,
    "Producto rechaza imagen HTTP",
  );
  check(
    (await post("/api/products", { ...productBody, code: "FORBIDDEN" }, buyer))
      .status === 403,
    "Comprador no crea productos",
  );
  check(
    (
      await post(
        `/api/products/${productId}/inventory`,
        { quantity: "10.000", reason: "Ingreso aislado" },
        admin,
      )
    ).status === 204,
    "Entrada incrementa existencias y registra motivo",
  );
  check(
    (await request(`/api/products/${productId}/movements`, { session: admin }))
      .body.length === 1,
    "Entrada deja movimiento de inventario",
  );
  check(
    (await buyerCall(`/api/favorites/${productId}`, "PUT", {})).status === 204,
    "Comprador guarda favorito",
  );
  check(
    (await request("/api/favorites", { session: buyer })).body.some(
      (p) => p.id === productId,
    ),
    "Favorito persiste en la base de datos",
  );
  check(
    (await buyerCall(`/api/favorites/${productId}`, "DELETE")).status === 204,
    "Comprador elimina su favorito",
  );
  const profile = {
    name: "Comprador actualizado",
    phone: "9991234567",
    businessName: "Taller aislado",
    taxId: "",
    address: "Dirección temporal de pruebas",
  };
  check(
    (await buyerCall("/api/profile", "PUT", profile)).status === 204,
    "Perfil actualiza usuario y ficha de cliente",
  );
  check(
    (await request("/api/profile", { session: buyer })).body.business_name ===
      "Taller aislado",
    "Datos del perfil se recuperan de la base",
  );
  check(
    (
      await call("/api/company", "PUT", {
        name: "Distribuidora de pruebas",
        phone: "9991234567",
        address: "Sucursal temporal",
        taxRate: "0.1600",
      })
    ).status === 204,
    "Administrador configura empresa e impuesto",
  );
  check(
    (
      await buyerCall("/api/company", "PUT", {
        name: "No",
        phone: "9991234567",
        address: "No",
        taxRate: "0",
      })
    ).status === 403,
    "Comprador no cambia configuración de empresa",
  );
  check(
    (
      await buyerCall("/api/push-device", "PUT", {
        token: "ExpoPushToken[isolatedDeviceToken12345]",
      })
    ).status === 204,
    "Dispositivo se vincula a usuario y sesión autenticados",
  );
  check(
    (await buyerCall("/api/push-device", "PUT", { token: "URL-no-valida" }))
      .status === 400,
    "Registro de dispositivo valida formato",
  );
  const payload = {
    requestKey: randomUUID(),
    fulfillment: "Recoger",
    deliveryAddress: null,
    notes: "Prueba aislada",
    items: [{ productId, quantity: "2.000", cutLengthMm: 1200 }],
  };
  check(
    (await post("/api/orders", { ...payload, items: [] }, buyer)).status ===
      400,
    "Encargo vacío rechazado",
  );
  check(
    (await post("/api/orders", { ...payload, fulfillment: "Entrega" }, buyer))
      .status === 400,
    "Entrega exige dirección",
  );
  check(
    (
      await post(
        "/api/orders",
        {
          ...payload,
          items: [{ productId, quantity: "2", cutLengthMm: 7000 }],
        },
        buyer,
      )
    ).status === 400,
    "Corte no puede superar longitud de la barra",
  );
  check(
    (
      await post(
        "/api/orders",
        {
          ...payload,
          items: [
            { productId, quantity: "1", cutLengthMm: null, finish: "Dorado" },
          ],
        },
        buyer,
      )
    ).status === 400,
    "Acabado no listado en el producto rechazado",
  );
  const created = await post("/api/orders", payload, buyer);
  check(
    created.status === 201,
    "Solicitud persiste encabezado, partidas, historial y avisos",
  );
  const orderId = created.body.id;
  const repeated = await post("/api/orders", payload, buyer);
  check(
    repeated.status === 200 && repeated.body.id === orderId,
    "Reintento no duplica el encargo",
  );
  check(
    (await post("/api/orders", { ...payload, notes: "Alterado" }, buyer))
      .status === 409,
    "Misma clave con otros datos no altera la solicitud original",
  );
  let detail = (await request(`/api/orders/${orderId}`, { session: buyer }))
    .body;
  check(
    detail.items[0].product_name === productBody.name &&
      detail.history.length === 1,
    "Partidas conservan nombre y código históricos",
  );
  const own = (
    await rows(pool, "SELECT user_id FROM customers WHERE id=?", [
      detail.order.customer_id,
    ])
  )[0].user_id;
  const second = await post("/api/auth/register", {
    name: "Otro comprador",
    email: "second@integration.invalid",
    phone: "9991234567",
    password,
  });
  const secondToken = (
    await post("/api/auth/login", {
      email: "second@integration.invalid",
      password,
    })
  ).body.accessToken;
  check(
    second.status === 201 && String(own) !== second.body.id,
    "Segundo comprador solo existe en base aislada",
  );
  check(
    (await request(`/api/orders/${orderId}`, { session: secondToken }))
      .status === 404,
    "No expone encargos ajenos",
  );
  check(
    !(await request("/api/orders", { session: secondToken })).body.some(
      (o) => o.id === orderId,
    ),
    "Historial filtra por propietario",
  );
  check(
    (
      await post(
        "/api/orders",
        {
          ...payload,
          requestKey: randomUUID(),
          customerId: detail.order.customer_id,
        },
        secondToken,
      )
    ).status === 403,
    "Comprador no suplanta cliente al encargar",
  );
  check(
    (
      await post(
        `/api/orders/${orderId}/status`,
        { status: "Entregado", note: "" },
        admin,
      )
    ).status === 409,
    "Empresa no salta estados",
  );
  const quoteBody = {
    taxRate: "0.1600",
    shipping: "25.00",
    prices: detail.items.map((i) => ({ itemId: i.id, unitPrice: "400.00" })),
  };
  check(
    (await post(`/api/orders/${orderId}/quote`, quoteBody, buyer)).status ===
      403,
    "Comprador no establece precios",
  );
  const quote = await post(`/api/orders/${orderId}/quote`, quoteBody, admin);
  check(
    quote.status === 200 && quote.body.total === "953.00",
    "Cotización calcula 800 + 128 + 25 con precisión exacta",
  );
  await post(`/api/orders/${orderId}/quote`, quoteBody, admin);
  check(
    (await post(`/api/orders/${orderId}/accept`, { revision: 1 }, buyer))
      .status === 409,
    "No acepta una revisión de cotización que cambió",
  );
  check(
    (await post(`/api/orders/${orderId}/accept`, { revision: 1 }, admin))
      .status === 403,
    "Empresa no acepta por comprador con cuenta",
  );
  check(
    (await post(`/api/orders/${orderId}/accept`, { revision: 1 }, secondToken))
      .status === 404,
    "Otro comprador no acepta la cotización",
  );
  check(
    (await post(`/api/orders/${orderId}/accept`, { revision: 2 }, buyer))
      .status === 204,
    "Aceptación reserva inventario atómicamente",
  );
  check(
    (await request(`/api/products/${productId}`, { session: buyer })).body
      .reserved === "2.000",
    "Existencias reservadas quedan guardadas",
  );
  check(
    (await post(`/api/orders/${orderId}/accept`, { revision: 1 }, buyer))
      .status === 409,
    "No permite aceptar y reservar dos veces",
  );
  check(
    (await post(`/api/orders/${orderId}/quote`, quoteBody, admin)).status ===
      409,
    "No cambia precios de cotización aceptada",
  );
  check(
    (
      await post(
        `/api/products/${productId}/adjustment`,
        { stock: "1.000", reason: "Inválido" },
        admin,
      )
    ).status === 409,
    "Ajuste no retira material reservado",
  );
  check(
    (
      await post(
        `/api/orders/${orderId}/status`,
        { status: "Preparando", note: "" },
        buyer,
      )
    ).status === 403,
    "Comprador no prepara su propio encargo",
  );
  const payment = {
    requestKey: randomUUID(),
    amount: "100.00",
    reference: "Pago externo aislado",
  };
  check(
    (await post(`/api/orders/${orderId}/payments`, payment, admin)).status ===
      201,
    "Empresa registra pago recibido",
  );
  check(
    (await post(`/api/orders/${orderId}/payments`, payment, admin)).status ===
      200,
    "Reintento no duplica pago",
  );
  check(
    (
      await post(
        `/api/orders/${orderId}/payments`,
        { ...payment, amount: "101.00" },
        admin,
      )
    ).status === 409,
    "Misma clave no sirve para otro importe",
  );
  check(
    (
      await post(
        `/api/orders/${orderId}/payments`,
        { ...payment, requestKey: randomUUID(), amount: "1000" },
        admin,
      )
    ).status === 409,
    "No cobra por encima del saldo",
  );
  check(
    (
      await post(
        `/api/orders/${orderId}/payments`,
        { ...payment, requestKey: randomUUID() },
        buyer,
      )
    ).status === 403,
    "Comprador no se acredita pagos",
  );
  detail = (await request(`/api/orders/${orderId}`, { session: buyer })).body;
  check(
    detail.quote.paid === "100.00" &&
      detail.quote.balance === "853.00" &&
      detail.payments.length === 1,
    "Saldo exacto y un solo pago persistido",
  );
  check(
    (
      await post(
        `/api/orders/${orderId}/status`,
        { status: "Cancelado", note: "" },
        admin,
      )
    ).status === 409,
    "No cancela encargos con pagos sin resolver",
  );
  for (const status of ["Preparando", "Listo", "Entregado"])
    check(
      (
        await post(
          `/api/orders/${orderId}/status`,
          { status, note: "Avance de prueba" },
          admin,
        )
      ).status === 204,
      "Transición válida a " + status,
    );
  const delivered = (
    await request(`/api/products/${productId}`, { session: buyer })
  ).body;
  check(
    delivered.stock === "8.000" && delivered.reserved === "0.000",
    "Entrega descuenta existencias y libera reserva una sola vez",
  );
  check(
    (
      await post(
        `/api/orders/${orderId}/status`,
        { status: "Entregado", note: "" },
        admin,
      )
    ).status === 409,
    "Entrega repetida no descuenta existencias",
  );
  const cancel = await post(
    "/api/orders",
    {
      ...payload,
      requestKey: randomUUID(),
      items: [{ productId, quantity: "1", cutLengthMm: null }],
    },
    buyer,
  );
  const cancelDetail = (
    await request(`/api/orders/${cancel.body.id}`, { session: buyer })
  ).body;
  await post(
    `/api/orders/${cancel.body.id}/quote`,
    {
      ...quoteBody,
      prices: cancelDetail.items.map((i) => ({
        itemId: i.id,
        unitPrice: "400.00",
      })),
    },
    admin,
  );
  await post(`/api/orders/${cancel.body.id}/accept`, { revision: 1 }, buyer);
  check(
    (
      await post(
        `/api/orders/${cancel.body.id}/status`,
        { status: "Cancelado", note: "Cancelación aislada" },
        admin,
      )
    ).status === 204,
    "Cancelación de empresa libera reserva sin pagos",
  );
  const cancelledStock = (
    await request(`/api/products/${productId}`, { session: buyer })
  ).body;
  check(
    cancelledStock.stock === "8.000" && cancelledStock.reserved === "0.000",
    "Cancelación conserva stock y libera solo la reserva",
  );
  const race = [];
  for (let i = 0; i < 2; i++) {
    const r = await post(
      "/api/orders",
      {
        ...payload,
        requestKey: randomUUID(),
        items: [{ productId, quantity: "6", cutLengthMm: null }],
      },
      buyer,
    );
    const d = (await request(`/api/orders/${r.body.id}`, { session: buyer }))
      .body;
    await post(
      `/api/orders/${r.body.id}/quote`,
      {
        ...quoteBody,
        prices: d.items.map((item) => ({
          itemId: item.id,
          unitPrice: "400.00",
        })),
      },
      admin,
    );
    race.push(r.body.id);
  }
  const results = await Promise.all(
    race.map((orderId) =>
      post(`/api/orders/${orderId}/accept`, { revision: 1 }, buyer),
    ),
  );
  check(
    results.filter((r) => r.status === 204).length === 1 &&
      results.filter((r) => r.status === 409).length === 1,
    "Dos aceptaciones concurrentes no sobrevenden existencias",
  );
  for (let i = 0; i < race.length; i++)
    await post(
      `/api/orders/${race[i]}/status`,
      { status: "Cancelado", note: "Fin prueba" },
      admin,
    );
  const [manualCustomer] = await rows(
    pool,
    "SELECT id FROM customers WHERE user_id IS NULL ORDER BY id DESC LIMIT 1",
  );
  const manual = await post(
    "/api/orders",
    {
      ...payload,
      requestKey: randomUUID(),
      customerId: manualCustomer.id,
      items: [{ productId, quantity: "1", cutLengthMm: null }],
    },
    admin,
  );
  check(
    manual.status === 201,
    "Empresa registra solicitud de cliente sin cuenta",
  );
  const manualDetail = (
    await request(`/api/orders/${manual.body.id}`, { session: admin })
  ).body;
  await post(
    `/api/orders/${manual.body.id}/quote`,
    {
      ...quoteBody,
      prices: manualDetail.items.map((i) => ({
        itemId: i.id,
        unitPrice: "400.00",
      })),
    },
    admin,
  );
  check(
    (await post(`/api/orders/${manual.body.id}/accept`, { revision: 1 }, admin))
      .status === 204,
    "Empresa registra aceptación de cliente sin cuenta",
  );
  await post(
    `/api/orders/${manual.body.id}/status`,
    { status: "Cancelado", note: "Fin prueba manual" },
    admin,
  );
  const notes = (await request("/api/notifications", { session: buyer })).body;
  check(
    notes.some((n) => n.order_id === orderId),
    "Comprador recibe avisos de su encargo",
  );
  const sends = [];
  const push = createPushWorker(pool, {
    enabled: true,
    fetchImpl: async (url, options) => {
      sends.push({ url, body: JSON.parse(options.body) });
      return {
        ok: true,
        json: async () =>
          url.endsWith("/send")
            ? { data: { status: "ok", id: randomUUID() } }
            : {
                data: Object.fromEntries(
                  JSON.parse(options.body).ids.map((ticket) => [
                    ticket,
                    { status: "ok" },
                  ]),
                ),
              },
      };
    },
  });
  await push.cycle();
  check(
    sends.some((s) => s.url.endsWith("/send")),
    "Cola push usa proveedor de pruebas sin enviar mensajes reales",
  );
  check(
    sends
      .filter((s) => s.url.endsWith("/send"))
      .every(
        (s) => !s.body.body.includes("Comprador") && !s.body.body.includes("$"),
      ),
    "Push no expone nombres, importes ni dirección en pantalla bloqueada",
  );
  await rows(
    pool,
    "UPDATE push_outbox SET next_attempt_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 MINUTE) WHERE status='Ticket'",
  );
  await push.cycle();
  check(
    (
      await rows(
        pool,
        "SELECT COUNT(*) AS n FROM push_outbox WHERE status='Entregada'",
      )
    )[0].n.toString() !== "0",
    "Cola comprueba recibos del proveedor simulado",
  );
  await rows(
    pool,
    "UPDATE push_outbox SET status='Pendiente',next_attempt_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 MINUTE) WHERE status='Entregada' LIMIT 1",
  );
  await rows(
    pool,
    "UPDATE push_devices SET session_hash=? WHERE user_id=(SELECT user_id FROM customers WHERE id=?)",
    ["0".repeat(64), detail.order.customer_id],
  );
  const sendCount = sends.length;
  await push.cycle();
  check(
    sends.length === sendCount &&
      (
        await rows(
          pool,
          "SELECT COUNT(*) AS n FROM push_outbox WHERE status='Omitida'",
        )
      )[0].n.toString() !== "0",
    "Cola omite dispositivos cuya sesión ya no existe",
  );
  check(
    (
      await buyerCall("/api/push-device", "DELETE", {
        token: "ExpoPushToken[isolatedDeviceToken12345]",
      })
    ).status === 204,
    "Usuario desactiva avisos del dispositivo",
  );
  check(
    (await post(`/api/notifications/${notes[0].id}/read`, {}, buyer)).status ===
      204,
    "Comprador marca su aviso como leído",
  );
  await post(`/api/notifications/${notes[0].id}/read`, {}, secondToken);
  check(
    (await request("/api/notifications", { session: secondToken })).body.every(
      (n) => !notes.some((own) => own.id === n.id),
    ),
    "Avisos no exponen mensajes de otras cuentas",
  );
  check(
    (await request("/api/dashboard", { session: admin })).status === 200,
    "Empresa consulta resumen de encargos y existencias",
  );
  check(
    (await request("/api/dashboard", { session: buyer })).status === 403,
    "Resumen empresarial protegido",
  );
  check(
    (await post("/api/assistant", { question: "¿Qué riel necesito?" }, buyer))
      .status === 503,
    "IA sin credenciales no simula respuestas",
  );
  check(
    (
      await call(`/api/products/${productId}`, "PUT", {
        ...productBody,
        active: false,
      })
    ).status === 204,
    "Empresa desactiva producto sin borrar historial",
  );
  check(
    (await request(`/api/products/${productId}`, { session: buyer })).status ===
      404,
    "Comprador no encarga producto desactivado",
  );
  check(
    (await request(`/api/orders/${orderId}`, { session: buyer })).body.items[0]
      .product_name === productBody.name,
    "Historial sigue legible tras desactivar producto",
  );
}
