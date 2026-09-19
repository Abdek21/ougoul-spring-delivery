// Extrait de LivraisonsView.jsx (refactor découpage, 2026-08) — modale
// "Signaler une perte ou un dommage", telle quelle.
import { X, Loader2 } from 'lucide-react'
import { MOTIFS_PERTE } from '../../../lib/pertes'

export default function ModalPerte({
  showPerte, setShowPerte, livraisonPourPerte, formPerte, setFormPerte,
  soumettrePerte, perteSaving,
}) {
  if (!showPerte || !livraisonPourPerte) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowPerte(false)} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl z-10 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Signaler une perte ou un dommage</h2>
          <button onClick={() => setShowPerte(false)} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={soumettrePerte} className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <p className="font-semibold text-slate-900">{livraisonPourPerte.commande.clients?.nom_entreprise}</p>
            <p className="text-xs font-mono text-red-600 mt-0.5">{livraisonPourPerte.commande.numero_facture}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Quantité perdue</label>
              <input type="number" min="1" required value={formPerte.quantite}
                onChange={e => setFormPerte({ ...formPerte, quantite: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Unité</label>
              {/* MODIFIÉ (retour Kassim) : Carton/Pack en priorité — une
                  perte concerne quasi toujours de petites quantités.
                  Palette reste disponible pour le cas rare d'un dommage
                  massif, mais n'est plus mise en avant. */}
              <div className="grid grid-cols-3 gap-2">
                {['Carton', 'Pack', 'Palette'].map(u => (
                  <button key={u} type="button" onClick={() => setFormPerte({ ...formPerte, unite: u })}
                    className={`py-2.5 rounded-xl text-xs font-medium border transition-all ${
                      formPerte.unite === u ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200'
                    }`}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Motif</label>
            <div className="grid grid-cols-2 gap-2">
              {MOTIFS_PERTE.map(m => (
                <button key={m} type="button" onClick={() => setFormPerte({ ...formPerte, motif: m })}
                  className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                    formPerte.motif === m ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200'
                  }`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Cette livraison passera dans l'onglet "Pertes et dommages" jusqu'à ce que tu confirmes
            la livraison une fois le remplacement effectué.
          </p>

          <button type="submit" disabled={perteSaving}
            className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {perteSaving
              ? <><Loader2 size={16} className="animate-spin" />Enregistrement...</>
              : 'Enregistrer la perte'
            }
          </button>
        </form>
      </div>
    </div>
  )
}
