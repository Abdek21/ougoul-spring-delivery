// Extrait de LivraisonsView.jsx (refactor découpage, 2026-08) — modale
// historique des livraisons partielles + BL général, telle quelle.
// AJOUT (2026-09, numérotation par accord) : un bouton "BL" par ligne
// accordée (identifiant RACINE/N — voir même principe que
// commandesView/ModalHistoriquePartiel.jsx) ; "Générer le BL spécial"
// devient "BL général" pour rester cohérent avec les 2 autres familles
// de documents (Bon de commande général, Facture générale).
import { X, FileText, Loader2, CheckCircle } from 'lucide-react'
import { formatDate } from '../../../lib/utils'
import { genererBonLivraisonAccord } from '../../../lib/livraisonsPartielles'

export default function ModalHistoriquePartiel({ chainePartielle, setChainePartielle, handleGenererBLSpecial, blSpecialSaving }) {
  if (!chainePartielle) return null

  const racine = chainePartielle[0]?.commande

  return (
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
                          {/* AJOUT (2026-08) : coche "Validé" pour les
                              étapes déjà livrées — même changement que
                              commandesView/ModalHistoriquePartiel.jsx. */}
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                            etape.statut === 'Soldée'   ? 'bg-green-100 text-green-700' :
                            etape.statut === 'Partielle' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {(etape.statut === 'Soldée' || etape.statut === 'Partielle') && <CheckCircle size={11} />}
                            {etape.statut}
                          </span>
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
  )
}
