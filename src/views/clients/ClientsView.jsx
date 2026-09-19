import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Building2, Phone, MapPin, CreditCard, X, Loader2, Search, Upload, Star, Timer, ScanLine, History, ShoppingCart, Calendar, Trash2, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency, formatDate } from '../../lib/utils'
import TypeClientBadge from '../../components/ui/TypeClientBadge'
import ImportClientsModal from '../../components/clients/ImportClientsModal'
import ScanClientsModal from '../../components/clients/ScanClientsModal'

const SECTEURS = [
  'Hotel','Restaurant','Cafe','Supermarche',
  'Epicerie','Ecole','Clinique','Entreprise','Administration','Autre'
]
const TYPES_CLIENT = ['Distributeur', 'Particulier', 'Entreprise']

// AJOUT : 1er jour du mois suivant, en ISO local (pas de passage par
// toISOString() — même piège de fuseau déjà corrigé ailleurs cette session
// : Djibouti est UTC+3, un aller-retour par l'UTC peut faire glisser d'un
// jour). new Date(annee, mois, 1) est construit en LOCAL et relu avec les
// mêmes accesseurs locaux — jamais convertie via UTC.
function premierJourMoisSuivantISO(moisAAAAMM) {
  const [annee, mois] = moisAAAAMM.split('-').map(Number)
  const d = new Date(annee, mois, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const FORM_VIDE = {
  nom_entreprise: '',
  type_client:    'Entreprise',
  secteur:        '',
  nom_contact:    '',
  telephone:      '',
  email:          '',
  adresse:        '',
}

export default function ClientsView() {
  const navigate = useNavigate()
  const { role } = useAuth()
  const [clients, setClients]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filtreType, setFiltreType] = useState('')
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState(FORM_VIDE)
  const [editId, setEditId]         = useState(null)
  const [saving, setSaving]         = useState(false)
  const [successMsg, setSuccessMsg] = useState(null)
  // AJOUT : modal d'import Excel/CSV
  const [showImport, setShowImport] = useState(false)
  const [showScan, setShowScan]     = useState(false) // AJOUT
  // AJOUT : tier client (VIP/Normal/Retardataire)
  const [tiersClients, setTiersClients] = useState({})

  // AJOUT : historique des commandes d'un client
  const [clientHistorique, setClientHistorique]   = useState(null)
  const [commandesHistorique, setCommandesHistorique] = useState([])
  const [chargementHistorique, setChargementHistorique] = useState(false)

  // AJOUT (2026-09) : suppression d'un client — admin/commercial
  // uniquement. Bannière d'erreur symétrique à successMsg, réutilisée à
  // la fois pour le blocage "a des commandes" et pour un échec de
  // suppression (RLS...). confirmSuppression porte le client en attente
  // de confirmation UNIQUEMENT une fois la vérification "aucune
  // commande" passée — jamais affiché si le blocage s'applique.
  const peutSupprimerClient = role === 'admin' || role === 'commercial'
  const [erreurMsg, setErreurMsg]               = useState(null)
  const [confirmSuppression, setConfirmSuppression] = useState(null)
  const [suppressionEnCours, setSuppressionEnCours] = useState(false)

  // AJOUT (2026-09) : filtre par mois de création (clients.cree_le),
  // même pattern que FacturesView.jsx — "Tous les mois" activé par
  // défaut (contrairement à Factures/Encaissements) : ClientsView est un
  // écran de données maître, pas un rapport périodique — défaulter sur
  // le mois courant masquerait silencieusement tous les clients déjà
  // créés, une régression bien pire qu'un filtre absent au chargement.
  const [filtreMois, setFiltreMois] = useState(() => new Date().toISOString().slice(0, 7))
  const [tousLesMois, setTousLesMois] = useState(true)

  useEffect(() => { fetchClients(); fetchTiersClients() }, [])

  // AJOUT
  async function fetchTiersClients() {
    const { data, error } = await supabase.from('v_client_tier').select('client_id, tier')
    if (error) { console.error('fetchTiersClients:', error.message); return }
    const map = {}
    data?.forEach(t => { map[t.client_id] = t.tier })
    setTiersClients(map)
  }

  async function fetchClients() {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('actif', true)
      .order('nom_entreprise')
    setClients(data || [])
    setLoading(false)
  }

  function ouvrirCreation() {
    setForm(FORM_VIDE)
    setEditId(null)
    setShowForm(true)
  }

  function ouvrirModification(client) {
    setForm({
      nom_entreprise: client.nom_entreprise || '',
      type_client:    client.type_client    || 'Entreprise',
      secteur:        client.secteur        || '',
      nom_contact:    client.nom_contact    || '',
      telephone:      client.telephone      || '',
      email:          client.email          || '',
      adresse:        client.adresse        || '',
    })
    setEditId(client.id)
    setShowForm(true)
  }

  // AJOUT : clic sur un client -> ouvre "Nouvelle commande" pre-rempli
  // avec ses infos (adresse, type, tarif...), sans avoir a retaper
  function nouvelleCommandePourClient(client) {
    navigate('/commandes', { state: { clientPreselectionne: client.id } })
  }

  // AJOUT : historique complet des commandes d'un client — pas besoin
  // d'une nouvelle table, on lit juste `commandes` filtre par client_id
  async function ouvrirHistorique(client) {
    setClientHistorique(client)
    setChargementHistorique(true)
    const { data } = await supabase
      .from('commandes')
      .select('*, commandes_lignes(*)')
      .eq('client_id', client.id)
      .order('cree_le', { ascending: false })
    setCommandesHistorique(data || [])
    setChargementHistorique(false)
  }

  // AJOUT (2026-09) : suppression réelle d'un client, avec garde-fou —
  // vérifie D'ABORD s'il a des commandes (compte exact, sans charger les
  // lignes — { count: 'exact', head: true }) et bloque AVANT toute
  // tentative de DELETE si c'est le cas, plutôt que de laisser
  // remonter l'erreur de contrainte de clé étrangère brute de Postgres.
  async function demanderSuppressionClient(client) {
    setErreurMsg(null)
    const { count, error } = await supabase
      .from('commandes')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', client.id)
    if (error) {
      setErreurMsg(`Impossible de vérifier les commandes de ce client : ${error.message}`)
      return
    }
    if (count > 0) {
      setErreurMsg(`Ce client a ${count} commande${count > 1 ? 's' : ''}, impossible de le supprimer.`)
      return
    }
    setConfirmSuppression(client)
  }

  async function confirmerSuppressionClient() {
    const client = confirmSuppression
    if (!client) return
    setSuppressionEnCours(true)
    try {
      // Même piège RLS que handleSauvegarder() ci-dessus — un DELETE
      // bloqué par RLS renvoie error:null avec 0 ligne affectée, jamais
      // remonté sans .select() + vérification explicite.
      const { data, error } = await supabase.from('clients').delete().eq('id', client.id).select()
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error("0 ligne supprimée — probable blocage RLS sur la table clients pour ce rôle.")
      }
      setConfirmSuppression(null)
      setSuccessMsg('Client supprimé')
      await fetchClients()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setConfirmSuppression(null)
      setErreurMsg(`Erreur lors de la suppression : ${err.message}`)
    } finally {
      setSuppressionEnCours(false)
    }
  }

  async function handleSauvegarder(e) {
    e.preventDefault()
    setSaving(true)
    try {
      // MODIFIÉ : secteur est un ENUM en base — "" (chaine vide) est
      // rejete, il faut envoyer null explicitement (cas Particulier,
      // champ cache donc jamais rempli)
      const payload = { ...form, secteur: form.secteur || null }

      if (editId) {
        const { data, error } = await supabase.from('clients')
          .update({ ...payload, mis_a_jour_le: new Date().toISOString() })
          .eq('id', editId)
          .select()
        if (error) throw error
        if (!data || data.length === 0) {
          throw new Error("0 ligne modifiée — probable blocage RLS sur la table clients pour ce rôle.")
        }
        setSuccessMsg('Client mis à jour')
      } else {
        const { error } = await supabase.from('clients').insert(payload)
        if (error) throw error
        setSuccessMsg('Client créé')
      }
      await fetchClients()
      setShowForm(false)
      setForm(FORM_VIDE)
      setEditId(null)
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      alert(`Erreur : ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const clientsFiltres = clients.filter(c => {
    const matchSearch = !search ||
      c.nom_entreprise.toLowerCase().includes(search.toLowerCase()) ||
      c.telephone?.includes(search)
    const matchType = !filtreType || c.type_client === filtreType
    const matchMois = tousLesMois || (c.cree_le || '').slice(0, 7) === filtreMois
    return matchSearch && matchType && matchMois
  })

  // AJOUT : "Total clients ce mois-ci" — nombre de clients dont cree_le
  // tombe dans filtreMois (le mois actuellement sélectionné dans le filtre
  // "par mois d'ajout" ci-dessus), indépendamment du toggle "Tous les
  // mois" (qui ne fait que lever le filtre appliqué à la LISTE, sans
  // changer le mois sélectionné). Bornes .gte/.lt sur des chaînes
  // ISO YYYY-MM-DD — comparaison lexicographique, pas de Date/toISOString()
  // donc pas de piège de fuseau (même principe que premierJourMoisSuivantISO
  // ci-dessus, appliqué ici en comparaison de chaînes plutôt qu'en requête).
  const debutFiltreMois = `${filtreMois}-01`
  const finFiltreMois   = premierJourMoisSuivantISO(filtreMois)
  const totalClientsMois = clients.filter(c =>
    c.cree_le && c.cree_le >= debutFiltreMois && c.cree_le < finFiltreMois
  ).length
  const libelleFiltreMois = new Date(filtreMois + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-7xl mx-auto">

      {/* En-tête */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
          <p className="text-slate-500 text-sm mt-1">
            {clients.length} client{clients.length > 1 ? 's' : ''} actif{clients.length > 1 ? 's' : ''}
          </p>
        </div>
        {/* AJOUT : boutons d'import Excel/CSV et de scan à côté de "Nouveau client" */}
        <div className="flex gap-2">
          <button onClick={() => setShowScan(true)}
            className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors">
            <ScanLine size={16} /> Scanner
          </button>
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors">
            <Upload size={16} /> Importer
          </button>
          <button onClick={ouvrirCreation}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors shadow-sm">
            <Plus size={18} /> Nouveau client
          </button>
        </div>
      </div>

      {/* Succès */}
      {successMsg && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium">
          ✅ {successMsg}
        </div>
      )}

      {/* AJOUT (2026-09) : bannière d'erreur — blocage suppression (client
          avec commandes) ou échec de suppression. */}
      {erreurMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><AlertTriangle size={16} className="flex-shrink-0" /> {erreurMsg}</span>
          <button onClick={() => setErreurMsg(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div className="mb-8 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Building2 size={18} className="text-orange-500" />
              {editId ? 'Modifier le client' : 'Nouveau client'}
            </h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSauvegarder} className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Nom */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {form.type_client === 'Particulier' ? 'Nom complet *' : 'Nom *'}
              </label>
              <input type="text" value={form.nom_entreprise} required
                onChange={e => setForm({ ...form, nom_entreprise: e.target.value })}
                placeholder={form.type_client === 'Particulier' ? 'Ex : Mohamed Ali' : 'Ex : Hôtel Sheraton Djibouti'}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>

            {/* Type client — boutons visuels */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Type de client *</label>
              <div className="flex gap-3">
                {TYPES_CLIENT.map(type => (
                  <button key={type} type="button"
                    onClick={() => setForm({ ...form, type_client: type })}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
                      form.type_client === type
                        ? type === 'Distributeur' ? 'bg-purple-500 text-white border-purple-500'
                        : type === 'Entreprise'   ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}>
                    {type === 'Distributeur' ? '🏭' : type === 'Entreprise' ? '🏢' : '👤'} {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Secteur — MODIFIÉ : masque pour un Particulier (n'a pas de secteur d'activite) */}
            {form.type_client !== 'Particulier' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Secteur</label>
                <select value={form.secteur} onChange={e => setForm({ ...form, secteur: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white">
                  <option value="">— Choisir —</option>
                  {SECTEURS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {/* Contact — MODIFIÉ : masque pour un Particulier (redondant avec "Nom") */}
            {form.type_client !== 'Particulier' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom du contact</label>
                <input type="text" value={form.nom_contact}
                  onChange={e => setForm({ ...form, nom_contact: e.target.value })}
                  placeholder="Ex : Mohamed Ali"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            )}

            {/* Téléphone */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Téléphone</label>
              <input type="text" value={form.telephone}
                onChange={e => setForm({ ...form, telephone: e.target.value })}
                placeholder="77 00 00 00"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input type="email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="contact@..."
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>

            {/* Adresse */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Adresse</label>
              <input type="text" value={form.adresse}
                onChange={e => setForm({ ...form, adresse: e.target.value })}
                placeholder="Ex : Plateau du Serpent, Djibouti"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>

            {/* Boutons */}
            <div className="sm:col-span-2 flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="px-6 py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center gap-2">
                {saving ? <><Loader2 size={16} className="animate-spin" />Enregistrement...</> : editId ? 'Mettre à jour' : 'Créer le client'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors">
                Annuler
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white" />
        </div>

        {/* Filtre type */}
        <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-xl">
          {['', ...TYPES_CLIENT].map(t => (
            <button key={t} onClick={() => setFiltreType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filtreType === t ? 'bg-orange-500 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {t === '' ? 'Tous' : t}
              {t !== '' && <span className="ml-1 opacity-70">({clients.filter(c => c.type_client === t).length})</span>}
            </button>
          ))}
        </div>

        {/* AJOUT (2026-09) : filtre par mois d'ajout (clients.cree_le),
            même pattern que FacturesView.jsx — "Tous les mois" lève le
            filtre. */}
        <button onClick={() => setTousLesMois(!tousLesMois)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            tousLesMois ? 'bg-orange-500 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}>
          Tous les mois
        </button>
        {!tousLesMois && (
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
            <Calendar size={14} className="text-slate-400" />
            <input type="month" value={filtreMois}
              onChange={e => setFiltreMois(e.target.value)}
              className="text-sm focus:outline-none bg-transparent" />
          </div>
        )}

        {/* AJOUT : "Total clients ce mois-ci" — toujours calculé sur le
            mois actuellement sélectionné dans le filtre ci-dessus
            (filtreMois), qu'il soit appliqué à la liste ou non. */}
        <span className="flex items-center px-3 py-2 bg-orange-50 border border-orange-100 text-orange-700 rounded-xl text-sm font-medium">
          {totalClientsMois} nouveau{totalClientsMois > 1 ? 'x' : ''} client{totalClientsMois > 1 ? 's' : ''} — {libelleFiltreMois}
        </span>
      </div>

      {/* Liste */}
      {clientsFiltres.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
          <Building2 size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            {search || filtreType ? 'Aucun client trouvé' : 'Aucun client pour l\'instant'}
          </p>
          {!search && !filtreType && (
            <button onClick={ouvrirCreation}
              className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors">
              Créer le premier client
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50/50">
                {['Entreprise', 'Type', 'Contact', 'Téléphone', 'Crédit', 'Depuis', ''].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {clientsFiltres.map(client => (
                <tr key={client.id}
                  onClick={() => nouvelleCommandePourClient(client)}
                  className="hover:bg-orange-50/50 transition-colors cursor-pointer"
                  title="Cliquer pour créer une nouvelle commande pré-remplie">

                  {/* Nom */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Building2 size={16} className="text-orange-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{client.nom_entreprise}</p>
                        {client.secteur && <p className="text-xs text-slate-400">{client.secteur}</p>}
                      </div>
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <TypeClientBadge type={client.type_client} />
                      {/* AJOUT : badge tier (VIP/Retardataire) — Normal reste discret, non affiché */}
                      {tiersClients[client.id] === 'VIP' && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800">
                          <Star size={10} /> VIP
                        </span>
                      )}
                      {tiersClients[client.id] === 'Retardataire' && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
                          <Timer size={10} /> Retardataire
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Contact */}
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-700">{client.nom_contact || '—'}</p>
                    {client.adresse && (
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin size={10} /> {client.adresse}
                      </p>
                    )}
                  </td>

                  {/* Téléphone */}
                  <td className="px-6 py-4">
                    {client.telephone ? (
                      <p className="text-sm text-slate-700 flex items-center gap-1">
                        <Phone size={12} className="text-slate-400" /> {client.telephone}
                      </p>
                    ) : <span className="text-slate-300 text-sm">—</span>}
                  </td>

                  {/* Crédit */}
                  <td className="px-6 py-4">
                    {client.solde_credit > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-semibold">
                        <CreditCard size={11} /> {formatCurrency(client.solde_credit)}
                      </span>
                    ) : (
                      <span className="text-xs text-green-600 font-medium">✅ À jour</span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="px-6 py-4">
                    <p className="text-xs text-slate-400">{formatDate(client.cree_le)}</p>
                  </td>

                  {/* Action */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={e => { e.stopPropagation(); ouvrirHistorique(client) }}
                        title="Voir l'historique des commandes"
                        className="text-xs text-slate-500 hover:text-blue-600 font-medium px-3 py-1.5 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1">
                        <History size={13} /> Historique
                      </button>
                      <button onClick={e => { e.stopPropagation(); ouvrirModification(client) }}
                        className="text-xs text-orange-600 hover:text-orange-700 font-medium px-3 py-1.5 hover:bg-orange-50 rounded-lg transition-colors">
                        Modifier
                      </button>
                      {/* AJOUT (2026-09) : suppression réelle — admin/commercial uniquement */}
                      {peutSupprimerClient && (
                        <button onClick={e => { e.stopPropagation(); demanderSuppressionClient(client) }}
                          title="Supprimer ce client"
                          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium px-3 py-1.5 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={13} /> Supprimer
                        </button>
                      )}
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* AJOUT : modal d'import Excel/CSV */}
      {showImport && (
        <ImportClientsModal
          onClose={() => setShowImport(false)}
          onImported={fetchClients}
        />
      )}

      {/* AJOUT : modal de scan (OCR gratuit) */}
      {showScan && (
        <ScanClientsModal
          onClose={() => setShowScan(false)}
          onImported={fetchClients}
        />
      )}

      {/* AJOUT (2026-09) : confirmation de suppression — même style que
          commandesView/ModalConfirmation.jsx (pattern déjà en place
          ailleurs dans le projet), repris ici en JSX inline puisque
          ClientsView.jsx reste un fichier unique (pas encore découpé en
          sous-dossier comme CommandesView/MurDesCredits...). N'apparaît
          QUE si demanderSuppressionClient() a déjà confirmé que ce
          client n'a aucune commande. */}
      {confirmSuppression && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setConfirmSuppression(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl z-10 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" /> Confirmation
              </h2>
              <button onClick={() => setConfirmSuppression(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <p className="text-sm text-slate-600">
                Supprimer définitivement le client <strong>{confirmSuppression.nom_entreprise}</strong> ? Cette action est irréversible.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmSuppression(null)} disabled={suppressionEnCours}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-60">
                  Annuler
                </button>
                <button onClick={confirmerSuppressionClient} disabled={suppressionEnCours}
                  className="flex-1 py-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {suppressionEnCours ? <><Loader2 size={14} className="animate-spin" />Suppression...</> : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AJOUT : modal historique des commandes d'un client */}
      {clientHistorique && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setClientHistorique(null)} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl z-10 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <History size={18} className="text-blue-500" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">{clientHistorique.nom_entreprise}</h2>
                  <p className="text-xs text-slate-400">Historique des commandes</p>
                </div>
              </div>
              <button onClick={() => setClientHistorique(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {chargementHistorique ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : commandesHistorique.length === 0 ? (
              <div className="py-16 text-center">
                <ShoppingCart size={28} className="text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Aucune commande pour ce client</p>
              </div>
            ) : (
              <>
                {/* Récap en haut */}
                <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-slate-100 flex-shrink-0 bg-slate-50/50">
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Commandes</p>
                    <p className="text-lg font-bold text-slate-900">{commandesHistorique.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">CA total</p>
                    <p className="text-lg font-bold text-emerald-600">
                      {formatCurrency(commandesHistorique.reduce((s, c) => s + Number(c.montant_total || 0), 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Dernière commande</p>
                    <p className="text-sm font-semibold text-slate-700">{formatDate(commandesHistorique[0]?.cree_le)}</p>
                  </div>
                </div>

                {/* Liste des commandes */}
                <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
                  {commandesHistorique.map(cmd => (
                    <div key={cmd.id} className="px-6 py-3.5 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-mono font-semibold text-orange-600">{cmd.numero_facture || '—'}</p>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{cmd.cas_vente}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatDate(cmd.cree_le)} —{' '}
                          {(cmd.commandes_lignes || []).map(l => `${l.quantite} ${l.unite}${l.quantite > 1 ? 's' : ''}`).join(', ') || 'Aucune ligne'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-slate-900">{formatCurrency(cmd.montant_total)}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          ['Payee','Facture_acquittee','Facture_et_livree'].includes(cmd.statut) ? 'bg-green-100 text-green-700' :
                          cmd.statut === 'Annulee' ? 'bg-red-100 text-red-700' :
                          cmd.statut === 'Livree_creance_active' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {cmd.statut?.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}