import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { randomUUID } from "expo-crypto";
import Scanner from "./Scanner";
import { registerPush, disablePush } from "./push";
const statuses = [
  "",
  "Solicitado",
  "Cotizado",
  "Confirmado",
  "Preparando",
  "Listo",
  "Entregado",
  "Cancelado",
];
const help = [
  [
    "¿Cómo encargar?",
    "Busca un material, revisa su presentación y agrega la cantidad al carrito. Revisa las medidas en milímetros y envía la solicitud. La empresa confirma el precio con una cotización.",
  ],
  [
    "¿Cuándo se reserva el material?",
    "Al aceptar la cotización se comprueban y reservan existencias. Enviar una solicitud no garantiza disponibilidad.",
  ],
  [
    "¿Cómo funciona el pago?",
    "La empresa registra pagos recibidos fuera de la app y su referencia. Esta versión no realiza cobros bancarios.",
  ],
  [
    "¿Para qué sirve la cámara?",
    "Busca un producto leyendo su código de barras o QR. No mide ventanas ni interpreta fotografías.",
  ],
  [
    "¿Para qué sirve la IA?",
    "Orienta sobre materiales del catálogo. No modifica encargos ni confirma medidas o precios. Revisa su sugerencia con la empresa.",
  ],
];
export default function BusinessApp({
  client,
  user,
  audience,
  busy,
  run,
  onPassword,
  onLogout,
  onUser,
}) {
  const company = audience === "empresa",
    admin = user.role === "Administrador";
  const [screen, setScreen] = useState("inicio"),
    [data, setData] = useState({}),
    [form, setForm] = useState({}),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("");
  const [cart, setCart] = useState([]),
    [checkout, setCheckout] = useState({
      fulfillment: "Recoger",
      deliveryAddress: "",
      notes: "",
      customerId: "",
    }),
    [filter, setFilter] = useState(""),
    [answer, setAnswer] = useState("");
  const cartKey = useRef(randomUUID()),
    payKey = useRef(randomUUID()),
    alive = useRef(true);
  const change = (name, value) => setForm((f) => ({ ...f, [name]: value }));
  const cartChange = (items) => {
    setCart(items);
    cartKey.current = randomUUID();
  };
  const field = (
    name,
    label,
    { decimal = false, secret = false, multiline = false, max = 500 } = {},
  ) => (
    <View key={name}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={String(form[name] ?? "")}
        onChangeText={(v) => change(name, v)}
        keyboardType={decimal ? "decimal-pad" : "default"}
        secureTextEntry={secret}
        autoCapitalize={secret ? "none" : "sentences"}
        multiline={multiline}
        maxLength={max}
        editable={!busy}
        style={s.input}
      />
    </View>
  );
  const button = (label, action, secondary = false) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      disabled={busy}
      onPress={action}
      style={[s.button, secondary && s.secondary, busy && { opacity: 0.5 }]}
    >
      <Text style={[s.buttonText, secondary && s.secondaryText]}>{label}</Text>
    </Pressable>
  );
  const card = (key, content) => (
    <View key={key} style={s.card}>
      {content}
    </View>
  );
  const perform = (fn) =>
    run(async () => {
      await fn();
    });
  async function load(next, query = "") {
    let result = {};
    if (next === "inicio")
      result = company
        ? { dashboard: await client.dashboard() }
        : { company: await client.company() };
    if (next === "catalogo")
      result = {
        products: await client.products(query),
        categories: await client.categories(),
      };
    if (next === "favoritos")
      result = {
        products: await client.favorites(),
        categories: await client.categories(),
      };
    if (next === "encargos") result = { orders: await client.orders(query) };
    if (next === "notificaciones")
      result = { notifications: await client.notifications() };
    if (next === "clientes") result = { customers: await client.customers() };
    if (next === "perfil") {
      const p = await client.profile();
      setForm({
        name: p.name,
        phone: p.phone ?? "",
        businessName: p.business_name ?? "",
        taxId: p.tax_id ?? "",
        address: p.address ?? "",
      });
    }
    if (next === "empresa") {
      const p = await client.company();
      setForm({
        name: p.name ?? "",
        phone: p.phone ?? "",
        address: p.address ?? "",
        taxRate: p.tax_rate,
      });
    }
    if (alive.current) {
      setData(result);
      setScreen(next);
    }
  }
  useEffect(() => {
    alive.current = true;
    perform(() => load("inicio"));
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") setForm((f) => ({ ...f, password: "" }));
    });
    return () => {
      alive.current = false;
      listener.remove();
    };
  }, []);
  const go = (next, query = "") => perform(() => load(next, query));
  async function openProduct(productId) {
    const p = await client.product(productId);
    setData({ product: p });
    setForm({ quantity: "1", cutLengthMm: "" });
    setScreen("producto");
  }
  async function openOrder(orderId) {
    const detail = await client.order(orderId);
    const settings = detail.quote ? null : await client.company();
    setData(detail);
    setForm({
      taxRate: detail.quote?.tax_rate ?? settings.tax_rate,
      shipping: detail.quote?.shipping ?? "0.00",
      ...Object.fromEntries(
        detail.items.map((i) => ["price" + i.id, i.unit_price]),
      ),
    });
    payKey.current = randomUUID();
    setScreen("encargo");
  }
  function add(product) {
    const quantity = String(form.quantity ?? "1");
    if (
      !/^(0|[1-9][0-9]{0,8})(\.[0-9]{1,3})?$/.test(quantity) ||
      Number(quantity) <= 0
    )
      throw new Error(
        "Indica una cantidad mayor que cero, con hasta tres decimales.",
      );
    if (!Number(product.active))
      throw new Error("Este producto está desactivado.");
    const cut = form.cutLengthMm ?? "";
    if (
      cut &&
      (!/^[1-9][0-9]{0,6}$/.test(cut) ||
        !product.length_mm ||
        Number(cut) > product.length_mm)
    )
      throw new Error("Revisa la medida del corte en milímetros.");
    if (cart.length >= 50 && !cart.some((i) => i.productId === product.id))
      throw new Error("Puedes solicitar hasta 50 materiales distintos.");
    const item = {
      productId: String(product.id),
      quantity,
      cutLengthMm: cut || null,
      product,
    };
    cartChange([...cart.filter((i) => i.productId !== item.productId), item]);
    setScreen("carrito");
  }
  async function checkoutScreen() {
    if (!cart.length) throw new Error("Agrega al menos un material.");
    const settings = await client.company();
    setData({
      company: settings,
      ...(company
        ? { customers: await client.customers() }
        : { profile: await client.profile() }),
    });
    setScreen("checkout");
  }
  async function submitOrder() {
    const result = await client.createOrder({
      requestKey: cartKey.current,
      ...checkout,
      ...(!company ? { customerId: null } : {}),
      items: cart.map(({ productId, quantity, cutLengthMm }) => ({
        productId,
        quantity,
        cutLengthMm,
      })),
    });
    cartChange([]);
    setCheckout({
      fulfillment: "Recoger",
      deliveryAddress: "",
      notes: "",
      customerId: "",
    });
    setData({ orderId: result.id });
    setScreen("confirmacion");
  }
  function confirm(label, fn) {
    Alert.alert(label, "Confirma que revisaste los datos de esta operación.", [
      { text: "Volver", style: "cancel" },
      { text: "Confirmar", onPress: () => perform(fn) },
    ]);
  }
  async function editProduct(p) {
    const categories = await client.categories();
    setData({ categories, productId: p?.id ?? null });
    setForm(
      p
        ? {
            categoryId: String(p.category_id),
            code: p.code,
            name: p.name,
            description: p.description ?? "",
            unit: p.unit,
            finish: p.finish,
            lengthMm: p.length_mm ?? "",
            price: p.price,
            minimumStock: p.minimum_stock,
            imageUrl: p.image_url ?? "",
            active: Number(p.active) === 1,
          }
        : {
            categoryId: categories[0] ? String(categories[0].id) : "",
            code: "",
            name: "",
            description: "",
            unit: "",
            finish: "Natural",
            lengthMm: "",
            price: "",
            minimumStock: "0.000",
            imageUrl: "",
            active: true,
          },
    );
    setScreen("editarproducto");
  }
  const order = data.order,
    quote = data.quote;
  return (
    <View>
      <View style={s.nav}>
        {[
          ["Inicio", "inicio"],
          ["Catálogo", "catalogo"],
          ["Encargos", "encargos"],
          ["Avisos", "notificaciones"],
          ["Mi perfil", "perfil"],
        ].map(([label, next]) => button(label, () => go(next), true))}
        {button(
          `Carrito (${cart.length})`,
          () => {
            setScreen("carrito");
            setForm({});
          },
          true,
        )}
      </View>
      {screen === "inicio" && (
        <View>
          <Text style={s.title}>
            {company
              ? "Tu distribuidora"
              : "Tu siguiente proyecto empieza aquí"}
          </Text>
          <Text style={s.body}>Hola, {user.name}</Text>
          {button(company ? "Ver solicitudes" : "Explorar catálogo", () =>
            go(company ? "encargos" : "catalogo"),
          )}
          {company &&
            data.dashboard &&
            card(
              "dashboard",
              <>
                <Text style={s.name}>Encargos por estado</Text>
                {data.dashboard.orders.length ? (
                  data.dashboard.orders.map((o) => (
                    <Text key={o.status}>
                      {o.status}: {o.count}
                    </Text>
                  ))
                ) : (
                  <Text>No hay encargos.</Text>
                )}
                <Text style={s.name}>Existencias bajas</Text>
                {data.dashboard.lowStock.length ? (
                  data.dashboard.lowStock.map((p) => (
                    <View key={p.id}>
                      <Text>
                        {p.name}: {p.available}
                      </Text>
                      {button(
                        "Revisar " + p.code,
                        () => perform(() => openProduct(p.id)),
                        true,
                      )}
                    </View>
                  ))
                ) : (
                  <Text>No hay alertas de existencias.</Text>
                )}
              </>,
            )}
          {company && button("Clientes", () => go("clientes"), true)}
          {company &&
            button(
              "Nuevo producto",
              () => perform(() => editProduct(null)),
              true,
            )}
          {admin && button("Datos de la empresa", () => go("empresa"), true)}
          {admin &&
            button(
              "Crear cuenta de personal",
              () => {
                setForm({ role: "Operador" });
                setScreen("personal");
              },
              true,
            )}
          {!company && button("Mis favoritos", () => go("favoritos"), true)}
          {button("Escanear código", () => setScreen("camara"), true)}
          {button(
            "Asistente de materiales",
            () => {
              setForm({ question: "" });
              setAnswer("");
              setScreen("ia");
            },
            true,
          )}
          {button("Ayuda", () => setScreen("ayuda"), true)}
          {!company &&
            data.company &&
            card(
              "sucursal",
              <>
                <Text style={s.name}>
                  {data.company.name ?? "Datos de la sucursal"}
                </Text>
                <Text>
                  {data.company.address ??
                    "La empresa aún no registró su dirección."}
                </Text>
                <Text>{data.company.phone ?? ""}</Text>
              </>,
            )}
        </View>
      )}
      {["catalogo", "favoritos"].includes(screen) && (
        <View>
          <Text style={s.title}>
            {screen === "favoritos" ? "Mis favoritos" : "Catálogo"}
          </Text>
          <TextInput
            accessibilityLabel="Buscar producto"
            placeholder="Nombre o código del material"
            value={search}
            onChangeText={setSearch}
            maxLength={150}
            style={s.input}
          />
          {button("Buscar", () => go("catalogo", search))}
          {button("Escanear código", () => setScreen("camara"), true)}
          <View style={s.nav}>
            {button("Todas las categorías", () => setCategory(""), true)}
            {data.categories?.map((c) =>
              button(
                c.name,
                () => setCategory(String(c.id)),
                category !== String(c.id),
              ),
            )}
          </View>
          {!data.products?.length && (
            <Text style={s.body}>No hay materiales para mostrar.</Text>
          )}
          {data.products
            ?.filter((p) => !category || String(p.category_id) === category)
            .map((p) =>
              card(
                p.id,
                <>
                  {p.image_url && (
                    <Image
                      accessibilityLabel={p.name}
                      source={{ uri: p.image_url }}
                      style={s.image}
                    />
                  )}
                  <Text style={s.name}>{p.name}</Text>
                  <Text>
                    {p.code} · {p.finish} · {p.unit}
                  </Text>
                  <Text>
                    ${p.price} · disponible: {p.available}
                  </Text>
                  {!Number(p.active) && <Text>Desactivado</Text>}
                  {button("Ver " + p.code, () =>
                    perform(() => openProduct(p.id)),
                  )}
                </>,
              ),
            )}
          {company &&
            button("Nuevo producto", () => perform(() => editProduct(null)))}
        </View>
      )}
      {screen === "producto" &&
        data.product &&
        card(
          "producto",
          <>
            <Text style={s.title}>{data.product.name}</Text>
            {data.product.image_url && (
              <Image source={{ uri: data.product.image_url }} style={s.image} />
            )}
            <Text>
              {data.product.code} · {data.product.finish}
            </Text>
            <Text>{data.product.description ?? ""}</Text>
            <Text>
              Presentación: {data.product.unit} · longitud:{" "}
              {data.product.length_mm ?? "No indicada"} mm
            </Text>
            <Text>
              Precio de catálogo: ${data.product.price} · disponible:{" "}
              {data.product.available}
            </Text>
            <Text>El precio definitivo se revisa en la cotización.</Text>
            {field("quantity", "Cantidad de esta presentación", {
              decimal: true,
            })}
            {field(
              "cutLengthMm",
              "Corte opcional en mm (no cambia la unidad vendida)",
              { decimal: true },
            )}
            {button("Agregar o actualizar en carrito", () =>
              perform(async () => add(data.product)),
            )}
            {!company &&
              button(
                "Guardar favorito",
                () => perform(() => client.favorite(data.product.id, true)),
                true,
              )}
            {!company &&
              button(
                "Quitar favorito",
                () =>
                  perform(async () => {
                    await client.favorite(data.product.id, false);
                    await load("favoritos");
                  }),
                true,
              )}
            {company &&
              button(
                "Editar producto",
                () => perform(() => editProduct(data.product)),
                true,
              )}
            {company &&
              button(
                "Inventario y movimientos",
                () =>
                  perform(async () => {
                    const movements = await client.movements(data.product.id);
                    setData({ product: data.product, movements });
                    setForm({
                      quantity: "",
                      reason: "",
                      stock: data.product.stock,
                    });
                    setScreen("inventario");
                  }),
                true,
              )}
          </>,
        )}
      {screen === "carrito" && (
        <View>
          <Text style={s.title}>Mi encargo</Text>
          {!cart.length && <Text>Tu carrito está vacío.</Text>}
          {cart.map((item) =>
            card(
              item.productId,
              <>
                <Text style={s.name}>{item.product.name}</Text>
                <Text>
                  ${item.product.price} por {item.product.unit}
                </Text>
                <Text>Cantidad</Text>
                <TextInput
                  accessibilityLabel={"Cantidad de " + item.product.name}
                  style={s.input}
                  value={item.quantity}
                  keyboardType="decimal-pad"
                  onChangeText={(value) =>
                    cartChange(
                      cart.map((i) =>
                        i.productId === item.productId
                          ? { ...i, quantity: value }
                          : i,
                      ),
                    )
                  }
                />
                <Text>Corte: {item.cutLengthMm ?? "Sin corte"} mm</Text>
                {button(
                  "Editar medida o cantidad",
                  () => perform(() => openProduct(item.productId)),
                  true,
                )}
                {button(
                  "Quitar " + item.product.code,
                  () =>
                    cartChange(
                      cart.filter((i) => i.productId !== item.productId),
                    ),
                  true,
                )}
              </>,
            ),
          )}
          <Text style={s.body}>
            La empresa revisará impuestos, entrega y precios antes de que
            aceptes la cotización.
          </Text>
          {cart.length > 0 &&
            button("Revisar solicitud", () => perform(checkoutScreen))}
          {button("Agregar materiales", () => go("catalogo"), true)}
        </View>
      )}
      {screen === "checkout" && (
        <View>
          <Text style={s.title}>Revisa tu encargo</Text>
          {company && (
            <View>
              <Text style={s.name}>Selecciona al cliente</Text>
              {data.customers?.map((c) =>
                button(
                  c.name,
                  () => {
                    setCheckout((x) => ({ ...x, customerId: String(c.id) }));
                    cartKey.current = randomUUID();
                  },
                  checkout.customerId !== String(c.id),
                ),
              )}
              {!data.customers?.length && (
                <Text>Primero registra un cliente.</Text>
              )}
            </View>
          )}
          {!company &&
            data.profile &&
            card(
              "contacto",
              <>
                <Text style={s.name}>Tus datos de contacto</Text>
                <Text>
                  {data.profile.name} · {data.profile.phone}
                </Text>
                <Text>{data.profile.email}</Text>
                {button("Corregir mis datos", () => go("perfil"), true)}
              </>,
            )}
          {["Recoger", "Entrega"].map((value) =>
            button(
              value === "Recoger" ? "Recoger en sucursal" : "Solicitar entrega",
              () => {
                setCheckout((x) => ({ ...x, fulfillment: value }));
                cartKey.current = randomUUID();
              },
              checkout.fulfillment !== value,
            ),
          )}
          {checkout.fulfillment === "Entrega" && (
            <TextInput
              accessibilityLabel="Dirección de entrega"
              placeholder="Dirección completa"
              style={s.input}
              maxLength={500}
              multiline
              value={checkout.deliveryAddress}
              onChangeText={(value) => {
                setCheckout((x) => ({ ...x, deliveryAddress: value }));
                cartKey.current = randomUUID();
              }}
            />
          )}
          <TextInput
            accessibilityLabel="Notas del encargo"
            placeholder="Indicaciones para la empresa"
            style={s.input}
            multiline
            maxLength={2000}
            value={checkout.notes}
            onChangeText={(value) => {
              setCheckout((x) => ({ ...x, notes: value }));
              cartKey.current = randomUUID();
            }}
          />
          {cart.map((i) => (
            <Text key={i.productId}>
              {i.quantity} × {i.product.name} ·{" "}
              {i.cutLengthMm ? i.cutLengthMm + " mm" : "sin corte"}
            </Text>
          ))}
          <Text>
            No se realizará ningún cobro al enviar. Revisa la cotización cuando
            la empresa responda.
          </Text>
          {button("Enviar solicitud", () => perform(submitOrder))}
          {button("Volver al carrito", () => setScreen("carrito"), true)}
        </View>
      )}
      {screen === "confirmacion" &&
        card(
          "confirmacion",
          <>
            <Text style={s.title}>¡Recibimos tu encargo!</Text>
            <Text>
              Solicitud #{data.orderId} guardada. La empresa puede consultarla
              en sus encargos y avisos.
            </Text>
            {button("Ver seguimiento", () =>
              perform(() => openOrder(data.orderId)),
            )}
            {button("Volver al inicio", () => go("inicio"), true)}
          </>,
        )}
      {screen === "encargos" && (
        <View>
          <Text style={s.title}>
            {company ? "Encargos de clientes" : "Mis encargos"}
          </Text>
          <View style={s.nav}>
            {statuses.map((value) =>
              button(
                value || "Todos",
                () => {
                  setFilter(value);
                  go("encargos", value);
                },
                filter !== value,
              ),
            )}
          </View>
          {!data.orders?.length && <Text>No hay encargos en este estado.</Text>}
          {data.orders?.map((o) =>
            card(
              o.id,
              <>
                <Text style={s.name}>Encargo #{o.id}</Text>
                <Text>
                  {o.customer_name} · {o.status}
                </Text>
                <Text>
                  {o.created_at} · {o.fulfillment}
                </Text>
                {o.total && <Text>Cotización: ${o.total}</Text>}
                {button("Ver detalle y seguimiento", () =>
                  perform(() => openOrder(o.id)),
                )}
              </>,
            ),
          )}
          {button("Actualizar encargos", () => go("encargos", filter), true)}
        </View>
      )}
      {screen === "encargo" && order && (
        <View>
          <Text style={s.title}>Encargo #{order.id}</Text>
          {card(
            "datos",
            <>
              <Text style={s.name}>{order.status}</Text>
              <Text>
                {order.customer_name} · {order.customer_phone}
              </Text>
              <Text>
                {order.fulfillment} ·{" "}
                {order.delivery_address ?? "Recogida en sucursal"}
              </Text>
              <Text>{order.notes ?? "Sin indicaciones adicionales"}</Text>
            </>,
          )}
          {data.items.map((i) =>
            card(
              i.id,
              <>
                <Text style={s.name}>{i.product_name}</Text>
                <Text>
                  {i.product_code} · {i.finish}
                </Text>
                <Text>
                  {i.quantity} × ${i.unit_price} · corte:{" "}
                  {i.cut_length_mm ?? "Sin corte"} mm
                </Text>
                {company &&
                  ["Solicitado", "Cotizado"].includes(order.status) &&
                  field("price" + i.id, "Precio unitario cotizado", {
                    decimal: true,
                  })}
              </>,
            ),
          )}
          {quote &&
            card(
              "cotizacion",
              <>
                <Text style={s.name}>Cotización · {quote.status}</Text>
                <Text>Subtotal: ${quote.subtotal}</Text>
                <Text>
                  Impuesto: ${quote.tax} · envío: ${quote.shipping}
                </Text>
                <Text style={s.name}>Total: ${quote.total}</Text>
                <Text>
                  Pagado: ${quote.paid} · saldo: ${quote.balance}
                </Text>
                {!company &&
                  order.status === "Cotizado" &&
                  button("Aceptar cotización y reservar material", () =>
                    confirm("Aceptar cotización", async () => {
                      await client.acceptQuote(order.id, quote.revision);
                      await openOrder(order.id);
                    }),
                  )}
              </>,
            )}
          {company &&
            ["Solicitado", "Cotizado"].includes(order.status) &&
            card(
              "cotizar",
              <>
                {field("taxRate", "Tasa de impuesto (0.1600 equivale a 16%)", {
                  decimal: true,
                })}
                {field("shipping", "Costo de envío", { decimal: true })}
                {button("Enviar cotización", () =>
                  confirm("Enviar cotización", async () => {
                    await client.quote(order.id, {
                      taxRate: form.taxRate,
                      shipping: form.shipping,
                      prices: data.items.map((i) => ({
                        itemId: String(i.id),
                        unitPrice: form["price" + i.id],
                      })),
                    });
                    await openOrder(order.id);
                  }),
                )}
              </>,
            )}
          {company &&
            order.user_id === null &&
            order.status === "Cotizado" &&
            quote &&
            button(
              "Registrar aceptación del cliente sin cuenta",
              () =>
                confirm(
                  "Registrar la aceptación que el cliente ya comunicó",
                  async () => {
                    await client.acceptQuote(order.id, quote.revision);
                    await openOrder(order.id);
                  },
                ),
              true,
            )}
          {company &&
            ["Confirmado", "Preparando", "Listo"].includes(order.status) &&
            button(
              {
                Confirmado: "Empezar preparación",
                Preparando: "Marcar listo",
                Listo: "Registrar entrega",
              }[order.status],
              () =>
                confirm("Actualizar encargo", async () => {
                  await client.orderStatus(
                    order.id,
                    {
                      Confirmado: "Preparando",
                      Preparando: "Listo",
                      Listo: "Entregado",
                    }[order.status],
                    "",
                  );
                  await openOrder(order.id);
                }),
            )}
          {((company && !["Entregado", "Cancelado"].includes(order.status)) ||
            (!company && ["Solicitado", "Cotizado"].includes(order.status))) &&
            button(
              "Cancelar encargo",
              () =>
                confirm("Cancelar encargo", async () => {
                  await client.orderStatus(
                    order.id,
                    "Cancelado",
                    "Cancelación solicitada desde la app",
                  );
                  await openOrder(order.id);
                }),
              true,
            )}
          {company &&
            quote &&
            ["Confirmado", "Preparando", "Listo", "Entregado"].includes(
              order.status,
            ) &&
            card(
              "pago",
              <>
                <Text style={s.name}>Registrar pago recibido</Text>
                <Text>
                  Registra únicamente un pago que ya recibiste. No se cobra
                  desde esta pantalla.
                </Text>
                {field("amount", "Importe recibido", { decimal: true })}
                {field("reference", "Referencia o comprobante", { max: 120 })}
                {button("Guardar pago", () =>
                  confirm("Registrar pago", async () => {
                    await client.payment(order.id, {
                      requestKey: payKey.current,
                      amount: form.amount ?? "",
                      reference: form.reference ?? "",
                    });
                    await openOrder(order.id);
                  }),
                )}
              </>,
            )}
          <Text style={s.name}>Historial y seguimiento</Text>
          {data.history.map((h, i) => (
            <Text key={i} style={s.body}>
              {h.status} · {h.created_at}
              {h.note ? "\n" + h.note : ""}
            </Text>
          ))}
          <Text style={s.name}>Pagos registrados</Text>
          {data.payments.map((p) => (
            <Text key={p.id}>
              ${p.amount} · {p.reference} · {p.created_at}
            </Text>
          ))}
          {button(
            "Actualizar seguimiento",
            () => perform(() => openOrder(order.id)),
            true,
          )}
          {button(
            "Compartir detalle",
            () =>
              perform(async () => {
                await Share.share({
                  message: `Aluformix — Encargo #${order.id}\nEstado: ${order.status}\n${data.items.map((i) => `${i.quantity} x ${i.product_name} (${i.product_code}) $${i.unit_price}`).join("\n")}\n${quote ? `Cotización: $${quote.total}, saldo $${quote.balance}` : "Pendiente de cotización"}`,
                });
              }),
            true,
          )}
          {button(
            "Repetir como nuevo encargo",
            () =>
              perform(async () => {
                const next = [];
                for (const i of data.items) {
                  const p = await client.product(i.product_id);
                  if (!Number(p.active))
                    throw new Error(
                      "Un material está desactivado. Revisa el catálogo.",
                    );
                  next.push({
                    productId: String(p.id),
                    quantity: i.quantity,
                    cutLengthMm: i.cut_length_mm,
                    product: p,
                  });
                }
                cartChange(next);
                setScreen("carrito");
              }),
            true,
          )}
        </View>
      )}
      {screen === "editarproducto" && (
        <View>
          <Text style={s.title}>
            {data.productId ? "Editar producto" : "Nuevo producto"}
          </Text>
          <Text style={s.name}>Categoría</Text>
          {data.categories?.map((c) =>
            button(
              c.name,
              () => change("categoryId", String(c.id)),
              form.categoryId !== String(c.id),
            ),
          )}
          {field("newCategory", "Crear categoría", { max: 80 })}
          {button(
            "Guardar categoría",
            () =>
              perform(async () => {
                await client.createCategory(form.newCategory ?? "");
                const categories = await client.categories();
                setData((d) => ({ ...d, categories }));
                change("newCategory", "");
              }),
            true,
          )}
          {field("code", "Código", { max: 40 })}
          {field("name", "Nombre", { max: 150 })}
          {field("description", "Descripción", { multiline: true, max: 4000 })}
          {field("unit", "Presentación vendida (barra, pieza, etc.)", {
            max: 30,
          })}
          {field("finish", "Acabado", { max: 60 })}
          {field("lengthMm", "Longitud en milímetros (opcional)", {
            decimal: true,
          })}
          {field("price", "Precio por presentación", { decimal: true })}
          {field("minimumStock", "Existencia mínima", { decimal: true })}
          {field("imageUrl", "URL HTTPS de la imagen", { max: 1000 })}
          {button(
            form.active ? "Activo: sí" : "Activo: no",
            () => change("active", !form.active),
            true,
          )}
          {button("Guardar producto", () =>
            perform(async () => {
              const { newCategory, ...body } = form;
              await client.saveProduct(data.productId, body);
              await load("catalogo");
            }),
          )}
        </View>
      )}
      {screen === "inventario" && data.product && (
        <View>
          <Text style={s.title}>{data.product.name}</Text>
          <Text>
            Existencias: {data.product.stock} · reservado:{" "}
            {data.product.reserved}
          </Text>
          {field("quantity", "Cantidad que ingresa", { decimal: true })}
          {field("reason", "Motivo", { max: 255 })}
          {button("Registrar entrada", () =>
            confirm("Entrada de inventario", async () => {
              await client.inventory(
                data.product.id,
                form.quantity ?? "",
                form.reason ?? "",
              );
              await openProduct(data.product.id);
            }),
          )}
          {admin && (
            <>
              {field("stock", "Existencia total después del ajuste", {
                decimal: true,
              })}
              {button(
                "Ajustar existencia total",
                () =>
                  confirm("Ajuste de inventario", async () => {
                    await client.adjustment(
                      data.product.id,
                      form.stock ?? "",
                      form.reason ?? "",
                    );
                    await openProduct(data.product.id);
                  }),
                true,
              )}
            </>
          )}
          <Text style={s.name}>Últimos movimientos</Text>
          {data.movements.map((m) =>
            card(
              m.id,
              <>
                <Text>
                  {m.type} · {m.quantity}
                </Text>
                <Text>
                  {m.reason} · {m.created_at}
                </Text>
              </>,
            ),
          )}
        </View>
      )}
      {screen === "clientes" && (
        <View>
          <Text style={s.title}>Clientes</Text>
          {field("customerName", "Nombre", { max: 120 })}
          {field("customerPhone", "Teléfono", { max: 25 })}
          {button("Guardar cliente", () =>
            perform(async () => {
              await client.createCustomer(
                form.customerName ?? "",
                form.customerPhone ?? "",
              );
              setForm({});
              await load("clientes");
            }),
          )}
          {data.customers?.map((c) =>
            card(
              c.id,
              <>
                <Text style={s.name}>{c.name}</Text>
                <Text>{c.phone}</Text>
                {button(
                  "Preparar encargo para este cliente",
                  () => {
                    setCheckout((x) => ({ ...x, customerId: String(c.id) }));
                    go("catalogo");
                  },
                  true,
                )}
              </>,
            ),
          )}
        </View>
      )}
      {screen === "notificaciones" && (
        <View>
          <Text style={s.title}>Notificaciones</Text>
          <Text>
            Los avisos internos se actualizan al abrir esta pantalla o pulsar
            Actualizar. Para avisos con la app cerrada se requiere una
            instalación propia con notificaciones configuradas.
          </Text>
          {button(
            "Activar avisos en este teléfono",
            () =>
              perform(async () => {
                await registerPush(client);
                Alert.alert(
                  "Registro completado",
                  "El dispositivo quedó registrado. La entrega depende de los permisos, conexión y configuración de Android o iOS.",
                );
              }),
            true,
          )}
          {button(
            "Desactivar avisos en este teléfono",
            () =>
              perform(async () => {
                await disablePush(client);
                Alert.alert(
                  "Avisos desactivados",
                  "Puedes seguir consultando los avisos dentro de la app.",
                );
              }),
            true,
          )}
          {!data.notifications?.length && <Text>No hay notificaciones.</Text>}
          {data.notifications?.map((n) =>
            card(
              n.id,
              <>
                <Text style={s.name}>{n.read_at ? "Leída" : "Nueva"}</Text>
                <Text>{n.message}</Text>
                <Text>{n.created_at}</Text>
                {n.order_id &&
                  button("Ver encargo", () =>
                    perform(async () => {
                      await client.readNotification(n.id);
                      await openOrder(n.order_id);
                    }),
                  )}
                {!n.read_at &&
                  button(
                    "Marcar leída",
                    () =>
                      perform(async () => {
                        await client.readNotification(n.id);
                        await load("notificaciones");
                      }),
                    true,
                  )}
              </>,
            ),
          )}
          {button("Actualizar", () => go("notificaciones"), true)}
        </View>
      )}
      {screen === "perfil" && (
        <View>
          <Text style={s.title}>Mi perfil</Text>
          <Text>
            {user.email} · {user.role}
          </Text>
          {field("name", "Nombre", { max: 120 })}
          {!company && (
            <>
              {field("phone", "Teléfono", { max: 25 })}
              {field("businessName", "Nombre del taller o negocio", {
                max: 160,
              })}
              {field("taxId", "RFC (opcional)", { max: 13 })}
              {field("address", "Dirección", { multiline: true, max: 500 })}
            </>
          )}
          {button("Guardar perfil", () =>
            perform(async () => {
              await client.saveProfile(form);
              onUser({ ...user, name: form.name });
              await load("perfil");
            }),
          )}
          {button("Cambiar contraseña", onPassword, true)}
          {button("Cerrar sesión", () => onLogout(false), true)}
          {button(
            "Cerrar todas mis sesiones",
            () =>
              Alert.alert(
                "Cerrar todas mis sesiones",
                "Se cerrará el acceso en todos tus dispositivos.",
                [
                  { text: "Volver", style: "cancel" },
                  { text: "Cerrar todas", onPress: () => onLogout(true) },
                ],
              ),
            true,
          )}
          {button("Ayuda", () => setScreen("ayuda"), true)}
        </View>
      )}
      {screen === "empresa" && admin && (
        <View>
          <Text style={s.title}>Configuración de la empresa</Text>
          {field("name", "Nombre comercial", { max: 160 })}
          {field("phone", "Teléfono", { max: 25 })}
          {field("address", "Dirección de la sucursal", { max: 500 })}
          {field("taxRate", "Tasa de impuesto (0.1600 = 16%)", {
            decimal: true,
          })}
          {button("Guardar configuración", () =>
            perform(async () => {
              await client.saveCompany(form);
              await load("inicio");
            }),
          )}
        </View>
      )}
      {screen === "personal" && admin && (
        <View>
          <Text style={s.title}>Crear cuenta de personal</Text>
          {field("name", "Nombre", { max: 120 })}
          {field("email", "Correo", { max: 254 })}
          {field("password", "Contraseña inicial de 12 a 128 caracteres", {
            secret: true,
            max: 128,
          })}
          {["Operador", "Administrador"].map((role) =>
            button(role, () => change("role", role), form.role !== role),
          )}
          {button("Crear cuenta", () =>
            perform(async () => {
              await client.createStaff(form);
              setForm({});
              await load("inicio");
            }),
          )}
        </View>
      )}
      {screen === "camara" && (
        <Scanner
          onClose={() => go("inicio")}
          onManual={() => go("catalogo")}
          onScan={(value) => {
            setSearch(value);
            setCategory("");
            go("catalogo", value);
          }}
        />
      )}
      {screen === "ia" && (
        <View>
          <Text style={s.title}>Asistente de materiales</Text>
          <Text>
            Tu pregunta y hasta 50 materiales del catálogo se envían a Gemini.
            Evita incluir datos personales. La IA solo da orientación; no cambia
            encargos.
          </Text>
          {field("question", "¿Qué material necesitas?", {
            multiline: true,
            max: 1000,
          })}
          {button("Consultar IA", () =>
            perform(async () => {
              const result = await client.assistant(form.question ?? "");
              setAnswer(result.answer + "\n\n" + result.warning);
            }),
          )}
          {!!answer &&
            card(
              "respuesta",
              <Text selectable style={s.body}>
                {answer}
              </Text>,
            )}
        </View>
      )}
      {screen === "ayuda" && (
        <View>
          <Text style={s.title}>Ayuda</Text>
          {help.map(([title, body]) =>
            card(
              title,
              <>
                <Text style={s.name}>{title}</Text>
                <Text style={s.body}>{body}</Text>
              </>,
            ),
          )}
          {button(
            "Consultar sucursal",
            () =>
              perform(async () => {
                const settings = await client.company();
                setData({ company: settings });
                setScreen("contacto");
              }),
            true,
          )}
        </View>
      )}
      {screen === "contacto" &&
        card(
          "contacto",
          <>
            <Text style={s.title}>{data.company?.name ?? "Sucursal"}</Text>
            <Text>
              {data.company?.phone ?? "Teléfono pendiente de configurar"}
            </Text>
            <Text>
              {data.company?.address ?? "Dirección pendiente de configurar"}
            </Text>
          </>,
        )}
    </View>
  );
}
const s = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#102c46",
    marginVertical: 16,
  },
  name: { fontSize: 18, fontWeight: "700", color: "#102c46" },
  body: { fontSize: 15, lineHeight: 23, color: "#334f68", marginVertical: 8 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334f68",
    marginTop: 8,
    marginBottom: 5,
  },
  input: {
    backgroundColor: "white",
    borderColor: "#bdcee0",
    borderWidth: 1,
    borderRadius: 10,
    padding: 13,
    fontSize: 16,
    color: "#102c46",
    minHeight: 50,
    marginBottom: 8,
  },
  card: {
    backgroundColor: "white",
    borderColor: "#dce7f2",
    borderWidth: 1,
    borderRadius: 15,
    padding: 16,
    gap: 8,
    marginVertical: 8,
  },
  button: {
    backgroundColor: "#007bff",
    borderRadius: 11,
    padding: 13,
    alignItems: "center",
    marginVertical: 5,
  },
  buttonText: { color: "white", fontSize: 15, fontWeight: "700" },
  secondary: { backgroundColor: "#e8f2ff" },
  secondaryText: { color: "#0066cc" },
  nav: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 12 },
  image: {
    height: 180,
    width: "100%",
    resizeMode: "contain",
    borderRadius: 10,
    backgroundColor: "#edf3f7",
  },
});
