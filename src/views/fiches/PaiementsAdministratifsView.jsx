import { useEffect, useState } from 'react'
import { Receipt, Plus, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import UploadPhotoFiche from '../../components/fiches/UploadPhotoFiche'
import { ModalFiche, BandeauErreur, ListeFiches } from '../../components/fiches/FichesUI'

const TYPES_PAIEMENT = {
  Patente:  { label: 'Patente',  icone: '🏛️' },
  CNSS:     { label: 'CNSS',     icone: '🩺' },
  EDD:      { label: 'EDD (Électricité)', icone: '⚡' },
  Internet: { label: 'Internet', icone: '🌐' },
  Autre:    { label: 'Autre',    icone: '📄' },
}

const FICHE_VIDE = { type_paiement: 'Patente', periode: '', montant: '', numero_reference: '' }

export default function PaiementsAdministratifsView() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [fiches, setFiches] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(FICHE_VIDE)
  const [photo, setPhoto] = useState(null)
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState(null)

  useEffect(() => { fetchFiches() }, [])

  async function fetchFiches() {
    setLoading(true)
    const { data } = await supabase
      .from('paiements_administratifs')
      .select('*')
      .eq('cree_par', user.id)
      .order('cree_le', { ascending: false })
    setFiches(data || [])
    setLoading(false)
  }

  function ouvrirForm(type) {
    setForm({ ...FICHE_VIDE, type_paiement: type })
    setPhoto(null)
    setErreur(null)
    setShowForm(true)
  }

  async function handleSoumettre(e) {
    e.preventDefault()
    setErreur(null)
    if (!form.montant || parseFloat(form.montant) <= 0) return setErreur('Le montant est obligatoire.')

    setSaving(true)
    const { error } = await supabase.from('paiements_administratifs').insert({
      ...form,
      montant: parseFloat(form.montant),
      photo_url: photo,
      cree_par: user.id,
    })
    if (error) { setErreur(`Erreur : ${error.message}`); setSaving(false); return }

    setShowForm(false)
    await fetchFiches()
    setSaving(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <Receipt size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Paiements administratifs</h1>
          <p className="text-sm text-slate-500">Patente, CNSS, EDD, Internet — validés par le logisticien</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Object.entries(TYPES_PAIEMENT).filter(([k]) => k !== 'Autre').map(([key, t]) => (
          <button key={key} onClick={() => ouvrirForm(key)}
            className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-orange-200 transition-all">
            <span className="text-2xl">{t.icone}</span>
            <span className="text-xs font-medium text-slate-700 text-center">{t.label}</span>
          </button>
        ))}
      </div>

      <button onClick={() => ouvrirForm('Autre')}
        className="mb-5 flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors">
        <Plus size={16} /> Autre paiement
      </button>

      <ListeFiches fiches={fiches} vide="Aucun paiement soumis" icon={Receipt}
        render={f => (
          <>
            <div className="flex items-center gap-2">
              <span>{TYPES_PAIEMENT[f.type_paiement]?.icone}</span>
              <p className="font-semibold text-slate-900">{TYPES_PAIEMENT[f.type_paiement]?.label || f.type_paiement}</p>
              {f.periode && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{f.periode}</span>}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {Math.round(f.montant).toLocaleString('fr-FR')} DJF {f.numero_reference && `· Réf. ${f.numero_reference}`}
            </p>
          </>
        )} />

      {showForm && (
        <ModalFiche titre={`Paiement — ${TYPES_PAIEMENT[form.type_paiement]?.label}`} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSoumettre} className="p-6 space-y-4">
            {erreur && <BandeauErreur message={erreur} />}

            {form.type_paiement === 'Autre' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Type de paiement</label>
                <select value={form.type_paiement} onChange={e => setForm({ ...form, type_paiement: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                  {Object.entries(TYPES_PAIEMENT).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Période concernée</label>
              <input type="text" value={form.periode} onChange={e => setForm({ ...form, periode: e.target.value })}
                placeholder="Ex : Juillet 2026"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Montant payé (DJF) *</label>
              <input type="number" min="0" value={form.montant} required
                onChange={e => setForm({ ...form, montant: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">N° de référence / facture (optionnel)</label>
              <input type="text" value={form.numero_reference} onChange={e => setForm({ ...form, numero_reference: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>

            <UploadPhotoFiche photoUrl={photo} onChange={setPhoto} />

            <p className="text-xs text-slate-400">
              Cette demande sera transmise au logisticien, qui la validera avant qu'elle devienne une dépense officielle.
            </p>

            <button type="submit" disabled={saving}
              className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 size={16} className="animate-spin" />Envoi...</> : 'Transmettre au logisticien'}
            </button>
          </form>
        </ModalFiche>
      )}
    </div>
  )
}