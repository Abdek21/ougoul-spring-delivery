import { useEffect, useState } from 'react'
import { ShieldAlert, Save, Loader2, FileText, History, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { numeroEnLettres, civiliteLongue, accordSalarie } from '../../lib/avertissements'
import { genererAvertissementPDF } from '../../lib/pdf'

const FORM_VIDE = {
  civilite: 'M.',
  date_avertissement: new Date().toISOString().slice(0, 10),
  objet: '',
  motif_court: '',
  motif_precedent: '',
  paragraphe_principal: '',
  paragraphe_consequences: '',
}

export default function AvertissementsView() {
  const { user } = useAuth()
  const [employes, setEmployes]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [saving, setSaving]       = useState(false)

  const [employeSelectionId, setEmployeSelectionId] = useState('')
  const [nomLibre, setNomLibre]           = useState('')
  const [fonctionLibre, setFonctionLibre] = useState('')

  const [form, setForm]           = useState(FORM_VIDE)
  const [historique, setHistorique] = useState([])
  const [dernierEnregistre, setDernierEnregistre] = useState(null)
  // Numéro normalement auto-calculé (max par employé + 1) mais
  // modifiable par le RH avant enregistrement — null tant qu'il n'a pas
  // été touché, auquel cas on utilise numeroPreview (voir plus bas).
  const [numeroEdite, setNumeroEdite] = useState(null)

  useEffect(() => { fetchEmployes() }, [])

  async function fetchEmployes() {
    const { data, error } = await supabase
      .from('employes')
      .select('id, nom, prenom, poste, statut')
      .order('nom', { ascending: true })
    if (error) setError(error.message)
    setEmployes(data || [])
    setLoading(false)
  }

  const estLibre     = employeSelectionId === 'autre'
  const employeChoisi = employes.find(e => e.id === employeSelectionId)
  const nom      = employeChoisi ? `${employeChoisi.nom} ${employeChoisi.prenom || ''}`.trim() : nomLibre.trim()
  const fonction = employeChoisi ? employeChoisi.poste : fonctionLibre.trim()

  useEffect(() => {
    const filtre = employeSelectionId && !estLibre
      ? { employe_id: employeSelectionId }
      : estLibre && nomLibre.trim()
        ? { employe_nom_libre: nomLibre.trim() }
        : null
    fetchHistorique(filtre)
  }, [employeSelectionId, estLibre, nomLibre])

  async function fetchHistorique(filtre) {
    if (!filtre) { setHistorique([]); return }
    let query = supabase
      .from('avertissements')
      .select('id, numero, date_avertissement, objet, motif_court')
      .order('numero', { ascending: false })
    query = filtre.employe_id
      ? query.eq('employe_id', filtre.employe_id)
      : query.is('employe_id', null).eq('employe_nom_libre', filtre.employe_nom_libre)
    const { data } = await query
    setHistorique(data || [])
  }

  const numeroPreview = historique.length > 0 ? historique[0].numero + 1 : 1
  const numero = dernierEnregistre?.numero ?? numeroEdite ?? numeroPreview

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function utiliserCommeMotifPrecedent(motif) {
    setForm(prev => ({ ...prev, motif_precedent: motif }))
  }

  async function handleSave() {
    setError(null)
    if (!nom || !fonction) {
      setError('Sélectionnez un employé ou renseignez nom et fonction (saisie libre).')
      return
    }
    if (!form.objet.trim() || !form.motif_court.trim() || !form.paragraphe_principal.trim() || !form.paragraphe_consequences.trim()) {
      setError('Objet, motif court, paragraphe principal et paragraphe conséquences sont obligatoires.')
      return
    }

    setSaving(true)
    const payload = {
      employe_id:             estLibre ? null : employeSelectionId,
      employe_nom_libre:      estLibre ? nomLibre.trim() : null,
      employe_fonction_libre: estLibre ? fonctionLibre.trim() : null,
      date_avertissement:     form.date_avertissement,
      objet:                  form.objet.trim(),
      motif_court:            form.motif_court.trim(),
      motif_precedent:        form.motif_precedent.trim() || null,
      paragraphe_principal:      form.paragraphe_principal.trim(),
      paragraphe_consequences:   form.paragraphe_consequences.trim(),
      civilite:               form.civilite,
      cree_par:                user.id,
      // numero : null si le RH n'a pas touché le champ — le trigger
      // serveur calcule alors max(numero)+1 par employé (protégé contre
      // une race condition entre 2 saisies concurrentes). S'il a été
      // modifié manuellement, la valeur choisie est respectée telle quelle.
      numero: numeroEdite,
    }

    const { data, error } = await supabase.from('avertissements').insert(payload).select().single()
    setSaving(false)
    if (error) { setError(error.message); return }

    setDernierEnregistre(data)
    setNumeroEdite(null)
    fetchHistorique(data.employe_id ? { employe_id: data.employe_id } : { employe_nom_libre: data.employe_nom_libre })
  }

  async function handleExportPDF() {
    await genererAvertissementPDF({
      numero, civilite: form.civilite, nom, fonction,
      date: form.date_avertissement, objet: form.objet,
      motifCourt: form.motif_court, motifPrecedent: form.motif_precedent,
      paragraphePrincipal: form.paragraphe_principal,
      paragrapheConsequences: form.paragraphe_consequences,
    })
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const afficheMotifPrecedent = numero > 1

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ShieldAlert size={22} className="text-orange-500" /> Avertissements
        </h1>
        <p className="text-slate-500 text-sm mt-1">Rédaction et historique des avertissements disciplinaires</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-6 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">

        {/* ── Colonne gauche : formulaire + historique ── */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">

            <div>
              <label className="block text-xs text-slate-500 mb-1">Employé *</label>
              <select
                value={employeSelectionId}
                onChange={e => { setEmployeSelectionId(e.target.value); setNomLibre(''); setFonctionLibre(''); setDernierEnregistre(null); setNumeroEdite(null) }}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
              >
                <option value="">— Sélectionner —</option>
                {employes.map(e => (
                  <option key={e.id} value={e.id}>{e.nom} {e.prenom} — {e.poste}</option>
                ))}
                <option value="autre">Autre / saisie libre</option>
              </select>
            </div>

            {estLibre && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Nom complet *</label>
                  <input
                    type="text" value={nomLibre} onChange={e => { setNomLibre(e.target.value); setDernierEnregistre(null); setNumeroEdite(null) }}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Fonction *</label>
                  <input
                    type="text" value={fonctionLibre} onChange={e => setFonctionLibre(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Civilité *</label>
                <div className="flex gap-1 bg-slate-50 border border-slate-200 p-1 rounded-xl w-fit">
                  {['M.', 'Mme'].map(c => (
                    <button
                      key={c} type="button"
                      onClick={() => setForm(prev => ({ ...prev, civilite: c }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        form.civilite === c ? 'bg-orange-500 text-white' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Date *</label>
                <input
                  type="date" name="date_avertissement" value={form.date_avertissement} onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Numéro</label>
                <input
                  type="number" min="1" value={numero}
                  onChange={e => setNumeroEdite(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <p className="text-xs text-slate-400 mt-1">Auto : {numeroPreview} — modifiable si besoin.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Objet *</label>
              <input
                type="text" name="objet" value={form.objet} onChange={handleChange}
                placeholder="Ex : Deuxième avertissement pour travail non effectué"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Motif court *</label>
              <input
                type="text" name="motif_court" value={form.motif_court} onChange={handleChange}
                placeholder="Ex : travail non rendu (quelques mots, pas une phrase complète)"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                Repris dans la phrase "un avertissement disciplinaire pour [motif court]" — les faits détaillés vont dans "Paragraphe principal" ci-dessous.
              </p>
            </div>

            {afficheMotifPrecedent && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Motif de l'avertissement précédent</label>
                <input
                  type="text" name="motif_precedent" value={form.motif_precedent} onChange={handleChange}
                  placeholder="Ex : non-respect de la hiérarchie"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-500 mb-1">Paragraphe principal (les faits) *</label>
              <textarea
                name="paragraphe_principal" value={form.paragraphe_principal} onChange={handleChange} rows={5}
                placeholder="Malgré un premier avertissement... délais demandés."
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Paragraphe conséquences *</label>
              <textarea
                name="paragraphe_consequences" value={form.paragraphe_consequences} onChange={handleChange} rows={4}
                placeholder="Ces manquements répétés perturbent... liées à votre poste de [fonction]."
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {dernierEnregistre ? 'Enregistré' : 'Enregistrer'}
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center justify-center gap-2 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                <FileText size={16} /> Exporter PDF
              </button>
            </div>
          </div>

          {historique.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
                <History size={15} className="text-orange-500" /> Historique de cet employé
              </h2>
              <div className="space-y-1.5">
                {historique.map(h => (
                  <button
                    key={h.id}
                    onClick={() => utiliserCommeMotifPrecedent(h.motif_court)}
                    title="Utiliser comme motif précédent"
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-slate-100 hover:bg-orange-50 hover:border-orange-200 transition-colors text-left"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-700">N°{h.numero} — {new Date(h.date_avertissement).toLocaleDateString('fr-FR')}</p>
                      <p className="text-xs text-slate-500">{h.objet}</p>
                    </div>
                    <span className="text-xs text-orange-600 font-medium whitespace-nowrap">{h.motif_court}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Colonne droite : aperçu en temps réel ── */}
        <div className="lg:sticky lg:top-6 self-start">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-sm text-slate-800 leading-relaxed font-serif">
            <p className="text-center font-bold">OUGOUL SPRING SARL</p>
            <p className="text-center font-bold mt-1">AVERTISSEMENT N°{numero}</p>
            <p className="text-center mt-1">Date : {form.date_avertissement ? new Date(form.date_avertissement).toLocaleDateString('fr-FR') : '—'}</p>

            <p className="mt-6">À l'attention de :</p>
            <p className="font-semibold">{form.civilite} {nom || '—'}</p>
            <p>Fonction : {fonction || '—'}</p>

            <p className="mt-4"><span className="font-semibold">Objet :</span> {form.objet || '—'}</p>

            <p className="mt-4">{civiliteLongue(form.civilite)}</p>

            <p className="mt-4 whitespace-pre-wrap">{form.paragraphe_principal || '—'}</p>

            {numero > 1 && form.motif_precedent.trim() && (
              <p className="mt-4">
                Ce manquement intervient après un {numeroEnLettres(numero - 1)} avertissement qui vous avait été
                adressé pour {form.motif_precedent}. Bien que les motifs soient différents, cette nouvelle faute
                traduit un manquement répété à vos obligations professionnelles et nuit au bon fonctionnement de
                l'entreprise.
              </p>
            )}

            <p className="mt-4">
              En conséquence, nous vous adressons par la présente un {numeroEnLettres(numero)} avertissement
              disciplinaire pour {form.motif_court || '—'}.
            </p>

            <p className="mt-4 whitespace-pre-wrap">{form.paragraphe_consequences || '—'}</p>

            <p className="mt-4">
              Par la présente, nous vous adressons un {numeroEnLettres(numero)} avertissement disciplinaire. Nous
              vous demandons de prendre immédiatement toutes les mesures nécessaires afin de respecter vos
              obligations professionnelles, d'exécuter les missions qui vous sont confiées et de remettre les
              travaux demandés dans les délais fixés.
            </p>

            <p className="mt-4">
              Nous vous informons qu'en cas de récidive ou de nouveaux manquements, l'entreprise se réserve le
              droit d'engager des mesures disciplinaires plus sévères, conformément au règlement intérieur et à
              la législation du travail en vigueur.
            </p>

            <p className="mt-4">
              Nous vous prions de bien vouloir signer le présent document pour attester de sa réception.
            </p>

            <p className="mt-6">Fait à ____________________, le {form.date_avertissement ? new Date(form.date_avertissement).toLocaleDateString('fr-FR') : '—'}</p>

            <p className="mt-6 font-semibold">La Direction</p>
            <p>Nom : ____________________</p>
            <p>Signature : ____________________</p>

            <p className="mt-6 font-semibold">{accordSalarie(form.civilite)}</p>
            <p>{form.civilite} {nom || '—'}</p>
            <p>Signature (précédée de la mention « Lu et reçu ») : ____________________</p>
          </div>
        </div>

      </div>
    </div>
  )
}
