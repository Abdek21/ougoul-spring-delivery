import { useState } from 'react'
import { createWorker } from 'tesseract.js'
import { ScanLine, Upload, Loader2, Check, X, ChevronRight, ChevronLeft, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const TYPES_VALIDES = ['Distributeur', 'Entreprise', 'Particulier']

// AJOUT : extraction best-effort à partir du texte OCR brut — repère les
// lignes du type "Nom : ..." / "Tél : ..." grâce aux mots-clés habituels
// des fiches. Ne remplace pas une relecture humaine : c'est un point de
// départ, pas un résultat fiable (l'OCR gratuit lit mal l'écriture
// manuscrite — voir l'avertissement affiché à l'utilisateur).
function extraireChamps(texteBrut) {
  const lignes = texteBrut.split('\n').map(l => l.trim()).filter(Boolean)
  const champs = { nom_entreprise: '', telephone: '', secteur: '', adresse: '', nom_contact: '' }

  lignes.forEach(ligne => {
    const l = ligne.toLowerCase()
    const valeur = ligne.includes(':') ? ligne.split(':').slice(1).join(':').trim() : ligne

    if (!champs.nom_entreprise && (l.startsWith('nom') && !l.includes('contact'))) {
      champs.nom_entreprise = valeur
    } else if (!champs.telephone && (l.includes('tel') || l.includes('tél') || l.includes('n° tel'))) {
      champs.telephone = valeur
    } else if (!champs.secteur && (l.includes('secteur') || l.includes('quartier'))) {
      champs.secteur = valeur
    } else if (!champs.adresse && l.includes('adress')) {
      champs.adresse = valeur
    } else if (!champs.nom_contact && l.includes('contact')) {
      champs.nom_contact = valeur
    }
  })

  // Repli : si rien n'a matché de mot-clé, la première ligne non vide
  // devient le nom par défaut (mieux que de tout laisser vide)
  if (!champs.nom_entreprise && lignes.length > 0) {
    champs.nom_entreprise = lignes[0]
  }

  return champs
}

/**
 * Modal de scan — upload de photos de fiches papier, OCR gratuit côté
 * navigateur (Tesseract.js), extraction best-effort, puis correction
 * manuelle obligatoire avant import (l'OCR gratuit ne lit pas bien
 * l'écriture manuscrite).
 */
export default function ScanClientsModal({ onClose, onImported }) {
  const [etape, setEtape]         = useState('upload') // upload | ocr | revision | import
  const [fichiers, setFichiers]   = useState([])
  const [progression, setProgression] = useState({ actuel: 0, total: 0 })
  const [fichesExtraites, setFichesExtraites] = useState([]) // [{ texteBrut, champs, imageUrl }]
  const [indexRevision, setIndexRevision]     = useState(0)
  const [saving, setSaving]       = useState(false)
  const [resultat, setResultat]   = useState(null)

  function handleFichiers(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setFichiers(files)
  }

  async function lancerOcr() {
    setEtape('ocr')
    setProgression({ actuel: 0, total: fichiers.length })

    const worker = await createWorker('fra')
    const extraits = []

    for (let i = 0; i < fichiers.length; i++) {
      const fichier = fichiers[i]
      setProgression({ actuel: i + 1, total: fichiers.length })

      const { data: { text } } = await worker.recognize(fichier)
      extraits.push({
        texteBrut: text,
        champs: { ...extraireChamps(text), type_client: 'Particulier' },
        imageUrl: URL.createObjectURL(fichier),
      })
    }

    await worker.terminate()
    setFichesExtraites(extraits)
    setIndexRevision(0)
    setEtape('revision')
  }

  function mettreAJourChamp(champ, valeur) {
    setFichesExtraites(prev => prev.map((f, i) =>
      i === indexRevision ? { ...f, champs: { ...f.champs, [champ]: valeur } } : f
    ))
  }

  async function handleImporter() {
    setSaving(true)
    setEtape('import')

    const clientsAImporter = fichesExtraites
      .map(f => ({ ...f.champs, actif: true }))
      .filter(c => c.nom_entreprise?.trim())

    let succes = 0
    const erreurs = []

    for (const client of clientsAImporter) {
      const { error } = await supabase.from('clients').insert(client)
      if (error) erreurs.push(error.message)
      else succes++
    }

    setResultat({ succes, total: clientsAImporter.length, erreurs })
    setSaving(false)
    if (succes > 0) onImported?.()
  }

  const ficheActuelle = fichesExtraites[indexRevision]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl z-10 overflow-hidden max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <ScanLine size={18} className="text-orange-500" />
            Scanner des fiches clients
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">

          {/* ─ ÉTAPE 1 : UPLOAD ─ */}
          {etape === 'upload' && (
            <div>
              <div className="flex items-start gap-2 mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Lecture automatique gratuite (pas d'IA payante) — fonctionne bien sur du texte
                  <strong> tapé ou bien imprimé</strong>. Sur de l'écriture manuscrite, les résultats
                  seront approximatifs : tu devras corriger chaque fiche à l'étape suivante avant
                  l'import, rien n'est enregistré sans validation.
                </p>
              </div>

              <p className="text-sm text-slate-500 mb-4">
                Prends une photo nette de chaque fiche (une photo = un client), puis sélectionne-les toutes.
              </p>

              <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-200 rounded-2xl py-12 cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-colors">
                <Upload size={28} className="text-slate-300" />
                <span className="text-sm font-medium text-slate-600">
                  {fichiers.length > 0 ? `${fichiers.length} photo${fichiers.length > 1 ? 's' : ''} sélectionnée${fichiers.length > 1 ? 's' : ''}` : 'Cliquer pour choisir des photos'}
                </span>
                <span className="text-xs text-slate-400">JPG, PNG — plusieurs fichiers possibles</span>
                <input type="file" accept="image/*" multiple onChange={handleFichiers} className="hidden" />
              </label>

              {fichiers.length > 0 && (
                <button onClick={lancerOcr}
                  className="w-full mt-4 py-3 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors">
                  Lancer la lecture de {fichiers.length} fiche{fichiers.length > 1 ? 's' : ''}
                </button>
              )}
            </div>
          )}

          {/* ─ ÉTAPE 2 : OCR EN COURS ─ */}
          {etape === 'ocr' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={28} className="animate-spin text-orange-500" />
              <p className="text-sm text-slate-500">
                Lecture de la fiche {progression.actuel} / {progression.total}...
              </p>
            </div>
          )}

          {/* ─ ÉTAPE 3 : RÉVISION FICHE PAR FICHE ─ */}
          {etape === 'revision' && ficheActuelle && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-slate-700">
                  Fiche {indexRevision + 1} / {fichesExtraites.length}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setIndexRevision(i => Math.max(0, i - 1))} disabled={indexRevision === 0}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30">
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={() => setIndexRevision(i => Math.min(fichesExtraites.length - 1, i + 1))} disabled={indexRevision === fichesExtraites.length - 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                {/* Photo + texte brut OCR */}
                <div>
                  <img src={ficheActuelle.imageUrl} alt="Fiche scannée"
                    className="w-full rounded-xl border border-slate-200 mb-2 max-h-48 object-contain bg-slate-50" />
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Texte lu (brut)</p>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500 max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {ficheActuelle.texteBrut || '(rien détecté)'}
                  </div>
                </div>

                {/* Formulaire de correction */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Nom *</label>
                    <input type="text" value={ficheActuelle.champs.nom_entreprise}
                      onChange={e => mettreAJourChamp('nom_entreprise', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Type de client</label>
                    <div className="flex gap-1.5">
                      {TYPES_VALIDES.map(t => (
                        <button key={t} type="button" onClick={() => mettreAJourChamp('type_client', t)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            ficheActuelle.champs.type_client === t ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200'
                          }`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Téléphone</label>
                    <input type="text" value={ficheActuelle.champs.telephone}
                      onChange={e => mettreAJourChamp('telephone', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Secteur</label>
                    <input type="text" value={ficheActuelle.champs.secteur}
                      onChange={e => mettreAJourChamp('secteur', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Adresse</label>
                    <input type="text" value={ficheActuelle.champs.adresse}
                      onChange={e => mettreAJourChamp('adresse', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                </div>
              </div>

              <button onClick={handleImporter}
                className="w-full py-3 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors flex items-center justify-center gap-2">
                <Check size={16} /> Valider et importer les {fichesExtraites.length} fiche{fichesExtraites.length > 1 ? 's' : ''}
              </button>
            </div>
          )}

          {/* ─ ÉTAPE 4 : IMPORT ─ */}
          {etape === 'import' && (
            <div>
              {saving ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 size={28} className="animate-spin text-orange-500" />
                  <p className="text-sm text-slate-500">Enregistrement en cours...</p>
                </div>
              ) : resultat && (
                <div>
                  <div className={`flex items-center gap-3 p-4 rounded-xl mb-4 ${
                    resultat.succes === resultat.total ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
                  }`}>
                    <Check size={20} className={resultat.succes === resultat.total ? 'text-green-600' : 'text-amber-600'} />
                    <p className={`text-sm font-semibold ${resultat.succes === resultat.total ? 'text-green-800' : 'text-amber-800'}`}>
                      {resultat.succes} / {resultat.total} client{resultat.total > 1 ? 's' : ''} importé{resultat.succes > 1 ? 's' : ''}
                    </p>
                  </div>
                  {resultat.erreurs.length > 0 && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                      {resultat.erreurs.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
                    </div>
                  )}
                  <button onClick={onClose}
                    className="w-full py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors">
                    Fermer
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}