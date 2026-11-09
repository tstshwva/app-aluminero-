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
  useWindowDimensions,
} from "react-native";
import { randomUUID } from "expo-crypto";
import Scanner from "./Scanner";
import { registerPush, disablePush } from "./push";
import { catalogImages, genericImages, systemImages } from "./catalogImages";
import {
  GROUPS,
  catalogInfo,
  classify,
  filterCatalog,
  finishesOf,
  genericTypeOf,
  isPricePending,
  reviewNotes,
  subcategoriesFor,
  unitLabel,
  VALIDATION_LABELS,
  c100Cuts,
  c100Guide,
  systemComponents,
  systemsOnly,
} from "@aluformix/catalog";
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
  catalog: require("../assets/icon-catalog.png"),
};
// Variantes rellenas para la pestaña activa (scripts/generar-iconos.js).
const activeIcons = {
  home: require("../assets/icon-home-active.png"),
  catalog: require("../assets/icon-catalog-active.png"),
  inventory: require("../assets/icon-inventory-active.png"),
  orders: require("../assets/icon-orders-active.png"),
  cart: require("../assets/icon-cart-active.png"),
  profile: require("../assets/icon-profile-active.png"),
  more: require("../assets/icon-more-active.png"),
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
  // Un precio pendiente de captura (0) no genera importes estimados.
  if (isPricePending(price)) return null;
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

// Imagen del producto: primero la URL HTTPS registrada, después la imagen
// ilustrativa incluida en la app y, si ninguna carga, un marcador neutro.
function ProductImage({ product, style, large = false }) {
  const [failed, setFailed] = useState(false);
  const bundled = bundledImageOf(product);
  const source =
    product.image_url && !failed
      ? { uri: product.image_url }
      : (bundled?.source ?? null);
  // El contenedor fija la proporción 4:3 y la imagen lo llena sin recortarse
  // ni deformarse (equivalente a object-fit: contain).
  if (source)
    return (
      <View style={[style, s.imageFrame]}>
        <Image
          accessibilityLabel={"Imagen de " + product.name}
          source={source}
          resizeMode="contain"
          onError={() => product.image_url && setFailed(true)}
          style={s.imageFill}
        />
      </View>
    );
  return (
    <View
      accessibilityLabel={"Sin imagen de " + product.name}
      style={[style, s.imageFrame, s.placeholder]}
    >
      <Image
        source={require("../assets/aluformix-logo.png")}
        style={large ? s.placeholderLogoLarge : s.placeholderLogo}
      />
      <Text style={large ? s.placeholderText : s.placeholderTextSmall}>
        {catalogInfo(product.code)
          ? "Imagen técnica pendiente de validar"
          : "Imagen pendiente"}
      </Text>
    </View>
  );
}
const usesIllustration = (p) => !p.image_url && Boolean(bundledImageOf(p));
// Render propio del producto o, si no existe, imagen genérica según su tipo.
function bundledImageOf(p) {
  const own = catalogImages[String(p.code ?? "")];
  if (own) return own;
  // Un producto del catálogo maestro nunca recibe una imagen genérica.
  if (catalogInfo(p.code)) return null;
  return genericImages[genericTypeOf(p.name)] ?? null;
}
const emptyFilter = {
  group: "",
  subcategory: "",
  glass: false,
  favoritesOnly: false,
  order: "nombre",
};

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
  dark = false,
  onDarkMode,
  audience,
  busy,
  run,
  onPassword,
  onLogout,
  onUser,
  message,
}) {
  s = dark ? darkStyles : lightStyles;
  const company = audience === "empresa",
    admin = user.role === "Administrador";
  const [screen, setScreen] = useState("inicio"),
    [data, setData] = useState({}),
    [form, setForm] = useState({}),
    [search, setSearch] = useState(""),
    [catalogFilter, setCatalogFilter] = useState(emptyFilter),
    [favoriteIds, setFavoriteIds] = useState(() => new Set());
  const { width } = useWindowDimensions();
  const wide = width >= 720,
    columns = width >= 1080 ? 3 : 2;
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
        : {
            // Se destacan primero los materiales que tienen imagen.
            products: (await client.products())
              .map((p, i) => ({
                p,
                i,
                img: p.image_url || catalogImages[String(p.code)] ? 0 : 1,
              }))
              .sort((a, b) => a.img - b.img || a.i - b.i)
              .slice(0, 4)
              .map((x) => x.p),
            categories: await client.categories(),
          };
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
    if (next === "catalogo") {
      // El catálogo completo se filtra en el teléfono para que la búsqueda
      // incluya subcategorías, medidas y códigos alternos. La API devuelve hasta
      // 100 registros; si se alcanza el límite se agregan sus coincidencias.
      const [products, categories, favorites] = await Promise.all([
        client.products(""),
        client.categories(),
        loadFavorites(),
      ]);
      let list = products;
      if (query.trim() && products.length >= 1000) {
        const ids = new Set(products.map((p) => String(p.id)));
        list = [
          ...products,
          ...(await client.products(query)).filter(
            (p) => !ids.has(String(p.id)),
          ),
        ];
      }
      result = { products: list, categories };
      setFavoriteIds(new Set(favorites.map((p) => String(p.id))));
    }
    if (next === "favoritos") {
      const [products, categories] = await Promise.all([
        client.favorites(),
        client.categories(),
      ]);
      result = { products, categories };
      setFavoriteIds(new Set(products.map((p) => String(p.id))));
    }
    if (next === "validacion") {
      const [products, categories] = await Promise.all([
        client.products(""),
        client.categories(),
      ]);
      result = { products, categories };
    }
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
  // Los favoritos solo existen para compradores; si fallan, el catálogo se muestra igual.
  async function loadFavorites() {
    if (company) return [];
    try {
      return (await client.favorites()) ?? [];
    } catch {
      return [];
    }
  }
  async function toggleFavorite(product) {
    const key = String(product.id),
      enabled = !favoriteIds.has(key);
    await client.favorite(product.id, enabled);
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (enabled) next.add(key);
      else next.delete(key);
      return next;
    });
    if (screen === "favoritos" && !enabled)
      setData((d) => ({
        ...d,
        products: d.products?.filter((p) => String(p.id) !== key),
      }));
  }
  async function openProduct(productId) {
    const p = await client.product(productId);
    setData((d) => ({ product: p, categories: d.categories }));
    const item = cart.find((i) => String(i.productId) === String(productId));
    const options = finishesOf(p);
    setForm({
      quantity: item?.quantity ?? "1",
      cutLengthMm: item?.cutLengthMm ?? "",
      finish: item?.finish ?? (options.length === 1 ? options[0] : ""),
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
    const options = finishesOf(product);
    if (options.length > 1 && !options.includes(form.finish))
      throw new Error("Selecciona el acabado que necesitas.");
    const item = {
      productId: String(product.id),
      quantity,
      cutLengthMm: cut || null,
      finish: options.length > 1 ? form.finish : null,
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
      items: cart.map(({ productId, quantity, cutLengthMm, finish }) => ({
        productId,
        quantity,
        cutLengthMm,
        ...(finish ? { finish } : {}),
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
    "sistema",
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
        : [
              "empresa",
              "personal",
              "clientes",
              "cliente",
              "actividad",
              "validacion",
            ].includes(screen)
          ? "mas"
          : screen;
  const tabs = [
    ["Inicio", "inicio", "home"],
    [
      company ? "Inventario" : "Catálogo",
      "catalogo",
      company ? "inventory" : "catalog",
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
        "sistema",
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
        "validacion",
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
  const productImage = (p, large = false) => (
    <ProductImage
      key={"img" + p.id}
      product={p}
      large={large}
      style={large ? s.image : s.thumb}
    />
  );
  const categoryNameOf = (p) =>
    data.categories?.find((c) => String(c.id) === String(p.category_id))
      ?.name ?? "";
  const priceText = (p) =>
    isPricePending(p.price)
      ? "Consultar precio"
      : "$" + p.price + (company ? " sin IVA" : " estimado");
  const productRow = (p) => {
    const { subcategory } = classify(p, categoryNameOf(p));
    const info = catalogInfo(p.code);
    const favorite = favoriteIds.has(String(p.id));
    const grid = wide && screen !== "inicio";
    return (
      <View
        key={p.id}
        style={[
          s.productCard,
          grid && { width: columns === 3 ? "32.3%" : "49%" },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Ver " + p.code}
          disabled={busy}
          onPress={() => perform(() => openProduct(p.id))}
          style={[s.productRow, grid && s.productTile]}
        >
          <ProductImage
            key={"img" + p.id + (p.image_url ?? "")}
            product={p}
            style={grid ? s.tileImage : s.thumb}
          />
          <View
            style={[
              s.grow,
              grid && s.tileBody,
              !company && !grid && { paddingRight: 30 },
            ]}
          >
            <Text style={s.cardMeta} numberOfLines={1}>
              {info?.familia ?? subcategory}
            </Text>
            <Text style={s.name} numberOfLines={2}>
              {p.name}
            </Text>
            <Text style={s.subtitle} numberOfLines={2}>
              Cód. {p.code} · {unitLabel(p)}
            </Text>
            {!!info?.dimensiones && (
              <Text style={s.cardDims} numberOfLines={1}>
                {info.dimensiones.texto}
              </Text>
            )}
            {company && <Text style={s.tag}>{p.available} disponibles</Text>}
            <Text
              style={[s.priceSmall, isPricePending(p.price) && s.pricePending]}
            >
              {priceText(p)}
            </Text>
            {!Number(p.active) && <Text style={s.subtitle}>Desactivado</Text>}
          </View>
          {!grid && <Text style={s.arrow}>›</Text>}
          {grid && <Text style={s.tileLink}>Ver ficha ›</Text>}
        </Pressable>
        {!company && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              (favorite ? "Quitar de favoritos " : "Agregar a favoritos ") +
              p.code
            }
            accessibilityState={{ selected: favorite }}
            disabled={busy}
            hitSlop={8}
            onPress={() => perform(() => toggleFavorite(p))}
            style={s.favorite}
          >
            <Text style={[s.heart, favorite && s.heartOn]}>
              {favorite ? "♥" : "♡"}
            </Text>
          </Pressable>
        )}
      </View>
    );
  };
  const searchCatalog = () => {
    if (screen !== "catalogo") go("catalogo", search);
  };
  const updateFilter = (changes) =>
    setCatalogFilter((current) => ({ ...current, ...changes }));
  const chip = (label, selected, action, key = label) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      disabled={busy}
      onPress={action}
      style={[s.chip, selected && s.chipOn]}
    >
      <Text style={[s.chipText, selected && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
  const allProducts = data.products ?? [];
  const groupTabs = [
    ...GROUPS,
    "Sistemas",
    ...(allProducts.some(
      (p) => classify(p, categoryNameOf(p)).group === "Otros",
    )
      ? ["Otros"]
      : []),
  ];
  const showingSystems = catalogFilter.group === "Sistemas";
  const subcategories =
    catalogFilter.group && !showingSystems
      ? subcategoriesFor(catalogFilter.group, allProducts, categoryNameOf)
      : [];
  const catalogList =
    screen === "catalogo"
      ? filterCatalog(allProducts, {
          ...catalogFilter,
          favorites: favoriteIds,
          query: search,
          categoryNameOf,
        })
      : allProducts;
  const productByCode = (codigo, alternos = []) =>
    allProducts.find((p) =>
      [codigo, ...alternos].filter(Boolean).includes(String(p.code)),
    );
  const openSystem = (name) => {
    setData((d) => ({ ...d, system: name }));
    setForm({ calcL: "", calcH: "" });
    setScreen("sistema");
  };
  const systemCard = (sys) => {
    const cover = systemImages[sys.nombre];
    const grid = wide;
    return (
      <View
        key={sys.nombre}
        style={[
          s.productCard,
          grid && { width: columns === 3 ? "32.3%" : "49%" },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Ver sistema " + sys.nombre}
          disabled={busy}
          onPress={() => openSystem(sys.nombre)}
          style={[s.productRow, grid && s.productTile]}
        >
          {cover ? (
            <View style={[grid ? s.tileImage : s.thumb, s.imageFrame]}>
              <Image
                accessibilityLabel={"Ilustración del sistema " + sys.nombre}
                source={cover.source}
                resizeMode="contain"
                style={s.imageFill}
              />
            </View>
          ) : (
            <View
              style={[
                grid ? s.tileImage : s.thumb,
                s.imageFrame,
                s.placeholder,
              ]}
            />
          )}
          <View style={[s.grow, grid && s.tileBody]}>
            <Text style={s.cardMeta}>Sistema</Text>
            <Text style={s.name}>{sys.nombre}</Text>
            <Text style={s.subtitle}>
              {sys.componentes} componentes
              {sys.nombre === "C-100 MID" ? " · guía de armado" : ""}
            </Text>
          </View>
          {!grid && <Text style={s.arrow}>›</Text>}
          {grid && <Text style={s.tileLink}>Ver sistema ›</Text>}
        </Pressable>
      </View>
    );
  };
  const specRow = (label, value) => (
    <View key={label} style={s.specRow}>
      <Text style={s.specLabel}>{label}</Text>
      <Text style={s.specValue}>{value}</Text>
    </View>
  );
  const searchBar = (placeholder) => (
    <View style={s.search}>
      <Image source={icons.search} style={s.icon} />
      <TextInput
        accessibilityLabel="Buscar producto"
        placeholder={placeholder}
        placeholderTextColor={dark ? "#7f93a6" : "#526b82"}
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
        contentContainerStyle={[
          s.content,
          wide &&
            [
              "catalogo",
              "favoritos",
              "stockbajo",
              "producto",
              "validacion",
            ].includes(screen) && { maxWidth: columns === 3 ? 1120 : 900 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {!!message && (
          <Text accessibilityLiveRegion="polite" style={s.notice}>
            {message}
          </Text>
        )}
        {client.demo && (
          <Text style={s.notice}>
            Modo demostración · Los cambios se reinician al recargar.
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
                {menuRow(
                  "Catálogo por validar",
                  "Discrepancias de origen y precios pendientes",
                  () => go("validacion"),
                )}
                {admin &&
                  menuRow("Configuración", "Negocio e impuestos", () =>
                    go("empresa"),
                  )}
                {admin &&
                  !client.demo &&
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
                    ? "Nombre, código, medida o categoría"
                    : "Nombre, código, medida o categoría",
                )}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={s.segment}
                  contentContainerStyle={s.segmentRow}
                >
                  {[["Todos", ""], ...groupTabs.map((g) => [g, g])].map(
                    ([label, value]) => (
                      <Pressable
                        key={label}
                        accessibilityRole="button"
                        accessibilityLabel={"Filtrar " + label}
                        accessibilityState={{
                          selected: catalogFilter.group === value,
                        }}
                        disabled={busy}
                        onPress={() =>
                          updateFilter({
                            group: value,
                            subcategory: "",
                            glass: false,
                          })
                        }
                        style={[
                          s.segmentItem,
                          catalogFilter.group === value && s.segmentOn,
                        ]}
                      >
                        <Text
                          style={[
                            s.segmentText,
                            catalogFilter.group === value && s.segmentTextOn,
                          ]}
                        >
                          {label.toUpperCase()}
                        </Text>
                      </Pressable>
                    ),
                  )}
                </ScrollView>
                {!!catalogFilter.group && subcategories.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.chips}
                  >
                    {chip(
                      "Todas",
                      !catalogFilter.subcategory,
                      () => updateFilter({ subcategory: "" }),
                      "sub-todas",
                    )}
                    {subcategories.map((name) =>
                      chip(
                        name,
                        catalogFilter.subcategory === name,
                        () =>
                          updateFilter({
                            subcategory:
                              catalogFilter.subcategory === name ? "" : name,
                          }),
                        "sub-" + name,
                      ),
                    )}
                  </ScrollView>
                )}
                {!showingSystems && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.chips}
                  >
                    {chip("Vidrio", catalogFilter.glass, () =>
                      updateFilter(
                        catalogFilter.glass
                          ? { glass: false }
                          : { glass: true, group: "", subcategory: "" },
                      ),
                    )}
                    {!company &&
                      chip("♥ Favoritos", catalogFilter.favoritesOnly, () =>
                        updateFilter({
                          favoritesOnly: !catalogFilter.favoritesOnly,
                        }),
                      )}
                    {chip(
                      catalogFilter.order === "codigo"
                        ? "Orden: código"
                        : "Orden: A–Z",
                      false,
                      () =>
                        updateFilter({
                          order:
                            catalogFilter.order === "codigo"
                              ? "nombre"
                              : "codigo",
                        }),
                      "orden",
                    )}
                  </ScrollView>
                )}
                {data.products && !showingSystems && (
                  <Text style={s.resultCount} accessibilityLiveRegion="polite">
                    {catalogList.length === 1
                      ? "1 producto"
                      : catalogList.length + " productos"}
                    {search.trim() ? " para «" + search.trim() + "»" : ""}
                  </Text>
                )}
              </>
            )}
            {!data.products && busy && (
              <View style={s.loading}>
                <ActivityIndicator color="#007bff" />
                <Text style={s.subtitle}>Cargando catálogo…</Text>
              </View>
            )}
            {showingSystems && screen === "catalogo" && (
              <View style={wide ? s.grid : null}>
                {systemsOnly().map((sys) => systemCard(sys))}
              </View>
            )}
            {!(showingSystems && screen === "catalogo") && (
              <View style={wide ? s.grid : null}>
                {catalogList.map(productRow)}
              </View>
            )}
            {!!data.products && !catalogList.length && !showingSystems && (
              <View style={s.empty}>
                <Text style={s.name}>
                  {screen === "catalogo" &&
                  catalogFilter.group === "Herrajes" &&
                  !search.trim()
                    ? "Aún no hay herrajes registrados"
                    : screen === "favoritos"
                      ? "Aún no guardas favoritos"
                      : "No encontramos productos"}
                </Text>
                <Text style={s.subtitle}>
                  {screen === "catalogo" &&
                  catalogFilter.group === "Herrajes" &&
                  !search.trim()
                    ? "La categoría está lista para nuevas incorporaciones."
                    : screen === "favoritos"
                      ? "Toca ♡ en un producto para guardarlo."
                      : "Revisa la búsqueda o cambia los filtros."}
                </Text>
                {screen === "catalogo" &&
                  button(
                    "Limpiar filtros",
                    () => {
                      setSearch("");
                      setCatalogFilter(emptyFilter);
                    },
                    true,
                  )}
              </View>
            )}
            {company &&
              screen === "catalogo" &&
              button("Nuevo producto", () => perform(() => editProduct(null)))}
            {screen === "stockbajo" &&
              button("Ver inventario", () => go("catalogo"), true)}
          </View>
        )}
        {screen === "sistema" &&
          data.system &&
          (() => {
            const name = data.system;
            const components = systemComponents(name);
            const cover = systemImages[name];
            const files = [
              ...new Set(
                components.flatMap((c) => c.fuentes.map((f) => f.archivo)),
              ),
            ];
            const c100 = name === "C-100 MID";
            let calc = null,
              calcError = "";
            if (c100 && form.calcL && form.calcH)
              try {
                calc = c100Cuts(form.calcL, form.calcH);
              } catch (error) {
                calcError = error.message;
              }
            return (
              <View>
                {heading(name, components.length + " componentes registrados")}
                {cover ? (
                  <View style={[s.image, wide && s.imageWide, s.imageFrame]}>
                    <Image
                      accessibilityLabel={"Ilustración del sistema " + name}
                      source={cover.source}
                      resizeMode="contain"
                      style={s.imageFill}
                    />
                  </View>
                ) : null}
                {cover && <Text style={s.imageNote}>{cover.note}</Text>}
                <Text style={s.sectionTitle}>Componentes</Text>
                {components.map((c, i) => {
                  const product = c.codigo
                    ? productByCode(c.codigo, c.codigos_alternos)
                    : null;
                  if (product) return productRow(product);
                  return (
                    <View key={"comp" + i} style={s.menuRow}>
                      <View style={s.grow}>
                        <Text style={s.name}>{c.nombre}</Text>
                        <Text style={s.subtitle}>
                          {c.codigo ? "Cód. " + c.codigo : "Sin código"} ·{" "}
                          {VALIDATION_LABELS[c.estado] ?? c.estado}
                        </Text>
                        <Text style={s.subtitle}>
                          {c.codigo
                            ? "Aún no se registra en la base de esta sucursal."
                            : "Se registrará cuando el proveedor confirme su código."}
                        </Text>
                      </View>
                    </View>
                  );
                })}
                <Text style={s.sectionTitle}>Documentos técnicos</Text>
                {files.map((file) => (
                  <Text key={file} style={s.body}>
                    • {file}
                  </Text>
                ))}
                <Text style={s.notice}>
                  Los documentos del proveedor no se reproducen en la app hasta
                  confirmar la autorización del titular de los diseños. Consulta
                  el archivo original con la distribuidora.
                </Text>
                {name === "Corrediza C-80" && (
                  <Text style={s.body}>
                    Para este sistema se entregaron fichas de componentes, sin
                    guía de armado.
                  </Text>
                )}
                {c100 && (
                  <>
                    <Text style={s.sectionTitle}>Guía de armado C-100 MID</Text>
                    <View style={s.specs}>
                      {Object.entries(c100Guide.contenido_por_pagina)
                        .map(([k, v]) => [
                          k.includes("_") ? k.replace("_", "–") : k,
                          v,
                        ])
                        .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
                        .map(([page, text]) => specRow("Pág. " + page, text))}
                    </View>
                    <Text style={s.sectionTitle}>Datos técnicos</Text>
                    <View style={s.specs}>
                      {specRow("Longitud de perfiles", "6.00 m")}
                      {specRow("Aleación", "6063-T5")}
                      {specRow(
                        "Acabados",
                        "Gris titanium, Negro anodizado, Madera texturizada",
                      )}
                      {specRow("Unidades", "Milímetros")}
                    </View>
                    <Text style={s.sectionTitle}>Calculadora de cortes</Text>
                    <Text style={s.subtitle}>
                      Solo para C-100 MID de 2 hojas corredizas con mosquitero,
                      según la tabla de descuentos de la guía (pág. 8). L =
                      ancho total, H = alto total.
                    </Text>
                    {field("calcL", "Ancho total L (mm)", { decimal: true })}
                    {field("calcH", "Alto total H (mm)", { decimal: true })}
                    {!!calcError && <Text style={s.notice}>{calcError}</Text>}
                    {calc && (
                      <View style={s.specs}>
                        {calc.cortes.map((c) =>
                          specRow(
                            c.clave + " · " + c.descripcion,
                            (c.medida != null
                              ? c.medida + " mm (" + c.regla + ")"
                              : c.regla) +
                              (c.cantidad ? " × " + c.cantidad : "") +
                              (c.corte ? " · corte " + c.corte : ""),
                          ),
                        )}
                        {specRow(
                          "Vidrio LF × HF",
                          calc.vidrio.LF +
                            " × " +
                            calc.vidrio.HF +
                            " mm (LF = L/2 − 138, HF = H − 212)",
                        )}
                      </View>
                    )}
                    <Text style={s.notice}>
                      Verifica medidas en obra.{" "}
                      {c100Guide.formulas_y_datos_expresos.advertencias} Las
                      gráficas de dimensionamiento de la guía (viento de 90,
                      120, 160 y 200 km/h, deflexión máxima H/75) no son una
                      certificación estructural.
                    </Text>
                    <Text style={s.sectionTitle}>Herramientas de armado</Text>
                    <Text style={s.body}>
                      {c100Guide.herramientas_mencionadas.join(" · ")}
                    </Text>
                    <Text style={s.subtitle}>
                      Las herramientas forman parte de la guía; no son productos
                      del inventario.
                    </Text>
                  </>
                )}
              </View>
            );
          })()}
        {screen === "validacion" && (
          <View>
            {heading(
              "Catálogo por validar",
              "Datos que las fuentes no confirman. Corrígelos desde Editar producto.",
            )}
            <Text style={s.sectionTitle}>Discrepancias entre fuentes</Text>
            {allProducts.filter((p) => reviewNotes(p).length).map(productRow)}
            {!allProducts.some((p) => reviewNotes(p).length) && (
              <Text style={s.body}>No hay discrepancias pendientes.</Text>
            )}
            <Text style={s.sectionTitle}>
              Precio pendiente de captura (
              {allProducts.filter((p) => isPricePending(p.price)).length})
            </Text>
            <Text style={s.subtitle}>
              Se muestran como «Consultar precio» hasta registrar un precio
              mayor que cero.
            </Text>
            {allProducts.filter((p) => isPricePending(p.price)).map(productRow)}
          </View>
        )}
        {screen === "producto" && data.product && (
          <View style={[s.productDetail, wide && s.detailWide]}>
            <View style={wide ? s.detailMedia : null}>
              <ProductImage
                key={"detalle" + data.product.id}
                product={data.product}
                large
                style={[s.image, wide && s.imageWide]}
              />
              {usesIllustration(data.product) && (
                <Text style={s.imageNote}>
                  Imagen ilustrativa · {bundledImageOf(data.product).note}
                </Text>
              )}
            </View>
            <View style={wide ? s.detailInfo : s.productDetail}>
              <Text style={s.cardMeta}>
                {(({ group, subcategory }) => group + " · " + subcategory)(
                  classify(data.product, categoryNameOf(data.product)),
                )}
              </Text>
              {heading(
                data.product.name,
                "Código " +
                  data.product.code +
                  (catalogInfo(data.product.code)?.codigos_alternos.length
                    ? " · alterno " +
                      catalogInfo(data.product.code).codigos_alternos.join(", ")
                    : ""),
              )}
              {isPricePending(data.product.price) ? (
                <View>
                  <Text style={[s.price, s.pricePending]}>
                    Consultar precio
                  </Text>
                  <Text style={s.subtitle}>
                    Precio pendiente de captura. La distribuidora lo confirma en
                    la cotización.
                  </Text>
                </View>
              ) : (
                <Text style={s.price}>${data.product.price}</Text>
              )}
              {company && (
                <View style={s.metrics}>
                  {metric("Físicas", data.product.stock ?? "–")}
                  {metric("Reservadas", data.product.reserved ?? "–")}
                  {metric("Disponibles", data.product.available ?? "–")}
                </View>
              )}
              {company &&
                reviewNotes(data.product).map((note, i) => (
                  <Text key={"rev" + i} style={s.notice}>
                    {VALIDATION_LABELS[note.tipo] ?? "Requiere validación"}:{" "}
                    {note.detalle}
                  </Text>
                ))}
              {!!data.product.description && (
                <Text style={s.body}>{data.product.description}</Text>
              )}
              <View style={s.specs}>
                {(({ group, subcategory }) => [
                  specRow("Categoría", group),
                  specRow("Subcategoría", subcategory),
                ])(classify(data.product, categoryNameOf(data.product)))}
                {!!catalogInfo(data.product.code)?.familia &&
                  specRow("Familia", catalogInfo(data.product.code).familia)}
                {!!catalogInfo(data.product.code)?.sistemas.length &&
                  specRow(
                    "Sistemas",
                    catalogInfo(data.product.code).sistemas.join(", "),
                  )}
                {specRow(
                  "Unidad",
                  data.product.unit +
                    (catalogInfo(data.product.code)?.unidad_fuente
                      ? " (fuente: " +
                        catalogInfo(data.product.code).unidad_fuente +
                        ")"
                      : ""),
                )}
                {(/^barra/i.test(data.product.unit) ||
                  /^por confirmar/i.test(data.product.unit)) &&
                  specRow(
                    "Longitud",
                    data.product.length_mm
                      ? data.product.length_mm + " mm"
                      : "Longitud por confirmar",
                  )}
                {specRow(
                  "Dimensiones",
                  catalogInfo(data.product.code)?.dimensiones?.texto ??
                    "No indicadas en la fuente",
                )}
                {specRow(
                  "Acabados",
                  finishesOf(data.product).join(", ") || "Por confirmar",
                )}
                {!!catalogInfo(data.product.code) &&
                  specRow(
                    "Validación",
                    VALIDATION_LABELS[catalogInfo(data.product.code).estado] ??
                      catalogInfo(data.product.code).estado,
                  )}
                {company &&
                  !!catalogInfo(data.product.code) &&
                  specRow(
                    "Fuente",
                    catalogInfo(data.product.code)
                      .fuentes.map(
                        (f) => f.archivo + ", pág. " + f.paginas_pdf.join(", "),
                      )
                      .join(" · "),
                  )}
              </View>
              {finishesOf(data.product).length > 1 && (
                <>
                  <Text style={s.label}>Acabado</Text>
                  <View style={s.quickRow}>
                    {finishesOf(data.product).map((option) =>
                      chip(option, form.finish === option, () =>
                        change("finish", option),
                      ),
                    )}
                  </View>
                </>
              )}
              {field("quantity", "Cantidad de esta presentación", {
                decimal: true,
              })}
              {field(
                "cutLengthMm",
                "Corte opcional en mm (no cambia la unidad vendida)",
                { decimal: true },
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Agregar al encargo"
                disabled={busy}
                onPress={() => perform(async () => add(data.product))}
                style={[s.button, busy && { opacity: 0.5 }]}
              >
                <Text style={s.buttonText}>AGREGAR A ENCARGO</Text>
              </Pressable>
              {!company &&
                button(
                  favoriteIds.has(String(data.product.id))
                    ? "♥ Guardado en favoritos"
                    : "♡ Guardar en favoritos",
                  () => perform(() => toggleFavorite(data.product)),
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
          </View>
        )}
        {screen === "carrito" && (
          <View>
            {heading(
              "Mi encargo",
              "Revisa los materiales y las cantidades solicitadas.",
            )}
            {!cart.length && (
              <Text style={s.plain}>Tu carrito está vacío.</Text>
            )}
            {cart.map((item, index) =>
              card(
                item.productId,
                <>
                  <View style={s.summaryRow}>
                    {productImage(item.product)}
                    <View style={s.grow}>
                      <Text style={s.name}>{item.product.name}</Text>
                      <Text style={s.subtitle}>
                        {item.product.unit} ·{" "}
                        {item.finish ?? item.product.finish}
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
                  <Text style={s.plain}>Primero registra un cliente.</Text>
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
                      <Text style={s.plain}>
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
              <Text style={s.plain}>
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
                <Text style={s.plain}>
                  {order.customer_name} · {order.customer_phone}
                </Text>
                <Text style={s.plain}>
                  {order.fulfillment} ·{" "}
                  {order.delivery_address ?? "Recogida en sucursal"}
                </Text>
                <Text style={s.plain}>
                  {order.notes ?? "Sin indicaciones adicionales"}
                </Text>
              </>,
            )}
            {(orderView === "detalle" ||
              (company && orderView !== "cotizacion")) &&
              data.items.map((i) =>
                card(
                  i.id,
                  <>
                    <Text style={s.name}>{i.product_name}</Text>
                    <Text style={s.plain}>
                      {i.product_code} · {i.finish}
                    </Text>
                    <Text style={s.plain}>
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
                      <Text style={s.plain}>{label}</Text>
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
                  <Text style={s.plain}>
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
            {field(
              "newCategory",
              "Crear categoría (formato «Grupo / Subcategoría», p. ej. «Herrajes / Bisagras»)",
              { max: 80 },
            )}
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
            {field("finish", "Acabados (separa varios con comas)", {
              max: 60,
            })}
            <Text style={s.subtitle}>
              Precio 0 se muestra como «Consultar precio». Una URL HTTPS de
              imagen reemplaza la imagen ilustrativa.
            </Text>
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
            <Text style={s.plain}>
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
                    <Text style={s.plain}>
                      {m.type} · {m.quantity}
                    </Text>
                    <Text style={s.plain}>
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
                <Text style={s.plain}>
                  Teléfono: {data.customer.phone || "Sin registrar"}
                </Text>
                <Text style={s.plain}>
                  Correo: {data.customer.email || "Sin registrar"}
                </Text>
                {!!data.customer.address && (
                  <Text style={s.plain}>{data.customer.address}</Text>
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
            <Text style={s.plain}>
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
            {!data.notifications?.length && (
              <Text style={s.plain}>No hay notificaciones.</Text>
            )}
            {data.notifications?.map((n) =>
              card(
                n.id,
                <>
                  <Text style={s.name}>{n.read_at ? "Leída" : "Nueva"}</Text>
                  <Text style={s.plain}>{n.message}</Text>
                  <Text style={s.plain}>{n.created_at}</Text>
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
                {!!form.businessName && (
                  <Text style={s.plain}>{form.businessName}</Text>
                )}
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
            <Text style={s.sectionTitle}>Apariencia</Text>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Modo oscuro"
              accessibilityState={{ checked: dark }}
              disabled={!onDarkMode}
              onPress={() => onDarkMode?.(!dark)}
              style={s.menuRow}
            >
              <View style={s.grow}>
                <Text style={s.name}>Modo oscuro</Text>
                <Text style={s.subtitle}>
                  {dark
                    ? "Activado: colores oscuros que cansan menos la vista."
                    : "Desactivado: usa los colores claros de siempre."}
                </Text>
              </View>
              <View style={[s.switchTrack, dark && s.switchTrackOn]}>
                <View style={[s.switchKnob, dark && s.switchKnobOn]} />
              </View>
            </Pressable>
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
            {onPassword &&
              menuRow(
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
              setCatalogFilter(emptyFilter);
              go("catalogo", value);
            }}
          />
        )}
        {screen === "ia" && (
          <View>
            <Text style={s.title}>Asistente de materiales</Text>
            <Text style={s.plain}>
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
              <Text style={s.plain}>
                {data.company?.phone ?? "Teléfono pendiente de configurar"}
              </Text>
              <Text style={s.plain}>
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
            <View style={[s.tabPill, activeTab === next && s.tabPillActive]}>
              <Image
                source={
                  activeTab === next
                    ? (activeIcons[icon] ?? icons[icon])
                    : icons[icon]
                }
                style={[s.tabIcon, activeTab === next && s.activeIcon]}
              />
            </View>
            <Text
              selectable={false}
              numberOfLines={1}
              style={[s.tabLabel, activeTab === next && s.active]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
const baseStyles = {
  shell: { flex: 1, backgroundColor: "#f2f6fb" },
  grow: { flex: 1, minWidth: 0 },
  plain: { color: "#102c46" },
  switchTrack: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 3,
    backgroundColor: "#ccd9e5",
    justifyContent: "center",
  },
  switchTrackOn: { backgroundColor: "#007bff" },
  switchKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    shadowColor: "#0b2540",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  switchKnobOn: { alignSelf: "flex-end" },
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
  icon: { width: 21, height: 21, resizeMode: "contain", tintColor: "#102c46" },
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
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 6,
    shadowColor: "#0b2540",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 6,
  },
  tab: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    userSelect: "none",
  },
  tabPill: {
    width: 56,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  tabPillActive: { backgroundColor: "#e3eefb" },
  tabIcon: {
    width: 23,
    height: 23,
    tintColor: "#5d7489",
    resizeMode: "contain",
  },
  activeIcon: { tintColor: "#0066cc" },
  tabLabel: {
    color: "#5d7489",
    fontSize: 11.5,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  active: { color: "#0066cc", fontWeight: "800" },
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
    shadowColor: "#0b2540",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  thumb: {
    width: 96,
    aspectRatio: 4 / 3,
    borderRadius: 8,
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#edf1f5",
  },
  placeholderLogo: { width: 30, height: 30, opacity: 0.35, borderRadius: 15 },
  placeholderLogoLarge: {
    width: 64,
    height: 64,
    opacity: 0.3,
    borderRadius: 32,
  },
  placeholderTextSmall: { color: "#8a9bab", fontSize: 9, fontWeight: "600" },
  placeholderText: { color: "#8a9bab", fontSize: 13, fontWeight: "600" },
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
    width: "100%",
    aspectRatio: 4 / 3,
    resizeMode: "contain",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e6edf4",
  },
  imageWide: { maxHeight: 460 },
  imageFrame: { overflow: "hidden", backgroundColor: "#ffffff" },
  imageFill: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  imageNote: { color: "#6a7f92", fontSize: 11, lineHeight: 15, marginTop: 6 },
  productCard: { position: "relative", marginVertical: 4 },
  productTile: {
    flexDirection: "column",
    alignItems: "stretch",
    padding: 0,
    overflow: "hidden",
    marginVertical: 0,
    flex: 1,
  },
  tileImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderColor: "#eef2f6",
  },
  tileBody: { padding: 12, gap: 2 },
  tileLink: {
    color: "#0071d9",
    fontWeight: "700",
    fontSize: 13,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  cardMeta: {
    color: "#0071d9",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  cardDims: { color: "#405e77", fontSize: 12, marginTop: 1 },
  systemCard: { marginVertical: 4 },
  pricePending: { color: "#8a5a00" },
  favorite: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "#e1e9f1",
  },
  heart: { fontSize: 19, color: "#526b82", lineHeight: 22 },
  heartOn: { color: "#d6336c" },
  segment: {
    backgroundColor: "#e6eff8",
    borderRadius: 11,
    marginVertical: 6,
    flexGrow: 0,
  },
  segmentRow: { flexGrow: 1, padding: 3, gap: 3 },
  segmentItem: {
    flexGrow: 1,
    minHeight: 38,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  segmentOn: { backgroundColor: "#007bff" },
  segmentText: {
    color: "#405e77",
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  segmentTextOn: { color: "white" },
  chip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#cfdeec",
    backgroundColor: "white",
    paddingHorizontal: 13,
    minHeight: 36,
    justifyContent: "center",
  },
  chipOn: { backgroundColor: "#0a4579", borderColor: "#0a4579" },
  chipText: { color: "#334f68", fontSize: 13, fontWeight: "600" },
  chipTextOn: { color: "white" },
  resultCount: {
    color: "#526b82",
    fontSize: 12,
    marginTop: 6,
    marginBottom: 4,
  },
  loading: { alignItems: "center", gap: 8, paddingVertical: 30 },
  empty: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 28,
    paddingHorizontal: 12,
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e1e9f1",
    marginVertical: 8,
  },
  detailWide: { flexDirection: "row", alignItems: "flex-start", gap: 24 },
  detailMedia: { flex: 1, minWidth: 0 },
  detailInfo: { flex: 1.1, minWidth: 0, gap: 7 },
  specs: {
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e1e9f1",
    paddingHorizontal: 12,
    marginVertical: 6,
  },
  specRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderColor: "#eef3f8",
  },
  specLabel: { width: 108, color: "#526b82", fontSize: 13 },
  specValue: {
    flex: 1,
    color: "#102c46",
    fontSize: 13,
    fontWeight: "600",
  },
};

// ---------- Tema claro / oscuro ----------
// El modo oscuro se deriva de los mismos estilos: los colores de texto y de
// fondo/borde se traducen por separado (el texto blanco de los botones azules
// se conserva). Las zonas de imagen siguen blancas porque los renders tienen
// fondo blanco, como una fotografía de catálogo.
const DARK_TEXT = {
  "#102c46": "#e8eef5",
  "#526b82": "#9fb2c4",
  "#405e77": "#b3c4d4",
  "#334f68": "#c3d1de",
  "#5d7489": "#8fa4b8",
  "#0071d9": "#5aa9ff",
  "#0066cc": "#6cb2ff",
  "#6a7f92": "#8fa4b8",
  "#8a9bab": "#8fa4b8",
  "#674b18": "#f0d9a8",
  "#8a5a00": "#f2b84b",
};
const DARK_BACKGROUND = {
  white: "#16212e",
  "#fff": "#1c2a3a",
  "#f2f6fb": "#0e1621",
  "#e6eff8": "#1b2836",
  "#e1effc": "#1d3049",
  "#e7f1fb": "#1d3049",
  "#e9f2fb": "#1d3049",
  "#e3eefb": "#1f3550",
  "#fff2d6": "#3a2f14",
  "#0a4579": "#2f6fb5",
  "rgba(255,255,255,0.92)": "rgba(22,33,46,0.92)",
  "#e1e9f1": "#26364a",
  "#dce7f2": "#26364a",
  "#cfdeec": "#2c3e54",
  "#bdcee0": "#34485f",
  "#e5ebf2": "#223144",
  "#e6edf4": "#26364a",
  "#eef2f6": "#223144",
  "#eef3f8": "#223144",
  "#edf1f5": "#223144",
  "#ccd9e5": "#34485f",
};
const TEXT_KEYS = new Set(["color", "tintColor"]);
function darkVariant(styles) {
  return Object.fromEntries(
    Object.entries(styles).map(([name, style]) => [
      name,
      Object.fromEntries(
        Object.entries(style).map(([prop, value]) => {
          if (typeof value !== "string") return [prop, value];
          const map = TEXT_KEYS.has(prop)
            ? DARK_TEXT
            : /Color$/.test(prop)
              ? DARK_BACKGROUND
              : null;
          return [prop, map?.[value] ?? value];
        }),
      ),
    ]),
  );
}
const lightStyles = StyleSheet.create(baseStyles);
const darkStyles = StyleSheet.create(darkVariant(baseStyles));
// Hoja activa; BusinessApp la fija en cada render según el tema elegido.
let s = lightStyles;
