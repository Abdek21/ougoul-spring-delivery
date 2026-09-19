import { X, Clock, CheckCircle, AlertTriangle } from 'lucide-react'

// Config des statuts, partagée par toutes les fiches
export const STATUT_CONFIG = {
  En_attente: { label: 'En attente',  class: 'bg-amber-100 text-amber-700', icon: Clock },
  Validee:    { label: 'Validée',     class: 'bg-green-100 text-green-700', icon: CheckCircle },
  Rejetee:    { label: 'Rejetée',     class: 'bg-red-100 text-red-700',     icon: AlertTriangle },
  Nouvelle:   { label: 'Nouvelle',    class: 'bg-amber-100 text-amber-700', icon: Clock },
  En_cours:   { label: 'En cours',    class: 'bg-blue-100 text-blue-700',   icon: Clock },
  Resolue:    { label: 'Résolue',     class: 'bg-green-100 text-green-700', icon: CheckCircle },
  A_traiter:  { label: 'À traiter',   class: 'bg-amber-100 text-amber-700', icon: Clock },
  Traite:     { label: 'Traité',      class: 'bg-green-100 text-green-700', icon: CheckCircle },
}

export function ModalFiche({ titre, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl z-10 overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-slate-900">{titre}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function BandeauErreur({ message }) {
  return (
    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
      <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
      <p className="text-red-600 text-sm">{message}</p>
    </div>
  )
}

export function ListeFiches({ fiches, vide, icon: Icon, render }) {
  return (
    <div className="space-y-3">
      {fiches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
          <Icon size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">{vide}</p>
        </div>
      ) : (
        fiches.map(f => {
          const sc = STATUT_CONFIG[f.statut]
          const StatutIcon = sc.icon
          return (
            <div key={f.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">{render(f)}</div>
                <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${sc.class}`}>
                  <StatutIcon size={11} /> {sc.label}
                </span>
              </div>
              {f.statut === 'Rejetee' && f.motif_rejet && (
                <p className="text-xs text-red-500 mt-2 italic">Motif : {f.motif_rejet}</p>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// AJOUT : statut d'expiration d'un document véhicule — utilisé par
// DocumentsVehiculesGestionnaireView
export function statutExpiration(dateStr) {
  if (!dateStr) return null
  const jours = Math.round((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
  if (jours < 0) return { label: 'Expirée', class: 'bg-red-100 text-red-700', jours }
  if (jours <= 30) return { label: `Expire dans ${jours}j`, class: 'bg-amber-100 text-amber-700', jours }
  return null
}