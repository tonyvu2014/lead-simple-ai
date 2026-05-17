import { supabase } from "@/lib/supabase";

export async function getSessionAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const accessToken = await getSessionAccessToken();

  if (!accessToken) {
    throw new Error("Authentication required.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  return fetch(input, {
    ...init,
    headers,
  });
}
