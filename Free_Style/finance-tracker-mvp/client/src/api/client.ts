export const API = "http://localhost:3001";

export type ApiFetch = (path: string, init?: RequestInit) => Promise<Response>;

export function createApiFetch(params: {
  token: string | null;
  onUnauthorized: () => void;
}): ApiFetch {
  const { token, onUnauthorized } = params;

  // ✅ guard: чтобы logout сработал ровно один раз
  let unauthorizedHandled = false;

  return async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);

    // ✅ ставим JSON content-type только если body — строка (обычно JSON.stringify)
    // и если пользователь сам не передал Content-Type
    const hasContentType = headers.has("Content-Type");
    const bodyIsString = typeof init.body === "string";

    if (!hasContentType && bodyIsString) {
      headers.set("Content-Type", "application/json");
    }

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const res = await fetch(`${API}${path}`, {
      ...init,
      headers,
    });

    if (res.status === 401) {
      if (!unauthorizedHandled) {
        unauthorizedHandled = true;
        onUnauthorized();
      }
      // важно: кидаем ошибку, чтобы вызывающий код прервался
      throw new Error("Unauthorized");
    }

    return res;
  };
}