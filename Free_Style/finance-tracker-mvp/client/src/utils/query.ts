export const qsGet = (sp: URLSearchParams, key: string, fallback = "") =>
    sp.get(key) ?? fallback;
  
  export const qsGetNumber = (sp: URLSearchParams, key: string, fallback: number) => {
    const v = sp.get(key);
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : fallback;
  };
  
  export const qsSet = (
    sp: URLSearchParams,
    key: string,
    value: string | number | null | undefined
  ) => {
    if (value === null || value === undefined || value === "" ) sp.delete(key);
    else sp.set(key, String(value));
  };