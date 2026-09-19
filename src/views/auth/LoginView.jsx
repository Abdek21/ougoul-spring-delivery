import { useState } from 'react'
import { Mail, Lock, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// =========================================================================
// TEXTURE DE GOUTTES D'EAU — SVG généré dynamiquement, pas des dégradés CSS
// empilés. Deux gradients radiaux (grosses / petites gouttes) + un filtre
// feDropShadow pour un vrai relief (la goutte "se détache" du fond),
// exactement ce qui donne l'effet condensation/verre plutôt que des ronds
// flous plats.
// =========================================================================
function genererSvgGouttes() {
  let seed = 7
  function rand() {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }

  const grosses = []
  const colsG = 5, rowsG = 4
  for (let i = 0; i < colsG; i++) {
    for (let j = 0; j < rowsG; j++) {
      const cx = (i + 0.5) * (800 / colsG) + (rand() - 0.5) * (800 / colsG) * 0.6
      const cy = (j + 0.5) * (600 / rowsG) + (rand() - 0.5) * (600 / rowsG) * 0.6
      const r = 20 + rand() * 24
      grosses.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="url(#dGrosse)" filter="url(#ombre)" />`)
    }
  }

  const petites = []
  const colsP = 8, rowsP = 7
  for (let i = 0; i < colsP; i++) {
    for (let j = 0; j < rowsP; j++) {
      const cx = (i + 0.5) * (800 / colsP) + (rand() - 0.5) * (800 / colsP) * 0.7
      const cy = (j + 0.5) * (600 / rowsP) + (rand() - 0.5) * (600 / rowsP) * 0.7
      const r = 5 + rand() * 10
      petites.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="url(#dPetite)" filter="url(#ombreLegere)" />`)
    }
  }

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <defs>
    <radialGradient id="dGrosse" cx="32%" cy="26%" r="75%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.98"/>
      <stop offset="10%" stop-color="#ffffff" stop-opacity="0.75"/>
      <stop offset="24%" stop-color="#eafff2" stop-opacity="0.32"/>
      <stop offset="55%" stop-color="#eafff2" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#eafff2" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="dPetite" cx="34%" cy="28%" r="75%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>
      <stop offset="20%" stop-color="#ffffff" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="ombre" x="-60%" y="-60%" width="220%" height="220%">
      <feDropShadow dx="1.8" dy="3.2" stdDeviation="2.6" flood-color="#052e1a" flood-opacity="0.4"/>
    </filter>
    <filter id="ombreLegere" x="-60%" y="-60%" width="220%" height="220%">
      <feDropShadow dx="0.8" dy="1.4" stdDeviation="1.2" flood-color="#052e1a" flood-opacity="0.3"/>
    </filter>
  </defs>
  ${petites.join('')}
  ${grosses.join('')}
</svg>`.trim()

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

const SVG_GOUTTES = genererSvgGouttes()

const MOTS_EAU = [
  { texte: 'Waha',   top: '9%',  left: '50%', taille: '1.4rem', rotation: '-2deg' },
  { texte: 'Maji',   top: '10%', left: '80%', taille: '1.3rem', rotation: '3deg' },
  { texte: 'Biyyo',  top: '28%', left: '18%', taille: '1.3rem', rotation: '-3deg' },
  { texte: 'Eau',    top: '30%', left: '78%', taille: '1.5rem', rotation: '4deg' },
  { texte: 'ماء',    top: '46%', left: '46%', taille: '1.5rem', rotation: '0deg' },
  { texte: 'Water',  top: '58%', left: '16%', taille: '1.3rem', rotation: '-3deg' },
  { texte: 'Lee',    top: '60%', left: '82%', taille: '1.2rem', rotation: '3deg' },
  { texte: 'Waha',   top: '68%', left: '68%', taille: '1.3rem', rotation: '-2deg' },
  { texte: 'ماء',    top: '70%', left: '30%', taille: '1.4rem', rotation: '0deg' },
]

export default function LoginView() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)
  // AJOUT : etat pour le flux "mot de passe oublie"
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [messageOubli, setMessageOubli] = useState(null)

  async function handleLogin(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(), password
    })
    if (err) setError('Email ou mot de passe incorrect.')
    setLoading(false)
  }

  // MODIFIÉ : ne prend plus l'email en parametre — utilise directement
  // le state du formulaire, avec validation avant envoi
  async function handleMotDePasseOublie() {
    setMessageOubli(null)
    setError(null)

    if (!email.trim()) {
      setError('Renseigne ton email ci-dessus avant de demander une réinitialisation.')
      return
    }

    setEnvoiEnCours(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setEnvoiEnCours(false)

    if (err) setError(`Erreur : ${err.message}`)
    else setMessageOubli('Email de réinitialisation envoyé — vérifie ta boîte mail.')
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#0f172a' }}>

      {/* Panneau gauche — vert émeraude premium + texture gouttes d'eau SVG */}
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden"
        style={{
          background: 'linear-gradient(155deg, #146338 0%, #0d5230 40%, #084025 70%, #052c19 100%)',
        }}
      >
        <div
          className="absolute inset-0"
          style={{ backgroundImage: SVG_GOUTTES, backgroundSize: 'cover', backgroundPosition: 'center' }}
          aria-hidden="true"
        />

        {MOTS_EAU.map((m, i) => (
          <span key={i} aria-hidden="true"
            className="absolute font-bold text-white/50 select-none pointer-events-none whitespace-nowrap"
            style={{
              top: m.top, left: m.left, fontSize: m.taille,
              transform: `translate(-50%, -50%) rotate(${m.rotation})`,
            }}>
            {m.texte}
          </span>
        ))}

        <div className="flex items-center gap-3 relative z-10">
          <img src="/logo.png" alt="Ougoul Spring" className="w-14 h-14 rounded-full object-cover shadow-lg ring-2 ring-white/30" />
          <div>
            <p className="font-bold text-white text-lg drop-shadow-sm">Ougoul Spring</p>
            <p className="text-white/75 text-xs">Eau minérale — Djibouti</p>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-white leading-tight mb-4 drop-shadow-sm">
            Pilotez votre<br />
            activité en<br />
            <span className="text-[#094226] bg-white px-2 rounded-lg inline-block mt-1 shadow-md">temps réel.</span>
          </h1>
          <p className="text-white/85 text-sm leading-relaxed font-medium drop-shadow-sm">
            Stocks, commandes, prospects et rapports —<br />
            tout en un seul endroit.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 relative z-10">
          {[
            { label: 'Modules', value: '8' },
            { label: 'Rôles',   value: '6' },
            { label: 'Temps réel', value: '✓' },
          ].map(s => (
            <div key={s.label} className="bg-white/12 rounded-xl p-4 border border-white/25 backdrop-blur-sm shadow-sm">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-white/75 mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Panneau droit — formulaire */}
      <div className="flex-1 flex items-center justify-center p-8"
           style={{ background: '#f1f5f9' }}>
        <div className="w-full max-w-sm">

          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <img src="/logo.png" alt="Ougoul Spring" className="w-11 h-11 rounded-full object-cover" />
            <p className="font-bold text-slate-900 text-lg">Ougoul Spring</p>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">Connexion</h2>
          <p className="text-slate-500 text-sm mb-8">Accès réservé aux équipes Ougoul Spring</p>

          <form onSubmit={handleLogin} className="space-y-4">

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Adresse email
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  required placeholder="votre@email.com"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Mot de passe
                </label>
                {/* AJOUT : lien mot de passe oublie */}
                <button
                  type="button"
                  onClick={handleMotDePasseOublie}
                  disabled={envoiEnCours}
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium disabled:opacity-60 transition-colors"
                >
                  {envoiEnCours ? 'Envoi...' : 'Mot de passe oublié ?'}
                </button>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  required placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* AJOUT : confirmation d'envoi de l'email de reinitialisation */}
            {messageOubli && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-100">
                <p className="text-green-700 text-sm">{messageOubli}</p>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
                <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm hover:shadow-md">
              {loading
                ? <><Loader2 size={16} className="animate-spin" />Connexion...</>
                : 'Se connecter'
              }
            </button>

          </form>
        </div>
      </div>
    </div>
  )
}