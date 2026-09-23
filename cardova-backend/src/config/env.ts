import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

let loaded = false;

export function loadEnv(): void {
  if (loaded) {
    return;
  }

  dotenv.config({ path: join(backendRoot, ".env"), quiet: true });
  loaded = true;
}

loadEnv();

export interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
}

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

function requiredEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new ConfigError(`Missing required environment variable ${name}`);
  }
  return value;
}

export function getDatabaseConfig(): DatabaseConfig {
  const portRaw = readEnv("DATABASE_PORT") || "5432";
  const port = Number.parseInt(portRaw, 10);
  if (!Number.isFinite(port) || port <= 0) {
    throw new ConfigError("DATABASE_PORT must be a positive integer");
  }

  return {
    host: requiredEnv("DATABASE_HOST"),
    port,
    name: requiredEnv("DATABASE_NAME"),
    user: requiredEnv("DATABASE_USER"),
    password: readEnv("DATABASE_PASSWORD"),
  };
}

export function getPokemonTcgApiKey(): string | undefined {
  const key = readEnv("POKEMON_TCG_API_KEY");
  return key || undefined;
}

export function getScrydexCredentials(): { apiKey: string; teamId: string } | null {
  const apiKey = readEnv("SCRYDEX_API_KEY");
  const teamId = readEnv("SCRYDEX_TEAM_ID");
  if (!apiKey || !teamId) return null;
  return { apiKey, teamId };
}
