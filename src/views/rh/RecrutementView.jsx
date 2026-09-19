import { useEffect, useState } from 'react'
import {
  Briefcase, Plus, X, Loader2, Phone, Mail, Calendar,
  ChevronRight, Trash2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../lib/utils'

const ETAPES = [
  { key: 'Recu',                label: 'Reçu',               color: 'bg-slate-100 text-slate-600' },
  { key: 'Preselectionne',      label: 'Présélectionné',     color: 'bg-blue-100 text-blue-700' },
  { key: 'Entretien_planifie',  label: 'Entretien planifié', color: 'bg-purple-100 text-purple-700' },
  { key: 'Entretien_fait',      label: 'Entretien fait',     color: 'bg-indigo-100 text-indigo-700' },
  { key: 'Offre_envoyee',       label: 'Offre envoyée',      color: 'bg-amber-100 text-amber-700' },
  { key: 'Embauche',            label: 'Embauché',           color: 'bg-green-100 text-green-700' },
  { key: 'Refuse',              label: 'Refusé',             color: 'bg-red-100 text-red-700' },
]

const SOURCES = ['Spontanee', 'Annonce', 'Recommandation', 'Reseau_social', 'Autre']
const SOURCE_LABELS = {
  Spontanee: 'Spontanée', Annonce: 'Annonce', Recommandation: 'Recommandation',
  Reseau_social: 'Réseau social', Autre: 'Autre',
}

const FORM_VIDE = {
  nom_complet: '', poste_vise: '', telephone: '', email: '', source: 'Spontanee',
}

export default function RecrutementView() {
  const { user } = useAuth()
  const [candidatures, setCandidatures] = useState([])
  const [loading, setLoading]           = useState(true)
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState(FORM_VIDE)
  const [saving, setSaving]             = useState(false)

  const [candidatOuvert, setCandidatOuvert] = useState(null)
  const [noteEntretien, setNoteEntretien]   = useState('')
  const [dateEntretien, setDateEntretien]   = useState('')
  const [posteFiltre, setPosteFiltre]       = useState('Tous')

  useEffect(() => {
    fetchCandidatures()
    const channel = supabase.channel('candidatures-v1')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidatures' }, fetchCandidatures)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchCandidatures() {
    const { data } = await supabase.from('candidatures').select('*').order('cree_le', { ascending: false })
    setCandidatures(data || [])
    setLoading(false)
  }

  function ouvrirCreation() {
    setForm(FORM_VIDE)
    setShowForm(true)
  }

  async function handleSoumettre(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase.from('candidatures').insert({
        ...form,
        statut: 'Recu',
        cree_par: user.id,
      })
      if (error) throw error
      setShowForm(false)
      setForm(FORM_VIDE)
      await fetchCandidatures()
    } catch (err) {
      alert(`Erreur : ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  function ouvrirDetail(candidat) {
    setCandidatOuvert(candidat)
    setNoteEntretien(candidat.note_entretien || '')
    setDateEntretien(candidat.date_entretien || '')
  }

  async function changerStatut(candidat, nouveauStatut) {
    await supabase.from('candidatures').update({
      statut: nouveauStatut,
      mis_a_jour_le: new Date().toISOString(),
    }).eq('id', candidat.id)
    await fetchCandidatures()
    setCandidatOuvert(prev => prev ? { ...prev, statut: nouveauStatut } : prev)
  }

  async function sauverNotes() {
    if (!candidatOuvert) return
    await supabase.from('candidatures').update({
      note_entretien: noteEntretien,
      date_entretien: dateEntretien || null,
      mis_a_jour_le: new Date().toISOString(),
    }).eq('id', candidatOuvert.id)
    setCandidatOuvert(null)
    await fetchCandidatures()
  }

  async function supprimer(candidat) {
    if (!confirm(`Supprimer définitivement la candidature de ${candidat.nom_complet} ?`)) return
    await supabase.from('candidatures').delete().eq('id', candidat.id)
    setCandidatOuvert(null)
    await fetchCandidatures()
  }

  const postesUniques = ['Tous', ...new Set(candidatures.map(c => c.poste_vise).filter(Boolean))]
  const candidaturesFiltrees = candidatures.filter(c => posteFiltre === 'Tous' || c.poste_vise === posteFiltre)

  // Regroupe par etape pour la vue pipeline (kanban simplifie)
  const parEtape = ETAPES.map(etape => ({
    ...etape,
    candidats: candidaturesFiltrees.filter(c => c.statut === etape.key),
  }))

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">

      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Briefcase size={22} className="text-orange-500" /> Recrutement
          </h1>
          <p className="text-slate-500 text-sm mt-1">{candidatures.length} candidature{candidatures.length > 1 ? 's' : ''} au total</p>
        </div>
        <button onClick={ouvrirCreation}
          className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors shadow-sm">
          <Plus size={18} /> Nouvelle candidature
        </button>
      </div>

      {postesUniques.length > 1 && (
        <div className="flex gap-1 mb-6 bg-white border border-slate-200 p-1 rounded-xl w-fit flex-wrap">
          {postesUniques.map(p => (
            <button key={p} onClick={() => setPosteFiltre(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                posteFiltre === p ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Pipeline kanban simplifie — scroll horizontal */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {parEtape.map(etape => (
          <div key={etape.key} className="flex-shrink-0 w-64">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${etape.color}`}>{etape.label}</span>
              <span className="text-xs text-slate-400">{etape.candidats.length}</span>
            </div>
            <div className="space-y-2">
              {etape.candidats.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-xl py-6 text-center">
                  <p className="text-xs text-slate-300">Vide</p>
                </div>
              ) : (
                etape.candidats.map(c => (
                  <button key={c.id} onClick={() => ouvrirDetail(c)}
                    className="w-full text-left bg-white rounded-xl border border-slate-100 shadow-sm p-3.5 hover:border-orange-200 hover:shadow-md transition-all">
                    <p className="text-sm font-semibold text-slate-900 truncate">{c.nom_complet}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{c.poste_vise}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-slate-400">{SOURCE_LABELS[c.source] || c.source}</span>
                      <ChevronRight size={12} className="text-slate-300" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Modal nouvelle candidature ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl z-10 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-slate-900">Nouvelle candidature</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSoumettre} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom complet *</label>
                <input type="text" value={form.nom_complet} required
                  onChange={e => setForm({ ...form, nom_complet: e.target.value })}
                  placeholder="Ex : Fatouma Ahmed"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Poste visé *</label>
                <input type="text" value={form.poste_vise} required
                  onChange={e => setForm({ ...form, poste_vise: e.target.value })}
                  placeholder="Ex : Chauffeur livreur"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Téléphone</label>
                  <input type="text" value={form.telephone}
                    onChange={e => setForm({ ...form, telephone: e.target.value })}
                    placeholder="77 00 00 00"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <input type="email" value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Source</label>
                <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white">
                  {SOURCES.map(s => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
                </select>
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <><Loader2 size={15} className="animate-spin" />Enregistrement...</> : 'Ajouter la candidature'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal detail / changement d'etape ── */}
      {candidatOuvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setCandidatOuvert(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl z-10 overflow-hidden max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <div>
                <h2 className="font-semibold text-slate-900">{candidatOuvert.nom_complet}</h2>
                <p className="text-xs text-slate-400">{candidatOuvert.poste_vise}</p>
              </div>
              <button onClick={() => setCandidatOuvert(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                {candidatOuvert.telephone && (
                  <span className="flex items-center gap-1.5"><Phone size={13} className="text-slate-400" /> {candidatOuvert.telephone}</span>
                )}
                {candidatOuvert.email && (
                  <span className="flex items-center gap-1.5"><Mail size={13} className="text-slate-400" /> {candidatOuvert.email}</span>
                )}
                <span className="flex items-center gap-1.5"><Calendar size={13} className="text-slate-400" /> Reçu le {formatDate(candidatOuvert.cree_le)}</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Étape actuelle</label>
                <div className="flex flex-wrap gap-1.5">
                  {ETAPES.map(e => (
                    <button key={e.key} onClick={() => changerStatut(candidatOuvert, e.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${
                        candidatOuvert.statut === e.key
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}>
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Date d'entretien</label>
                <input type="date" value={dateEntretien}
                  onChange={e => setDateEntretien(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes d'entretien</label>
                <textarea value={noteEntretien} rows={4}
                  onChange={e => setNoteEntretien(e.target.value)}
                  placeholder="Impressions, points forts, réserves..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
              </div>

              <div className="flex gap-3">
                <button onClick={sauverNotes}
                  className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors">
                  Enregistrer
                </button>
                <button onClick={() => supprimer(candidatOuvert)}
                  className="px-4 py-2.5 border border-red-200 text-red-500 rounded-xl hover:bg-red-50 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}