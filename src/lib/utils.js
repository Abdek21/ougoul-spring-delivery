// Fonctions utilitaires réutilisables dans toute l'application.
// Plutôt que réécrire la même logique partout, on l'écrit ici une fois.

// Formate un nombre en monnaie djiboutienne
// Ex : formatCurrency(15000) → "15 000 DJF"
export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '—' // Si pas de valeur, affiche un tiret
  return new Intl.NumberFormat('fr-DJ').format(amount) + ' DJF'
}

// Formate une date en français long
// Ex : formatDate('2025-06-14') → "14 juin 2025"
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric'
  })
}

// Retourne les 2 initiales d'un nom
// Ex : getInitials('Amina Hassan') → "AH"
export function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

// Combine des classes CSS de façon conditionnelle
// Ex : cn('text-red', isActif && 'font-bold') → "text-red font-bold" si isActif est true
export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

// Retourne la couleur Tailwind selon le statut d'une commande
export function getStatutColor(statut) {
  const map = {
    'En_preparation': 'bg-amber-100 text-amber-800', // Orange = en cours
    'Livree':         'bg-blue-100 text-blue-800',   // Bleu = livrée
    'Payee':          'bg-green-100 text-green-800', // Vert = payée
  }
  return map[statut] || 'bg-gray-100 text-gray-600'
}

// Retourne le label lisible d'un statut
export function getStatutLabel(statut) {
  const map = {
    'En_preparation': 'En préparation',
    'Livree':         'Livrée',
    'Payee':          'Payée',
  }
  return map[statut] || statut
}

// Couleur selon le résultat d'un prospect
export function getResultatColor(resultat) {
  const map = {
    'Prospect_actif': 'bg-blue-100 text-blue-800',
    'Client_obtenu':  'bg-green-100 text-green-800',
    'A_suivre':       'bg-purple-100 text-purple-800',
    'Refus':          'bg-red-100 text-red-800',
  }
  return map[resultat] || 'bg-gray-100 text-gray-600'
}

// Label lisible pour le résultat d'un prospect
export function getResultatLabel(resultat) {
  const map = {
    'Prospect_actif': 'Prospect actif',
    'Client_obtenu':  'Client obtenu',
    'A_suivre':       'À suivre',
    'Refus':          'Refus',
  }
  return map[resultat] || resultat
}

// Couleur selon le niveau d'intérêt d'un prospect
export function getInteretColor(interet) {
  const map = {
    'Tres_interesse': 'bg-green-100 text-green-800',
    'Interesse':      'bg-blue-100 text-blue-800',
    'Peu_interesse':  'bg-amber-100 text-amber-800',
    'Pas_interesse':  'bg-red-100 text-red-800',
  }
  return map[interet] || 'bg-gray-100 text-gray-600'
}

// Label lisible pour le niveau d'intérêt
export function getInteretLabel(interet) {
  const map = {
    'Tres_interesse': 'Très intéressé',
    'Interesse':      'Intéressé',
    'Peu_interesse':  'Peu intéressé',
    'Pas_interesse':  'Pas intéressé',
  }
  return map[interet] || interet
}

// Étiquette "eau non-buvable" (dérogation exceptionnelle validée par
// Soumeya, cf. CommandesView.jsx) — visible seulement dans les 24h qui
// suivent la validation, ensuite elle disparaît d'elle-même sans qu'il
// soit nécessaire de repasser eau_potable à true en base.
export function estEtiquetteNonBuvableActive(commande) {
  if (!commande || commande.eau_potable !== false || !commande.date_derogation_potable) return false
  const heuresEcoulees = (Date.now() - new Date(commande.date_derogation_potable).getTime()) / 3600000
  return heuresEcoulees < 24
}