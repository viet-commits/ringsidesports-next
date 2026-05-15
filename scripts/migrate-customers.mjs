#!/usr/bin/env node
/**
 * migrate-customers.mjs — Phase 7: Customer Migration
 *
 * Queries WooCommerce WordPress users (role=customer) and exports them
 * to /tmp/customers-export.json for Medusa import.
 *
 * Usage: node scripts/migrate-customers.mjs
 *
 * Prerequisites:
 *   - SSH tunnel or direct access to WP MariaDB
 *   - MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE env vars
 *     (defaults to localhost tunnel via SSH)
 */

import fs from "node:fs";
import crypto from "node:crypto";
import mysql from "mysql2/promise";

// ── Config ───────────────────────────────────────────────────────────────────
const DB_CONFIG = {
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: parseInt(process.env.MYSQL_PORT || "3307", 10),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "ringsidesportsco_wp",
};

// WP table prefix
const PREFIX = "dnoIdU5_";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a key-value map from raw usermeta rows for a given user.
 */
function buildMetaMap(rows, userId) {
  const map = {};
  for (const row of rows) {
    if (row.user_id === userId) {
      map[row.meta_key] = row.meta_value;
    }
  }
  return map;
}

/**
 * Generate a random password reset token.
 */
function generateResetToken() {
  return crypto.randomUUID();
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔌 Connecting to WP database...");
  const conn = await mysql.createConnection(DB_CONFIG);
  console.log("✅ Connected");

  try {
    // ── 1. Get all customer user IDs ──────────────────────────────────────────
    console.log("📊 Fetching customer IDs...");
    const [idRows] = await conn.execute(
      `SELECT u.ID, u.user_email, u.display_name, u.user_registered
       FROM ${PREFIX}users u
       JOIN ${PREFIX}usermeta um ON u.ID = um.user_id
       WHERE um.meta_key = '${PREFIX}capabilities'
       AND um.meta_value LIKE '%"customer"%'`
    );
    console.log(`   Found ${idRows.length} customers`);

    if (idRows.length === 0) {
      console.log("⚠️  No customers found.");
      return;
    }

    // ── 2. Get ALL usermeta for these customers in one query ──────────────────
    const userIds = idRows.map((r) => r.ID);
    console.log("📊 Fetching usermeta for all customers...");

    let allMetaRows = [];
    // Batch query to avoid too-large IN clause
    const BATCH_SIZE = 500;
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => "?").join(",");
      const [metaRows] = await conn.execute(
        `SELECT user_id, meta_key, meta_value
         FROM ${PREFIX}usermeta
         WHERE user_id IN (${placeholders})
         ORDER BY user_id, meta_key`,
        batch
      );
      allMetaRows = allMetaRows.concat(metaRows);
    }

    // Index meta rows by user_id
    const metaByUser = new Map();
    for (const row of allMetaRows) {
      if (!metaByUser.has(row.user_id)) {
        metaByUser.set(row.user_id, []);
      }
      metaByUser.get(row.user_id).push(row);
    }

    // ── 3. Build customer objects ─────────────────────────────────────────────
    const customers = [];
    let skippedCount = 0;

    for (const user of idRows) {
      const metaRows = metaByUser.get(user.ID) || [];
      const meta = buildMetaMap(metaRows, user.ID);

      const email = (user.user_email || "").trim().toLowerCase();
      if (!email) {
        skippedCount++;
        continue;
      }

      const first_name = meta.first_name || "";
      const last_name = meta.last_name || "";

      const billing = {
        first_name: meta.billing_first_name || first_name,
        last_name: meta.billing_last_name || last_name,
        address_1: meta.billing_address_1 || "",
        address_2: meta.billing_address_2 || "",
        city: meta.billing_city || "",
        state: meta.billing_state || "",
        postcode: meta.billing_postcode || "",
        country: meta.billing_country || "AU",
        phone: meta.billing_phone || "",
        email: meta.billing_email || email,
      };

      const shipping = {
        first_name: meta.shipping_first_name || "",
        last_name: meta.shipping_last_name || "",
        address_1: meta.shipping_address_1 || "",
        address_2: meta.shipping_address_2 || "",
        city: meta.shipping_city || "",
        state: meta.shipping_state || "",
        postcode: meta.shipping_postcode || "",
        country: meta.shipping_country || "AU",
        phone: meta.shipping_phone || "",
      };

      customers.push({
        // Medusa customer fields
        email,
        first_name: first_name || billing.first_name || user.display_name?.split(" ")[0] || "",
        last_name: last_name || billing.last_name || user.display_name?.split(" ").slice(1).join(" ") || "",
        phone: billing.phone || shipping.phone || "",

        // Password reset token (WP passwords can't be migrated)
        password_reset_token: generateResetToken(),

        // Addresses
        billing_address: hasAddress(billing) ? billing : undefined,
        shipping_address: hasAddress(shipping) ? shipping : undefined,

        // Legacy references
        wc_user_id: user.ID,
        wc_display_name: user.display_name,
        created_at: user.user_registered
          ? new Date(user.user_registered).toISOString()
          : null,

        // Metadata
        metadata: {
          wp_capabilities: meta[`${PREFIX}capabilities`] || "",
          source: "woocommerce_migration",
        },
      });
    }

    // ── 4. Write export ───────────────────────────────────────────────────────
    const exportData = {
      exportedAt: new Date().toISOString(),
      source: "WooCommerce WordPress (dnoIdU5_)",
      totalCustomers: customers.length,
      skippedNoEmail: skippedCount,
      customers,
    };

    const outputPath = "/tmp/customers-export.json";
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    console.log(`\n✅ Exported ${customers.length} customers to ${outputPath}`);
    console.log(`   Skipped ${skippedCount} customers with no email`);
    console.log(
      `   File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`
    );

    // ── 5. Summary ────────────────────────────────────────────────────────────
    const withBilling = customers.filter((c) => c.billing_address).length;
    const withShipping = customers.filter((c) => c.shipping_address).length;
    const withPhone = customers.filter((c) => c.phone).length;
    const withName = customers.filter((c) => c.first_name || c.last_name).length;

    console.log("\n📊 SUMMARY:");
    console.log(`   Total customers:     ${customers.length}`);
    console.log(`   With billing addr:   ${withBilling}`);
    console.log(`   With shipping addr:  ${withShipping}`);
    console.log(`   With name:           ${withName}`);
    console.log(`   With phone:          ${withPhone}`);
    console.log(`   Without name:        ${customers.length - withName}`);

    // Check for duplicate emails
    const emailSet = new Set();
    const dupes = [];
    for (const c of customers) {
      if (emailSet.has(c.email)) {
        dupes.push(c.email);
      }
      emailSet.add(c.email);
    }
    if (dupes.length > 0) {
      console.log(`\n⚠️  ${dupes.length} duplicate email(s) found:`);
      for (const d of dupes) console.log(`   - ${d}`);
    } else {
      console.log("\n✅ No duplicate emails found");
    }
  } finally {
    await conn.end();
  }
}

function hasAddress(addr) {
  return !!(addr?.address_1 || addr?.city || addr?.postcode);
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
