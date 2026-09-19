import { useState } from 'react'
import * as XLSX from 'xlsx'
import { Upload, FileSpreadsheet, Check, X, AlertTriangle, Loader2, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const CHAMPS_CIBLES = [
  { key: '',               label: '— Ignorer cette colonne —' },
  { key: 'nom_entreprise', label: 'Nom / Entreprise *' },
  { key: 'type_client',    label: 'Type de client' },
  { key: 'secteur',        label: 'Secteur' },
  { key: 'nom_contact',    label: 'Nom du contact' },
  { key: 'telephone',      label: 'Téléphone' },
  { key: 'email',          label: 'Email' },
  { key: 'adresse',        label: 'Adresse' },
]

const TYPES_VALIDES = ['Distributeur', 'Entreprise', 'Particulier']

// Devine le champ correspondant à partir du nom de la colonne détectée
function deviner(colonne) {
  const c = colonne.toLowerCase()
  if (c.includes('nom') && !c.includes('contact')) return 'nom_entreprise'
  if (c.includes('type')) return 'type_client'
  if (c.includes('secteur') || c.includes('activit')) return 'secteur'
  if (c.includes('contact')) return 'nom_contact'
  if (c.includes('tel') || c.includes('phone') || c.includes('num')) return 'telephone'
  if (c.includes('mail')) return 'email'
  if (c.includes('adress') || c.includes('addr') || c.includes('lieu')) return 'adresse'
  return ''
}

/**
 * Modal d'import — 3 étapes : dépôt du fichier → mapping des colonnes → résultat.
 * Props :
 * - onClose()      : ferme la modal
 * - onImported()   : appelé après un import réussi (le parent rafraîchit sa liste)
 */
export default function ImportClientsModal({ onClose, onImported }) {
  const [etape, setEtape]         = useState('upload') // upload | mapping | importation | resultat
  const [nomFichier, setNomFichier] = useState('')
  const [colonnes, setColonnes]   = useState([])
  const [lignes, setLignes]       = useState([])
  const [mapping, setMapping]     = useState({})
  const [typeDefaut, setTypeDefaut] = useState('Particulier')
  const [erreur, setErreur]       = useState(null)
  const [resultat, setResultat]   = useState(null)

  function handleFichier(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setErreur(null)
    setNomFichier(file.name)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result)
        const classeur = XLSX.read(data, { type: 'array' })
        const feuille  = classeur.Sheets[classeur.SheetNames[0]]
        const json     = XLSX.utils.sheet_to_json(feuille, { defval: '' })

        if (json.length === 0) {
          setErreur('Le fichier semble vide ou illisible.')
          return
        }

        const cols = Object.keys(json[0])
        const mappingDevine = {}
        cols.forEach(c => { mappingDevine[c] = deviner(c) })

        setColonnes(cols)
        setLignes(json)
        setMapping(mappingDevine)
        setEtape('mapping')
      } catch (err) {
        setErreur(`Impossible de lire le fichier : ${err.message}`)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const colonneNomMappee = colonnes.find(c => mapping[c] === 'nom_entreprise')

  async function handleImporter() {
    if (!colonneNomMappee) {
      setErreur('Vous devez faire correspondre au moins une colonne à "Nom / Entreprise".')
      return
    }
    setErreur(null)
    setEtape('importation')

    const clientsAImporter = lignes
      .map(ligne => {
        const client = { actif: true }
        colonnes.forEach(col => {
          const champ = mapping[col]
          if (champ) client[champ] = String(ligne[col] ?? '').trim()
        })
        if (!TYPES_VALIDES.includes(client.type_client)) {
          client.type_client = typeDefaut
        }
        return client
      })
      .filter(c => c.nom_entreprise)

    let succes = 0
    const erreurs = []
    const TAILLE_LOT = 50

    for (let i = 0; i < clientsAImporter.length; i += TAILLE_LOT) {
      const lot = clientsAImporter.slice(i, i + TAILLE_LOT)
      const { data, error } = await supabase.from('clients').insert(lot).select()
      if (error) erreurs.push(error.message)
      else succes += data?.length || 0
    }

    setResultat({ succes, total: clientsAImporter.length, erreurs })
    setEtape('resultat')
    if (succes > 0) onImported?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl z-10 overflow-hidden max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-orange-500" />
            Importer des clients depuis Excel / CSV
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">

          {erreur && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <AlertTriangle size={14} className="flex-shrink-0" /> {erreur}
            </div>
          )}

          {/* ─ ÉTAPE 1 : DÉPÔT DU FICHIER ─ */}
          {etape === 'upload' && (
            <div>
              <p className="text-sm text-slate-500 mb-4">
                Dépose un fichier Excel (.xlsx) ou CSV avec tes anciens clients — une ligne par client,
                les en-têtes de colonnes peuvent être dans n'importe quel ordre, tu les feras correspondre
                à l'étape suivante.
              </p>
              <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-200 rounded-2xl py-12 cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-colors">
                <Upload size={28} className="text-slate-300" />
                <span className="text-sm font-medium text-slate-600">Cliquer pour choisir un fichier</span>
                <span className="text-xs text-slate-400">.xlsx, .xls ou .csv</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFichier} className="hidden" />
              </label>
            </div>
          )}

          {/* ─ ÉTAPE 2 : MAPPING DES COLONNES ─ */}
          {etape === 'mapping' && (
            <div>
              <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-slate-50 rounded-xl">
                <FileSpreadsheet size={14} className="text-slate-400" />
                <span className="text-sm text-slate-600">{nomFichier}</span>
                <span className="text-xs text-slate-400 ml-auto">{lignes.length} lignes détectées</span>
              </div>

              <p className="text-sm text-slate-500 mb-3">
                Fais correspondre chaque colonne détectée à un champ. Colonne "Nom / Entreprise" obligatoire.
              </p>

              <div className="space-y-2 mb-4">
                {colonnes.map(col => (
                  <div key={col} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{col}</p>
                      <p className="text-xs text-slate-400 truncate">
                        Ex : {String(lignes[0]?.[col] || '—').slice(0, 30)}
                      </p>
                    </div>
                    <ArrowRight size={14} className="text-slate-300 flex-shrink-0" />
                    <select value={mapping[col] || ''}
                      onChange={e => setMapping({ ...mapping, [col]: e.target.value })}
                      className="flex-shrink-0 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                      {CHAMPS_CIBLES.map(f => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {!colonnes.some(c => mapping[c] === 'type_client') && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <label className="block text-xs font-medium text-amber-800 mb-1.5">
                    Aucune colonne "Type de client" mappée — type par défaut pour tous ces clients :
                  </label>
                  <div className="flex gap-2">
                    {TYPES_VALIDES.map(t => (
                      <button key={t} type="button" onClick={() => setTypeDefaut(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          typeDefaut === t ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200'
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={handleImporter}
                  className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors">
                  Importer {lignes.length} client{lignes.length > 1 ? 's' : ''}
                </button>
                <button onClick={() => setEtape('upload')}
                  className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
                  Changer de fichier
                </button>
              </div>
            </div>
          )}

          {/* ─ ÉTAPE 3 : IMPORTATION EN COURS ─ */}
          {etape === 'importation' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={28} className="animate-spin text-orange-500" />
              <p className="text-sm text-slate-500">Importation en cours...</p>
            </div>
          )}

          {/* ─ ÉTAPE 4 : RÉSULTAT ─ */}
          {etape === 'resultat' && resultat && (
            <div>
              <div className={`flex items-center gap-3 p-4 rounded-xl mb-4 ${
                resultat.succes === resultat.total ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
              }`}>
                <Check size={20} className={resultat.succes === resultat.total ? 'text-green-600' : 'text-amber-600'} />
                <div>
                  <p className={`text-sm font-semibold ${resultat.succes === resultat.total ? 'text-green-800' : 'text-amber-800'}`}>
                    {resultat.succes} / {resultat.total} client{resultat.total > 1 ? 's' : ''} importé{resultat.succes > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {resultat.erreurs.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-xs font-semibold text-red-700 mb-1">Erreurs rencontrées :</p>
                  {resultat.erreurs.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">{e}</p>
                  ))}
                </div>
              )}

              <button onClick={onClose}
                className="w-full py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors">
                Fermer
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}