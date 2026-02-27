export const API = "http://localhost:3001";

export type ApiFetch = (path: string, init?: RequestInit) => Promise<Response>;

export function createApiFetch(params: {
  token: string | null;
  onUnauthorized: () => void;
}): ApiFetch {
  const { token, onUnauthorized } = params;

  return async (path: string, init: RequestInit = {}) => {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (res.status === 401) {
      onUnauthorized();
      throw new Error("Unauthorized");
    }

    return res;
  };
}