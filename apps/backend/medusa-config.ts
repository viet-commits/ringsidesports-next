import { defineConfig, loadEnv } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

const DATABASE_URL = process.env.DATABASE_URL || "postgres://ringsidesports:ringsidesports@localhost:5433/ringsidesports";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6380";
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const COOKIE_SECRET = process.env.COOKIE_SECRET || "supersecret";
const STORE_CORS = process.env.STORE_CORS || "https://ringsidesports.com.au";
const ADMIN_CORS = process.env.ADMIN_CORS || "https://admin.ringsidesports.com.au";

export default defineConfig({
  admin: {
    disable: false,
    backendUrl: process.env.MEDUSA_ADMIN_BACKEND_URL || "https://api.ringsidesports.com.au",
  },
  projectConfig: {
    databaseUrl: DATABASE_URL,
    http: {
      jwtSecret: JWT_SECRET,
      cookieSecret: COOKIE_SECRET,
      storeCors: STORE_CORS,
      adminCors: ADMIN_CORS,
      authCors: STORE_CORS,
    },
    redisUrl: REDIS_URL,
    workerMode: process.env.MEDUSA_WORKER_MODE || "server",
  },
  plugins: [
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            id: "stripe",
            resolve: "@medusajs/medusa/payment-stripe",
            options: {
              apiKey: process.env.STRIPE_API_KEY || "",
              webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
            },
          },
        ],
      },
    },
  ],
  modules: [
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          {
            id: "manual",
            resolve: "@medusajs/medusa/fulfillment-manual",
          },
        ],
      },
    },
  ],
});
