// AJOUT (2026-09) : sélecteur de semaine calendaire DIMANCHE→SAMEDI —
// réutilisé par ChiffreAffaireView.jsx et le filtre semaine de
// CommandesView.jsx (FiltresCommandes.jsx), pour ne jamais dupliquer ce
// composant. `semaine` = { debut, fin } (YYYY-MM-DD) — voir lib/semaine.js
// pour le calcul. Navigation par flèches (±1 semaine) + un <input
// type="date"> qui, dès qu'une date y est choisie, sélectionne
// automatiquement la semaine dimanche-samedi la contenant.
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { semaineDecalee, semaineDeDate, libelleSemaine } from '../../lib/semaine'

export default function SelecteurSemaine({ semaine, onChangeSemaine, className = '' }) {
  return (
    <div className={`flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-1.5 py-1.5 ${className}`}>
      <button type="button" onClick={() => onChangeSemaine(semaineDecalee(semaine, -1))}
        title="Semaine précédente"
        className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors">
        <ChevronLeft size={16} />
      </button>

      <div className="flex items-center gap-1.5 px-1.5">
        <Calendar size={13} className="text-slate-400" />
        <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">{libelleSemaine(semaine)}</span>
      </div>

      <button type="button" onClick={() => onChangeSemaine(semaineDecalee(semaine, 1))}
        title="Semaine suivante"
        className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors">
        <ChevronRight size={16} />
      </button>

      <input
        type="date"
        value={semaine.debut}
        onChange={e => e.target.value && onChangeSemaine(semaineDeDate(e.target.value))}
        title="Choisir une date — la semaine (dimanche-samedi) qui la contient sera sélectionnée"
        className="ml-1 pl-1.5 border-l border-slate-100 text-xs text-slate-400 focus:outline-none bg-transparent"
      />
    </div>
  )
}
