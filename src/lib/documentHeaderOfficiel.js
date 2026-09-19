// En-tête/pied de page officiels partagés entre les documents PDF de
// l'app (2026-07-27) — extrait de genererBonLivraison() (pdf.js), qui
// était le premier à utiliser ce visuel (bandeau vert, logo, badge
// numéro, bandeau titre). Pas un composant React : pdf.js dessine
// directement sur un canvas jsPDF (doc.text/doc.rect/...), donc
// l'extraction reste en JS pur (fonctions qui dessinent sur `doc`),
// pas en .jsx — il n'y a pas de rendu React à partager ici.
//
// Utilisé par genererBonLivraison() et genererAvertissementPDF(). Tout
// futur document officiel (contrat, mise en demeure...) peut réutiliser
// ces deux fonctions sans dupliquer le dessin de l'en-tête/pied de page.

export const PALETTE_DOCUMENT_OFFICIEL = {
  vert: [10, 80, 40],
  or:   [34, 165, 89],
  dark: [15, 23, 42],
  gray: [100, 116, 139],
}

export async function getLogoBase64() {
  const response = await fetch('/logo.png')
  const blob     = await response.blob()
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.readAsDataURL(blob)
  })
}

// titreBandeau : titre du document, affiché centré en majuscules dans
//   le bandeau clair sous l'en-tête (ex. "BON DE LIVRAISON").
// service : sous-titre optionnel sous "Eau Minerale Naturelle..." (ex.
//   "Service Logistique & Distribution", "Ressources Humaines").
// numeroDocument : texte affiché dans le badge orange en haut à droite
//   (ex. "Bon n 123", "Avertissement N°2").
// Retourne la palette de couleurs + pageW, pour que l'appelant n'ait
// pas à redéclarer les constantes de couleur, et un y de départ
// suggéré pour le contenu du corps du document.
export async function dessinerEnTeteOfficiel(doc, { titreBandeau, service, numeroDocument }) {
  const { vert, or, dark, gray } = PALETTE_DOCUMENT_OFFICIEL
  const pageW = doc.internal.pageSize.width

  doc.setFillColor(...vert)
  doc.rect(0, 0, pageW, 40, 'F')

  try {
    const logoData = await getLogoBase64()
    doc.addImage(logoData, 'PNG', 10, 2, 36, 36)
  } catch (e) {
    // logo optionnel — le document reste valide sans lui
    console.warn('Logo indisponible pour ce document :', e)
  }

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('OUGOUL SPRING', 52, 16)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Eau Minerale Naturelle — Source de Purete — Djibouti', 52, 24)
  if (service) doc.text(service, 52, 31)

  doc.setFillColor(...or)
  doc.roundedRect(pageW - 58, 8, 48, 12, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(numeroDocument || '', pageW - 34, 16.5, { align: 'center' })

  doc.setFillColor(240, 247, 240)
  doc.rect(0, 40, pageW, 14, 'F')
  doc.setTextColor(...vert)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(titreBandeau || '', pageW / 2, 50, { align: 'center' })

  doc.setTextColor(...dark)

  return { vert, or, dark, gray, pageW, y: 62 }
}

// y (optionnel) : par défaut le bandeau fait 16mm de haut, collé au bas
// physique de la page (comportement historique, utilisé par
// genererBonLivraison — inchangé). Si `y` est fourni, le bandeau
// s'étire depuis `y` jusqu'au bas de la page au lieu de laisser un
// espace vide entre un contenu court et un bandeau fixe de 16mm — le
// texte reste toujours ancré à pageH-6, seule la hauteur du bandeau
// vert change. `Math.min` garantit qu'il ne peut jamais être plus petit
// que les 16mm habituels si le contenu va déjà jusqu'en bas.
export function dessinerPiedPageOfficiel(doc, { mentionDroite = 'Document officiel — Conserver precieusement', y } = {}) {
  const { vert, or } = PALETTE_DOCUMENT_OFFICIEL
  const pageW = doc.internal.pageSize.width
  const pageH = doc.internal.pageSize.height
  const yBande = y === undefined ? pageH - 16 : Math.min(y, pageH - 16)

  doc.setFillColor(...vert)
  doc.rect(0, yBande, pageW, pageH - yBande, 'F')
  doc.setFillColor(...or)
  doc.rect(0, yBande - 1, pageW, 1, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Ougoul Spring — Eau Minerale Naturelle — Djibouti', 14, pageH - 6)
  doc.text(mentionDroite, pageW - 14, pageH - 6, { align: 'right' })
}
