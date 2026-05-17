import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
  );
}

const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
}

export async function requireAuthUser(
  request: Request
): Promise<{ user: AuthenticatedUser } | { response: NextResponse }> {
  const token = getBearerToken(request);

  if (!token) {
    return {
      response: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      ),
    };
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);

  if (error || !data.user) {
    return {
      response: NextResponse.json(
        { error: "Invalid or expired session." },
        { status: 401 }
      ),
    };
  }

  return { user: { id: data.user.id, email: data.user.email ?? null } };
}

export async function ensureLegacyUserRow(user: AuthenticatedUser) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    const { error: insertError } = await supabaseAdmin.from("users").insert({
      id: user.id,
      email: user.email ?? `${user.id}@auth.local`,
      password: "SUPABASE_AUTH_MANAGED",
    });

    if (insertError) {
      throw new Error(insertError.message);
    }
  }
}

export async function requireOwnedProduct(
  request: Request,
  productId: string
): Promise<
  | { user: AuthenticatedUser; product: { id: string; user_id: string } }
  | { response: NextResponse }
> {
  const auth = await requireAuthUser(request);
  if ("response" in auth) return auth;

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, user_id")
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    return {
      response: NextResponse.json({ error: error.message }, { status: 500 }),
    };
  }

  if (!data) {
    return {
      response: NextResponse.json({ error: "Product not found." }, { status: 404 }),
    };
  }

  if (data.user_id !== auth.user.id) {
    return {
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  return { user: auth.user, product: data };
}
