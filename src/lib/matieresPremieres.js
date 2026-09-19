import { supabase } from './supabase'

// Enregistre un arrivage matière première. Relit toujours le stock actuel
// frais en base (v_stock_matieres_premieres) juste avant l'insertion —
// jamais depuis un state local déjà chargé, qui peut être périmé ou pas
// trié chronologiquement. Avant cette extraction, StockView.jsx et
// LivraisonsView.jsx avaient deux implémentations divergentes du même
// geste métier ; celle-ci reprend la version sûre (StockView.jsx).
// AJOUT (2026-08) : `date` optionnelle — défaut inchangé (aujourd'hui) pour
// ArrivagesMatieresView.jsx, mais MatieresPremieresComptableView.jsx a
// besoin de pouvoir dater un arrivage en retard, comme le fait déjà la
// consommation sur cet écran (dateConsommation, backdatable).
export async function enregistrerArrivageMP({ matiereId, quantite, note, creePar, date }) {
  const { data: mpFrais, error: errLecture } = await supabase
    .from('v_stock_matieres_premieres')
    .select('stock_actuel')
    .eq('id', matiereId)
    .single()
  if (errLecture) throw errLecture

  const { error } = await supabase.from('mouvements_matieres_premieres').insert({
    matiere_id:      matiereId,
    date_mouvement:  date || new Date().toISOString().split('T')[0],
    type_mouvement:  'Entree_fournisseur',
    quantite_entree: quantite,
    stock_apres:     (mpFrais?.stock_actuel || 0) + quantite,
    note:            note || null,
    cree_par:        creePar,
  })
  if (error) throw error
}
