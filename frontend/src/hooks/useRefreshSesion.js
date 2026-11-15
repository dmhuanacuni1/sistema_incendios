import { useEffect } from "react";
import { useAuth } from "./useAuth";

export function useRefreshSesion() {
  const { renovar } = useAuth();

  useEffect(() => {
    function alVolver() {
      if (document.visibilityState === "visible") renovar();
    }
    window.addEventListener("focus", renovar);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.removeEventListener("focus", renovar);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [renovar]);
}
