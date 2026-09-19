// Extrait de LivraisonsView.jsx (refactor découpage, 2026-08) — onglet
// "Livraisons du jour", tel quel.
import { Truck, AlertTriangle, User, FileText, CheckCircle } from 'lucide-react'
import { estEtiquetteNonBuvableActive, formatDate } from '../../../lib/utils'
import { fmt, STATUT_LIV_CONFIG, TYPE_CLIENT_COLORS, estLivraisonDuJour } from './helpers'

// MODIFIÉ (2026-08) : réutilisé tel quel pour l'onglet "Confirmées en
// retard" (même carte, même style) — messageVide personnalise le seul
// texte qui diffère entre les 2 usages. `aujourdhui` requis pour que le
// badge "Confirmée en retard" utilise EXACTEMENT la même règle
// (estLivraisonDuJour) que le tri des onglets dans useLivraisonsView.js —
// évite qu'une carte affichée dans "Confirmées en retard" n'ait aucun
// badge distinctif (régression trouvée sur OGS-2026-0129).
export default function OngletJour({
  livraisonsJourFiltrees, imprimerBonLivraison, demarrerLivraison,
  retirerVersPlanifier, ouvrirDeclarationPerte, confirmerLivraison, aujourdhui,
  messageVide = "Aucune livraison planifiée aujourd'hui",
}) {
  return (
    <div className="space-y-3">

      {livraisonsJourFiltrees.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
          <Truck size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">{messageVide}</p>
        </div>
      ) : (
        livraisonsJourFiltrees.map(liv => {
          const sc   = STATUT_LIV_CONFIG[liv.statut] || STATUT_LIV_CONFIG.Planifiee
          const Icon = sc.icon
          return (
            <div key={liv.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">

                <div className="flex items-start gap-4 flex-1">
                  <div className="w-11 h-11 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Truck size={20} className="text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-slate-900">{liv.nom_entreprise}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_CLIENT_COLORS[liv.type_client]}`}>
                        {liv.type_client}
                      </span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1 ${sc.class}`}>
                        <Icon size={11} /> {sc.label}
                      </span>
                      {liv.en_retard && (
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-red-100 text-red-700 inline-flex items-center gap-1">
                          <AlertTriangle size={11} /> En retard — prévue le {formatDate(liv.date_planifiee)}
                        </span>
                      )}
                      {!estLivraisonDuJour(liv, aujourdhui) && (
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700 inline-flex items-center gap-1">
                          <AlertTriangle size={11} /> Confirmée en retard — prévue le {formatDate(liv.date_planifiee)}, livrée le {formatDate(liv.date_effective)}
                        </span>
                      )}
                      {estEtiquetteNonBuvableActive(liv) && (
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-cyan-100 text-cyan-700">
                          🚱 Non-buvable
                        </span>
                      )}
                    </div>
                    {liv.adresse && (
                      <p className="text-xs text-slate-400 mb-2">📍 {liv.adresse}</p>
                    )}
                    <div className="flex gap-4 flex-wrap">
                      {liv.telephone_client && (
                        <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-3 py-1.5">
                          <p className="text-xs font-medium text-slate-700">📞 {liv.telephone_client}</p>
                        </div>
                      )}
                      {liv.quantite_texte && liv.quantite_texte !== '—' && (
                        <div className="flex items-center gap-1.5 bg-orange-50 rounded-lg px-3 py-1.5">
                          <p className="text-xs font-medium text-orange-700">📦 {liv.quantite_texte}</p>
                        </div>
                      )}
                      {liv.nom_chauffeur && (
                        <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-3 py-1.5">
                          <User size={13} className="text-slate-400" />
                          <p className="text-xs font-medium text-slate-700">{liv.nom_chauffeur}</p>
                          {liv.telephone_chauffeur && (
                            <p className="text-xs text-slate-400">· {liv.telephone_chauffeur}</p>
                          )}
                        </div>
                      )}
                      {liv.immatriculation && (
                        <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-3 py-1.5">
                          <Truck size={13} className="text-slate-400" />
                          <p className="text-xs font-medium text-slate-700">{liv.immatriculation}</p>
                          <p className="text-xs text-slate-400">· {liv.type_vehicule}</p>
                        </div>
                      )}
                    </div>
                    {liv.note_chauffeur && (
                      <p className="text-xs text-slate-400 mt-2 italic">"{liv.note_chauffeur}"</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <p className="font-bold text-slate-900">{fmt(liv.montant_total)}</p>
                  <p className="text-xs font-mono text-orange-600">{liv.numero_facture}</p>
                  <div className="flex gap-2">
                    <button onClick={() => imprimerBonLivraison(liv)}
                      className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors flex items-center gap-1">
                      <FileText size={12} /> Bon de livraison
                    </button>
                    {liv.statut === 'Planifiee' && (
                      <button onClick={() => demarrerLivraison(liv.id)}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
                        Démarrer
                      </button>
                    )}
                    {(liv.statut === 'Planifiee' || liv.statut === 'En_cours') && (
                      <button onClick={() => retirerVersPlanifier(liv)}
                        className="px-3 py-1.5 border border-amber-200 text-amber-600 rounded-lg text-xs font-medium hover:bg-amber-50 transition-colors">
                        Retirer
                      </button>
                    )}
                    {liv.statut === 'En_cours' && (
                      <button onClick={() => ouvrirDeclarationPerte(liv)}
                        className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors">
                        ⚠️ Perte
                      </button>
                    )}
                    {liv.statut === 'En_cours' && (
                      <button onClick={() => confirmerLivraison(liv)}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">
                        ✅ Confirmer livraison
                      </button>
                    )}
                    {liv.statut === 'Livree' && (
                      <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle size={12} /> Livrée
                      </span>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
