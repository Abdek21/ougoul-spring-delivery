export const MOTIFS_PERTE = ['Fuite', 'Perdu']

// MODIFIÉ : plus de commande de remplacement créée automatiquement — Said
// n'a pas internet et Kassim gère tout lui-même en un seul geste. Une perte
// déclarée bloque simplement la livraison d'origine (elle sort de
// "Livraisons du jour", apparaît dans "Pertes et dommages") jusqu'à ce que
// le remplacement soit physiquement livré et que Kassim confirme cette
// même livraison — la perte passe alors à 'Resolue'.
export const STATUT_PERTE_CONFIG = {
  En_attente: { label: 'En attente',  class: 'bg-red-100 text-red-700' },
  Resolue:    { label: 'Résolue',     class: 'bg-green-100 text-green-700' },
  Annule:     { label: 'Annulée',     class: 'bg-slate-100 text-slate-500' },
}
