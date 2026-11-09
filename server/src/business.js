import { createHash, randomUUID } from "node:crypto";
import { ApiError, fields, text, phone, id, isStaff } from "./errors.js";
import { rows, transaction } from "./database.js";
import { decimal, format, totals } from "./amounts.js";
const staff = ["Administrador", "Operador"];
const optional = (value, max) =>
  value == null || value === ""
    ? null
    : (text(value, max) ?? fail("Texto inválido."));
function fail(message, status = 400) {
  throw new ApiError(status, message);
}
const fingerprint = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
function requestKey(value) {
  if (
    typeof value !== "string" ||
    !/^\w{8}-\w{4}-4\w{3}-[89ab]\w{3}-\w{12}$/i.test(value) ||
    !/^[a-f0-9-]+$/i.test(value)
  )
    fail("Identificador de operación inválido.");
  return value.toLowerCase();
}
function length(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > 1000000)
    fail("Medida inválida; indica milímetros.");
  return n;
}
function image(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      value.length <= 1000
    )
      return value;
  } catch {}
  fail("La imagen debe tener una URL HTTPS válida.");
}
async function owned(db, orderId, user, lock = false) {
  const [order] = await rows(
    db,
    `SELECT o.*,c.user_id,c.name AS customer_name,c.phone AS customer_phone FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.id=? AND (?=1 OR c.user_id=?)${lock ? " FOR UPDATE" : ""}`,
    [id(orderId), isStaff(user) ? 1 : 0, user.id],
  );
  if (!order) fail("Encargo no encontrado.", 404);
  return order;
}
async function notice(db, order, message) {
  const event = randomUUID();
  await rows(
    db,
    `INSERT INTO notifications(user_id,order_id,message,event_key) SELECT id,?,?,? FROM users WHERE active=1 AND (role_id IN (1,2) OR id=?)`,
    [order.id, message, event, order.user_id],
  );
  await rows(
    db,
    `INSERT INTO push_outbox(notification_id,device_id) SELECT n.id,d.id FROM notifications n JOIN push_devices d ON d.user_id=n.user_id AND d.active=1 WHERE n.event_key=?`,
    [event],
  );
}
async function history(db, order, user, status, note) {
  await rows(
    db,
    "INSERT INTO order_history(order_id,user_id,status,note) VALUES(?,?,?,?)",
    [order.id, user.id, status, note],
  );
  await notice(db, order, `Encargo #${order.id}: ${status}.`);
}
async function stock(db, order, user, action) {
  const items = await rows(
    db,
    "SELECT product_id,SUM(quantity) AS quantity FROM order_items WHERE order_id=? GROUP BY product_id ORDER BY product_id",
    [order.id],
  );
  for (const item of items) {
    const [product] = await rows(
      db,
      "SELECT stock,reserved,active FROM products WHERE id=? FOR UPDATE",
      [item.product_id],
    );
    const qty = decimal(item.quantity, 3, true, "999999999.999"),
      available = decimal(product.stock, 3, false, "999999999.999"),
      reserved = decimal(product.reserved, 3, false, "999999999.999");
    if (
      action === "Reserva" &&
      (Number(product.active) !== 1 || available - reserved < qty)
    )
      fail("Existencias insuficientes para confirmar el encargo.", 409);
    if (action !== "Reserva" && reserved < qty)
      fail("La reserva no coincide con el inventario.", 409);
    const nextReserved = action === "Reserva" ? reserved + qty : reserved - qty,
      nextStock = action === "Entrega" ? available - qty : available;
    await rows(db, "UPDATE products SET stock=?,reserved=? WHERE id=?", [
      format(nextStock, 3),
      format(nextReserved, 3),
      item.product_id,
    ]);
    await rows(
      db,
      "INSERT INTO inventory_movements(product_id,order_id,user_id,type,quantity,reason) VALUES(?,?,?,?,?,?)",
      [
        item.product_id,
        order.id,
        user.id,
        action,
        item.quantity,
        `Encargo #${order.id}`,
      ],
    );
  }
}
export function businessRoutes(
  app,
  { pool, protectedBy, run, assistant = null, pushEnabled = false },
) {
  app.get(
    "/api/categories",
    protectedBy(),
    run(async (req, res) =>
      res.json(
        await rows(pool, "SELECT id,name FROM categories ORDER BY name"),
      ),
    ),
  );
  app.post(
    "/api/categories",
    protectedBy(staff),
    run(async (req, res) => {
      fields(req.body, ["name"]);
      const name = text(req.body.name, 80);
      if (!name) fail("Indica una categoría.");
      const saved = await rows(pool, "INSERT INTO categories(name) VALUES(?)", [
        name,
      ]);
      res.status(201).json({ id: String(saved.insertId), name });
    }),
  );
  const productValues = (body) => {
    fields(body, [
      "categoryId",
      "code",
      "name",
      "description",
      "unit",
      "finish",
      "lengthMm",
      "price",
      "minimumStock",
      "imageUrl",
      "active",
    ]);
    const categoryId = id(body.categoryId),
      code = text(body.code, 40),
      name = text(body.name, 150),
      unit = text(body.unit, 30),
      finish = text(body.finish, 60);
    if (!code || !name || !unit || !finish || typeof body.active !== "boolean")
      fail("Completa los datos del producto.");
    decimal(body.price);
    decimal(body.minimumStock, 3, false, "999999999.999");
    return [
      categoryId,
      code,
      name,
      optional(body.description, 4000),
      unit,
      finish,
      length(body.lengthMm),
      body.price,
      body.minimumStock,
      image(body.imageUrl),
      body.active,
    ];
  };
  app.get(
    "/api/products/:id",
    protectedBy(),
    run(async (req, res) => {
      const [p] = await rows(
        pool,
        "SELECT *,stock-reserved AS available FROM products WHERE id=? AND (?=1 OR active=1)",
        [id(req.params.id), isStaff(req.user) ? 1 : 0],
      );
      if (!p) fail("Producto no encontrado.", 404);
      res.json(p);
    }),
  );
  app.post(
    "/api/products",
    protectedBy(staff),
    run(async (req, res) => {
      const values = productValues(req.body);
      const [category] = await rows(
        pool,
        "SELECT id FROM categories WHERE id=?",
        [values[0]],
      );
      if (!category) fail("Categoría no encontrada.");
      const saved = await rows(
        pool,
        "INSERT INTO products(category_id,code,name,description,unit,finish,length_mm,price,minimum_stock,image_url,active) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        values,
      );
      res.status(201).json({ id: String(saved.insertId) });
    }),
  );
  app.put(
    "/api/products/:id",
    protectedBy(staff),
    run(async (req, res) => {
      const values = productValues(req.body);
      await transaction(pool, async (db) => {
        const [product] = await rows(
          db,
          "SELECT id FROM products WHERE id=? FOR UPDATE",
          [id(req.params.id)],
        );
        if (!product) fail("Producto no encontrado.", 404);
        const [category] = await rows(
          db,
          "SELECT id FROM categories WHERE id=?",
          [values[0]],
        );
        if (!category) fail("Categoría no encontrada.");
        await rows(
          db,
          "UPDATE products SET category_id=?,code=?,name=?,description=?,unit=?,finish=?,length_mm=?,price=?,minimum_stock=?,image_url=?,active=? WHERE id=?",
          [...values, product.id],
        );
      });
      res.sendStatus(204);
    }),
  );
  app.post(
    "/api/products/:id/inventory",
    protectedBy(staff),
    run(async (req, res) => {
      fields(req.body, ["quantity", "reason"]);
      const qty = decimal(req.body.quantity, 3, true, "999999999.999"),
        reason = text(req.body.reason, 255);
      if (!reason) fail("Indica el motivo.");
      await transaction(pool, async (db) => {
        const [p] = await rows(
          db,
          "SELECT stock FROM products WHERE id=? FOR UPDATE",
          [id(req.params.id)],
        );
        if (!p) fail("Producto no encontrado.", 404);
        const next = decimal(p.stock, 3, false, "999999999.999") + qty;
        if (next > 999999999999n) fail("Existencias fuera de rango.");
        await rows(db, "UPDATE products SET stock=? WHERE id=?", [
          format(next, 3),
          req.params.id,
        ]);
        await rows(
          db,
          "INSERT INTO inventory_movements(product_id,user_id,type,quantity,reason) VALUES(?,?,'Entrada',?,?)",
          [req.params.id, req.user.id, req.body.quantity, reason],
        );
      });
      res.sendStatus(204);
    }),
  );
  app.post(
    "/api/products/:id/adjustment",
    protectedBy(["Administrador"]),
    run(async (req, res) => {
      fields(req.body, ["stock", "reason"]);
      const next = decimal(req.body.stock, 3, false, "999999999.999"),
        reason = text(req.body.reason, 255);
      if (!reason) fail("Indica el motivo del ajuste.");
      await transaction(pool, async (db) => {
        const [p] = await rows(
          db,
          "SELECT stock,reserved FROM products WHERE id=? FOR UPDATE",
          [id(req.params.id)],
        );
        if (!p) fail("Producto no encontrado.", 404);
        if (next < decimal(p.reserved, 3, false, "999999999.999"))
          fail("No puedes retirar existencias reservadas.", 409);
        const diff = next - decimal(p.stock, 3, false, "999999999.999");
        if (!diff) fail("No hay cambio de existencias.");
        await rows(db, "UPDATE products SET stock=? WHERE id=?", [
          req.body.stock,
          req.params.id,
        ]);
        await rows(
          db,
          "INSERT INTO inventory_movements(product_id,user_id,type,quantity,reason) VALUES(?,?,'Ajuste',?,?)",
          [
            req.params.id,
            req.user.id,
            diff < 0n ? "-" + format(-diff, 3) : format(diff, 3),
            reason,
          ],
        );
      });
      res.sendStatus(204);
    }),
  );
  app.get(
    "/api/products/:id/movements",
    protectedBy(staff),
    run(async (req, res) =>
      res.json(
        await rows(
          pool,
          "SELECT id,type,quantity,reason,created_at FROM inventory_movements WHERE product_id=? ORDER BY id DESC LIMIT 100",
          [id(req.params.id)],
        ),
      ),
    ),
  );
  app.get(
    "/api/favorites",
    protectedBy(["Cliente"]),
    run(async (req, res) =>
      res.json(
        await rows(
          pool,
          "SELECT p.*,p.stock-p.reserved AS available FROM favorites f JOIN products p ON p.id=f.product_id WHERE f.user_id=? AND p.active=1 ORDER BY f.created_at DESC LIMIT 100",
          [req.user.id],
        ),
      ),
    ),
  );
  app.put(
    "/api/favorites/:id",
    protectedBy(["Cliente"]),
    run(async (req, res) => {
      fields(req.body, []);
      const [p] = await rows(
        pool,
        "SELECT id FROM products WHERE id=? AND active=1",
        [id(req.params.id)],
      );
      if (!p) fail("Producto no encontrado.", 404);
      await transaction(pool, async (db) => {
        const [existing] = await rows(
          db,
          "SELECT product_id FROM favorites WHERE user_id=? AND product_id=? FOR UPDATE",
          [req.user.id, p.id],
        );
        if (!existing)
          await rows(
            db,
            "INSERT INTO favorites(user_id,product_id) VALUES(?,?)",
            [req.user.id, p.id],
          );
      });
      res.sendStatus(204);
    }),
  );
  app.delete(
    "/api/favorites/:id",
    protectedBy(["Cliente"]),
    run(async (req, res) => {
      await rows(
        pool,
        "DELETE FROM favorites WHERE user_id=? AND product_id=?",
        [req.user.id, id(req.params.id)],
      );
      res.sendStatus(204);
    }),
  );
  app.get(
    "/api/profile",
    protectedBy(),
    run(async (req, res) => {
      const [p] = await rows(
        pool,
        "SELECT u.name,u.email,c.phone,c.business_name,c.tax_id,c.address FROM users u LEFT JOIN customers c ON c.user_id=u.id WHERE u.id=?",
        [req.user.id],
      );
      res.json(p);
    }),
  );
  app.put(
    "/api/profile",
    protectedBy(),
    run(async (req, res) => {
      fields(req.body, ["name", "phone", "businessName", "taxId", "address"]);
      const name = text(req.body.name, 120);
      if (!name) fail("Indica tu nombre.");
      const number = req.user.role === "Cliente" ? phone(req.body.phone) : null;
      if (req.user.role === "Cliente" && !number) fail("Teléfono inválido.");
      const business = optional(req.body.businessName, 160),
        taxId = optional(req.body.taxId, 13),
        address = optional(req.body.address, 500);
      if (taxId && !/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/u.test(taxId))
        fail("RFC inválido.");
      await transaction(pool, async (db) => {
        await rows(db, "UPDATE users SET name=? WHERE id=?", [
          name,
          req.user.id,
        ]);
        if (req.user.role === "Cliente")
          await rows(
            db,
            "UPDATE customers SET name=?,phone=?,business_name=?,tax_id=?,address=? WHERE user_id=?",
            [name, number, business, taxId, address, req.user.id],
          );
      });
      res.sendStatus(204);
    }),
  );
  app.get(
    "/api/company",
    protectedBy(),
    run(async (req, res) => {
      const [settings] = await rows(
        pool,
        "SELECT name,phone,address,tax_rate FROM company_settings WHERE id=1",
      );
      res.json(
        settings ?? {
          name: null,
          phone: null,
          address: null,
          tax_rate: "0.1600",
        },
      );
    }),
  );
  app.put(
    "/api/company",
    protectedBy(["Administrador"]),
    run(async (req, res) => {
      fields(req.body, ["name", "phone", "address", "taxRate"]);
      const name = text(req.body.name, 160),
        number = phone(req.body.phone),
        address = text(req.body.address, 500);
      if (!name || !number || !address)
        fail("Completa los datos de la empresa.");
      decimal(req.body.taxRate, 4, false, "1.0000");
      await transaction(pool, async (db) => {
        const [existing] = await rows(
          db,
          "SELECT id FROM company_settings WHERE id=1 FOR UPDATE",
        );
        await rows(
          db,
          existing
            ? "UPDATE company_settings SET name=?,phone=?,address=?,tax_rate=? WHERE id=1"
            : "INSERT INTO company_settings(name,phone,address,tax_rate,id) VALUES(?,?,?,?,1)",
          [name, number, address, req.body.taxRate],
        );
      });
      res.sendStatus(204);
    }),
  );
  app.get(
    "/api/orders",
    protectedBy(),
    run(async (req, res) => {
      const status = req.query.status ?? "";
      if (
        typeof status !== "string" ||
        ![
          "",
          "Solicitado",
          "Cotizado",
          "Confirmado",
          "Preparando",
          "Listo",
          "Entregado",
          "Cancelado",
        ].includes(status)
      )
        fail("Estado inválido.");
      res.json(
        await rows(
          pool,
          `SELECT o.*,c.name AS customer_name,q.total,q.status AS quote_status FROM orders o JOIN customers c ON c.id=o.customer_id LEFT JOIN quotes q ON q.order_id=o.id WHERE (?=1 OR c.user_id=?) AND (?='' OR o.status=?) ORDER BY o.id DESC LIMIT 100`,
          [isStaff(req.user) ? 1 : 0, req.user.id, status, status],
        ),
      );
    }),
  );
  app.post(
    "/api/orders",
    protectedBy(),
    run(async (req, res) => {
      fields(req.body, [
        "requestKey",
        "customerId",
        "fulfillment",
        "deliveryAddress",
        "notes",
        "items",
      ]);
      const key = requestKey(req.body.requestKey),
        body = req.body;
      if (!["Recoger", "Entrega"].includes(body.fulfillment))
        fail("Selecciona recogida o entrega.");
      const address = optional(body.deliveryAddress, 500),
        notes = optional(body.notes, 2000);
      if (body.fulfillment === "Entrega" && !address)
        fail("Indica la dirección de entrega.");
      if (
        !Array.isArray(body.items) ||
        !body.items.length ||
        body.items.length > 50
      )
        fail("Agrega entre 1 y 50 materiales.");
      const items = body.items.map((item) => {
        fields(item, ["productId", "quantity", "cutLengthMm", "finish"]);
        const finish = item.finish == null ? null : text(item.finish, 60);
        if (item.finish != null && !finish) fail("Acabado inválido.");
        return {
          productId: id(item.productId),
          quantity: format(decimal(item.quantity, 3, true, "999999999.999"), 3),
          cutLengthMm: length(item.cutLengthMm),
          ...(finish ? { finish } : {}),
        };
      });
      if (new Set(items.map((i) => i.productId)).size !== items.length)
        fail("Combina las cantidades del mismo producto.");
      items.sort((a, b) =>
        BigInt(a.productId) < BigInt(b.productId) ? -1 : 1,
      );
      const hash = fingerprint({
        fulfillment: body.fulfillment,
        address,
        notes,
        items,
      });
      const result = await transaction(pool, async (db) => {
        if (!isStaff(req.user) && body.customerId != null)
          fail("No puedes seleccionar otro cliente.", 403);
        const [customer] = await rows(
          db,
          isStaff(req.user)
            ? "SELECT id,user_id FROM customers WHERE id=? FOR UPDATE"
            : "SELECT id,user_id FROM customers WHERE user_id=? FOR UPDATE",
          [isStaff(req.user) ? id(body.customerId) : req.user.id],
        );
        if (!customer) fail("Ficha de cliente no encontrada.", 404);
        const [previous] = await rows(
          db,
          "SELECT id,request_hash FROM orders WHERE customer_id=? AND request_key=?",
          [customer.id, key],
        );
        if (previous) {
          if (previous.request_hash !== hash)
            fail(
              "La solicitud ya fue enviada con otros datos. Actualiza el carrito.",
              409,
            );
          return { id: String(previous.id), repeated: true };
        }
        const products = [];
        for (const item of items) {
          const [p] = await rows(
            db,
            "SELECT * FROM products WHERE id=? AND active=1 FOR UPDATE",
            [item.productId],
          );
          if (!p) fail("Un material ya no está disponible.", 409);
          if (
            item.cutLengthMm &&
            (!p.length_mm || item.cutLengthMm > p.length_mm)
          )
            fail("El corte supera la longitud del material.");
          // products.finish puede listar varios acabados separados por comas.
          const options = String(p.finish)
            .split(",")
            .map((f) => f.trim())
            .filter(Boolean);
          if (item.finish && !options.includes(item.finish))
            fail(`El acabado no está disponible para ${p.code}.`);
          if (!item.finish && options.length > 1)
            fail(`Selecciona el acabado de ${p.code}.`);
          products.push({ ...p, finish: item.finish ?? p.finish });
        }
        const saved = await rows(
          db,
          "INSERT INTO orders(customer_id,request_key,request_hash,fulfillment,delivery_address,notes) VALUES(?,?,?,?,?,?)",
          [customer.id, key, hash, body.fulfillment, address, notes],
        );
        for (let i = 0; i < items.length; i++) {
          const item = items[i],
            p = products[i];
          await rows(
            db,
            "INSERT INTO order_items(order_id,product_id,quantity,unit_price,finish,cut_length_mm,product_name,product_code) VALUES(?,?,?,?,?,?,?,?)",
            [
              saved.insertId,
              p.id,
              item.quantity,
              p.price,
              p.finish,
              item.cutLengthMm,
              p.name,
              p.code,
            ],
          );
        }
        const order = { id: String(saved.insertId), user_id: customer.user_id };
        await history(
          db,
          order,
          req.user,
          "Solicitado",
          "Solicitud registrada",
        );
        return { id: order.id, repeated: false };
      });
      res.status(result.repeated ? 200 : 201).json(result);
    }),
  );
  app.get(
    "/api/orders/:id",
    protectedBy(),
    run(async (req, res) => {
      const order = await owned(pool, req.params.id, req.user),
        items = await rows(
          pool,
          "SELECT * FROM order_items WHERE order_id=? ORDER BY id",
          [order.id],
        );
      const [quote] = await rows(
        pool,
        "SELECT * FROM quotes WHERE order_id=?",
        [order.id],
      );
      const payments = quote
        ? await rows(
            pool,
            "SELECT id,amount,reference,created_at FROM payments WHERE quote_id=? ORDER BY id",
            [quote.id],
          )
        : [];
      const history = await rows(
        pool,
        "SELECT status,note,created_at FROM order_history WHERE order_id=? ORDER BY id",
        [order.id],
      );
      const paid = payments.reduce((sum, p) => sum + decimal(p.amount), 0n);
      res.json({
        order,
        items,
        quote: quote
          ? {
              ...quote,
              paid: format(paid),
              balance: format(
                decimal(quote.total, 2, false, "999999999999.99") - paid,
              ),
            }
          : null,
        payments,
        history,
      });
    }),
  );
  app.post(
    "/api/orders/:id/quote",
    protectedBy(staff),
    run(async (req, res) => {
      fields(req.body, ["taxRate", "shipping", "prices"]);
      decimal(req.body.taxRate, 4, false, "1.0000");
      decimal(req.body.shipping);
      if (
        !Array.isArray(req.body.prices) ||
        !req.body.prices.length ||
        req.body.prices.length > 50
      )
        fail("Revisa los precios de las partidas.");
      const prices = req.body.prices.map((p) => {
        fields(p, ["itemId", "unitPrice"]);
        decimal(p.unitPrice);
        return { id: id(p.itemId), price: p.unitPrice };
      });
      const result = await transaction(pool, async (db) => {
        const order = await owned(db, req.params.id, req.user, true);
        if (!["Solicitado", "Cotizado"].includes(order.status))
          fail("El encargo no permite modificar la cotización.", 409);
        const items = await rows(
          db,
          "SELECT * FROM order_items WHERE order_id=? ORDER BY id",
          [order.id],
        );
        if (
          items.length !== prices.length ||
          new Set(prices.map((p) => p.id)).size !== items.length ||
          items.some((i) => !prices.some((p) => p.id === String(i.id)))
        )
          fail("Las partidas no coinciden.");
        for (const item of items) {
          item.unit_price = prices.find((p) => p.id === String(item.id)).price;
          await rows(db, "UPDATE order_items SET unit_price=? WHERE id=?", [
            item.unit_price,
            item.id,
          ]);
        }
        const amounts = totals(items, req.body.taxRate, req.body.shipping);
        const [previousQuote] = await rows(
          db,
          "SELECT id FROM quotes WHERE order_id=?",
          [order.id],
        );
        const quoteValues = [
          amounts.subtotal,
          req.body.taxRate,
          amounts.tax,
          amounts.shipping,
          amounts.total,
          order.id,
        ];
        await rows(
          db,
          previousQuote
            ? "UPDATE quotes SET subtotal=?,tax_rate=?,tax=?,shipping=?,total=?,status='Enviada',revision=revision+1 WHERE order_id=?"
            : "INSERT INTO quotes(subtotal,tax_rate,tax,shipping,total,order_id,status) VALUES(?,?,?,?,?,?,'Enviada')",
          quoteValues,
        );
        await rows(db, "UPDATE orders SET status='Cotizado' WHERE id=?", [
          order.id,
        ]);
        await history(db, order, req.user, "Cotizado", "Cotización enviada");
        return amounts;
      });
      res.json(result);
    }),
  );
  app.post(
    "/api/orders/:id/accept",
    protectedBy(),
    run(async (req, res) => {
      fields(req.body, ["revision"]);
      if (!Number.isSafeInteger(req.body.revision) || req.body.revision < 1)
        fail("Actualiza la cotización antes de aceptar.");
      await transaction(pool, async (db) => {
        const order = await owned(db, req.params.id, req.user, true);
        if (isStaff(req.user) && order.user_id !== null)
          fail(
            "La cotización debe aceptarla el comprador desde su cuenta.",
            403,
          );
        if (order.status !== "Cotizado")
          fail("La cotización ya no está disponible para aceptar.", 409);
        const [quote] = await rows(
          db,
          "SELECT id,revision FROM quotes WHERE order_id=? AND status='Enviada' FOR UPDATE",
          [order.id],
        );
        if (!quote) fail("Cotización no disponible.", 409);
        if (Number(quote.revision) !== req.body.revision)
          fail(
            "La cotización cambió. Actualiza y revisa el importe antes de aceptar.",
            409,
          );
        await stock(db, order, req.user, "Reserva");
        await rows(db, "UPDATE quotes SET status='Aceptada' WHERE id=?", [
          quote.id,
        ]);
        await rows(db, "UPDATE orders SET status='Confirmado' WHERE id=?", [
          order.id,
        ]);
        await history(
          db,
          order,
          req.user,
          "Confirmado",
          "Cotización aceptada y materiales reservados",
        );
      });
      res.sendStatus(204);
    }),
  );
  app.post(
    "/api/orders/:id/status",
    protectedBy(),
    run(async (req, res) => {
      fields(req.body, ["status", "note"]);
      const next = req.body.status,
        note = optional(req.body.note, 500);
      if (!["Preparando", "Listo", "Entregado", "Cancelado"].includes(next))
        fail("Estado de destino inválido.");
      await transaction(pool, async (db) => {
        const order = await owned(db, req.params.id, req.user, true);
        if (
          !isStaff(req.user) &&
          (next !== "Cancelado" ||
            !["Solicitado", "Cotizado"].includes(order.status))
        )
          fail("No puedes realizar este cambio.", 403);
        if (next === "Cancelado") {
          if (["Entregado", "Cancelado"].includes(order.status))
            fail("No se puede cancelar este encargo.", 409);
          const [payment] = await rows(
            db,
            "SELECT p.id FROM payments p JOIN quotes q ON q.id=p.quote_id WHERE q.order_id=? LIMIT 1",
            [order.id],
          );
          if (payment)
            fail(
              "El encargo tiene pagos; requiere resolverlos antes de cancelar.",
              409,
            );
          if (["Confirmado", "Preparando", "Listo"].includes(order.status))
            await stock(db, order, req.user, "Liberacion");
          await rows(
            db,
            "UPDATE quotes SET status='Rechazada' WHERE order_id=?",
            [order.id],
          );
        } else {
          if (
            !isStaff(req.user) ||
            {
              Preparando: "Confirmado",
              Listo: "Preparando",
              Entregado: "Listo",
            }[next] !== order.status
          )
            fail("Transición de estado no permitida.", 409);
          if (next === "Entregado") await stock(db, order, req.user, "Entrega");
        }
        await rows(db, "UPDATE orders SET status=? WHERE id=?", [
          next,
          order.id,
        ]);
        await history(db, order, req.user, next, note);
      });
      res.sendStatus(204);
    }),
  );
  app.post(
    "/api/orders/:id/payments",
    protectedBy(staff),
    run(async (req, res) => {
      fields(req.body, ["requestKey", "amount", "reference"]);
      const key = requestKey(req.body.requestKey),
        amount = decimal(req.body.amount, 2, true),
        reference = text(req.body.reference, 120);
      if (!reference) fail("Indica una referencia del pago recibido.");
      const hash = fingerprint({ amount: format(amount), reference });
      const result = await transaction(pool, async (db) => {
        const order = await owned(db, req.params.id, req.user, true);
        if (
          !["Confirmado", "Preparando", "Listo", "Entregado"].includes(
            order.status,
          )
        )
          fail("El encargo aún no admite pagos.", 409);
        const [quote] = await rows(
          db,
          "SELECT * FROM quotes WHERE order_id=? AND status='Aceptada' FOR UPDATE",
          [order.id],
        );
        if (!quote) fail("No hay cotización aceptada.", 409);
        const [previous] = await rows(
          db,
          "SELECT id,request_hash FROM payments WHERE quote_id=? AND request_key=?",
          [quote.id, key],
        );
        if (previous) {
          if (previous.request_hash !== hash)
            fail("La referencia de operación corresponde a otro pago.", 409);
          return { id: String(previous.id), repeated: true };
        }
        const payments = await rows(
          db,
          "SELECT amount FROM payments WHERE quote_id=?",
          [quote.id],
        );
        const paid = payments.reduce((sum, p) => sum + decimal(p.amount), 0n);
        if (paid + amount > decimal(quote.total, 2, false, "999999999999.99"))
          fail("El pago supera el saldo pendiente.", 409);
        const saved = await rows(
          db,
          "INSERT INTO payments(quote_id,amount,reference,recorded_by,request_key,request_hash) VALUES(?,?,?,?,?,?)",
          [quote.id, req.body.amount, reference, req.user.id, key, hash],
        );
        await notice(
          db,
          order,
          `Pago registrado para el encargo #${order.id}.`,
        );
        return { id: String(saved.insertId), repeated: false };
      });
      res.status(result.repeated ? 200 : 201).json(result);
    }),
  );
  app.get(
    "/api/notifications",
    protectedBy(),
    run(async (req, res) =>
      res.json(
        await rows(
          pool,
          "SELECT id,order_id,message,read_at,created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100",
          [req.user.id],
        ),
      ),
    ),
  );
  app.put(
    "/api/push-device",
    protectedBy(),
    run(async (req, res) => {
      if (!pushEnabled)
        fail(
          "Las notificaciones del teléfono aún no están habilitadas en el servidor.",
          503,
        );
      fields(req.body, ["token"]);
      if (
        typeof req.body.token !== "string" ||
        !/^(ExpoPushToken|ExponentPushToken)\[[a-zA-Z0-9_-]{10,150}\]$/.test(
          req.body.token,
        )
      )
        fail("Token de dispositivo inválido.");
      await transaction(pool, async (db) => {
        const count = await rows(
          db,
          "SELECT id FROM push_devices WHERE user_id=? AND active=1 FOR UPDATE",
          [req.user.id],
        );
        if (count.length >= 10) {
          const [existing] = await rows(
            db,
            "SELECT id,user_id,active FROM push_devices WHERE push_token=?",
            [req.body.token],
          );
          if (
            !existing ||
            String(existing.user_id) !== String(req.user.id) ||
            Number(existing.active) !== 1
          )
            fail(
              "Ya hay diez dispositivos registrados. Desactiva uno antes de continuar.",
              409,
            );
        }
        const [device] = await rows(
          db,
          "SELECT id FROM push_devices WHERE push_token=? FOR UPDATE",
          [req.body.token],
        );
        await rows(
          db,
          device
            ? "UPDATE push_devices SET user_id=?,session_hash=?,active=1 WHERE push_token=?"
            : "INSERT INTO push_devices(user_id,session_hash,push_token,active) VALUES(?,?,?,1)",
          [req.user.id, req.user.sessionHash, req.body.token],
        );
      });
      res.sendStatus(204);
    }),
  );
  app.delete(
    "/api/push-device",
    protectedBy(),
    run(async (req, res) => {
      fields(req.body, ["token"]);
      if (typeof req.body.token !== "string" || req.body.token.length > 200)
        fail("Token inválido.");
      await rows(
        pool,
        "UPDATE push_devices SET active=0 WHERE push_token=? AND user_id=?",
        [req.body.token, req.user.id],
      );
      res.sendStatus(204);
    }),
  );
  app.post(
    "/api/notifications/:id/read",
    protectedBy(),
    run(async (req, res) => {
      fields(req.body, []);
      await rows(
        pool,
        "UPDATE notifications SET read_at=COALESCE(read_at,UTC_TIMESTAMP()) WHERE id=? AND user_id=?",
        [id(req.params.id), req.user.id],
      );
      res.sendStatus(204);
    }),
  );
  app.get(
    "/api/dashboard",
    protectedBy(staff),
    run(async (req, res) => {
      const orders = await rows(
        pool,
        "SELECT status,COUNT(*) AS count FROM orders GROUP BY status",
      );
      const lowStock = await rows(
        pool,
        "SELECT id,code,name,stock-reserved AS available,minimum_stock FROM products WHERE active=1 AND stock-reserved<=minimum_stock ORDER BY id LIMIT 100",
      );
      res.json({ orders, lowStock });
    }),
  );
  app.post(
    "/api/assistant",
    protectedBy(),
    run(async (req, res) => {
      fields(req.body, ["question"]);
      const question = text(req.body.question, 1000);
      if (!question) fail("Escribe una consulta de hasta 1000 caracteres.");
      if (!assistant)
        fail("El asistente de IA todavía no está configurado.", 503);
      const products = await rows(
        pool,
        "SELECT code,name,unit,finish,length_mm,stock-reserved AS available FROM products WHERE active=1 ORDER BY id LIMIT 50",
      );
      res.json(await assistant(question, products));
    }),
  );
}
