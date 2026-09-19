// ============================================================
// src/context/AuthContext.jsx
// ============================================================

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { AlertTriangle } from 'lucide-react'

const INACTIVITY_TIMEOUT = 30 * 60 * 1000  // 30 minutes
const WARNING_BEFORE     =  2 * 60 * 1000  // avertissement 2 min avant

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null)
  const [profile, setProfile]         = useState(null)
  const [loading, setLoading]         = useState(true)
  const [showWarning, setShowWarning] = useState(false)

  const timerWarning = useRef(null)
  const timerLogout  = useRef(null)

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.error('Erreur chargement profil :', error.message)
      return null
    }
    return data
  }

  const dernierReset = useRef(0)

  // ── Réinitialise les timers d'inactivité ──
  const resetTimer = useCallback(() => {
    // AJOUT : throttle — evite des centaines d'appels/seconde sur
    // mousemove, un reset toutes les 3s suffit largement
    const maintenant = Date.now()
    if (maintenant - dernierReset.current < 3000) return
    dernierReset.current = maintenant

    clearTimeout(timerWarning.current)
    clearTimeout(timerLogout.current)
    setShowWarning(false)

    // Avertissement 2 min avant
    timerWarning.current = setTimeout(() => {
      setShowWarning(true)
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE)

    // Déconnexion automatique
    timerLogout.current = setTimeout(async () => {
      setShowWarning(false)
      await supabase.auth.signOut()
    }, INACTIVITY_TIMEOUT)
  }, [])

  // ── Lance/arrête les timers selon si l'utilisateur est connecté ──
  useEffect(() => {
    if (!user) {
      // Pas connecté → on nettoie les timers
      clearTimeout(timerWarning.current)
      clearTimeout(timerLogout.current)
      setShowWarning(false)
      return
    }

    // Connecté → on démarre les timers
    // MODIFIÉ : "keypress" ne se déclenche pas pour Backspace, Delete,
    // les flèches ou Tab — remplacé par "keydown" (capture toutes les
    // touches) + "input" ajouté (couvre aussi le collage/autofill)
    const events = ['mousedown', 'mousemove', 'keydown', 'input', 'scroll', 'touchstart', 'click']
    events.forEach(e => window.addEventListener(e, resetTimer))
    resetTimer()

    return () => {
      clearTimeout(timerWarning.current)
      clearTimeout(timerLogout.current)
      events.forEach(e => window.removeEventListener(e, resetTimer))
    }
  }, [user, resetTimer])

  // ── Session Supabase ──
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        const p = await fetchProfile(session.user.id)
        setProfile(p)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUser(session.user)
          const p = await fetchProfile(session.user.id)
          setProfile(p)
        } else {
          setUser(null)
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    clearTimeout(timerWarning.current)
    clearTimeout(timerLogout.current)
    setShowWarning(false)
    await supabase.auth.signOut()
  }

  const value = {
    user,
    profile,
    role:         profile?.role || null,
    loading,
    signOut,
    isAdmin:      profile?.role === 'admin',
    isCommercial: profile?.role === 'commercial',
    isLogistique: profile?.role === 'logistique',
    isMagasinier: profile?.role === 'magasinier',
    isComptable:  profile?.role === 'comptable',
  }

  return (
    <AuthContext.Provider value={value}>
      {children}

      {/* ── Bandeau avertissement déconnexion ── */}
      {showWarning && user && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full">
          <div className="bg-amber-500 text-white px-5 py-4 rounded-2xl shadow-2xl border border-amber-400">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-amber-400 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Déconnexion imminente</p>
                <p className="text-xs text-amber-100 mt-0.5">
                  Vous serez déconnecté dans 2 minutes pour inactivité.
                </p>
                <button
                  onClick={resetTimer}
                  className="mt-2 px-4 py-1.5 bg-white text-amber-600 rounded-lg text-xs font-bold hover:bg-amber-50 transition-colors"
                >
                  Rester connecté
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth doit être utilisé à l'intérieur de <AuthProvider>")
  }
  return context
}