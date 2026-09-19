// ============================================================
// Module Tâches quotidiennes
// - Saisie en un clic des tâches de la journée
// - Filtré par rôle automatiquement
// - Historique de la semaine
// ============================================================

import { useEffect, useState } from 'react'
import { CheckSquare, Square, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../lib/utils'

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export default function TachesView() {
  const { user, profile, role } = useAuth()
  const [tachesTypes, setTachesTypes]     = useState([]) // Catalogue des tâches
  const [saisiesAujourdhui, setSaisies]   = useState([]) // Tâches cochées aujourd'hui
  const [historique, setHistorique]       = useState([]) // Saisies de la semaine
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(null) // id de la tâche en cours de sauvegarde
  const [commentaires, setCommentaires]   = useState({})  // { tache_id: 'commentaire' }

  // Date d'aujourd'hui au format YYYY-MM-DD
  const aujourdhui = new Date().toISOString().split('T')[0]

  // Jour de la semaine en français
  const jourActuel = JOURS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]

  useEffect(() => {
    if (user) {
      fetchTachesTypes()
      fetchSaisiesAujourdhui()
      fetchHistoriqueSemaine()
    }
  }, [user])

  // Charge le catalogue des tâches filtrées par rôle
  async function fetchTachesTypes() {
    const { data } = await supabase
      .from('taches_types')
      .select('*')
      .eq('actif', true)
      .order('ordre')

    // Filtre : garde seulement les tâches accessibles au rôle connecté
    const filtrees = data?.filter(t =>
      t.roles.includes(role)
    ) || []

    setTachesTypes(filtrees)
    setLoading(false)
  }

  // Charge les tâches déjà cochées aujourd'hui par cet utilisateur
  async function fetchSaisiesAujourdhui() {
    const { data } = await supabase
      .from('suivi_quotidien')
      .select('*, taches_types(libelle, categorie)')
      .eq('utilisateur_id', user.id)
      .eq('date_saisie', aujourdhui)

    setSaisies(data || [])

    // Pré-remplit les commentaires existants
    const cmts = {}
    data?.forEach(s => { cmts[s.tache_type_id] = s.commentaire || '' })
    setCommentaires(prev => ({ ...prev, ...cmts }))
  }

  // Charge l'historique des 7 derniers jours
  async function fetchHistoriqueSemaine() {
    const ilYa7Jours = new Date()
    ilYa7Jours.setDate(ilYa7Jours.getDate() - 6)

    const { data } = await supabase
      .from('suivi_quotidien')
      .select('*, taches_types(libelle, categorie)')
      .eq('utilisateur_id', user.id)
      .gte('date_saisie', ilYa7Jours.toISOString().split('T')[0])
      .order('date_saisie', { ascending: false })

    setHistorique(data || [])
  }

  // Vérifie si une tâche est déjà cochée aujourd'hui
  function estCochee(tacheTypeId) {
    return saisiesAujourdhui.some(s => s.tache_type_id === tacheTypeId)
  }

  // Coche ou décoche une tâche
  async function toggleTache(tache) {
    setSaving(tache.id)
    const dejaCochee = estCochee(tache.id)

    if (dejaCochee) {
      // Décoche : supprime la saisie
      await supabase
        .from('suivi_quotidien')
        .delete()
        .eq('utilisateur_id', user.id)
        .eq('tache_type_id', tache.id)
        .eq('date_saisie', aujourdhui)
    } else {
      // Coche : crée la saisie
      await supabase
        .from('suivi_quotidien')
        .insert({
          utilisateur_id: user.id,
          tache_type_id:  tache.id,
          date_saisie:    aujourdhui,
          commentaire:    commentaires[tache.id] || null,
        })
    }

    await fetchSaisiesAujourdhui()
    await fetchHistoriqueSemaine()
    setSaving(null)
  }

  // Sauvegarde le commentaire d'une tâche déjà cochée
  async function sauvegarderCommentaire(tacheTypeId) {
    await supabase
      .from('suivi_quotidien')
      .update({ commentaire: commentaires[tacheTypeId] || null })
      .eq('utilisateur_id', user.id)
      .eq('tache_type_id', tacheTypeId)
      .eq('date_saisie', aujourdhui)
  }

  // Groupe les tâches par catégorie pour l'affichage
  function grouperParCategorie(taches) {
    return taches.reduce((acc, t) => {
      const cat = t.categorie || 'Autre'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(t)
      return acc
    }, {})
  }

  // Groupe l'historique par date
  function grouperParDate(saisies) {
    return saisies.reduce((acc, s) => {
      const date = s.date_saisie
      if (!acc[date]) acc[date] = []
      acc[date].push(s)
      return acc
    }, {})
  }

  // Couleur par catégorie
  function getCategorieColor(categorie) {
    const map = {
      Prospection:    'bg-blue-100 text-blue-700',
      Suivi_client:   'bg-green-100 text-green-700',
      Livraison:      'bg-amber-100 text-amber-700',
      Administration: 'bg-purple-100 text-purple-700',
      Reunion:        'bg-cyan-100 text-cyan-700',
      Autre:          'bg-slate-100 text-slate-600',
    }
    return map[categorie] || map.Autre
  }

  const tachesGroupees  = grouperParCategorie(tachesTypes)
  const historiqueGroupe = grouperParDate(historique)
  const nbCochees       = saisiesAujourdhui.length

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* ── En-tête ── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Mes Tâches</h1>
        <p className="text-slate-500 text-sm mt-1">
          {jourActuel} {formatDate(aujourdhui)} —
          <span className="ml-1 font-medium text-blue-600">
            {nbCochees} tâche{nbCochees > 1 ? 's' : ''} réalisée{nbCochees > 1 ? 's' : ''} aujourd'hui
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Colonne gauche : Saisie du jour ── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">

            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-slate-900">Saisie du jour</h2>
              {/* Barre de progression */}
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${tachesTypes.length > 0 ? (nbCochees / tachesTypes.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {nbCochees}/{tachesTypes.length}
                </span>
              </div>
            </div>

            {/* Tâches groupées par catégorie */}
            {Object.entries(tachesGroupees).map(([categorie, taches]) => (
              <div key={categorie} className="mb-5">
                {/* En-tête catégorie */}
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {categorie.replace(/_/g, ' ')}
                </p>
                <div className="space-y-2">
                  {taches.map(tache => {
                    const cochee    = estCochee(tache.id)
                    const enCours   = saving === tache.id

                    return (
                      <div key={tache.id}
                        className={`rounded-xl border transition-all ${
                          cochee
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                        }`}>

                        {/* Ligne principale : checkbox + libellé */}
                        <div
                          className="flex items-center gap-3 p-3 cursor-pointer"
                          onClick={() => !enCours && toggleTache(tache)}
                        >
                          {enCours ? (
                            <Loader2 size={20} className="text-blue-500 animate-spin flex-shrink-0" />
                          ) : cochee ? (
                            <CheckSquare size={20} className="text-blue-600 flex-shrink-0" />
                          ) : (
                            <Square size={20} className="text-slate-300 flex-shrink-0" />
                          )}
                          <span className={`text-sm font-medium flex-1 ${cochee ? 'text-blue-800' : 'text-slate-700'}`}>
                            {tache.libelle}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getCategorieColor(tache.categorie)}`}>
                            {tache.categorie?.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {/* Champ commentaire (visible seulement si cochée) */}
                        {cochee && (
                          <div className="px-3 pb-3">
                            <input
                              type="text"
                              value={commentaires[tache.id] || ''}
                              onChange={e => setCommentaires({ ...commentaires, [tache.id]: e.target.value })}
                              onBlur={() => sauvegarderCommentaire(tache.id)}
                              placeholder="Commentaire facultatif..."
                              className="w-full px-3 py-2 text-xs border border-blue-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-600 placeholder-slate-300"
                            />
                          </div>
                        )}

                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {tachesTypes.length === 0 && (
              <div className="text-center py-8">
                <CheckSquare size={32} className="text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Aucune tâche configurée pour votre rôle</p>
              </div>
            )}

          </div>
        </div>

        {/* ── Colonne droite : Historique semaine ── */}
        <div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Cette semaine</h2>

            {Object.keys(historiqueGroupe).length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-6">Aucune saisie cette semaine</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(historiqueGroupe).map(([date, saisies]) => (
                  <div key={date}>
                    {/* Date */}
                    <p className="text-xs font-semibold text-slate-400 mb-2">
                      {date === aujourdhui ? "Aujourd'hui" : formatDate(date)}
                    </p>
                    {/* Liste des tâches du jour */}
                    <div className="space-y-1">
                      {saisies.map(s => (
                        <div key={s.id} className="flex items-start gap-2">
                          <CheckSquare size={13} className="text-green-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-700 leading-tight">
                              {s.taches_types?.libelle}
                            </p>
                            {s.commentaire && (
                              <p className="text-xs text-slate-400 italic truncate">
                                "{s.commentaire}"
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}