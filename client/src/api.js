let accessToken = null;
let refreshPromise = null;
const onUnauthorized = [];

export const setAccessToken = (t) => (accessToken = t);
export const getAccessToken = () => accessToken;
export const onAuthError = (fn) => onUnauthorized.push(fn);

const normalizeBody = (data) => {
  if (data === undefined || data === null) return undefined;
  return JSON.stringify(data);
};

async function rawFetch(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(path, {
    method,
    headers,
    body: normalizeBody(body),
    credentials: "include",
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error(data?.error?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = data?.error?.code;
    err.data = data?.error;
    throw err;
  }
  return data;
}

async function refresh() {
  if (!refreshPromise) {
    refreshPromise = rawFetch("/api/auth/refresh", { method: "POST", body: {} })
      .then((d) => {
        accessToken = d.token;
        return d;
      })
      .finally(() => (refreshPromise = null));
  }
  return refreshPromise;
}

export async function api(path, { method = "GET", body } = {}) {
  try {
    return await rawFetch(path, { method, body });
  } catch (err) {
    if (err.status === 401 && path !== "/api/auth/login") {
      try {
        await refresh();
        return await rawFetch(path, { method, body });
      } catch {
        onUnauthorized.forEach((fn) => fn());
        throw err;
      }
    }
    throw err;
  }
}

export const http = {
  get: (p) => api(p),
  post: (p, body) => api(p, { method: "POST", body }),
  patch: (p, body) => api(p, { method: "PATCH", body }),
  delete: (p) => api(p, { method: "DELETE" }),
};

export const receiptUrl = (type, id) =>
  `/pdf/receipt.php?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}&token=${encodeURIComponent(accessToken || "")}`;

export const openReceipt = (type, id) => {
  if (!accessToken) return;
  const url = receiptUrl(type, id);
  window.open(url, "_blank");
};
