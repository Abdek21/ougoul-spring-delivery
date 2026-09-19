// ============================================================
// Rapport Hebdomadaire automatique
// - Compilé depuis les saisies quotidiennes de la semaine
// - Un rapport par employé
// - Prêt à présenter à la direction
// ============================================================

import { useEffect, useState } from 'react'
import { FileText, RefreshCw, CheckCircle, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'
import { sanitizeFilename } from '../../lib/export'

export default function RapportHebdoView() {
  const [rapports, setRapports]   = useState([]) // Un rapport par utilisateur
  const [loading, setLoading]     = useState(true)
  const [generating, setGenerating] = useState(false)
  const [semaine, setSemaine]     = useState(getSemaineActuelle())

  // Calcule le lundi et dimanche de la semaine en cours
  function getSemaineActuelle() {
    const now    = new Date()
    const jour   = now.getDay() === 0 ? 7 : now.getDay()
    const lundi  = new Date(now)
    lundi.setDate(now.getDate() - jour + 1)
    const dimanche = new Date(lundi)
    dimanche.setDate(lundi.getDate() + 6)
    return {
      debut:  lundi.toISOString().split('T')[0],
      fin:    dimanche.toISOString().split('T')[0],
    }
  }

  useEffect(() => {
    genererRapport()
  }, [semaine])

  // Génère le rapport en agrégeant les saisies de la semaine
  async function genererRapport() {
    setGenerating(true)

    // Récupère toutes les saisies de la semaine avec les infos associées
    const { data: saisies } = await supabase
      .from('suivi_quotidien')
      .select(`
        *,
        taches_types(libelle, categorie),
        profiles(nom_complet, role)
      `)
      .gte('date_saisie', semaine.debut)
      .lte('date_saisie', semaine.fin)
      .order('date_saisie')

    if (!saisies) {
      setRapports([])
      setGenerating(false)
      setLoading(false)
      return
    }

    // Groupe par utilisateur
    const parUtilisateur = {}
    saisies.forEach(s => {
      const uid = s.utilisateur_id
      if (!parUtilisateur[uid]) {
        parUtilisateur[uid] = {
          utilisateur_id: uid,
          nom:   s.profiles?.nom_complet || 'Inconnu',
          role:  s.profiles?.role        || '—',
          saisies: [],
          parJour: {},
          parCategorie: {},
        }
      }

      // Groupe par jour
      if (!parUtilisateur[uid].parJour[s.date_saisie]) {
        parUtilisateur[uid].parJour[s.date_saisie] = []
      }
      parUtilisateur[uid].parJour[s.date_saisie].push(s)

      // Groupe par catégorie
      const cat = s.taches_types?.categorie || 'Autre'
      if (!parUtilisateur[uid].parCategorie[cat]) {
        parUtilisateur[uid].parCategorie[cat] = 0
      }
      parUtilisateur[uid].parCategorie[cat]++

      parUtilisateur[uid].saisies.push(s)
    })

    setRapports(Object.values(parUtilisateur))
    setGenerating(false)
    setLoading(false)
  }

  // AJOUT : export Excel — une feuille "Résumé" (mêmes chiffres que ceux
  // affichés à l'écran : total par employé + répartition par catégorie)
  // et une feuille "Détail" (une ligne par saisie), plutôt qu'une feuille
  // par employé — plus simple, pas de risque de nom de feuille invalide/
  // dupliqué si deux employés partagent un prénom.
  function exporterExcel() {
    if (rapports.length === 0) {
      alert('Aucune saisie à exporter pour cette semaine.')
      return
    }

    const resume = []
    rapports.forEach(r => {
      resume.push({ 'Employé': r.nom, 'Rôle': r.role, 'Catégorie': 'TOTAL', 'Nombre': r.saisies.length })
      Object.entries(r.parCategorie).forEach(([cat, count]) => {
        resume.push({ 'Employé': r.nom, 'Rôle': r.role, 'Catégorie': cat.replace(/_/g, ' '), 'Nombre': count })
      })
    })

    const detail = rapports.flatMap(r =>
      r.saisies.map(s => ({
        'Employé':     r.nom,
        'Rôle':        r.role,
        'Date':        formatDate(s.date_saisie),
        'Tâche':       s.taches_types?.libelle || '',
        'Catégorie':   (s.taches_types?.categorie || 'Autre').replace(/_/g, ' '),
        'Commentaire': s.commentaire || '',
      }))
    )

    const feuilleResume = XLSX.utils.json_to_sheet(resume)
    feuilleResume['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 22 }, { wch: 10 }]

    const feuilleDetail = XLSX.utils.json_to_sheet(detail)
    feuilleDetail['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 30 }, { wch: 20 }, { wch: 30 }]

    const classeur = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(classeur, feuilleResume, 'Résumé')
    XLSX.utils.book_append_sheet(classeur, feuilleDetail, 'Détail')
    XLSX.writeFile(classeur, `Rapport_Hebdo_${sanitizeFilename(semaine.debut)}_au_${sanitizeFilename(semaine.fin)}.xlsx`)
  }

  // Couleur badge rôle
  function RoleBadge({ role }) {
    const map = {
      admin:      'bg-purple-100 text-purple-700',
      commercial: 'bg-blue-100 text-blue-700',
      logistique: 'bg-green-100 text-green-700',
    }
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[role] || 'bg-gray-100 text-gray-600'}`}>
        {role}
      </span>
    )
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* ── En-tête ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rapport Hebdomadaire</h1>
          <p className="text-slate-500 text-sm mt-1">
            Semaine du <span className="font-medium">{formatDate(semaine.debut)}</span> au <span className="font-medium">{formatDate(semaine.fin)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exporterExcel}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <Download size={16} />
            Exporter en Excel
          </button>
          <button
            onClick={genererRapport}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {/* ── Aucune donnée ── */}
      {rapports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
          <FileText size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Aucune saisie de tâches cette semaine</p>
          <p className="text-slate-300 text-xs mt-1">Les employés doivent cocher leurs tâches dans "Mes Tâches"</p>
        </div>
      ) : (
        <div className="space-y-6">
          {rapports.map(rapport => (
            <div key={rapport.utilisateur_id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

              {/* En-tête employé */}
              <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {rapport.nom.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{rapport.nom}</p>
                    <RoleBadge role={rapport.role} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">{rapport.saisies.length}</p>
                  <p className="text-xs text-slate-400">actions cette semaine</p>
                </div>
              </div>

              {/* Résumé par catégorie */}
              <div className="px-6 py-4 border-b border-slate-50">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Répartition des activités
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(rapport.parCategorie).map(([cat, count]) => (
                    <div key={cat} className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg">
                      <span className="text-sm font-bold text-slate-900">{count}</span>
                      <span className="text-xs text-slate-500">{cat.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Détail jour par jour */}
              <div className="px-6 py-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                  Détail jour par jour
                </p>
                <div className="space-y-4">
                  {Object.entries(rapport.parJour)
                    .sort(([a], [b]) => new Date(a) - new Date(b))
                    .map(([date, saisies]) => (
                      <div key={date}>
                        {/* Date du jour */}
                        <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-400 rounded-full" />
                          {formatDate(date)}
                          <span className="text-xs font-normal text-slate-400">
                            ({saisies.length} action{saisies.length > 1 ? 's' : ''})
                          </span>
                        </p>
                        {/* Tâches du jour */}
                        <div className="ml-4 space-y-1.5">
                          {saisies.map(s => (
                            <div key={s.id} className="flex items-start gap-2">
                              <CheckCircle size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm text-slate-700">{s.taches_types?.libelle}</p>
                                {s.commentaire && (
                                  <p className="text-xs text-slate-400 italic">→ {s.commentaire}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  )
}