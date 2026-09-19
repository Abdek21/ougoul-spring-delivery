// ============================================================
// Système de notifications — cloche avec badge
// MODIFIÉ : notifications personnalisées par rôle (avant : les
// mêmes alertes génériques pour tout le monde)
// ============================================================

import { useEffect, useState, useRef } from 'react'
import { Bell, Package, FileSignature, Clock, X, CheckCheck, FileCheck, Wallet, Truck, Receipt, AlertTriangle, Calendar, CheckSquare } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { SEUIL_ALERTE_STOCK_CARTONS } from '../../lib/stockUsine'

// AJOUT (demande Fatouma) : couleur de la cloche selon l'heure — vert le
// matin, ambre l'après-midi, rouge en soirée. Indépendant du contenu des
// notifications (contrairement à l'ancien "orange si urgent").
// CORRIGÉ (retour Fatouma) : le palier après-midi utilisait `orange-500`,
// mais tailwind.config.js réécrit toute la palette "orange" en VERT (le
// rebrand visuel de l'app — voir le commentaire dans ce fichier), donc ce
// palier rendait quasi identique au palier matin. `amber` n'est pas
// concerné par ce rebrand, d'où le passage sur cette palette pour avoir
// une vraie teinte chaude distincte. Chaque palier renvoie aussi un fond
// teinté + bordure (pas juste la couleur du trait de l'icône) pour que le
// changement soit net au premier coup d'œil, pas une nuance subtile.
const STYLE_CLOCHE = {
  vert:   { icon: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200' },
  ambre:  { icon: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  rouge:  { icon: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
}
function paletteClocheSelonHeure() {
  const h = new Date().getHours()
  if (h < 12) return 'vert'
  if (h < 17) return 'ambre'
  return 'rouge'
}

// AJOUT : bip court généré via Web Audio API — pas de fichier son à
// héberger. Note : les navigateurs bloquent l'audio tant que
// l'utilisateur n'a pas interagi au moins une fois avec la page (politique
// autoplay) ; si l'onglet est resté ouvert sans clic depuis le matin, le
// premier bip après 20h peut être silencieux jusqu'au prochain clic/fetch.
function jouerBipRappel() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  } catch (e) {
    // AudioContext indisponible ou bloqué — pas grave, la notification
    // visuelle reste affichée de toute façon
    console.warn('Son de notification indisponible :', e)
  }
}

export default function Notifications() {
  const { user, role } = useAuth()
  const [notifs, setNotifs]   = useState([])
  const [open, setOpen]       = useState(false)
  const [lues, setLues]       = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('notifs_lues') || '[]')) }
    catch { return new Set() }
  })
  const [paletteCloche, setPaletteCloche] = useState(paletteClocheSelonHeure)
  // AJOUT (retour Fatouma) : toast visible à l'écran pour le rappel 20h
  const [toastRappel, setToastRappel] = useState(null)
  const ref       = useRef(null)
  const navigate  = useNavigate()

  useEffect(() => {
    if (role) fetchNotifications()
    const interval = setInterval(() => {
      if (role) fetchNotifications()
      setPaletteCloche(paletteClocheSelonHeure())
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [role])

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // AJOUT (retour Fatouma) : le toast se ferme tout seul après 12s, ou
  // avant si l'utilisateur clique la croix
  useEffect(() => {
    if (!toastRappel) return
    const t = setTimeout(() => setToastRappel(null), 12000)
    return () => clearTimeout(t)
  }, [toastRappel])

  // ── Blocs de notifications, un par thème — appelés selon le rôle ──

  async function notifsStockFaible() {
    const { data: stock } = await supabase.from('v_stock_disponible').select('stock_bouteilles').single()
    const cartons = Math.floor((Number(stock?.stock_bouteilles) || 0) / 24)
    if (cartons >= SEUIL_ALERTE_STOCK_CARTONS) return []
    return [{
      id: 'stock-faible', icon: Package, color: 'text-red-500', bg: 'bg-red-50',
      titre: 'Stock faible', message: `Il reste seulement ${cartons} cartons au dépôt`,
      action: '/stocks', urgence: cartons < 50,
    }]
  }

  async function notifsContratsExpirant() {
    const { data } = await supabase.from('v_contrats_expirant').select('*')
    return (data || []).map(c => ({
      id: `contrat-${c.id}`, icon: FileSignature,
      color: c.jours_restants <= 7 ? 'text-red-500' : 'text-amber-500',
      bg:    c.jours_restants <= 7 ? 'bg-red-50' : 'bg-amber-50',
      titre: 'Contrat à renouveler', message: `${c.nom_entreprise} — expire dans ${c.jours_restants}j`,
      action: '/contrats', urgence: c.jours_restants <= 7,
    }))
  }

  async function notifsRelances() {
    const aujourdhui = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('prospects')
      .select('id, nom_entreprise, date_relance')
      .lte('date_relance', aujourdhui).eq('resultat', 'Prospect_actif')
    return (data || []).map(p => ({
      id: `relance-${p.id}`, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50',
      titre: 'Relance due', message: `${p.nom_entreprise} — à relancer aujourd'hui`,
      action: '/crm', urgence: false,
    }))
  }

  // AJOUT : fiches de la gestionnaire en attente de validation (commercial/admin)
  async function notifsFichesAValider() {
    const { count } = await supabase.from('fiches_commande')
      .select('*', { count: 'exact', head: true }).eq('statut', 'En_attente')
    if (!count) return []
    return [{
      id: 'fiches-a-valider', icon: FileCheck, color: 'text-amber-600', bg: 'bg-amber-50',
      titre: 'Fiches à valider', message: `${count} fiche${count > 1 ? 's' : ''} de la gestionnaire en attente`,
      action: '/fiches-validation', urgence: count >= 5,
    }]
  }

  // MODIFIÉ : commandes réellement en attente de planification (commercial/admin) —
  // corrige le bug de comptage (head:true renvoie data:null, pas un tableau)
  async function notifsCommandesEnAttente() {
    const { data } = await supabase.from('commandes')
      .select('id, statut, cas_vente')
      .in('statut', ['En_preparation', 'Facture_acquittee'])
      .eq('planifie_livraison', false)
    const eligibles = (data || []).filter(c =>
      c.cas_vente === 'Comptant' ? c.statut === 'Facture_acquittee' : c.statut === 'En_preparation'
    )
    if (eligibles.length === 0) return []
    return [{
      id: 'commandes-attente', icon: Clock, color: 'text-orange-500', bg: 'bg-orange-50',
      titre: 'Commandes en attente', message: `${eligibles.length} commande${eligibles.length > 1 ? 's' : ''} à planifier`,
      action: '/commandes-attente', urgence: eligibles.length >= 10,
    }]
  }

  // AJOUT : Comptant en attente d'encaissement (comptable/admin)
  async function notifsComptantAEncaisser() {
    const { data } = await supabase.from('commandes')
      .select('id').eq('cas_vente', 'Comptant').eq('statut', 'En_preparation')
    const n = data?.length || 0
    if (n === 0) return []
    return [{
      id: 'comptant-a-encaisser', icon: Wallet, color: 'text-red-500', bg: 'bg-red-50',
      titre: 'Comptant à encaisser', message: `${n} commande${n > 1 ? 's' : ''} en attente d'encaissement`,
      action: '/credits', urgence: n >= 3,
    }]
  }

  // AJOUT : créances Cas 3 dont l'échéance 24h est dépassée (comptable/admin)
  async function notifsCreancesRetard() {
    const { data } = await supabase.from('commandes')
      .select('id, date_livraison_ts, date_livraison')
      .eq('cas_vente', 'Credit').eq('statut', 'Livree_creance_active')
    const enRetard = (data || []).filter(c => {
      const base = c.date_livraison_ts || c.date_livraison
      if (!base) return false
      return (new Date(base).getTime() + 24 * 60 * 60 * 1000) <= Date.now()
    })
    if (enRetard.length === 0) return []
    return [{
      id: 'creances-retard', icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50',
      titre: 'Créances en retard', message: `${enRetard.length} client${enRetard.length > 1 ? 's' : ''} au-delà des 24h`,
      action: '/credits', urgence: true,
    }]
  }

  // AJOUT : commandes planifiées, sans chauffeur/véhicule affecté (logistique/admin)
  async function notifsCommandesAAffecter() {
    const { data: cmds } = await supabase.from('commandes')
      .select('id, statut, cas_vente')
      .in('statut', ['En_preparation', 'Facture_acquittee'])
      .eq('planifie_livraison', true)
    const eligibles = (cmds || []).filter(c =>
      c.cas_vente === 'Comptant' ? c.statut === 'Facture_acquittee' : c.statut === 'En_preparation'
    )
    const { data: livs } = await supabase.from('livraisons')
      .select('commande_id').in('statut', ['Planifiee', 'En_cours'])
    const planifiees = new Set(livs?.map(l => l.commande_id) || [])
    const nb = eligibles.filter(c => !planifiees.has(c.id)).length
    if (nb === 0) return []
    return [{
      id: 'commandes-a-affecter', icon: Truck, color: 'text-red-500', bg: 'bg-red-50',
      titre: 'À affecter', message: `${nb} commande${nb > 1 ? 's' : ''} sans chauffeur/véhicule`,
      action: '/livraisons', urgence: nb >= 5,
    }]
  }

  // AJOUT : documents véhicules (assurance/vignette) expirés ou proches (logistique/admin)
  async function notifsDocumentsVehicules() {
    const { data } = await supabase.from('vehicules').select('immatriculation, assurance_expiration, vignette_expiration').eq('actif', true)
    const dans30j = new Date(); dans30j.setDate(dans30j.getDate() + 30)
    const alertes = []
    data?.forEach(v => {
      if (v.assurance_expiration && new Date(v.assurance_expiration) <= dans30j) {
        alertes.push({ label: 'Assurance', immat: v.immatriculation, date: v.assurance_expiration })
      }
      if (v.vignette_expiration && new Date(v.vignette_expiration) <= dans30j) {
        alertes.push({ label: 'Vignette', immat: v.immatriculation, date: v.vignette_expiration })
      }
    })
    if (alertes.length === 0) return []
    return [{
      id: 'documents-vehicules', icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50',
      titre: 'Documents véhicules', message: `${alertes.length} document${alertes.length > 1 ? 's' : ''} à renouveler sous 30j`,
      action: '/livraisons', urgence: alertes.some(a => new Date(a.date) < new Date()),
    }]
  }

  // AJOUT : paiements admin + renouvellements soumis par la gestionnaire (logistique/admin)
  async function notifsFilesLogistique() {
    const [{ count: nbPaiements }, { count: nbRenouv }] = await Promise.all([
      supabase.from('paiements_administratifs').select('*', { count: 'exact', head: true }).eq('statut', 'En_attente'),
      supabase.from('fiches_renouvellement_document').select('*', { count: 'exact', head: true }).eq('statut', 'En_attente'),
    ])
    const result = []
    if (nbPaiements > 0) {
      result.push({
        id: 'paiements-admin', icon: Receipt, color: 'text-amber-600', bg: 'bg-amber-50',
        titre: 'Paiements admin à valider', message: `${nbPaiements} soumis par la gestionnaire`,
        action: '/livraisons', urgence: false,
      })
    }
    if (nbRenouv > 0) {
      result.push({
        id: 'renouvellements-doc', icon: FileCheck, color: 'text-amber-600', bg: 'bg-amber-50',
        titre: 'Renouvellements à valider', message: `${nbRenouv} document${nbRenouv > 1 ? 's' : ''} véhicule soumis`,
        action: '/livraisons', urgence: false,
      })
    }
    return result
  }

  // AJOUT : pour la gestionnaire — ses propres fiches rejetées, avec le motif
  async function notifsFichesRejeteesGestionnaire() {
    if (!user) return []
    const tables = [
      { table: 'fiches_commande', label: 'Fiche de commande', route: '/fiches/commande' },
      { table: 'fiches_enregistrement_distributeur', label: 'Fiche distributeur', route: '/fiches/distributeur' },
      { table: 'paiements_administratifs', label: 'Paiement administratif', route: '/fiches/paiements' },
      { table: 'fiches_renouvellement_document', label: 'Renouvellement document', route: '/fiches/documents' },
    ]
    const resultats = await Promise.all(tables.map(t =>
      supabase.from(t.table).select('id, motif_rejet').eq('cree_par', user.id).eq('statut', 'Rejetee')
    ))
    const notifs = []
    resultats.forEach((res, i) => {
      (res.data || []).forEach(f => {
        notifs.push({
          id: `rejet-${tables[i].table}-${f.id}`, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50',
          titre: `${tables[i].label} rejetée`, message: f.motif_rejet || 'Aucun motif renseigné',
          action: tables[i].route, urgence: true,
        })
      })
    })
    return notifs
  }

  // AJOUT (demande Fatouma) : rappel des tâches du jour pas encore
  // cochées, dès 20h. Déclenché une seule fois par jour (marqueur
  // localStorage, même pattern que `notifs_lues`) — sinon le bip
  // sonnerait à chaque cycle de fetchNotifications (toutes les 5 min).
  async function notifsTachesDuJour() {
    if (!user || new Date().getHours() < 20) return []

    const { data: types } = await supabase.from('taches_types').select('id, libelle, roles').eq('actif', true)
    const typesRole = (types || []).filter(t => t.roles?.includes(role))
    if (typesRole.length === 0) return []

    const aujourdhui = new Date().toISOString().split('T')[0]
    const { data: saisies } = await supabase.from('suivi_quotidien')
      .select('tache_type_id').eq('utilisateur_id', user.id).eq('date_saisie', aujourdhui)
    const idsFaites = new Set((saisies || []).map(s => s.tache_type_id))

    const restantes = typesRole.filter(t => !idsFaites.has(t.id))
    if (restantes.length === 0) return []

    return [{
      id: `taches-rappel-${aujourdhui}`, icon: CheckSquare, color: 'text-red-500', bg: 'bg-red-50',
      titre: 'Tâches du jour', message: `${restantes.length} tâche${restantes.length > 1 ? 's' : ''} pas encore cochée${restantes.length > 1 ? 's' : ''}`,
      action: '/taches', urgence: true, sonUneFoisParJour: true,
      // AJOUT (retour Fatouma) : libellés des tâches restantes, affichés
      // dans le toast (pas juste le compteur)
      tachesRestantes: restantes.map(t => t.libelle),
    }]
  }

  // ── Répartition par rôle ──
  async function fetchNotifications() {
    let blocs = []

    if (role === 'admin') {
      blocs = await Promise.all([
        notifsStockFaible(), notifsContratsExpirant(), notifsRelances(),
        notifsFichesAValider(), notifsCommandesEnAttente(), notifsComptantAEncaisser(),
        notifsCreancesRetard(), notifsCommandesAAffecter(), notifsDocumentsVehicules(),
        notifsFilesLogistique(),
      ])
    } else if (role === 'commercial') {
      blocs = await Promise.all([
        notifsFichesAValider(), notifsCommandesEnAttente(), notifsRelances(), notifsContratsExpirant(),
        notifsTachesDuJour(),
      ])
    } else if (role === 'logistique') {
      blocs = await Promise.all([
        notifsCommandesAAffecter(), notifsDocumentsVehicules(), notifsFilesLogistique(), notifsStockFaible(),
      ])
    } else if (role === 'comptable') {
      blocs = await Promise.all([
        notifsComptantAEncaisser(), notifsCreancesRetard(),
      ])
    } else if (role === 'gestionnaire') {
      blocs = await Promise.all([
        notifsFichesRejeteesGestionnaire(),
      ])
    } else if (role === 'magasinier') {
      blocs = await Promise.all([
        notifsStockFaible(),
      ])
    }

    const toutesNotifs = blocs.flat()
    setNotifs(toutesNotifs)

    // Bip une seule fois par jour, dès que le rappel tâches apparaît
    const rappelTaches = toutesNotifs.find(n => n.sonUneFoisParJour)
    if (rappelTaches) {
      const cleSon = `notif_son_${rappelTaches.id}`
      if (!localStorage.getItem(cleSon)) {
        jouerBipRappel()
        localStorage.setItem(cleSon, '1')
        // AJOUT (retour Fatouma) : rappel visible à l'écran, pas
        // seulement dans le menu déroulant de la cloche — même
        // déclencheur, une fois par jour, que le bip.
        setToastRappel(rappelTaches)
      }
    }
  }

  function marquerToutesLues() {
    const ids = new Set(notifs.map(n => n.id))
    setLues(ids)
    localStorage.setItem('notifs_lues', JSON.stringify([...ids]))
  }

  function handleClick(notif) {
    const newLues = new Set([...lues, notif.id])
    setLues(newLues)
    localStorage.setItem('notifs_lues', JSON.stringify([...newLues]))
    setOpen(false)
    navigate(notif.action)
  }

  const nonLues = notifs.filter(n => !lues.has(n.id))

  return (
    <div ref={ref} className="relative">

      <button
        onClick={() => setOpen(!open)}
        className={`relative w-9 h-9 flex items-center justify-center rounded-xl border transition-all shadow-sm ${STYLE_CLOCHE[paletteCloche].bg} ${STYLE_CLOCHE[paletteCloche].border}`}
      >
        <Bell size={18} className={STYLE_CLOCHE[paletteCloche].icon} />
        {nonLues.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center ring-2 ring-white">
            {nonLues.length > 9 ? '9+' : nonLues.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden">

          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-orange-500" />
              <p className="font-semibold text-slate-900 text-sm">Notifications</p>
              {nonLues.length > 0 && (
                <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
                  {nonLues.length}
                </span>
              )}
            </div>
            {nonLues.length > 0 && (
              <button onClick={marquerToutesLues}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors">
                <CheckCheck size={13} /> Tout lire
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={24} className="text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Aucune notification</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifs.map(notif => {
                  const Icon = notif.icon
                  const estLue = lues.has(notif.id)
                  return (
                    <button
                      key={notif.id}
                      onClick={() => handleClick(notif)}
                      className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left ${
                        !estLue ? 'bg-orange-50/30' : ''
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${notif.bg}`}>
                        <Icon size={15} className={notif.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-900">{notif.titre}</p>
                          {notif.urgence && (
                            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
                              Urgent
                            </span>
                          )}
                          {!estLue && (
                            <div className="w-2 h-2 bg-orange-500 rounded-full ml-auto flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{notif.message}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {notifs.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-400 text-center">
                {notifs.length} alerte{notifs.length > 1 ? 's' : ''} active{notifs.length > 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}

      {/* AJOUT (retour Fatouma) : toast — rappel visible directement à
          l'écran, pas seulement dans le menu déroulant de la cloche.
          Aucun pattern de toast n'existait ailleurs dans le projet,
          composant simple en position fixe. */}
      {toastRappel && (
        <div className="fixed bottom-6 right-6 z-[100] w-80 bg-white rounded-2xl border border-red-200 shadow-2xl overflow-hidden">
          <div className="flex items-start gap-3 p-4">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <CheckSquare size={16} className="text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">Tâches du jour</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {toastRappel.tachesRestantes.length} tâche{toastRappel.tachesRestantes.length > 1 ? 's' : ''} pas encore cochée{toastRappel.tachesRestantes.length > 1 ? 's' : ''} :
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {toastRappel.tachesRestantes.slice(0, 4).map((libelle, i) => (
                  <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0 mt-1.5" /> {libelle}
                  </li>
                ))}
                {toastRappel.tachesRestantes.length > 4 && (
                  <li className="text-xs text-slate-400">+ {toastRappel.tachesRestantes.length - 4} autre{toastRappel.tachesRestantes.length - 4 > 1 ? 's' : ''}</li>
                )}
              </ul>
              <button onClick={() => { setToastRappel(null); navigate('/taches') }}
                className="mt-2.5 text-xs font-medium text-orange-600 hover:text-orange-700">
                Voir mes tâches →
              </button>
            </div>
            <button onClick={() => setToastRappel(null)} className="text-slate-300 hover:text-slate-500 flex-shrink-0">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}