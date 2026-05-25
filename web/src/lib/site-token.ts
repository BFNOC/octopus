export function parseTokenExpiresAtInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  if (/^\d+$/.test(trimmed)) {
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error("token_expires_at 必须是正整数时间戳");
    }
    return parsed < 1_000_000_000_000
      ? Math.trunc(parsed * 1000)
      : Math.trunc(parsed);
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("token_expires_at 必须是时间戳或可解析时间");
  }
  return Math.trunc(parsed);
}
