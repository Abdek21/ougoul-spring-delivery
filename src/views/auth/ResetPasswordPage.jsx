import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Droplets, Lock, CheckCircle, Loader2, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [readySession, setReadySession] = useState(false)

  useEffect(() => {
    // Supabase capte automatiquement le token present dans l'URL
    // (#access_token=...) et declenche PASSWORD_RECOVERY quand la
    // session de recuperation est prete.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReadySession(true)
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReadySession(true)
    }).catch(err => console.error('Erreur de vérification de session :', err))

    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(err.message || 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-5">
      <div className="w-full max-w-sm">

        {/* Logo — meme bloc que LoginView */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <Droplets size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-900 leading-tight">Ougoul Spring</p>
            <p className="text-xs text-slate-400">Système de pilotage</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7">

          {!readySession && !success && (
            <div className="flex flex-col items-center py-8 text-center">
              <Loader2 size={22} className="animate-spin text-orange-400 mb-3" />
              <p className="text-sm text-slate-500">Vérification du lien de réinitialisation...</p>
            </div>
          )}

          {readySession && success && (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={24} className="text-green-500" />
              </div>
              <h2 className="font-semibold text-slate-900 mb-1">Mot de passe mis à jour</h2>
              <p className="text-sm text-slate-400">Redirection vers la connexion...</p>
            </div>
          )}

          {readySession && !success && (
            <form onSubmit={handleSubmit}>
              <div className="flex items-center gap-2 mb-1">
                <Lock size={16} className="text-orange-500" />
                <h2 className="font-semibold text-slate-900">Nouveau mot de passe</h2>
              </div>
              <p className="text-xs text-slate-400 mb-5">Choisis un nouveau mot de passe pour ton compte.</p>

              {error && (
                <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                  <p className="text-red-600 text-xs">{error}</p>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Nouveau mot de passe</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Confirme le mot de passe</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full mt-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={15} className="animate-spin" />Mise à jour...</> : 'Valider'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  )
}