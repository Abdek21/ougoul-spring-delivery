// Composants graphiques réutilisables — Recharts
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

// MODIFIÉ : espace insécable (\u00A0) au lieu d'un espace normal, pour que
// les valeurs à 6 chiffres ("240 000") ne se coupent plus sur deux lignes
// dans les libellés d'axe Y (Recharts/SVG traite l'espace normal comme un
// point de coupure possible dès que la largeur de l'axe est serrée).
function fmt(n) {
  return Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')
}

// ── Tooltip personnalisé ──
function CustomTooltip({ active, payload, label, suffix = 'DJF' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.color }}>
          {fmt(p.value)} {suffix}
        </p>
      ))}
    </div>
  )
}

// ── Graphique courbe CA ──
export function CALineChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        {/* MODIFIÉ : width 55 → 64, marge de sécurité pour les valeurs à 6 chiffres */}
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
          tickFormatter={v => `${fmt(v)}`} width={64} />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="ca" stroke="#f97316" strokeWidth={2.5}
          dot={{ fill: '#f97316', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, fill: '#f97316' }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Graphique barres commandes ──
export function CommandesBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
        <Tooltip content={<CustomTooltip suffix="commandes" />} />
        <Bar dataKey="commandes" fill="#f97316" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Graphique camembert type client ──
const COLORS = {
  Distributeur: '#8b5cf6',
  Entreprise:   '#f97316',
  Particulier:  '#3b82f6',
}

export function TypeClientPieChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={COLORS[entry.name] || '#94a3b8'} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [`${value} commandes`, '']} />
        <Legend
          formatter={(value) => <span style={{ fontSize: 12, color: '#64748b' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── Graphique stock sur 7 jours ──
export function StockLineChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        {/* MODIFIÉ : width 55 → 64, même correctif que CALineChart */}
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
          tickFormatter={v => `${fmt(v)}`} width={64} />
        <Tooltip content={<CustomTooltip suffix="cartons" />} />
        <Line type="monotone" dataKey="cartons" stroke="#22c55e" strokeWidth={2.5}
          dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, fill: '#22c55e' }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// AJOUT : mini-graphique compact (sparkline) — pour le Portefeuille Client,
// sans axes ni grille, juste la tendance en un coup d'œil
export function MiniSparkline({ data, dataKey = 'valeur', couleur = '#f97316', height = 48 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <Line type="monotone" dataKey={dataKey} stroke={couleur} strokeWidth={2}
          dot={false} activeDot={{ r: 3, fill: couleur }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// AJOUT (module Audit) : activité par jour du mois — 3 séries empilées
// (Création/Modification/Suppression), data = [{ jour, Création, Modification, Suppression }]
const COULEURS_ACTION = { Création: '#22c55e', Modification: '#f59e0b', Suppression: '#ef4444' }

export function AuditActiviteBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="jour" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
        <Tooltip content={<CustomTooltip suffix="événement(s)" />} />
        <Legend formatter={v => <span style={{ fontSize: 12, color: '#64748b' }}>{v}</span>} />
        {Object.entries(COULEURS_ACTION).map(([cle, couleur]) => (
          <Bar key={cle} dataKey={cle} stackId="a" fill={couleur} radius={cle === 'Suppression' ? [4, 4, 0, 0] : 0} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// AJOUT (module Audit) : répartition générique en barres horizontales —
// réutilisée pour "par rôle" et "par table concernée", data = [{ name, value }]
export function HorizontalBarChart({ data, couleur = '#f97316', suffix = 'événement(s)' }) {
  const largeurLabel = Math.min(140, Math.max(70, ...data.map(d => d.name.length * 6.5)))
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={largeurLabel} />
        <Tooltip content={<CustomTooltip suffix={suffix} />} />
        <Bar dataKey="value" fill={couleur} radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}