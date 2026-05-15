#!/usr/bin/env node
/**
 * migrate-orders.mjs — Phase 7: Order Migration
 *
 * Queries WooCommerce shop orders with meta and line items and exports
 * them to /tmp/orders-export.json for Medusa import.
 *
 * Usage: node scripts/migrate-orders.mjs
 *
 * Prerequisites:
 *   - SSH tunnel or direct access to WP MariaDB
 *   - MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE env vars
 *     (defaults to localhost tunnel via SSH)
 */

import fs from "node:fs";
import mysql from "mysql2/promise";

// ── Config ───────────────────────────────────────────────────────────────────
const DB_CONFIG = {
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: parseInt(process.env.MYSQL_PORT || "3307", 10),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "ringsidesportsco_wp",
};

const PREFIX = "dnoIdU5_";

// ── Status Mapping ───────────────────────────────────────────────────────────
const STATUS_MAP = {
  "wc-completed": "completed",
  "wc-processing": "processing",
  "wc-on-hold": "pending",
  "wc-pending": "pending",
  "wc-cancelled": "canceled",
  "wc-failed": "failed",
  "wc-refunded": "refunded",
};

function mapStatus(wcStatus) {
  return STATUS_MAP[wcStatus] || wcStatus.replace("wc-", "");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildMetaMap(rows) {
  const map = {};
  for (const row of rows) {
    map[row.meta_key] = row.meta_value;
  }
  return map;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔌 Connecting to WP database...");
  const conn = await mysql.createConnection(DB_CONFIG);
  console.log("✅ Connected");

  try {
    // ── 1. Fetch all shop orders ──────────────────────────────────────────────
    console.log("📊 Fetching orders...");
    const [orderRows] = await conn.execute(
      `SELECT ID, post_status, post_date, post_date_gmt, post_modified
       FROM ${PREFIX}posts
       WHERE post_type = 'shop_order'
       ORDER BY ID`
    );
    console.log(`   Found ${orderRows.length} orders`);

    if (orderRows.length === 0) {
      console.log("⚠️  No orders found.");
      return;
    }

    const orderIds = orderRows.map((r) => r.ID);

    // ── 2. Fetch all order meta in batches ────────────────────────────────────
    console.log("📊 Fetching order metadata...");
    const BATCH_SIZE = 100;
    let allMetaRows = [];

    for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
      const batch = orderIds.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => "?").join(",");
      const [metaRows] = await conn.execute(
        `SELECT post_id, meta_key, meta_value
         FROM ${PREFIX}postmeta
         WHERE post_id IN (${placeholders})
         ORDER BY post_id, meta_key`,
        batch
      );
      allMetaRows = allMetaRows.concat(metaRows);
    }

    // Index metas by post_id
    const metaByOrder = new Map();
    for (const row of allMetaRows) {
      if (!metaByOrder.has(row.post_id)) {
        metaByOrder.set(row.post_id, []);
      }
      metaByOrder.get(row.post_id).push(row);
    }

    // ── 3. Fetch line items in batches ────────────────────────────────────────
    console.log("📊 Fetching line items...");
    let allItemRows = [];

    for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
      const batch = orderIds.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => "?").join(",");
      const [itemRows] = await conn.execute(
        `SELECT order_item_id, order_item_name, order_item_type, order_id
         FROM ${PREFIX}woocommerce_order_items
         WHERE order_id IN (${placeholders})
         ORDER BY order_id, order_item_id`,
        batch
      );
      allItemRows = allItemRows.concat(itemRows);
    }

    const itemIds = allItemRows
      .filter((r) => r.order_item_type === "line_item")
      .map((r) => r.order_item_id);

    // Fetch item meta for line items
    let allItemMetaRows = [];
    if (itemIds.length > 0) {
      for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
        const batch = itemIds.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map(() => "?").join(",");
        const [itemMetaRows] = await conn.execute(
          `SELECT order_item_id, meta_key, meta_value
           FROM ${PREFIX}woocommerce_order_itemmeta
           WHERE order_item_id IN (${placeholders})
           ORDER BY order_item_id, meta_key`,
          batch
        );
        allItemMetaRows = allItemMetaRows.concat(itemMetaRows);
      }
    }

    // Index item metas by order_item_id
    const itemMetaByItem = new Map();
    for (const row of allItemMetaRows) {
      if (!itemMetaByItem.has(row.order_item_id)) {
        itemMetaByItem.set(row.order_item_id, []);
      }
      itemMetaByItem.get(row.order_item_id).push(row);
    }

    // Index items by order_id
    const itemsByOrder = new Map();
    for (const row of allItemRows) {
      if (!itemsByOrder.has(row.order_id)) {
        itemsByOrder.set(row.order_id, []);
      }
      itemsByOrder.get(row.order_id).push(row);
    }

    // ── 4. Build order objects ────────────────────────────────────────────────
    const orders = [];
    let skippedCount = 0;

    for (const order of orderRows) {
      const metaRows = metaByOrder.get(order.ID) || [];
      const meta = buildMetaMap(metaRows);

      // Build line items
      const orderItems = itemsByOrder.get(order.ID) || [];
      const lineItems = [];

      for (const item of orderItems) {
        if (item.order_item_type !== "line_item") continue;

        const itemMetaRows = itemMetaByItem.get(item.order_item_id) || [];
        const itemMeta = buildMetaMap(itemMetaRows);

        lineItems.push({
          name: item.order_item_name,
          product_id: parseInt(itemMeta._product_id) || 0,
          variation_id: parseInt(itemMeta._variation_id) || 0,
          sku: itemMeta._sku || null,
          quantity: parseInt(itemMeta._qty) || 0,
          price: parseFloat(itemMeta._line_subtotal) || 0,
          total: parseFloat(itemMeta._line_total) || 0,
          tax_class: itemMeta._tax_class || "",
          meta_data: Object.entries(itemMeta)
            .filter(([k]) => !k.startsWith("_line_") && !k.startsWith("_"))
            .map(([k, v]) => ({ key: k, value: v })),
        });
      }

      // Build billing
      const billing = {
        first_name: meta._billing_first_name || "",
        last_name: meta._billing_last_name || "",
        company: meta._billing_company || "",
        address_1: meta._billing_address_1 || "",
        address_2: meta._billing_address_2 || "",
        city: meta._billing_city || "",
        state: meta._billing_state || "",
        postcode: meta._billing_postcode || "",
        country: meta._billing_country || "AU",
        email: meta._billing_email || "",
        phone: meta._billing_phone || "",
      };

      // Build shipping
      const shipping = {
        first_name: meta._shipping_first_name || "",
        last_name: meta._shipping_last_name || "",
        company: meta._shipping_company || "",
        address_1: meta._shipping_address_1 || "",
        address_2: meta._shipping_address_2 || "",
        city: meta._shipping_city || "",
        state: meta._shipping_state || "",
        postcode: meta._shipping_postcode || "",
        country: meta._shipping_country || "AU",
        phone: meta._shipping_phone || "",
      };

      const wcStatus = order.post_status;
      const mappedStatus = mapStatus(wcStatus);

      orders.push({
        // Core order fields
        order_number: order.ID,
        status: mappedStatus,
        wc_status: wcStatus,
        date_created: order.post_date
          ? new Date(order.post_date).toISOString()
          : null,
        date_modified: order.post_modified
          ? new Date(order.post_modified).toISOString()
          : null,
        date_paid: meta._date_paid
          ? new Date(parseInt(meta._date_paid) * 1000).toISOString()
          : null,
        date_completed: meta._date_completed
          ? new Date(parseInt(meta._date_completed) * 1000).toISOString()
          : null,

        // Financial
        currency: meta._order_currency || "AUD",
        total: parseFloat(meta._order_total) || 0,
        shipping_total: parseFloat(meta._order_shipping) || 0,
        shipping_tax: parseFloat(meta._order_shipping_tax) || 0,
        tax_total: parseFloat(meta._order_tax) || 0,
        discount_total: parseFloat(meta._cart_discount) || 0,
        prices_include_tax: meta._prices_include_tax === "yes",

        // Payment
        payment_method: meta._payment_method || "",
        payment_method_title: meta._payment_method_title || "",
        transaction_id: meta._transaction_id || "",

        // Customer
        customer_id: parseInt(meta._customer_user) || null,
        customer_email: billing.email || "",
        customer_ip: meta._customer_ip_address || "",

        // Addresses
        billing,
        shipping,

        // Line items
        line_items: lineItems,

        // Legacy metadata
        metadata: {
          wc_order_key: meta._order_key || "",
          wc_version: meta._order_version || "",
          created_via: meta._created_via || "",
          stripe_charge_id: meta._stripe_charge_id || "",
          stripe_fee: meta._stripe_fee || "",
          source: "woocommerce_migration",
        },
      });
    }

    // ── 5. Write export ───────────────────────────────────────────────────────
    const exportData = {
      exportedAt: new Date().toISOString(),
      source: "WooCommerce WordPress (dnoIdU5_)",
      totalOrders: orders.length,
      skipped: skippedCount,
      orders,
    };

    const outputPath = "/tmp/orders-export.json";
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    console.log(`\n✅ Exported ${orders.length} orders to ${outputPath}`);
    console.log(
      `   File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`
    );

    // ── 6. Summary ────────────────────────────────────────────────────────────
    const statusCounts = {};
    const guestCount = orders.filter((o) => !o.customer_id).length;
    const withLineItems = orders.filter((o) => o.line_items.length > 0).length;

    for (const o of orders) {
      statusCounts[o.wc_status] = (statusCounts[o.wc_status] || 0) + 1;
    }

    console.log("\n📊 ORDER SUMMARY:");
    console.log(`   Total orders:        ${orders.length}`);
    console.log(`   Guest orders:        ${guestCount}`);
    console.log(`   With line items:     ${withLineItems}`);
    console.log(`   Without line items:  ${orders.length - withLineItems}`);
    console.log("\n   Status breakdown:");
    for (const [status, count] of Object.entries(statusCounts).sort()) {
      const mapped = mapStatus(status);
      console.log(`     ${status} → ${mapped}: ${count}`);
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
