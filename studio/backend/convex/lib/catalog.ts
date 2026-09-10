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
export function serviceFields(args: {name:string;durationMinutes:number;priceMinor:number;currency:"GBP";description?:string}) {
  const result={name:name(args.name),durationMinutes:args.durationMinutes,priceMinor:args.priceMinor,currency:args.currency,description:optional(args.description,2000,"INVALID_DESCRIPTION")};
  if(!Number.isSafeInteger(result.durationMinutes)||result.durationMinutes<1||result.durationMinutes>1440) throw new ConvexError("INVALID_DURATION");
  if(!Number.isSafeInteger(result.priceMinor)||result.priceMinor<0||result.priceMinor>100000000) throw new ConvexError("INVALID_PRICE");
  return result;
}
export function clientFields(args:{name:string;email?:string;phone?:string}) {
  const result={name:name(args.name),email:optional(args.email,254,"INVALID_EMAIL"),phone:optional(args.phone,40,"INVALID_PHONE")};
  if(result.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)||/[\p{Cc}\p{Zl}\p{Zp}]/u.test(result.email))) throw new ConvexError("INVALID_EMAIL");
  if(result.phone && /[\p{Cc}\p{Zl}\p{Zp}]/u.test(result.phone)) throw new ConvexError("INVALID_PHONE");
  return result;
}
export const searchText=(name:string,email?:string)=>`${name} ${email??""}`.trim().toLowerCase().replace(/\s+/g," ");
export function expectedRevision(value:number) {
  if(!Number.isSafeInteger(value)||value<0) throw new ConvexError("INVALID_REVISION");
}
