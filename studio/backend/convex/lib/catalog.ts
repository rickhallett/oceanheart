import { ConvexError } from "convex/values";
export function name(value: string) {
  if (/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value)) throw new ConvexError("INVALID_NAME");
  const normalized = value.trim();
  if (!normalized || normalized.length > 100) throw new ConvexError("INVALID_NAME");
  return normalized;
}
export function requestKey(value: string) {
  if (!value || value.trim() !== value || value.length > 128) throw new ConvexError("INVALID_REQUEST_KEY");
  return value;
}
export function optional(value: string | undefined, max: number, code: string) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (normalized.length > max) throw new ConvexError(code);
  return normalized;
}
export function pageSize(value: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 50) throw new ConvexError("INVALID_PAGE_SIZE");
}
