// Extrait de LivraisonsView.jsx (refactor découpage, 2026-08) — modale
// "Déclarer le montant récupéré", telle quelle.
import { X, Loader2 } from 'lucide-react'
import { fmt, MODES_ENCAISSEMENT } from './helpers'

export default function ModalEncaissement({
  showEncaissement, setShowEncaissement, livraisonAEncaisser,
  modeEncaissement, setModeEncaissement, montantEncaisse, setMontantEncaisse,
  confirmerEncaissementLivraison, encaissementSaving,
  dateLivraisonEffective, setDateLivraisonEffective,
}) {
  if (!showEncaissement || !livraisonAEncaisser) return null

  return (
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
              {fmt(livraisonAEncaisser.commande.montant_total)}
            </p>
          </div>
          <p className="text-xs text-slate-400">
            Le comptable validera et clôturera cet encaissement dans l'onglet
            "Livraison à valider" des Encaissements.
          </p>
          <form onSubmit={confirmerEncaissementLivraison} className="space-y-4">
            {/* AJOUT (bug remonté par l'utilisateur) : date de livraison
                effective, modifiable — même pattern que "Nouvelle
                production" (ProductionsComptableView.jsx) */}
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
  )
}
