import { useState } from 'react'
import { Camera, X, Loader2, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * Widget de capture photo — utilisé sur toutes les fiches pour joindre
 * une photo du document papier d'origine.
 *
 * Props :
 * - photoUrl    : URL déjà uploadée (ou null)
 * - onChange(url) : appelé avec la nouvelle URL après upload (ou null si retirée)
 */
export default function UploadPhotoFiche({ photoUrl, onChange }) {
  const [uploading, setUploading] = useState(false)
  const [erreur, setErreur]       = useState(null)

  async function handleFichier(e) {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    setErreur(null)
    setUploading(true)

    const extension = fichier.name.split('.').pop()
    const chemin = `${crypto.randomUUID()}.${extension}`

    const { error } = await supabase.storage.from('fiches-photos').upload(chemin, fichier)
    if (error) {
      console.error('Erreur upload photo :', error)
      setErreur("Impossible d'envoyer la photo.")
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('fiches-photos').getPublicUrl(chemin)
    onChange(data.publicUrl)
    setUploading(false)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        Photo du document papier (optionnel)
      </label>

      {photoUrl ? (
        <div className="relative inline-block">
          <img src={photoUrl} alt="Document joint" className="w-32 h-32 object-cover rounded-xl border border-slate-200" />
          <button type="button" onClick={() => onChange(null)}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">
            <X size={13} />
          </button>
          <div className="absolute bottom-1 right-1 bg-green-500 text-white rounded-full p-1">
            <Check size={11} />
          </div>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-2 w-32 h-32 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-colors">
          {uploading ? (
            <Loader2 size={20} className="animate-spin text-orange-500" />
          ) : (
            <>
              <Camera size={20} className="text-slate-300" />
              <span className="text-xs text-slate-400 text-center px-2">Ajouter une photo</span>
            </>
          )}
          <input type="file" accept="image/*" capture="environment" onChange={handleFichier} disabled={uploading} className="hidden" />
        </label>
      )}

      {erreur && <p className="text-xs text-red-500 mt-1">{erreur}</p>}
    </div>
  )
}