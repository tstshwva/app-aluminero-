import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  AppState,
  Image,
  ScrollView,
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
const icons = {
  home: require("../assets/icon-home.png"),
  search: require("../assets/icon-search.png"),
  inventory: require("../assets/icon-inventory.png"),
  orders: require("../assets/icon-orders.png"),
  more: require("../assets/icon-more.png"),
  profile: require("../assets/icon-profile.png"),
  menu: require("../assets/icon-menu.png"),
  back: require("../assets/icon-back.png"),
  bell: require("../assets/icon-bell.png"),
  camera: require("../assets/icon-camera.png"),
  cart: require("../assets/icon-cart.png"),
  arrow: require("../assets/icon-arrow.png"),
};
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
function estimateCents(price, quantity) {
  const unit = String(price).match(/^(\d{1,12})(?:\.(\d{1,2}))?$/);
  const units = String(quantity).match(/^(\d{1,9})(?:\.(\d{1,3}))?$/);
  if (!unit || !units) return null;
  const cents = BigInt(unit[1] + (unit[2] ?? "").padEnd(2, "0"));
  const thousandths = BigInt(units[1] + (units[2] ?? "").padEnd(3, "0"));
  return (cents * thousandths + 500n) / 1000n;
}

function displayCents(value) {
  return (
    "$" +
    (value / 100n).toString() +
    "." +
    (value % 100n).toString().padStart(2, "0")
  );
}

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
  message,
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
    [answer, setAnswer] = useState(""),
    [orderView, setOrderView] = useState(""),
    [profileEditing, setProfileEditing] = useState(false),
    [customerSearch, setCustomerSearch] = useState(""),
    [customerAdding, setCustomerAdding] = useState(false),
    [inventoryMode, setInventoryMode] = useState("movimientos");
  const cartKey = useRef(randomUUID()),
    payKey = useRef(randomUUID()),
    alive = useRef(true);
  const lineEstimates = cart.map(({ product, quantity }) =>
    estimateCents(product.price, quantity),
  );
  const estimate = lineEstimates.every((value) => value !== null)
    ? lineEstimates.reduce((total, value) => total + value, 0n)
    : null;
  const change = (name, value) => setForm((f) => ({ ...f, [name]: value }));
  const cartChange = (items) => {
    setCart(items);
    cartKey.current = randomUUID();
  };
  const changeQuantity = (productId, quantity) =>
    cartChange(
      cart.map((item) =>
        item.productId === productId ? { ...item, quantity } : item,
      ),
    );
  const nudgeQuantity = (item, step) => {
    const current = Number(item.quantity);
    const scaled = Number.isFinite(current) ? Math.round(current * 1000) : 1000;
    const next = Math.min(999999999999, Math.max(1, scaled + step * 1000));
    changeQuantity(item.productId, String(next / 1000));
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
  const button = (label, action, secondary = false, layout) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      disabled={busy}
      onPress={action}
      style={[
        s.button,
        secondary && s.secondary,
        layout,
        busy && { opacity: 0.5 },
      ]}
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
        ? {
            dashboard: await client.dashboard(),
            recent: (await client.orders()).slice(0, 3),
          }
        : { products: (await client.products()).slice(0, 4) };
    if (next === "stockbajo") {
      const [dashboard, products] = await Promise.all([
        client.dashboard(),
        client.products(),
      ]);
      const lowIds = new Set(dashboard.lowStock.map((p) => String(p.id)));
      result = { products: products.filter((p) => lowIds.has(String(p.id))) };
    }
    if (next === "entregas") {
      const orders = await client.orders();
      result = {
        orders: orders.filter((o) =>
          ["Confirmado", "Preparando", "Listo", "Entregado"].includes(o.status),
        ),
      };
    }
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
    if (next === "clientes") {
      setCustomerAdding(false);
      setForm({});
      result = { customers: await client.customers() };
    }
    if (next === "actividad") result = { orders: await client.orders() };
    if (next === "perfil") {
      setProfileEditing(false);
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
    const item = cart.find((i) => String(i.productId) === String(productId));
    setForm({
      quantity: item?.quantity ?? "1",
      cutLengthMm: item?.cutLengthMm ?? "",
    });
    setScreen("producto");
  }
  async function openOrder(
    orderId,
    view = company ? "detalle" : "seguimiento",
  ) {
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
    setOrderView(view);
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
  async function openInventory(mode) {
    const product = data.product;
    const movements =
      mode === "movimientos" ? await client.movements(product.id) : [];
    setData({ product, movements });
    setForm({ quantity: "", reason: "", stock: product.stock });
    setInventoryMode(mode);
    setScreen("inventario");
  }
  async function openCustomer(customer) {
    const orders = await client.orders();
    setData({
      customer,
      orders: orders.filter(
        (o) => String(o.customer_id) === String(customer.id),
      ),
    });
    setScreen("cliente");
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
  const activeTab = [
    "producto",
    "favoritos",
    "stockbajo",
    "editarproducto",
    "inventario",
  ].includes(screen)
    ? "catalogo"
    : ["encargo", "confirmacion", "entregas"].includes(screen)
      ? "encargos"
      : ["carrito", "checkout"].includes(screen)
        ? ""
        : ["empresa", "personal", "clientes", "cliente", "actividad"].includes(
              screen,
            )
          ? "mas"
          : screen;
  const tabs = [
    ["Inicio", "inicio", "home"],
    [
      company ? "Inventario" : "Catálogo",
      "catalogo",
      company ? "inventory" : "search",
    ],
    ["Encargos", "encargos", company ? "cart" : "orders"],
    [
      company ? "Más" : "Perfil",
      company ? "mas" : "perfil",
      company ? "more" : "profile",
    ],
  ];
  const openCart = () => {
    setForm({});
    setScreen("carrito");
  };
  const openAssistant = () => {
    setForm({ question: "" });
    setAnswer("");
    setScreen("ia");
  };
  const openCamera = () => setScreen("camara");
  const back = () => {
    if (screen === "checkout") return setScreen("carrito");
    if (screen === "cliente") return go("clientes");
    if (screen === "encargo" && orderView === "cotizacion")
      return setOrderView(company ? "detalle" : "seguimiento");
    if (screen === "encargo" && orderView && orderView !== "detalle" && company)
      return setOrderView("detalle");
    if (screen === "encargo") return go("encargos", filter);
    if (
      [
        "producto",
        "favoritos",
        "stockbajo",
        "editarproducto",
        "inventario",
      ].includes(screen)
    )
      return go("catalogo", search);
    if (
      company &&
      [
        "empresa",
        "personal",
        "clientes",
        "entregas",
        "ayuda",
        "camara",
        "ia",
      ].includes(screen)
    )
      return go("mas");
    go("inicio");
  };
  const heading = (title, subtitle) => (
    <View style={s.heading}>
      <Text style={s.title}>{title}</Text>
      {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
    </View>
  );
  const iconButton = (label, icon, action, badge) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={action}
      style={s.iconButton}
    >
      <Image source={icons[icon]} style={s.icon} />
      {!!badge && <Text style={s.badge}>{badge}</Text>}
    </Pressable>
  );
  const menuRow = (label, detail, action, key = label) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      disabled={busy}
      onPress={action}
      style={s.menuRow}
    >
      <View style={s.grow}>
        <Text style={s.name}>{label}</Text>
        {!!detail && <Text style={s.subtitle}>{detail}</Text>}
      </View>
      <Text style={s.arrow}>›</Text>
    </Pressable>
  );
  const metric = (label, value, action) => (
    <Pressable
      key={label}
      accessibilityRole={action ? "button" : undefined}
      onPress={action}
      disabled={!action || busy}
      style={s.metric}
    >
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </Pressable>
  );
  const productImage = (p, large = false) =>
    p.image_url ? (
      <Image
        accessibilityLabel={p.name}
        source={{ uri: p.image_url }}
        style={large ? s.image : s.thumb}
      />
    ) : (
      <View style={[large ? s.image : s.thumb, s.placeholder]}>
        <View style={large ? s.placeholderLarge : s.placeholderIcon} />
        {large && <Text style={s.subtitle}>Sin imagen registrada</Text>}
      </View>
    );
  const productRow = (p) => (
    <Pressable
      key={p.id}
      accessibilityRole="button"
      accessibilityLabel={"Ver " + p.code}
      disabled={busy}
      onPress={() => perform(() => openProduct(p.id))}
      style={s.productRow}
    >
      {productImage(p)}
      <View style={s.grow}>
        <Text style={s.name}>{p.name}</Text>
        <Text style={s.subtitle}>
          {p.code} · {p.unit} · {p.finish}
        </Text>
        {company && <Text style={s.tag}>{p.available} disponibles</Text>}
        <Text style={s.priceSmall}>
          ${p.price} {company ? "sin IVA" : "estimado"}
        </Text>
        {!Number(p.active) && <Text style={s.subtitle}>Desactivado</Text>}
      </View>
      <Text style={s.arrow}>›</Text>
    </Pressable>
  );
  const searchCatalog = () => {
    setCategory("");
    go("catalogo", search);
  };
  const searchBar = (placeholder) => (
    <View style={s.search}>
      <Image source={icons.search} style={s.icon} />
      <TextInput
        accessibilityLabel="Buscar producto"
        placeholder={placeholder}
        placeholderTextColor="#526b82"
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={searchCatalog}
        maxLength={150}
        returnKeyType="search"
        style={s.searchInput}
      />
      {iconButton("Buscar", "arrow", searchCatalog)}
    </View>
  );
  const count = (states) =>
    data.dashboard
      ? data.dashboard.orders
          .filter((o) => states.includes(o.status))
          .reduce((total, o) => total + Number(o.count), 0)
      : "–";
  const goOrders = (value = "") => {
    setFilter(value);
    go("encargos", value);
  };
  return (
    <View style={s.shell}>
      <View style={s.header}>
        <View style={s.headerSide}>
          {screen !== "inicio" ? (
            iconButton("Atrás", "back", back)
          ) : company ? (
            <Image
              source={require("../assets/aluformix-logo.png")}
              style={s.logo}
            />
          ) : (
            iconButton("Menú", "menu", () => go("mas"))
          )}
        </View>
        <View style={s.brand}>
          {!company && (
            <Image
              source={require("../assets/aluformix-logo.png")}
              style={s.logo}
            />
          )}
          <View>
            <Text style={s.brandName}>ALUFORMIX</Text>
            {company && <Text style={s.brandRole}>EMPRESA</Text>}
          </View>
        </View>
        <View style={[s.headerSide, s.headerActions]}>
          {iconButton("Notificaciones", "bell", () => go("notificaciones"))}
          {!company && iconButton("Escanear código", "camera", openCamera)}
          {!company && iconButton("Mi encargo", "cart", openCart, cart.length)}
        </View>
      </View>
      {busy && <ActivityIndicator color="#007bff" />}
      <ScrollView
        key={screen}
        style={s.grow}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        {!!message && (
          <Text accessibilityLiveRegion="polite" style={s.notice}>
            {message}
          </Text>
        )}
        {screen === "inicio" && (
          <View>
            {heading(
              (company ? "Buenos días, " : "Hola, ") +
                user.name.split(/\s+/)[0],
              company
                ? "Tu distribuidora, al día."
                : "¿Qué materiales necesitas hoy?",
            )}
            {company && (
              <>
                <Text style={s.tag}>{user.role}</Text>
                <View style={s.metrics}>
                  {metric("Encargos nuevos", count(["Solicitado"]), () =>
                    goOrders("Solicitado"),
                  )}
                  {metric(
                    "Stock bajo",
                    data.dashboard?.lowStock.length ?? "–",
                    () => go("stockbajo"),
                  )}
                  {metric("Por entregar", count(["Listo"]), () =>
                    go("entregas"),
                  )}
                </View>
              </>
            )}
            <View style={s.hero}>
              <Image
                source={require("../assets/hero-gradient.png")}
                style={s.heroBackground}
              />
              <Text style={s.heroKicker}>
                {company
                  ? "DEL ENCARGO A LA ENTREGA"
                  : "PERFILES · HERRAJES · ACCESORIOS"}
              </Text>
              <Text style={s.heroTitle}>
                {company
                  ? "Todo tu negocio,\nen un solo lugar."
                  : "Tu siguiente proyecto\nempieza aquí."}
              </Text>
              {!company && (
                <Text style={s.heroDetail}>
                  Arma tu encargo y solicita confirmación de la distribuidora.
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => (company ? goOrders() : go("catalogo"))}
                style={[s.heroButton, company && s.heroButtonCompany]}
              >
                <Text style={s.secondaryText}>
                  {company ? "Revisar encargos" : "Explorar catálogo"}
                </Text>
                <Text style={s.arrow}>→</Text>
              </Pressable>
            </View>
            {company ? (
              <>
                <Text style={s.sectionTitle}>Accesos rápidos</Text>
                <View style={s.quickRow}>
                  {button("Inventario", () => go("catalogo"), true, s.grow)}
                  {button("Nuevo encargo", openCart, true, s.grow)}
                </View>
                <View style={s.quickRow}>
                  {button("Clientes", () => go("clientes"), true, s.grow)}
                  {button("Escanear código", openCamera, true, s.grow)}
                </View>
                <Text style={s.sectionTitle}>Actividad reciente</Text>
                {data.recent?.map((o) =>
                  menuRow(
                    "Encargo #" + o.id + " · " + o.customer_name,
                    o.status,
                    () => perform(() => openOrder(o.id)),
                  ),
                )}
                {!data.recent?.length && (
                  <Text style={s.body}>Aún no hay encargos recientes.</Text>
                )}
              </>
            ) : (
              <>
                {searchBar("Buscar por nombre o código")}
                <Text style={s.sectionTitle}>Materiales para tu taller</Text>
                {data.products?.map(productRow)}
                {!data.products?.length && (
                  <Text style={s.body}>Aún no hay materiales publicados.</Text>
                )}
              </>
            )}
            {button("Asistente de materiales", openAssistant, true)}
          </View>
        )}
        {screen === "mas" && (
          <View>
            {heading(
              company ? "Mi distribuidora" : "Mi cuenta",
              "Herramientas y configuración.",
            )}
            <View style={s.hero}>
              <Image
                source={require("../assets/hero-gradient.png")}
                style={s.heroBackground}
              />
              <Text style={s.heroTitle}>Aluformix</Text>
              <Text style={s.heroDetail}>
                {user.name} · {user.role}
              </Text>
            </View>
            {company ? (
              <>
                {menuRow("Clientes", "Contactos y encargos", () =>
                  go("clientes"),
                )}
                {menuRow(
                  "Entregas",
                  "Material confirmado, listo o entregado",
                  () => go("entregas"),
                )}
                {menuRow(
                  "Productos por agotarse",
                  "Existencias por debajo del mínimo",
                  () => go("stockbajo"),
                )}
                {menuRow("Actividad reciente", "Últimos encargos", () =>
                  go("actividad"),
                )}
                {admin &&
                  menuRow("Configuración", "Negocio e impuestos", () =>
                    go("empresa"),
                  )}
                {admin &&
                  menuRow(
                    "Usuarios y permisos",
                    "Crear cuentas de personal",
                    () => {
                      setForm({ role: "Operador" });
                      setScreen("personal");
                    },
                  )}
              </>
            ) : (
              menuRow("Mis favoritos", "Materiales guardados", () =>
                go("favoritos"),
              )
            )}
            {menuRow(
              "Escanear código",
              "Lectura de código QR o de barras",
              openCamera,
            )}
            {menuRow(
              "Asistente de materiales",
              "Orientación sobre el catálogo",
              openAssistant,
            )}
            {menuRow("Mi perfil", "Datos de la cuenta y seguridad", () =>
              go("perfil"),
            )}
            {menuRow("Ayuda", "Cómo usar Aluformix", () => go("ayuda"))}
          </View>
        )}
        {["catalogo", "favoritos", "stockbajo"].includes(screen) && (
          <View>
            {heading(
              screen === "favoritos"
                ? "Mis favoritos"
                : screen === "stockbajo"
                  ? "Productos por agotarse"
                  : company
                    ? "Inventario"
                    : "Catálogo",
              screen === "stockbajo"
                ? "Material disponible por debajo del mínimo."
                : company
                  ? "Existencia física y material reservado."
                  : "Perfiles, herrajes y accesorios para tu taller.",
            )}
            {screen === "catalogo" && (
              <>
                {searchBar(
                  company
                    ? "Buscar producto o código"
                    : "Nombre o código del material",
                )}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.chips}
                >
                  {button("Todos", () => setCategory(""), Boolean(category))}
                  {data.categories?.map((c) =>
                    button(
                      c.name,
                      () => setCategory(String(c.id)),
                      category !== String(c.id),
                    ),
                  )}
                </ScrollView>
                {!company && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => go("favoritos")}
                    style={s.link}
                  >
                    <Text style={s.secondaryText}>♡ Ver favoritos</Text>
                  </Pressable>
                )}
              </>
            )}
            {data.products
              ?.filter(
                (p) =>
                  screen !== "catalogo" ||
                  !category ||
                  String(p.category_id) === category,
              )
              .map(productRow)}
            {!data.products?.some(
              (p) =>
                screen !== "catalogo" ||
                !category ||
                String(p.category_id) === category,
            ) && <Text style={s.body}>No hay materiales para mostrar.</Text>}
            {company &&
              screen === "catalogo" &&
              button("Nuevo producto", () => perform(() => editProduct(null)))}
            {screen === "stockbajo" &&
              button("Ver inventario", () => go("catalogo"), true)}
          </View>
        )}
        {screen === "producto" && data.product && (
          <View style={s.productDetail}>
            {productImage(data.product, true)}
            {heading(
              data.product.name,
              data.product.code +
                " · " +
                data.product.unit +
                " · " +
                data.product.finish,
            )}
            {company && (
              <View style={s.metrics}>
                {metric("Físicas", data.product.stock ?? "–")}
                {metric("Reservadas", data.product.reserved ?? "–")}
                {metric("Disponibles", data.product.available ?? "–")}
              </View>
            )}
            <Text style={s.price}>${data.product.price}</Text>
            <Text>{data.product.description ?? ""}</Text>
            <Text>
              Presentación: {data.product.unit} · longitud:{" "}
              {data.product.length_mm ?? "No indicada"} mm
            </Text>
            {!company && (
              <Text style={s.notice}>
                El precio definitivo se revisa en la cotización.
              </Text>
            )}
            {field("quantity", "Cantidad de esta presentación", {
              decimal: true,
            })}
            {field(
              "cutLengthMm",
              "Corte opcional en mm (no cambia la unidad vendida)",
              { decimal: true },
            )}
            {button("Agregar al encargo", () =>
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
            {company && (
              <>
                {button("Registrar entrada", () =>
                  perform(() => openInventory("entrada")),
                )}
                {admin &&
                  button(
                    "Ajustar existencia física",
                    () => perform(() => openInventory("ajuste")),
                    true,
                  )}
                {button(
                  "Ver movimientos",
                  () => perform(() => openInventory("movimientos")),
                  true,
                )}
              </>
            )}
          </View>
        )}
        {screen === "carrito" && (
          <View>
            {heading(
              "Mi encargo",
              "Revisa los materiales y las cantidades solicitadas.",
            )}
            {!cart.length && <Text>Tu carrito está vacío.</Text>}
            {cart.map((item, index) =>
              card(
                item.productId,
                <>
                  <View style={s.summaryRow}>
                    {productImage(item.product)}
                    <View style={s.grow}>
                      <Text style={s.name}>{item.product.name}</Text>
                      <Text style={s.subtitle}>
                        {item.product.unit} · {item.product.finish}
                      </Text>
                      <View style={s.stepper}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={"Reducir " + item.product.name}
                          onPress={() => nudgeQuantity(item, -1)}
                          disabled={busy}
                          style={s.step}
                        >
                          <Text style={s.secondaryText}>−</Text>
                        </Pressable>
                        <TextInput
                          accessibilityLabel={
                            "Cantidad de " + item.product.name
                          }
                          style={s.stepInput}
                          keyboardType="decimal-pad"
                          maxLength={13}
                          editable={!busy}
                          value={item.quantity}
                          onChangeText={(value) =>
                            changeQuantity(item.productId, value)
                          }
                        />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={"Aumentar " + item.product.name}
                          onPress={() => nudgeQuantity(item, 1)}
                          disabled={busy}
                          style={s.step}
                        >
                          <Text style={s.secondaryText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={"Quitar " + item.product.code}
                      disabled={busy}
                      onPress={() =>
                        cartChange(
                          cart.filter(
                            (row) => row.productId !== item.productId,
                          ),
                        )
                      }
                      style={s.step}
                    >
                      <Text style={s.name}>×</Text>
                    </Pressable>
                  </View>
                  <View style={s.amountRow}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => perform(() => openProduct(item.productId))}
                    >
                      <Text style={s.secondaryText}>
                        {item.cutLengthMm
                          ? "Corte: " + item.cutLengthMm + " mm"
                          : "Editar medida o cantidad"}
                      </Text>
                    </Pressable>
                    {lineEstimates[index] !== null && (
                      <Text style={s.name}>
                        {displayCents(lineEstimates[index])}
                      </Text>
                    )}
                  </View>
                </>,
              ),
            )}
            {cart.length > 0 && estimate !== null && (
              <View style={s.amountRow}>
                <Text style={s.name}>Total estimado</Text>
                <Text style={s.name}>{displayCents(estimate)}</Text>
              </View>
            )}
            {cart.length > 0 && (
              <Text style={s.notice}>
                La empresa confirmará los precios, impuestos y entrega en la
                cotización.
              </Text>
            )}
            {cart.length > 0 &&
              button("Revisar solicitud", () => perform(checkoutScreen))}
            {button("Agregar materiales", () => go("catalogo"), true)}
          </View>
        )}
        {screen === "checkout" && (
          <View>
            {heading("Revisa tu encargo", "Elige cómo recibir tus materiales.")}
            <View style={s.quickRow}>
              {["Recoger", "Entrega"].map((value) =>
                button(
                  value === "Recoger"
                    ? "Recoger en sucursal"
                    : "Solicitar entrega",
                  () => {
                    setCheckout((x) => ({ ...x, fulfillment: value }));
                    cartKey.current = randomUUID();
                  },
                  checkout.fulfillment !== value,
                  s.grow,
                ),
              )}
            </View>
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
                  {[
                    ["Nombre o contacto", data.profile.name],
                    ["Teléfono de contacto", data.profile.phone],
                    ["Taller o negocio", data.profile.business_name],
                  ].map(([label, value]) => (
                    <View key={label}>
                      <Text style={s.label}>{label}</Text>
                      <Text style={s.fieldRead}>
                        {value || "Sin registrar"}
                      </Text>
                    </View>
                  ))}
                  {button("Corregir mis datos", () => go("perfil"), true)}
                </>,
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
            {checkout.fulfillment === "Recoger" &&
              card(
                "recoger",
                <>
                  <Text style={s.name}>Recoger en sucursal</Text>
                  <Text style={s.subtitle}>
                    {data.company?.address ||
                      "La distribuidora confirmará la sucursal y el horario."}
                  </Text>
                </>,
              )}
            {card(
              "resumen",
              <>
                <Text style={s.name}>Resumen</Text>
                {cart.map((i) => (
                  <View key={i.productId} style={s.amountRow}>
                    <View style={s.grow}>
                      <Text>
                        {i.quantity} × {i.product.name}
                      </Text>
                      <Text style={s.subtitle}>
                        {i.product.finish}
                        {i.cutLengthMm ? " · " + i.cutLengthMm + " mm" : ""}
                      </Text>
                    </View>
                  </View>
                ))}
              </>,
            )}
            <Text style={s.notice}>
              Enviar un encargo no realiza un pago. La distribuidora confirmará
              precios y existencias.
            </Text>
            {button("Enviar solicitud", () => perform(submitOrder))}
            {button("Volver al carrito", () => setScreen("carrito"), true)}
          </View>
        )}
        {screen === "confirmacion" &&
          card(
            "confirmacion",
            <>
              <View style={s.success}>
                <Text style={s.successMark}>✓</Text>
              </View>
              <Text style={[s.title, s.center]}>¡Recibimos tu encargo!</Text>
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
        {["encargos", "entregas"].includes(screen) && (
          <View>
            {heading(
              screen === "entregas"
                ? "Entregas"
                : company
                  ? "Encargos"
                  : "Mis encargos",
              screen === "entregas"
                ? "Material confirmado, listo o entregado."
                : "Consulta solicitudes y cotizaciones.",
            )}
            {screen === "encargos" && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.chips}
              >
                {statuses.map((value) =>
                  button(
                    value || "Todos",
                    () => goOrders(value),
                    filter !== value,
                  ),
                )}
              </ScrollView>
            )}
            {!data.orders?.length && (
              <Text style={s.body}>No hay encargos en esta vista.</Text>
            )}
            {data.orders?.map((o) => (
              <Pressable
                key={o.id}
                accessibilityRole="button"
                accessibilityLabel="Ver detalle y seguimiento"
                style={s.menuRow}
                onPress={() => perform(() => openOrder(o.id))}
                disabled={busy}
              >
                <View style={s.grow}>
                  <Text style={s.name}>
                    Encargo #{o.id} · {o.customer_name}
                  </Text>
                  <Text style={s.subtitle}>{o.fulfillment}</Text>
                  <Text style={s.tag}>{o.status}</Text>
                </View>
                <Text style={s.arrow}>›</Text>
              </Pressable>
            ))}
            {button(
              company ? "Crear encargo manual" : "Crear nuevo encargo",
              () => go("catalogo"),
              true,
            )}
            {button(
              "Actualizar encargos",
              () => (screen === "entregas" ? go("entregas") : goOrders(filter)),
              true,
            )}
          </View>
        )}
        {screen === "encargo" && order && (
          <View>
            {heading(
              orderView === "cotizacion"
                ? "Cotización"
                : company
                  ? "Encargo #" + order.id
                  : orderView === "detalle"
                    ? "Detalle del encargo"
                    : "Mi encargo",
              [!company && "Encargo #" + order.id, order.customer_name]
                .filter(Boolean)
                .join(" · "),
            )}
            {quote &&
              orderView !== "cotizacion" &&
              button("Ver cotización", () => setOrderView("cotizacion"), true)}
            {orderView === "cotizacion" &&
              button(
                "Volver al encargo",
                () => setOrderView(company ? "detalle" : "seguimiento"),
                true,
              )}
            {!company && orderView !== "cotizacion" && (
              <View style={s.quickRow}>
                {button(
                  "Seguimiento",
                  () => setOrderView("seguimiento"),
                  orderView !== "seguimiento",
                )}
                {button(
                  "Ver detalle del encargo",
                  () => setOrderView("detalle"),
                  orderView !== "detalle",
                )}
              </View>
            )}
            {!company &&
              orderView === "seguimiento" &&
              order.status !== "Cancelado" && (
                <>
                  <Text style={s.tag}>{order.status}</Text>
                  {[
                    "Solicitado",
                    "Cotizado",
                    "Confirmado",
                    "Preparando",
                    "Listo",
                    "Entregado",
                  ].map((state, index, steps) => {
                    const current = steps.indexOf(order.status);
                    return (
                      <View key={state} style={s.timelineRow}>
                        <View
                          style={[
                            s.dot,
                            current > index && s.dotDone,
                            current === index && s.dotCurrent,
                          ]}
                        />
                        <View style={s.grow}>
                          <Text style={s.name}>
                            {
                              [
                                "Solicitud recibida",
                                "Cotización disponible",
                                "Material confirmado",
                                "Preparando materiales",
                                "Listo para recoger o entregar",
                                "Entregado",
                              ][index]
                            }
                          </Text>
                          <Text style={s.subtitle}>
                            {current > index
                              ? "Completado"
                              : current === index
                                ? "Estado actual"
                                : "Pendiente"}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </>
              )}
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
            {(orderView === "detalle" ||
              (company && orderView !== "cotizacion")) &&
              data.items.map((i) =>
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
              orderView === "cotizacion" &&
              card(
                "cotizacion",
                <>
                  <Text style={s.name}>Cotización · {quote.status}</Text>
                  {data.items.map((i) => (
                    <View key={i.id} style={s.amountRow}>
                      <Text style={s.grow}>
                        {i.quantity} × {i.product_name}
                      </Text>
                      <Text style={s.name}>${i.unit_price} / unidad</Text>
                    </View>
                  ))}
                  {[
                    ["Subtotal", quote.subtotal],
                    ["Impuesto", quote.tax],
                    ["Envío", quote.shipping],
                    ["Total", quote.total],
                    ["Pagado", quote.paid],
                    ["Saldo", quote.balance],
                  ].map(([label, amount]) => (
                    <View key={label} style={s.amountRow}>
                      <Text>{label}</Text>
                      <Text style={s.name}>${amount}</Text>
                    </View>
                  ))}
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
              orderView !== "cotizacion" &&
              ["Solicitado", "Cotizado"].includes(order.status) &&
              card(
                "cotizar",
                <>
                  {field(
                    "taxRate",
                    "Tasa de impuesto (0.1600 equivale a 16%)",
                    {
                      decimal: true,
                    },
                  )}
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
              (!company &&
                ["Solicitado", "Cotizado"].includes(order.status))) &&
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
            {field("description", "Descripción", {
              multiline: true,
              max: 4000,
            })}
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
            {heading(
              inventoryMode === "movimientos"
                ? "Movimientos"
                : inventoryMode === "entrada"
                  ? "Registrar entrada"
                  : "Ajustar existencia física",
              data.product.name,
            )}
            <Text>
              Existencias: {data.product.stock} · reservado:{" "}
              {data.product.reserved}
            </Text>
            {inventoryMode === "entrada" &&
              card(
                "entrada",
                <>
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
                </>,
              )}
            {admin && inventoryMode === "ajuste" && (
              <>
                {field("reason", "Motivo", { max: 255 })}
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
            {inventoryMode === "movimientos" && !data.movements.length && (
              <Text style={s.body}>Sin movimientos todavía.</Text>
            )}
            {inventoryMode === "movimientos" &&
              data.movements.map((m) =>
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
            {heading("Clientes", "Contactos y encargos.")}
            <View style={s.search}>
              <Image source={icons.search} style={s.icon} />
              <TextInput
                accessibilityLabel="Buscar cliente"
                placeholder="Buscar nombre o negocio"
                value={customerSearch}
                onChangeText={setCustomerSearch}
                style={s.searchInput}
              />
            </View>
            {data.customers
              ?.filter((c) =>
                (c.name + " " + (c.business_name ?? ""))
                  .toLowerCase()
                  .includes(customerSearch.trim().toLowerCase()),
              )
              .map((c) =>
                menuRow(
                  c.business_name || c.name,
                  c.business_name ? c.name : c.phone,
                  () => perform(() => openCustomer(c)),
                  c.id,
                ),
              )}
            {!data.customers?.length && (
              <Text style={s.body}>Aún no hay clientes.</Text>
            )}
            {button(
              customerAdding ? "Cancelar registro" : "Registrar cliente",
              () => setCustomerAdding(!customerAdding),
              true,
            )}
            {customerAdding &&
              card(
                "nuevo-cliente",
                <>
                  {field("customerName", "Nombre", { max: 120 })}
                  {field("customerPhone", "Teléfono", { max: 25 })}
                  {button("Guardar cliente", () =>
                    perform(async () => {
                      await client.createCustomer(
                        form.customerName ?? "",
                        form.customerPhone ?? "",
                      );
                      await load("clientes");
                    }),
                  )}
                </>,
              )}
          </View>
        )}
        {screen === "cliente" && data.customer && (
          <View>
            {heading(
              data.customer.business_name || data.customer.name,
              data.customer.business_name && data.customer.name,
            )}
            {card(
              "contacto",
              <>
                <Text style={s.name}>Contacto</Text>
                <Text>Teléfono: {data.customer.phone || "Sin registrar"}</Text>
                <Text>Correo: {data.customer.email || "Sin registrar"}</Text>
                {!!data.customer.address && (
                  <Text>{data.customer.address}</Text>
                )}
              </>,
            )}
            {button("Nuevo encargo del cliente", () => {
              setCheckout((current) => ({
                ...current,
                customerId: String(data.customer.id),
              }));
              cartKey.current = randomUUID();
              go("catalogo");
            })}
            <Text style={s.sectionTitle}>Historial de encargos</Text>
            {!data.orders.length && (
              <Text style={s.body}>
                Aún no hay encargos en el historial disponible.
              </Text>
            )}
            {data.orders.map((o) =>
              menuRow(
                "Encargo #" + o.id,
                o.status,
                () => perform(() => openOrder(o.id)),
                o.id,
              ),
            )}
          </View>
        )}
        {screen === "actividad" && (
          <View>
            {heading("Actividad reciente", "Últimos encargos registrados.")}
            {!data.orders?.length && (
              <Text style={s.body}>No hay encargos recientes.</Text>
            )}
            {data.orders?.map((o) =>
              menuRow(
                "Encargo #" + o.id,
                o.customer_name + " · " + o.status,
                () => perform(() => openOrder(o.id)),
                o.id,
              ),
            )}
          </View>
        )}
        {screen === "notificaciones" && (
          <View>
            {heading("Notificaciones", "Actualizaciones de tus encargos.")}
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
            {heading("Mi perfil", "Tus datos para preparar los encargos.")}
            {card(
              "cuenta",
              <>
                <Text style={s.sectionTitle}>{user.name}</Text>
                {!!form.businessName && <Text>{form.businessName}</Text>}
                <Text style={s.subtitle}>{user.email}</Text>
                {!!form.phone && <Text style={s.subtitle}>{form.phone}</Text>}
                {button(
                  profileEditing ? "Cancelar edición" : "Editar mis datos",
                  () =>
                    profileEditing ? go("perfil") : setProfileEditing(true),
                  true,
                )}
              </>,
            )}
            {profileEditing &&
              card(
                "editar-perfil",
                <>
                  {field("name", "Nombre", { max: 120 })}
                  {!company && (
                    <>
                      {field("phone", "Teléfono", { max: 25 })}
                      {field("businessName", "Nombre del taller o negocio", {
                        max: 160,
                      })}
                      {field("taxId", "RFC (opcional)", { max: 13 })}
                      {field("address", "Dirección", {
                        multiline: true,
                        max: 500,
                      })}
                    </>
                  )}
                  {button("Guardar perfil", () =>
                    perform(async () => {
                      await client.saveProfile(form);
                      onUser({ ...user, name: form.name });
                      await load("perfil");
                    }),
                  )}
                </>,
              )}
            {!company && (
              <>
                {menuRow("Mis favoritos", "Materiales guardados", () =>
                  go("favoritos"),
                )}
                {menuRow(
                  "Dirección de entrega",
                  form.address || "Añade tu dirección",
                  () => setProfileEditing(true),
                )}
                {menuRow(
                  "Datos de facturación",
                  form.taxId || "RFC opcional",
                  () => setProfileEditing(true),
                )}
              </>
            )}
            {menuRow("Notificaciones", "Avisos de tus encargos", () =>
              go("notificaciones"),
            )}
            {menuRow(
              "Cambiar contraseña",
              "Seguridad de la cuenta",
              onPassword,
            )}
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
            {heading("Configuración", "Tu negocio, a tu manera.")}
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
            {heading(
              "Usuarios y permisos",
              "Gestiona los accesos de la empresa.",
            )}
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
              Evita incluir datos personales. La IA solo da orientación; no
              cambia encargos.
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
            {heading("Ayuda", "Consulta cómo funciona Aluformix.")}
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
      </ScrollView>
      <View style={s.footer}>
        {tabs.map(([label, next, icon]) => (
          <Pressable
            key={next}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === next }}
            accessibilityLabel={label}
            disabled={busy}
            onPress={() => (next === "encargos" ? goOrders() : go(next))}
            style={s.tab}
          >
            <Image
              source={icons[icon]}
              style={[s.tabIcon, activeTab === next && s.activeIcon]}
            />
            <Text style={[s.tabLabel, activeTab === next && s.active]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#f2f6fb" },
  grow: { flex: 1, minWidth: 0 },
  header: {
    minHeight: 56,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerSide: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
  },
  headerActions: { justifyContent: "flex-end", flex: 1.45 },
  iconButton: {
    width: 34,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { width: 21, height: 21, resizeMode: "contain" },
  badge: {
    position: "absolute",
    top: 3,
    right: 0,
    minWidth: 16,
    textAlign: "center",
    fontSize: 10,
    color: "#fff",
    backgroundColor: "#007bff",
    borderRadius: 8,
    paddingHorizontal: 3,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandName: {
    color: "#102c46",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  brandRole: {
    color: "#526b82",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 2,
    textAlign: "center",
  },
  logo: { width: 29, height: 29, borderRadius: 15 },
  content: {
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  footer: {
    flexDirection: "row",
    backgroundColor: "white",
    borderTopWidth: 1,
    borderColor: "#e5ebf2",
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  tab: {
    flex: 1,
    minHeight: 49,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  tabIcon: {
    width: 22,
    height: 22,
    tintColor: "#526b82",
    resizeMode: "contain",
  },
  activeIcon: { tintColor: "#0071d9" },
  tabLabel: { color: "#526b82", fontSize: 11 },
  active: { color: "#0071d9", fontWeight: "700" },
  heading: { marginTop: 12, marginBottom: 16, gap: 4 },
  title: { fontSize: 27, fontWeight: "800", color: "#102c46" },
  subtitle: { color: "#526b82", fontSize: 13, lineHeight: 18 },
  sectionTitle: {
    color: "#102c46",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 13,
    marginBottom: 5,
  },
  hero: {
    backgroundColor: "#0a4579",
    overflow: "hidden",
    borderRadius: 17,
    padding: 18,
    marginVertical: 9,
    gap: 7,
  },
  heroBackground: {
    position: "absolute",
    width: "120%",
    height: "150%",
    left: 0,
    top: 0,
    resizeMode: "stretch",
  },
  heroButtonCompany: { alignSelf: "stretch", justifyContent: "center" },
  heroKicker: {
    color: "#d4e9fa",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.65,
  },
  heroTitle: { color: "#fff", fontSize: 25, lineHeight: 28, fontWeight: "900" },
  heroDetail: { color: "#e0effb", fontSize: 13, lineHeight: 18 },
  heroButton: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 3,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  metrics: { flexDirection: "row", gap: 8, marginVertical: 8 },
  metric: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    borderColor: "#e1e9f1",
    borderWidth: 1,
    borderRadius: 12,
    padding: 7,
    minHeight: 65,
  },
  metricValue: { color: "#0071d9", fontSize: 24, fontWeight: "900" },
  metricLabel: { color: "#526b82", fontSize: 10, textAlign: "center" },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 50,
    backgroundColor: "white",
    borderRadius: 12,
    borderColor: "#e1e9f1",
    borderWidth: 1,
    padding: 12,
    marginVertical: 4,
  },
  arrow: { color: "#0071d9", fontSize: 18 },
  tag: {
    alignSelf: "flex-start",
    color: "#405e77",
    backgroundColor: "#e7f1fb",
    fontSize: 11,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    marginVertical: 2,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e6eff8",
    borderRadius: 10,
    paddingLeft: 10,
    minHeight: 44,
    marginVertical: 7,
    gap: 8,
  },
  searchInput: { flex: 1, minHeight: 44, color: "#102c46", fontSize: 14 },
  chips: { gap: 7, paddingVertical: 3 },
  link: { minHeight: 38, justifyContent: "center" },
  productRow: {
    backgroundColor: "white",
    borderColor: "#e1e9f1",
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 9,
    minHeight: 78,
    marginVertical: 4,
  },
  thumb: {
    width: 69,
    height: 66,
    borderRadius: 9,
    resizeMode: "contain",
    backgroundColor: "#e8eef3",
  },
  placeholder: { alignItems: "center", justifyContent: "center", gap: 8 },
  placeholderIcon: {
    width: 26,
    height: 19,
    borderRadius: 3,
    borderWidth: 3,
    borderColor: "#8ba2b3",
    borderBottomWidth: 5,
  },
  placeholderLarge: {
    width: 58,
    height: 38,
    borderRadius: 5,
    borderWidth: 5,
    borderColor: "#8ba2b3",
    borderBottomWidth: 8,
  },
  price: { color: "#0071d9", fontSize: 25, fontWeight: "800" },
  priceSmall: { color: "#102c46", fontWeight: "800", fontSize: 13 },
  productDetail: { gap: 7 },
  stepper: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    backgroundColor: "#e9f2fb",
    borderRadius: 8,
    marginTop: 4,
  },
  step: {
    minWidth: 36,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  stepInput: {
    width: 67,
    textAlign: "center",
    color: "#102c46",
    fontWeight: "700",
    fontSize: 13,
    height: 40,
  },
  fieldRead: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e1e9f1",
    padding: 9,
    color: "#102c46",
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "#e1e9f1",
    gap: 8,
    paddingVertical: 8,
  },
  summaryRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  notice: {
    backgroundColor: "#fff2d6",
    color: "#674b18",
    padding: 12,
    marginVertical: 7,
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 19,
  },
  center: { textAlign: "center" },
  success: {
    alignSelf: "center",
    width: 75,
    height: 75,
    borderRadius: 38,
    backgroundColor: "#119d71",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 15,
  },
  successMark: { fontSize: 41, color: "white", fontWeight: "800" },
  timelineRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    minHeight: 48,
    paddingTop: 5,
    paddingLeft: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ccd9e5",
    marginTop: 5,
  },
  dotDone: { backgroundColor: "#119d71" },
  dotCurrent: { backgroundColor: "#007bff" },
  name: { fontSize: 15, fontWeight: "800", color: "#102c46" },
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
    padding: 13,
    gap: 7,
    marginVertical: 5,
  },
  button: {
    backgroundColor: "#007bff",
    borderRadius: 11,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 43,
    marginVertical: 4,
  },
  buttonText: {
    color: "white",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "800",
  },
  secondary: { backgroundColor: "#e1effc" },
  secondaryText: { color: "#0066cc" },
  image: {
    height: 180,
    width: "100%",
    resizeMode: "contain",
    borderRadius: 10,
    backgroundColor: "#edf3f7",
  },
});
