import { useEffect, useState } from 'react'
import { UserPlus, Plus, Search, ShoppingCart, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import ClientSearchSelect from '../../components/ui/ClientSearchSelect'
import UniteSelector from '../../components/ui/UniteSelector'
import UploadPhotoFiche from '../../components/fiches/UploadPhotoFiche'
import { ModalFiche, BandeauErreur, ListeFiches } from '../../components/fiches/FichesUI'
import { Loader2 } from 'lucide-react'

const MODES_PAIEMENT = ['Especes', 'D_Money', 'CAC', 'Waafi', 'Virement']
const LABELS_PAIEMENT = { Especes: '💵 Espèces', D_Money: '📱 D-Money', CAC: '📱 CAC', Waafi: '📱 Waafi', Virement: '🏦 Virement' }
const CAS_VENTE_OPTIONS = [
  { key: 'Comptant',  label: '💵 Payer maintenant' },
  { key: 'Livraison', label: '🚚 À la livraison' },
  { key: 'Credit',    label: '💳 Crédit 24h' },
]

const FICHE_VIDE = {
  nom_entreprise: '', nom_distributeur: '', responsable: '', telephone: '',
  adresse_personnelle: '', adresse_professionnelle: '',
  copie_cni: false, autres_documents: '',
  volume_previsionnel: '', secteur_desservi: '', nombre_voyages_souhaite: '',
  commentaires: '',
}

export default function FicheDistributeurView() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [fiches, setFiches] = useState([])
  const [clients, setClients] = useState([]) // AJOUT
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(FICHE_VIDE)
  const [photo, setPhoto] = useState(null)
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState(null)

  // AJOUT : bascule client existant / nouveau
  const [modeClient, setModeClient] = useState('nouveau')
  const [clientExistantId, setClientExistantId] = useState('')

  // AJOUT : commande initiale optionnelle, créée automatiquement à la validation
  const [avecCommandeInitiale, setAvecCommandeInitiale] = useState(false)
  const [lignesInitiales, setLignesInitiales] = useState([{ unite: 'Palette', quantite: 1 }])
  const [casVenteInitial, setCasVenteInitial] = useState('Livraison')
  const [modePaiementInitial, setModePaiementInitial] = useState('Especes')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchFiches(), fetchClients()])
    setLoading(false)
  }

  async function fetchFiches() {
    const { data } = await supabase.from('fiches_enregistrement_distributeur').select('*').eq('cree_par', user.id).order('cree_le', { ascending: false })
    setFiches(data || [])
  }

  // AJOUT : tous les clients actifs (le distributeur peut déjà exister
  // sous un autre type, ou avoir déjà été enregistré)
  async function fetchClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, nom_entreprise, type_client, telephone, adresse')
      .eq('actif', true)
      .order('nom_entreprise')
    setClients(data || [])
  }

  function ouvrirForm() {
    setForm(FICHE_VIDE)
    setPhoto(null)
    setErreur(null)
    setModeClient('nouveau')
    setClientExistantId('')
    setAvecCommandeInitiale(false)
    setLignesInitiales([{ unite: 'Palette', quantite: 1 }])
    setCasVenteInitial('Livraison')
    setModePaiementInitial('Especes')
    setShowForm(true)
  }

  function selectionnerClientExistant(id) {
    setClientExistantId(id)
    const c = clients.find(cl => cl.id === id)
    if (c) {
      setForm({
        ...form,
        nom_entreprise: c.nom_entreprise,
        telephone: c.telephone || '',
        adresse_professionnelle: c.adresse || '',
      })
    }
  }

  function ajouterLigneInitiale() { setLignesInitiales([...lignesInitiales, { unite: 'Palette', quantite: 1 }]) }
  function supprimerLigneInitiale(i) { setLignesInitiales(lignesInitiales.filter((_, idx) => idx !== i)) }
  function updateLigneInitiale(i, field, value) {
    const updated = [...lignesInitiales]; updated[i][field] = value; setLignesInitiales(updated)
  }

  async function handleSoumettre(e) {
    e.preventDefault()
    setErreur(null)
    if (modeClient === 'existant' && !clientExistantId) return setErreur('Sélectionne un client dans la liste.')
    if (!form.nom_entreprise.trim()) return setErreur("Le nom de l'entreprise est obligatoire.")
    if (!form.telephone.trim()) return setErreur('Le téléphone est obligatoire.')

    setSaving(true)
    const { error } = await supabase.from('fiches_enregistrement_distributeur').insert({
      ...form, photo_url: photo,
      // AJOUT : lie la fiche au client existant s'il a été sélectionné
      client_id: modeClient === 'existant' ? clientExistantId : null,
      nombre_voyages_souhaite: parseInt(form.nombre_voyages_souhaite) || null,
      // AJOUT : commande initiale — créée automatiquement par la commercial à la validation
      commande_initiale_lignes:        avecCommandeInitiale ? lignesInitiales : null,
      commande_initiale_cas_vente:     avecCommandeInitiale ? casVenteInitial : null,
      commande_initiale_mode_paiement: avecCommandeInitiale ? modePaiementInitial : null,
      cree_par: user.id,
    })
    if (error) { setErreur(`Erreur : ${error.message}`); setSaving(false); return }

    setForm(FICHE_VIDE)
    setPhoto(null)
    setModeClient('nouveau')
    setClientExistantId('')
    setAvecCommandeInitiale(false)
    setLignesInitiales([{ unite: 'Palette', quantite: 1 }])
    setShowForm(false)
    await fetchFiches()
    setSaving(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <UserPlus size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Nouveau distributeur</h1>
          <p className="text-sm text-slate-500">{fiches.length} fiche{fiches.length > 1 ? 's' : ''} soumise{fiches.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      <button onClick={ouvrirForm}
        className="mb-5 flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors shadow-sm">
        <Plus size={18} /> Nouvelle fiche distributeur
      </button>

      <ListeFiches fiches={fiches} vide="Aucune fiche pour le moment" icon={UserPlus}
        render={f => (
          <>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-slate-900">{f.nom_entreprise}</p>
              {f.client_id && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Client existant</span>}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{f.telephone} · {f.secteur_desservi}</p>
          </>
        )} />

      {showForm && (
        <ModalFiche titre="Fiche d'enregistrement — Distributeur" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSoumettre} className="p-6 space-y-4">
            {erreur && <BandeauErreur message={erreur} />}

            {/* AJOUT : bascule client existant / nouveau */}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setModeClient('existant'); setForm(FICHE_VIDE) }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all flex items-center justify-center gap-1.5 ${
                  modeClient === 'existant' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-slate-600 border-slate-200'
                }`}>
                <Search size={14} /> Client existant
              </button>
              <button type="button" onClick={() => { setModeClient('nouveau'); setClientExistantId(''); setForm(FICHE_VIDE) }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                  modeClient === 'nouveau' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200'
                }`}>
                🆕 Nouveau distributeur
              </button>
            </div>

            {modeClient === 'existant' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Rechercher le client *</label>
                <ClientSearchSelect clients={clients} value={clientExistantId}
                  onChange={selectionnerClientExistant} placeholder="— Rechercher par nom, téléphone... —" />
                {clientExistantId && (
                  <p className="text-xs text-blue-600 mt-1.5">✓ Infos préremplies — modifie-les si besoin</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom de l'entreprise *</label>
              <input type="text" value={form.nom_entreprise} required
                onChange={e => setForm({ ...form, nom_entreprise: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Nom du distributeur</label>
                <input type="text" value={form.nom_distributeur}
                  onChange={e => setForm({ ...form, nom_distributeur: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Responsable</label>
                <input type="text" value={form.responsable}
                  onChange={e => setForm({ ...form, responsable: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Téléphone *</label>
                <input type="text" value={form.telephone} required
                  onChange={e => setForm({ ...form, telephone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Adresse personnelle</label>
                <input type="text" value={form.adresse_personnelle}
                  onChange={e => setForm({ ...form, adresse_personnelle: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Adresse professionnelle</label>
                <input type="text" value={form.adresse_professionnelle}
                  onChange={e => setForm({ ...form, adresse_professionnelle: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-3 space-y-2">
              <p className="text-xs font-medium text-slate-700">Documents à fournir</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.copie_cni}
                  onChange={e => setForm({ ...form, copie_cni: e.target.checked })}
                  className="w-4 h-4 accent-orange-500" />
                <span className="text-xs text-slate-600">Copie de la carte d'identité fournie</span>
              </label>
              <input type="text" value={form.autres_documents}
                onChange={e => setForm({ ...form, autres_documents: e.target.value })}
                placeholder="Autres documents fournis..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Volume prévisionnel</label>
                <input type="text" value={form.volume_previsionnel}
                  onChange={e => setForm({ ...form, volume_previsionnel: e.target.value })}
                  placeholder="Ex : 50 cartons/mois"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Secteur desservi</label>
                <input type="text" value={form.secteur_desservi}
                  onChange={e => setForm({ ...form, secteur_desservi: e.target.value })}
                  placeholder="Ex : Balbala, Arta"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Nombre de voyages souhaité (par semaine)</label>
                <input type="number" min="0" value={form.nombre_voyages_souhaite}
                  onChange={e => setForm({ ...form, nombre_voyages_souhaite: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Commentaires</label>
              <textarea value={form.commentaires} rows={2}
                onChange={e => setForm({ ...form, commentaires: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
            </div>

            {/* AJOUT : commande initiale optionnelle */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={avecCommandeInitiale}
                  onChange={e => setAvecCommandeInitiale(e.target.checked)}
                  className="w-4 h-4 accent-orange-500" />
                <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                  <ShoppingCart size={14} className="text-orange-500" /> Créer une commande initiale
                </span>
              </label>

              {avecCommandeInitiale && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs text-slate-500 mb-2">Produits — Eau 500ml</label>
                    <div className="space-y-2">
                      {lignesInitiales.map((ligne, i) => (
                        <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl p-3">
                          <UniteSelector unite={ligne.unite} quantite={ligne.quantite}
                            onChange={u => updateLigneInitiale(i, 'unite', u)} unites={['Palette', 'Carton']} />
                          <input type="number" min="1" value={ligne.quantite}
                            onChange={e => updateLigneInitiale(i, 'quantite', parseInt(e.target.value) || 1)}
                            className="w-20 px-2 py-2 border border-slate-200 rounded-lg text-sm text-center bg-white" />
                          {lignesInitiales.length > 1 && (
                            <button type="button" onClick={() => supprimerLigneInitiale(i)} className="text-slate-300 hover:text-red-400 ml-auto">
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={ajouterLigneInitiale}
                      className="mt-2 text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1">
                      <Plus size={14} /> Ajouter une ligne
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-2">Le client veut payer quand ?</label>
                    <div className="grid grid-cols-3 gap-2">
                      {CAS_VENTE_OPTIONS.map(opt => (
                        <button key={opt.key} type="button" onClick={() => setCasVenteInitial(opt.key)}
                          className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                            casVenteInitial === opt.key ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200'
                          }`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-2">Mode de paiement</label>
                    <div className="flex flex-wrap gap-2">
                      {MODES_PAIEMENT.map(m => (
                        <button key={m} type="button" onClick={() => setModePaiementInitial(m)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            modePaiementInitial === m ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200'
                          }`}>
                          {LABELS_PAIEMENT[m]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    Tarif Distributeur (850 DJF/carton) appliqué automatiquement à la validation.
                  </p>
                </div>
              )}
            </div>

            <UploadPhotoFiche photoUrl={photo} onChange={setPhoto} />

            <button type="submit" disabled={saving}
              className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 size={16} className="animate-spin" />Envoi...</> : 'Transmettre à la commercial'}
            </button>
          </form>
        </ModalFiche>
      )}
    </div>
  )
}