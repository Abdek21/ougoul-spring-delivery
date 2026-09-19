import { useEffect, useState } from 'react'
import { Truck, Calendar, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import UploadPhotoFiche from '../../components/fiches/UploadPhotoFiche'
import { ModalFiche, BandeauErreur, STATUT_CONFIG, statutExpiration } from '../../components/fiches/FichesUI'

export default function DocumentsVehiculesGestionnaireView() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [vehicules, setVehicules] = useState([])
  const [mesDemandes, setMesDemandes] = useState([])

  const [showForm, setShowForm] = useState(null) // { vehicule, type }
  const [date, setDate] = useState('')
  const [prix, setPrix] = useState('')
  const [photo, setPhoto] = useState(null)
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchVehicules(), fetchMesDemandes()])
    setLoading(false)
  }

  async function fetchVehicules() {
    const { data } = await supabase.from('vehicules').select('*').eq('actif', true).order('immatriculation')
    setVehicules(data || [])
  }

  async function fetchMesDemandes() {
    const { data } = await supabase.from('fiches_renouvellement_document').select('*, vehicules(immatriculation)').eq('cree_par', user.id).order('cree_le', { ascending: false })
    setMesDemandes(data || [])
  }

  function ouvrirForm(vehicule, type) {
    setShowForm({ vehicule, type })
    setDate(''); setPrix(''); setPhoto(null); setErreur(null)
  }

  async function handleSoumettre(e) {
    e.preventDefault()
    setErreur(null)
    if (!date) return setErreur('La nouvelle date est obligatoire.')

    setSaving(true)
    const { error } = await supabase.from('fiches_renouvellement_document').insert({
      vehicule_id: showForm.vehicule.id,
      type_document: showForm.type,
      nouvelle_date_expiration: date,
      nouveau_prix: prix ? parseFloat(prix) : null,
      photo_url: photo,
      cree_par: user.id,
    })
    if (error) { setErreur(`Erreur : ${error.message}`); setSaving(false); return }

    setShowForm(null)
    await fetchMesDemandes()
    setSaving(false)
  }

  const documentsListe = (() => {
    const lignes = []
    vehicules.forEach(v => {
      if (v.assurance_expiration) lignes.push({ vehicule: v, type: 'assurance', label: 'Assurance', date: v.assurance_expiration })
      if (v.vignette_expiration) lignes.push({ vehicule: v, type: 'vignette', label: 'Vignette', date: v.vignette_expiration })
    })
    return lignes.sort((a, b) => new Date(a.date) - new Date(b.date))
  })()

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <Truck size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Documents véhicules</h1>
          <p className="text-sm text-slate-500">Assurance et vignette — le logisticien valide après paiement</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
        {documentsListe.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">Aucun document renseigné sur les véhicules</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {documentsListe.map((d, i) => {
              const statut = statutExpiration(d.date)
              const demandeEnCours = mesDemandes.find(
                r => r.vehicule_id === d.vehicule.id && r.type_document === d.type && r.statut === 'En_attente'
              )
              return (
                <div key={i} className="flex items-center gap-4 px-6 py-3.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    statut?.jours < 0 ? 'bg-red-50' : statut ? 'bg-amber-50' : 'bg-green-50'
                  }`}>
                    <Calendar size={16} className={statut?.jours < 0 ? 'text-red-500' : statut ? 'text-amber-500' : 'text-green-500'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{d.vehicule.immatriculation}</p>
                    <p className="text-xs text-slate-400">{d.label} — expire le {new Date(d.date).toLocaleDateString('fr-FR')}</p>
                  </div>
                  {statut ? (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${statut.class}`}>{statut.label}</span>
                  ) : (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-700 flex-shrink-0">En règle</span>
                  )}
                  {demandeEnCours ? (
                    <span className="text-xs px-3 py-1.5 rounded-lg font-medium bg-blue-50 text-blue-600 flex-shrink-0">
                      En attente de validation
                    </span>
                  ) : (
                    <button onClick={() => ouvrirForm(d.vehicule, d.type)}
                      className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 transition-colors flex-shrink-0">
                      J'ai réglé
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {mesDemandes.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-700">Mes demandes de renouvellement</p>
          </div>
          <div className="divide-y divide-slate-50">
            {mesDemandes.map(r => {
              const sc = STATUT_CONFIG[r.statut]
              const Icon = sc.icon
              return (
                <div key={r.id} className="px-6 py-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{r.vehicules?.immatriculation} — {r.type_document === 'assurance' ? 'Assurance' : 'Vignette'}</p>
                      <p className="text-xs text-slate-400">Nouvelle échéance : {new Date(r.nouvelle_date_expiration).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${sc.class}`}>
                      <Icon size={11} /> {sc.label}
                    </span>
                  </div>
                  {r.statut === 'Rejetee' && r.motif_rejet && (
                    <p className="text-xs text-red-500 mt-1 italic">Motif : {r.motif_rejet}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showForm && (
        <ModalFiche titre={`J'ai réglé — ${showForm.type === 'assurance' ? 'Assurance' : 'Vignette'}`} onClose={() => setShowForm(null)}>
          <form onSubmit={handleSoumettre} className="p-6 space-y-4">
            {erreur && <BandeauErreur message={erreur} />}

            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-sm font-semibold text-slate-800">{showForm.vehicule.immatriculation}</p>
              <p className="text-xs text-slate-400">
                Ancienne échéance : {new Date(showForm.vehicule[`${showForm.type}_expiration`]).toLocaleDateString('fr-FR')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nouvelle date d'expiration *</label>
              <input type="date" value={date} required
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>

            {showForm.type === 'vignette' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Prix payé (DJF)</label>
                <input type="number" min="0" value={prix}
                  onChange={e => setPrix(e.target.value)}
                  placeholder="Ex : 15000"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            )}

            <UploadPhotoFiche photoUrl={photo} onChange={setPhoto} />

            <p className="text-xs text-slate-400">
              Cette demande sera transmise au logisticien, qui appliquera la nouvelle date après vérification.
            </p>

            <button type="submit" disabled={saving}
              className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 size={16} className="animate-spin" />Envoi...</> : 'Transmettre au logisticien'}
            </button>
          </form>
        </ModalFiche>
      )}
    </div>
  )
}