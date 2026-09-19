import { useEffect, useState } from 'react'
import { UserPlus, Users, Pencil, UserX, UserCheck, X, Loader2, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'

const SERVICES = [
  'Production',
  'Logistique',
  'Chauffeur',
  'Magasinier',
  'Administration',
  'Commercial',
  'Autre',
]

const emptyForm = {
  id: null,
  matricule: '',
  nom: '',
  prenom: '',
  poste: '',
  service: 'Autre',
  telephone: '',
  numero_cni: '',
  salaire_base: '',
  date_embauche: new Date().toISOString().slice(0, 10),
  statut: 'Actif',
  notes: '',
}

export default function EmployesView() {
  const [employes, setEmployes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filtreStatut, setFiltreStatut] = useState('Actif')
  const [recherche, setRecherche] = useState('')

  useEffect(() => {
    fetchEmployes()
    const channel = supabase.channel('employes-v1')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employes' }, fetchEmployes)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchEmployes() {
    const { data, error } = await supabase
      .from('employes')
      .select('*')
      .order('nom', { ascending: true })

    if (error) setError(error.message)
    setEmployes(data || [])
    setLoading(false)
  }

  function openNouveau() {
    setForm(emptyForm)
    setError(null)
    setShowForm(true)
  }

  function openModifier(emp) {
    setForm({
      id: emp.id,
      matricule: emp.matricule || '',
      nom: emp.nom || '',
      prenom: emp.prenom || '',
      poste: emp.poste || '',
      service: emp.service || 'Autre',
      telephone: emp.telephone || '',
      numero_cni: emp.numero_cni || '',
      salaire_base: emp.salaire_base ?? '',
      date_embauche: emp.date_embauche || new Date().toISOString().slice(0, 10),
      statut: emp.statut || 'Actif',
      notes: emp.notes || '',
    })
    setError(null)
    setShowForm(true)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.nom.trim() || !form.poste.trim() || form.salaire_base === '') {
      setError('Nom, poste et salaire de base sont obligatoires.')
      return
    }

    setSaving(true)

    const payload = {
      matricule: form.matricule.trim() || null,
      nom: form.nom.trim(),
      prenom: form.prenom.trim() || null,
      poste: form.poste.trim(),
      service: form.service,
      telephone: form.telephone.trim() || null,
      numero_cni: form.numero_cni.trim() || null,
      salaire_base: parseFloat(form.salaire_base),
      date_embauche: form.date_embauche,
      statut: form.statut,
      notes: form.notes.trim() || null,
    }

    const result = form.id
      ? await supabase.from('employes').update(payload).eq('id', form.id)
      : await supabase.from('employes').insert(payload)

    if (result.error) {
      setError(result.error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setShowForm(false)
    setForm(emptyForm)
    fetchEmployes()
  }

  async function toggleStatut(emp) {
    const nouveauStatut = emp.statut === 'Actif' ? 'Inactif' : 'Actif'
    const { error } = await supabase
      .from('employes')
      .update({ statut: nouveauStatut })
      .eq('id', emp.id)

    if (error) setError(error.message)
    else fetchEmployes()
  }

  const employesFiltres = employes.filter(emp => {
    const matchStatut = filtreStatut === 'Tous' || emp.statut === filtreStatut
    const texte = `${emp.nom} ${emp.prenom || ''} ${emp.poste} ${emp.matricule || ''}`.toLowerCase()
    return matchStatut && texte.includes(recherche.toLowerCase())
  })

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-6xl mx-auto">

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employés</h1>
          <p className="text-slate-500 text-sm mt-1">
            {employesFiltres.length} employé{employesFiltres.length > 1 ? 's' : ''} — usine et chauffeurs
          </p>
        </div>
        <button
          onClick={openNouveau}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors"
        >
          <UserPlus size={16} /> Nouvel employé
        </button>
      </div>

      {error && !showForm && (
        <div className="flex items-center gap-2 p-3 mb-6 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Rechercher (nom, poste, matricule)..."
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          className="flex-1 min-w-[240px] px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-xl">
          {['Actif', 'Inactif', 'Tous'].map(s => (
            <button
              key={s}
              onClick={() => setFiltreStatut(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filtreStatut === s ? 'bg-orange-500 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {s === 'Actif' ? 'Actifs' : s === 'Inactif' ? 'Inactifs' : 'Tous'}
            </button>
          ))}
        </div>
      </div>

      {employesFiltres.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
          <Users size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Aucun employé</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-50 bg-slate-50/50">
                  {['Matricule', 'Nom', 'Poste', 'Service', 'Téléphone', 'Salaire base', 'Statut', 'Actions'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {employesFiltres.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-xs font-mono text-slate-500">{emp.matricule || '—'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-slate-900">{emp.nom} {emp.prenom}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-slate-600">{emp.poste}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-50 text-orange-700">
                        {emp.service}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-slate-500">{emp.telephone || '—'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-slate-900">{formatCurrency(emp.salaire_base)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${
                        emp.statut === 'Actif' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {emp.statut}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 flex-nowrap">
                        <button
                          onClick={() => openModifier(emp)}
                          title="Modifier"
                          className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-xs hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                        >
                          <Pencil size={12} /> Modifier
                        </button>
                        <button
                          onClick={() => toggleStatut(emp)}
                          title={emp.statut === 'Actif' ? 'Désactiver' : 'Réactiver'}
                          className={`flex items-center gap-1 px-2.5 py-1.5 border rounded-lg text-xs transition-colors ${
                            emp.statut === 'Actif'
                              ? 'border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                              : 'border-slate-200 text-slate-500 hover:bg-green-50 hover:text-green-600 hover:border-green-200'
                          }`}
                        >
                          {emp.statut === 'Actif' ? <UserX size={12} /> : <UserCheck size={12} />}
                          {emp.statut === 'Actif' ? 'Désactiver' : 'Réactiver'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl z-10 overflow-hidden max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-slate-900">
                {form.id ? 'Modifier employé' : 'Nouvel employé'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Matricule</label>
                    <input
                      type="text" name="matricule" value={form.matricule} onChange={handleChange}
                      placeholder="Optionnel"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Numéro CNI</label>
                    <input
                      type="text" name="numero_cni" value={form.numero_cni} onChange={handleChange}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Nom *</label>
                    <input
                      type="text" name="nom" value={form.nom} onChange={handleChange} required
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Prénom</label>
                    <input
                      type="text" name="prenom" value={form.prenom} onChange={handleChange}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Poste *</label>
                  <input
                    type="text" name="poste" value={form.poste} onChange={handleChange} required
                    placeholder="Ex: Opérateur ligne 500ml"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Service *</label>
                    <select
                      name="service" value={form.service} onChange={handleChange}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                    >
                      {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Téléphone</label>
                    <input
                      type="text" name="telephone" value={form.telephone} onChange={handleChange}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Salaire de base (DJF) *</label>
                    <input
                      type="number" step="0.01" min="0" name="salaire_base" value={form.salaire_base}
                      onChange={handleChange} required
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Date d'embauche</label>
                    <input
                      type="date" name="date_embauche" value={form.date_embauche} onChange={handleChange}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                {form.id && (
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Statut</label>
                    <div className="flex gap-1 bg-slate-50 border border-slate-200 p-1 rounded-xl w-fit">
                      {['Actif', 'Inactif'].map(s => (
                        <button
                          key={s} type="button"
                          onClick={() => setForm(prev => ({ ...prev, statut: s }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            form.statut === s ? 'bg-orange-500 text-white' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Notes</label>
                  <textarea
                    name="notes" value={form.notes} onChange={handleChange} rows={2}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <button
                  type="submit" disabled={saving}
                  className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving ? <><Loader2 size={16} className="animate-spin" />Enregistrement...</> : 'Enregistrer'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}