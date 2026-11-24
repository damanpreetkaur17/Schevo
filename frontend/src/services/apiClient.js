let csrfToken = "";

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
  const response = await fetch(path, {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (data.csrfToken) csrfToken = data.csrfToken;
  const responseHeaders = response.headers && typeof response.headers.entries === "function"
    ? Object.fromEntries(response.headers.entries())
    : {};
  const result = { status: response.status, duration: Math.round(performance.now() - started), headers: responseHeaders, data };
  if (!response.ok) {
    const error = new Error(data.message || "Request failed.");
    error.status = response.status;
    error.result = result;
    throw error;
  }
  return result;
}
