"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;
      router.replace(session ? "/dashboard" : "/login");
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  return null;
}
