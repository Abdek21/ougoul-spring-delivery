import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Download, Loader2, RefreshCw, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDate, formatCurrency } from '../../lib/utils'
import { STATUT_PERTE_CONFIG } from '../../lib/pertes'
import { exportPertesLivraisonExcel } from '../../lib/export'

const MODES_ENCAISSEMENT = {
  Especes: '💵 Espèces',
  D_Money: '📱 D-Money',
  Waafi:   '📱 Waafi',
  CAC:     '📱 CAC',
}

function moisActuel() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function libelleMois(mois) {
  const [annee, m] = mois.split('-').map(Number)
  return new Date(annee, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

// Déclaration ET confirmation vivent ici, en dehors de LivraisonsView.jsx
// (qui garde uniquement le bouton "⚠️ Perte" pour déclarer, et exclut ces
// livraisons de "Livraisons du jour" tant qu'elles sont en attente ici).
// AJOUT : commercial a accès en lecture seule (pas de bouton "Confirmer
// livraison") pour garder un œil sur ça et informer un client au besoin.
export default function PertesLivraisonView() {
  const { role } = useAuth()
  const peutAgir = role === 'admin' || role === 'logistique'

  const [enAttente, setEnAttente]   = useState([])
  const [pertes, setPertes]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [mois, setMois]             = useState(moisActuel())
  const [traitementId, setTraitementId] = useState(null)

  // ── Déclaration du montant récupéré (Cas 2 — Livraison) ──
  const [showEncaissement, setShowEncaissement]       = useState(false)
  const [livraisonAEncaisser, setLivraisonAEncaisser] = useState(null)
  const [modeEncaissement, setModeEncaissement]       = useState('Especes')
  const [montantEncaisse, setMontantEncaisse]         = useState('')
  const [encaissementSaving, setEncaissementSaving]   = useState(false)

  // AJOUT (bug remonté par l'utilisateur, même correctif que
  // LivraisonsView.jsx/useLivraisonsView.js) : date de livraison
  // EFFECTIVE, modifiable au moment de la confirmation au lieu du
  // now()/aujourd'hui codé en dur — partagée entre les 2 chemins de
  // confirmation ci-dessous (un seul ouvert à la fois).
  const [dateLivraisonEffective, setDateLivraisonEffective] = useState(new Date().toISOString().split('T')[0])
  const [showConfirmerLivraison, setShowConfirmerLivraison]     = useState(false)
  const [livraisonAConfirmer, setLivraisonAConfirmer]           = useState(null)
  const [confirmerLivraisonSaving, setConfirmerLivraisonSaving] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchEnAttente(), fetchPertes()])
    setLoading(false)
  }

  async function fetchEnAttente() {
    const { data } = await supabase
      .from('pertes_livraison')
      .select(`
        id, quantite_perdue, unite, motif, date_declaration,
        livraisons:livraison_id (
          id, commande_id, statut,
          chauffeurs(nom_complet, telephone),
          vehicules(immatriculation, type_vehicule),
          commandes:commande_id (numero_facture, montant_total, cas_vente, clients(nom_entreprise, type_client))
        )
      `)
      .eq('statut', 'En_attente')
      .order('date_declaration', { ascending: true })
    setEnAttente(data || [])
  }

  async function fetchPertes() {
    const { data } = await supabase
      .from('pertes_livraison')
      .select(`
        id, quantite_perdue, unite, motif, statut, date_declaration, note,
        clients(nom_entreprise, type_client),
        commandes:commande_id(numero_facture),
        profiles:declare_par(nom_complet)
      `)
      .order('date_declaration', { ascending: false })
      .limit(1000)
    setPertes(data || [])
  }

  async function resoudrePerteSiExiste(livraisonId) {
    await supabase.from('pertes_livraison')
      .update({ statut: 'Resolue', mis_a_jour_le: new Date().toISOString() })
      .eq('livraison_id', livraisonId)
      .eq('statut', 'En_attente')
  }

  // ── Confirme la livraison bloquée par la perte — même logique que
  // LivraisonsView.jsx (Comptant/Credit direct, Livraison via encaissement)
  async function confirmerLivraison(liv) {
    setTraitementId(liv.id)
    const { data: commande } = await supabase
      .from('commandes')
      .select('*, clients(nom_entreprise), commandes_lignes(*)')
      .eq('id', liv.commande_id)
      .single()
    if (!commande) { setTraitementId(null); return }

    setDateLivraisonEffective(new Date().toISOString().split('T')[0])

    if (commande.cas_vente === 'Livraison') {
      setLivraisonAEncaisser({ livraisonId: liv.id, commande })
      setMontantEncaisse(commande.montant_total)
      setModeEncaissement('Especes')
      setShowEncaissement(true)
      setTraitementId(null)
    } else {
      // MODIFIÉ (bug remonté par l'utilisateur) : n'écrit plus directement
      // — ouvre la modale de confirmation avec date modifiable (voir
      // executerConfirmerLivraison ci-dessous).
      setLivraisonAConfirmer({ livraisonId: liv.id, commande })
      setShowConfirmerLivraison(true)
      setTraitementId(null)
    }
  }

  // AJOUT : écriture réelle de la confirmation pour Comptant/Credit/
  // Paiement30j — même logique que useLivraisonsView.js.
  async function executerConfirmerLivraison(e) {
    e.preventDefault()
    if (!livraisonAConfirmer) return
    setConfirmerLivraisonSaving(true)
    const { livraisonId, commande } = livraisonAConfirmer

    const nouveauStatutCommande = (commande.cas_vente === 'Credit' || commande.cas_vente === 'Paiement30j') ? 'Livree_creance_active' : 'Facture_et_livree'

    await supabase.from('livraisons').update({ statut: 'Livree', date_effective: dateLivraisonEffective }).eq('id', livraisonId)
    await supabase.from('commandes').update({ statut: nouveauStatutCommande, date_livraison: dateLivraisonEffective }).eq('id', commande.id)
    await resoudrePerteSiExiste(livraisonId)

    setShowConfirmerLivraison(false)
    setLivraisonAConfirmer(null)
    await fetchAll()
    setConfirmerLivraisonSaving(false)
  }

  async function confirmerEncaissementLivraison(e) {
    e.preventDefault()
    if (!livraisonAEncaisser) return
    setEncaissementSaving(true)

    const { livraisonId, commande } = livraisonAEncaisser

    await supabase.from('livraisons').update({ statut: 'Livree', date_effective: dateLivraisonEffective }).eq('id', livraisonId)
    await supabase.from('commandes').update({
      statut:         'Livree',
      mode_reglement:  modeEncaissement,
      montant_regle:   parseFloat(montantEncaisse) || commande.montant_total,
      date_livraison:  dateLivraisonEffective,
    }).eq('id', commande.id)

    await resoudrePerteSiExiste(livraisonId)

    setShowEncaissement(false)
    setLivraisonAEncaisser(null)
    setMontantEncaisse('')
    await fetchAll()
    setEncaissementSaving(false)
  }

  const pertesDuMois = pertes.filter(p => p.date_declaration?.slice(0, 7) === mois)

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-5xl mx-auto">

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pertes & dommages livraison</h1>
          <p className="text-slate-500 text-sm mt-1">{enAttente.length} en attente de confirmation</p>
        </div>
        <button onClick={fetchAll}
          className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
          <RefreshCw size={15} /> Actualiser
        </button>
      </div>

      {/* ── En attente — actionnable ── */}
      <div className="mb-10">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">En attente</h2>
        {enAttente.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 py-12 text-center">
            <CheckCircle size={28} className="text-green-300 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">Aucune perte en attente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {enAttente.map(p => {
              const liv = p.livraisons
              if (!liv) return null
              const cmd = liv.commandes
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-red-100 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={20} className="text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900">{cmd?.clients?.nom_entreprise}</p>
                        <p className="text-sm text-slate-600">
                          {p.quantite_perdue} {p.unite}{p.quantite_perdue > 1 ? 's' : ''} perdu(s) — {p.motif || 'motif non précisé'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Déclaré le {formatDate(p.date_declaration)}
                          {liv.chauffeurs?.nom_complet && ` · ${liv.chauffeurs.nom_complet}`}
                          {liv.vehicules?.immatriculation && ` · ${liv.vehicules.immatriculation}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <p className="font-bold text-slate-900">{formatCurrency(cmd?.montant_total)}</p>
                      <p className="text-xs font-mono text-orange-600">{cmd?.numero_facture}</p>
                      {peutAgir && liv.statut === 'En_cours' && (
                        <button onClick={() => confirmerLivraison(liv)} disabled={traitementId === liv.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-60">
                          {traitementId === liv.id ? <Loader2 size={13} className="animate-spin" /> : null}
                          ✅ Confirmer livraison
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Historique mensuel + export ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700">Historique — {libelleMois(mois)}</h2>
        <div className="flex gap-2">
          <input
            type="month"
            value={mois}
            onChange={e => setMois(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button onClick={() => exportPertesLivraisonExcel(pertesDuMois, libelleMois(mois))}
            disabled={pertesDuMois.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Download size={15} /> Export Excel
          </button>
        </div>
      </div>

      {pertesDuMois.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
          <CheckCircle size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Aucune perte déclarée pour {libelleMois(mois)}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pertesDuMois.map(p => {
            const cfg = STATUT_PERTE_CONFIG[p.statut] || { label: p.statut, class: 'bg-slate-100 text-slate-500' }
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={18} className="text-red-500" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-slate-900">{p.clients?.nom_entreprise || '—'}</p>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.class}`}>{cfg.label}</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    {p.quantite_perdue} {p.unite}{p.quantite_perdue > 1 ? 's' : ''} — {p.motif || 'motif non précisé'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Facture {p.commandes?.numero_facture || '—'} · déclaré le {formatDate(p.date_declaration)} par {p.profiles?.nom_complet || '—'}
                  </p>
                  {p.note && <p className="text-xs text-slate-400 mt-1 italic">"{p.note}"</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showEncaissement && livraisonAEncaisser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowEncaissement(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl z-10 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Déclarer le montant récupéré</h2>
              <button onClick={() => setShowEncaissement(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="font-semibold text-slate-900">{livraisonAEncaisser.commande.clients?.nom_entreprise}</p>
                <p className="text-xs font-mono text-blue-600 mt-0.5">{livraisonAEncaisser.commande.numero_facture}</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">
                  {formatCurrency(livraisonAEncaisser.commande.montant_total)}
                </p>
              </div>
              <form onSubmit={confirmerEncaissementLivraison} className="space-y-4">
                {/* AJOUT (bug remonté par l'utilisateur) : date de
                    livraison effective, modifiable */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Date de livraison</label>
                  <input type="date" value={dateLivraisonEffective} max={new Date().toISOString().slice(0, 10)} required
                    onChange={e => setDateLivraisonEffective(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  <p className="text-xs text-slate-400 mt-1">Par défaut aujourd'hui — modifiable si la saisie est faite en retard.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Mode déclaré</label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(MODES_ENCAISSEMENT).map(([mode, label]) => (
                      <button key={mode} type="button" onClick={() => setModeEncaissement(mode)}
                        className={`py-2.5 rounded-xl text-xs font-medium border transition-all ${
                          modeEncaissement === mode
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Montant récupéré</label>
                  <input type="number" value={montantEncaisse}
                    onChange={e => setMontantEncaisse(e.target.value)}
                    placeholder={livraisonAEncaisser.commande.montant_total}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xl font-bold focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <button type="submit" disabled={encaissementSaving}
                  className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {encaissementSaving
                    ? <><Loader2 size={16} className="animate-spin" />Enregistrement...</>
                    : '✅ Confirmer la livraison'
                  }
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* AJOUT (bug remonté par l'utilisateur) : confirmation
          Comptant/Credit/Paiement30j — écrivait directement en base au
          clic, sans possibilité de corriger la date. Même modale que
          ModalConfirmerLivraison.jsx (LivraisonsView.jsx), en inline ici
          puisque cet écran duplique déjà sa propre copie du flux de
          confirmation. */}
      {showConfirmerLivraison && livraisonAConfirmer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowConfirmerLivraison(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl z-10 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Confirmer la livraison</h2>
              <button onClick={() => setShowConfirmerLivraison(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="font-semibold text-slate-900">{livraisonAConfirmer.commande.clients?.nom_entreprise}</p>
                <p className="text-xs font-mono text-blue-600 mt-0.5">{livraisonAConfirmer.commande.numero_facture}</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">
                  {formatCurrency(livraisonAConfirmer.commande.montant_total)}
                </p>
              </div>
              <form onSubmit={executerConfirmerLivraison} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Date de livraison</label>
                  <input type="date" value={dateLivraisonEffective} max={new Date().toISOString().slice(0, 10)} required
                    onChange={e => setDateLivraisonEffective(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  <p className="text-xs text-slate-400 mt-1">Par défaut aujourd'hui — modifiable si la saisie est faite en retard.</p>
                </div>
                <button type="submit" disabled={confirmerLivraisonSaving}
                  className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {confirmerLivraisonSaving
                    ? <><Loader2 size={16} className="animate-spin" />Enregistrement...</>
                    : '✅ Confirmer la livraison'
                  }
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
