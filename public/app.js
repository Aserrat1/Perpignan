const state = {
  config: null,
  draft: null,
  screen: "home",
  tab: "pizza",
  sortMode: "default",
  cart: [],
  pizzaBuilder: { sizeId: null, splitMode: null, portions: [] },
  promoBuilder: null,
  validationErrors: new Set(),
  dirty: false,
  cartOpen: false,
  collapsedCategories: {},
  touchStartX: 0
};

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

const nodes = {
  businessName: $("#businessName"),
  appMode: $("#appMode"),
  backButton: $("#backButton"),
  syncButton: $("#syncButton"),
  homeScreen: $("#homeScreen"),
  calculatorScreen: $("#calculatorScreen"),
  settingsScreen: $("#settingsScreen"),
  sortMode: $("#sortMode"),
  cartBar: $("#cartBar"),
  cartCount: $("#cartCount"),
  cartTotal: $("#cartTotal"),
  cartToggle: $("#cartToggle"),
  cartArrow: $("#cartArrow"),
  cartDetail: $("#cartDetail"),
  cartItems: $("#cartItems"),
  clearCart: $("#clearCart"),
  builderWarning: $("#builderWarning"),
  pizzaSizeOptions: $("#pizzaSizeOptions"),
  pizzaSplitOptions: $("#pizzaSplitOptions"),
  pizzaProgress: $("#pizzaProgress"),
  pizzaList: $("#pizzaList"),
  empanadaList: $("#empanadaList"),
  adicionalList: $("#adicionalList"),
  adicionalPanel: $("#adicionalPanel"),
  promoPanel: $("#promoPanel"),
  promoList: $("#promoList"),
  promoModal: $("#promoModal"),
  promoModalTitle: $("#promoModalTitle"),
  promoModalBody: $("#promoModalBody"),
  promoModalTotal: $("#promoModalTotal"),
  closePromoModal: $("#closePromoModal"),
  addPromoToCart: $("#addPromoToCart"),
  saveConfig: $("#saveConfig"),
  resetDraft: $("#resetDraft"),
  settingBusinessName: $("#settingBusinessName"),
  settingCurrency: $("#settingCurrency"),
  settingTheme: $("#settingTheme"),
  settingPizzaNotes: $("#settingPizzaNotes"),
  settingDefaultSort: $("#settingDefaultSort"),
  categoryEditor: $("#categoryEditor"),
  sizeEditor: $("#sizeEditor"),
  productEditor: $("#productEditor"),
  promoEditor: $("#promoEditor")
};

const SIZE_ORDER = ["xl", "chica", "mediana"];
const SPLIT_PARTS = { halves: 2, quarters: 4 };
const PRODUCT_TYPES = ["pizza", "empanada", "adicional"];

window.addEventListener("error", event => {
  const location = event.filename ? `${event.filename.split("/").pop()}:${event.lineno}:${event.colno}` : "";
  console.error("Perpignan error", {
    message: event.message,
    filename: event.filename,
    line: event.lineno,
    column: event.colno,
    stack: event.error?.stack
  });
  showToast(`${event.message || "Error inesperado"} ${location}`, "error");
});

window.addEventListener("unhandledrejection", event => {
  console.error("Perpignan promise error", event.reason);
  showToast(event.reason?.message || "Error inesperado", "error");
});

window.addEventListener("beforeunload", event => {
  if (!hasUnsavedChanges()) return;
  event.preventDefault();
  event.returnValue = "";
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function money(value) {
  const currency = state.config?.settings?.currency || "$";
  return `${currency}${Math.round(Number(value) || 0).toLocaleString("es-AR")}`;
}

function safeQuantity(value, fallback = 1) {
  let number = fallback;
  try {
    number = Number(value);
  } catch {
    return fallback;
  }
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.floor(number));
}

function boundedCount(value, fallback = 1, max = 100) {
  const quantity = safeQuantity(value, fallback);
  return Math.min(max, Math.max(0, quantity));
}

function promoItemQuantity(item) {
  return Math.max(1, boundedCount(item?.quantity, 1, 50));
}

function safeArray(count, mapper) {
  const length = boundedCount(count, 0, 100);
  if (!Number.isSafeInteger(length) || length < 0) return [];
  return Array.from({ length }, mapper);
}

function validationKey(...parts) {
  return parts.join(".");
}

function invalidClass(...parts) {
  return state.validationErrors.has(validationKey(...parts)) ? " invalid-field" : "";
}

function isBlank(value) {
  return String(value ?? "").trim() === "";
}

function markDirty() {
  state.dirty = true;
}

function hasUnsavedChanges() {
  if (!state.config || !state.draft) return false;
  return stableConfigString(state.config) !== stableConfigString(state.draft);
}

function stableConfigString(config) {
  return JSON.stringify(normalizeConfig(structuredClone(config)));
}

function confirmDiscardChanges() {
  return !hasUnsavedChanges() || window.confirm("Tenes cambios sin guardar. ¿Salir sin guardar?");
}

function normalizeConfig(config) {
  const pizzaCategories = [
    { id: "pizza-comunes", type: "pizza", name: "Comunes", sort: 1 },
    { id: "pizza-cancheras", type: "pizza", name: "Cancheras", sort: 2 }
  ];
  const empanadaCategories = [
    { id: "empanada-clasicas", type: "empanada", name: "Clasicas", sort: 1 },
    { id: "empanada-premium", type: "empanada", name: "Premium", sort: 2 }
  ];
  const adicionalCategories = [
    { id: "adicional-bebidas", type: "adicional", name: "Bebidas", sort: 1 },
    { id: "adicional-otros", type: "adicional", name: "Otros", sort: 2 }
  ];

  config.settings = { defaultSort: "category", ...(config.settings || {}) };
  config.pizzaSizes = config.pizzaSizes || [];
  config.productCategories = config.productCategories || [...pizzaCategories, ...empanadaCategories, ...adicionalCategories];
  for (const category of [...pizzaCategories, ...empanadaCategories, ...adicionalCategories]) {
    if (!config.productCategories.some(existing => existing.id === category.id)) config.productCategories.push(category);
  }
  config.products = (config.products || []).map((product, index) => {
    const fallbackCategory = product.category === "pizza" ? "pizza-comunes" : product.category === "empanada" ? "empanada-clasicas" : "adicional-otros";
    return {
      ...product,
      sort: product.sort ?? index + 1,
      categoryId: product.categoryId || fallbackCategory,
      sizePrices: product.sizePrices || {}
    };
  });
  config.promotions = (config.promotions || []).map(promo => normalizePromo(promo));
  return config;
}

function normalizePromo(promo) {
  if (promo.items) return { ...promo, items: promo.items.map(normalizePromoItem) };
  return {
    id: promo.id || uid("promo"),
    name: promo.name || "Promo",
    price: Number(promo.price) || 0,
    active: promo.active !== false,
    items: [{
      id: uid("promo-item"),
      type: PRODUCT_TYPES.includes(promo.category) ? promo.category : "empanada",
      quantity: Number(promo.quantity) || 1,
      allowedProductIds: [],
      sizeId: "mediana",
      splitModes: promo.splitMode ? [promo.splitMode] : [""]
    }]
  };
}

function normalizePromoItem(item) {
  const splitModes = item.splitModes || (item.splitMode ? [item.splitMode] : [""]);
  return {
    ...item,
    type: PRODUCT_TYPES.includes(item.type) ? item.type : "empanada",
    quantity: promoItemQuantity(item),
    allowedProductIds: Array.isArray(item.allowedProductIds) ? item.allowedProductIds : [],
    splitModes: Array.isArray(splitModes) && splitModes.length ? splitModes : [""],
    splitMode: undefined
  };
}

function categoriesFor(type, source = state.config) {
  return (source.productCategories || [])
    .filter(category => category.type === type)
    .sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0));
}

function categoryName(id) {
  return state.config.productCategories.find(category => category.id === id)?.name || "Sin categoria";
}

function pizzaSizesForCalculator(source = state.config) {
  return [...source.pizzaSizes].sort((a, b) => {
    const aIndex = SIZE_ORDER.indexOf(a.id);
    const bIndex = SIZE_ORDER.indexOf(b.id);
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
  });
}

function activeProducts(type) {
  return state.config.products.filter(product => product.category === type && product.active);
}

function sortedProducts(type) {
  const products = activeProducts(type);
  const mode = state.sortMode === "default" ? state.config.settings.defaultSort : state.sortMode;
  const priceForSort = product => type === "pizza" && currentSize() ? pizzaFullPrice(product, currentSize()) : Number(product.price) || 0;
  const categorySort = product => state.config.productCategories.find(category => category.id === product.categoryId)?.sort ?? 999;

  return [...products].sort((a, b) => {
    if (mode === "name") return a.name.localeCompare(b.name, "es");
    if (mode === "priceAsc") return priceForSort(a) - priceForSort(b);
    if (mode === "priceDesc") return priceForSort(b) - priceForSort(a);
    if (mode === "category") {
      return categorySort(a) - categorySort(b) || (a.sort ?? 999) - (b.sort ?? 999) || a.name.localeCompare(b.name, "es");
    }
    return (a.sort ?? 999) - (b.sort ?? 999) || a.name.localeCompare(b.name, "es");
  });
}

function currentSize() {
  return state.config.pizzaSizes.find(size => size.id === state.pizzaBuilder.sizeId) || pizzaSizesForCalculator()[0];
}

function requiredPizzaParts() {
  return SPLIT_PARTS[state.pizzaBuilder.splitMode] || 0;
}

function pizzaInProgress() {
  return requiredPizzaParts() > 0 && state.pizzaBuilder.portions.length > 0;
}

function pizzaComplete() {
  const required = requiredPizzaParts();
  return required > 0 && state.pizzaBuilder.portions.length === required;
}

function getProduct(id, source = state.config) {
  return source.products.find(product => product.id === id);
}

function fixedSizePrice(product, size) {
  const value = product?.sizePrices?.[size?.id];
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pizzaFullPrice(product, size) {
  const fixed = fixedSizePrice(product, size);
  if (fixed !== null) return fixed;
  return (Number(product?.price) || 0) * (Number(size?.multiplier) || 1);
}

function pizzaPrice(size, portions) {
  const divisor = portions.length || 1;
  return portions.reduce((total, productId) => total + pizzaFullPrice(getProduct(productId), size) / divisor, 0);
}

function itemBasePrice(item) {
  return Number(item.price) || 0;
}

function cartTotals() {
  const remaining = state.cart.map(item => ({ ...item, used: false }));
  const promoLines = [];
  let total = 0;

  const promos = state.config.promotions
    .filter(promo => promo.active)
    .sort((a, b) => Number(b.price || 0) - Number(a.price || 0));

  for (const promo of promos) {
    let match = findPromoMatch(promo, remaining);
    while (match) {
      match.forEach(index => { remaining[index].used = true; });
      total += Number(promo.price) || 0;
      promoLines.push(promo.name);
      match = findPromoMatch(promo, remaining);
    }
  }

  total += remaining.filter(item => !item.used).reduce((sum, item) => sum + itemBasePrice(item), 0);
  const empanadas = state.cart.filter(item => item.type === "empanada").length;
  const pizzas = state.cart.filter(item => item.type === "pizza").length;
  const adicionales = state.cart.filter(item => item.type === "adicional").length;
  return { total, promoLines, count: state.cart.length, empanadas, pizzas, adicionales };
}

function findPromoMatch(promo, cartItems) {
  const selected = [];
  for (const requirement of promo.items || []) {
    const candidates = cartItems
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => !item.used && !selected.includes(index) && matchesPromoRequirement(item, requirement));
    const quantity = promoItemQuantity(requirement);
    if (candidates.length < quantity) return null;
    selected.push(...candidates.slice(0, quantity).map(candidate => candidate.index));
  }
  return selected;
}

function matchesPromoRequirement(item, requirement) {
  const allowed = requirement.allowedProductIds || [];
  if (item.type !== requirement.type) return false;
  if (item.type === "empanada" || item.type === "adicional") return allowed.length === 0 || allowed.includes(item.productId);
  if (requirement.sizeId && item.sizeId !== requirement.sizeId) return false;
  const splitModes = requirement.splitModes || (requirement.splitMode ? [requirement.splitMode] : [""]);
  if (splitModes.length && !splitModes.includes(item.splitMode || "")) return false;
  if (!allowed.length) return true;
  return (item.portions || []).every(productId => allowed.includes(productId));
}

async function loadConfig() {
  const response = await fetch("/api/config", { cache: "no-store" });
  if (!response.ok) throw new Error("No se pudo cargar la configuracion");
  state.config = normalizeConfig(await response.json());
  state.draft = structuredClone(state.config);
  state.dirty = false;
  state.sortMode = state.config.settings.defaultSort || "category";
  if (!state.pizzaBuilder.sizeId) state.pizzaBuilder.sizeId = pizzaSizesForCalculator()[0]?.id || null;
  applyTheme();
  render();
}

async function saveConfig() {
  syncDraftFromInputs();
  const validation = validateDraftConfig();
  state.validationErrors = validation.errors;
  if (validation.errors.size > 0) {
    renderSettings();
    showToast(`Faltan datos obligatorios (${validation.errors.size})`, "error");
    focusFirstInvalidField();
    return;
  }
  const response = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state.draft)
  });
  if (!response.ok) throw new Error("No se pudo guardar");
  state.config = normalizeConfig(await response.json());
  state.draft = structuredClone(state.config);
  state.dirty = false;
  state.sortMode = state.config.settings.defaultSort || "category";
  if (!currentSize()) resetPizzaBuilder(state.config.pizzaSizes[0]?.id || null);
  applyTheme();
  render();
  state.validationErrors = new Set();
  showToast("Cambios guardados");
}

function validateDraftConfig() {
  const errors = new Set();
  const productsByType = type => state.draft.products.filter(product => product.category === type);

  state.draft.promotions.forEach((promo, promoIndex) => {
    if (isBlank(promo.name)) errors.add(validationKey("promo", promoIndex, "name"));
    if (!Number.isFinite(Number(promo.price)) || Number(promo.price) < 0) errors.add(validationKey("promo", promoIndex, "price"));
    if (!Array.isArray(promo.items) || promo.items.length === 0) errors.add(validationKey("promo", promoIndex, "items"));

    (promo.items || []).forEach((item, itemIndex) => {
      if (!PRODUCT_TYPES.includes(item.type)) errors.add(validationKey("promo", promoIndex, "item", itemIndex, "type"));
      if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) < 1) errors.add(validationKey("promo", promoIndex, "item", itemIndex, "quantity"));
      if (productsByType(item.type).length === 0) errors.add(validationKey("promo", promoIndex, "item", itemIndex, "products"));

      if (item.type === "pizza") {
        if (isBlank(item.sizeId) || !state.draft.pizzaSizes.some(size => size.id === item.sizeId)) errors.add(validationKey("promo", promoIndex, "item", itemIndex, "sizeId"));
        if (!Array.isArray(item.splitModes) || item.splitModes.length === 0) errors.add(validationKey("promo", promoIndex, "item", itemIndex, "splitModes"));
      }
    });
  });

  return { errors };
}

function focusFirstInvalidField() {
  const firstInvalid = document.querySelector(".invalid-field input, .invalid-field select, .invalid-field textarea, .invalid-field");
  firstInvalid?.scrollIntoView({ block: "center", behavior: "smooth" });
}

function showToast(message, tone = "success") {
  let toast = $("#toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

function applyTheme() {
  document.documentElement.dataset.theme = state.config.settings.theme === "dark" ? "dark" : "light";
}

function resetPizzaBuilder(sizeId = state.pizzaBuilder.sizeId) {
  state.pizzaBuilder = { sizeId, splitMode: null, portions: [] };
}

function showScreen(screen) {
  if (state.screen === "settings" && screen !== "settings" && !confirmDiscardChanges()) return;
  state.screen = screen;
  state.cartOpen = false;
  if (screen === "calculator" && !["pizza", "empanada", "adicional", "promo"].includes(state.tab)) state.tab = "pizza";
  render();
}

function setTab(tab) {
  if ((tab === "empanada" || tab === "adicional" || tab === "promo") && pizzaInProgress() && !pizzaComplete()) {
    nodes.builderWarning.hidden = false;
    return;
  }
  state.tab = tab;
  renderCalculator();
}

function addEmpanada(product) {
  if (pizzaInProgress() && !pizzaComplete()) return;
  state.cart.push({ id: uid("item"), type: "empanada", productId: product.id, name: product.name, price: Number(product.price) || 0 });
  renderCart();
}

function addAdicional(product) {
  if (pizzaInProgress() && !pizzaComplete()) return;
  state.cart.push({ id: uid("item"), type: "adicional", productId: product.id, name: product.name, price: Number(product.price) || 0 });
  renderCart();
}

function addFullPizza(product) {
  const size = currentSize();
  if (!size) return;
  state.cart.push({
    id: uid("item"),
    type: "pizza",
    sizeId: size.id,
    sizeName: size.name,
    splitMode: null,
    portions: [product.id],
    name: `Pizza ${size.name}`,
    detail: [product.name],
    price: pizzaFullPrice(product, size)
  });
  renderCart();
}

function addPizzaPortion(product) {
  const size = currentSize();
  const required = requiredPizzaParts();
  if (!size || !required) {
    addFullPizza(product);
    return;
  }
  if (state.pizzaBuilder.portions.length >= required) return;
  state.pizzaBuilder.portions.push(product.id);
  if (pizzaComplete()) {
    const portions = [...state.pizzaBuilder.portions];
    const names = portions.map(id => getProduct(id)?.name || "Gusto eliminado");
    state.cart.push({
      id: uid("item"),
      type: "pizza",
      sizeId: size.id,
      sizeName: size.name,
      splitMode: state.pizzaBuilder.splitMode,
      portions,
      name: `Pizza ${size.name}`,
      detail: names,
      price: pizzaPrice(size, portions)
    });
    state.pizzaBuilder.portions = [];
  }
  renderCalculator();
  renderCart();
}

function removePizzaPortion(index) {
  state.pizzaBuilder.portions.splice(index, 1);
  renderCalculator();
}

function removeCartItem(id) {
  state.cart = state.cart.filter(item => item.id !== id);
  renderCart();
}

function render() {
  const isHome = state.screen === "home";
  nodes.homeScreen.hidden = !isHome;
  nodes.calculatorScreen.hidden = state.screen !== "calculator";
  nodes.settingsScreen.hidden = state.screen !== "settings";
  nodes.backButton.hidden = isHome;
  nodes.cartBar.hidden = state.screen !== "calculator";
  nodes.businessName.textContent = state.config?.settings?.businessName || "Pizzeria";
  nodes.appMode.textContent = state.screen === "calculator" ? "Calcular" : state.screen === "settings" ? "Configurar" : "Menu";

  if (state.screen === "calculator") renderCalculator();
  if (state.screen === "settings") renderSettings();
  renderCart();
}

function renderCalculator() {
  nodes.sortMode.value = state.sortMode;
  $$(".segment").forEach(button => button.classList.toggle("active", button.dataset.tab === state.tab));
  $("#pizzaPanel").classList.toggle("active", state.tab === "pizza");
  $("#empanadaPanel").classList.toggle("active", state.tab === "empanada");
  nodes.adicionalPanel.classList.toggle("active", state.tab === "adicional");
  nodes.promoPanel.classList.toggle("active", state.tab === "promo");
  nodes.builderWarning.hidden = !pizzaInProgress() || pizzaComplete();

  renderPizzaControls();
  renderPizzaProgress();
  nodes.pizzaList.innerHTML = productListHtml("pizza");
  nodes.empanadaList.innerHTML = productListHtml("empanada");
  nodes.adicionalList.innerHTML = productListHtml("adicional");
  renderPromotionsScreen();
}

function renderPizzaControls() {
  const sizes = pizzaSizesForCalculator();
  if (!state.pizzaBuilder.sizeId && sizes[0]) state.pizzaBuilder.sizeId = sizes[0].id;
  const size = currentSize();
  nodes.pizzaSizeOptions.innerHTML = sizes.map(sizeOption => `
    <button class="option-button ${sizeOption.id === state.pizzaBuilder.sizeId ? "active" : ""}" data-size="${escapeHtml(sizeOption.id)}" ${pizzaInProgress() ? "disabled" : ""}>${escapeHtml(sizeOption.name)}</button>
  `).join("");

  const splitOptions = size?.id === "xl"
    ? [{ mode: "halves", label: "Mitades" }, { mode: "quarters", label: "Cuartos" }]
    : [{ mode: "halves", label: "Mitades" }];

  nodes.pizzaSplitOptions.innerHTML = splitOptions.map(option => `
    <button class="option-button ${state.pizzaBuilder.splitMode === option.mode ? "active" : ""}" data-split="${option.mode}" ${pizzaInProgress() ? "disabled" : ""}>${option.label}</button>
  `).join("");
}

function renderPizzaProgress() {
  const required = requiredPizzaParts();
  const size = currentSize();
  nodes.pizzaProgress.hidden = required === 0;
  if (!required || !size) {
    nodes.pizzaProgress.innerHTML = "";
    return;
  }
  const modeLabel = state.pizzaBuilder.splitMode === "quarters" ? "cuartos" : "mitades";
  nodes.pizzaProgress.innerHTML = `
    <details class="builder-detail">
      <summary>Pizza en ${modeLabel}: ${state.pizzaBuilder.portions.length}/${required} partes elegidas</summary>
      <div class="builder-parts">
        ${safeArray(required, (_, index) => {
          const product = getProduct(state.pizzaBuilder.portions[index]);
          const label = product ? product.name : `Parte ${index + 1} sin elegir`;
          const price = product ? money(pizzaFullPrice(product, size) / required) : "";
          return `
            <div class="progress-line">
              <div><strong>${index + 1}/${required} ${escapeHtml(label)}</strong><small>${escapeHtml(price)}</small></div>
              ${product ? `<button type="button" data-remove-portion="${index}" aria-label="Quitar parte">x</button>` : ""}
            </div>
          `;
        }).join("")}
      </div>
    </details>
  `;
}

function productListHtml(type) {
  const products = sortedProducts(type);
  if (!products.length) return `<p class="empty">No hay gustos activos.</p>`;
  const mode = state.sortMode === "default" ? state.config.settings.defaultSort : state.sortMode;
  if (!["category", "default"].includes(mode)) return products.map(product => productButton(product, type)).join("");

  return categoriesFor(type).map(category => {
    const categoryProducts = products.filter(product => product.categoryId === category.id);
    if (!categoryProducts.length) return "";
    const collapsed = state.collapsedCategories[category.id];
    return `
      <details class="category-group" ${collapsed ? "" : "open"} data-category-group="${escapeHtml(category.id)}">
        <summary>${escapeHtml(category.name)} <span>${categoryProducts.length}</span></summary>
        <div class="taste-list">${categoryProducts.map(product => productButton(product, type)).join("")}</div>
      </details>
    `;
  }).join("");
}

function productButton(product, type) {
  const disabled = type === "empanada" && pizzaInProgress() && !pizzaComplete() ? "disabled" : "";
  const size = currentSize();
  const price = type === "pizza" && size ? pizzaFullPrice(product, size) : product.price;
  const suffix = type === "pizza" && requiredPizzaParts() ? ` / ${requiredPizzaParts()}` : "";
  return `
    <button class="product-row" data-add-${type}="${escapeHtml(product.id)}" ${disabled}>
      <span>
        <strong>${escapeHtml(product.name)}</strong>
        <small>${escapeHtml(categoryName(product.categoryId))} · ${escapeHtml(product.description || "Sin descripcion")}</small>
      </span>
      <span class="price-pill">${escapeHtml(money(price))}${suffix}</span>
    </button>
  `;
}

function renderPromotionsScreen() {
  const promos = state.config.promotions.filter(promo => promo.active);
  nodes.promoList.innerHTML = promos.map(promo => `
    <button class="promo-card" data-open-promo="${escapeHtml(promo.id)}">
      <span>
        <strong>${escapeHtml(promo.name)}</strong>
        <small>${escapeHtml(promoSummary(promo))}</small>
      </span>
      <span class="price-pill">${escapeHtml(money(promo.price))}</span>
    </button>
  `).join("") || `<p class="empty">No hay promociones activas.</p>`;
}

function promoSummary(promo) {
  return (promo.items || []).map(item => {
    if (item.type === "empanada") return `${promoItemQuantity(item)} empanadas`;
    if (item.type === "adicional") return `${promoItemQuantity(item)} adicionales`;
    const size = state.config.pizzaSizes.find(s => s.id === item.sizeId)?.name || "Pizza";
    const modes = item.splitModes || (item.splitMode ? [item.splitMode] : [""]);
    const split = modes.map(splitModeLabel).join("/");
    return `${promoItemQuantity(item)} pizza ${size}${split}`;
  }).join(" + ");
}

function splitModeLabel(mode) {
  if (mode === "quarters") return "cuartos";
  if (mode === "halves") return "mitades";
  return "entera";
}

function openPromoModal(promoId) {
  const promo = state.config.promotions.find(item => item.id === promoId);
  if (!promo) return;
  try {
    state.promoBuilder = {
      promoId,
      selections: (promo.items || []).map(item => ({
        itemId: item.id,
        empanadas: {},
        pizzas: []
      }))
    };
    nodes.promoModal.hidden = false;
    renderPromoModal();
  } catch (error) {
    state.promoBuilder = null;
    nodes.promoModal.hidden = true;
    showToast("No se pudo abrir la promo. Revisá su configuración.", "error");
  }
}

function defaultPromoPizzaSelection(item) {
  if (item.type !== "pizza") return [];
  const mode = (item.splitModes || [""])[0] || "";
  const required = SPLIT_PARTS[mode] || 1;
  const allowed = item.allowedProductIds || [];
  const parts = allowed.length === 1 ? safeArray(required, () => allowed[0]) : allowed.length === required ? [...allowed] : [];
  return { splitMode: mode, parts };
}

function closePromoModal() {
  state.promoBuilder = null;
  nodes.promoModal.hidden = true;
}

function currentPromo() {
  return state.config.promotions.find(promo => promo.id === state.promoBuilder?.promoId);
}

function renderPromoModal() {
  const promo = currentPromo();
  if (!promo) return;
  nodes.promoModalTitle.textContent = promo.name;
  nodes.promoModalTotal.textContent = money(promo.price);
  nodes.addPromoToCart.disabled = !promoReady(promo);
  nodes.promoModalBody.innerHTML = (promo.items || []).map((item, index) => promoItemHtml(promo, item, index)).join("");
}

function promoItemHtml(promo, item, itemIndex) {
  const selection = state.promoBuilder.selections[itemIndex];
  if (item.type === "empanada" || item.type === "adicional") {
    const allowed = allowedProducts(item, item.type);
    const requiredQuantity = promoItemQuantity(item);
    const chosen = Object.values(selection.empanadas).reduce((sum, value) => sum + safeQuantity(value, 0), 0);
    const label = item.type === "adicional" ? "adicionales" : "empanadas";
    return `
      <section class="promo-section">
        <h3>${escapeHtml(requiredQuantity)} ${label} <small>${chosen}/${requiredQuantity}</small></h3>
        <div class="quantity-list">
          ${allowed.map(product => `
            <div class="quantity-row">
              <span>${escapeHtml(product.name)}</span>
              <input data-promo-product="${escapeHtml(product.id)}" data-promo-item="${itemIndex}" type="number" min="0" max="${requiredQuantity}" value="${selection.empanadas[product.id] || 0}">
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }

  return `
    <section class="promo-section">
      <h3>${escapeHtml(promoItemQuantity(item))} pizza ${escapeHtml(state.config.pizzaSizes.find(size => size.id === item.sizeId)?.name || "")}</h3>
      ${safeArray(promoItemQuantity(item), (_, pizzaIndex) => {
        if (!selection.pizzas[pizzaIndex]) selection.pizzas[pizzaIndex] = defaultPromoPizzaSelection(item);
        return promoPizzaHtml(item, itemIndex, pizzaIndex, selection.pizzas[pizzaIndex]);
      }).join("")}
    </section>
  `;
}

function promoPizzaHtml(item, itemIndex, pizzaIndex, pizzaSelection) {
  const allowed = allowedProducts(item, "pizza");
  const selection = Array.isArray(pizzaSelection) ? { splitMode: item.splitMode || "", parts: pizzaSelection } : pizzaSelection;
  const splitModes = item.splitModes || (item.splitMode ? [item.splitMode] : [""]);
  const required = SPLIT_PARTS[selection.splitMode] || 1;
  return `
    <div class="promo-pizza-box">
      <strong>Pizza ${pizzaIndex + 1}: ${splitModeLabel(selection.splitMode)} ${selection.parts.length}/${required}</strong>
      ${splitModes.length > 1 ? `
        <label>Division
          <select data-promo-pizza-split="${pizzaIndex}" data-promo-item="${itemIndex}">
            ${splitModes.map(mode => `<option value="${escapeHtml(mode)}" ${mode === selection.splitMode ? "selected" : ""}>${escapeHtml(splitModeLabel(mode))}</option>`).join("")}
          </select>
        </label>
      ` : ""}
      <div class="taste-list compact">
        ${allowed.map(product => `
          <button class="product-row" data-promo-pizza="${escapeHtml(product.id)}" data-promo-item="${itemIndex}" data-promo-pizza-index="${pizzaIndex}" ${selection.parts.length >= required ? "disabled" : ""}>
            <span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(categoryName(product.categoryId))}</small></span>
          </button>
        `).join("")}
      </div>
      <div class="chosen-line">
        ${selection.parts.map((productId, partIndex) => `<button class="chip" data-remove-promo-pizza-part="${partIndex}" data-promo-item="${itemIndex}" data-promo-pizza-index="${pizzaIndex}">${escapeHtml(getProduct(productId)?.name || "Gusto")}</button>`).join("")}
      </div>
    </div>
  `;
}

function allowedProducts(item, type) {
  const allowed = item.allowedProductIds || [];
  return activeProducts(type).filter(product => allowed.length === 0 || allowed.includes(product.id));
}

function promoReady(promo) {
  return (promo.items || []).every((item, index) => {
    const selection = state.promoBuilder.selections[index];
    if (item.type === "empanada" || item.type === "adicional") {
      const chosen = Object.values(selection.empanadas).reduce((sum, value) => sum + safeQuantity(value, 0), 0);
      return chosen === promoItemQuantity(item);
    }
    return selection.pizzas.every(pizza => {
      const pizzaSelection = Array.isArray(pizza) ? { splitMode: item.splitMode || "", parts: pizza } : pizza;
      return pizzaSelection.parts.length === (SPLIT_PARTS[pizzaSelection.splitMode] || 1);
    });
  });
}

function addCurrentPromoToCart() {
  const promo = currentPromo();
  if (!promo || !promoReady(promo)) return;
  const detail = [];
  const children = [];

  promo.items.forEach((item, index) => {
    const selection = state.promoBuilder.selections[index];
    if (item.type === "empanada" || item.type === "adicional") {
      Object.entries(selection.empanadas).forEach(([productId, quantity]) => {
        const product = getProduct(productId);
        for (let count = 0; count < safeQuantity(quantity, 0); count++) {
          children.push({ type: item.type, productId, name: product?.name || "Producto", price: Number(product?.price) || 0 });
        }
        if (quantity > 0) detail.push(`${quantity} ${product?.name || "Producto"}`);
      });
      return;
    }

    const size = state.config.pizzaSizes.find(pizzaSize => pizzaSize.id === item.sizeId) || currentSize();
    selection.pizzas.forEach(pizzaSelectionRaw => {
      const pizzaSelection = Array.isArray(pizzaSelectionRaw) ? { splitMode: item.splitMode || "", parts: pizzaSelectionRaw } : pizzaSelectionRaw;
      const parts = pizzaSelection.parts;
      const names = parts.map(productId => getProduct(productId)?.name || "Gusto");
      const price = pizzaPrice(size, parts);
      children.push({
        type: "pizza",
        sizeId: size.id,
        sizeName: size.name,
        splitMode: pizzaSelection.splitMode || null,
        portions: parts,
        name: `Pizza ${size.name}`,
        detail: names,
        price
      });
      detail.push(`Pizza ${size.name}: ${names.join(" / ")}`);
    });
  });

  state.cart.push({ id: uid("promo-cart"), type: "promo", promoId: promo.id, name: promo.name, detail, price: Number(promo.price) || 0, children });
  closePromoModal();
  renderCart();
}

function flattenedCartItems() {
  return state.cart.flatMap(item => item.type === "promo" ? [{ ...item, fixedPromo: true }] : [item]);
}

function renderCart() {
  const originalCart = state.cart;
  const promoItems = originalCart.filter(item => item.type === "promo");
  const normalItems = originalCart.filter(item => item.type !== "promo");
  const savedCart = state.cart;
  state.cart = normalItems;
  const autoTotals = state.config ? cartTotals() : { total: 0, count: 0, empanadas: 0, pizzas: 0, adicionales: 0, promoLines: [] };
  state.cart = savedCart;
  const fixedTotal = promoItems.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const fixedLines = promoItems.map(item => item.name);
  const totals = {
    ...autoTotals,
    total: autoTotals.total + fixedTotal,
    promoLines: [...fixedLines, ...autoTotals.promoLines],
    count: state.cart.length,
    empanadas: state.cart.filter(item => item.type === "empanada").length,
    pizzas: state.cart.filter(item => item.type === "pizza").length,
    adicionales: state.cart.filter(item => item.type === "adicional").length
  };

  const parts = [];
  if (totals.empanadas) parts.push(`${totals.empanadas} empanadas`);
  if (totals.pizzas) parts.push(`${totals.pizzas} pizzas`);
  if (totals.adicionales) parts.push(`${totals.adicionales} adicionales`);
  if (promoItems.length) parts.push(`${promoItems.length} promos`);
  nodes.cartCount.textContent = parts.join(", ") || "Sin productos";
  nodes.cartTotal.textContent = money(totals.total);
  nodes.cartDetail.hidden = !state.cartOpen;
  nodes.cartArrow.textContent = state.cartOpen ? "v" : "^";

  const promoHtml = totals.promoLines.length
    ? `<div class="cart-item"><div><strong>Promociones aplicadas</strong><small>${escapeHtml(totals.promoLines.join(", "))}</small></div><span></span><span></span></div>`
    : "";

  nodes.cartItems.innerHTML = promoHtml + state.cart.map(item => {
    const detail = item.type === "pizza" ? item.detail.join(" / ") : item.type === "promo" ? item.detail.join(" - ") : item.type === "adicional" ? "Adicional" : "Empanada";
    return `
      <div class="cart-item">
        <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(detail)}</small></div>
        <span>${escapeHtml(money(item.price))}</span>
        <button class="remove-line" data-remove-cart="${escapeHtml(item.id)}" aria-label="Quitar">x</button>
      </div>
    `;
  }).join("");
}

function renderSettings() {
  nodes.settingBusinessName.value = state.draft.settings.businessName || "";
  nodes.settingCurrency.value = state.draft.settings.currency || "$";
  nodes.settingTheme.checked = state.draft.settings.theme === "dark";
  nodes.settingPizzaNotes.checked = Boolean(state.draft.settings.allowPizzaNotes);
  nodes.settingDefaultSort.value = state.draft.settings.defaultSort || "category";
  renderCategoryEditor();
  renderSizeEditor();
  renderProductEditor();
  renderPromoEditor();
}

function renderCategoryEditor() {
  nodes.categoryEditor.innerHTML = `<div class="editor-list">${state.draft.productCategories.map((category, index) => `
    <div class="editor-card">
      <div class="editor-row">
        <label>Nombre<input data-category-field="name" data-index="${index}" value="${escapeHtml(category.name)}"></label>
        <label>Orden<input data-category-field="sort" data-index="${index}" type="number" value="${escapeHtml(category.sort)}"></label>
      </div>
      <div class="editor-row">
        <label>Tipo
          <select data-category-field="type" data-index="${index}">
            <option value="pizza" ${category.type === "pizza" ? "selected" : ""}>Pizza</option>
            <option value="empanada" ${category.type === "empanada" ? "selected" : ""}>Empanada</option>
            <option value="adicional" ${category.type === "adicional" ? "selected" : ""}>Adicional</option>
          </select>
        </label>
        <button class="danger" data-remove-category="${index}">Quitar</button>
      </div>
    </div>
  `).join("")}</div>`;
}

function addDraftCategory(type) {
  state.draft.productCategories ||= [];
  state.draft.productCategories.push({
    id: uid(`${type}-cat`),
    type,
    name: type === "pizza" ? "Nueva categoria pizza" : type === "empanada" ? "Nueva categoria empanada" : "Nueva categoria adicional",
    sort: categoriesFor(type, state.draft).length + 1
  });
  renderCategoryEditor();
  renderProductEditor();
  renderPromoEditor();
}

function renderSizeEditor() {
  nodes.sizeEditor.innerHTML = `<div class="editor-list">${state.draft.pizzaSizes.map((size, index) => `
    <div class="editor-card">
      <div class="editor-row">
        <label>Nombre<input data-size-field="name" data-index="${index}" value="${escapeHtml(size.name)}"></label>
        <label>Multiplicador<input data-size-field="multiplier" data-index="${index}" type="number" min="0.1" step="0.01" value="${escapeHtml(size.multiplier)}"></label>
      </div>
      <button class="danger" data-remove-size="${index}">Quitar</button>
    </div>
  `).join("")}</div>`;
}

function categoryOptions(type, selectedId) {
  return categoriesFor(type, state.draft).map(category => `<option value="${escapeHtml(category.id)}" ${category.id === selectedId ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("");
}

function productTypeLabel(type) {
  if (type === "pizza") return "Pizzas";
  if (type === "empanada") return "Empanadas";
  return "Adicionales";
}

function draftProductsByType(type) {
  return state.draft.products
    .map((product, index) => ({ product, index }))
    .filter(entry => entry.product.category === type)
    .sort((a, b) => {
      const catA = state.draft.productCategories.find(category => category.id === a.product.categoryId)?.sort ?? 999;
      const catB = state.draft.productCategories.find(category => category.id === b.product.categoryId)?.sort ?? 999;
      return catA - catB || (a.product.sort ?? 999) - (b.product.sort ?? 999) || a.product.name.localeCompare(b.product.name, "es");
    });
}

function renderProductEditor() {
  const sizePriceInputs = product => state.draft.pizzaSizes.map(size => `
    <label>${escapeHtml(size.name)}
      <input data-product-size-price="${escapeHtml(size.id)}" data-index="__INDEX__" type="number" min="0" placeholder="Usar multiplicador" value="${escapeHtml(product.sizePrices?.[size.id] ?? "")}">
    </label>
  `).join("");

  const productCard = ({ product, index }) => `
    <details class="product-config-card" data-product-config>
      <summary class="product-config-summary">
        <span>
          <strong>${escapeHtml(product.name || "Producto sin nombre")}</strong>
          <small>${escapeHtml(money(product.price))} · ${escapeHtml(productTypeLabel(product.category))} · ${escapeHtml(categoryNameForDraft(product.categoryId))}</small>
        </span>
      </summary>
      <div class="product-config-body">
        <div class="editor-row">
          <label>Nombre<input data-product-field="name" data-index="${index}" value="${escapeHtml(product.name)}"></label>
          <label>Precio base<input data-product-field="price" data-index="${index}" type="number" min="0" value="${escapeHtml(product.price)}"></label>
        </div>
        <div class="editor-row">
          <label>Tipo
            <select data-product-field="category" data-index="${index}">
              <option value="pizza" ${product.category === "pizza" ? "selected" : ""}>Pizza</option>
              <option value="empanada" ${product.category === "empanada" ? "selected" : ""}>Empanada</option>
              <option value="adicional" ${product.category === "adicional" ? "selected" : ""}>Adicional</option>
            </select>
          </label>
          <label>Categoria
            <select data-product-field="categoryId" data-index="${index}">${categoryOptions(product.category, product.categoryId)}</select>
          </label>
        </div>
        <div class="editor-row">
          <label>Orden<input data-product-field="sort" data-index="${index}" type="number" value="${escapeHtml(product.sort ?? 0)}"></label>
          <label class="toggle-row"><input data-product-field="active" data-index="${index}" type="checkbox" ${product.active ? "checked" : ""}> Activo</label>
        </div>
        ${product.category === "pizza" ? `<div class="size-price-grid">${sizePriceInputs(product).replaceAll("__INDEX__", String(index))}</div>` : ""}
        <label>Descripcion<textarea data-product-field="description" data-index="${index}">${escapeHtml(product.description || "")}</textarea></label>
        <button class="danger" data-remove-product="${index}">Quitar</button>
      </div>
    </details>
  `;

  nodes.productEditor.innerHTML = `<div class="editor-list">${PRODUCT_TYPES.map(type => {
    const products = draftProductsByType(type);
    return `
      <details class="product-type-group" data-product-type-group>
        <summary>${productTypeLabel(type)} <span>${products.length}</span></summary>
        <div class="product-type-body">
          ${products.map(productCard).join("") || `<p class="empty">No hay productos.</p>`}
        </div>
      </details>
    `;
  }).join("")}</div>`;
}

function categoryNameForDraft(categoryId) {
  return state.draft.productCategories.find(category => category.id === categoryId)?.name || "Sin categoria";
}

function renderPromoEditor() {
  nodes.promoEditor.innerHTML = `<div class="editor-list">${state.draft.promotions.map((promo, promoIndex) => `
    <details class="promo-config-card${state.validationErrors.has(validationKey("promo", promoIndex, "items")) ? " invalid-field" : ""}" data-promo-config>
      <summary class="promo-config-summary">
        <span>
          <strong>${escapeHtml(promo.name || "Promocion sin nombre")} *</strong>
          <small>${escapeHtml(money(promo.price))}</small>
        </span>
        <label class="toggle-row promo-active-toggle">
          <input data-promo-field="active" data-promo-index="${promoIndex}" type="checkbox" ${promo.active ? "checked" : ""}>
          Activa
        </label>
      </summary>
      <div class="promo-config-body">
        <div class="editor-row">
          <label class="${invalidClass("promo", promoIndex, "name")}">Nombre *<input data-promo-field="name" data-promo-index="${promoIndex}" value="${escapeHtml(promo.name)}"></label>
          <label class="${invalidClass("promo", promoIndex, "price")}">Precio promo *<input data-promo-field="price" data-promo-index="${promoIndex}" type="number" min="0" value="${escapeHtml(promo.price)}"></label>
        </div>
        <small class="editor-help">Agrega uno o mas items. Ej: 12 empanadas, o 1 pizza + 6 empanadas. Si no marcas gustos permitidos, se permite cualquiera.</small>
        ${state.validationErrors.has(validationKey("promo", promoIndex, "items")) ? `<small class="field-error">La promocion necesita al menos un item.</small>` : ""}
        <div class="promo-config-list">
          ${(promo.items || []).map((item, itemIndex) => promoConfigItemHtml(promoIndex, itemIndex, item)).join("")}
        </div>
        <div class="two-buttons">
          <button class="secondary" data-add-promo-item="empanada" data-promo-index="${promoIndex}">Item empanadas</button>
          <button class="secondary" data-add-promo-item="pizza" data-promo-index="${promoIndex}">Item pizza</button>
          <button class="secondary" data-add-promo-item="adicional" data-promo-index="${promoIndex}">Item adicional</button>
        </div>
        <button class="danger" data-remove-promo="${promoIndex}">Quitar promocion</button>
      </div>
    </details>
  `).join("")}</div>`;
}

function promoConfigItemHtml(promoIndex, itemIndex, item) {
  const products = state.draft.products.filter(product => product.category === item.type);
  const allowedCount = (item.allowedProductIds || []).length;
  const itemHasError = ["type", "quantity", "products", "sizeId", "splitModes"].some(field => state.validationErrors.has(validationKey("promo", promoIndex, "item", itemIndex, field)));
  return `
    <div class="promo-config-item${itemHasError ? " invalid-field" : ""}">
      <strong>Item ${itemIndex + 1}: ${item.type === "pizza" ? "Pizza" : item.type === "adicional" ? "Adicionales" : "Empanadas"} *</strong>
      <div class="editor-row">
        <label class="${invalidClass("promo", promoIndex, "item", itemIndex, "type")}">Tipo *
          <select data-promo-item-field="type" data-promo-index="${promoIndex}" data-item-index="${itemIndex}">
            <option value="empanada" ${item.type === "empanada" ? "selected" : ""}>Empanadas</option>
            <option value="pizza" ${item.type === "pizza" ? "selected" : ""}>Pizza</option>
            <option value="adicional" ${item.type === "adicional" ? "selected" : ""}>Adicionales</option>
          </select>
        </label>
        <label class="${invalidClass("promo", promoIndex, "item", itemIndex, "quantity")}">Cantidad *<input data-promo-item-field="quantity" data-promo-index="${promoIndex}" data-item-index="${itemIndex}" type="number" min="1" value="${escapeHtml(item.quantity)}"></label>
      </div>
      ${item.type === "pizza" ? `
        <div class="editor-row">
          <label class="${invalidClass("promo", promoIndex, "item", itemIndex, "sizeId")}">Tamano *
            <select data-promo-item-field="sizeId" data-promo-index="${promoIndex}" data-item-index="${itemIndex}">
              ${state.draft.pizzaSizes.map(size => `<option value="${escapeHtml(size.id)}" ${size.id === item.sizeId ? "selected" : ""}>${escapeHtml(size.name)}</option>`).join("")}
            </select>
          </label>
          <label class="${invalidClass("promo", promoIndex, "item", itemIndex, "splitModes")}">Divisiones permitidas *
            <select data-promo-split-modes data-promo-index="${promoIndex}" data-item-index="${itemIndex}" multiple size="3">
              <option value="" ${(item.splitModes || [""]).includes("") ? "selected" : ""}>Enteras</option>
              <option value="halves" ${(item.splitModes || []).includes("halves") ? "selected" : ""}>Mitades</option>
              <option value="quarters" ${(item.splitModes || []).includes("quarters") ? "selected" : ""}>Cuartos</option>
            </select>
          </label>
        </div>
      ` : ""}
      ${state.validationErrors.has(validationKey("promo", promoIndex, "item", itemIndex, "products")) ? `<small class="field-error">No hay productos cargados para este tipo.</small>` : ""}
      <details>
        <summary>Gustos permitidos ${allowedCount ? `(${allowedCount})` : "(cualquiera)"}</summary>
        <small class="editor-help">Marca solo los gustos validos para esta parte de la promo. Dejalo todo sin marcar para permitir todos.</small>
        <div class="check-grid">
          ${products.map(product => `
            <label class="toggle-row">
              <input data-promo-allowed="${escapeHtml(product.id)}" data-promo-index="${promoIndex}" data-item-index="${itemIndex}" type="checkbox" ${(item.allowedProductIds || []).includes(product.id) ? "checked" : ""}>
              ${escapeHtml(product.name)}
            </label>
          `).join("")}
        </div>
      </details>
      <button class="danger" data-remove-promo-item="${itemIndex}" data-promo-index="${promoIndex}">Quitar item</button>
    </div>
  `;
}

function syncDraftFromInputs() {
  state.draft.settings.businessName = nodes.settingBusinessName.value.trim() || "Pizzeria";
  state.draft.settings.currency = nodes.settingCurrency.value.trim() || "$";
  state.draft.settings.theme = nodes.settingTheme.checked ? "dark" : "light";
  state.draft.settings.allowPizzaNotes = nodes.settingPizzaNotes.checked;
  state.draft.settings.defaultSort = nodes.settingDefaultSort.value || "category";
}

document.addEventListener("click", event => {
  if (event.target.closest(".promo-active-toggle")) {
    event.stopPropagation();
    if (event.target.tagName !== "INPUT") event.preventDefault();
  }
  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.screen) showScreen(target.dataset.screen);
  if (target.dataset.tab) setTab(target.dataset.tab);
  if (target.dataset.size) { resetPizzaBuilder(target.dataset.size); renderCalculator(); }
  if (target.dataset.split) {
    state.pizzaBuilder.splitMode = state.pizzaBuilder.splitMode === target.dataset.split ? null : target.dataset.split;
    state.pizzaBuilder.portions = [];
    renderCalculator();
  }
  if (target.dataset.addPizza) addPizzaPortion(getProduct(target.dataset.addPizza));
  if (target.dataset.addEmpanada) addEmpanada(getProduct(target.dataset.addEmpanada));
  if (target.dataset.addAdicional) addAdicional(getProduct(target.dataset.addAdicional));
  if (target.dataset.removePortion) removePizzaPortion(Number(target.dataset.removePortion));
  if (target.dataset.removeCart) removeCartItem(target.dataset.removeCart);
  if (target.dataset.openPromo) openPromoModal(target.dataset.openPromo);
  if (target.dataset.promoPizza) addPromoPizzaPart(target);
  if (target.dataset.removePromoPizzaPart) removePromoPizzaPart(target);

  if (target.dataset.removeCategory) { state.draft.productCategories.splice(Number(target.dataset.removeCategory), 1); renderCategoryEditor(); renderProductEditor(); }
  if (target.dataset.removeSize) { state.draft.pizzaSizes.splice(Number(target.dataset.removeSize), 1); renderSizeEditor(); renderProductEditor(); renderPromoEditor(); }
  if (target.dataset.removeProduct) { state.draft.products.splice(Number(target.dataset.removeProduct), 1); renderProductEditor(); renderPromoEditor(); }
  if (target.dataset.removePromo) { state.draft.promotions.splice(Number(target.dataset.removePromo), 1); renderPromoEditor(); }
  if (target.dataset.removePromoItem) {
    state.draft.promotions[Number(target.dataset.promoIndex)].items.splice(Number(target.dataset.removePromoItem), 1);
    renderPromoEditor();
  }
  if (target.dataset.addPromoItem) {
    const type = target.dataset.addPromoItem;
    state.draft.promotions[Number(target.dataset.promoIndex)].items.push({
      id: uid("promo-item"),
      type,
      quantity: type === "pizza" ? 1 : 6,
      allowedProductIds: [],
      sizeId: "mediana",
      splitModes: [""]
    });
    renderPromoEditor();
  }

  if (target.id === "backButton") showScreen("home");
  if (target.id === "syncButton") loadConfig();
  if (target.id === "cartToggle") { state.cartOpen = !state.cartOpen; renderCart(); }
  if (target.id === "clearCart") { state.cart = []; renderCart(); }
  if (target.id === "resetDraft") { state.draft = structuredClone(state.config); state.dirty = false; state.validationErrors = new Set(); renderSettings(); showToast("Cambios deshechos"); }
  if (target.id === "saveConfig") saveConfig();
  if (target.id === "closePromoModal") closePromoModal();
  if (target.id === "addPromoToCart") addCurrentPromoToCart();
  if (target.id === "addPizzaCategory" || target.id === "addEmpanadaCategory" || target.id === "addAdicionalCategory") {
    const type = target.id === "addPizzaCategory" ? "pizza" : target.id === "addEmpanadaCategory" ? "empanada" : "adicional";
    addDraftCategory(type);
  }
  if (target.id === "addSize") { state.draft.pizzaSizes.push({ id: uid("size"), name: "Nuevo", multiplier: 1 }); renderSizeEditor(); renderProductEditor(); renderPromoEditor(); }
  if (target.id === "addPizza" || target.id === "addEmpanada" || target.id === "addAdicional") {
    const category = target.id === "addPizza" ? "pizza" : target.id === "addEmpanada" ? "empanada" : "adicional";
    state.draft.products.push({
      id: uid(category),
      category,
      categoryId: categoriesFor(category, state.draft)[0]?.id || "",
      sort: state.draft.products.filter(product => product.category === category).length + 1,
      name: "Nuevo gusto",
      description: "",
      price: 0,
      active: true,
      sizePrices: {}
    });
    renderProductEditor();
  }
  if (target.id === "addPromo") {
    state.draft.promotions.push({ id: uid("promo"), name: "Nueva promo", price: 0, active: true, items: [] });
    renderPromoEditor();
  }
  if (
    target.dataset.removeCategory || target.dataset.removeSize || target.dataset.removeProduct ||
    target.dataset.removePromo || target.dataset.removePromoItem || target.dataset.addPromoItem ||
    target.id === "addPizzaCategory" || target.id === "addEmpanadaCategory" || target.id === "addAdicionalCategory" ||
    target.id === "addSize" || target.id === "addPizza" || target.id === "addEmpanada" || target.id === "addAdicional" ||
    target.id === "addPromo"
  ) markDirty();
});

function addPromoPizzaPart(target) {
  const itemIndex = Number(target.dataset.promoItem);
  const pizzaIndex = Number(target.dataset.promoPizzaIndex);
  const promo = currentPromo();
  const item = promo.items[itemIndex];
  const pizza = state.promoBuilder.selections[itemIndex].pizzas[pizzaIndex];
  const selection = Array.isArray(pizza) ? { splitMode: item.splitMode || "", parts: pizza } : pizza;
  const required = SPLIT_PARTS[selection.splitMode] || 1;
  if (selection.parts.length < required) selection.parts.push(target.dataset.promoPizza);
  state.promoBuilder.selections[itemIndex].pizzas[pizzaIndex] = selection;
  renderPromoModal();
}

function removePromoPizzaPart(target) {
  const itemIndex = Number(target.dataset.promoItem);
  const pizzaIndex = Number(target.dataset.promoPizzaIndex);
  const pizza = state.promoBuilder.selections[itemIndex].pizzas[pizzaIndex];
  const selection = Array.isArray(pizza) ? { splitMode: "", parts: pizza } : pizza;
  selection.parts.splice(Number(target.dataset.removePromoPizzaPart), 1);
  state.promoBuilder.selections[itemIndex].pizzas[pizzaIndex] = selection;
  renderPromoModal();
}

document.addEventListener("input", event => {
  const input = event.target;
  const index = Number(input.dataset.index);
  let changedDraft = false;
  if (input.dataset.categoryField) {
    const field = input.dataset.categoryField;
    state.draft.productCategories[index][field] = field === "sort" ? Number(input.value) : input.value;
    if (field === "type") renderProductEditor();
    changedDraft = true;
  }
  if (input.dataset.sizeField) {
    state.draft.pizzaSizes[index][input.dataset.sizeField] = input.dataset.sizeField === "name" ? input.value : Number(input.value);
    changedDraft = true;
  }
  if (input.dataset.productSizePrice) {
    const product = state.draft.products[index];
    product.sizePrices ||= {};
    if (input.value === "") delete product.sizePrices[input.dataset.productSizePrice];
    else product.sizePrices[input.dataset.productSizePrice] = Number(input.value);
    changedDraft = true;
  }
  if (input.dataset.productField) {
    const field = input.dataset.productField;
    const product = state.draft.products[index];
    product.sizePrices ||= {};
    product[field] = ["price", "sort"].includes(field) ? Number(input.value) : field === "active" ? input.checked : input.value;
    if (field === "category") {
      product.categoryId = categoriesFor(product.category, state.draft)[0]?.id || "";
      renderProductEditor();
    }
    changedDraft = true;
  }
  if (input.dataset.promoField) {
    const promo = state.draft.promotions[Number(input.dataset.promoIndex)];
    const field = input.dataset.promoField;
    promo[field] = field === "active" ? input.checked : field === "price" ? Number(input.value) : input.value;
    changedDraft = true;
  }
  if (input.dataset.promoItemField) {
    const item = state.draft.promotions[Number(input.dataset.promoIndex)].items[Number(input.dataset.itemIndex)];
    const field = input.dataset.promoItemField;
    item[field] = field === "quantity" ? Number(input.value) : input.value || null;
    if (field === "type") {
      item.allowedProductIds = [];
      renderPromoEditor();
    }
    changedDraft = true;
  }
  if (input.dataset.promoAllowed) {
    const item = state.draft.promotions[Number(input.dataset.promoIndex)].items[Number(input.dataset.itemIndex)];
    item.allowedProductIds ||= [];
    if (input.checked && !item.allowedProductIds.includes(input.dataset.promoAllowed)) item.allowedProductIds.push(input.dataset.promoAllowed);
    if (!input.checked) item.allowedProductIds = item.allowedProductIds.filter(id => id !== input.dataset.promoAllowed);
    changedDraft = true;
  }
  if (input.dataset.promoProduct) {
    const selection = state.promoBuilder.selections[Number(input.dataset.promoItem)];
    selection.empanadas[input.dataset.promoProduct] = Number(input.value) || 0;
    renderPromoModal();
  }
  if (changedDraft) markDirty();
});

document.addEventListener("change", event => {
  const input = event.target;
  if (input.id === "sortMode") {
    state.sortMode = input.value;
    renderCalculator();
    return;
  }
  if (input.id === "settingDefaultSort") {
    state.draft.settings.defaultSort = input.value;
    markDirty();
    return;
  }
  if (input.dataset.promoSplitModes !== undefined) {
    const item = state.draft.promotions[Number(input.dataset.promoIndex)].items[Number(input.dataset.itemIndex)];
    item.splitModes = Array.from(input.selectedOptions).map(option => option.value);
    if (!item.splitModes.length) item.splitModes = [""];
    markDirty();
    renderPromoEditor();
    return;
  }
  if (input.dataset.promoPizzaSplit !== undefined) {
    const itemIndex = Number(input.dataset.promoItem);
    const pizzaIndex = Number(input.dataset.promoPizzaSplit);
    state.promoBuilder.selections[itemIndex].pizzas[pizzaIndex] = { splitMode: input.value, parts: [] };
    renderPromoModal();
    return;
  }
  if (input.dataset.promoItemField) {
    const item = state.draft.promotions[Number(input.dataset.promoIndex)].items[Number(input.dataset.itemIndex)];
    const field = input.dataset.promoItemField;
    item[field] = field === "quantity" ? Number(input.value) : input.value || null;
    if (field === "type") {
      item.allowedProductIds = [];
      item.splitModes ||= [""];
    }
    markDirty();
    renderPromoEditor();
  }
});

document.addEventListener("toggle", event => {
  const id = event.target.dataset?.categoryGroup;
  if (id) state.collapsedCategories[id] = !event.target.open;
  if (event.target.classList?.contains("settings-section") && event.target.open) {
    $$(".settings-section").forEach(section => {
      if (section !== event.target) section.open = false;
    });
  }
  if (event.target.matches?.("[data-promo-config]") && event.target.open) {
    $$("[data-promo-config]").forEach(section => {
      if (section !== event.target) section.open = false;
    });
  }
  if (event.target.matches?.("[data-product-type-group]") && event.target.open) {
    $$("[data-product-type-group]").forEach(section => {
      if (section !== event.target) section.open = false;
    });
  }
  if (event.target.matches?.("[data-product-config]") && event.target.open) {
    $$("[data-product-config]").forEach(section => {
      if (section !== event.target) section.open = false;
    });
  }
}, true);

nodes.calculatorScreen.addEventListener("touchstart", event => {
  state.touchStartX = event.touches[0].clientX;
});

nodes.calculatorScreen.addEventListener("touchend", event => {
  const diff = event.changedTouches[0].clientX - state.touchStartX;
  if (Math.abs(diff) < 70) return;
  setTab(diff < 0 ? "empanada" : "pizza");
});

loadConfig().catch(error => {
  document.body.innerHTML = `<main class="app-shell"><p class="builder-warning">${error.message}</p></main>`;
});
