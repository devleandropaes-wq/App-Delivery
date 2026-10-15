import { useEffect, useState } from "react";

import { ADMIN_TOKEN_KEY, getAdminToken } from "@/src/api";
import { storage } from "@/src/utils/storage";

export { ADMIN_TOKEN_KEY, getAdminToken };

export async function adminLogout(): Promise<void> {
  await storage.secureRemove(ADMIN_TOKEN_KEY);
}

export function useAdminToken() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getAdminToken().then((t) => {
      setToken(t);
      setReady(true);
    });
  }, []);

  return { token, ready, setToken };
}
