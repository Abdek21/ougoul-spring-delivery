// Badge coloré selon le type de client
// UTILISATION : <TypeClientBadge type="Distributeur" />

import { cn } from '../../lib/utils'

const CONFIG = {
  Distributeur: { color: 'bg-purple-100 text-purple-700', emoji: '🏭' },
  Particulier:  { color: 'bg-blue-100 text-blue-700',     emoji: '👤' },
  Entreprise:   { color: 'bg-orange-100 text-orange-700', emoji: '🏢' },
}

export default function TypeClientBadge({ type, size = 'sm' }) {
  const c = CONFIG[type] || { color: 'bg-gray-100 text-gray-600', emoji: '?' }
  return (
    <span className={cn(
      'inline-flex items-center gap-1 font-medium rounded-full',
      size === 'sm' ? 'text-xs px-2.5 py-0.5' : 'text-sm px-3 py-1',
      c.color
    )}>
      {c.emoji} {type}
    </span>
  )
}