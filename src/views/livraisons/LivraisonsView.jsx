// REFACTOR (2026-08, rapport Herald — dette de code) : ce fichier faisait
// 1272 lignes en une seule fonction (complexité cognitive 32) — tout
// l'état + les fetchers + les 2 sous-onglets + 4 modales en un bloc.
// Découpage pur — même comportement exact, juste réorganisé :
//   - livraisonsView/helpers.js         : constantes pures
//   - livraisonsView/useLivraisonsView.js : tout l'état/fetchers/handlers
//   - livraisonsView/Onglet*.jsx        : le contenu de chaque sous-onglet
//   - livraisonsView/Modal*.jsx         : les 4 modales (+ ModalConfirmation)
// Seule différence de comportement volontaire : les window.confirm()/
// alert() (annulation commande, seuil stock, retrait planification, tout
// remettre en attente, perte sans quantité) sont remplacés par
// ModalConfirmation.jsx + une bannière d'erreur (même message, même
// action qu'avant).
import { Link } from 'react-router-dom'
import { Clock, FileText, RefreshCw, X } from 'lucide-react'
import { formatDate } from '../../lib/utils'
import { useLivraisonsView } from './livraisonsView/useLivraisonsView'
import { TYPE_CLIENT_COLORS } from './livraisonsView/helpers'
import OngletJour from './livraisonsView/OngletJour'
import OngletPlanifier from './livraisonsView/OngletPlanifier'
import ModalAffectation from './livraisonsView/ModalAffectation'
import ModalEncaissement from './livraisonsView/ModalEncaissement'
import ModalConfirmerLivraison from './livraisonsView/ModalConfirmerLivraison'
import ModalPerte from './livraisonsView/ModalPerte'
import ModalHistoriquePartiel from './livraisonsView/ModalHistoriquePartiel'
import ModalConfirmation from './livraisonsView/ModalConfirmation'

export default function LivraisonsView() {
  const m = useLivraisonsView()

  if (m.loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-7xl mx-auto">

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Livraisons</h1>
          <p className="text-slate-500 text-sm mt-1">
            {formatDate(m.aujourdhui)} — {m.stats.total} livraison{m.stats.total > 1 ? 's' : ''} planifiée{m.stats.total > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/livraisons/historique"
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
            <Clock size={16} /> Historique
          </Link>
          <button onClick={m.genererFeuilleRoute}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
            <FileText size={16} /> Feuille de route PDF
          </button>
          <button onClick={m.fetchAll}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
            <RefreshCw size={15} /> Actualiser
          </button>
        </div>
      </div>

      {m.erreurAction && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium flex items-center justify-between gap-2">
          <span>{m.erreurAction}</span>
          <button onClick={() => m.setErreurAction(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total du jour',  value: m.stats.total,     color: 'text-slate-900',  bg: 'bg-white' },
          { label: 'Planifiées',     value: m.stats.planifiee, color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-100' },
          { label: 'En cours',       value: m.stats.en_cours,  color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-100' },
          { label: 'Livrées',        value: m.stats.livree,    color: 'text-green-600',  bg: 'bg-green-50 border-green-100' },
        ].map(k => (
          <div key={k.label} className={`rounded-2xl border p-5 shadow-sm ${k.bg}`}>
            <p className="text-sm text-slate-500 mb-2">{k.label}</p>
            <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {Object.entries(m.parType).map(([type, count]) => (
          <div key={type} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center gap-3">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${TYPE_CLIENT_COLORS[type]}`}>
              {type}
            </span>
            <p className="text-xl font-bold text-slate-900">{count}</p>
            <p className="text-xs text-slate-400">livraison{count > 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { key: 'jour',       label: `Livraisons du jour (${m.livraisonsJourFiltrees.length})` },
          { key: 'retard',     label: `Confirmées en retard (${m.livraisonsConfirmeesEnRetard.length})` },
          { key: 'planifier',  label: `À planifier (${m.commandes.length})` },
        ].map(tab => (
          <button key={tab.key} onClick={() => m.setOnglet(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              m.onglet === tab.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {m.onglet === 'jour' && (
        <OngletJour
          livraisonsJourFiltrees={m.livraisonsJourFiltrees} imprimerBonLivraison={m.imprimerBonLivraison}
          demarrerLivraison={m.demarrerLivraison} retirerVersPlanifier={m.retirerVersPlanifier}
          ouvrirDeclarationPerte={m.ouvrirDeclarationPerte} confirmerLivraison={m.confirmerLivraison}
          aujourdhui={m.aujourdhui}
        />
      )}

      {m.onglet === 'retard' && (
        <OngletJour
          livraisonsJourFiltrees={m.livraisonsConfirmeesEnRetard} imprimerBonLivraison={m.imprimerBonLivraison}
          demarrerLivraison={m.demarrerLivraison} retirerVersPlanifier={m.retirerVersPlanifier}
          ouvrirDeclarationPerte={m.ouvrirDeclarationPerte} confirmerLivraison={m.confirmerLivraison}
          aujourdhui={m.aujourdhui}
          messageVide="Aucune livraison confirmée en retard"
        />
      )}

      {m.onglet === 'planifier' && (
        <OngletPlanifier
          commandes={m.commandes}
          remettreToutEnAttente={m.remettreToutEnAttente} commandesTriees={m.commandesTriees}
          tiersClients={m.tiersClients} commandesChaine={m.commandesChaine}
          ouvrirHistoriquePartiel={m.ouvrirHistoriquePartiel} ouvrirAffectation={m.ouvrirAffectation}
          remettreEnAttente={m.remettreEnAttente} handleAnnulerCommande={m.handleAnnulerCommande}
        />
      )}

      <ModalAffectation
        showAffectation={m.showAffectation} setShowAffectation={m.setShowAffectation}
        cmdSelectionnee={m.cmdSelectionnee}
        datePlanifiee={m.datePlanifiee} setDatePlanifiee={m.setDatePlanifiee}
        retraitClient={m.retraitClient} setRetraitClient={m.setRetraitClient}
        vehiculeId={m.vehiculeId} setVehiculeId={m.setVehiculeId}
        chauffeurId={m.chauffeurId} setChauffeurId={m.setChauffeurId}
        vehicules={m.vehicules} chauffeurs={m.chauffeurs}
        noteChauffeur={m.noteChauffeur} setNoteChauffeur={m.setNoteChauffeur}
        handleAffectation={m.handleAffectation} affSaving={m.affSaving}
      />

      <ModalEncaissement
        showEncaissement={m.showEncaissement} setShowEncaissement={m.setShowEncaissement}
        livraisonAEncaisser={m.livraisonAEncaisser}
        modeEncaissement={m.modeEncaissement} setModeEncaissement={m.setModeEncaissement}
        montantEncaisse={m.montantEncaisse} setMontantEncaisse={m.setMontantEncaisse}
        confirmerEncaissementLivraison={m.confirmerEncaissementLivraison} encaissementSaving={m.encaissementSaving}
        dateLivraisonEffective={m.dateLivraisonEffective} setDateLivraisonEffective={m.setDateLivraisonEffective}
      />

      <ModalConfirmerLivraison
        showConfirmerLivraison={m.showConfirmerLivraison} setShowConfirmerLivraison={m.setShowConfirmerLivraison}
        livraisonAConfirmer={m.livraisonAConfirmer}
        dateLivraisonEffective={m.dateLivraisonEffective} setDateLivraisonEffective={m.setDateLivraisonEffective}
        executerConfirmerLivraison={m.executerConfirmerLivraison} confirmerLivraisonSaving={m.confirmerLivraisonSaving}
      />

      <ModalPerte
        showPerte={m.showPerte} setShowPerte={m.setShowPerte} livraisonPourPerte={m.livraisonPourPerte}
        formPerte={m.formPerte} setFormPerte={m.setFormPerte}
        soumettrePerte={m.soumettrePerte} perteSaving={m.perteSaving}
      />

      <ModalHistoriquePartiel
        chainePartielle={m.chainePartielle} setChainePartielle={m.setChainePartielle}
        handleGenererBLSpecial={m.handleGenererBLSpecial} blSpecialSaving={m.blSpecialSaving}
      />

      <ModalConfirmation
        confirmation={m.confirmation} fermerConfirmation={m.fermerConfirmation} confirmerAction={m.confirmerAction}
      />

    </div>
  )
}
