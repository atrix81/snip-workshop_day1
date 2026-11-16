const { resolve, sep } = require("node:path");
const { stat } = require("node:fs/promises");

const links = new Map();
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const port = Number(process.env.PORT || 3000);
const configuredBaseUrl =
  process.env.BASE_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${port}`);
const baseUrl = configuredBaseUrl.replace(/\/+$/, "");
const publicDir = process.env.PUBLIC_DIR
  ? resolve(process.cwd(), process.env.PUBLIC_DIR)
  : null;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data, status = 200) {
  return Response.json(data, { status, headers: corsHeaders });
}

function makeCode() {
  let code = "";

  while (code.length < 6) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const byte of bytes) {
      if (byte < 248) {
        code += alphabet[byte % alphabet.length];
        if (code.length === 6) break;
      }
    }
  }

  return code;
}

async function serveStatic(pathname) {
  if (!publicDir) return null;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decodedPath.includes("\0")) return null;

  const relativePath =
    decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const filePath = resolve(publicDir, relativePath);
  if (
    filePath !== publicDir &&
    !filePath.startsWith(`${publicDir}${sep}`)
  ) {
    return null;
  }

  let fileInfo;
  try {
    fileInfo = await stat(filePath);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
    throw error;
  }

  if (!fileInfo.isFile()) return null;

  const file = Bun.file(filePath);
  const headers = { ...corsHeaders };
  if (file.type) headers["Content-Type"] = file.type;
  return new Response(file, { headers });
}

Bun.serve({
  hostname: "0.0.0.0",
  port,
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const { pathname } = new URL(request.url);

    if (request.method === "POST" && pathname === "/api/links") {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "Request body must be valid JSON" }, 400);
      }

      const url = typeof body?.url === "string" ? body.url.trim() : "";
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch {
        return jsonResponse({ error: "url must be a valid HTTP or HTTPS URL" }, 400);
      }

      if (
        (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") ||
        !parsedUrl.hostname
      ) {
        return jsonResponse({ error: "url must be a valid HTTP or HTTPS URL" }, 400);
      }

      let code;
      do {
        code = makeCode();
      } while (links.has(code));

      const link = {
        code,
        url,
        shortUrl: `${baseUrl}/${code}`,
        hits: 0,
        createdAt: new Date().toISOString(),
      };
      links.set(code, link);
      return jsonResponse(link, 201);
    }

    if (request.method === "GET" && pathname === "/api/links") {
      return jsonResponse(Array.from(links.values()));
    }

    if (request.method === "GET") {
      const staticFile = await serveStatic(pathname);
      if (staticFile) return staticFile;

      const code = pathname.slice(1);
      if (code && !code.includes("/")) {
        const link = links.get(code);
        if (link) {
          link.hits += 1;
          return new Response(null, {
            status: 302,
            headers: { ...corsHeaders, Location: new URL(link.url).href },
          });
        }
      }
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
});

console.log(`Snip backend listening on http://0.0.0.0:${port}`);
