export function isDatabaseUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const record = error as { name?: unknown; code?: unknown; message?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message : "";

  return (
    record.name === "ConfigError" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "28P01" ||
    /password must be a/i.test(message) ||
    /SASL/i.test(message)
  );
}
