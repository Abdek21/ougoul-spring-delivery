import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Notifications from '../ui/Notifications'
import { Menu } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { profile } = useAuth()

  return (
    <div className="flex min-h-screen" style={{ background: '#f1f5f9' }}>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full z-30 transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Contenu */}
      <main className="flex-1 lg:ml-60 min-h-screen overflow-y-auto">

        {/* Topbar — visible partout */}
        <div className="flex items-center justify-between px-4 lg:px-8 py-3 bg-white border-b border-slate-200 sticky top-0 z-10">

          {/* Bouton menu hamburger (mobile) + logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Menu size={22} />
            </button>
            {/* Logo visible seulement sur mobile */}
            <div className="flex items-center gap-2 lg:hidden">
              <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">O</span>
              </div>
              <span className="font-semibold text-slate-900 text-sm">Ougoul Spring</span>
            </div>
          </div>

          {/* Droite : notifications + avatar */}
          <div className="flex items-center gap-3">
            <Notifications />
            {/* Avatar desktop */}
            <div className="hidden lg:flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {profile?.nom_complet?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
              </div>
              <span className="text-sm font-medium text-slate-700">{profile?.nom_complet}</span>
            </div>
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  )
}