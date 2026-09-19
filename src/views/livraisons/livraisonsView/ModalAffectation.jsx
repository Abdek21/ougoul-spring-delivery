// Extrait de LivraisonsView.jsx (refactor découpage, 2026-08) — modale
// "Planifier la livraison", telle quelle.
import { X, Loader2 } from 'lucide-react'
import { fmt } from './helpers'

export default function ModalAffectation({
  showAffectation, setShowAffectation, cmdSelectionnee,
  datePlanifiee, setDatePlanifiee, retraitClient, setRetraitClient,
  vehiculeId, setVehiculeId, chauffeurId, setChauffeurId, vehicules, chauffeurs,
  noteChauffeur, setNoteChauffeur, handleAffectation, affSaving,
}) {
  if (!showAffectation || !cmdSelectionnee) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowAffectation(false)} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl z-10 overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-slate-900">Planifier la livraison</h2>
          <button onClick={() => setShowAffectation(false)} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">

          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
            <p className="font-semibold text-slate-900">{cmdSelectionnee.clients?.nom_entreprise}</p>
            <p className="text-xs font-mono text-orange-600 mt-0.5">{cmdSelectionnee.numero_facture}</p>
            {cmdSelectionnee.clients?.adresse && (
              <p className="text-xs text-slate-500 mt-1">📍 {cmdSelectionnee.clients.adresse}</p>
            )}
            <p className="text-sm font-bold text-slate-900 mt-2">{fmt(cmdSelectionnee.montant_total)}</p>
          </div>

          <form onSubmit={handleAffectation} className="space-y-4">

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Date de livraison</label>
              <input type="date" value={datePlanifiee}
                onChange={e => setDatePlanifiee(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>

            <label className="flex items-center gap-2 cursor-pointer p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <input type="checkbox" checked={retraitClient}
                onChange={e => setRetraitClient(e.target.checked)}
                className="w-4 h-4 accent-blue-600" />
              <span className="text-sm font-medium text-blue-800">Le client vient récupérer lui-même</span>
            </label>

            {!retraitClient && (
              <>
                {/* MODIFIÉ (item 8 — planning transporteur) : le véhicule
                    se choisit en premier, le chauffeur habituel de ce
                    véhicule se pré-remplit automatiquement (modifiable
                    si besoin, ex. chauffeur absent ce jour-là) */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Véhicule</label>
                  <select value={vehiculeId} onChange={e => {
                    const id = e.target.value
                    setVehiculeId(id)
                    const vehicule = vehicules.find(v => v.id === id)
                    setChauffeurId(vehicule?.chauffeur_habituel_id || '')
                  }}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white">
                    <option value="">— Sélectionner un véhicule —</option>
                    {vehicules.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.immatriculation} · {v.type_vehicule} · {v.capacite_palettes} pal.
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Chauffeur {vehiculeId && chauffeurId && <span className="text-xs text-slate-400 font-normal">(rempli automatiquement — modifiable)</span>}
                  </label>
                  <select value={chauffeurId} onChange={e => setChauffeurId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white">
                    <option value="">— Sélectionner un chauffeur —</option>
                    {chauffeurs.map(ch => (
                      <option key={ch.id} value={ch.id}>
                        {ch.nom_complet} {ch.num_permis ? `· Permis ${ch.num_permis}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {retraitClient ? 'Note (optionnel)' : 'Note pour le chauffeur'}
              </label>
              <input type="text" value={noteChauffeur}
                onChange={e => setNoteChauffeur(e.target.value)}
                placeholder={retraitClient ? "Ex : Vient avec sa camionnette personnelle" : "Ex : Appeler avant d'arriver, accès par côté..."}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>

            <button type="submit" disabled={affSaving}
              className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {affSaving ? <><Loader2 size={16} className="animate-spin" />Planification...</> : '🚚 Planifier la livraison'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
