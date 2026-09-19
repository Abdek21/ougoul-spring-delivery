// Boutons de sélection d'unité réutilisables
// Affiche l'équivalence en temps réel sous les boutons
//
// UTILISATION :
//   <UniteSelector
//     unite={form.unite}
//     quantite={form.quantite}
//     onChange={(unite) => setForm({...form, unite})}
//   />

import { getEquivalences } from '../../lib/conversions'
import { cn } from '../../lib/utils'

// AJOUT (2026-08) : Pack — l'ancien ternaire (u === 'Palette' ? Palette :
// Carton) mislabellait tout ce qui n'était pas Palette comme "Carton",
// y compris Pack. Généralisé en map pour rester correct quel que soit le
// nombre d'unités passées dans `unites`.
const LABELS_UNITE = { Palette: '🏭 Palette', Carton: '📦 Carton', Pack: '🧴 Pack' }

export default function UniteSelector({ unite, quantite, onChange, unites = ['Palette', 'Carton'], format = '500ml' }) {
  const equivalences = quantite > 0 ? getEquivalences(unite, parseInt(quantite), format) : ''

  return (
    <div>
      <div className="flex gap-2">
        {unites.map(u => (
          <button key={u} type="button" onClick={() => onChange(u)}
            className={cn(
              'px-5 py-2.5 rounded-xl text-sm font-medium border-2 transition-all',
              unite === u
                ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
            )}>
            {LABELS_UNITE[u] || u}
          </button>
        ))}
      </div>
      {equivalences && (
        <p className="text-xs text-orange-600 font-medium mt-2">
          ≈ {equivalences}
        </p>
      )}
    </div>
  )
}