// hkasr.joe2643.work: static assets + model/wasm files streamed from R2 (same origin, so no CORS needed).
const SEC = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
};
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    if (p.startsWith("/models/") || (p.startsWith("/ort/") && p.endsWith(".wasm"))) {
      if (req.method !== "GET" && req.method !== "HEAD") return new Response("method not allowed", { status: 405, headers: SEC });
      const key = decodeURIComponent(p.slice(1));
      if (key.includes("..") || key.includes("//")) return new Response("not found", { status: 404, headers: SEC });
      const obj = await env.MODELS.get(key, { onlyIf: req.headers });
      if (obj === null) return new Response("not found", { status: 404, headers: SEC });
      const h = new Headers(SEC);
      obj.writeHttpMetadata(h);
      h.set("etag", obj.httpEtag);
      if (!("body" in obj)) return new Response(null, { status: 304, headers: h });
      h.set("content-length", String(obj.size));
      return new Response(req.method === "HEAD" ? null : obj.body, { status: 200, headers: h });
    }
    return env.ASSETS.fetch(req);
  },
};
