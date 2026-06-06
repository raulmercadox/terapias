import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Node 24+ carga el .env sin dependencias externas.
process.loadEnvFile?.();

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
