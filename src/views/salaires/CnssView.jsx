import { useEffect, useState } from 'react'
import { ShieldCheck, Download, Pencil, X, Loader2, AlertTriangle, Check } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency } from '../../lib/utils'
import { sanitizeFilename } from '../../lib/export'

const MOIS_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

export default function CnssView() {
  const { user } = useAuth()
  const now = new Date()
  const [onglet, setOnglet] = useState('declaration')

  const [mois, setMois] = useState(now.getMonth() + 1)
  const [annee, setAnnee] = useState(now.getFullYear())
  const [employes, setEmployes] = useState([])
  const [declarations, setDeclarations] = useState([]) // v_declaration_cnss pour ce mois
  const [brutSaisie, setBrutSaisie] = useState({}) // employe_id -> heures sup en cours d'édition
  const [ligneEnSauvegarde, setLigneEnSauvegarde] = useState(null)

  const [empEnEdition, setEmpEnEdition] = useState(null)
  const [numeroCnssForm, setNumeroCnssForm] = useState('')
  const [dateNaissanceForm, setDateNaissanceForm] = useState('')
  const [saving, setSaving] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (onglet === 'declaration') fetchDeclaration()
    else fetchEmployes()
  }, [onglet, mois, annee])

  async function fetchDeclaration() {
    setLoading(true)
    setError(null)
    const [{ data: emps, error: errEmps }, { data: decls, error: errDecl }] = await Promise.all([
      supabase.from('employes').select('*').eq('statut', 'Actif').order('nom', { ascending: true }),
      supabase.from('v_declaration_cnss').select('*').eq('mois', mois).eq('annee', annee),
    ])
    if (errEmps) setError(errEmps.message)
    if (errDecl) setError(errDecl.message)
    setEmployes(emps || [])
    setDeclarations(decls || [])
    const init = {}
    ;(decls || []).forEach(d => { init[d.employe_id] = d.heures_supplementaires || 0 })
    setBrutSaisie(init)
    setLoading(false)
  }

  async function fetchEmployes() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.from('employes').select('*').order('nom', { ascending: true })
    if (error) setError(error.message)
    setEmployes(data || [])
    setLoading(false)
  }

  function declarationDe(employeId) {
    return declarations.find(d => d.employe_id === employeId)
  }

  async function sauvegarderBrut(employeId) {
    const heuresSup = parseFloat(brutSaisie[employeId]) || 0
    const emp = employes.find(e => e.id === employeId)
    if (!emp) return
    const assiette = Number(emp.salaire_base) + heuresSup

    setLigneEnSauvegarde(employeId)
    setError(null)

    const { error } = await supabase
      .from('declarations_cnss')
      .upsert({
        employe_id: employeId, mois, annee,
        heures_supplementaires: heuresSup,
        assiette: assiette,
        saisi_par: user.id,
      }, { onConflict: 'employe_id,mois,annee' })

    if (error) setError(error.message)
    setLigneEnSauvegarde(null)
    fetchDeclaration()
  }

  function openEdition(emp) {
    setEmpEnEdition(emp)
    setNumeroCnssForm(emp.numero_cnss || '')
    setDateNaissanceForm(emp.date_naissance || '')
    setError(null)
  }

  async function handleSauvegarderCnss(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('employes')
      .update({ numero_cnss: numeroCnssForm.trim() || null, date_naissance: dateNaissanceForm || null })
      .eq('id', empEnEdition.id)
    if (error) { setError(error.message); setSaving(false); return }
    setSaving(false)
    setEmpEnEdition(null)
    fetchEmployes()
  }

  function exporterDeclaration() {
    if (declarations.length === 0) {
      alert("Aucune déclaration saisie pour ce mois.")
      return
    }
    const donnees = declarations.map((d, i) => ({
      'NUM': i + 1,
      'NOM': `${d.nom} ${d.prenom || ''}`.trim(),
      'NUMERO IMMATRICULATION CNSS': d.numero_cnss || 'en cours',
      'DATE DE NAISSANCE': d.date_naissance || '',
      'FONCTION': d.poste,
      'SALAIRE BRUT MENSUEL': Math.round(Number(d.salaire_brut)),
      'CNSS': Math.round(Number(d.cotisation_cnss_totale)),
    }))
    const feuille = XLSX.utils.json_to_sheet(donnees)
    feuille['!cols'] = [{ wch: 5 }, { wch: 26 }, { wch: 20 }, { wch: 16 }, { wch: 26 }, { wch: 16 }, { wch: 14 }]
    const classeur = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(classeur, feuille, `${MOIS_LABELS[mois - 1]} ${annee}`)
    XLSX.writeFile(classeur, `Paiement_CNSS_${sanitizeFilename(MOIS_LABELS[mois - 1])}_${sanitizeFilename(annee)}.xlsx`)
  }

  const totalBrut = declarations.reduce((s, d) => s + Number(d.salaire_brut), 0)
  const totalCotisation = declarations.reduce((s, d) => s + Number(d.cotisation_cnss_totale), 0)

  return (
    <div className="p-8 max-w-6xl mx-auto">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck size={22} className="text-orange-500" /> CNSS
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {onglet === 'declaration'
              ? `Brut total : ${formatCurrency(Math.round(totalBrut))} — Cotisation CNSS (21,7%) : ${formatCurrency(Math.round(totalCotisation))}`
              : "Numéros d'immatriculation et dates de naissance"}
          </p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        <button onClick={() => setOnglet('declaration')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${onglet === 'declaration' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          Déclaration mensuelle
        </button>
        <button onClick={() => setOnglet('employes')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${onglet === 'employes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          Numéros CNSS des employés
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-6 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {onglet === 'declaration' && (
        <>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
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
            <button onClick={exporterDeclaration}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
              <Download size={14} /> Exporter Excel
            </button>
          </div>

          <p className="text-xs text-slate-400 mb-3">
            Le salaire de base vient de la fiche employé. Saisis uniquement les <strong>heures supplémentaires</strong> du mois, puis valide (✓ ou Entrée) — l'assiette, la CNSS (6%/21,7%) et l'ITS (barème 2022) se calculent automatiquement, et alimentent la génération du bulletin de paie.
          </p>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px]">
                <thead>
                  <tr className="border-b border-slate-50 bg-slate-50/50">
                    {['N°', 'Nom', 'N° CNSS', 'Fonction', 'Salaire base', 'Heures sup', 'Assiette', 'CNSS (6%)'].map(h => (
                      <th key={h} className="text-left px-3 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {employes.map((emp, i) => {
                    const decl = declarationDe(emp.id)
                    const heuresSupEnCours = brutSaisie[emp.id] ?? ''
                    const assietteEnCours = Number(emp.salaire_base) + (parseFloat(heuresSupEnCours) || 0)
                    const modifie = decl ? Number(heuresSupEnCours || 0) !== Number(decl.heures_supplementaires || 0) : Number(heuresSupEnCours || 0) !== 0 || !decl
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-3 text-sm text-slate-400">{i + 1}</td>
                        <td className="px-3 py-3 text-sm font-semibold text-slate-900">{emp.nom} {emp.prenom}</td>
                        <td className="px-3 py-3 text-xs font-mono text-slate-500">{emp.numero_cnss || 'en cours'}</td>
                        <td className="px-3 py-3 text-sm text-slate-600">{emp.poste}</td>
                        <td className="px-3 py-3 text-sm text-slate-500">{formatCurrency(emp.salaire_base)}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number" min="0" step="0.01"
                              value={heuresSupEnCours}
                              onChange={e => setBrutSaisie(prev => ({ ...prev, [emp.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') sauvegarderBrut(emp.id) }}
                              placeholder="0"
                              className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                            />
                            {modifie && (
                              <button onClick={() => sauvegarderBrut(emp.id)}
                                className="w-6 h-6 flex items-center justify-center rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors flex-shrink-0">
                                {ligneEnSauvegarde === emp.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm font-medium text-slate-700">{formatCurrency(Math.round(assietteEnCours))}</td>
                        <td className="px-3 py-3 text-sm font-bold text-slate-900">{decl ? formatCurrency(Math.round(decl.part_salariale)) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-100 bg-slate-50/50">
                    <td className="px-3 py-3 text-sm font-bold text-slate-900" colSpan={6}>TOTAL</td>
                    <td className="px-3 py-3 text-sm font-bold text-slate-900">{formatCurrency(Math.round(totalBrut))}</td>
                    <td className="px-3 py-3 text-sm font-bold text-orange-600">Cotisation 21,7% : {formatCurrency(Math.round(totalCotisation))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {onglet === 'employes' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-50 bg-slate-50/50">
                  {['Nom', 'Poste', 'N° CNSS', 'Date de naissance', 'Actions'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {employes.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-semibold text-slate-900">{emp.nom} {emp.prenom}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{emp.poste}</td>
                    <td className="px-5 py-3 text-xs font-mono text-slate-500">
                      {emp.numero_cnss || <span className="text-amber-600 font-sans">en cours</span>}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">
                      {emp.date_naissance ? new Date(emp.date_naissance).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <button onClick={() => openEdition(emp)}
                        className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-xs hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors">
                        <Pencil size={12} /> Modifier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {empEnEdition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEmpEnEdition(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl z-10 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{empEnEdition.nom} {empEnEdition.prenom}</h2>
              <button onClick={() => setEmpEnEdition(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSauvegarderCnss} className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}
              <div>
                <label className="block text-xs text-slate-500 mb-1">N° Immatriculation CNSS</label>
                <input type="text" value={numeroCnssForm} onChange={e => setNumeroCnssForm(e.target.value)}
                  placeholder="Ex: 170 274 466"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Date de naissance</label>
                <input type="date" value={dateNaissanceForm} onChange={e => setDateNaissanceForm(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                Enregistrer
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}