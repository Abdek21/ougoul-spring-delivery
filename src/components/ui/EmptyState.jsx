// Composant affiché quand une liste est vide.
// Ex : "Aucun prospect trouvé", "Aucune commande ce jour"
//
// UTILISATION :
//   <EmptyState
//     icon="👥"
//     title="Aucun prospect"
//     description="Commencez par ajouter une fiche terrain."
//     action={<button>Ajouter un prospect</button>}
//   />

export default function EmptyState({ icon = '📭', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl mb-4">{icon}</span>
      <h3 className="text-base font-semibold text-slate-700 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-slate-400 max-w-xs">{description}</p>
      )}
      {/* Bouton d'action optionnel (ex : "Ajouter") */}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}