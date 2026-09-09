// Parse decimal input as digit strings: no binary floating-point multiplication.
export function poundsToMinor(input: string): number {
  const value = input.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(value))
    throw new Error("Enter a price with up to two decimal places.");
  const [pounds, fraction = ""] = value.split(".");
  const digits = (pounds + fraction.padEnd(2, "0")).replace(/^0+/, "") || "0";
  if (digits.length > 9 || (digits.length === 9 && digits > "100000000"))
    throw new Error("Price must be between £0 and £1,000,000.");
  return Number(digits);
}
export function formatPrice(minor: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(minor / 100);
}
