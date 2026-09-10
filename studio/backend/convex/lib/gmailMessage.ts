"use node";
export function messagePreview(data: any) {
  const headers = Array.isArray(data.payload?.headers)
    ? data.payload.headers
    : [];
  const header = (name: string) =>
    String(
      headers.find((h: any) => String(h.name).toLowerCase() === name)?.value ??
        "",
    )
      .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, " ")
      .trim();
  let text = "",
    hasAttachments = false,
    parts = 0;
  function visit(part: any, depth = 0) {
    if (!part || depth > 10 || ++parts > 100) return;
    if (part.filename || part.body?.attachmentId) hasAttachments = true;
    if (part.mimeType === "text/plain" && !part.filename && part.body?.data)
      text += Buffer.from(part.body.data, "base64url").toString("utf8") + "\n";
    for (const child of Array.isArray(part.parts) ? part.parts : [])
      visit(child, depth + 1);
  }
  visit(data.payload);
  text = text.trim().replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
  const plainTextAvailable = !!text;
  if (!text)
    text = "[No plain-text body available. Open this message in Gmail.]";
  return {
    id: String(data.id),
    threadId: String(data.threadId ?? ""),
    from: header("from").slice(0, 400),
    subject: (header("subject") || "(No subject)").slice(0, 150),
    date: header("date").slice(0, 100),
    snippet: String(data.snippet ?? "").slice(0, 300),
    text: text.slice(0, 5000),
    bodyTruncated: text.length > 5000,
    hasAttachments,
    plainTextAvailable,
  };
}
export function sender(from: string) {
  const email = from.match(/<?([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>?/);
  const address = email?.[1] && email[1].length <= 254 ? email[1] : undefined;
  const name =
    from
      .replace(/<[^>]*>/g, "")
      .replace(/^"|"$/g, "")
      .trim()
      .slice(0, 100) ||
    address ||
    "Gmail sender";
  return { name, ...(address ? { email: address } : {}) };
}
