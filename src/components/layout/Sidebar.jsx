import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, ShoppingCart, CreditCard,
  Users, CheckSquare, FileText, LogOut, Droplets,
  Building2, Download, Truck, FileSignature, Star, X, Factory,
  Receipt, TrendingUp, Lock, Wallet, Files, Briefcase, FileCheck,
  UserPlus, Edit3, MessageSquareWarning, Phone, Smartphone, Clock, ShieldCheck,
  Calendar, // AJOUT : pour Conges (module RH)
  AlertTriangle, // AJOUT : pour Pertes & dommages livraison
  BarChart3, // AJOUT : pour Clients & quantités (module Logistique)
  ShieldAlert, // AJOUT : pour Avertissements (module RH)
  ClipboardList, // AJOUT : pour Pointage camion (module Logistique)
  Fuel, // AJOUT : pour Contrôle Carburant
  History, // AJOUT : pour Audit
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { cn } from '../../lib/utils'

// Sections groupées — utilisées uniquement pour le rôle admin
const NAV_SECTIONS = [
  {
    label: 'Pilotage',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
    ],
  },
  {
    label: 'Ventes',
    items: [
      { to: '/commandes',   icon: ShoppingCart,  label: 'Commandes' },
      { to: '/credits',     icon: CreditCard,    label: 'Encaissements' },
      { to: '/clients',     icon: Building2,     label: 'Clients' },
      { to: '/commandes-attente', icon: Clock,   label: 'Commandes en attente' },
      { to: '/chiffre-affaires', icon: TrendingUp, label: "Chiffre d'affaires" },
      { to: '/clients-app', icon: Smartphone,    label: 'Clients App Mobile' },
      { to: '/portefeuille',icon: Briefcase,     label: 'Portefeuille Client' },
      { to: '/contrats',    icon: FileSignature, label: 'Contrats' },
      { to: '/abonnements', icon: Star,          label: 'Abonnements' },
      { to: '/fiches-validation', icon: FileCheck, label: 'Fiches à valider' },
      { to: '/crm',         icon: Users,         label: 'CRM & Prospects' },
    ],
  },
  {
    label: 'Logistique',
    items: [
      { to: '/stocks',     icon: Package, label: 'Stocks & Dépôt' },
      { to: '/livraisons', icon: Truck,   label: 'Livraisons' },
      { to: '/livraisons/historique', icon: Clock,          label: 'Historique livraisons' },
      { to: '/livraisons/pertes',     icon: AlertTriangle,  label: 'Pertes & dommages' },
      { to: '/arrivages-matieres',    icon: Package,        label: 'Arrivages des matières' },
      { to: '/productions',           icon: Factory,        label: 'Fabrication' },
      { to: '/flotte',                icon: Truck,          label: 'Flotte' },
      { to: '/clients-quantites',     icon: BarChart3,      label: 'Clients & quantités' },
      { to: '/pointage-camion',       icon: ClipboardList,  label: 'Pointage camion' },
      { to: '/controle-carburant',    icon: Fuel,           label: 'Contrôle Carburant' },
    ],
  },
  {
    label: 'Comptabilité',
    items: [
      { to: '/compta/caisse',      icon: Wallet,     label: 'Balance' },
      { to: '/compta/ventes',      icon: TrendingUp, label: 'Ventes (compta)' },
      { to: '/compta/depenses',    icon: Receipt,    label: 'Dépenses' },
      { to: '/compta/factures',    icon: Files,      label: 'Factures' },
      { to: '/compta/paiements',   icon: Receipt,    label: 'Paiements administratifs' },
      { to: '/compta/matieres',    icon: Package,    label: 'Matières premières' },
      { to: '/compta/fermeture',   icon: Lock,        label: 'Fermeture compte' },
      { to: '/salaires/employes',  icon: Users,       label: 'Employés' },
      { to: '/salaires/bulletins', icon: Receipt,     label: 'Bulletins de paie' },
      { to: '/salaires/cnss',      icon: ShieldCheck, label: 'CNSS' },
      { to: '/export',             icon: Download,    label: 'Export données' },
    ],
  },
  // AJOUT : section RH, visible dans la vue groupee admin
  {
    label: 'Ressources Humaines',
    items: [
      { to: '/rh/employes',     icon: Users,     label: 'Employés (RH)' },
      { to: '/rh/conges',       icon: Calendar,  label: 'Congés & absences' },
      { to: '/rh/recrutement',  icon: Briefcase, label: 'Recrutement' },
      { to: '/rh/avertissements', icon: ShieldAlert, label: 'Avertissements' },
      { to: '/rh/paie',         icon: Receipt,   label: 'Paie (lecture)' },
    ],
  },
  {
    label: 'Équipe',
    items: [
      { to: '/taches',  icon: CheckSquare, label: 'Mes Tâches' },
      { to: '/rapport', icon: FileText,    label: 'Rapport Hebdo' },
    ],
  },
  // AJOUT : module Audit — visible pour admin ici, et seul lien visible
  // pour le rôle 'audit' dédié (voir NAV_ITEMS ci-dessous)
  {
    label: 'Audit',
    items: [
      { to: '/audit', icon: History, label: 'Journal d\'audit' },
    ],
  },
]

// Liste plate — pour les autres rôles
const NAV_ITEMS = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Tableau de bord',  roles: ['commercial', 'logistique'] },
  { to: '/fiches-validation', icon: FileCheck,  label: 'Fiches à valider', roles: ['commercial'] },
  { to: '/stocks',      icon: Package,          label: 'Stocks & Dépôt',   roles: ['logistique'] },
  { to: '/commandes',   icon: ShoppingCart,     label: 'Commandes',        roles: ['commercial'] },
  { to: '/livraisons',  icon: Truck,            label: 'Livraisons',       roles: ['logistique'] },
  { to: '/livraisons/historique', icon: Clock,  label: 'Historique livraisons', roles: ['logistique'] },
  { to: '/livraisons/pertes',     icon: AlertTriangle, label: 'Pertes & dommages', roles: ['logistique', 'commercial'] },
  { to: '/arrivages-matieres',    icon: Package,       label: 'Arrivages des matières', roles: ['logistique'] },
  { to: '/productions',           icon: Factory,       label: 'Fabrication', roles: ['logistique'] },
  { to: '/flotte',                icon: Truck,         label: 'Flotte', roles: ['logistique'] },
  { to: '/clients-quantites',     icon: BarChart3,     label: 'Clients & quantités', roles: ['logistique'] },
  { to: '/pointage-camion',       icon: ClipboardList, label: 'Pointage camion', roles: ['logistique'] },
  { to: '/controle-carburant',    icon: Fuel,          label: 'Contrôle Carburant', roles: ['logistique'] },
  { to: '/clients',     icon: Building2,        label: 'Clients',          roles: ['commercial'] },
  { to: '/commandes-attente', icon: Clock,       label: 'Commandes en attente', roles: ['commercial'] },
  { to: '/chiffre-affaires',  icon: TrendingUp,  label: "Chiffre d'affaires",   roles: ['commercial'] },
  { to: '/clients-app', icon: Smartphone,       label: 'Clients App Mobile', roles: ['commercial'] },
  { to: '/portefeuille',icon: Briefcase,        label: 'Portefeuille Client', roles: ['commercial'] },
  { to: '/contrats',    icon: FileSignature,    label: 'Contrats',         roles: ['commercial'] },
  { to: '/abonnements', icon: Star,             label: 'Abonnements',      roles: ['commercial'] },

  { to: '/crm',         icon: Users,            label: 'CRM & Prospects',  roles: ['commercial'] },
  { to: '/taches',      icon: CheckSquare,      label: 'Mes Tâches',       roles: ['commercial', 'logistique', 'magasinier'] },
  { to: '/rapport',     icon: FileText,         label: 'Rapport Hebdo',    roles: ['commercial'] },

  { to: '/dashboard',           icon: LayoutDashboard, label: 'Tableau de bord',     roles: ['comptable'] },
  // AJOUT (2026-07-21) : lecture seule — comptable ne saisit plus la
  // production (transférée à Kassim), mais garde une visibilité
  
  { to: '/compta/factures',     icon: Files,            label: 'Factures',            roles: ['comptable'] },
  { to: '/compta/caisse',       icon: Wallet,           label: 'Balance',              roles: ['comptable'] },
  { to: '/compta/ventes',       icon: TrendingUp,       label: 'Ventes',              roles: ['comptable'] },
  { to: '/compta/depenses',     icon: Receipt,          label: 'Dépenses',            roles: ['comptable'] },
  { to: '/controle-carburant',  icon: Fuel,             label: 'Contrôle Carburant',  roles: ['comptable'] },
  { to: '/credits',             icon: CreditCard,       label: 'Encaissements',     roles: ['comptable'] },
  { to: '/compta/paiements',    icon: Receipt,          label: 'Paiements administratifs', roles: ['comptable'] },
  { to: '/productions',         icon: Factory,          label: 'Fabrication',        roles: ['comptable'] },
  { to: '/compta/matieres',     icon: Package,          label: 'Matières premières',  roles: ['comptable'] },
  { to: '/compta/fermeture',    icon: Lock,             label: 'Fermeture compte',    roles: ['comptable'] },
  { to: '/salaires/employes',   icon: Users,            label: 'Employés',            roles: ['comptable'] },
  { to: '/salaires/bulletins',  icon: Receipt,          label: 'Bulletins de paie',   roles: ['comptable'] },
  { to: '/salaires/cnss',       icon: ShieldCheck,      label: 'CNSS',                roles: ['comptable'] },

  // Gestionnaire (ADV) — accès limité à ses seules fiches
  { to: '/fiches/commande',     icon: FileText,             label: 'Prise de commande',    roles: ['gestionnaire'] },
  { to: '/fiches/distributeur', icon: UserPlus,             label: 'Nouveau distributeur', roles: ['gestionnaire'] },
  { to: '/fiches/modification', icon: Edit3,                label: 'Modification client',  roles: ['gestionnaire'] },
  { to: '/fiches/reclamation',  icon: MessageSquareWarning, label: 'Réclamation',           roles: ['gestionnaire'] },
  { to: '/fiches/appels',       icon: Phone,                label: "Registre d'appels",     roles: ['gestionnaire'] },
  { to: '/fiches/documents',    icon: Truck,                label: 'Documents véhicules',   roles: ['gestionnaire'] },
  { to: '/fiches/paiements',    icon: Receipt,              label: 'Paiements admin',       roles: ['gestionnaire'] },
  { to: '/taches',              icon: CheckSquare,          label: 'Mes Tâches',            roles: ['gestionnaire'] },

  // AJOUT : module RH — role dedie
  { to: '/rh/employes',     icon: Users,     label: 'Employés',           roles: ['rh'] },
  { to: '/rh/conges',       icon: Calendar,  label: 'Congés & absences',  roles: ['rh'] },
  { to: '/rh/recrutement',  icon: Briefcase, label: 'Recrutement',        roles: ['rh'] },
  { to: '/rh/avertissements', icon: ShieldAlert, label: 'Avertissements', roles: ['rh'] },
  { to: '/rh/paie',         icon: Receipt,   label: 'Paie (lecture)',     roles: ['rh'] },

  // AJOUT : module Audit — rôle dédié, seul lien accessible pour ce rôle
  { to: '/audit',           icon: History,   label: 'Journal d\'audit',   roles: ['audit'] },
]

const ROLE_CONFIG = {
  admin:        { label: 'Admin',        color: 'bg-orange-500/20 text-orange-400' },
  commercial:   { label: 'Commercial',   color: 'bg-blue-500/20 text-blue-400' },
  logistique:   { label: 'Logistique',   color: 'bg-green-500/20 text-green-400' },
  magasinier:   { label: 'Magasinier',   color: 'bg-purple-500/20 text-purple-400' },
  comptable:    { label: 'Comptable',    color: 'bg-cyan-500/20 text-cyan-400' },
  gestionnaire: { label: 'Gestionnaire', color: 'bg-pink-500/20 text-pink-400' },
  rh:           { label: 'RH',           color: 'bg-rose-500/20 text-rose-400' }, // AJOUT
  audit:        { label: 'Audit',        color: 'bg-slate-500/20 text-slate-300' }, // AJOUT
}

export default function Sidebar({ onClose }) {
  const { profile, role, signOut } = useAuth()
  const navigate = useNavigate()
  const roleConfig = ROLE_CONFIG[role] || { label: role, color: 'bg-slate-500/20 text-slate-400' }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  function handleNavClick() {
    if (onClose) onClose()
  }

  function renderLink({ to, icon: Icon, label }) {
    return (
      <li key={to}>
        <NavLink
          to={to}
          end
          onClick={handleNavClick}
          className={({ isActive }) => cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
            isActive
              ? 'bg-orange-500/15 text-orange-400'
              : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
          )}
        >
          {({ isActive }) => (
            <>
              <Icon size={16} className={isActive ? 'text-orange-400' : 'text-slate-500'} />
              {label}
            </>
          )}
        </NavLink>
      </li>
    )
  }

  return (
    <aside className="w-60 h-screen flex flex-col" style={{ background: '#0f172a' }}>

      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Droplets size={16} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-100 text-sm leading-tight">Ougoul Spring</p>
            <p className="text-xs text-slate-500">Système de pilotage</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {role === 'admin' ? (
          // ── Vue groupée par sections — Admin uniquement ──
          <div className="space-y-4">
            {NAV_SECTIONS.map(section => (
              <div key={section.label}>
                <p className="px-3 mb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  {section.label}
                </p>
                <ul className="space-y-0.5">
                  {section.items.map(renderLink)}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          // ── Liste plate — autres rôles ──
          <ul className="space-y-0.5">
            {NAV_ITEMS.filter(item => item.roles.includes(role)).map(renderLink)}
          </ul>
        )}
      </nav>

      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {profile?.nom_complet?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">
              {profile?.nom_complet || 'Utilisateur'}
            </p>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', roleConfig.color)}>
              {roleConfig.label}
            </span>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <LogOut size={15} />
          Se déconnecter
        </button>
      </div>

    </aside>
  )
}