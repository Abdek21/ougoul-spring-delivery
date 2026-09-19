import { useEffect, useState } from 'react'
import { Briefcase, Search, TrendingDown, TrendingUp, Minus, Phone, MapPin } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { MiniSparkline } from '../../components/ui/Charts'

function fmt(n) {
  return Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' DJF'
}

const NB_MOIS = 6

function moisCourt(date) {
  return date.toLocaleDateString('fr-FR', { month: 'short' })
}

export default function PortefeuilleClientView() {
  const [loading, setLoading]   = useState(true)
  const [clients, setClients]   = useState([])
  const [search, setSearch]     = useState('')
  const [filtreTendance, setFiltreTendance] = useState('')

  useEffect(() => { fetchDonnees() }, [])

  async function fetchDonnees() {
    setLoading(true)

    const { data: distributeurs } = await supabase
      .from('clients')
      .select('id, nom_entreprise, telephone, secteur, adresse')
      .eq('type_client', 'Distributeur')
      .eq('actif', true)
      .order('nom_entreprise')

    if (!distributeurs || distributeurs.length === 0) {
      setClients([])
      setLoading(false)
      return
    }

    const depuis = new Date()
    depuis.setMonth(depuis.getMonth() - (NB_MOIS - 1))
    depuis.setDate(1)

    const { data: commandes } = await supabase
      .from('commandes')
      .select('client_id, montant_total, cree_le')
      .in('client_id', distributeurs.map(c => c.id))
      .neq('statut', 'Annulee')
      .gte('cree_le', depuis.toISOString().slice(0, 10))

    // Construit les 6 derniers mois (clé YYYY-MM)
    const moisRef = []
    for (let i = NB_MOIS - 1; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      moisRef.push({ cle: d.toISOString().slice(0, 7), label: moisCourt(d) })
    }

    const enrichis = distributeurs.map(client => {
      const parMois = {}
      moisRef.forEach(m => { parMois[m.cle] = 0 })

      commandes?.forEach(cmd => {
        if (cmd.client_id !== client.id) return
        const cle = cmd.cree_le.slice(0, 7)
        if (parMois[cle] !== undefined) parMois[cle] += Number(cmd.montant_total)
      })

      const serie = moisRef.map(m => ({ mois: m.label, valeur: parMois[m.cle] }))

      // Tendance : moyenne des 2 derniers mois vs moyenne des 3 mois précédents
      const deuxDerniers  = serie.slice(-2).reduce((s, v) => s + v.valeur, 0) / 2
      const troisAvant    = serie.slice(-5, -2).reduce((s, v) => s + v.valeur, 0) / 3
      let tendance = 'stable'
      if (troisAvant > 0) {
        if (deuxDerniers < troisAvant * 0.7) tendance = 'baisse'
        else if (deuxDerniers > troisAvant * 1.3) tendance = 'hausse'
      }

      const totalPeriode = serie.reduce((s, v) => s + v.valeur, 0)

      return { ...client, serie, tendance, totalPeriode, dernierMois: serie[serie.length - 1]?.valeur || 0 }
    })

    setClients(enrichis)
    setLoading(false)
  }

  const clientsFiltres = clients.filter(c => {
    const matchSearch = !search || c.nom_entreprise?.toLowerCase().includes(search.toLowerCase())
    const matchTendance = !filtreTendance || c.tendance === filtreTendance
    return matchSearch && matchTendance
  })

  const nbBaisse = clients.filter(c => c.tendance === 'baisse').length

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Briefcase size={22} className="text-orange-500" /> Portefeuille Client
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Distributeurs — évolution des commandes sur {NB_MOIS} mois
          {nbBaisse > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
              ⚠️ {nbBaisse} client{nbBaisse > 1 ? 's' : ''} en baisse
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un distributeur..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white" />
        </div>
        <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-xl">
          {[
            { key: '',       label: 'Tous' },
            { key: 'baisse', label: '📉 En baisse' },
            { key: 'stable', label: '➡️ Stable' },
            { key: 'hausse', label: '📈 En hausse' },
          ].map(f => (
            <button key={f.key} onClick={() => setFiltreTendance(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filtreTendance === f.key ? 'bg-orange-500 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {clientsFiltres.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
          <Briefcase size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Aucun distributeur trouvé</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clientsFiltres.map(client => (
            <div key={client.id}
              className={`bg-white rounded-2xl border shadow-sm p-5 ${
                client.tendance === 'baisse' ? 'border-red-200' : 'border-slate-100'
              }`}>
              <div className="flex items-center gap-5">

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-semibold text-slate-900">{client.nom_entreprise}</p>
                    {client.tendance === 'baisse' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
                        <TrendingDown size={11} /> En baisse
                      </span>
                    )}
                    {client.tendance === 'hausse' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                        <TrendingUp size={11} /> En hausse
                      </span>
                    )}
                    {client.tendance === 'stable' && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500">
                        <Minus size={11} /> Stable
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {client.telephone && (
                      <span className="flex items-center gap-1"><Phone size={11} /> {client.telephone}</span>
                    )}
                    {client.adresse && (
                      <span className="flex items-center gap-1"><MapPin size={11} /> {client.adresse}</span>
                    )}
                  </div>
                </div>

                <div className="w-40 flex-shrink-0">
                  <MiniSparkline
                    data={client.serie}
                    couleur={client.tendance === 'baisse' ? '#ef4444' : client.tendance === 'hausse' ? '#22c55e' : '#94a3b8'}
                  />
                </div>

                <div className="text-right flex-shrink-0 w-32">
                  <p className="text-xs text-slate-400">Dernier mois</p>
                  <p className="text-sm font-bold text-slate-900">{fmt(client.dernierMois)}</p>
                </div>

                {client.tendance === 'baisse' && (
                  <div className="flex-shrink-0 text-xs text-red-600 font-medium max-w-32 text-right">
                    💡 À visiter — comprendre la baisse
                  </div>
                )}

              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}