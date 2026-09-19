import { useEffect, useState } from 'react'
import { FileText, Plus, X, Loader2, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import UniteSelector from '../../components/ui/UniteSelector'
import ClientSearchSelect from '../../components/ui/ClientSearchSelect'
import UploadPhotoFiche from '../../components/fiches/UploadPhotoFiche'
import { ModalFiche, BandeauErreur, ListeFiches } from '../../components/fiches/FichesUI'

const SECTEURS = ['Hotel','Restaurant','Cafe','Supermarche','Epicerie','Ecole','Clinique','Entreprise','Administration','Autre']
const MODES_PAIEMENT = ['Especes', 'D_Money', 'CAC', 'Waafi', 'Virement']
const LABELS_PAIEMENT = { Especes: '💵 Espèces', D_Money: '📱 D-Money', CAC: '📱 CAC', Waafi: '📱 Waafi', Virement: '🏦 Virement' }

const FICHE_VIDE = {
  type_client: 'Entreprise',
  nom_client: '', secteur_activite: '', nom_contact: '', fonction: '',
  telephone: '', adresse_livraison: '', quartier_secteur: '',
  mode_paiement: 'Especes', commentaire: '',
  cas_vente_souhaite: 'Livraison', // AJOUT : le client paie maintenant, à la livraison, ou en crédit 24h
}

const CAS_VENTE_OPTIONS = [
  { key: 'Comptant',  label: '💵 Payer maintenant', desc: 'Le client règle tout de suite (passe par la commercial puis le comptable)' },
  { key: 'Livraison', label: '🚚 À la livraison',    desc: 'Le client règle quand le livreur arrive' },
  { key: 'Credit',    label: '💳 Crédit 24h',        desc: 'Le client règle dans les 24h après livraison' },
]

export default function FicheCommandeView() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [fiches, setFiches] = useState([])
  const [clients, setClients] = useState([]) // AJOUT : catalogue pour la recherche
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(FICHE_VIDE)
  const [lignes, setLignes] = useState([{ unite: 'Carton', quantite: 1 }])
  const [photo, setPhoto] = useState(null)
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState(null)

  // AJOUT : bascule client existant / nouveau client
  const [modeClient, setModeClient] = useState('nouveau') // 'existant' | 'nouveau'
  const [clientExistantId, setClientExistantId] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchFiches(), fetchClients()])
    setLoading(false)
  }

  async function fetchFiches() {
    const { data } = await supabase.from('fiches_commande').select('*').eq('cree_par', user.id).order('cree_le', { ascending: false })
    setFiches(data || [])
  }

  // AJOUT : tous les clients actifs, pour vérifier s'il existe déjà
  async function fetchClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, nom_entreprise, type_client, telephone, adresse, secteur, nom_contact')
      .eq('actif', true)
      .order('nom_entreprise')
    setClients(data || [])
  }

  function ouvrirForm() {
    setForm(FICHE_VIDE)
    setLignes([{ unite: 'Carton', quantite: 1 }])
    setPhoto(null)
    setErreur(null)
    setModeClient('nouveau')
    setClientExistantId('')
    setShowForm(true)
  }

  // AJOUT : préremplit les champs à partir du client sélectionné
  function selectionnerClientExistant(id) {
    setClientExistantId(id)
    const c = clients.find(cl => cl.id === id)
    if (c) {
      setForm({
        ...form,
        type_client: c.type_client === 'Distributeur' ? 'Entreprise' : c.type_client,
        nom_client: c.nom_entreprise,
        telephone: c.telephone || '',
        adresse_livraison: c.adresse || '',
        secteur_activite: c.secteur || '',
        nom_contact: c.nom_contact || '',
      })
    }
  }

  function ajouterLigne() { setLignes([...lignes, { unite: 'Carton', quantite: 1 }]) }
  function supprimerLigne(i) { setLignes(lignes.filter((_, idx) => idx !== i)) }
  function updateLigne(i, field, value) {
    const updated = [...lignes]; updated[i][field] = value; setLignes(updated)
  }

  async function handleSoumettre(e) {
    e.preventDefault()
    setErreur(null)
    if (modeClient === 'existant' && !clientExistantId) return setErreur('Sélectionne un client dans la liste.')
    if (!form.nom_client.trim()) return setErreur('Le nom du client est obligatoire.')
    if (!form.telephone.trim()) return setErreur('Le téléphone est obligatoire.')

    setSaving(true)
    const { error } = await supabase.from('fiches_commande').insert({
      ...form, lignes, photo_url: photo,
      // AJOUT : lie la fiche au client existant s'il a été sélectionné —
      // la validation par la commercial ne recréera pas de doublon
      client_id: modeClient === 'existant' ? clientExistantId : null,
      date_prise_commande: new Date().toISOString().slice(0, 10),
      heure_prise_commande: new Date().toTimeString().slice(0, 5),
      cree_par: user.id,
    })
    if (error) { setErreur(`Erreur : ${error.message}`); setSaving(false); return }

    setForm(FICHE_VIDE)
    setLignes([{ unite: 'Carton', quantite: 1 }])
    setPhoto(null)
    setModeClient('nouveau')
    setClientExistantId('')
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
          <FileText size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Prise de commande</h1>
          <p className="text-sm text-slate-500">{fiches.length} fiche{fiches.length > 1 ? 's' : ''} soumise{fiches.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      <button onClick={ouvrirForm}
        className="mb-5 flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors shadow-sm">
        <Plus size={18} /> Nouvelle fiche de commande
      </button>

      <ListeFiches fiches={fiches} vide="Aucune fiche pour le moment" icon={FileText}
        render={f => (
          <>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-slate-900">{f.nom_client}</p>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{f.type_client}</span>
              {f.client_id && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Client existant</span>}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {f.telephone} · {(f.lignes || []).map(l => `${l.quantite} ${l.unite}`).join(', ')}
            </p>
          </>
        )} />

      {showForm && (
        <ModalFiche titre="Fiche de prise de commande" onClose={() => setShowForm(false)}>
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
                🆕 Nouveau client
              </button>
            </div>

            {modeClient === 'existant' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Rechercher le client *</label>
                <ClientSearchSelect clients={clients} value={clientExistantId}
                  onChange={selectionnerClientExistant} placeholder="— Rechercher par nom, téléphone... —" />
                {clientExistantId && (
                  <p className="text-xs text-blue-600 mt-1.5">
                    ✓ Infos préremplies — modifie-les si besoin (ex : nouvelle adresse de livraison)
                  </p>
                )}
              </div>
            )}

            {modeClient === 'nouveau' && (
              <div className="flex gap-2">
                {['Entreprise', 'Particulier'].map(t => (
                  <button key={t} type="button" onClick={() => setForm({ ...form, type_client: t })}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                      form.type_client === t ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200'
                    }`}>
                    {t === 'Entreprise' ? '🏢' : '👤'} {t}
                  </button>
                ))}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {form.type_client === 'Entreprise' ? "Nom de l'entreprise" : 'Nom et prénom'} *
              </label>
              <input type="text" value={form.nom_client} required
                onChange={e => setForm({ ...form, nom_client: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>

            {form.type_client === 'Entreprise' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Secteur d'activité</label>
                  <select value={form.secteur_activite}
                    onChange={e => setForm({ ...form, secteur_activite: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                    <option value="">—</option>
                    {SECTEURS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Fonction du contact</label>
                  <input type="text" value={form.fonction}
                    onChange={e => setForm({ ...form, fonction: e.target.value })}
                    placeholder="Ex : Responsable achats"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Nom du contact</label>
                  <input type="text" value={form.nom_contact}
                    onChange={e => setForm({ ...form, nom_contact: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Téléphone *</label>
                <input type="text" value={form.telephone} required
                  onChange={e => setForm({ ...form, telephone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Quartier / Secteur</label>
                <input type="text" value={form.quartier_secteur}
                  onChange={e => setForm({ ...form, quartier_secteur: e.target.value })}
                  placeholder="Ex : Balbala"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Adresse de livraison</label>
                <input type="text" value={form.adresse_livraison}
                  onChange={e => setForm({ ...form, adresse_livraison: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Commande — Eau 500ml</label>
              <div className="space-y-2">
                {lignes.map((ligne, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl p-3">
                    <UniteSelector unite={ligne.unite} quantite={ligne.quantite}
                      onChange={u => updateLigne(i, 'unite', u)} unites={['Palette', 'Carton']} />
                    <input type="number" min="1" value={ligne.quantite}
                      onChange={e => updateLigne(i, 'quantite', parseInt(e.target.value) || 1)}
                      className="w-20 px-2 py-2 border border-slate-200 rounded-lg text-sm text-center bg-white" />
                    {lignes.length > 1 && (
                      <button type="button" onClick={() => supprimerLigne(i)} className="text-slate-300 hover:text-red-400 ml-auto">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={ajouterLigne}
                className="mt-2 text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1">
                <Plus size={14} /> Ajouter une ligne
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Le client veut payer quand ?</label>
              <div className="space-y-2">
                {CAS_VENTE_OPTIONS.map(opt => (
                  <button key={opt.key} type="button" onClick={() => setForm({ ...form, cas_vente_souhaite: opt.key })}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      form.cas_vente_souhaite === opt.key ? 'bg-orange-50 border-orange-400' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}>
                    <p className="text-sm font-medium text-slate-900">{opt.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Mode de paiement</label>
              <div className="flex flex-wrap gap-2">
                {MODES_PAIEMENT.map(m => (
                  <button key={m} type="button" onClick={() => setForm({ ...form, mode_paiement: m })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      form.mode_paiement === m ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200'
                    }`}>
                    {LABELS_PAIEMENT[m]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Commentaire</label>
              <textarea value={form.commentaire} rows={2}
                onChange={e => setForm({ ...form, commentaire: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
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