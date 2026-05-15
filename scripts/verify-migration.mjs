#!/usr/bin/env node
/**
 * verify-migration.mjs — Phase 7: Data Integrity Verification
 *
 * Compares customer/order counts between WP source and JSON exports.
 * Checks for missing emails, duplicates, orphan orders, and anomalies.
 *
 * Usage: node scripts/verify-migration.mjs
 *
 * Prerequisites:
 *   - Existing /tmp/customers-export.json and /tmp/orders-export.json
 *   - MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE env vars
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
const CUSTOMERS_FILE = "/tmp/customers-export.json";
const ORDERS_FILE = "/tmp/orders-export.json";

// ── Status map (for grouping) ────────────────────────────────────────────────
const STATUS_MAP = {
  "wc-completed": "completed",
  "wc-processing": "processing",
  "wc-on-hold": "pending",
  "wc-pending": "pending",
  "wc-cancelled": "canceled",
  "wc-failed": "failed",
  "wc-refunded": "refunded",
};

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const issues = [];

  console.log("🔍 Phase 7 Migration Verification");
  console.log("══════════════════════════════════\n");

  // ── 1. Check export files exist ────────────────────────────────────────────
  if (!fs.existsSync(CUSTOMERS_FILE)) {
    console.error(`❌ ${CUSTOMERS_FILE} not found`);
    process.exit(1);
  }
  if (!fs.existsSync(ORDERS_FILE)) {
    console.error(`❌ ${ORDERS_FILE} not found`);
    process.exit(1);
  }

  const customersExport = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, "utf-8"));
  const ordersExport = JSON.parse(fs.readFileSync(ORDERS_FILE, "utf-8"));

  console.log(`📁 Loaded ${CUSTOMERS_FILE}: ${(fs.statSync(CUSTOMERS_FILE).size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📁 Loaded ${ORDERS_FILE}: ${(fs.statSync(ORDERS_FILE).size / 1024 / 1024).toFixed(2)} MB\n`);

  // ── 2. Connect to WP and get source counts ─────────────────────────────────
  console.log("🔌 Connecting to WP database for source counts...");
  const conn = await mysql.createConnection(DB_CONFIG);

  try {
    // ── Customer count ──────────────────────────────────────────────────────
    const [customerCountRows] = await conn.execute(
      `SELECT COUNT(*) as cnt FROM ${PREFIX}users u
       JOIN ${PREFIX}usermeta um ON u.ID = um.user_id
       WHERE um.meta_key = '${PREFIX}capabilities'
       AND um.meta_value LIKE '%"customer"%'`
    );
    const wpCustomerCount = customerCountRows[0].cnt;
    const exportCustomerCount = customersExport.totalCustomers;

    console.log("📊 CUSTOMER COUNTS:");
    console.log(`   WP source:      ${wpCustomerCount}`);
    console.log(`   JSON export:    ${exportCustomerCount}`);

    if (wpCustomerCount === exportCustomerCount) {
      console.log("   ✅ Counts match");
    } else {
      const diff = wpCustomerCount - exportCustomerCount;
      issues.push(`Customer count mismatch: WP=${wpCustomerCount}, Export=${exportCustomerCount} (diff: ${diff})`);
      console.log(`   ❌ Mismatch! Diff: ${diff}`);
    }

    // Get skipped count from export
    const skippedNoEmail = customersExport.skippedNoEmail || 0;
    if (skippedNoEmail > 0) {
      console.log(`   ℹ️  ${skippedNoEmail} customers skipped (no email)`);
    }

    // ── Order count ─────────────────────────────────────────────────────────
    const [orderCountRows] = await conn.execute(
      `SELECT COUNT(*) as cnt FROM ${PREFIX}posts WHERE post_type = 'shop_order'`
    );
    const wpOrderCount = orderCountRows[0].cnt;
    const exportOrderCount = ordersExport.totalOrders;

    console.log("\n📊 ORDER COUNTS:");
    console.log(`   WP source:      ${wpOrderCount}`);
    console.log(`   JSON export:    ${exportOrderCount}`);

    if (wpOrderCount === exportOrderCount) {
      console.log("   ✅ Counts match");
    } else {
      const diff = wpOrderCount - exportOrderCount;
      issues.push(`Order count mismatch: WP=${wpOrderCount}, Export=${exportOrderCount} (diff: ${diff})`);
      console.log(`   ❌ Mismatch! Diff: ${diff}`);
    }

    // ── 3. Customer data quality checks ──────────────────────────────────────
    console.log("\n📊 CUSTOMER DATA QUALITY:");

    const customers = customersExport.customers || [];
    const emails = customers.map((c) => c.email);
    const emailSet = new Set(emails);

    // Missing emails
    const missingEmails = customers.filter((c) => !c.email);
    if (missingEmails.length > 0) {
      issues.push(`${missingEmails.length} customers have missing/empty email`);
      console.log(`   ❌ ${missingEmails.length} customers missing email`);
    } else {
      console.log(`   ✅ 0 customers missing email`);
    }

    // Duplicate emails
    if (emails.length !== emailSet.size) {
      const dupes = [];
      const seen = new Set();
      for (const e of emails) {
        if (seen.has(e)) dupes.push(e);
        seen.add(e);
      }
      issues.push(`${dupes.length} duplicate email addresses found`);
      console.log(`   ❌ ${dupes.length} duplicate email(s): ${dupes.slice(0, 5).join(", ")}`);
    } else {
      console.log(`   ✅ No duplicate emails`);
    }

    // Without name
    const withoutName = customers.filter((c) => !c.first_name && !c.last_name);
    console.log(`   ℹ️  ${withoutName.length} customers without first/last name`);

    // Without billing address
    const withoutBilling = customers.filter((c) => !c.billing_address);
    console.log(`   ℹ️  ${withoutBilling.length} customers without billing address`);

    // Without phone
    const withoutPhone = customers.filter((c) => !c.phone);
    console.log(`   ℹ️  ${withoutPhone.length} customers without phone`);

    // Password reset tokens
    const withoutToken = customers.filter((c) => !c.password_reset_token);
    if (withoutToken.length > 0) {
      issues.push(`${withoutToken.length} customers missing password reset token`);
      console.log(`   ❌ ${withoutToken.length} customers missing reset token`);
    } else {
      console.log(`   ✅ All customers have password reset token`);
    }

    // ── 4. Order data quality checks ─────────────────────────────────────────
    console.log("\n📊 ORDER DATA QUALITY:");

    const orders = ordersExport.orders || [];

    // Orders without customer_id
    const guestOrders = orders.filter((o) => !o.customer_id);
    const registeredOrders = orders.filter((o) => o.customer_id);
    console.log(`   Guest orders:        ${guestOrders.length}`);
    console.log(`   Registered orders:   ${registeredOrders.length}`);

    // Orders without email
    const withoutEmail = orders.filter((o) => !o.customer_email);
    if (withoutEmail.length > 0) {
      issues.push(`${withoutEmail.length} orders missing customer email`);
      console.log(`   ❌ ${withoutEmail.length} orders missing customer email`);
    } else {
      console.log(`   ✅ All orders have customer email`);
    }

    // Orders without line items
    const withoutItems = orders.filter((o) => !o.line_items || o.line_items.length === 0);
    if (withoutItems.length > 0) {
      issues.push(`${withoutItems.length} orders have 0 line items`);
      console.log(`   ⚠️  ${withoutItems.length} orders have 0 line items`);
    } else {
      console.log(`   ✅ All orders have line items`);
    }

    // Orders without total
    const zeroTotal = orders.filter((o) => !o.total);
    if (zeroTotal.length > 0) {
      issues.push(`${zeroTotal.length} orders have $0 total`);
      console.log(`   ⚠️  ${zeroTotal.length} orders with $0 total`);
    }

    // Status distribution
    const statusCounts = {};
    for (const o of orders) {
      const s = o.wc_status || "unknown";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }
    console.log("\n   Status distribution:");
    for (const [status, count] of Object.entries(statusCounts).sort()) {
      const mapped = STATUS_MAP[status] || status;
      console.log(`     ${status} → ${mapped}: ${count}`);
    }

    // Orders referencing non-existent customer IDs
    const exportWpUserIds = new Set(
      customers.map((c) => c.wc_user_id).filter(Boolean)
    );
    const orphanOrders = registeredOrders.filter(
      (o) => o.customer_id && !exportWpUserIds.has(o.customer_id)
    );
    if (orphanOrders.length > 0) {
      issues.push(`${orphanOrders.length} orders reference non-customer users`);
      console.log(`\n   ⚠️  ${orphanOrders.length} orders reference users not in customer export`);
      const orphanUserIds = new Set(orphanOrders.map((o) => o.customer_id));
      console.log(`   Non-customer user IDs: ${[...orphanUserIds].join(", ")}`);
    } else {
      console.log(`\n   ✅ All order customer IDs exist in customer export`);
    }

    // ── 5. Final verdict ─────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════");
    if (issues.length === 0) {
      console.log("✅ VERDICT: Migration exports pass all integrity checks");
    } else {
      console.log(`⚠️  VERDICT: ${issues.length} issue(s) found:`);
      for (const issue of issues) {
        console.log(`   - ${issue}`);
      }
    }

    // ── 6. Write verification report ─────────────────────────────────────────
    const report = {
      verifiedAt: new Date().toISOString(),
      checks: {
        customerCountMatch: wpCustomerCount === exportCustomerCount,
        wpCustomerCount,
        exportCustomerCount,
        skippedNoEmail,
        orderCountMatch: wpOrderCount === exportOrderCount,
        wpOrderCount,
        exportOrderCount,
      },
      customerQuality: {
        total: customers.length,
        missingEmail: missingEmails.length,
        duplicateEmails: emails.length - emailSet.size,
        withoutName: withoutName.length,
        withoutBilling: withoutBilling.length,
        withoutPhone: withoutPhone.length,
        withoutToken: withoutToken.length,
      },
      orderQuality: {
        total: orders.length,
        guestOrders: guestOrders.length,
        registeredOrders: registeredOrders.length,
        withoutEmail: withoutEmail.length,
        withoutItems: withoutItems.length,
        zeroTotal: zeroTotal.length,
        orphanOrders: orphanOrders.length,
        statusDistribution: statusCounts,
      },
      issues,
      verdict: issues.length === 0 ? "pass" : "warning",
    };

    const reportPath = "/tmp/migration-verification.json";
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Full verification report: ${reportPath}`);

    if (issues.length > 0) {
      process.exit(1);
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
