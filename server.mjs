import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3000;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function sendError(response, status, message) {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(message);
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/") {
    response.writeHead(302, { Location: "/html/index.html" });
    response.end();
    return;
  }

  let requestedPath;
  try {
    requestedPath = decodeURIComponent(url.pathname);
  } catch {
    sendError(response, 400, "Invalid URL");
    return;
  }

  const filePath = path.resolve(projectRoot, `.${requestedPath}`);
  if (filePath !== projectRoot && !filePath.startsWith(`${projectRoot}${path.sep}`)) {
    sendError(response, 403, "Forbidden");
    return;
  }

  try {
    await access(filePath);
    const fileInfo = await stat(filePath);

    if (!fileInfo.isFile()) {
      sendError(response, 404, "Page not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": fileInfo.size,
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendError(response, 404, "Page not found");
      return;
    }

    console.error("Unable to serve file:", error);
    sendError(response, 500, "Internal server error");
  }
});

server.listen(port, () => {
  console.log(`BloodBridge is running at http://localhost:${port}/html/index.html`);
});
