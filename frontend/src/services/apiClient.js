const API_BASE_URL = import.meta.env?.VITE_API_URL?.replace(/\/+$/, "") || "";
let csrfToken = "";

export function resolveApiUrl(path, baseUrl = API_BASE_URL) {
  const base = baseUrl.replace(/\/+$/, "");
  return base ? `${base}${path.startsWith("/") ? path : `/${path}`}` : path;
}

function readCookie(name) {
  const match = document.cookie.split("; ").find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : "";
}

export function clearCsrf() {
  csrfToken = "";
}

export async function apiRequest(path, { method = "GET", body } = {}) {
  const result = await apiRequestDetailed(path, { method, body });
  return result.data;
}

export async function apiRequestDetailed(path, { method = "GET", body } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  const token = csrfToken || readCookie("schevo.csrf");
  if (token && method !== "GET" && method !== "HEAD") headers["x-csrf-token"] = token;
  const started = performance.now();
  let response;
  try {
    response = await fetch(resolveApiUrl(path), {
      method,
      headers,
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (requestError) {
    const reason = requestError instanceof Error ? `: ${requestError.message}` : "";
    const error = new Error(`Could not connect to the Schevo API. Check that the platform server is running${reason}.`);
    error.cause = requestError;
    throw error;
  }

  const contentType = response.headers?.get?.("content-type") || "";
  const hasResponseHeaders = Boolean(response.headers);
  const data = contentType.includes("application/json") || !hasResponseHeaders
    ? await response.json().catch(() => ({}))
    : {};
  if (data.csrfToken) csrfToken = data.csrfToken;
  const responseHeaders = response.headers && typeof response.headers.entries === "function"
    ? Object.fromEntries(response.headers.entries())
    : {};
  const result = { status: response.status, duration: Math.round(performance.now() - started), headers: responseHeaders, data };
  if (!response.ok) {
    const message = data.message || (
      response.status >= 500 && !contentType.includes("application/json")
        ? "Could not reach the Schevo API. Check that the platform server is running."
        : "Request failed."
    );
    const error = new Error(message);
    error.status = response.status;
    error.result = result;
    throw error;
  }
  if (hasResponseHeaders && !contentType.includes("application/json")) {
    throw new Error("The Schevo API returned an unexpected response.");
  }
  return result;
}
