// Carte indicateur (KPI) réutilisable pour afficher un chiffre clé.
// Ex : Chiffre d'affaires, Nombre de prospects, Stock disponible...
//
// UTILISATION :
//   <KpiCard title="CA cette semaine" value="125 000 DJF" icon={TrendingUp} color="green" />

import { cn } from '../../lib/utils'

const COLORS = {
  orange: { bg: 'bg-orange-50',  icon: 'text-orange-500', border: 'border-orange-100' },
  green:  { bg: 'bg-green-50',   icon: 'text-green-600',  border: 'border-green-100' },
  red:    { bg: 'bg-red-50',     icon: 'text-red-500',    border: 'border-red-100' },
  blue:   { bg: 'bg-blue-50',    icon: 'text-blue-600',   border: 'border-blue-100' },
  purple: { bg: 'bg-purple-50',  icon: 'text-purple-600', border: 'border-purple-100' },
  amber:  { bg: 'bg-amber-50',   icon: 'text-amber-600',  border: 'border-amber-100' },
}

export default function KpiCard({ title, value, icon: Icon, color = 'orange', subtitle, trend }) {
  const c = COLORS[color] || COLORS.orange

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        {Icon && (
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', c.bg)}>
            <Icon size={18} className={c.icon} />
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {subtitle && (
        <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
          {trend === 'up'   && <span className="text-green-500 font-medium">↑</span>}
          {trend === 'down' && <span className="text-red-500 font-medium">↓</span>}
          {subtitle}
        </p>
      )}
    </div>
  )
}