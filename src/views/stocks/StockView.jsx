import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Package, AlertTriangle, RefreshCw, TrendingUp, X, Loader2, Plus,
  Truck, Edit3, Trash2, ArrowRight
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'

// CORRIGÉ (mois en cours, sans passer par toISOString()) : Djibouti est
// UTC+3, un aller-retour par l'UTC peut faire glisser d'un jour près des
// bornes de mois — même piège déjà corrigé ailleurs (commandesView/helpers.js,
// FermetureCompteView.jsx, ProductionsComptableView.jsx). Ces 2 helpers
// restent en accesseurs locaux du début à la fin.
function moisActuelISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function premierJourMoisSuivantISO(moisAAAAMM) {
  const [annee, mois] = moisAAAAMM.split('-').map(Number)
  const d = new Date(annee, mois, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// REFONTE (changement d'architecture demandé par l'utilisateur) : "Stock
// usine" et "Stock dépôt (vendable)" ne représentent plus un stock réel
// décrémenté par les livraisons — ce sont désormais 2 compteurs
// indépendants qui cumulent le mois en cours et repartent de 0 au mois
// suivant (recalculés par filtre de mois, jamais remis à zéro
// manuellement) :
//   - Stock usine = somme brute de productions.quantite_bouteilles_ok du
//     mois (toute la production compte dès sa saisie, y compris celle du
//     jour même — plus de délai de 24h, la carte "Fabrication du jour" a
//     été retirée).
//   - Stock dépôt (vendable) = somme de sorties_usine.quantite_palettes
//     du mois (via la nouvelle colonne date_sortie, éditable — voir
//     scripts/lot42_sorties_usine_date_et_suppression.sql). Totalement
//     découplé des livraisons : confirmer une livraison ne touche plus ce
//     chiffre.
// Volontairement INDÉPENDANT de calculerStockUsine()/calculer_stock_usine()/
// v_stock_disponible (src/lib/stockUsine.js), qui restent inchangés — ces
// objets gardent l'ancienne sémantique (stock réel, décrémenté par les
// livraisons) pour leurs autres consommateurs : DashboardView.jsx (tuile
// stock d'accueil), ProductionsComptableView.jsx ("Disponible demain") et
// FermetureCompteView.jsx ("Quantité restante en stock" + surcouche
// stock_restant_manuel). Les réutiliser ici aurait fait dériver ces 3
// écrans silencieusement — diagnostic transmis et validé avec l'utilisateur
// avant cette refonte.
export default function StockView() {
  // AJOUT : sélecteur de mois pour les 2 compteurs + l'historique des
  // sorties usine ci-dessous — même pattern que ProductionsComptableView.jsx
  // (moisExport/moisExportAffiche) : ne fige pas le mois courant au montage,
  // moisSelection ne stocke qu'une sélection manuelle éventuelle.
  const [moisSelection, setMoisSelection] = useState(null)
  const moisAffiche = moisSelection || moisActuelISO()
  const [stockUsineMensuel, setStockUsineMensuel] = useState(0) // palettes
  const [stockDepotMensuel, setStockDepotMensuel] = useState(0) // palettes
  const [mouvements, setMouvements] = useState([])
  const [stockMP, setStockMP]       = useState([])
  const [sortiesUsine, setSortiesUsine] = useState([])
  const [savingId, setSavingId]         = useState(null)
  const [showNouvelleSortie, setShowNouvelleSortie]     = useState(false)
  const [formSortie, setFormSortie]     = useState({ quantite_palettes: '', note: '', date_sortie: new Date().toISOString().slice(0, 10) })
  const [sortieSaving, setSortieSaving] = useState(false)
  const [correctingSortie, setCorrectingSortie]         = useState(null)
  const [nouvPalettes, setNouvPalettes]                 = useState('')
  const [nouvelleDateSortie, setNouvelleDateSortie]     = useState('')
  const [noteCorrectionSortie, setNoteCorrectionSortie] = useState('')
  const [loading, setLoading]       = useState(true)
  const [onglet, setOnglet]         = useState('matieres_premieres')

  // AJOUT (item 5) : quantité du dernier arrivage par matière — sert à
  // alerter quand le stock descend sous la moitié de ce dernier arrivage,
  // en plus du seuil fixe existant (seuil_alerte)
  const [derniersArrivages, setDerniersArrivages] = useState({})

  useEffect(() => {
    fetchAll()
  }, [])

  // AJOUT : recalcule les 2 compteurs + l'historique des sorties usine à
  // chaque changement de mois — même pattern que ProductionsComptableView.jsx
  // (useEffect séparé sur moisExportAffiche).
  useEffect(() => {
    fetchStockUsineMensuel()
    fetchStockDepotMensuel()
    fetchSortiesUsine()
  }, [moisAffiche])

  useEffect(() => {
    // AJOUT (refonte) : sorties_usine et productions alimentent maintenant
    // directement les 2 cartes de cet écran (avant, seul `stocks` était
    // écouté — `productions` n'était pas suivi en direct ici puisque
    // "Stock usine" ne dépendait pas encore de cette table). Dépend de
    // moisAffiche pour que les callbacks ci-dessous referment sur le mois
    // actuellement sélectionné (sinon un changement de mois laisserait les
    // rafraîchissements temps réel pointer sur l'ancien mois).
    const channel = supabase.channel('stocks-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stocks' }, fetchMouvements)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mouvements_matieres_premieres' }, () => { fetchStockMP(); fetchDerniersArrivages() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sorties_usine' }, () => { fetchSortiesUsine(); fetchStockDepotMensuel() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productions' }, fetchStockUsineMensuel)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [moisAffiche])

  async function fetchAll() {
    await Promise.all([
      fetchStockUsineMensuel(), fetchStockDepotMensuel(), fetchMouvements(),
      fetchStockMP(), fetchSortiesUsine(), fetchDerniersArrivages(),
    ])
    setLoading(false)
  }

  // AJOUT (item 5) : pour chaque matière, la quantité du dernier arrivage
  // fournisseur (le plus récent mouvement Entree_fournisseur) — pas besoin
  // de nouvelle colonne, cette info existe déjà dans le journal des
  // mouvements
  async function fetchDerniersArrivages() {
    const { data } = await supabase
      .from('mouvements_matieres_premieres')
      .select('matiere_id, quantite_entree, cree_le')
      .eq('type_mouvement', 'Entree_fournisseur')
      .order('cree_le', { ascending: false })
    const map = {}
    ;(data || []).forEach(m => {
      if (!(m.matiere_id in map)) map[m.matiere_id] = m.quantite_entree
    })
    setDerniersArrivages(map)
  }

  // MODIFIÉ (cohérent avec le sélecteur de mois du circuit) : filtré sur
  // date_sortie du mois affiché, comme fetchProductions() dans
  // ProductionsComptableView.jsx — remplace la liste plate des 20
  // dernières sorties (toutes périodes confondues) par l'historique du
  // mois sélectionné, affiché sous un en-tête "Sorties usine — {mois}".
  async function fetchSortiesUsine() {
    const debut = `${moisAffiche}-01`
    const fin   = premierJourMoisSuivantISO(moisAffiche)
    const { data } = await supabase
      .from('sorties_usine')
      .select('*, profiles!sorties_usine_cree_par_fkey(nom_complet)')
      .gte('date_sortie', debut)
      .lt('date_sortie', fin)
      .order('date_sortie', { ascending: false })
      .order('cree_le', { ascending: false })
    setSortiesUsine(data || [])
  }

  // MODIFIÉ (2026-07-21, point 3 de l'audit Stock) : la création écrivait
  // avant dans `sorties_usine` puis `stocks` en 2 requêtes séparées — si
  // la 2e échouait après la 1re, on se retrouvait avec une sortie
  // enregistrée sans crédit dépôt correspondant. Délégué à la fonction
  // Postgres creer_sortie_usine() (scripts/lot7_stock_rpc_et_corrections.sql),
  // qui fait les 2 écritures dans une seule transaction : tout réussit ou
  // tout est annulé ensemble.
  // MODIFIÉ (refonte) : accepte désormais une date de sortie (comme le
  // formulaire "Nouvelle production", ProductionsComptableView.jsx) — voir
  // scripts/lot42_sorties_usine_date_et_suppression.sql pour la colonne
  // date_sortie et le paramètre p_date ajoutés à la RPC.
  async function creerSortieUsine(e) {
    e.preventDefault()
    const palettes = parseInt(formSortie.quantite_palettes) || 0
    if (palettes <= 0) return
    setSortieSaving(true)
    try {
      const { error } = await supabase.rpc('creer_sortie_usine', {
        p_palettes: palettes,
        p_note:     formSortie.note || null,
        p_date:     formSortie.date_sortie,
      })
      if (error) throw error

      setShowNouvelleSortie(false)
      setFormSortie({ quantite_palettes: '', note: '', date_sortie: new Date().toISOString().slice(0, 10) })
      await fetchSortiesUsine()
      await fetchStockDepotMensuel()
      await fetchMouvements()
    } catch (err) {
      alert(`Erreur : ${err.message}`)
    } finally {
      setSortieSaving(false)
    }
  }

  // MODIFIÉ (2026-07-21, point 3 + correctif bug n°2) : même principe
  // transactionnel que creerSortieUsine(). Délégué à corriger_sortie_usine(),
  // qui calcule le delta et écrit le Correction_admin signé côté base —
  // avant, le JS envoyait quantite_saisie en valeur absolue, et le
  // trigger set_quantite_bouteilles() recalculait toujours un
  // quantite_bouteilles positif, donc toute correction à la baisse
  // augmentait le stock affiché au lieu de le réduire.
  // MODIFIÉ (refonte) : accepte désormais une correction de date en plus
  // de la quantité (nouvelleDateSortie, pré-remplie à l'ouverture de la
  // modale avec la date actuelle de la sortie — voir ouvrirCorrection ci-
  // dessous et scripts/lot42_sorties_usine_date_et_suppression.sql).
  async function corrigerSortie(e) {
    e.preventDefault()
    if (!correctingSortie) return
    setSavingId(correctingSortie.id)
    try {
      const palettesFinal = parseInt(nouvPalettes) || correctingSortie.quantite_palettes

      const { error } = await supabase.rpc('corriger_sortie_usine', {
        p_sortie_id:          correctingSortie.id,
        p_nouvelles_palettes: palettesFinal,
        p_note_correction:    noteCorrectionSortie,
        p_nouvelle_date:      nouvelleDateSortie || null,
      })
      if (error) throw error

      setCorrectingSortie(null)
      setNoteCorrectionSortie('')
      await fetchSortiesUsine()
      await fetchStockDepotMensuel()
      await fetchMouvements()
    } catch (err) {
      alert(`Erreur : ${err.message}`)
    } finally {
      setSavingId(null)
    }
  }

  // AJOUT (refonte) : suppression définitive d'une sortie usine — via la
  // RPC supprimer_sortie_usine (scripts/lot42_...sql), qui retire aussi la
  // ligne `stocks` (Entree_production/Correction_admin) liée par
  // reference_id, pour que le Journal des mouvements reste cohérent.
  async function supprimerSortie(s) {
    if (!confirm(`Supprimer définitivement cette sortie usine du ${formatDate(s.date_sortie)} (${s.quantite_palettes} palette${s.quantite_palettes > 1 ? 's' : ''}) ?`)) return
    setSavingId(s.id)
    try {
      const { error } = await supabase.rpc('supprimer_sortie_usine', { p_sortie_id: s.id })
      if (error) throw error
      await fetchSortiesUsine()
      await fetchStockDepotMensuel()
      await fetchMouvements()
    } catch (err) {
      alert(`Erreur : ${err.message}`)
    } finally {
      setSavingId(null)
    }
  }

  function ouvrirCorrection(s) {
    setCorrectingSortie(s)
    setNouvPalettes(s.quantite_palettes)
    setNouvelleDateSortie(s.date_sortie)
  }

  // REFONTE : "Stock usine" = cumul brut de productions.quantite_bouteilles_ok
  // du mois AFFICHÉ (moisAffiche, sélecteur — plus systématiquement le mois
  // en cours), converti en palettes. Aucun délai — comptée dès sa saisie.
  // Ne diminue jamais au cours du mois, y compris lors d'une sortie usine —
  // c'est un compteur de production mensuelle, pas un stock résiduel. Se
  // remet à 0 au mois suivant par le simple effet du filtre de mois (rien
  // à réinitialiser manuellement).
  async function fetchStockUsineMensuel() {
    const debut = `${moisAffiche}-01`
    const fin   = premierJourMoisSuivantISO(moisAffiche)
    const { data } = await supabase
      .from('productions')
      .select('quantite_bouteilles_ok')
      .gte('date_production', debut)
      .lt('date_production', fin)
    const totalBouteilles = (data || []).reduce((s, p) => s + (p.quantite_bouteilles_ok || 0), 0)
    setStockUsineMensuel(totalBouteilles / 1080)
  }

  // REFONTE : "Stock dépôt (vendable)" = cumul de sorties_usine.quantite_palettes
  // du mois AFFICHÉ (via date_sortie, éditable). Totalement découplé des
  // livraisons — confirmer une livraison ne décrémente plus ce chiffre (voir
  // handle_commande_update, toujours actif côté base pour `stocks`/
  // v_stock_disponible, mais plus lu ici). Se remet à 0 au mois suivant par
  // le filtre de mois, comme "Stock usine" ci-dessus.
  async function fetchStockDepotMensuel() {
    const debut = `${moisAffiche}-01`
    const fin   = premierJourMoisSuivantISO(moisAffiche)
    const { data } = await supabase
      .from('sorties_usine')
      .select('quantite_palettes')
      .gte('date_sortie', debut)
      .lt('date_sortie', fin)
    const total = (data || []).reduce((s, so) => s + (so.quantite_palettes || 0), 0)
    setStockDepotMensuel(total)
  }

  async function fetchMouvements() {
    const { data } = await supabase
      .from('stocks')
      .select('*, profiles!stocks_cree_par_fkey(nom_complet)')
      .order('cree_le', { ascending: false })
      .limit(30)
    setMouvements(data || [])
  }

  async function fetchStockMP() {
    const { data } = await supabase.from('v_stock_matieres_premieres').select('*')
    setStockMP(data || [])
  }

  // AJOUT (item 5) : enrichit chaque matière avec son dernier arrivage et
  // l'alerte "sous la moitié du dernier arrivage" — en plus du seuil fixe
  // existant (alerte_stock_faible)
  const stockMPEnrichi = stockMP.map(m => {
    const dernierArrivage = derniersArrivages[m.id] ?? null
    const alerteMoitie = dernierArrivage > 0 && m.stock_actuel < dernierArrivage / 2
    return { ...m, dernierArrivage, alerteMoitie }
  })
  const alertesMP = stockMPEnrichi.filter(m => m.alerte_stock_faible || m.alerteMoitie)

  // AJOUT : libellé du mois affiché — partagé entre l'en-tête du circuit et
  // l'en-tête de section de l'historique des sorties usine, pour rester
  // visuellement cohérent (même mois affiché aux deux endroits).
  const libelleMoisAffiche = new Date(moisAffiche + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">

      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stocks & Dépôt</h1>
          <p className="text-slate-500 text-sm mt-1">Suivi en temps réel — Bouteilles 500ml</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <p className="font-semibold text-slate-900">Circuit de production → dépôt</p>
          {/* MODIFIÉ (AJOUT) : sélecteur de mois — remplace l'affichage
              statique du mois en cours. Recalcule les 2 compteurs et
              l'historique des sorties usine ci-dessous pour le mois
              choisi (même mois, voir moisAffiche). */}
          <input type="month" value={moisAffiche} onChange={e => setMoisSelection(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>

        {/* REFONTE : 2 compteurs mensuels (cumulatifs, remis à 0 chaque
            mois) — plus de carte "Fabrication du jour" ni de bandeau
            rupture/faible/normal (ce dernier mesurait un stock réel
            décrémenté par les livraisons, notion qui n'existe plus ici). */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl p-4 border bg-amber-50 border-amber-200">
            <p className="text-xs font-semibold text-amber-700 mb-1">📦 Stock usine</p>
            <p className="text-2xl font-bold text-amber-800">{Math.round(stockUsineMensuel * 10) / 10}</p>
            <p className="text-xs text-amber-600 mt-1">palettes produites</p>
          </div>
          <div className="rounded-xl p-4 border bg-emerald-50 border-emerald-200">
            <p className="text-xs font-semibold text-emerald-700 mb-1">✅ Stock dépôt (vendable)</p>
            <p className="text-2xl font-bold text-emerald-800">{stockDepotMensuel}</p>
            <p className="text-xs text-emerald-600 mt-1">{(stockDepotMensuel * 45).toLocaleString()} cartons · sortis</p>
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-6 border-t border-slate-100 pt-3">
          Circuit : "Fabrication" → cumul mensuel dans "Stock usine" →
          Kassim saisit une sortie usine avec une date → cumul mensuel dans "Stock dépôt" (vendable).
          Les 2 compteurs repartent de 0 au mois suivant et ne sont plus affectés par les livraisons.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 mb-5 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { key: 'sorties_usine',      label: '🚚 Sorties Usine' },
          { key: 'matieres_premieres', label: '📦 Matières Premières' },
          { key: 'journal',            label: '📋 Journal' },
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

      {/* ── Onglet Sorties Usine ── */}
      {onglet === 'sorties_usine' && (
        <div className="space-y-3">
          <button onClick={() => setShowNouvelleSortie(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors shadow-sm">
            <Plus size={18} /> Nouvelle sortie usine
          </button>

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-xs text-blue-700">
              ℹ️ Chaque sortie enregistrée ici s'ajoute au cumul du mois pour le stock dépôt (vendable).
            </p>
          </div>

          {/* AJOUT : en-tête de section par mois — remplace la liste plate
              continue (avant, les 20 dernières sorties toutes périodes
              confondues) par l'historique du mois sélectionné ci-dessus
              (moisAffiche), le plus récent en premier au sein du mois. */}
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-2">
            Sorties usine — {libelleMoisAffiche}
          </p>

          {sortiesUsine.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck size={28} className="text-green-500" />
              </div>
              <p className="font-semibold text-slate-700">Aucune sortie enregistrée pour {libelleMoisAffiche}</p>
            </div>
          ) : (
            sortiesUsine.map(s => (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Truck size={20} className="text-blue-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        {s.quantite_palettes} palette{s.quantite_palettes > 1 ? 's' : ''}
                        {s.statut === 'Corrigee' && (
                          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium align-middle">Corrigée</span>
                        )}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-slate-400">👤 {s.profiles?.nom_complet}</span>
                        <span className="text-xs text-slate-300">·</span>
                        <span className="text-xs text-slate-400">📅 {formatDate(s.date_sortie)}</span>
                      </div>
                      {s.note && (
                        <p className="text-xs text-slate-500 mt-1.5 bg-slate-50 px-3 py-1.5 rounded-lg">"{s.note}"</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => ouvrirCorrection(s)}
                      className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
                      <Edit3 size={14} /> Corriger
                    </button>
                    {/* AJOUT (refonte, point 6) : suppression, absente jusqu'ici */}
                    <button onClick={() => supprimerSortie(s)} disabled={savingId === s.id}
                      className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-60">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Modal nouvelle sortie usine ── */}
      {showNouvelleSortie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowNouvelleSortie(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl z-10 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Nouvelle sortie usine</h2>
              <button onClick={() => setShowNouvelleSortie(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={creerSortieUsine} className="p-6 space-y-4">
              {/* AJOUT (refonte, point 6) : date de sortie, même pattern que
                  le formulaire "Nouvelle production" (ProductionsComptableView.jsx) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Date de sortie</label>
                <input type="date" value={formSortie.date_sortie} max={new Date().toISOString().slice(0, 10)} required
                  onChange={e => setFormSortie({ ...formSortie, date_sortie: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                <p className="text-xs text-slate-400 mt-1">Par défaut aujourd'hui — modifiable si la saisie est faite en retard.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Palettes</label>
                <input type="number" min="1" required value={formSortie.quantite_palettes}
                  onChange={e => setFormSortie({ ...formSortie, quantite_palettes: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Note (optionnel)</label>
                <input type="text" value={formSortie.note}
                  onChange={e => setFormSortie({ ...formSortie, note: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <button type="submit" disabled={sortieSaving}
                className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {sortieSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                Enregistrer
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Onglet Matières Premières ── */}
      {onglet === 'matieres_premieres' && (
        <div>
          {/* MODIFIÉ (item 8) : consolidation en un seul point d'accès —
              la saisie d'un arrivage se fait désormais uniquement depuis
              Livraisons (onglet Matières premières), cette page reste un
              état des lieux en lecture seule + alertes */}
          <Link to="/arrivages-matieres"
            className="mb-4 inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
            Saisir un arrivage <ArrowRight size={15} />
          </Link>

          {alertesMP.length > 0 && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-red-500" />
                <p className="text-sm font-semibold text-red-700">Stock matières premières faible</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {alertesMP.map(m => (
                  <span key={m.id} className="text-xs bg-white border border-red-200 text-red-600 px-2.5 py-1 rounded-full">
                    {m.designation} : {m.stock_actuel} {m.unite}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-50">
              {stockMPEnrichi.map(m => {
                const enAlerte = m.alerte_stock_faible || m.alerteMoitie
                return (
                  <div key={m.id} className={`flex items-center gap-4 px-6 py-3.5 ${enAlerte ? 'bg-red-50/50' : ''}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      enAlerte ? 'bg-red-50' : 'bg-blue-50'
                    }`}>
                      <Package size={16} className={enAlerte ? 'text-red-500' : 'text-blue-500'} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{m.designation}</p>
                      <p className="text-xs text-slate-400">
                        Seuil alerte : {m.seuil_alerte} {m.unite}
                        {m.conditionnement && ` · ${m.conditionnement}`}
                      </p>
                      {/* AJOUT (item 5) : motif affiché quand le stock passe sous
                          la moitié du dernier arrivage commandé */}
                      {m.alerteMoitie && (
                        <p className="text-xs text-red-600 font-medium mt-0.5">
                          Sous la moitié du dernier arrivage ({m.dernierArrivage} {m.unite} → alerte sous {Math.floor(m.dernierArrivage / 2)})
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${enAlerte ? 'text-red-600' : 'text-slate-900'}`}>
                        {m.stock_actuel.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-400">{m.unite}</p>
                    </div>
                    {enAlerte && <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Onglet Journal ── */}
      {onglet === 'journal' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Journal des mouvements</h2>
            <button onClick={fetchMouvements}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors">
              <RefreshCw size={14} /> Actualiser
            </button>
          </div>

          {mouvements.length === 0 ? (
            <div className="py-12 text-center">
              <TrendingUp size={30} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Aucun mouvement enregistré</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {mouvements.map(m => {
                // MODIFIÉ : basé sur le signe réel de quantite_bouteilles,
                // pas sur le nom du type — une Correction_admin peut être
                // négative (ex: correction à la baisse d'une sortie usine),
                // l'ancien test (tout sauf Sortie_livraison = "+") affichait
                // alors un double signe incohérent ("+-1 080 btl").
                const estEntree = (m.quantite_bouteilles || 0) >= 0
                const labelType = {
                  Entree_production: 'Entrée production',
                  Sortie_livraison:  'Sortie livraison',
                  Correction_admin:  'Correction admin',
                  Inventaire:        'Inventaire',
                }[m.type_mouvement] || m.type_mouvement

                return (
                  <div key={m.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                      estEntree ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                    }`}>
                      {estEntree ? '+' : '-'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">{labelType}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          m.statut === 'Validee'    ? 'bg-green-100 text-green-700' :
                          m.statut === 'En_attente' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>{m.statut}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {m.profiles?.nom_complet} · {formatDate(m.cree_le)}
                      </p>
                      {m.note && <p className="text-xs text-slate-400 italic mt-1">{m.note}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold ${estEntree ? 'text-green-600' : 'text-red-500'}`}>
                        {estEntree ? '+' : ''}{m.quantite_bouteilles?.toLocaleString()} btl
                      </p>
                      <p className="text-xs text-slate-400">{Math.round((m.quantite_bouteilles || 0) / 1080 * 10) / 10} palettes</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modal correction sortie usine ── */}
      {correctingSortie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setCorrectingSortie(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl z-10 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Corriger la sortie</h2>
              <button onClick={() => setCorrectingSortie(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-5">
                Saisie originale : <span className="font-medium text-slate-800">
                  {correctingSortie.quantite_palettes} palette{correctingSortie.quantite_palettes > 1 ? 's' : ''}
                </span>
              </p>
              <form onSubmit={corrigerSortie} className="space-y-4">
                {/* AJOUT (refonte, point 6) : la date est désormais aussi
                    modifiable, pas seulement la quantité */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Date de sortie</label>
                  <input type="date" value={nouvelleDateSortie} max={new Date().toISOString().slice(0, 10)}
                    onChange={e => setNouvelleDateSortie(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Palettes</label>
                  <input type="number" min="1" value={nouvPalettes}
                    onChange={e => setNouvPalettes(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Raison de la correction *</label>
                  <input type="text" value={noteCorrectionSortie} required
                    onChange={e => setNoteCorrectionSortie(e.target.value)}
                    placeholder="Ex : Erreur de comptage..."
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={savingId === correctingSortie.id}
                    className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors disabled:opacity-60">
                    Confirmer la correction
                  </button>
                  <button type="button" onClick={() => setCorrectingSortie(null)}
                    className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors">
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal réception matières premières ── */}
    </div>
  )
}