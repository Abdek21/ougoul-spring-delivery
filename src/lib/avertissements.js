// Logique partagée entre l'aperçu React (AvertissementsView.jsx) et la
// génération PDF (pdf.js) — un seul endroit pour les règles d'accord,
// pour que l'aperçu à l'écran et le PDF exporté ne divergent jamais.

const ORDINAUX = [
  '', 'premier', 'deuxième', 'troisième', 'quatrième', 'cinquième',
  'sixième', 'septième', 'huitième', 'neuvième', 'dixième',
]

// "avertissement" est masculin, donc toujours "premier"/"deuxième"...
// même au féminin pour la personne visée (voir modèle : "un premier
// avertissement", pas "une première"). Généralise au-delà de 10 avec
// un suffixe "e" (11e, 12e...) plutôt que de planter.
export function numeroEnLettres(n) {
  return ORDINAUX[n] || `${n}e`
}

export function civiliteLongue(civilite) {
  return civilite === 'Mme' ? 'Madame,' : 'Monsieur,'
}

export function accordSalarie(civilite) {
  return civilite === 'Mme' ? 'La Salariée' : 'Le Salarié'
}
