// Extrait de LivraisonsView.jsx (refactor découpage, 2026-08) — constantes
// et fonctions pures, telles quelles.
import { Clock, Truck, CheckCircle, AlertTriangle, Star, Timer } from 'lucide-react'

export function fmt(n) {
  return Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' DJF'
}

export const STATUT_LIV_CONFIG = {
  Planifiee: { label: 'Planifiée',  class: 'bg-amber-100 text-amber-700',  icon: Clock },
  En_cours:  { label: 'En cours',   class: 'bg-blue-100 text-blue-700',    icon: Truck },
  Livree:    { label: 'Livrée',     class: 'bg-green-100 text-green-700',  icon: CheckCircle },
  Echouee:   { label: 'Échouée',    class: 'bg-red-100 text-red-700',      icon: AlertTriangle },
}

export const TYPE_CLIENT_COLORS = {
  Distributeur: 'bg-purple-100 text-purple-700',
  Entreprise:   'bg-orange-100 text-orange-700',
  Particulier:  'bg-blue-100 text-blue-700',
}

export const MODES_ENCAISSEMENT = {
  Especes: '💵 Espèces',
  D_Money: '📱 D-Money',
  Waafi:   '📱 Waafi',
  CAC:     '📱 CAC',
}

export const TIER_CONFIG = {
  VIP:          { label: 'VIP',          class: 'bg-amber-100 text-amber-800',  icon: Star,  priorite: 0 },
  Normal:       { label: 'Normal',       class: 'bg-slate-100 text-slate-500',  icon: null,  priorite: 1 },
  Retardataire: { label: 'Retardataire', class: 'bg-red-100 text-red-700',      icon: Timer, priorite: 2 },
}

// AJOUT (2026-08) : écart en jours calendaires entre 2 dates (les
// colonnes date_planifiee/date_effective de `livraisons` sont des dates,
// sans heure — un écart de 1 jour peut représenter moins de 24h réelles
// selon l'heure de chaque événement, mais 2 jours ne peut jamais l'être).
export function joursEcart(dateA, dateB) {
  if (!dateA || !dateB) return null
  return Math.round((new Date(dateB) - new Date(dateA)) / 86400000)
}

// CORRIGÉ (2026-08, régression trouvée sur OGS-2026-0129) : la 1ère
// version de ce fix (basée sur estConfirmeeEnRetard, écart > 1 jour) ne
// gouvernait QUE le badge d'affichage, jamais le tri "Livraisons du jour"
// vs "Confirmées en retard" — une livraison Livree confirmée avec un
// écart <= 1 jour tombait dans aucune des deux règles de filtrage et
// atterrissait par défaut dans "Livraisons du jour", peu importe son
// date_planifiee réel (ex. livrée le 08/08, confirmée le 09/08 : écart
// de 1 jour, donc pas "en retard" au sens strict, mais absolument pas
// "du jour" non plus le 26/08).
//
// estLivraisonDuJour() est désormais l'UNIQUE source de vérité pour le
// tri des 2 onglets (utilisée à la fois pour le filtrage dans
// useLivraisonsView.js et pour le badge dans OngletJour.jsx) — garantit
// par construction une partition stricte : chaque livraison tombe dans
// exactement un des deux onglets, jamais aucun ni les deux.
// - "Livraisons du jour" : date_planifiee = aujourd'hui (n'importe quel
//   statut) OU pas encore confirmée (Planifiee/En_cours, même en retard —
//   comportement préexistant à ce fix, volontairement conservé : une
//   livraison pas confirmée doit rester visible comme action à faire,
//   peu importe son ancienneté).
// - "Confirmées en retard" : tout le reste, c-a-d une livraison Livree
//   dont la date planifiée n'est pas aujourd'hui — qu'elle soit en retard
//   d'1 jour ou de 18 jours (cas OGS-2026-0129), elle n'a de toute façon
//   rien à faire dans la vue du jour.
export function estLivraisonDuJour(liv, aujourdhui) {
  if (liv.date_planifiee === aujourdhui) return true
  return liv.statut !== 'Livree'
}
