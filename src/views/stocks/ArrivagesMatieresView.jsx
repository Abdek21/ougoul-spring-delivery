import { useEffect, useState } from 'react'
import { Plus, X, Loader2, AlertTriangle, Package } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { enregistrerArrivageMP } from '../../lib/matieresPremieres'

// AJOUT : module extrait de LivraisonsView.jsx (onglet "Matières premières")
// à la demande de Kassim — ne doit plus être un onglet imbriqué dans
// Livraisons. Gère uniquement les ENTRÉES fournisseur (Entree_fournisseur).
// À distinguer de MatieresPremieresComptableView.jsx (comptable), qui gère
// les SORTIES production (Sortie_production, ce que Hamza donne à Said) —
// même table `mouvements_matieres_premieres`, rôles et actions différents.
export default function ArrivagesMatieresView() {
  const { user } = useAuth()
  const [mouvementsMP, setMouvementsMP]           = useState([])
  const [matieresPremieres, setMatieresPremieres] = useState([])
  const [categorieMPActive, setCategorieMPActive] = useState(null)
  const [loading, setLoading]                     = useState(true)

  const [showArrivageForm, setShowArrivageForm]   = useState(false)
  const [matiereArrivage, setMatiereArrivage]     = useState('')
  const [quantiteArrivage, setQuantiteArrivage]   = useState('')
  const [noteArrivage, setNoteArrivage]           = useState('')
  const [arrivageSaving, setArrivageSaving]       = useState(false)
  const [arrivageErreur, setArrivageErreur]       = useState(null)

  useEffect(() => {
    fetchAll()
    const channel = supabase.channel('arrivages-mp-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mouvements_matieres_premieres' }, fetchMouvementsMP)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchAll() {
    await Promise.all([fetchMouvementsMP(), fetchMatieresPremieres()])
    setLoading(false)
  }

  async function fetchMouvementsMP() {
    const { data } = await supabase.from('v_mouvements_mp_chrono').select('*')
    setMouvementsMP(data || [])
    if (data && data.length > 0 && !categorieMPActive) setCategorieMPActive(data[0].categorie)
  }

  async function fetchMatieresPremieres() {
    const { data } = await supabase
      .from('matieres_premieres')
      .select('id, designation, categorie, unite, conditionnement')
      .eq('actif', true)
      .order('designation')
    setMatieresPremieres(data || [])
  }

  async function handleNouvelArrivage(e) {
    e.preventDefault()
    setArrivageErreur(null)
    if (!matiereArrivage) return setArrivageErreur('Sélectionne une matière première.')
    if (!quantiteArrivage || parseInt(quantiteArrivage) <= 0) return setArrivageErreur('La quantité doit être positive.')

    setArrivageSaving(true)
    try {
      await enregistrerArrivageMP({
        matiereId: matiereArrivage, quantite: parseInt(quantiteArrivage),
        note: noteArrivage || 'Nouvel arrivage', creePar: user.id,
      })
      setShowArrivageForm(false)
      setMatiereArrivage('')
      setQuantiteArrivage('')
      setNoteArrivage('')
      await fetchMouvementsMP()
    } catch (err) {
      setArrivageErreur(`Erreur : ${err.message}`)
    } finally {
      setArrivageSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package size={22} className="text-orange-500" /> Arrivages des matières
          </h1>
          <p className="text-slate-500 text-sm mt-1">Réceptions fournisseur — préformes, bouchons, étiquettes, films...</p>
        </div>
        <button onClick={() => { setArrivageErreur(null); setShowArrivageForm(true) }}
          className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors shadow-sm">
          <Plus size={18} /> Nouvel arrivage
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {[...new Set(mouvementsMP.map(m => m.categorie))].map(cat => (
          <button key={cat} onClick={() => setCategorieMPActive(cat)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              categorieMPActive === cat ? 'bg-orange-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-orange-300'
            }`}>
            {cat.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        {mouvementsMP.filter(m => m.categorie === categorieMPActive).length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">Aucun mouvement pour cette matière</div>
        ) : (
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                {['Date', 'Désignation', 'Unité', 'Entrée', 'Sortie', 'Stock'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {mouvementsMP.filter(m => m.categorie === categorieMPActive).map(m => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-700">{new Date(m.date_mouvement).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">
                    {m.designation}
                    {m.conditionnement && <span className="text-xs text-slate-400 ml-1.5">({m.conditionnement})</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{m.unite}</td>
                  <td className="px-4 py-3 text-sm text-green-600 font-medium">{m.quantite_entree > 0 ? m.quantite_entree.toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 text-sm text-red-500 font-medium">{m.quantite_sortie > 0 ? m.quantite_sortie.toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-900">{m.stock_cumule.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showArrivageForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowArrivageForm(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl z-10 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Nouvel arrivage</h2>
              <button onClick={() => setShowArrivageForm(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleNouvelArrivage} className="p-6 space-y-4">
              {arrivageErreur && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                  <p className="text-red-600 text-sm">{arrivageErreur}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Matière première *</label>
                <select value={matiereArrivage} onChange={e => setMatiereArrivage(e.target.value)} required
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="">— Sélectionner —</option>
                  {matieresPremieres.map(mp => (
                    <option key={mp.id} value={mp.id}>
                      {mp.designation} {mp.conditionnement ? `(${mp.conditionnement})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Quantité reçue *</label>
                <input type="number" min="1" value={quantiteArrivage} required
                  onChange={e => setQuantiteArrivage(e.target.value)}
                  placeholder="Ex : 50"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Note (optionnel)</label>
                <input type="text" value={noteArrivage} onChange={e => setNoteArrivage(e.target.value)}
                  placeholder="Ex : Livraison fournisseur du 05/07"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>

              <button type="submit" disabled={arrivageSaving}
                className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {arrivageSaving ? <Loader2 size={15} className="animate-spin" /> : null}
                Enregistrer l'arrivage
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
