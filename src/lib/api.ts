export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (response.headers.get("content-type")?.includes("application/json")) {
    const json = (await response.json()) as { ok: boolean; data: T; error?: string };
    if (!response.ok || !json.ok) {
      throw new Error(json.error ?? "Request failed");
    }
    return json.data;
  }
  if (!response.ok) throw new Error("Request failed");
  return undefined as T;
}
