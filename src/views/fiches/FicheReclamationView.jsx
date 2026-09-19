import { useEffect, useState } from 'react'
import { MessageSquareWarning, Plus, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import ClientSearchSelect from '../../components/ui/ClientSearchSelect'
import UploadPhotoFiche from '../../components/fiches/UploadPhotoFiche'
import { ModalFiche, BandeauErreur, ListeFiches } from '../../components/fiches/FichesUI'

const TYPES_RECLAMATION = {
  Retard_livraison:   'Retard de livraison',
  Produit_endommage:  'Produit endommagé',
  Erreur_facturation: 'Erreur de facturation',
  Qualite_produit:    'Qualité du produit',
  Autre:              'Autre',
}

const FICHE_VIDE = { client_id: '', nom_client: '', telephone: '', type_reclamation: 'Retard_livraison', description: '' }

export default function FicheReclamationView() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState([])
  const [fiches, setFiches] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(FICHE_VIDE)
  const [clientSelectionne, setClientSelectionne] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchClients(), fetchFiches()])
    setLoading(false)
  }

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('id, nom_entreprise, type_client, telephone').eq('actif', true).order('nom_entreprise')
    setClients(data || [])
  }

  async function fetchFiches() {
    const { data } = await supabase.from('fiches_reclamation').select('*').eq('cree_par', user.id).order('cree_le', { ascending: false })
    setFiches(data || [])
  }

  function selectionnerClient(id) {
    const c = clients.find(cl => cl.id === id)
    setClientSelectionne(c)
    setForm({ ...form, client_id: id, nom_client: c?.nom_entreprise || '', telephone: c?.telephone || '' })
  }

  async function handleSoumettre(e) {
    e.preventDefault()
    setErreur(null)
    if (!form.nom_client.trim()) return setErreur('Le nom du client est obligatoire.')
    if (!form.description.trim()) return setErreur('La description est obligatoire.')

    setSaving(true)
    const { client_id, ...reste } = form
    const { error } = await supabase.from('fiches_reclamation').insert({
      ...reste, client_id: client_id || null, photo_url: photo, cree_par: user.id,
    })
    if (error) { setErreur(`Erreur : ${error.message}`); setSaving(false); return }

    setForm(FICHE_VIDE)
    setClientSelectionne(null)
    setPhoto(null)
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
          <MessageSquareWarning size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Réclamation</h1>
          <p className="text-sm text-slate-500">{fiches.length} réclamation{fiches.length > 1 ? 's' : ''} soumise{fiches.length > 1 ? 's' : ''} — traitée par la commercial</p>
        </div>
      </div>

      <button onClick={() => setShowForm(true)}
        className="mb-5 flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors shadow-sm">
        <Plus size={18} /> Nouvelle réclamation
      </button>

      <ListeFiches fiches={fiches} vide="Aucune réclamation pour le moment" icon={MessageSquareWarning}
        render={f => (
          <>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-slate-900">{f.nom_client}</p>
              <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{TYPES_RECLAMATION[f.type_reclamation]}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{f.description}</p>
            {f.reponse && <p className="text-xs text-green-600 mt-1 italic">Réponse : {f.reponse}</p>}
          </>
        )} />

      {showForm && (
        <ModalFiche titre="Fiche de réclamation" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSoumettre} className="p-6 space-y-4">
            {erreur && <BandeauErreur message={erreur} />}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Client (si connu)</label>
              <ClientSearchSelect clients={clients} value={clientSelectionne?.id}
                onChange={selectionnerClient} placeholder="— Rechercher un client (optionnel) —" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Nom du client *</label>
                <input type="text" value={form.nom_client} required
                  onChange={e => setForm({ ...form, nom_client: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Téléphone</label>
                <input type="text" value={form.telephone}
                  onChange={e => setForm({ ...form, telephone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Type de réclamation</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TYPES_RECLAMATION).map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setForm({ ...form, type_reclamation: key })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      form.type_reclamation === key ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-600 border-slate-200'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Description *</label>
              <textarea value={form.description} required rows={3}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Décris ce que le client a signalé..."
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
            </div>

            <UploadPhotoFiche photoUrl={photo} onChange={setPhoto} />

            <button type="submit" disabled={saving}
              className="w-full py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 size={16} className="animate-spin" />Envoi...</> : 'Transmettre'}
            </button>
          </form>
        </ModalFiche>
      )}
    </div>
  )
}