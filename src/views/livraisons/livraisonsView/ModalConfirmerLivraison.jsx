// AJOUT (bug remonté par l'utilisateur) : confirmation d'une livraison
// Comptant/Credit/Paiement30j écrivait directement en base au clic sur
// "Confirmer livraison" (aucune modale), avec la date du jour codée en
// dur — impossible de corriger une confirmation faite en retard. Cette
// modale laisse choisir/corriger la date de livraison effective avant
// écriture (voir executerConfirmerLivraison, useLivraisonsView.js), même
// pattern que ModalEncaissement.jsx (Cas 2 — Livraison) et "Nouvelle
// production" (ProductionsComptableView.jsx).
import { X, Loader2 } from 'lucide-react'
import { fmt } from './helpers'

export default function ModalConfirmerLivraison({
  showConfirmerLivraison, setShowConfirmerLivraison, livraisonAConfirmer,
  dateLivraisonEffective, setDateLivraisonEffective,
  executerConfirmerLivraison, confirmerLivraisonSaving,
}) {
  if (!showConfirmerLivraison || !livraisonAConfirmer) return null

  return (
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
              {fmt(livraisonAConfirmer.commande.montant_total)}
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
  )
}
