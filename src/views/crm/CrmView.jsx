// ============================================================
// Module CRM & Prospects
// - Liste des fiches de prospection terrain
// - Formulaire complet de création / modification
// - Filtres par résultat et secteur
// - Calendrier des relances
// ============================================================

import { useEffect, useState } from 'react'
import {
  Plus, Users, Search, Phone,
  MapPin, Calendar, X, Loader2,
  AlertCircle, Clock, CheckCircle, XCircle
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatDate, getResultatColor, getResultatLabel, getInteretColor, getInteretLabel } from '../../lib/utils'

// ── Données fixes métier ──
const SECTEURS = [
  'Hotel','Restaurant','Cafe','Supermarche',
  'Epicerie','Ecole','Clinique','Entreprise','Administration','Autre'
]
const NIVEAUX_INTERET    = ['Tres_interesse','Interesse','Peu_interesse','Pas_interesse']
const NIVEAUX_CONSO      = ['Faible','Moyenne','Elevee']
const ACTIONS_PREVUES    = ['Rappeler','Visiter_a_nouveau','Envoyer_une_offre','Presenter_un_echantillon','En_attente_du_lancement']
const RESULTATS          = ['Prospect_actif','Client_obtenu','A_suivre','Refus']

const LABELS_ACTION = {
  Rappeler:                '📞 Rappeler',
  Visiter_a_nouveau:       '🚶 Visiter à nouveau',
  Envoyer_une_offre:       '📄 Envoyer une offre',
  Presenter_un_echantillon:'🧪 Présenter un échantillon',
  En_attente_du_lancement: '⏳ En attente du lancement',
}

const FORM_VIDE = {
  date_visite:      new Date().toISOString().split('T')[0],
  nom_entreprise:   '',
  secteur:          '',
  nom_contact:      '',
  fonction:         '',
  telephone:        '',
  email:            '',
  adresse:          '',
  marque_actuelle:  '',
  consommation:     '',
  niveau_interet:   '',
  observations:     '',
  objections:       '',
  action_prevue:    '',
  date_relance:     '',
  resultat:         'Prospect_actif',
}

export default function CrmView() {
  const [prospects, setProspects]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filtreResultat, setFiltreResultat] = useState('') // Filtre par résultat
  const [filtreSecteur, setFiltreSecteur]   = useState('') // Filtre par secteur
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState(FORM_VIDE)
  const [editId, setEditId]         = useState(null)
  const [saving, setSaving]         = useState(false)
  const [onglet, setOnglet]         = useState('liste') // 'liste' ou 'relances'

  useEffect(() => {
    fetchProspects()
  }, [])

  async function fetchProspects() {
    const { data } = await supabase
      .from('prospects')
      .select('*')
      .order('cree_le', { ascending: false })

    setProspects(data || [])
    setLoading(false)
  }

  function ouvrirCreation() {
    setForm(FORM_VIDE)
    setEditId(null)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function ouvrirModification(prospect) {
    setForm({
      date_visite:      prospect.date_visite      || FORM_VIDE.date_visite,
      nom_entreprise:   prospect.nom_entreprise   || '',
      secteur:          prospect.secteur          || '',
      nom_contact:      prospect.nom_contact      || '',
      fonction:         prospect.fonction         || '',
      telephone:        prospect.telephone        || '',
      email:            prospect.email            || '',
      adresse:          prospect.adresse          || '',
      marque_actuelle:  prospect.marque_actuelle  || '',
      consommation:     prospect.consommation     || '',
      niveau_interet:   prospect.niveau_interet   || '',
      observations:     prospect.observations     || '',
      objections:       prospect.objections       || '',
      action_prevue:    prospect.action_prevue    || '',
      date_relance:     prospect.date_relance     || '',
      resultat:         prospect.resultat         || 'Prospect_actif',
    })
    setEditId(prospect.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSauvegarder(e) {
    e.preventDefault()
    setSaving(true)

    // Nettoie les champs vides pour éviter les erreurs de type enum
    const payload = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v === '' ? null : v])
    )

    if (editId) {
      await supabase.from('prospects').update({ ...payload, mis_a_jour_le: new Date().toISOString() }).eq('id', editId)
    } else {
      await supabase.from('prospects').insert(payload)
    }

    await fetchProspects()
    setShowForm(false)
    setForm(FORM_VIDE)
    setEditId(null)
    setSaving(false)
  }

  // Prospects filtrés selon recherche + filtres actifs
  const prospectsFiltres = prospects.filter(p => {
    const matchSearch = !search ||
      p.nom_entreprise.toLowerCase().includes(search.toLowerCase()) ||
      p.nom_contact?.toLowerCase().includes(search.toLowerCase()) ||
      p.telephone?.includes(search)
    const matchResultat = !filtreResultat || p.resultat === filtreResultat
    const matchSecteur  = !filtreSecteur  || p.secteur  === filtreSecteur
    return matchSearch && matchResultat && matchSecteur
  })

  // Relances : prospects avec date_relance <= dans 7 jours
  const relancesUrgentes = prospects.filter(p => {
    if (!p.date_relance) return false
    const diff = (new Date(p.date_relance) - new Date()) / (1000 * 60 * 60 * 24)
    return diff <= 7
  }).sort((a, b) => new Date(a.date_relance) - new Date(b.date_relance))

  // Icône selon le résultat
  function ResultatIcon({ resultat }) {
    const map = {
      'Prospect_actif': <Clock size={12} className="text-blue-500" />,
      'Client_obtenu':  <CheckCircle size={12} className="text-green-500" />,
      'A_suivre':       <AlertCircle size={12} className="text-purple-500" />,
      'Refus':          <XCircle size={12} className="text-red-400" />,
    }
    return map[resultat] || null
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-7xl mx-auto">

      {/* ── En-tête ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CRM & Prospects</h1>
          <p className="text-slate-500 text-sm mt-1">
            {prospects.length} fiche{prospects.length > 1 ? 's' : ''} de prospection
            {relancesUrgentes.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                ⚠️ {relancesUrgentes.length} relance{relancesUrgentes.length > 1 ? 's' : ''} urgente{relancesUrgentes.length > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={ouvrirCreation}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={18} />
          Ajouter un prospect
        </button>
      </div>

      {/* ── Formulaire fiche prospect ── */}
      {showForm && (
        <div className="mb-8 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Users size={18} className="text-blue-500" />
              {editId ? 'Modifier la fiche prospect' : 'Nouvelle fiche de prospection'}
            </h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSauvegarder} className="space-y-6">

            {/* ── Section 1 : Identification ── */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Identification
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Date de visite</label>
                  <input type="date" value={form.date_visite}
                    onChange={e => setForm({ ...form, date_visite: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom entreprise / commerce *</label>
                  <input type="text" value={form.nom_entreprise} required
                    onChange={e => setForm({ ...form, nom_entreprise: e.target.value })}
                    placeholder="Ex : Restaurant La Siesta"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Secteur d'activité *</label>
                  <select value={form.secteur} required
                    onChange={e => setForm({ ...form, secteur: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">— Choisir —</option>
                    {SECTEURS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* ── Section 2 : Contact ── */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Contact
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom du contact</label>
                  <input type="text" value={form.nom_contact}
                    onChange={e => setForm({ ...form, nom_contact: e.target.value })}
                    placeholder="Ex : Ahmed Hassan"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Fonction</label>
                  <input type="text" value={form.fonction}
                    onChange={e => setForm({ ...form, fonction: e.target.value })}
                    placeholder="Ex : Gérant"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Téléphone</label>
                  <input type="text" value={form.telephone}
                    onChange={e => setForm({ ...form, telephone: e.target.value })}
                    placeholder="77 00 00 00"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <input type="email" value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="contact@..."
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Adresse</label>
                  <input type="text" value={form.adresse}
                    onChange={e => setForm({ ...form, adresse: e.target.value })}
                    placeholder="Ex : Quartier Européen, Djibouti"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            {/* ── Section 3 : Analyse concurrentielle ── */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Analyse concurrentielle
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Marque d'eau actuellement utilisée
                  </label>
                  <input type="text" value={form.marque_actuelle}
                    onChange={e => setForm({ ...form, marque_actuelle: e.target.value })}
                    placeholder="Ex : Evian, Salam, Eau locale..."
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Consommation estimée
                  </label>
                  <select value={form.consommation}
                    onChange={e => setForm({ ...form, consommation: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">— Choisir —</option>
                    {NIVEAUX_CONSO.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* ── Section 4 : Qualification ── */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Qualification
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
                {/* Niveau d'intérêt — boutons visuels */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Niveau d'intérêt pour Ougoul
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {NIVEAUX_INTERET.map(n => (
                      <button key={n} type="button"
                        onClick={() => setForm({ ...form, niveau_interet: n })}
                        className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                          form.niveau_interet === n
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                        }`}>
                        {getInteretLabel(n)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Observations</label>
                    <textarea value={form.observations} rows={3}
                      onChange={e => setForm({ ...form, observations: e.target.value })}
                      placeholder="Ce que vous avez observé lors de la visite..."
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Objections du client</label>
                    <textarea value={form.objections} rows={3}
                      onChange={e => setForm({ ...form, objections: e.target.value })}
                      placeholder="Raisons invoquées pour ne pas changer..."
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Section 5 : Suivi & Résultat ── */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Suivi & Résultat
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Action à prévoir</label>
                  <select value={form.action_prevue}
                    onChange={e => setForm({ ...form, action_prevue: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">— Choisir —</option>
                    {ACTIONS_PREVUES.map(a => <option key={a} value={a}>{LABELS_ACTION[a]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Date de relance</label>
                  <input type="date" value={form.date_relance}
                    onChange={e => setForm({ ...form, date_relance: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Résultat final</label>
                  <select value={form.resultat}
                    onChange={e => setForm({ ...form, resultat: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    {RESULTATS.map(r => <option key={r} value={r}>{getResultatLabel(r)}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Boutons */}
            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button type="submit" disabled={saving}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center gap-2">
                {saving
                  ? <><Loader2 size={16} className="animate-spin" />Enregistrement...</>
                  : editId ? '✅ Mettre à jour' : '✅ Enregistrer la fiche'
                }
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors">
                Annuler
              </button>
            </div>

          </form>
        </div>
      )}

      {/* ── Onglets Liste / Relances ── */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { key: 'liste',   label: `Toutes les fiches (${prospects.length})` },
          { key: 'relances', label: `Relances urgentes (${relancesUrgentes.length})` },
        ].map(tab => (
          <button key={tab.key} onClick={() => setOnglet(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              onglet === tab.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Onglet LISTE ── */}
      {onglet === 'liste' && (
        <>
          {/* Filtres */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
            </div>
            <select value={filtreResultat} onChange={e => setFiltreResultat(e.target.value)}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Tous les résultats</option>
              {RESULTATS.map(r => <option key={r} value={r}>{getResultatLabel(r)}</option>)}
            </select>
            <select value={filtreSecteur} onChange={e => setFiltreSecteur(e.target.value)}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Tous les secteurs</option>
              {SECTEURS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {(filtreResultat || filtreSecteur || search) && (
              <button onClick={() => { setFiltreResultat(''); setFiltreSecteur(''); setSearch('') }}
                className="px-3 py-2.5 text-sm text-slate-500 hover:text-red-500 border border-slate-200 rounded-xl hover:border-red-200 transition-colors flex items-center gap-1">
                <X size={14} /> Effacer
              </button>
            )}
          </div>

          {/* Grille de cartes prospects */}
          {prospectsFiltres.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
              <Users size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">
                {search || filtreResultat || filtreSecteur
                  ? 'Aucun prospect trouvé pour ces filtres'
                  : 'Aucune fiche de prospection pour l\'instant'
                }
              </p>
              {!search && !filtreResultat && !filtreSecteur && (
                <button onClick={ouvrirCreation}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
                  Créer la première fiche
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {prospectsFiltres.map(p => (
                <div key={p.id}
                  className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => ouvrirModification(p)}>

                  {/* En-tête carte */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{p.nom_entreprise}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{p.secteur || '—'}</p>
                    </div>
                    {/* Badge résultat */}
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ml-2 flex-shrink-0 ${getResultatColor(p.resultat)}`}>
                      <ResultatIcon resultat={p.resultat} />
                      {getResultatLabel(p.resultat)}
                    </span>
                  </div>

                  {/* Infos contact */}
                  <div className="space-y-1.5 mb-3">
                    {p.nom_contact && (
                      <p className="text-sm text-slate-600 flex items-center gap-1.5">
                        <span className="text-slate-300">👤</span> {p.nom_contact}
                        {p.fonction && <span className="text-slate-400">· {p.fonction}</span>}
                      </p>
                    )}
                    {p.telephone && (
                      <p className="text-sm text-slate-600 flex items-center gap-1.5">
                        <Phone size={12} className="text-slate-300" /> {p.telephone}
                      </p>
                    )}
                    {p.adresse && (
                      <p className="text-xs text-slate-400 flex items-center gap-1.5">
                        <MapPin size={11} className="text-slate-300" /> {p.adresse}
                      </p>
                    )}
                  </div>

                  {/* Niveau d'intérêt */}
                  {p.niveau_interet && (
                    <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium mb-3 ${getInteretColor(p.niveau_interet)}`}>
                      {getInteretLabel(p.niveau_interet)}
                    </span>
                  )}

                  {/* Marque concurrente */}
                  {p.marque_actuelle && (
                    <p className="text-xs text-slate-400 mb-3">
                      🏷️ Utilise actuellement : <span className="font-medium text-slate-600">{p.marque_actuelle}</span>
                    </p>
                  )}

                  {/* Pied de carte : date visite + relance */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                    <p className="text-xs text-slate-400">
                      Visite : {formatDate(p.date_visite)}
                    </p>
                    {p.date_relance && (
                      <span className={`text-xs flex items-center gap-1 font-medium ${
                        new Date(p.date_relance) <= new Date()
                          ? 'text-red-500'
                          : 'text-amber-600'
                      }`}>
                        <Calendar size={11} />
                        Relance : {formatDate(p.date_relance)}
                      </span>
                    )}
                  </div>

                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Onglet RELANCES ── */}
      {onglet === 'relances' && (
        <div className="space-y-3">
          {relancesUrgentes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
              <Calendar size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Aucune relance urgente cette semaine 🎉</p>
            </div>
          ) : (
            relancesUrgentes.map(p => {
              const joursRestants = Math.ceil((new Date(p.date_relance) - new Date()) / (1000 * 60 * 60 * 24))
              return (
                <div key={p.id}
                  onClick={() => { ouvrirModification(p); setOnglet('liste') }}
                  className={`bg-white rounded-xl border p-4 flex items-center justify-between gap-4 cursor-pointer hover:shadow-md transition-shadow ${
                    joursRestants <= 0 ? 'border-red-200 bg-red-50/30' : 'border-amber-200 bg-amber-50/30'
                  }`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{p.nom_entreprise}</p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {p.nom_contact && `${p.nom_contact} · `}
                      {p.telephone && p.telephone}
                    </p>
                    {p.action_prevue && (
                      <p className="text-xs text-slate-400 mt-1">{LABELS_ACTION[p.action_prevue] || p.action_prevue}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${joursRestants <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {joursRestants <= 0 ? '⚠️ En retard' : `Dans ${joursRestants}j`}
                    </p>
                    <p className="text-xs text-slate-400">{formatDate(p.date_relance)}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

    </div>
  )
}