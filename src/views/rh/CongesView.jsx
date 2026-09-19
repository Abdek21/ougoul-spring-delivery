import { useEffect, useState } from 'react'
import {
  Calendar, Plus, CheckCircle, XCircle, Clock, X, Loader2, Users, AlertTriangle
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../lib/utils'

const TYPE_CONGE_LABELS = {
  Conge_paye:           '🏖️ Congé payé',
  Maladie:              '🤒 Maladie',
  Sans_solde:           '📋 Sans solde',
  Exceptionnel:         '⭐ Exceptionnel',
  Maternite_paternite:  '👶 Maternité/Paternité',
}

const STATUT_CONFIG = {
  En_attente: { label: 'En attente', class: 'bg-amber-100 text-amber-700', icon: Clock },
  Approuve:   { label: 'Approuvé',   class: 'bg-green-100 text-green-700', icon: CheckCircle },
  Refuse:     { label: 'Refusé',     class: 'bg-red-100 text-red-700',     icon: XCircle },
  Annule:     { label: 'Annulé',     class: 'bg-slate-100 text-slate-500', icon: XCircle },
}

const FORM_VIDE = {
  employe_id: '',
  type_conge: 'Conge_paye',
  date_debut: '',
  date_fin:   '',
  motif:      '',
}

function calculerJours(debut, fin) {
  if (!debut || !fin) return 0
  const d1 = new Date(debut)
  const d2 = new Date(fin)
  const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1
  return diff > 0 ? diff : 0
}

export default function CongesView() {
  const { user } = useAuth()
  const [conges, setConges]       = useState([])
  const [soldes, setSoldes]       = useState([])
  const [employes, setEmployes]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [onglet, setOnglet]       = useState('demandes')
  const [filtreStatut, setFiltreStatut] = useState('Tous')

  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState(FORM_VIDE)
  const [saving, setSaving]       = useState(false)

  const [congeARefuser, setCongeARefuser] = useState(null)
  const [noteRefus, setNoteRefus]         = useState('')

  useEffect(() => {
    fetchTout()
    const channel = supabase.channel('conges-v1')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conges' }, fetchConges)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchTout() {
    setLoading(true)
    await Promise.all([fetchConges(), fetchSoldes(), fetchEmployes()])
    setLoading(false)
  }

  async function fetchConges() {
    const { data } = await supabase
      .from('conges')
      .select('*, employes(nom, prenom, poste)')
      .order('cree_le', { ascending: false })
    setConges(data || [])
  }

  async function fetchSoldes() {
    const { data } = await supabase.from('v_solde_conges').select('*').order('nom_complet')
    setSoldes(data || [])
  }

  async function fetchEmployes() {
    const { data } = await supabase
      .from('employes')
      .select('id, nom, prenom, poste')
      .eq('statut', 'Actif')
      .order('nom')
    setEmployes(data || [])
  }

  function ouvrirCreation() {
    setForm(FORM_VIDE)
    setShowForm(true)
  }

  async function handleSoumettre(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const nbJours = calculerJours(form.date_debut, form.date_fin)
      if (nbJours <= 0) throw new Error('Dates invalides — la date de fin doit être après la date de début.')

      const { error } = await supabase.from('conges').insert({
        employe_id: form.employe_id,
        type_conge: form.type_conge,
        date_debut: form.date_debut,
        date_fin:   form.date_fin,
        nb_jours:   nbJours,
        motif:      form.motif || null,
        statut:     'En_attente',
        cree_par:   user.id,
      })
      if (error) throw error

      setShowForm(false)
      setForm(FORM_VIDE)
      await fetchTout()
    } catch (err) {
      alert(`Erreur : ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function approuver(conge) {
    await supabase.from('conges').update({
      statut: 'Approuve', valide_par: user.id, valide_le: new Date().toISOString(),
    }).eq('id', conge.id)
    await fetchTout()
  }

  async function confirmerRefus(e) {
    e.preventDefault()
    if (!congeARefuser) return
    await supabase.from('conges').update({
      statut: 'Refuse', note_refus: noteRefus, valide_par: user.id, valide_le: new Date().toISOString(),
    }).eq('id', congeARefuser.id)
    setCongeARefuser(null)
    setNoteRefus('')
    await fetchTout()
  }

  const congesFiltres = conges.filter(c => filtreStatut === 'Tous' || c.statut === filtreStatut)
  const enAttenteCount = conges.filter(c => c.statut === 'En_attente').length
  const nbJoursForm = calculerJours(form.date_debut, form.date_fin)

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">

      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar size={22} className="text-orange-500" /> Congés & absences
          </h1>
          <p className="text-slate-500 text-sm mt-1">Demandes, validation et soldes par employé</p>
        </div>
        <button onClick={ouvrirCreation}
          className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors shadow-sm">
          <Plus size={18} /> Nouvelle demande
        </button>
      </div>

      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        <button onClick={() => setOnglet('demandes')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            onglet === 'demandes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          Demandes {enAttenteCount > 0 && `(${enAttenteCount} en attente)`}
        </button>
        <button onClick={() => setOnglet('soldes')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            onglet === 'soldes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          Soldes par employé
        </button>
      </div>

      {onglet === 'demandes' && (
        <>
          <div className="flex gap-1 mb-4 bg-white border border-slate-200 p-1 rounded-xl w-fit">
            {['Tous', 'En_attente', 'Approuve', 'Refuse'].map(s => (
              <button key={s} onClick={() => setFiltreStatut(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filtreStatut === s ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {s === 'Tous' ? 'Tous' : STATUT_CONFIG[s]?.label}
              </button>
            ))}
          </div>

          {congesFiltres.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
              <Calendar size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Aucune demande</p>
            </div>
          ) : (
            <div className="space-y-2">
              {congesFiltres.map(c => {
                const sc = STATUT_CONFIG[c.statut] || STATUT_CONFIG.En_attente
                const Icon = sc.icon
                return (
                  <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-56">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900">
                            {c.employes?.nom} {c.employes?.prenom}
                          </p>
                          <span className="text-xs text-slate-400">{c.employes?.poste}</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{TYPE_CONGE_LABELS[c.type_conge] || c.type_conge}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatDate(c.date_debut)} → {formatDate(c.date_fin)} · <span className="font-medium">{c.nb_jours} jour{c.nb_jours > 1 ? 's' : ''}</span>
                        </p>
                        {c.motif && <p className="text-xs text-slate-500 mt-1.5 bg-slate-50 px-3 py-1.5 rounded-lg inline-block">{c.motif}</p>}
                        {c.statut === 'Refuse' && c.note_refus && (
                          <p className="text-xs text-red-600 mt-1.5">Motif refus : {c.note_refus}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${sc.class}`}>
                          <Icon size={11} /> {sc.label}
                        </span>
                        {c.statut === 'En_attente' && (
                          <div className="flex gap-1.5">
                            <button onClick={() => approuver(c)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 transition-colors">
                              <CheckCircle size={12} /> Approuver
                            </button>
                            <button onClick={() => setCongeARefuser(c)}
                              className="flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors">
                              <XCircle size={12} /> Refuser
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {onglet === 'soldes' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Users size={16} className="text-orange-500" />
            <h2 className="font-semibold text-slate-900">Solde de congés payés — 18 jours/an</h2>
          </div>
          {soldes.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">Aucun employé actif</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {soldes.map(s => (
                <div key={s.employe_id} className="flex items-center gap-4 px-6 py-3.5">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{s.nom_complet}</p>
                    <p className="text-xs text-slate-400">{s.poste}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Pris cette année</p>
                    <p className="text-sm font-bold text-slate-700">{s.jours_pris_annee} j</p>
                  </div>
                  <div className="text-right w-24">
                    <p className="text-xs text-slate-400">Restants</p>
                    <p className={`text-sm font-bold ${s.jours_restants <= 3 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {s.jours_restants} j
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal nouvelle demande ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl z-10 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-slate-900">Nouvelle demande de congé</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSoumettre} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Employé *</label>
                <select value={form.employe_id} required
                  onChange={e => setForm({ ...form, employe_id: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white">
                  <option value="">— Sélectionner —</option>
                  {employes.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nom} {emp.prenom} — {emp.poste}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Type de congé *</label>
                <select value={form.type_conge}
                  onChange={e => setForm({ ...form, type_conge: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white">
                  {Object.entries(TYPE_CONGE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Date début *</label>
                  <input type="date" value={form.date_debut} required
                    onChange={e => setForm({ ...form, date_debut: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Date fin *</label>
                  <input type="date" value={form.date_fin} required
                    onChange={e => setForm({ ...form, date_fin: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>

              {nbJoursForm > 0 && (
                <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-100 rounded-xl">
                  <Calendar size={14} className="text-orange-500" />
                  <p className="text-sm text-orange-700 font-medium">{nbJoursForm} jour{nbJoursForm > 1 ? 's' : ''} au total</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Motif (optionnel)</label>
                <input type="text" value={form.motif}
                  onChange={e => setForm({ ...form, motif: e.target.value })}
                  placeholder="Ex : Voyage familial"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>

              <button type="submit" disabled={saving}
                className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <><Loader2 size={15} className="animate-spin" />Enregistrement...</> : 'Soumettre la demande'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal refus ── */}
      {congeARefuser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setCongeARefuser(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl z-10 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Refuser la demande</h2>
              <button onClick={() => setCongeARefuser(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={confirmerRefus} className="p-6 space-y-4">
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">
                  {congeARefuser.employes?.nom} {congeARefuser.employes?.prenom} — {congeARefuser.nb_jours} jour{congeARefuser.nb_jours > 1 ? 's' : ''}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Motif du refus *</label>
                <input type="text" value={noteRefus} required
                  onChange={e => setNoteRefus(e.target.value)}
                  placeholder="Ex : Période de forte activité"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <button type="submit"
                className="w-full py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors">
                Confirmer le refus
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}