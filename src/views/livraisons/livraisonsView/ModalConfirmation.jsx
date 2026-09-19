// AJOUT (refactor découpage, 2026-08) — remplace les window.confirm() de
// LivraisonsView.jsx par une modale au style de l'app, cohérente avec
// commandesView/ModalConfirmation.jsx.
import { AlertTriangle, X } from 'lucide-react'

export default function ModalConfirmation({ confirmation, fermerConfirmation, confirmerAction }) {
  if (!confirmation) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={fermerConfirmation} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl z-10 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" /> Confirmation
          </h2>
          <button onClick={fermerConfirmation} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600">{confirmation.message}</p>
          <div className="flex gap-2">
            <button onClick={fermerConfirmation}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
              Annuler
            </button>
            <button onClick={confirmerAction}
              className="flex-1 py-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors">
              Confirmer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
