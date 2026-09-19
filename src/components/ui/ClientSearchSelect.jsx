import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, Check } from 'lucide-react'

/**
 * Sélecteur de client avec recherche — remplace un <select> natif quand
 * la liste de clients peut devenir longue.
 *
 * Props :
 * - clients        : liste des clients à proposer (déjà filtrée par type si besoin)
 * - value           : id du client sélectionné
 * - onChange(id)    : appelé à la sélection
 * - placeholder     : texte affiché quand rien n'est sélectionné
 * - renderBadge(c)  : (optionnel) rendu d'un badge à droite de chaque option
 */
export default function ClientSearchSelect({ clients, value, onChange, placeholder = 'Rechercher un client...', renderBadge }) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  const clientSelectionne = clients.find(c => c.id === value)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const resultats = query.trim()
    ? clients.filter(c => c.nom_entreprise?.toLowerCase().includes(query.toLowerCase()))
    : clients

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => { setOpen(o => !o); setQuery('') }}
        className="w-full flex items-center justify-between px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-left">
        <span className={clientSelectionne ? 'text-slate-900' : 'text-slate-400'}>
          {clientSelectionne ? clientSelectionne.nom_entreprise : placeholder}
        </span>
        <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Taper un nom..."
                className="w-full pl-7 pr-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {resultats.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-400 text-center">Aucun client trouvé</p>
            ) : (
              resultats.map(c => (
                <button key={c.id} type="button"
                  onClick={() => { onChange(c.id); setOpen(false); setQuery('') }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-orange-50 transition-colors">
                  <span className="text-slate-800">{c.nom_entreprise}</span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    {renderBadge && renderBadge(c)}
                    {value === c.id && <Check size={13} className="text-orange-500" />}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}