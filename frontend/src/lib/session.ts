import { queryClient } from "@/lib/queryClient";
import { apiPost } from "@/lib/api";

// La session vit dans un cookie httpOnly posé par le backend : le frontend ne manipule
// jamais de token. Ces helpers n'existent que pour tenir le cache react-query propre —
// sans eux, le cache du compte précédent resterait affiché après un changement de compte.

export async function beginSession(): Promise<void> {
  await queryClient.invalidateQueries();
}

export async function endSession(): Promise<void> {
  try {
    await apiPost<void>("/auth/logout");
  } finally {
    // Ordre important : on réinterroge d'abord ["me"] — l'app bascule sur l'écran de
    // connexion et Home se démonte, donc aucune requête de données ne repart avec une
    // session morte (un 401 parasite sur /sheets). On purge le reste ensuite.
    await queryClient.resetQueries({ queryKey: ["me"] });
    queryClient.removeQueries();
  }
}
