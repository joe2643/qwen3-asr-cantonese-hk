// demo.koelony.com: the static demo, plus the two kinds of file too big for Workers static assets
// (25 MiB a file), all served from this origin so the page stays cross-origin isolated:
//   /models/*      from the koelony-demo-models Worker (service binding MODELS): the model,
//                  split into parts under 25 MiB, see deploy/models/README.md
//   /ort/*.wasm    the onnxruntime-web runtime (about 28 MiB), from jsDelivr at the exact version
//                  in ORT_VERSION (wrangler.jsonc), which build.sh checks against package-lock
const SEC = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
};
const withSec = (res, extra = {}) => {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries({ ...SEC, ...extra })) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
};
const plain = (status, text) => new Response(text, { status, headers: SEC });

export default {
  async fetch(req, env) {
    const p = new URL(req.url).pathname;
    const isModel = p.startsWith("/models/");
    const isWasm = p.startsWith("/ort/") && p.endsWith(".wasm");
    if (!isModel && !isWasm) return env.ASSETS.fetch(req);
    if (req.method !== "GET" && req.method !== "HEAD") return plain(405, "method not allowed");

    if (isModel) return withSec(await env.MODELS.fetch(req));

    const name = p.slice("/ort/".length);
    if (!/^[\w.-]+\.wasm$/.test(name)) return plain(404, "not found");
    const src = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${env.ORT_VERSION}/dist/${name}`;
    const res = await fetch(src, { cf: { cacheEverything: true, cacheTtl: 30 * 86400 } });
    if (!res.ok) return plain(res.status === 404 ? 404 : 502, "runtime unavailable");
    return withSec(new Response(req.method === "HEAD" ? null : res.body, res), {
      "Content-Type": "application/wasm",
      "Cache-Control": "public, max-age=86400",
    });
  },
};
