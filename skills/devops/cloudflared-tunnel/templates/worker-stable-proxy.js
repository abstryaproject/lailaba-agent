// Lailaba AI — stable Cloudflare Worker reverse-proxy.
// Users hit the stable *.workers.dev name; this Worker forwards every request
// to the current quick-tunnel URL stored in the TUNNEL KV namespace.
// The keepalive script (cloudflared-keepalive-stable.sh) updates TUNNEL_URL in
// KV whenever cloudflared restarts and gets a new rotating URL.

export default {
  async fetch(request, env) {
    const target = env.TUNNEL_URL;
    if (!target) {
      return new Response(
        "Tunnel URL not configured yet. Wait for the on-device keepalive to publish it.",
        { status: 503, headers: { "content-type": "text/plain" } }
      );
    }

    const url = new URL(request.url);
    const upstream = target.replace(/\/+$/, "") + url.pathname + url.search;

    const headers = new Headers(request.headers);
    headers.set("host", new URL(target).host);
    headers.set("x-forwarded-proto", url.protocol.replace(":", ""));
    headers.set("x-forwarded-host", url.host);

    const init = {
      method: request.method,
      headers,
      redirect: "manual",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
    }

    try {
      const resp = await fetch(upstream, init);
      const out = new Response(resp.body, resp);
      const loc = out.headers.get("location");
      if (loc && loc.includes(new URL(target).host)) {
        out.headers.set("location", loc.replace(new URL(target).host, url.host));
      }
      const sc = out.headers.get("set-cookie");
      if (sc && sc.includes(new URL(target).host)) {
        out.headers.set("set-cookie", sc.replace(new URL(target).host, url.host));
      }
      out.headers.set("access-control-allow-origin", url.origin);
      out.headers.set("access-control-allow-credentials", "true");
      return out;
    } catch (e) {
      return new Response("Tunnel upstream error: " + e.message, {
        status: 502,
        headers: { "content-type": "text/plain" },
      });
    }
  },
};
