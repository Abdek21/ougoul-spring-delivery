// AJOUT (2026-09) : semaine calendaire DIMANCHE→SAMEDI (convention locale
// confirmée avec l'utilisateur — PAS la semaine ISO lundi→dimanche).
// Fonctions pures, réutilisées par ChiffreAffaireView.jsx et par le
// filtre semaine de CommandesView.jsx (voir commandesView/helpers.js),
// via le composant partagé components/ui/SelecteurSemaine.jsx — pour ne
// jamais dupliquer ce calcul.
//
// Accesseurs LOCAUX partout (jamais toISOString()) — même piège de
// fuseau déjà rencontré et corrigé cette session sur dateISO()/
// decalerDateSimple() (commandesView/helpers.js) : à Djibouti (UTC+3),
// toISOString() peut faire glisser une date d'un jour selon l'heure.

function dateISOLocale(d) {
  const annee = d.getFullYear()
  const mois  = String(d.getMonth() + 1).padStart(2, '0')
  const jour  = String(d.getDate()).padStart(2, '0')
  return `${annee}-${mois}-${jour}`
}

function parseDateLocale(str) {
  const [annee, mois, jour] = str.split('-').map(Number)
  return new Date(annee, mois - 1, jour)
}

// Semaine { debut, fin } (YYYY-MM-DD, toutes deux incluses) contenant
// dateInput (chaîne YYYY-MM-DD ou objet Date). getDay() : 0 = dimanche.
export function semaineDeDate(dateInput) {
  const d = typeof dateInput === 'string' ? parseDateLocale(dateInput) : new Date(dateInput)
  const dimanche = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay())
  const samedi   = new Date(dimanche.getFullYear(), dimanche.getMonth(), dimanche.getDate() + 6)
  return { debut: dateISOLocale(dimanche), fin: dateISOLocale(samedi) }
}

export function semaineActuelle() {
  return semaineDeDate(new Date())
}

// Décale une semaine de N semaines entières (N négatif = en arrière).
export function semaineDecalee(semaine, deltaSemaines) {
  const dimanche = parseDateLocale(semaine.debut)
  return semaineDeDate(new Date(dimanche.getFullYear(), dimanche.getMonth(), dimanche.getDate() + deltaSemaines * 7))
}

// Jour calendaire suivant fin (utile pour une borne exclusive de requête
// sur une colonne timestamptz, ex. .lt('cree_le', journeeSuivante(semaine.fin))).
export function journeeSuivante(dateStr) {
  const d = parseDateLocale(dateStr)
  return dateISOLocale(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))
}

// Vrai si un timestamptz (ex. commandes.cree_le) tombe dans la semaine —
// même convention que le filtre mois déjà en place (useCommandesView.js,
// `c.cree_le?.slice(0, 7)`) : simple slice sur cree_le tel que renvoyé
// par Supabase, sans conversion de fuseau — reste cohérent avec ce que
// le filtre mois considère déjà comme "le jour" d'une commande.
export function dateDansSemaine(dateTimestamp, semaine) {
  if (!dateTimestamp) return false
  const jour = dateTimestamp.slice(0, 10)
  return jour >= semaine.debut && jour <= semaine.fin
}

// Libellé compact pour affichage — "01 – 07 sept. 2026", ou juste le
// jour de début si même mois/année que la fin ("28 – 04 sept. 2026" reste
// explicite dans les deux cas car le mois de fin est toujours précisé).
export function libelleSemaine(semaine) {
  const debut = parseDateLocale(semaine.debut)
  const fin   = parseDateLocale(semaine.fin)
  const memeMois = debut.getMonth() === fin.getMonth() && debut.getFullYear() === fin.getFullYear()
  const debutStr = debut.toLocaleDateString('fr-FR', memeMois ? { day: '2-digit' } : { day: '2-digit', month: 'short' })
  const finStr   = fin.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  return `${debutStr} – ${finStr}`
}
