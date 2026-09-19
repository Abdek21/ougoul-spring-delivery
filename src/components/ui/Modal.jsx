// Fenêtre modale réutilisable pour tous les formulaires.
// S'ouvre par-dessus la page avec un fond assombri.
//
// UTILISATION :
//   const [open, setOpen] = useState(false)
//   <Modal isOpen={open} onClose={() => setOpen(false)} title="Nouvelle commande">
//     <MonFormulaire />
//   </Modal>

import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  // Si la modale est fermée, on n'affiche rien du tout
  if (!isOpen) return null

  // Tailles disponibles pour la modale
  const sizes = {
    sm: 'max-w-md',  // Petite : 448px
    md: 'max-w-xl',  // Moyenne : 576px (par défaut)
    lg: 'max-w-2xl', // Grande : 672px
    xl: 'max-w-4xl', // Très grande : 896px
  }

  return (
    // Conteneur plein écran par-dessus tout le reste
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

      {/* Fond semi-transparent : clic dessus ferme la modale */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* La fenêtre modale elle-même */}
      <div className={cn(
        'relative w-full bg-white rounded-2xl shadow-xl z-10 max-h-[90vh] flex flex-col',
        sizes[size]
      )}>

        {/* En-tête : titre + bouton fermer */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

      </div>
    </div>
  )
}