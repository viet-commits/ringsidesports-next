#!/usr/bin/env node
/**
 * Ringside Sports — Supplier Sync
 * Pipeline: fetch Extensionsell XML → wc2_xml.py transform → parse → merge
 */
import { createHash } from "crypto";
import { readFileSync, writeFileSync, renameSync as mv, unlinkSync as rm, existsSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { request } from "https";

const SUPPLIER_URL = "https://extensionsell.com/x/export3/eca6a9-2.xml";
const DATA_DIR = (process.env.SYNC_DATA_DIR || "/opt/ringsidesports/data");
const TMP_XML = DATA_DIR + "/raw.xml.tmp";
const RAW_XML = DATA_DIR + "/raw_product_inventory.xml";
const CLEANED_XML = DATA_DIR + "/cleaned_product_inventory.xml";
const HASH_FILE = DATA_DIR + "/sync-hash.txt";
const CATALOG_JSON = process.env.CATALOG_PATH || "/tmp/catalog-export.json";
const TRANSFORM_SCRIPT = "/opt/ringsidesports/scripts/transform.py";
const MIN_SIZE = 100000;
const TIMEOUT = 120000;

function log(l, m) { console.log(new Date().toISOString() + " [" + l + "] " + m); }

async function fetchXml() {
  log("INFO", "Fetching " + SUPPLIER_URL);
  const buffer = await new Promise((resolve, reject) => {
    const chunks = [];
    const req = request(new URL(SUPPLIER_URL), {
      method: "GET", timeout: TIMEOUT, rejectUnauthorized: true,
      headers: { "User-Agent": "RingsideSports-Sync/2.0", Accept: "application/xml" }
    }, (res) => {
      if (res.statusCode !== 200) return reject(new Error("HTTP " + res.statusCode));
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
    req.end();
  });
  if (buffer.length < MIN_SIZE) throw new Error("XML too small: " + buffer.length);
  writeFileSync(TMP_XML, buffer);
  const hash = createHash("sha256").update(buffer).digest("hex");
  const prev = existsSync(HASH_FILE) ? readFileSync(HASH_FILE, "utf8").trim() : null;
  if (prev === hash) { log("INFO", "Unchanged — skipping"); rm(TMP_XML); return null; }
  mv(TMP_XML, RAW_XML); writeFileSync(HASH_FILE, hash);
  log("INFO", "Downloaded " + buffer.length.toLocaleString() + " bytes from Extensionsell");
  return hash;
}

function runTransform() {
  log("INFO", "Running transform.py...");
  try {
    const out = execSync("python3 " + TRANSFORM_SCRIPT, { encoding: "utf-8", timeout: 60000, cwd: DATA_DIR });
    log("INFO", "Transform: " + out.toString().trim().split("\n").pop());
  } catch(e) {
    log("ERROR", "Transform failed: " + (e.stderr || e.message || String(e)));
    throw e;
  }
}

function tag(block, name) { const m = block.match(new RegExp("<" + name + ">([^<]*)</" + name + ">")); return m ? m[1].trim() : ""; }
function stripHtml(html) { return (html||"").replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").trim(); }

const CAT_RULES = [
  { kw: ["BOXING GLOVES","GLOVES","HAYMAKER","TROPHY GETTER","TOUGH GUY","FIGHT GLOVES","CAGE CUTTER","SPARRING"], cat:"Boxing Gloves" },
  { kw: ["MMA GLOVES","MMA GLOVE"], cat:"MMA Gloves" },
  { kw: ["HAND WRAPS","HANDWRAPS","WRAPS","QUICK WRAPS"], cat:"Hand Wraps" },
  { kw: ["HEAD GEAR","HEADGEAR","HEAD GUARD","SHIN PAD","SHIN GUARD","SHIN","BODY PROTECTOR","BODY GUARD","CHEST GUARD","BELLY PAD","THIGH PAD","GROIN GUARD","ROUND SHIELD","KNUCKLE PROTECTOR","ANKLET","MOUTHGUARD","MOUTH GUARD","GUM SHIELD"], cat:"Protective Gear" },
  { kw: ["BOXING BAG","PUNCHING BAG","HEAVY BAG","SPEED BALL","FREE STANDING","UPPERCUT","WALL BAG"], cat:"Punching & Training Bags" },
  { kw: ["PUNCH MITT","FOCUS MITT","HOOK JAB","KICK SHIELD","THAI PAD","BAG MITT","PAD HYBRID"], cat:"Punch Mitts & Pads" },
  { kw: ["SHORTS","THAI SHORTS"], cat:"Martial Arts Shorts" },
  { kw: ["TSHIRT","T-SHIRT","HOODIE","SINGLET","RASH GUARD","COMPRESSION","MUSCLE SHIRT","STEAMER SUIT","CAP -"], cat:"Shirts & Tops" },
  { kw: ["BUNDLE","STARTER PACK","PRO STARTER","PROMO PACK","HOME GYM","BONUS PACK","PROTECTION PACK","FITNESS PACK","XMAS","EDUCATION PACK"], cat:"Bundles" },
  { kw: ["DUFFEL","GYM BAG","BACKPACK","GEAR BAG"], cat:"Gym Duffel Bags" },
  { kw: ["E-BOOK","EBOOK","PRINTED BOOK","ONLINE"], cat:"E-Books" },
  { kw: ["GIFT CARD"], cat:"Gift Cards" },
  { kw: ["WEIGHT LIFTING","LIFTING GLOVE","HAND SUPPORT"], cat:"Weight Lifting Gloves & Supports" },
  { kw: ["FLOOR TO CEILING","CHAIN","SWIVEL","BOXING BOOT","BOXING SHOE","SLIP BALL","BOXING GLOVE/ BOOT"], cat:"Boxing & Martial Arts" },
];
function deriveCategory(t) { const u=(t||"").toUpperCase(); for(const r of CAT_RULES) if(r.kw.some(k=>u.includes(k.toUpperCase()))) return r.cat; return "Boxing & Martial Arts"; }

function parseCleaned() {
  log("INFO", "Parsing cleaned XML...");
  if (!existsSync(CLEANED_XML)) throw new Error("Cleaned XML not found");
  const xml = readFileSync(CLEANED_XML, "utf8");
  const products = [];
  const re = /<product>([\s\S]*?)<\/product>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const b = m[1];
    const sid = tag(b, "id"); if (!sid) continue;
    const title = tag(b, "title") || "";
    const desc = stripHtml(tag(b, "description"));
    const sku = tag(b, "sku") || tag(b, "mpn") || "";
    const mpn = tag(b, "mpn") || sku;
    const rc = tag(b, "category");
    const rt = tag(b, "tags");
    const sr = tag(b, "stock_status") || "instock";
    const sq = parseInt(tag(b, "quantity") || "0", 10);
    const wt = tag(b, "weight") || ""; const gr = tag(b, "grams") || "";
    const bc = tag(b, "barcode") || ""; const av = tag(b, "availability") || "";
    
    const images = [];
    const mi = tag(b, "image"); if (mi) images.push(mi);
    for (const am of b.matchAll(/<additional_image>([^<]+)<\/additional_image>/g)) if (am[1]) images.push(am[1]);
    
    let cats = rc && rc !== "Uncategorized" ? rc.replace(/&amp;/g,"&").split(/[,&|]/).map(s=>s.trim()).filter(Boolean) : [];
    if (!cats.length) cats = [deriveCategory(title)];
    const tags = rt ? rt.split(",").map(s=>s.trim()).filter(Boolean) : [];
    
    const variants = [];
    const vr = /<variation>([\s\S]*?)<\/variation>/g; let vm;
    while ((vm = vr.exec(b)) !== null) {
      const vb = vm[1];
      const vp = parseFloat(tag(vb, "regular_price") || tag(vb, "price") || "0");
      const vs = tag(vb, "sku") || mpn;
      const vst = tag(vb, "stock_status") || "instock";
      const vq = parseInt(tag(vb, "quantity") || tag(vb, "stock_quantity") || "0", 10);
      const sz = tag(vb, "size") || ""; const co = tag(vb, "color") || tag(vb, "colour") || "";
      const opts = {};
      if (sz && sz !== "Default Title") opts.size = sz;
      if (co) opts.colour = co;
      const vi = [];
      const img = tag(vb, "image") || tag(vb, "variant_image");
      if (img) vi.push(img);
      const svs = vs.replace(/[^a-zA-Z0-9_.-]/g,"") || mpn+"_"+(sz||"")+(co?"_"+co:"");
      variants.push({ supplierVariantSku:svs, supplierIdentity:sid+"__"+svs, sku:svs,
        title:tag(vb,"title")||title, price:Math.round(vp*100),
        stockQuantity:vq, stockStatus:vst==="instock"?"in_stock":"out_of_stock",
        options:opts, images:vi, wcVariationId:0,
        weight:tag(vb,"weight")||wt, barcode:tag(vb,"barcode")||bc,
        availability:tag(vb,"availability")||av });
    }
    
    if (!variants.length) {
      const p = parseFloat(tag(b, "regular_price")||"0");
      variants.push({ supplierVariantSku:mpn||"default", supplierIdentity:sid+"__"+(mpn||"default"),
        sku:mpn||"default", title, price:Math.round(p*100),
        stockQuantity:sq, stockStatus:sr==="instock"?"in_stock":"out_of_stock",
        options:{}, images, wcVariationId:0, weight:wt, barcode:bc, availability:av });
    }
    
    const minP = Math.min(...variants.map(v=>v.price));
    products.push({ supplierId:sid, id:sid, title, description:desc,
      handle:title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")+"-"+sid.slice(-8),
      status:"published", categories:cats, tags, images, variants,
      productType:variants.length>1?"variable":"simple", price:minP,
      stockStatus:sr==="instock"?"in_stock":"out_of_stock", stockQuantity:sq,
      supplierMpn:mpn, wcPostId:0, weight:wt, grams:gr, barcode:bc, availability:av });
  }
  const tv = products.reduce((s,p)=>s+p.variants.length,0);
  log("INFO", "Parsed " + products.length + " products, " + tv + " variants");
  return products;
}

function merge(newProducts) {
  log("INFO", "Merging...");
  let existing = { catalog: [] };
  try { existing = JSON.parse(readFileSync(CATALOG_JSON, "utf8")); } catch(e) {}
  const em = new Map(); for (const p of existing.catalog) em.set(p.supplierId, p);
  const fc = []; let nc=0, uc=0;
  for (const np of newProducts) {
    const old = em.get(np.supplierId);
    if (old) { np.wcPostId=old.wcPostId; if (!np.categories.length||np.categories[0]==="Uncategorized") if (old.categories.length) np.categories=old.categories; uc++; }
    else nc++;
    fc.push(np);
  }
  const nids = new Set(newProducts.map(p=>p.supplierId)); let rc=0;
  for (const old of existing.catalog) {
    if (!nids.has(old.supplierId)) { old.stockStatus="out_of_stock"; old.stockQuantity=0; for (const v of old.variants){v.stockStatus="out_of_stock";v.stockQuantity=0;} fc.push(old); rc++; }
  }
  log("INFO", "New:"+nc+" Updated:"+uc+" Removed:"+rc);
  writeFileSync(CATALOG_JSON, JSON.stringify({catalog:fc},null,2));
  log("INFO", "Saved:"+fc.length+" total");
}

async function main() {
  mkdirSync(DATA_DIR, {recursive:true});
  const hash = await fetchXml();
  if (!hash) { log("INFO","Done — XML unchanged"); return; }
  runTransform();
  merge(parseCleaned());
  log("INFO","Sync complete — Extensionsell → transform.py → catalog-export.json");
}
main().catch(err => { log("ERROR",err.message||String(err)); process.exit(1); });
