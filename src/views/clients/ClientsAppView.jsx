import { useEffect, useState } from 'react'
import { Smartphone, Check, Phone, MapPin, Clock, X, Loader2, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const TYPES_CLIENT = ['Particulier', 'Entreprise', 'Distributeur']

export default function ClientsAppView() {
  const [loading, setLoading]           = useState(true)
  const [enAttente, setEnAttente]       = useState([])
  const [approuves, setApprouves]       = useState([])
  const [onglet, setOnglet]             = useState('attente')

  const [clientAApprouver, setClientAApprouver] = useState(null)
  const [typeChoisi, setTypeChoisi]     = useState('Particulier')
  const [saving, setSaving]             = useState(false)
  const [erreur, setErreur]             = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'client')

    if (error) console.error('fetchAll clients app:', error.message)

    setEnAttente((data || []).filter(p => !p.approuve_client))
    setApprouves((data || []).filter(p => p.approuve_client))
    setLoading(false)
  }

  function ouvrirApprobation(client) {
    setClientAApprouver(client)
    setTypeChoisi('Particulier')
    setErreur(null)
  }

  // Approuver : passe approuve_client à true ET crée la ligne "clients"
  // correspondante avec le MÊME id que le profil — c'est ce qui permet à
  // commandes.client_id (qui pointe vers clients, pas profiles) de
  // fonctionner pour les commandes passées depuis l'app mobile.
  async function handleApprouver(e) {
    e.preventDefault()
    if (!clientAApprouver) return
    setSaving(true)
    setErreur(null)

    try {
      const { error: errProfil } = await supabase
        .from('profiles')
        .update({ approuve_client: true })
        .eq('id', clientAApprouver.id)
      if (errProfil) throw errProfil

      const { error: errClient } = await supabase
        .from('clients')
        .insert({
          id: clientAApprouver.id, // même id que le profil — voir note ci-dessus
          nom_entreprise: clientAApprouver.nom_complet,
          type_client: typeChoisi,
          telephone: clientAApprouver.telephone,
          adresse: clientAApprouver.quartier,
          actif: true,
        })
      if (errClient) throw errClient

      setClientAApprouver(null)
      await fetchAll()
    } catch (err) {
      console.error('Erreur approbation :', err)
      setErreur(`Erreur : ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const liste = onglet === 'attente' ? enAttente : approuves

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">

      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <Smartphone size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Clients de l'application mobile</h1>
          <p className="text-sm text-slate-500">Approbation des nouveaux comptes clients</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        <button onClick={() => setOnglet('attente')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            onglet === 'attente' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <Clock size={14} /> En attente ({enAttente.length})
        </button>
        <button onClick={() => setOnglet('approuves')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            onglet === 'approuves' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <CheckCircle size={14} /> Approuvés ({approuves.length})
        </button>
      </div>

      <div className="space-y-3">
        {liste.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
            <Smartphone size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">
              {onglet === 'attente' ? 'Aucun client en attente' : 'Aucun client approuvé pour le moment'}
            </p>
          </div>
        ) : (
          liste.map(client => (
            <div key={client.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900">{client.nom_complet}</p>
                  <div className="flex items-center gap-4 mt-1">
                    {client.telephone && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Phone size={11} /> {client.telephone}
                      </span>
                    )}
                    {client.quartier && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin size={11} /> {client.quartier}
                      </span>
                    )}
                  </div>
                </div>
                {onglet === 'attente' ? (
                  <button onClick={() => ouvrirApprobation(client)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors flex-shrink-0">
                    <Check size={14} /> Approuver
                  </button>
                ) : (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-700 flex-shrink-0">
                    Approuvé
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal approbation */}
      {clientAApprouver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setClientAApprouver(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl z-10 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Approuver ce client</h2>
              <button onClick={() => setClientAApprouver(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleApprouver} className="p-6 space-y-4">

              {erreur && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{erreur}</div>
              )}

              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-semibold text-slate-800">{clientAApprouver.nom_complet}</p>
                <p className="text-xs text-slate-400">{clientAApprouver.telephone} · {clientAApprouver.quartier}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Type de client</label>
                <div className="flex gap-2">
                  {TYPES_CLIENT.map(t => (
                    <button key={t} type="button" onClick={() => setTypeChoisi(t)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        typeChoisi === t ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">Par défaut "Particulier" — un client mobile qui commande pour un commerce, par exemple.</p>
              </div>

              <button type="submit" disabled={saving}
                className="w-full py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Approuver et créer le client
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}