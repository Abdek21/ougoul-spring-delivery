// ============================================================
// src/router/ProtectedRoute.jsx
//
// Composant "garde" : vérifie que l'utilisateur est connecté
// et qu'il a le bon rôle avant d'afficher une page.
//
// UTILISATION dans AppRouter.jsx :
//   <ProtectedRoute roles={['admin']}>
//     <DashboardView />
//   </ProtectedRoute>
// ============================================================

import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, roles }) {
  const { user, role, loading } = useAuth()

  // Pendant la vérification initiale, on affiche un écran de chargement
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Chargement...</p>
        </div>
      </div>
    )
  }

  // Pas connecté → rediriger vers la page de login
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Connecté mais rôle non autorisé pour cette page
  if (roles && !roles.includes(role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-5xl mb-4">🔒</p>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Accès refusé</h2>
          <p className="text-slate-500">Vous n'avez pas les droits pour accéder à cette page.</p>
        </div>
      </div>
    )
  }

  // Tout est bon → afficher la page demandée
  return children
}