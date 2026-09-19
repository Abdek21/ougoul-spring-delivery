import { useEffect, useState } from 'react'
import { CheckCircle, Download, FileText, Loader2, RefreshCw, X, Edit3, Check, Trash2, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDate, formatCurrency } from '../../lib/utils'
import { exportHistoriqueLivraisonsExcel } from '../../lib/export'
import { genererBonLivraison, genererBLSpecial } from '../../lib/pdf'
import { aUneChainePartielle, resoudreEtapesAccords, genererBonLivraisonAccord } from '../../lib/livraisonsPartielles'

const TYPE_CLIENT_COLORS = {
  Distributeur: 'bg-purple-100 text-purple-700',
  Entreprise:   'bg-orange-100 text-orange-700',
  Particulier:  'bg-blue-100 text-blue-700',
}

const STATUTS_LIVREE = ['Livree', 'Facture_et_livree', 'Payee', 'Facture_acquittee', 'Livree_creance_active']

function moisActuel() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function libelleMois(mois) {
  const [annee, m] = mois.split('-').map(Number)
  return new Date(annee, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

// Mois effectif d'une commande = même date que celle affichée dans le
// tabau (date_effective en priorité, sinon date_livraison, sinon cree_le).
// Ces valeurs sont des chaines ISO ("YYYY-MM-DD..."), donc un simple
// slice évite toute conversion via Date/toISOString — qui décale la date
// d'un jour selon le fuseau horaire du navigateur.
function moisEffectif(cmd) {
  const date = cmd.livraisons?.[0]?.date_effective || cmd.date_livraison || cmd.cree_le
  return date ? date.slice(0, 7) : null
}

function totauxLigne(cmd) {
  let palettes = 0, cartons = 0
  ;(cmd.commandes_lignes || []).forEach(l => {
    if (l.unite === 'Palette') palettes += Number(l.quantite)
    if (l.unite === 'Carton')  cartons  += Number(l.quantite)
  })
  return { palettes, cartons }
}

// AJOUT (retour Kassim, 2026-07-28) : les ventes Comptant sans ligne
// dans "livraisons" (retrait direct au comptoir, aucun chauffeur/
// véhicule impliqué) n'ont jamais transité par la logistique — elles
// gonflaient les totaux de cette page et affichaient un chauffeur vide
// sans que ce soit une vraie erreur de saisie. Distinguées visuellement
// (badge + filtre dédié) plutôt que retirées, pour ne pas perdre la
// visibilité sur ces ventes si besoin.
function estRetraitSurPlace(cmd) {
  return cmd.cas_vente === 'Comptant' && (!cmd.livraisons || cmd.livraisons.length === 0)
}

export default function HistoriqueLivraisonsView() {
  const { role } = useAuth()
  // AJOUT : suppression d'une ligne d'historique — admin OU logistique
  // (élargi à la demande de l'utilisateur) — action irréversible qui
  // revient sur une confirmation déjà faite ET compense un mouvement de
  // stock déjà inscrit, voir demanderSuppression/confirmerSuppression
  // ci-dessous et scripts/lot43_...sql (même rôle vérifié côté RPC).
  const peutSupprimer = role === 'admin' || role === 'logistique'
  const [mois, setMois]           = useState(moisActuel())
  const [recherche, setRecherche] = useState('')
  const [typeFiltre, setTypeFiltre] = useState('tous') // 'tous' | 'livraisons' | 'retrait'
  const [historique, setHistorique] = useState([])
  const [loading, setLoading]     = useState(true)

  // AJOUT (demande Kassim) : même fonctionnalité "BL spécial" que
  // CommandesView.jsx — c'est ici, dans l'historique, que les chaînes de
  // livraisons partielles sont réellement consultables côté logistique
  // (contrairement à "À planifier" qui ne montre que la file d'attente
  // immédiate). Liste dédiée et non filtrée par statut, car reconstruire
  // une chaîne demande de voir aussi les maillons encore En_preparation.
  const [commandesChaine, setCommandesChaine] = useState([])
  const [chainePartielle, setChainePartielle] = useState(null)
  const [blSpecialSaving, setBlSpecialSaving] = useState(false)

  // AJOUT (demande Kassim) : correction de date_effective directement
  // depuis l'historique, en cas d'erreur de saisie du chauffeur — édition
  // limitée à la cellule Date (pas la ligne entière), sur `livraisons`
  // (la commande n'a pas de date_effective propre).
  const [editingLivraisonId, setEditingLivraisonId] = useState(null)
  const [dateDraft, setDateDraft]                   = useState('')
  const [savingDate, setSavingDate]                 = useState(false)

  // AJOUT : suppression d'une ligne d'historique (annulation complète de
  // la confirmation — voir scripts/lot43_annuler_confirmation_livraison.sql)
  const [livraisonASupprimer, setLivraisonASupprimer] = useState(null) // { id, numero_facture, nom_entreprise }
  const [suppressionEnCours, setSuppressionEnCours]   = useState(false)
  const [successMsg, setSuccessMsg]                   = useState(null)
  const [erreurMsg, setErreurMsg]                     = useState(null)

  // MODIFIÉ : on récupère tout l'historique livré une seule fois (pas de
  // filtre SQL sur date_livraison — ce champ peut être vide sur d'anciennes
  // commandes, ce qui les excluait silencieusement) puis on filtre par mois
  // côté client sur la même date que celle affichée. Le changement de mois
  // est donc aussi instantané, sans aller-retour réseau.
  useEffect(() => { fetchHistorique(); fetchCommandesChaine() }, [])

  async function fetchCommandesChaine() {
    const { data } = await supabase
      .from('commandes')
      .select('id, client_id, commande_parent_id, numero_facture, statut, date_livraison, date_paiement, date_planification, cree_le, clients(nom_entreprise, type_client, telephone), commandes_lignes(unite, quantite)')
    setCommandesChaine(data || [])
  }

  // CORRIGÉ (2026-08, bug "quantités incorrectes" BL spécial) — voir
  // même correctif dans useLivraisonsView.js : resoudreEtapesAccords()
  // s'appuie sur accords_commande (comme le Bon de commande) au lieu de
  // reconstruire "commandé/livré" depuis le statut physique de chaque
  // maillon technique, qui affichait la quantité en aval au lieu de la
  // quantité réellement accordée à chaque étape.
  async function ouvrirHistoriquePartiel(cmd) {
    setChainePartielle(await resoudreEtapesAccords(cmd))
  }

  function ouvrirEditionDate(liv) {
    setEditingLivraisonId(liv.id)
    setDateDraft((liv.date_effective || '').slice(0, 10))
  }

  function annulerEditionDate() {
    setEditingLivraisonId(null)
    setDateDraft('')
  }

  async function sauvegarderDateEffective(livId) {
    if (!dateDraft) return
    setSavingDate(true)
    await supabase.from('livraisons').update({ date_effective: dateDraft }).eq('id', livId)
    await fetchHistorique()
    setSavingDate(false)
    setEditingLivraisonId(null)
  }

  // AJOUT : ouvre la confirmation — jamais d'appel direct au clic, cf.
  // "Action irréversible" (annule la confirmation ET compense le stock).
  function demanderSuppression(liv, cmd) {
    setErreurMsg(null)
    setLivraisonASupprimer({
      id: liv.id,
      numero_facture: cmd.numero_facture,
      nom_entreprise: cmd.clients?.nom_entreprise,
    })
  }

  // AJOUT : délègue entièrement à la RPC annuler_confirmation_livraison
  // (scripts/lot43_...sql) — celle-ci vérifie le rôle, bloque si des
  // paiements/pertes existent, compense le stock et remet la commande à
  // son état d'avant confirmation, dans une seule transaction.
  async function confirmerSuppression() {
    if (!livraisonASupprimer) return
    setSuppressionEnCours(true)
    try {
      const { error } = await supabase.rpc('annuler_confirmation_livraison', {
        p_livraison_id: livraisonASupprimer.id,
      })
      if (error) throw error
      setLivraisonASupprimer(null)
      setSuccessMsg('Livraison supprimée — commande remise en préparation, stock compensé.')
      await fetchHistorique()
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err) {
      setLivraisonASupprimer(null)
      setErreurMsg(`Impossible de supprimer : ${err.message}`)
    } finally {
      setSuppressionEnCours(false)
    }
  }

  async function handleGenererBLSpecial() {
    if (!chainePartielle) return
    setBlSpecialSaving(true)
    try {
      await genererBLSpecial(chainePartielle)
    } finally {
      setBlSpecialSaving(false)
    }
  }

  async function fetchHistorique() {
    setLoading(true)
    const { data } = await supabase
      .from('commandes')
      .select(`
        id, numero_facture, montant_total, cas_vente, statut, date_livraison, cree_le,
        clients(nom_entreprise, type_client),
        commandes_lignes(unite, quantite),
        livraisons(id, date_effective, chauffeurs(nom_complet), vehicules(immatriculation))
      `)
      .in('statut', STATUTS_LIVREE)
      .order('date_livraison', { ascending: false, nullsFirst: false })
      .limit(5000)

    // Trié côté client sur la même clé que celle affichée (date_effective
    // en priorité) — voir LivraisonsView pour le même correctif.
    const trie = (data || []).slice().sort((a, b) => {
      const dateA = a.livraisons?.[0]?.date_effective || a.date_livraison || a.cree_le
      const dateB = b.livraisons?.[0]?.date_effective || b.date_livraison || b.cree_le
      return new Date(dateB) - new Date(dateA)
    })
    setHistorique(trie)
    setLoading(false)
  }

  const filtre = historique.filter(cmd => {
    if (moisEffectif(cmd) !== mois) return false
    if (typeFiltre === 'livraisons' && estRetraitSurPlace(cmd)) return false
    if (typeFiltre === 'retrait' && !estRetraitSurPlace(cmd)) return false
    if (!recherche) return true
    const q = recherche.toLowerCase()
    const chauffeurNom = cmd.livraisons?.[0]?.chauffeurs?.nom_complet || ''
    return (
      cmd.clients?.nom_entreprise?.toLowerCase().includes(q) ||
      cmd.numero_facture?.toLowerCase().includes(q) ||
      chauffeurNom.toLowerCase().includes(q)
    )
  })

  const nbRetraitSurPlace = filtre.filter(estRetraitSurPlace).length

  const totaux = filtre.reduce((acc, cmd) => {
    const { palettes, cartons } = totauxLigne(cmd)
    acc.palettes += palettes
    acc.cartons  += cartons
    acc.montant  += Number(cmd.montant_total)
    return acc
  }, { palettes: 0, cartons: 0, montant: 0 })

  // Recharge la commande complete avant impression — l'historique n'a que
  // des donnees partielles (voir requete de fetchHistorique)
  async function genererBonLivraisonDepuisHistorique(cmdPartielle) {
    const { data: commande } = await supabase
      .from('commandes')
      .select('*, clients(nom_entreprise, type_client, telephone, adresse), commandes_lignes(*)')
      .eq('id', cmdPartielle.id)
      .single()
    if (!commande) return

    const { data: reste } = await supabase
      .from('commandes')
      .select('commandes_lignes(*)')
      .eq('commande_parent_id', commande.id)
      .maybeSingle()

    const lignesEnrichies = (commande.commandes_lignes || []).map(l => {
      const ligneReste = reste?.commandes_lignes?.find(r => r.unite === l.unite)
      return { ...l, quantite_demandee: Number(l.quantite) + Number(ligneReste?.quantite || 0) }
    })

    genererBonLivraison({ ...commande, commandes_lignes: lignesEnrichies }, cmdPartielle.livraisons?.[0]?.date_effective, {
      chauffeurNom: cmdPartielle.livraisons?.[0]?.chauffeurs?.nom_complet,
      vehiculeImmat: cmdPartielle.livraisons?.[0]?.vehicules?.immatriculation,
    })
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Historique des livraisons</h1>
          <p className="text-slate-500 text-sm mt-1">
            {libelleMois(mois)} — {filtre.length} livraison{filtre.length > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportHistoriqueLivraisonsExcel(filtre, libelleMois(mois))}
            disabled={filtre.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Download size={16} /> Export Excel
          </button>
          <button onClick={fetchHistorique}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
            <RefreshCw size={15} /> Actualiser
          </button>
        </div>
      </div>

      {/* AJOUT : feedback suppression — même pattern que ClientsView.jsx */}
      {successMsg && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium">
          ✅ {successMsg}
        </div>
      )}
      {erreurMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><AlertTriangle size={16} className="flex-shrink-0" /> {erreurMsg}</span>
          <button onClick={() => setErreurMsg(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        {[
          { label: 'Livraisons',  value: filtre.length,                       color: 'text-slate-900' },
          { label: 'Palettes',    value: totaux.palettes,                     color: 'text-orange-600' },
          { label: 'Cartons',     value: totaux.cartons,                      color: 'text-orange-600' },
          { label: 'Montant',     value: formatCurrency(totaux.montant),      color: 'text-green-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <p className="text-sm text-slate-500 mb-2">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>
      {typeFiltre === 'tous' && nbRetraitSurPlace > 0 && (
        <p className="text-xs text-slate-400 mb-4">
          dont <span className="font-semibold text-amber-600">{nbRetraitSurPlace}</span> retrait{nbRetraitSurPlace > 1 ? 's' : ''} sur place (Comptant, aucune livraison camion) — totaux ci-dessus inclus, filtrer sur "Livraisons camion" pour les exclure
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-xl">
          {[
            { v: 'tous',       label: 'Toutes' },
            { v: 'livraisons', label: 'Livraisons camion' },
            { v: 'retrait',    label: 'Retrait sur place' },
          ].map(opt => (
            <button
              key={opt.v} onClick={() => setTypeFiltre(opt.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                typeFiltre === opt.v ? 'bg-orange-500 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input
          type="month"
          value={mois}
          onChange={e => setMois(e.target.value)}
          className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <input
          type="text"
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          placeholder="Rechercher par client, facture, chauffeur..."
          className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-orange-500" size={28} />
        </div>
      ) : filtre.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
          <CheckCircle size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Aucune livraison trouvée pour {libelleMois(mois)}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                {['Date', 'Client', 'Type', 'Facture', 'Cas vente', 'Palettes', 'Cartons', 'Chauffeur', 'Montant', 'BL'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtre.map(cmd => {
                const liv = cmd.livraisons?.[0]
                const { palettes, cartons } = totauxLigne(cmd)
                const retraitSurPlace = estRetraitSurPlace(cmd)
                return (
                  <tr key={cmd.id} className={`transition-colors ${retraitSurPlace ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-slate-50'}`}>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {editingLivraisonId === liv?.id ? (
                        <div className="flex items-center gap-1">
                          <input type="date" value={dateDraft}
                            onChange={e => setDateDraft(e.target.value)}
                            className="px-2 py-1 border border-orange-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-400" />
                          <button onClick={() => sauvegarderDateEffective(liv.id)} disabled={savingDate}
                            className="w-6 h-6 flex items-center justify-center bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-60">
                            {savingDate ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                          </button>
                          <button onClick={annulerEditionDate}
                            className="w-6 h-6 flex items-center justify-center border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 transition-colors">
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {formatDate(liv?.date_effective || cmd.date_livraison || cmd.cree_le)}
                          {liv?.id && (
                            <button onClick={() => ouvrirEditionDate(liv)}
                              title="Corriger la date"
                              className="text-slate-300 hover:text-orange-500 transition-colors">
                              <Edit3 size={11} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{cmd.clients?.nom_entreprise || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_CLIENT_COLORS[cmd.clients?.type_client]}`}>
                        {cmd.clients?.type_client}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-orange-600">
                      {cmd.numero_facture || '—'}
                      {aUneChainePartielle(cmd, commandesChaine) && (
                        <button onClick={() => ouvrirHistoriquePartiel(cmd)}
                          className="block mt-1 text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors">
                          🔀 Partielle
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{cmd.cas_vente}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{palettes || '—'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{cartons || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {liv?.chauffeurs?.nom_complet || (
                        retraitSurPlace
                          ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">🏪 Retrait sur place</span>
                          : '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-900">{formatCurrency(cmd.montant_total)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => genererBonLivraisonDepuisHistorique(cmd)}
                          className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-xs hover:bg-slate-100 transition-colors">
                          <FileText size={12} /> BL
                        </button>
                        {/* AJOUT : suppression — admin uniquement, absente
                            pour un retrait sur place (aucune ligne livraisons) */}
                        {peutSupprimer && liv?.id && (
                          <button onClick={() => demanderSuppression(liv, cmd)}
                            title="Supprimer cette livraison"
                            className="flex items-center gap-1 px-2.5 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs hover:bg-red-50 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* AJOUT (demande Kassim) : modal historique + BL spécial — même
          composant que CommandesView.jsx/LivraisonsView.jsx */}
      {chainePartielle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setChainePartielle(null)} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl z-10 overflow-hidden max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  🔀 Historique des livraisons partielles
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Commande d'origine {chainePartielle[0]?.commande.numero_facture} — {chainePartielle[0]?.commande.clients?.nom_entreprise}
                </p>
              </div>
              <button onClick={() => setChainePartielle(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-50 bg-slate-50/50">
                        {['Étape', 'Date', 'Commandé', 'Livré', 'Restant', 'Statut', ''].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-slate-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {chainePartielle.map((etape, i) => {
                        const fmtQte = q => [
                          q.palettes > 0 ? `${q.palettes} pal.` : null,
                          q.cartons > 0 ? `${q.cartons} cart.` : null,
                        ].filter(Boolean).join(' + ') || '—'
                        const estAccorde = etape.statut !== 'En attente'
                        const racine = chainePartielle[0]?.commande
                        return (
                          <tr key={etape.cleEtape ?? i}>
                            <td className="px-4 py-3">
                              <p className="text-sm font-semibold text-slate-900">Livraison {i + 1}</p>
                              {estAccorde && racine?.numero_facture && (
                                <p className="text-xs font-mono text-orange-600 mt-0.5">{racine.numero_facture}/{i + 1}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-400">{etape.dateLivraison ? formatDate(etape.dateLivraison) : '—'}</td>
                            <td className="px-4 py-3 text-xs text-slate-600">{fmtQte(etape.commandee)}</td>
                            <td className="px-4 py-3 text-xs text-slate-600">{fmtQte(etape.livree)}</td>
                            <td className="px-4 py-3 text-xs text-slate-600">{fmtQte(etape.restante)}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                etape.statut === 'Soldée'   ? 'bg-green-100 text-green-700' :
                                etape.statut === 'Partielle' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>{etape.statut}</span>
                            </td>
                            <td className="px-4 py-3">
                              {estAccorde && (
                                <button onClick={() => genererBonLivraisonAccord(racine, i + 1)}
                                  title={`Bon de livraison de l'accord ${racine?.numero_facture}/${i + 1}`}
                                  className="flex items-center gap-1 px-2.5 py-1 border border-slate-200 text-slate-500 rounded-lg text-xs font-medium hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-colors">
                                  <FileText size={11} /> BL
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <button onClick={handleGenererBLSpecial} disabled={blSpecialSaving}
                className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {blSpecialSaving ? <><Loader2 size={16} className="animate-spin" />Génération...</> : <><FileText size={16} />BL général (PDF)</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AJOUT : confirmation de suppression — irréversible (annule la
          confirmation ET compense le stock, voir confirmerSuppression) */}
      {livraisonASupprimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setLivraisonASupprimer(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl z-10 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" /> Confirmation
              </h2>
              <button onClick={() => setLivraisonASupprimer(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <p className="text-sm text-slate-600">
                Êtes-vous sûr de vouloir supprimer cette livraison ({livraisonASupprimer.numero_facture} —{' '}
                {livraisonASupprimer.nom_entreprise}) ? La commande sera remise en préparation et le stock sera
                réajusté en conséquence. Cette action est irréversible.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setLivraisonASupprimer(null)} disabled={suppressionEnCours}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-60">
                  Annuler
                </button>
                <button onClick={confirmerSuppression} disabled={suppressionEnCours}
                  className="flex-1 py-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {suppressionEnCours ? <><Loader2 size={14} className="animate-spin" />Suppression...</> : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
