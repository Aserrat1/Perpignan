const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify(
        {
          settings: {
            theme: "light",
            businessName: "Pizzeria",
            currency: "$",
            taxIncluded: true,
            allowPizzaNotes: true,
            defaultSort: "category"
          },
          productCategories: [
            { id: "empanada-clasicas", type: "empanada", name: "Clasicas", sort: 1 },
            { id: "empanada-premium", type: "empanada", name: "Premium", sort: 2 },
            { id: "pizza-comunes", type: "pizza", name: "Comunes", sort: 1 },
            { id: "pizza-cancheras", type: "pizza", name: "Cancheras", sort: 2 },
            { id: "adicional-bebidas", type: "adicional", name: "Bebidas", sort: 1 },
            { id: "adicional-otros", type: "adicional", name: "Otros", sort: 2 }
          ],
          pizzaSizes: [
            { id: "xl", name: "XL", multiplier: 1.45 },
            { id: "chica", name: "Chica", multiplier: 0.72 },
            { id: "mediana", name: "Mediana", multiplier: 1 }
          ],
          products: [
            { id: "muzza", category: "pizza", categoryId: "pizza-comunes", sort: 1, name: "Muzzarella", description: "Salsa, muzzarella y oregano.", price: 7200, sizePrices: {}, active: true },
            { id: "napo", category: "pizza", categoryId: "pizza-comunes", sort: 2, name: "Napolitana", description: "Tomate, ajo y muzzarella.", price: 8200, sizePrices: {}, active: true },
            { id: "jamon-morron", category: "pizza", categoryId: "pizza-cancheras", sort: 1, name: "Jamon y morron", description: "Jamon, morron y muzzarella.", price: 9000, sizePrices: {}, active: true },
            { id: "fugazzeta", category: "pizza", categoryId: "pizza-cancheras", sort: 2, name: "Fugazzeta", description: "Cebolla y extra muzzarella.", price: 8800, sizePrices: {}, active: true },
            { id: "carne", category: "empanada", categoryId: "empanada-clasicas", sort: 1, name: "Carne", description: "Carne cortada a cuchillo.", price: 900, active: true },
            { id: "jyq", category: "empanada", categoryId: "empanada-clasicas", sort: 2, name: "Jamon y queso", description: "Jamon cocido y queso.", price: 900, active: true },
            { id: "pollo", category: "empanada", categoryId: "empanada-premium", sort: 1, name: "Pollo", description: "Pollo condimentado.", price: 900, active: true },
            { id: "humita", category: "empanada", categoryId: "empanada-premium", sort: 2, name: "Humita", description: "Choclo cremoso.", price: 900, active: true },
            { id: "coca-15", category: "adicional", categoryId: "adicional-bebidas", sort: 1, name: "Gaseosa 1.5L", description: "Bebida linea Coca.", price: 2500, active: true },
            { id: "postre-semana", category: "adicional", categoryId: "adicional-otros", sort: 1, name: "Postre semanal", description: "Articulo especial configurable.", price: 3000, active: true }
          ],
          promotions: [
            {
              id: "docena-empanadas",
              name: "Docena de empanadas",
              price: 9600,
              active: true,
              items: [{ id: "docena-item", type: "empanada", quantity: 12, allowedProductIds: [] }]
            }
          ],
          updatedAt: new Date().toISOString()
        },
        null,
        2
      )
    );
  }
}

function readDb() {
  ensureDb();
  return normalizeDb(JSON.parse(fs.readFileSync(DB_PATH, "utf8")));
}

function writeDb(data) {
  ensureDb();
  const normalized = normalizeDb({
    settings: data.settings || {},
    productCategories: Array.isArray(data.productCategories) ? data.productCategories : [],
    pizzaSizes: Array.isArray(data.pizzaSizes) ? data.pizzaSizes : [],
    products: Array.isArray(data.products) ? data.products : [],
    promotions: Array.isArray(data.promotions) ? data.promotions : [],
    updatedAt: new Date().toISOString()
  });
  fs.writeFileSync(DB_PATH, JSON.stringify(normalized, null, 2));
  return normalized;
}

function safeQuantity(value, fallback = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(50, Math.max(1, Math.floor(number)));
}

function normalizeDb(data) {
  const normalized = {
    settings: data.settings || {},
    productCategories: Array.isArray(data.productCategories) ? data.productCategories : [],
    pizzaSizes: Array.isArray(data.pizzaSizes) ? data.pizzaSizes : [],
    products: Array.isArray(data.products) ? data.products : [],
    promotions: Array.isArray(data.promotions) ? data.promotions : [],
    updatedAt: data.updatedAt || new Date().toISOString()
  };

  normalized.promotions = normalized.promotions.map(promo => ({
    id: promo.id || `promo-${Date.now()}`,
    name: String(promo.name || "Promo"),
    price: Number.isFinite(Number(promo.price)) ? Number(promo.price) : 0,
    active: promo.active !== false,
    items: Array.isArray(promo.items) ? promo.items.map(item => ({
      id: item.id || `promo-item-${Date.now()}`,
      type: ["pizza", "empanada", "adicional"].includes(item.type) ? item.type : "empanada",
      quantity: safeQuantity(item.quantity, 1),
      allowedProductIds: Array.isArray(item.allowedProductIds) ? item.allowedProductIds : [],
      sizeId: item.sizeId || "mediana",
      splitModes: Array.isArray(item.splitModes) && item.splitModes.length ? item.splitModes : (item.splitMode ? [item.splitMode] : [""])
    })) : []
  }));

  return normalized;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload demasiado grande"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const resolvedPath = path.normalize(path.join(PUBLIC_DIR, requestedPath));

  if (!resolvedPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(resolvedPath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(resolvedPath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/api/config" && req.method === "GET") {
      sendJson(res, 200, readDb());
      return;
    }

    if (req.url === "/api/config" && req.method === "PUT") {
      const body = await readBody(req);
      sendJson(res, 200, writeDb(JSON.parse(body)));
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Error inesperado" });
  }
});

ensureDb();
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Calculadora de pizzeria lista en http://localhost:${PORT}`);
});
