import { supabase } from './supabase'

// AJOUT (point 6, audit Stock) : seuil d'alerte stock dépôt faible —
// source unique, importée par StockView.jsx et Notifications.jsx.
// Avant, dupliqué en deux constantes séparées (SEUIL_ALERTE_CARTONS /
// SEUIL_STOCK_CARTONS) à la même valeur — le genre de duplication qui a
// déjà fait dériver silencieusement le calcul du stock usine (voir plus
// bas) le jour où l'une des deux copies a été modifiée sans l'autre.
export const SEUIL_ALERTE_STOCK_CARTONS = 100

// Calcule les 3 étapes du circuit stock : fabrication du jour (produit
// <24h), stock usine (produit >24h, pas encore sorti vers le dépôt) et
// stock dépôt (vendable). Source unique partagée par StockView.jsx,
// DashboardView.jsx et tout futur module de suivi.
//
// MODIFIÉ (2026-07-21, point 1 de l'audit Stock) : le calcul tournait
// avant entièrement côté JS, sur 3 requêtes sans `.limit()` — au-delà de
// 1000 lignes (plafond par défaut de PostgREST), productions/
// sorties_usine/stocks auraient été silencieusement tronquées et le
// résultat aurait dérivé sans erreur visible. Délégué à la fonction
// Postgres calculer_stock_usine() (scripts/lot7_stock_rpc_et_corrections.sql),
// qui fait la même agrégation directement en base, sans ce plafond.
export async function calculerStockUsine() {
  const { data, error } = await supabase.rpc('calculer_stock_usine').single()
  if (error) throw error
  return {
    btlDepot:            Number(data?.btl_depot) || 0,
    btlUsine:            Number(data?.btl_usine) || 0,
    btlFabricationJour:  Number(data?.btl_fabrication_jour) || 0,
  }
}
