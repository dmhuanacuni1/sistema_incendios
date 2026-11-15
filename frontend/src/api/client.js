const API = "/api";

let refrescoEnCurso = null;

async function leerJson(response) {
  const texto = await response.text();
  if (!texto) return {};
  try {
    return JSON.parse(texto);
  } catch {
    return {};
  }
}

const CLAVE_USUARIO = "usuario";

export function guardarSesion(data) {
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);
  if (data.usuario) localStorage.setItem(CLAVE_USUARIO, JSON.stringify(data.usuario));
}

export function leerUsuario() {
  if (!localStorage.getItem("access_token") && !localStorage.getItem("refresh_token")) return null;
  try {
    const texto = localStorage.getItem(CLAVE_USUARIO);
    return texto ? JSON.parse(texto) : null;
  } catch {
    return null;
  }
}

export function guardarUsuario(usuario) {
  if (usuario) localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
  else localStorage.removeItem(CLAVE_USUARIO);
}

export function limpiarSesion() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem(CLAVE_USUARIO);
}

export function accessTokenPorCaducar(margenSegundos = 120) {
  const token = localStorage.getItem("access_token");
  if (!token) return true;
  const parte = token.split(".")[1];
  if (!parte) return true;
  try {
    const base64 = parte.replace(/-/g, "+").replace(/_/g, "/");
    const relleno = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(relleno));
    if (!payload.exp) return true;
    return payload.exp * 1000 - Date.now() < margenSegundos * 1000;
  } catch {
    return true;
  }
}

export async function refrescarAccessToken() {
  const refresh = localStorage.getItem("refresh_token");
  if (!refresh) return false;
  if (!refrescoEnCurso) {
    refrescoEnCurso = fetch(`${API}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    })
      .then(async (response) => {
        if (!response.ok) return false;
        const data = await leerJson(response);
        if (!data.access_token) return false;
        guardarSesion(data);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refrescoEnCurso = null;
      });
  }
  return refrescoEnCurso;
}

export async function api(path, { method = "GET", body, auth = true, reintentar = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = localStorage.getItem("access_token");
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    const error = new Error("No hay conexión con el servidor");
    error.status = 0;
    throw error;
  }

  if (response.status === 401 && auth && reintentar && path !== "/auth/refresh") {
    const renovado = await refrescarAccessToken();
    if (renovado) return api(path, { method, body, auth, reintentar: false });
    limpiarSesion();
  }

  const data = await leerJson(response);
  if (!response.ok) {
    const error = new Error(data.error || "No se pudo completar la solicitud");
    error.status = response.status;
    throw error;
  }
  return data;
}
