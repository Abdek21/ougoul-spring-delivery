// Extrait de LivraisonsView.jsx (refactor découpage, 2026-08) — onglet
// "À planifier", tel quel.
import { Package, CheckCircle, AlertTriangle, Truck } from 'lucide-react'
import { estEtiquetteNonBuvableActive } from '../../../lib/utils'
import { aUneChainePartielle } from '../../../lib/livraisonsPartielles'
import { fmt, TYPE_CLIENT_COLORS, TIER_CONFIG } from './helpers'

// CORRIGÉ (bug bloquant remonté par l'utilisateur — urgent) : bandeau
// "Stock livrable aujourd'hui" retiré, avec stockLivrableBouteilles — même
// cause que le contrôle bloquant retiré de handleAffectation()
// (useLivraisonsView.js) : reposait sur l'ancien mécanisme "stock dépôt =
// stock réel décrémenté par les livraisons", devenu incohérent depuis la
// refonte du module Stocks & Dépôt (StockView.jsx, compteur mensuel
// découplé des livraisons).
export default function OngletPlanifier({
  commandes, remettreToutEnAttente, commandesTriees,
  tiersClients, commandesChaine, ouvrirHistoriquePartiel, ouvrirAffectation,
  remettreEnAttente, handleAnnulerCommande,
}) {
  return (
    <div className="space-y-3">
      {commandes.length > 0 && (
        <div className="flex justify-end mb-2">
          <button onClick={remettreToutEnAttente}
            className="flex items-center gap-1.5 px-4 py-2 border border-amber-200 text-amber-600 rounded-xl text-sm font-medium hover:bg-amber-50 transition-colors">
            <AlertTriangle size={14} /> Tout remettre en attente
          </button>
        </div>
      )}
      {commandesTriees.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
          <CheckCircle size={32} className="text-green-300 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Toutes les commandes sont planifiées !</p>
        </div>
      ) : (
        commandesTriees.map(cmd => {
          const tier = tiersClients[cmd.client_id] || 'Normal'
          const tc = TIER_CONFIG[tier]
          const TierIcon = tc.icon
          return (
            <div key={cmd.id}
              className={`bg-white rounded-2xl border shadow-sm p-5 flex items-center gap-4 ${
                tier === 'VIP' ? 'border-amber-200' : tier === 'Retardataire' ? 'border-red-200' : 'border-slate-100'
              }`}>
              <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Package size={20} className="text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="font-semibold text-slate-900">{cmd.clients?.nom_entreprise}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_CLIENT_COLORS[cmd.clients?.type_client]}`}>
                    {cmd.clients?.type_client}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    cmd.cas_vente === 'Livraison' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {cmd.cas_vente === 'Livraison' ? '🚚 Livraison' : '💳 Crédit'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${tc.class}`}>
                    {TierIcon && <TierIcon size={10} />} {tc.label}
                  </span>
                  {estEtiquetteNonBuvableActive(cmd) && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-cyan-100 text-cyan-700">
                      🚱 Non-buvable
                    </span>
                  )}
                </div>
                {cmd.clients?.adresse && (
                  <p className="text-xs text-slate-400">📍 {cmd.clients.adresse}</p>
                )}
                {cmd.clients?.telephone && (
                  <p className="text-xs text-slate-400">📞 {cmd.clients.telephone}</p>
                )}
                {/* AJOUT : detail des quantites demandees par unite */}
                <p className="text-xs text-orange-600 font-medium mt-1">
                  {(cmd.commandes_lignes || [])
                    .map(l => `${l.quantite} ${l.unite}${l.quantite > 1 ? 's' : ''}`)
                    .join(', ') || 'Aucune ligne'}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-slate-900">{fmt(cmd.montant_total)}</p>
                <p className="text-xs font-mono text-orange-600">{cmd.numero_facture}</p>
                {/* AJOUT (demande Kassim) : même badge que CommandesView.jsx */}
                {aUneChainePartielle(cmd, commandesChaine) && (
                  <button onClick={() => ouvrirHistoriquePartiel(cmd)}
                    className="inline-flex items-center gap-1 mt-1 text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors">
                    🔀 Partielle
                  </button>
                )}
              </div>
              <button onClick={() => ouvrirAffectation(cmd)}
                className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors flex-shrink-0">
                <Truck size={15} /> Planifier
              </button>
              <button onClick={() => remettreEnAttente(cmd)}
                className="flex items-center gap-1.5 px-3 py-2.5 border border-amber-200 text-amber-600 rounded-xl text-sm font-medium hover:bg-amber-50 transition-colors flex-shrink-0">
                <AlertTriangle size={14} /> Remettre en attente
              </button>
              <button onClick={() => handleAnnulerCommande(cmd)}
                className="flex items-center gap-1.5 px-3 py-2.5 border border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors flex-shrink-0">
                <AlertTriangle size={14} /> Annuler
              </button>
            </div>
          )
        })
      )}
    </div>
  )
}
