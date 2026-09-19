import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ProtectedRoute from './ProtectedRoute'

import AppShell                        from '../components/layout/AppShell'
import LoginView                       from '../views/auth/LoginView'
import ResetPasswordPage               from '../views/auth/ResetPasswordPage'
import DashboardView                   from '../views/dashboard/DashboardView'
import StockView                       from '../views/stocks/StockView'
import ArrivagesMatieresView           from '../views/stocks/ArrivagesMatieresView'
import CommandesView                   from '../views/commandes/CommandesView'
import ChiffreAffaireView              from '../views/commercial/ChiffreAffaireView'
import MurDesCredits                   from '../views/commandes/MurDesCredits'
import CrmView                         from '../views/crm/CrmView'
import TachesView                      from '../views/taches/TachesView'
import RapportHebdoView                from '../views/taches/RapportHebdoView'
import ClientsView                     from '../views/clients/ClientsView'
import PrevisionCommandesView          from '../views/commandes/PrevisionCommandesView'
import ClientsAppView                  from '../views/clients/ClientsAppView'
import FicheCommandeView               from '../views/fiches/FicheCommandeView'
import FicheDistributeurView           from '../views/fiches/FicheDistributeurView'
import FicheModificationClientView     from '../views/fiches/FicheModificationClientView'
import FicheReclamationView            from '../views/fiches/FicheReclamationView'
import RegistreAppelsView              from '../views/fiches/RegistreAppelsView'
import DocumentsVehiculesGestionnaireView from '../views/fiches/DocumentsVehiculesGestionnaireView'
import PaiementsAdministratifsView      from '../views/fiches/PaiementsAdministratifsView'
import FichesValidationView            from '../views/fiches/FichesValidationView'
import PortefeuilleClientView          from '../views/clients/PortefeuilleClientView'
import ExportView                      from '../views/export/ExportView'
import LivraisonsView                  from '../views/livraisons/LivraisonsView'
import HistoriqueLivraisonsView        from '../views/livraisons/HistoriqueLivraisonsView'
import PertesLivraisonView             from '../views/livraisons/PertesLivraisonView'
import FlotteView                      from '../views/flotte/FlotteView'
import ControleCarburantView           from '../views/flotte/ControleCarburantView'
import ClientsQuantitesView            from '../views/logistique/ClientsQuantitesView'
import PointageCamionView              from '../views/logistique/PointageCamionView'
import ContratsView                    from '../views/contrats/ContratsView'
import AbonnementsView                 from '../views/abonnements/AbonnementsView'
import DepensesView                    from '../views/compta/DepensesView'
import VentesView                      from '../views/compta/VentesView'
import FermetureCompteView             from '../views/compta/FermetureCompteView'
import CaisseView                      from '../views/compta/CaisseView'
import ProductionsComptableView        from '../views/compta/ProductionsComptableView'
import MatieresPremieresComptableView  from '../views/compta/MatieresPremieresComptableView'
import FacturesView                    from '../views/compta/FacturesView'
import PaiementsAdministratifsComptableView from '../views/compta/PaiementsAdministratifsComptableView'
import EmployesView                    from '../views/salaires/EmployesView'
import BulletinsPaieView               from '../views/salaires/Bulletinspaieview'
import CnssView                        from '../views/salaires/CnssView'
// AJOUT : module RH
import CongesView                      from '../views/rh/CongesView'
import RecrutementView                 from '../views/rh/RecrutementView'
import AvertissementsView              from '../views/rh/AvertissementsView'
// AJOUT : module Audit — rôle dédié, isolé de tout le reste de l'ERP
import AuditView                       from '../views/audit/AuditView'

export default function AppRouter() {
  const { user, role, loading } = useAuth()

  if (loading) return null

  function getDefaultRoute() {
    if (role === 'admin')        return '/dashboard'
    if (role === 'commercial')   return '/dashboard'
    if (role === 'logistique')   return '/dashboard'
    // MODIFIÉ : /magasinier retiré (sorties usine désormais exclusivement
    // saisies+validées par logistique) — redirige vers une page à laquelle
    // magasinier a toujours légitimement accès, pour éviter une redirection
    // vers une route qui n'existe plus.
    if (role === 'magasinier')   return '/taches'
    if (role === 'comptable')    return '/dashboard'
    if (role === 'gestionnaire') return '/fiches/commande'
    if (role === 'rh')           return '/rh/employes' // AJOUT
    if (role === 'audit')        return '/audit' // AJOUT
    return '/login'
  }

  return (
    <BrowserRouter>
      <Routes>

        {/* Page publique */}
        <Route path="/login" element={
          user ? <Navigate to={getDefaultRoute()} replace /> : <LoginView />
        } />

        {/* AJOUT : reinitialisation de mot de passe — publique, en dehors
            du ProtectedRoute. Le lien recu par email redirige ici avec un
            token dans l'URL, que Supabase capte automatiquement. */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Toutes les pages protégées dans AppShell */}
        {/* AJOUT : 'audit' ajouté ici (sinon bloqué avant même d'atteindre
            l'app) ET sur la route "audit" plus bas — AUCUNE autre route de
            ce fichier ne liste 'audit', donc ProtectedRoute la bloque
            partout ailleurs, même par URL directe. */}
        <Route path="/" element={
          <ProtectedRoute roles={['admin', 'commercial', 'logistique', 'magasinier', 'comptable', 'gestionnaire', 'rh', 'audit']}>
            <AppShell />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to={getDefaultRoute()} replace />} />

          {/* Dashboard — pas pour comptable ni gestionnaire ni rh */}
          <Route path="dashboard" element={
            <ProtectedRoute roles={['admin', 'commercial', 'logistique', 'comptable']}>
              <DashboardView />
            </ProtectedRoute>
          } />

          <Route path="stocks" element={
            <ProtectedRoute roles={['admin', 'logistique']}>
              <StockView />
            </ProtectedRoute>
          } />

          {/* AJOUT : extrait de LivraisonsView.jsx (n'est plus un onglet
              imbriqué) — arrivages fournisseur, à distinguer de
              compta/matieres qui gère la consommation production (Hamza) */}
          <Route path="arrivages-matieres" element={
            <ProtectedRoute roles={['admin', 'logistique']}>
              <ArrivagesMatieresView />
            </ProtectedRoute>
          } />


          <Route path="abonnements" element={
            <ProtectedRoute roles={['admin', 'commercial']}>
              <AbonnementsView />
            </ProtectedRoute>
          } />

          {/* ── Comptabilité ── */}
          <Route path="compta/caisse" element={
            <ProtectedRoute roles={['admin', 'comptable']}>
              <CaisseView />
            </ProtectedRoute>
          } />
          <Route path="compta/ventes" element={
            <ProtectedRoute roles={['admin', 'comptable']}>
              <VentesView />
            </ProtectedRoute>
          } />
          <Route path="compta/depenses" element={
            <ProtectedRoute roles={['admin', 'comptable']}>
              <DepensesView />
            </ProtectedRoute>
          } />
          {/* MODIFIÉ : déplacé de compta (Ibrahim) vers logistique (Kassim) —
              Ibrahim ne saisit plus la production quotidienne. Chemin gardé
              en dehors de compta/ pour refléter le nouveau rôle propriétaire.
              AJOUT (2026-07-21) : comptable réintégré en lecture seule
              (visibilité uniquement, ProductionsComptableView masque la
              saisie/modification pour ce rôle). */}
          <Route path="productions" element={
            <ProtectedRoute roles={['admin', 'logistique', 'comptable']}>
              <ProductionsComptableView />
            </ProtectedRoute>
          } />
          <Route path="compta/matieres" element={
            <ProtectedRoute roles={['admin', 'comptable']}>
              <MatieresPremieresComptableView />
            </ProtectedRoute>
          } />
          <Route path="compta/factures" element={
            <ProtectedRoute roles={['admin', 'comptable']}>
              <FacturesView />
            </ProtectedRoute>
          } />
          <Route path="compta/fermeture" element={
            <ProtectedRoute roles={['admin', 'comptable']}>
              <FermetureCompteView />
            </ProtectedRoute>
          } />

          {/* MODIFIÉ : déplacé de logistique (Kassim) vers comptable (Ibrahim) —
              la validation crée une dépense, c'est le domaine du comptable.
              La soumission (fiches/paiements, gestionnaire) reste inchangée. */}
          <Route path="compta/paiements" element={
            <ProtectedRoute roles={['admin', 'comptable']}>
              <PaiementsAdministratifsComptableView />
            </ProtectedRoute>
          } />

          {/* Module Salaire — comptable garde son acces habituel */}
          <Route path="salaires/employes" element={
            <ProtectedRoute roles={['admin', 'comptable']}>
              <EmployesView />
            </ProtectedRoute>
          } />
          <Route path="salaires/bulletins" element={
            <ProtectedRoute roles={['admin', 'comptable']}>
              <BulletinsPaieView />
            </ProtectedRoute>
          } />
          <Route path="salaires/cnss" element={
            <ProtectedRoute roles={['admin', 'comptable']}>
              <CnssView />
            </ProtectedRoute>
          } />

          {/* ═══════════ AJOUT : Module RH ═══════════
              /rh/employes et /rh/paie reutilisent les MEMES composants
              que le comptable (EmployesView, BulletinsPaieView) — le
              composant BulletinsPaieView a ete adapte pour passer en
              lecture seule quand role === 'rh'. */}
          <Route path="rh/employes" element={
            <ProtectedRoute roles={['admin', 'rh']}>
              <EmployesView />
            </ProtectedRoute>
          } />
          <Route path="rh/conges" element={
            <ProtectedRoute roles={['admin', 'rh']}>
              <CongesView />
            </ProtectedRoute>
          } />
          <Route path="rh/recrutement" element={
            <ProtectedRoute roles={['admin', 'rh']}>
              <RecrutementView />
            </ProtectedRoute>
          } />
          <Route path="rh/avertissements" element={
            <ProtectedRoute roles={['admin', 'rh']}>
              <AvertissementsView />
            </ProtectedRoute>
          } />
          <Route path="rh/paie" element={
            <ProtectedRoute roles={['admin', 'rh']}>
              <BulletinsPaieView />
            </ProtectedRoute>
          } />

          {/* AJOUT : module Audit — rôle 'audit' dédié, n'a accès QU'à
              cette route (voir garde 'audit' sur la route "/" ci-dessus et
              absence de 'audit' sur toutes les autres routes). */}
          <Route path="audit" element={
            <ProtectedRoute roles={['admin', 'audit']}>
              <AuditView />
            </ProtectedRoute>
          } />

          {/* Commandes — pas pour comptable */}
          <Route path="commandes" element={
            <ProtectedRoute roles={['admin', 'logistique', 'commercial']}>
              <CommandesView />
            </ProtectedRoute>
          } />

          <Route path="credits" element={
            <ProtectedRoute roles={['admin', 'commercial', 'comptable']}>
              <MurDesCredits />
            </ProtectedRoute>
          } />

          <Route path="clients" element={
            <ProtectedRoute roles={['admin', 'logistique', 'commercial']}>
              <ClientsView />
            </ProtectedRoute>
          } />

          <Route path="commandes-attente" element={
            <ProtectedRoute roles={['admin', 'commercial']}>
              <PrevisionCommandesView />
            </ProtectedRoute>
          } />

          {/* AJOUT (2026-09) : module Chiffre d'affaires — commercial + admin */}
          <Route path="chiffre-affaires" element={
            <ProtectedRoute roles={['admin', 'commercial']}>
              <ChiffreAffaireView />
            </ProtectedRoute>
          } />

          <Route path="clients-app" element={
            <ProtectedRoute roles={['admin', 'commercial']}>
              <ClientsAppView />
            </ProtectedRoute>
          } />

          <Route path="fiches/commande" element={
            <ProtectedRoute roles={['admin', 'gestionnaire']}>
              <FicheCommandeView />
            </ProtectedRoute>
          } />
          <Route path="fiches/distributeur" element={
            <ProtectedRoute roles={['admin', 'gestionnaire']}>
              <FicheDistributeurView />
            </ProtectedRoute>
          } />
          <Route path="fiches/modification" element={
            <ProtectedRoute roles={['admin', 'gestionnaire']}>
              <FicheModificationClientView />
            </ProtectedRoute>
          } />
          <Route path="fiches/reclamation" element={
            <ProtectedRoute roles={['admin', 'gestionnaire']}>
              <FicheReclamationView />
            </ProtectedRoute>
          } />
          <Route path="fiches/appels" element={
            <ProtectedRoute roles={['admin', 'gestionnaire']}>
              <RegistreAppelsView />
            </ProtectedRoute>
          } />
          <Route path="fiches/documents" element={
            <ProtectedRoute roles={['admin', 'gestionnaire']}>
              <DocumentsVehiculesGestionnaireView />
            </ProtectedRoute>
          } />
          <Route path="fiches/paiements" element={
            <ProtectedRoute roles={['admin', 'gestionnaire']}>
              <PaiementsAdministratifsView />
            </ProtectedRoute>
          } />

          <Route path="fiches-validation" element={
            <ProtectedRoute roles={['admin', 'commercial']}>
              <FichesValidationView />
            </ProtectedRoute>
          } />

          <Route path="portefeuille" element={
            <ProtectedRoute roles={['admin', 'commercial']}>
              <PortefeuilleClientView />
            </ProtectedRoute>
          } />

          <Route path="crm" element={
            <ProtectedRoute roles={['admin', 'commercial']}>
              <CrmView />
            </ProtectedRoute>
          } />

          <Route path="taches" element={
            <ProtectedRoute roles={['admin', 'commercial', 'logistique', 'magasinier', 'gestionnaire']}>
              <TachesView />
            </ProtectedRoute>
          } />

          {/* MODIFIÉ (2026-07-29) : ouvert à Soumeya (admin, déjà couvert)
              et Fatouma — seule personne au rôle 'commercial' aujourd'hui,
              donc équivalent en pratique à un accès nominatif, mais via le
              même garde par rôle que le reste du routeur (pas de mécanisme
              par id ici) — voir note dans ProtectedRoute si un rôle
              'commercial' est réutilisé par quelqu'un d'autre plus tard. */}
          <Route path="rapport" element={
            <ProtectedRoute roles={['admin', 'commercial']}>
              <RapportHebdoView />
            </ProtectedRoute>
          } />

          <Route path="export" element={
            <ProtectedRoute roles={['admin']}>
              <ExportView />
            </ProtectedRoute>
          } />

          <Route path="livraisons" element={
            <ProtectedRoute roles={['admin', 'logistique']}>
              <LivraisonsView />
            </ProtectedRoute>
          } />

          <Route path="livraisons/historique" element={
            <ProtectedRoute roles={['admin', 'logistique']}>
              <HistoriqueLivraisonsView />
            </ProtectedRoute>
          } />

          <Route path="livraisons/pertes" element={
            <ProtectedRoute roles={['admin', 'logistique', 'commercial']}>
              <PertesLivraisonView />
            </ProtectedRoute>
          } />

          {/* AJOUT : module Flotte — regroupe Véhicules, Chauffeurs,
              Carburant et Documents, extraits de LivraisonsView.jsx */}
          <Route path="flotte" element={
            <ProtectedRoute roles={['admin', 'logistique']}>
              <FlotteView />
            </ProtectedRoute>
          } />

          {/* AJOUT (2026-07-30) : contrôle croisé carburant — écran séparé
              (pas un onglet de FlotteView.jsx, qui reste admin/logistique
              uniquement) pour que le comptable y accède sans hériter de
              tout le module Flotte (véhicules/chauffeurs/documents). */}
          <Route path="controle-carburant" element={
            <ProtectedRoute roles={['admin', 'comptable', 'logistique']}>
              <ControleCarburantView />
            </ProtectedRoute>
          } />

          {/* AJOUT : module Logistique — clients + quantités livrées du mois */}
          <Route path="clients-quantites" element={
            <ProtectedRoute roles={['admin', 'logistique']}>
              <ClientsQuantitesView />
            </ProtectedRoute>
          } />

          {/* AJOUT : module Pointage camion — écart chargement usine vs
              livraisons du jour (détection perte au comptage) */}
          <Route path="pointage-camion" element={
            <ProtectedRoute roles={['admin', 'logistique']}>
              <PointageCamionView />
            </ProtectedRoute>
          } />

          <Route path="contrats" element={
            <ProtectedRoute roles={['admin', 'commercial']}>
              <ContratsView />
            </ProtectedRoute>
          } />

        </Route>

        {/* URL inconnue */}
        <Route path="*" element={
          <Navigate to={user ? getDefaultRoute() : '/login'} replace />
        } />

      </Routes>
    </BrowserRouter>
  )
}