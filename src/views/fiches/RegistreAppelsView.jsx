import { useEffect, useState } from 'react'
import { Phone, Plus, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { ModalFiche, BandeauErreur, STATUT_CONFIG } from '../../components/fiches/FichesUI'

const FICHE_VIDE = { nom_appelant: '', telephone: '', motif: '', suivi_a_faire: '' }

export default function RegistreAppelsView() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [appels, setAppels] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(FICHE_VIDE)
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState(null)

  useEffect(() => { fetchAppels() }, [])

  async function fetchAppels() {
    setLoading(true)
    const { data } = await supabase.from('registre_appels').select('*').eq('cree_par', user.id).order('date_appel', { ascending: false })
    setAppels(data || [])
    setLoading(false)
  }

  async function handleSoumettre(e) {
    e.preventDefault()
    setErreur(null)
    if (!form.nom_appelant.trim()) return setErreur("Le nom de l'appelant est obligatoire.")
    if (!form.motif.trim()) return setErreur("Le motif de l'appel est obligatoire.")

    setSaving(true)
    const { error } = await supabase.from('registre_appels').insert({ ...form, cree_par: user.id })
    if (error) { setErreur(`Erreur : ${error.message}`); setSaving(false); return }

    setForm(FICHE_VIDE)
    setShowForm(false)
    await fetchAppels()
    setSaving(false)
  }

  async function marquerTraite(id) {
    await supabase.from('registre_appels').update({
      statut: 'Traite', traite_par: user.id, traite_le: new Date().toISOString(),
    }).eq('id', id)
    await fetchAppels()
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
          <Phone size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Registre d'appels</h1>
          <p className="text-sm text-slate-500">
            {appels.filter(a => a.statut === 'A_traiter').length} à traiter · {appels.length} au total
          </p>
        </div>
      </div>

      <button onClick={() => setShowForm(true)}
        className="mb-5 flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors shadow-sm">
        <Plus size={18} /> Nouvel appel
      </button>

      <div className="space-y-3">
        {appels.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
            <Phone size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Aucun appel enregistré</p>
          </div>
        ) : (
          appels.map(a => {
            const sc = STATUT_CONFIG[a.statut]
            const Icon = sc.icon
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{a.nom_appelant}</p>
                      {a.telephone && <span className="text-xs text-slate-400">{a.telephone}</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{a.motif}</p>
                    {a.suivi_a_faire && <p className="text-xs text-orange-600 mt-1">À faire : {a.suivi_a_faire}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${sc.class}`}>
                      <Icon size={11} /> {sc.label}
                    </span>
                    {a.statut === 'A_traiter' && (
                      <button onClick={() => marquerTraite(a.id)} className="text-xs text-green-600 font-medium hover:underline">
                        Marquer traité
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {showForm && (
        <ModalFiche titre="Nouvel appel entrant" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSoumettre} className="p-6 space-y-4">
            {erreur && <BandeauErreur message={erreur} />}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom de l'appelant *</label>
              <input type="text" value={form.nom_appelant} required
                onChange={e => setForm({ ...form, nom_appelant: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Téléphone</label>
              <input type="text" value={form.telephone}
                onChange={e => setForm({ ...form, telephone: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Motif de l'appel *</label>
              <textarea value={form.motif} required rows={2}
                onChange={e => setForm({ ...form, motif: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Suivi à faire (optionnel)</label>
              <input type="text" value={form.suivi_a_faire}
                onChange={e => setForm({ ...form, suivi_a_faire: e.target.value })}
                placeholder="Ex : Rappeler demain matin"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>

            <button type="submit" disabled={saving}
              className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 size={16} className="animate-spin" />Enregistrement...</> : "Enregistrer l'appel"}
            </button>
          </form>
        </ModalFiche>
      )}
    </div>
  )
}