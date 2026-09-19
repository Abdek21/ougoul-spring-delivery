import { useEffect, useState } from 'react'
import {
  Users, Plus, X, Loader2, AlertTriangle, FileDown,
  CheckCircle, Clock, Trash2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency } from '../../lib/utils'
import { genererBulletinPDF } from '../../lib/pdf'

const MOIS_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const MODES_PAIEMENT = ['Especes', 'Cheque', 'Virement', 'D_Money', 'Waafi', 'CAC']
const MODE_LABELS = { Especes: 'Espèces', Cheque: 'Chèque', Virement: 'Virement', D_Money: 'D-Money', Waafi: 'Waafi', CAC: 'CAC' }

const emptyGenForm = {
  retenue_absence: '0',
}

export default function BulletinsPaieView() {
  const { user, role } = useAuth()
  // AJOUT : RH consulte uniquement — Ibrahim (comptable) garde toute
  // l'ecriture (generation, paiement, suppression). Decision explicite :
  // "la paie reste chez Ibrahim, RH juste en consultation".
  const lectureSeuleRH = role === 'rh'

  const now = new Date()
  const [mois, setMois] = useState(now.getMonth() + 1)
  const [annee, setAnnee] = useState(now.getFullYear())

  const [employes, setEmployes] = useState([])
  const [salaires, setSalaires] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modal génération bulletin
  const [empSelectionne, setEmpSelectionne] = useState(null)
  const [declarationCnss, setDeclarationCnss] = useState(null)
  const [genForm, setGenForm] = useState(emptyGenForm)
  const [lignesForm, setLignesForm] = useState([])
  const [saving, setSaving] = useState(false)

  // Modal paiement
  const [salaireAPayer, setSalaireAPayer] = useState(null)
  const [modePaiement, setModePaiement] = useState('Especes')
  const [datePaiement, setDatePaiement] = useState(now.toISOString().slice(0, 10))
  const [payingSaving, setPayingSaving] = useState(false)

  useEffect(() => { fetchData() }, [mois, annee])

  async function fetchData() {
    setLoading(true)
    setError(null)

    const { data: emps, error: errEmps } = await supabase
      .from('employes').select('*').eq('statut', 'Actif').order('nom', { ascending: true })

    const { data: sals, error: errSals } = await supabase
      .from('salaires').select('*, employes(*), salaires_lignes(*)').eq('mois', mois).eq('annee', annee)

    if (errEmps) setError(errEmps.message)
    if (errSals) setError(errSals.message)

    setEmployes(emps || [])
    setSalaires(sals || [])
    setLoading(false)
  }

  function salaireDe(employeId) {
    return salaires.find(s => s.employe_id === employeId)
  }

  function joursDansLeMois() {
    return new Date(annee, mois, 0).getDate()
  }

  async function openGenerer(emp) {
    if (lectureSeuleRH) return // AJOUT : garde-fou supplementaire
    setEmpSelectionne(emp)
    setGenForm(emptyGenForm)
    setLignesForm([])
    setError(null)
    setDeclarationCnss(null)

    const { data, error: errDecl } = await supabase
      .from('declarations_cnss')
      .select('*')
      .eq('employe_id', emp.id).eq('mois', mois).eq('annee', annee)
      .maybeSingle()

    if (errDecl) setError(errDecl.message)
    setDeclarationCnss(data)
  }

  function handleGenFormChange(e) {
    const { name, value, type, checked } = e.target
    setGenForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  function ajouterLigne(type) {
    setLignesForm([...lignesForm, { type, libelle: '', montant: '' }])
  }
  function supprimerLigne(i) {
    setLignesForm(lignesForm.filter((_, idx) => idx !== i))
  }
  function updateLigne(i, field, value) {
    const updated = [...lignesForm]
    updated[i][field] = value
    setLignesForm(updated)
  }

  function assiette() {
    return declarationCnss ? Number(declarationCnss.salaire_brut) : 0
  }
  function heuresSupInfo() {
    return declarationCnss ? Number(declarationCnss.heures_supplementaires || 0) : 0
  }
  function salaireBaseEffectif() {
    return Math.max(0, assiette() - heuresSupInfo())
  }
  function cnssPreview() {
    return declarationCnss ? Math.round(Number(declarationCnss.part_salariale)) : 0
  }
  function itsPreview() {
    return declarationCnss ? Math.round(Number(declarationCnss.its_calcule)) : 0
  }
  function waqfPreview() {
    return 400
  }

  function totalPrimesForm() {
    return lignesForm.filter(l => l.type === 'Prime').reduce((s, l) => s + (parseFloat(l.montant) || 0), 0)
  }
  function totalRetenuesForm() {
    return lignesForm.filter(l => l.type === 'Retenue').reduce((s, l) => s + (parseFloat(l.montant) || 0), 0)
  }

  function netAPayerPreview() {
    const absence = parseFloat(genForm.retenue_absence) || 0
    return assiette() - cnssPreview() - itsPreview() - waqfPreview() - absence + totalPrimesForm() - totalRetenuesForm()
  }

  async function handleGenererBulletin(e) {
    e.preventDefault()
    if (lectureSeuleRH) return
    setError(null)

    if (!declarationCnss) {
      setError('Aucun salaire brut CNSS enregistré pour ce mois. Va d\'abord dans CNSS → Déclaration mensuelle pour le saisir.')
      return
    }
    if (lignesForm.some(l => !l.libelle.trim() || l.montant === '')) {
      setError('Chaque prime/retenue doit avoir un libellé et un montant.')
      return
    }

    setSaving(true)

    const { data: nouveauSalaire, error: errInsert } = await supabase
      .from('salaires')
      .insert({
        employe_id: empSelectionne.id,
        mois, annee,
        salaire_base_effectif: salaireBaseEffectif(),
        heures_supplementaires: heuresSupInfo(),
        retenue_absence: parseFloat(genForm.retenue_absence) || 0,
        salaire_brut: assiette(),
        cnss_montant: cnssPreview(),
        its_montant: itsPreview(),
        waqf_montant: waqfPreview(),
        statut: 'A_payer',
        saisi_par: user.id,
      })
      .select()
      .single()

    if (errInsert) {
      setError(errInsert.message)
      setSaving(false)
      return
    }

    if (lignesForm.length > 0) {
      const { error: errLignes } = await supabase
        .from('salaires_lignes')
        .insert(lignesForm.map(l => ({
          salaire_id: nouveauSalaire.id,
          type: l.type,
          libelle: l.libelle.trim(),
          montant: parseFloat(l.montant),
        })))
      if (errLignes) {
        setError(errLignes.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    setEmpSelectionne(null)
    fetchData()
  }

  async function handleSupprimerBulletin(salaire) {
    if (lectureSeuleRH) return
    if (!confirm(`Supprimer le bulletin ${salaire.numero_bulletin} ? Cette action est irréversible.`)) return
    const { error } = await supabase.from('salaires').delete().eq('id', salaire.id)
    if (error) { alert(`Impossible de supprimer : ${error.message}`); return }
    fetchData()
  }

  function openPayer(salaire) {
    if (lectureSeuleRH) return
    setSalaireAPayer(salaire)
    setModePaiement('Especes')
    setDatePaiement(now.toISOString().slice(0, 10))
    setError(null)
  }

  async function handleConfirmerPaiement(e) {
    e.preventDefault()
    if (lectureSeuleRH) return
    setPayingSaving(true)
    setError(null)

    const emp = salaireAPayer.employes
    const { count } = await supabase.from('depenses').select('*', { count: 'exact', head: true })
    const numeroPiece = `DEP-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`

    const { data: depense, error: errDepense } = await supabase
      .from('depenses')
      .insert({
        numero_piece: numeroPiece,
        date_depense: datePaiement,
        numero_facture: null,
        fournisseur: 'N/A',
        libelle: `Salaire ${emp?.nom} ${emp?.prenom || ''} — ${MOIS_LABELS[mois - 1]} ${annee}`,
        mode_paiement: modePaiement,
        montant: salaireAPayer.net_a_payer,
        sans_facture: true,
        cree_par: user.id,
      })
      .select()
      .single()

    if (errDepense) {
      setError(`Erreur création dépense : ${errDepense.message}`)
      setPayingSaving(false)
      return
    }

    const { error: errUpdate } = await supabase
      .from('salaires')
      .update({ statut: 'Paye', mode_paiement: modePaiement, date_paiement: datePaiement, depense_id: depense.id })
      .eq('id', salaireAPayer.id)

    if (errUpdate) {
      setError(`Erreur mise à jour bulletin : ${errUpdate.message}`)
      setPayingSaving(false)
      return
    }

    setPayingSaving(false)
    setSalaireAPayer(null)
    fetchData()
  }

  async function telechargerPDF(salaire) {
    await genererBulletinPDF({
      numero_bulletin: salaire.numero_bulletin,
      mois: salaire.mois,
      annee: salaire.annee,
      employe: salaire.employes,
      salaire_base_effectif: salaire.salaire_base_effectif,
      heures_supplementaires: salaire.heures_supplementaires,
      salaire_brut: salaire.salaire_brut,
      cnss_montant: salaire.cnss_montant,
      its_montant: salaire.its_montant,
      waqf_montant: salaire.waqf_montant,
      retenue_absence: salaire.retenue_absence,
      lignes: salaire.salaires_lignes,
      net_a_payer: salaire.net_a_payer,
      statut: salaire.statut,
      mode_paiement: salaire.mode_paiement,
      date_paiement: salaire.date_paiement,
    })
  }

  const totalMois = salaires.reduce((s, sal) => s + Number(sal.net_a_payer || 0), 0)
  const totalPaye = salaires.filter(s => s.statut === 'Paye').reduce((s, sal) => s + Number(sal.net_a_payer || 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-6xl mx-auto">

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Bulletins de paie
            {/* AJOUT : badge lecture seule pour RH */}
            {lectureSeuleRH && (
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-500">
                👁️ Lecture seule
              </span>
            )}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {employes.length} employés actifs — {formatCurrency(totalMois)} total ce mois ({formatCurrency(totalPaye)} déjà payé)
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-xl">
          <select value={mois} onChange={e => setMois(Number(e.target.value))}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 focus:outline-none bg-transparent">
            {MOIS_LABELS.map((label, i) => <option key={i} value={i + 1}>{label}</option>)}
          </select>
          <select value={annee} onChange={e => setAnnee(Number(e.target.value))}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 focus:outline-none bg-transparent">
            {[annee - 1, annee, annee + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* AJOUT : bandeau explicatif pour RH */}
      {lectureSeuleRH && (
        <div className="flex items-center gap-2 p-3 mb-6 bg-blue-50 border border-blue-200 rounded-xl">
          <AlertTriangle size={14} className="text-blue-500 flex-shrink-0" />
          <p className="text-blue-700 text-sm">
            Consultation uniquement — la génération et le paiement des bulletins restent gérés par la comptabilité.
          </p>
        </div>
      )}

      {error && !empSelectionne && !salaireAPayer && (
        <div className="flex items-center gap-2 p-3 mb-6 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {employes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
          <Users size={32} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Aucun employé actif</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px]">
              <thead>
                <tr className="border-b border-slate-50 bg-slate-50/50">
                  {['Employé', 'Poste', 'Brut', 'CNSS (6%)', 'Net à payer', 'Statut', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {employes.map(emp => {
                  const sal = salaireDe(emp.id)
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">{emp.nom} {emp.prenom}</p>
                        {sal && <p className="text-xs font-mono text-orange-600 mt-0.5">{sal.numero_bulletin}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{emp.poste}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{sal ? formatCurrency(Math.round(sal.salaire_brut)) : '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{sal ? formatCurrency(Math.round(sal.cnss_montant)) : '—'}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-900">{sal ? formatCurrency(Math.round(sal.net_a_payer)) : '—'}</td>
                      <td className="px-4 py-3">
                        {!sal && <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-500">Non généré</span>}
                        {sal?.statut === 'A_payer' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700">
                            <Clock size={11} /> À payer
                          </span>
                        )}
                        {sal?.statut === 'Paye' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-700">
                            <CheckCircle size={11} /> Payé
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-nowrap">
                          {/* MODIFIÉ : bouton "Générer" masqué pour RH */}
                          {!sal && !lectureSeuleRH && (
                            <button onClick={() => openGenerer(emp)}
                              className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-xs hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-colors">
                              <Plus size={12} /> Générer
                            </button>
                          )}
                          {!sal && lectureSeuleRH && (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                          {sal && (
                            <>
                              {/* PDF reste visible pour RH — lecture seule n'empeche pas de consulter */}
                              <button onClick={() => telechargerPDF(sal)}
                                className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-xs hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors">
                                <FileDown size={12} /> PDF
                              </button>
                              {/* MODIFIÉ : Payer/Supprimer masques pour RH */}
                              {sal.statut === 'A_payer' && !lectureSeuleRH && (
                                <>
                                  <button onClick={() => openPayer(sal)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-xs hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-colors">
                                    <CheckCircle size={12} /> Payer
                                  </button>
                                  <button onClick={() => handleSupprimerBulletin(sal)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs hover:bg-red-50 transition-colors">
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal génération bulletin — inaccessible en pratique pour RH
          (bouton masque), garde-fou conserve pour eviter toute ouverture
          via un appel direct a openGenerer() */}
      {empSelectionne && !lectureSeuleRH && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEmpSelectionne(null)} />
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl z-10 overflow-hidden max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-slate-900">Générer le bulletin</h2>
              <button onClick={() => setEmpSelectionne(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-5">

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="font-semibold text-slate-900">{empSelectionne.nom} {empSelectionne.prenom}</p>
                <p className="text-xs text-slate-500 mt-0.5">{empSelectionne.poste} — {MOIS_LABELS[mois - 1]} {annee}</p>
                <p className="text-sm text-slate-600 mt-2">Salaire de base : <strong>{formatCurrency(empSelectionne.salaire_base)}</strong></p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleGenererBulletin} className="space-y-4">

                {!declarationCnss ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700">
                      Aucune donnée CNSS enregistrée pour {MOIS_LABELS[mois - 1]} {annee}.
                      Va d'abord dans <strong>CNSS → Déclaration mensuelle</strong> saisir le salaire de base + heures sup.
                    </p>
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-xl p-4 space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Salaire de base</span>
                      <span className="font-medium text-slate-800">{formatCurrency(salaireBaseEffectif())}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Heures supplémentaires</span>
                      <span className="font-medium text-slate-800">{formatCurrency(heuresSupInfo())}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-1.5 border-t border-slate-200">
                      <span className="text-slate-600 font-medium">Total brut (assiette CNSS)</span>
                      <span className="font-bold text-slate-900">{formatCurrency(assiette())}</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Retenue absences (DJF, optionnel)</label>
                  <input type="number" min="0" step="0.01" name="retenue_absence" value={genForm.retenue_absence}
                    onChange={handleGenFormChange}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>

                {lignesForm.length > 0 && (
                  <div className="space-y-3">
                    {lignesForm.map((ligne, i) => (
                      <div key={i} className="bg-slate-50 rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            ligne.type === 'Prime' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>{ligne.type}</span>
                          <button type="button" onClick={() => supprimerLigne(i)} className="text-slate-300 hover:text-red-400 transition-colors">
                            <X size={16} />
                          </button>
                        </div>
                        <input type="text" placeholder="Libellé (ex: Prime transport)" value={ligne.libelle}
                          onChange={e => updateLigne(i, 'libelle', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white" />
                        <input type="number" min="0" step="0.01" placeholder="Montant (DJF)" value={ligne.montant}
                          onChange={e => updateLigne(i, 'montant', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white" />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => ajouterLigne('Prime')}
                    className="flex-1 flex items-center justify-center gap-1 py-2 border border-green-200 text-green-600 rounded-lg text-xs font-medium hover:bg-green-50 transition-colors">
                    <Plus size={13} /> Prime / indemnité
                  </button>
                  <button type="button" onClick={() => ajouterLigne('Retenue')}
                    className="flex-1 flex items-center justify-center gap-1 py-2 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors">
                    <Plus size={13} /> Avance / autre retenue
                  </button>
                </div>

                <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                  <span className="text-sm text-slate-500">Total brut</span>
                  <span className="text-sm font-bold text-slate-900">{formatCurrency(assiette())}</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                    <span className="text-sm text-slate-500">CNSS (6% — automatique)</span>
                    <span className="text-sm font-bold text-slate-900">{formatCurrency(cnssPreview())}</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                    <span className="text-sm text-slate-500">ITS (barème 2022 — automatique)</span>
                    <span className="text-sm font-bold text-slate-900">{formatCurrency(itsPreview())}</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                    <span className="text-sm text-slate-500">Waqf (fixe)</span>
                    <span className="text-sm font-bold text-slate-900">{formatCurrency(waqfPreview())}</span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <div className="bg-orange-50 border border-orange-200 rounded-xl px-6 py-4 text-right">
                    <p className="text-xs text-slate-500 mb-1">Net à payer</p>
                    <p className="text-2xl font-bold text-orange-600">{formatCurrency(Math.round(netAPayerPreview()))}</p>
                  </div>
                </div>

                <button type="submit" disabled={saving || !declarationCnss}
                  className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving ? <><Loader2 size={16} className="animate-spin" />Génération...</> : 'Générer le bulletin'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal paiement — meme garde-fou */}
      {salaireAPayer && !lectureSeuleRH && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSalaireAPayer(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl z-10 overflow-hidden">

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Confirmer le paiement</h2>
              <button onClick={() => setSalaireAPayer(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="font-semibold text-slate-900">{salaireAPayer.employes?.nom} {salaireAPayer.employes?.prenom}</p>
                <p className="text-sm text-slate-600 mt-1">Net à payer : <strong>{formatCurrency(salaireAPayer.net_a_payer)}</strong></p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleConfirmerPaiement} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-2">Mode de règlement</label>
                  <div className="grid grid-cols-2 gap-2">
                    {MODES_PAIEMENT.map(mode => (
                      <button key={mode} type="button" onClick={() => setModePaiement(mode)}
                        className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                          modePaiement === mode ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200'
                        }`}>
                        {MODE_LABELS[mode]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Date de paiement</label>
                  <input type="date" value={datePaiement} onChange={e => setDatePaiement(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>

                <button type="submit" disabled={payingSaving}
                  className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {payingSaving ? <><Loader2 size={16} className="animate-spin" />Confirmation...</> : 'Confirmer le paiement'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}