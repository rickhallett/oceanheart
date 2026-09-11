import {
  request as httpRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type OutgoingHttpHeaders,
  type ServerResponse,
} from "node:http";

const hopByHop = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade",
]);

export function proxyRequest(
  incoming: IncomingMessage,
  outgoing: ServerResponse,
  port: number,
  releaseHeaders: Record<string, string> = {},
) {
  const headers: IncomingHttpHeaders = { ...incoming.headers, host: `127.0.0.1:${port}` };
  for (const name of hopByHop) delete headers[name];
  const request = httpRequest({
    hostname: "127.0.0.1",
    port,
    path: incoming.url,
    method: incoming.method,
    headers,
  }, (response) => {
    const responseHeaders: OutgoingHttpHeaders = { ...response.headers, ...releaseHeaders };
    for (const name of hopByHop) delete responseHeaders[name];
    outgoing.writeHead(response.statusCode ?? 502, responseHeaders);
    response.pipe(outgoing);
  });
  request.on("error", () => {
    if (!outgoing.headersSent) outgoing.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    outgoing.end("Application runtime unavailable\n");
  });
  incoming.pipe(request);
}
