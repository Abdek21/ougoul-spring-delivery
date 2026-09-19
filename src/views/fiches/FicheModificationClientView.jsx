import { useEffect, useState } from 'react'
import { Edit3, Plus, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import ClientSearchSelect from '../../components/ui/ClientSearchSelect'
import UploadPhotoFiche from '../../components/fiches/UploadPhotoFiche'
import { ModalFiche, BandeauErreur, ListeFiches } from '../../components/fiches/FichesUI'

const SECTEURS = ['Hotel','Restaurant','Cafe','Supermarche','Epicerie','Ecole','Clinique','Entreprise','Administration','Autre']

export default function FicheModificationClientView() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState([])
  const [fiches, setFiches] = useState([])
  const [showForm, setShowForm] = useState(false)

  const [clientAModifier, setClientAModifier] = useState(null)
  const [nouvTelephone, setNouvTelephone] = useState('')
  const [nouvAdresse, setNouvAdresse]     = useState('')
  const [nouvSecteur, setNouvSecteur]     = useState('')
  const [nouvContact, setNouvContact]     = useState('')
  const [motif, setMotif]                 = useState('')
  const [photo, setPhoto]                 = useState(null)
  const [saving, setSaving]               = useState(false)
  const [erreur, setErreur]               = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchClients(), fetchFiches()])
    setLoading(false)
  }

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('id, nom_entreprise, type_client, telephone, adresse, secteur, nom_contact').eq('actif', true).order('nom_entreprise')
    setClients(data || [])
  }

  async function fetchFiches() {
    const { data } = await supabase.from('fiches_modification_client').select('*, clients(nom_entreprise)').eq('cree_par', user.id).order('cree_le', { ascending: false })
    setFiches(data || [])
  }

  function ouvrirForm() {
    setClientAModifier(null)
    setNouvTelephone(''); setNouvAdresse(''); setNouvSecteur(''); setNouvContact('')
    setMotif(''); setPhoto(null); setErreur(null)
    setShowForm(true)
  }

  function selectionnerClient(id) {
    const c = clients.find(cl => cl.id === id)
    setClientAModifier(c)
    setNouvTelephone(c?.telephone || '')
    setNouvAdresse(c?.adresse || '')
    setNouvSecteur(c?.secteur || '')
    setNouvContact(c?.nom_contact || '')
  }

  async function handleSoumettre(e) {
    e.preventDefault()
    setErreur(null)
    if (!clientAModifier) return setErreur('Sélectionnez le client à modifier.')

    const champsModifies = {}
    if (nouvTelephone !== (clientAModifier.telephone || '')) champsModifies.telephone = nouvTelephone
    if (nouvAdresse !== (clientAModifier.adresse || ''))     champsModifies.adresse = nouvAdresse
    if (nouvSecteur !== (clientAModifier.secteur || ''))     champsModifies.secteur = nouvSecteur
    if (nouvContact !== (clientAModifier.nom_contact || '')) champsModifies.nom_contact = nouvContact

    if (Object.keys(champsModifies).length === 0) return setErreur('Aucun champ modifié.')

    setSaving(true)
    const { error } = await supabase.from('fiches_modification_client').insert({
      client_id: clientAModifier.id, champs_modifies: champsModifies,
      motif, photo_url: photo, cree_par: user.id,
    })
    if (error) { setErreur(`Erreur : ${error.message}`); setSaving(false); return }

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
          <Edit3 size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Modification client</h1>
          <p className="text-sm text-slate-500">{fiches.length} demande{fiches.length > 1 ? 's' : ''} soumise{fiches.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      <button onClick={ouvrirForm}
        className="mb-5 flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors shadow-sm">
        <Plus size={18} /> Nouvelle demande de modification
      </button>

      <ListeFiches fiches={fiches} vide="Aucune demande pour le moment" icon={Edit3}
        render={f => (
          <>
            <p className="font-semibold text-slate-900">{f.clients?.nom_entreprise || 'Client'}</p>
            <p className="text-xs text-slate-400 mt-0.5">{Object.keys(f.champs_modifies || {}).join(', ')}</p>
          </>
        )} />

      {showForm && (
        <ModalFiche titre="Demande de modification client" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSoumettre} className="p-6 space-y-4">
            {erreur && <BandeauErreur message={erreur} />}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Client à modifier *</label>
              <ClientSearchSelect clients={clients} value={clientAModifier?.id}
                onChange={selectionnerClient} placeholder="— Rechercher un client —" />
            </div>

            {clientAModifier && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Téléphone</label>
                  <input type="text" value={nouvTelephone} onChange={e => setNouvTelephone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Adresse</label>
                  <input type="text" value={nouvAdresse} onChange={e => setNouvAdresse(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Secteur d'activité</label>
                  <select value={nouvSecteur} onChange={e => setNouvSecteur(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                    <option value="">—</option>
                    {SECTEURS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Nom du contact</label>
                  <input type="text" value={nouvContact} onChange={e => setNouvContact(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Motif de la modification</label>
                  <input type="text" value={motif} onChange={e => setMotif(e.target.value)}
                    placeholder="Ex : Le client a déménagé"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <UploadPhotoFiche photoUrl={photo} onChange={setPhoto} />
              </div>
            )}

            <button type="submit" disabled={saving || !clientAModifier}
              className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 size={16} className="animate-spin" />Envoi...</> : 'Transmettre à la commercial'}
            </button>
          </form>
        </ModalFiche>
      )}
    </div>
  )
}