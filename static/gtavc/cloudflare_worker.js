export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === "/analytics" && request.method === "POST") {
      let payload
      try {
        payload = await request.json()
      } catch {
        return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: corsHeaders() })
      }

      const record = {
        data: payload,
        ip_address: request.headers.get("CF-Connecting-IP"),
        timestamp: new Date().toISOString()
      }

      await env.ASSETS_KV.put(`analytics:${crypto.randomUUID()}`, JSON.stringify(record))

      return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: corsHeaders() })
    }

    if (url.pathname === "/fetch" && request.method === "GET") {
      const target = url.searchParams.get("url")
      if (!target) {
        return new Response("Missing url parameter", { status: 400 })
      }

      const normalized = target.replace(/\\/g, "/")
      let parsed
      try {
        parsed = new URL(normalized)
      } catch {
        return new Response("Invalid URL", { status: 400 })
      }

      if (parsed.hostname.toLowerCase() !== "cdn.dos.zone") {
        return new Response("Access denied: URL domain not allowed", { status: 403 })
      }

      const filename = parsed.pathname.split("/").pop()
      if (!filename) {
        return new Response("Cannot determine filename from URL", { status: 400 })
      }

      const cacheKey = `asset:${filename}`
      let data = await env.ASSETS_KV.get(cacheKey, { type: "arrayBuffer" })

      if (!data) {
        let lastError
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const controller = new AbortController()
            setTimeout(() => controller.abort(), 10000)

            const res = await fetch(parsed.toString(), { signal: controller.signal })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)

            data = await res.arrayBuffer()
            await env.ASSETS_KV.put(cacheKey, data)
            break
          } catch (e) {
            lastError = e
            if (attempt < 3) {
              await new Promise(r => setTimeout(r, 2 ** attempt * 1000))
            }
          }
        }

        if (!data) {
          return new Response(`Failed after 3 attempts: ${lastError}`, { status: 500 })
        }
      }

      return new Response(data, {
        status: 200,
        headers: {
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Access-Control-Allow-Origin": "*"
        }
      })
    }

    return new Response("Not Found", { status: 404 })
  }
}

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  }
}
