// Extrait de LivraisonsView.jsx (refactor découpage, 2026-08) — tout
// l'état, les fetchers et les handlers, déplacés tels quels. Seule
// exception volontaire : les window.confirm()/alert() de
// handleAnnulerCommande, handleAffectation, retirerVersPlanifier,
// remettreToutEnAttente et soumettrePerte sont remplacés par
// ModalConfirmation.jsx + une bannière d'erreur (erreurAction) — même
// message, même logique, juste sans blocage synchrone du navigateur.
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import { toBouteilles } from '../../../lib/conversions'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { genererBonLivraison, genererBLSpecial } from '../../../lib/pdf'
import { resoudreEtapesAccords } from '../../../lib/livraisonsPartielles'
import { TIER_CONFIG, estLivraisonDuJour } from './helpers'

export function useLivraisonsView() {
  const { user } = useAuth()
  const [onglet, setOnglet]         = useState('jour')
  const [livraisons, setLivraisons] = useState([])
  const [commandes, setCommandes]   = useState([])
  const [chauffeurs, setChauffeurs] = useState([])
  const [vehicules, setVehicules]   = useState([])
  const [tiersClients, setTiersClients] = useState({})
  const [loading, setLoading]       = useState(true)

  const [showAffectation, setShowAffectation]   = useState(false)
  const [cmdSelectionnee, setCmdSelectionnee]   = useState(null)
  const [chauffeurId, setChauffeurId]           = useState('')
  const [vehiculeId, setVehiculeId]             = useState('')
  const [datePlanifiee, setDatePlanifiee]       = useState(new Date().toISOString().split('T')[0])
  const [noteChauffeur, setNoteChauffeur]       = useState('')
  const [affSaving, setAffSaving]               = useState(false)
  // AJOUT : le client vient recuperer lui-meme (pas de chauffeur/vehicule)
  const [retraitClient, setRetraitClient]       = useState(false)

  // ── Déclaration du montant récupéré à la livraison (Cas 2) ──
  const [showEncaissement, setShowEncaissement]     = useState(false)
  const [livraisonAEncaisser, setLivraisonAEncaisser] = useState(null)
  const [modeEncaissement, setModeEncaissement]       = useState('Especes')
  const [montantEncaisse, setMontantEncaisse]         = useState('')
  const [encaissementSaving, setEncaissementSaving]   = useState(false)

  // AJOUT (bug remonté par l'utilisateur) : date de livraison EFFECTIVE,
  // modifiable au moment de la confirmation (au lieu d'enregistrer
  // systématiquement la date du clic) — même pattern que "Nouvelle
  // production" (ProductionsComptableView.jsx : date pré-remplie à
  // aujourd'hui, modifiable si la saisie est faite en retard). Partagée
  // entre les 2 chemins de confirmation ci-dessous (ModalEncaissement pour
  // le cas "Livraison", ModalConfirmerLivraison pour Comptant/Credit/
  // Paiement30j) — un seul des deux est ouvert à la fois.
  const [dateLivraisonEffective, setDateLivraisonEffective] = useState(new Date().toISOString().split('T')[0])
  const [showConfirmerLivraison, setShowConfirmerLivraison]         = useState(false)
  const [livraisonAConfirmer, setLivraisonAConfirmer]               = useState(null)
  const [confirmerLivraisonSaving, setConfirmerLivraisonSaving]     = useState(false)

  // ── Signalement d'une perte/dommage à la livraison ──
  const [showPerte, setShowPerte]                   = useState(false)
  const [livraisonPourPerte, setLivraisonPourPerte] = useState(null) // { livraisonId, commande }
  const [formPerte, setFormPerte]                   = useState({ quantite: '', unite: 'Carton', motif: 'Fuite' })
  const [perteSaving, setPerteSaving]               = useState(false)
  const [idsLivraisonsAvecPerte, setIdsLivraisonsAvecPerte] = useState(new Set())

  // AJOUT (demande Kassim) : même fonctionnalité "BL spécial" que
  // CommandesView.jsx — badge + historique + PDF cumulatif pour les
  // commandes ayant eu plusieurs livraisons partielles. Liste dédiée et
  // légère (pas de filtre de statut, contrairement à `commandes`
  // ci-dessus qui ne sert qu'à la planification) car reconstruire une
  // chaîne demande de voir toutes les commandes, y compris déjà livrées.
  const [commandesChaine, setCommandesChaine]   = useState([])
  const [chainePartielle, setChainePartielle]   = useState(null)
  const [blSpecialSaving, setBlSpecialSaving]   = useState(false)

  const aujourdhui = new Date().toISOString().split('T')[0]

  // REFACTOR (2026-08) : remplace window.confirm()/alert() sur les 8
  // occurrences signalées par Herald.
  const [confirmation, setConfirmation] = useState(null)
  const [erreurAction, setErreurAction] = useState(null)

  useEffect(() => {
    fetchAll()
    const channel = supabase.channel('livraisons-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'livraisons' }, fetchAll)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchAll() {
    await Promise.all([
      fetchLivraisonsJour(),
      fetchCommandesALivrer(),
      fetchChauffeurs(),
      fetchVehicules(),
      fetchTiersClients(),
      fetchPertesEnAttente(),
      fetchCommandesChaine(),
    ])
    setLoading(false)
  }

  async function fetchCommandesChaine() {
    const { data } = await supabase
      .from('commandes')
      .select('id, client_id, commande_parent_id, numero_facture, statut, date_livraison, date_paiement, date_planification, cree_le, clients(nom_entreprise, type_client, telephone), commandes_lignes(unite, quantite)')
    setCommandesChaine(data || [])
  }

  // CORRIGÉ (2026-08, bug "quantités incorrectes" BL spécial) :
  // construireHistoriquePartiel() (liste en mémoire) affichait "Commandé"
  // à chaque étape comme le cumul de tout ce qui restait EN AVAL, et
  // "Livré : 0" tant que le statut physique du maillon n'était pas
  // terminal (souvent le cas juste après un accord) — au lieu de la
  // quantité RÉELLEMENT accordée à cette étape. resoudreEtapesAccords()
  // (async, lib/livraisonsPartielles.js) s'appuie sur accords_commande —
  // même source que le Bon de commande — pour des chiffres cohérents
  // entre les deux documents.
  async function ouvrirHistoriquePartiel(cmd) {
    setChainePartielle(await resoudreEtapesAccords(cmd))
  }

  async function handleGenererBLSpecial() {
    if (!chainePartielle) return
    setBlSpecialSaving(true)
    try {
      await genererBLSpecial(chainePartielle)
    } finally {
      setBlSpecialSaving(false)
    }
  }

  // MODIFIÉ : ne sert plus qu'à exclure de "Livraisons du jour" — la liste
  // et l'action de confirmation vivent désormais exclusivement dans le
  // module Pertes & dommages (PertesLivraisonView.jsx). Seul l'id de
  // livraison est nécessaire ici.
  async function fetchPertesEnAttente() {
    const { data } = await supabase
      .from('pertes_livraison')
      .select('livraison_id')
      .eq('statut', 'En_attente')
    setIdsLivraisonsAvecPerte(new Set((data || []).map(p => p.livraison_id)))
  }

  // MODIFIÉ : requetes separees au lieu d'un select imbrique — plus
  // robuste (evite les echecs silencieux sur relation ambigue), et log
  // les erreurs pour pouvoir diagnostiquer si ca replante
  // MODIFIÉ : recupere aussi les livraisons EN RETARD (planifiees avant
  // aujourd'hui, toujours pas confirmees) — avant, seule la date du jour
  // exact etait affichee, une livraison en retard devenait invisible
  async function fetchLivraisonsJour() {
    const { data: duJour } = await supabase
      .from('v_livraisons_jour')
      .select('*')

    const memeChamps = `
      id, commande_id, statut, date_planifiee, date_effective, note_chauffeur,
      chauffeurs(nom_complet, telephone),
      vehicules(immatriculation, type_vehicule),
      commandes(numero_facture, montant_total, clients(nom_entreprise, type_client, adresse))
    `
    const majChamps = l => ({
      id: l.id,
      commande_id: l.commande_id,
      statut: l.statut,
      date_planifiee: l.date_planifiee,
      date_effective: l.date_effective,
      note_chauffeur: l.note_chauffeur,
      nom_chauffeur: l.chauffeurs?.nom_complet || null,
      telephone_chauffeur: l.chauffeurs?.telephone || null,
      immatriculation: l.vehicules?.immatriculation || null,
      type_vehicule: l.vehicules?.type_vehicule || null,
      numero_facture: l.commandes?.numero_facture || null,
      montant_total: l.commandes?.montant_total || 0,
      nom_entreprise: l.commandes?.clients?.nom_entreprise || null,
      type_client: l.commandes?.clients?.type_client || null,
      adresse: l.commandes?.clients?.adresse || null,
    })

    // AJOUT : livraisons en retard — meme requete brute (livraisons +
    // commandes + clients + chauffeurs + vehicules) pour reconstituer les
    // memes champs que la vue, sans dependre de son filtre de date
    const { data: enRetardBrut } = await supabase
      .from('livraisons')
      .select(memeChamps)
      .lt('date_planifiee', new Date().toISOString().split('T')[0])
      .in('statut', ['Planifiee', 'En_cours'])

    const enRetard = (enRetardBrut || []).map(l => ({ ...majChamps(l), en_retard: true }))

    // AJOUT (2026-08, bug remonté sur OGS-2026-0284) : livraisons déjà
    // confirmées (statut Livree) mais dont la confirmation elle-même est
    // survenue en retard — v_livraisons_jour (date_planifiee = jour même)
    // et la requête "en retard" ci-dessus (statut Planifiee/En_cours
    // seulement) ne peuvent JAMAIS les remonter : leur date_planifiee
    // n'est plus "aujourd'hui" et leur statut n'est plus "pas confirmée".
    // Sans cette requête, une livraison oubliée puis confirmée tardivement
    // disparaissait purement et simplement de "Livraisons du jour" au
    // prochain rafraîchissement — invisible, pas juste mal classée.
    // Bornée aux 30 derniers jours de confirmation (date_effective) pour
    // rester une requête raisonnable ; le tri "du jour" vs "en retard" est
    // fait ensuite côté client par estLivraisonDuJour() (helpers.js).
    const il30Jours = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const { data: confirmeesRecemmentBrut } = await supabase
      .from('livraisons')
      .select(memeChamps)
      .eq('statut', 'Livree')
      .gte('date_effective', il30Jours)

    const confirmeesRecemment = (confirmeesRecemmentBrut || []).map(majChamps)

    // Dédoublonnage : une livraison planifiee ET confirmee le jour meme
    // est remontee a la fois par v_livraisons_jour (date_planifiee =
    // aujourd'hui) et par la requete confirmeesRecemment ci-dessus
    // (statut Livree, date_effective recente) — v_livraisons_jour est
    // prioritaire (champs plus complets : montant_total, type_client...).
    const idsDuJour = new Set((duJour || []).map(l => l.id))
    const data = [
      ...enRetard.filter(l => !idsDuJour.has(l.id)),
      ...confirmeesRecemment.filter(l => !idsDuJour.has(l.id)),
      ...(duJour || []),
    ]

    const commandeIds = [...new Set((data || []).map(l => l.commande_id).filter(Boolean))]
    let telephones = {}
    let lignesParCommande = {}
    let etiquettesEauPar = {}

    if (commandeIds.length > 0) {
      const { data: commandesData, error: errCmd } = await supabase
        .from('commandes')
        .select('id, client_id, eau_potable, date_derogation_potable')
        .in('id', commandeIds)
      if (errCmd) console.error('fetchLivraisonsJour — commandes:', errCmd)

      const clientIds = [...new Set((commandesData || []).map(c => c.client_id).filter(Boolean))]
      if (clientIds.length > 0) {
        const { data: clientsData, error: errCli } = await supabase
          .from('clients')
          .select('id, telephone')
          .in('id', clientIds)
        if (errCli) console.error('fetchLivraisonsJour — clients:', errCli)
        const telByClientId = Object.fromEntries((clientsData || []).map(c => [c.id, c.telephone]))
        telephones = Object.fromEntries((commandesData || []).map(c => [c.id, telByClientId[c.client_id] || null]))
      }

      // AJOUT (item 12) : étiquette "non-buvable", visible 24h après la
      // dérogation validée par Soumeya (voir CommandesView.jsx)
      etiquettesEauPar = Object.fromEntries(
        (commandesData || []).map(c => [c.id, { eau_potable: c.eau_potable, date_derogation_potable: c.date_derogation_potable }])
      )

      const { data: lignesData, error: errLignes } = await supabase
        .from('commandes_lignes')
        .select('commande_id, unite, quantite')
        .in('commande_id', commandeIds)
      if (errLignes) console.error('fetchLivraisonsJour — commandes_lignes:', errLignes)

      ;(lignesData || []).forEach(l => {
        if (!lignesParCommande[l.commande_id]) lignesParCommande[l.commande_id] = []
        lignesParCommande[l.commande_id].push(l)
      })
    }

    const enrichi = (data || []).map(l => ({
      ...l,
      telephone_client: telephones[l.commande_id] || null,
      quantite_texte: (lignesParCommande[l.commande_id] || [])
        .map(ln => `${ln.quantite} ${ln.unite}${ln.quantite > 1 ? 's' : ''}`)
        .join(', ') || '—',
      eau_potable: etiquettesEauPar[l.commande_id]?.eau_potable,
      date_derogation_potable: etiquettesEauPar[l.commande_id]?.date_derogation_potable,
    }))

    setLivraisons(enrichi)
  }

  async function fetchTiersClients() {
    const { data, error } = await supabase.from('v_client_tier').select('client_id, tier')
    if (error) {
      console.error('fetchTiersClients:', error.message)
      return
    }
    const map = {}
    data?.forEach(t => { map[t.client_id] = t.tier })
    setTiersClients(map)
  }

  async function fetchCommandesALivrer() {
    const { data: cmds } = await supabase
      .from('commandes')
      .select('*, clients(nom_entreprise, type_client, adresse, telephone), commandes_lignes(*)')
      .in('statut', ['En_preparation', 'Facture_acquittee'])
      .eq('planifie_livraison', true)
      .order('cree_le', { ascending: true })

    const commandesEligibles = (cmds || []).filter(c => {
      if (c.cas_vente === 'Comptant') return c.statut === 'Facture_acquittee'
      return c.statut === 'En_preparation'
    })

    const { data: livs } = await supabase
      .from('livraisons')
      .select('commande_id')
      .in('statut', ['Planifiee', 'En_cours'])

    const cmdsPlanifiees = new Set(livs?.map(l => l.commande_id) || [])
    setCommandes(commandesEligibles.filter(c => !cmdsPlanifiees.has(c.id)))
  }

  async function fetchChauffeurs() {
    const { data } = await supabase.from('chauffeurs').select('*').eq('actif', true).order('nom_complet')
    setChauffeurs(data || [])
  }

  async function fetchVehicules() {
    const { data } = await supabase.from('vehicules').select('*').eq('actif', true).order('immatriculation')
    setVehicules(data || [])
  }

  function demanderConfirmation(message, onConfirmer) {
    setConfirmation({ message, onConfirmer })
  }
  function fermerConfirmation() {
    setConfirmation(null)
  }
  async function confirmerAction() {
    const action = confirmation?.onConfirmer
    setConfirmation(null)
    if (action) await action()
  }

  function handleAnnulerCommande(cmd) {
    demanderConfirmation(
      `Annuler la commande ${cmd.numero_facture} (${cmd.clients?.nom_entreprise}) ? Cette action est irréversible.`,
      () => executerAnnulerCommande(cmd)
    )
  }

  async function executerAnnulerCommande(cmd) {
    const { data, error } = await supabase.from('commandes')
      .update({ statut: 'Annulee' }).eq('id', cmd.id).select()

    if (error) { setErreurAction(`Impossible d'annuler : ${error.message}`); return }
    if (!data || data.length === 0) {
      setErreurAction("L'annulation n'a modifié aucune ligne — probable blocage RLS sur ce rôle pour la table commandes.")
      return
    }
    await fetchAll()
  }

  function ouvrirAffectation(cmd) {
    setCmdSelectionnee(cmd)
    setChauffeurId('')
    setVehiculeId('')
    setDatePlanifiee(aujourdhui)
    setNoteChauffeur('')
    setRetraitClient(false)
    setShowAffectation(true)
  }

  // CORRIGÉ (bug bloquant remonté par l'utilisateur — urgent) : retire le
  // contrôle bloquant qui comparait la commande au "stock dépôt (vendable)"
  // — résidu de l'ANCIEN mécanisme, où ce compteur reflétait un stock réel
  // décrémenté par les livraisons. Depuis la refonte du module Stocks &
  // Dépôt (StockView.jsx), "Stock dépôt (vendable)" est un simple total
  // MENSUEL des sorties usine, totalement découplé des livraisons — plus
  // du tout un indicateur de disponibilité réelle, donc plus utilisable
  // pour bloquer une planification (d'où les valeurs négatives observées :
  // v_stock_disponible/fetchStockLivrable() n'avaient jamais été mis à
  // jour en cohérence avec cette refonte). La planification de livraison
  // ne dépend donc plus du tout du stock dépôt.
  async function handleAffectation(e) {
    e.preventDefault()

    setAffSaving(true)

    await supabase.from('livraisons').insert({
      commande_id:    cmdSelectionnee.id,
      chauffeur_id:   retraitClient ? null : (chauffeurId || null),
      vehicule_id:    retraitClient ? null : (vehiculeId  || null),
      date_planifiee: datePlanifiee,
      note_chauffeur: retraitClient ? `Retrait client sur place${noteChauffeur ? ' — ' + noteChauffeur : ''}` : (noteChauffeur || null),
      statut:         'Planifiee',
      cree_par:       user.id,
    })

    setShowAffectation(false)
    await fetchAll()
    setAffSaving(false)
  }

  async function demarrerLivraison(livraisonId) {
    await supabase.from('livraisons').update({
      statut: 'En_cours',
      mis_a_jour_le: new Date().toISOString(),
    }).eq('id', livraisonId)
    await fetchAll()
  }

  // AJOUT : erreur d'assignation (mauvais chauffeur/vehicule/commande) —
  // supprime la livraison pour que la commande revienne dans "À planifier"
  function retirerVersPlanifier(liv) {
    demanderConfirmation(
      `Retirer cette livraison (${liv.nom_entreprise}) et la remettre dans "À planifier" ?`,
      () => executerRetirerVersPlanifier(liv)
    )
  }

  async function executerRetirerVersPlanifier(liv) {
    await supabase.from('livraisons').delete().eq('id', liv.id)
    await fetchAll()
  }

  // AJOUT : annule la transmission d'une commande — la renvoie dans
  // "Commandes en attente" cote commercial (erreur de transmission)
  async function remettreEnAttente(cmd) {
    await supabase.from('commandes').update({
      planifie_livraison: false,
      date_planification: null,
    }).eq('id', cmd.id)
    await fetchAll()
  }

  // AJOUT : remet TOUT le lot "a planifier" en attente d'un coup
  function remettreToutEnAttente() {
    demanderConfirmation(
      `Remettre les ${commandes.length} commandes en attente (annule leur transmission) ?`,
      executerRemettreToutEnAttente
    )
  }

  async function executerRemettreToutEnAttente() {
    const ids = commandes.map(c => c.id)
    await supabase.from('commandes').update({
      planifie_livraison: false,
      date_planification: null,
    }).in('id', ids)
    await fetchAll()
  }

  async function imprimerBonLivraison(liv) {
    const { data: commande } = await supabase
      .from('commandes')
      .select('*, clients(nom_entreprise, type_client, telephone, adresse), commandes_lignes(*)')
      .eq('id', liv.commande_id)
      .single()
    if (!commande) return

    // le "reste" a ete transforme en une commande separee liee par
    // commande_parent_id — on la retrouve pour reconstituer la quantite
    // reellement demandee au depart (demandee = livree + reste)
    const { data: reste } = await supabase
      .from('commandes')
      .select('commandes_lignes(*)')
      .eq('commande_parent_id', commande.id)
      .maybeSingle()

    const lignesEnrichies = (commande.commandes_lignes || []).map(l => {
      const ligneReste = reste?.commandes_lignes?.find(r => r.unite === l.unite)
      return { ...l, quantite_demandee: Number(l.quantite) + Number(ligneReste?.quantite || 0) }
    })

    genererBonLivraison({ ...commande, commandes_lignes: lignesEnrichies }, liv.date_planifiee, {
      chauffeurNom: liv.nom_chauffeur, vehiculeImmat: liv.immatriculation,
    })
  }

  // ── Confirme la livraison — branche selon le cas de vente ──
  // MODIFIÉ : le Cas 2 (Livraison) ne finalise plus l'encaissement ici.
  // Le chauffeur déclare seulement ce qu'il a récupéré sur place ; c'est
  // le comptable qui valide et clôture financièrement, dans l'onglet
  // "Livraison à valider" de MurDesCredits.jsx (Encaissements).
  // MODIFIÉ (retiré) : l'insertion manuelle dans `stocks` a été supprimée
  // — il existe DÉJÀ un trigger Postgres (handle_commande_update) qui
  // insère automatiquement une ligne Sortie_livraison des que le statut
  // de la commande passe de En_preparation a Livree/Facture_acquittee/
  // Facture_et_livree/Livree_creance_active. Le code ci-dessous faisait
  // doublon avec ce trigger (chaque livraison comptait deux fois dans
  // le stock). Le trigger se declenche tout seul via les .update()
  // plus bas — rien a faire cote JS.
  async function confirmerLivraison(liv) {
    const { data: commande } = await supabase
      .from('commandes')
      .select('*, clients(nom_entreprise), commandes_lignes(*)')
      .eq('id', liv.commande_id)
      .single()

    if (!commande) return

    // AJOUT : réinitialise la date proposée à aujourd'hui à chaque
    // ouverture — l'utilisateur la corrige ensuite dans la modale si la
    // confirmation est faite en retard.
    setDateLivraisonEffective(aujourdhui)

    if (commande.cas_vente === 'Livraison') {
      // Cas 2 — le chauffeur DÉCLARE ce qu'il a récupéré (pas d'encaissement final)
      setLivraisonAEncaisser({ livraisonId: liv.id, commande })
      setMontantEncaisse(commande.montant_total)
      setModeEncaissement('Especes')
      setShowEncaissement(true)
    } else {
      // MODIFIÉ (bug remonté par l'utilisateur) : n'écrit plus directement
      // — ouvre ModalConfirmerLivraison pour laisser choisir/corriger la
      // date de livraison effective avant écriture (voir
      // executerConfirmerLivraison ci-dessous, qui fait l'écriture réelle).
      setLivraisonAConfirmer({ livraisonId: liv.id, commande })
      setShowConfirmerLivraison(true)
    }
  }

  // AJOUT : écriture réelle de la confirmation pour Comptant/Credit/
  // Paiement30j — extrait de confirmerLivraison() ci-dessus pour permettre
  // le choix de date_effective dans ModalConfirmerLivraison, au lieu d'un
  // now()/aujourd'hui codé en dur. Logique de statut inchangée : Comptant
  // → Facture_et_livree (déjà réglé, physiquement retiré/livré maintenant,
  // plus rien à faire côté comptable) ; Credit/Paiement30j →
  // Livree_creance_active (alimente le Mur des Créances).
  async function executerConfirmerLivraison(e) {
    e.preventDefault()
    if (!livraisonAConfirmer) return
    setConfirmerLivraisonSaving(true)
    const { livraisonId, commande } = livraisonAConfirmer

    const nouveauStatutCommande = (commande.cas_vente === 'Credit' || commande.cas_vente === 'Paiement30j') ? 'Livree_creance_active' : 'Facture_et_livree'

    await supabase.from('livraisons').update({
      statut: 'Livree',
      date_effective: dateLivraisonEffective,
    }).eq('id', livraisonId)

    await supabase.from('commandes').update({
      statut: nouveauStatutCommande,
      date_livraison: dateLivraisonEffective,
    }).eq('id', commande.id)

    setShowConfirmerLivraison(false)
    setLivraisonAConfirmer(null)
    await fetchAll()
    setConfirmerLivraisonSaving(false)
  }

  // ── Signalement d'une perte/dommage — optionnel, n'alourdit pas le
  // flux normal de confirmation (bouton séparé, pas une étape obligatoire)
  // MODIFIÉ : plus de choix de remplacement ni de commande créée — la
  // perte bloque simplement la livraison (elle bascule dans l'onglet
  // "Pertes et dommages") jusqu'à confirmation manuelle par Kassim.
  async function ouvrirDeclarationPerte(liv) {
    const { data: commande } = await supabase
      .from('commandes')
      .select('id, numero_facture, client_id, type_client, clients(nom_entreprise)')
      .eq('id', liv.commande_id)
      .single()
    if (!commande) return
    setLivraisonPourPerte({ livraisonId: liv.id, commande })
    setFormPerte({ quantite: '', unite: 'Carton', motif: 'Fuite' })
    setShowPerte(true)
  }

  async function soumettrePerte(e) {
    e.preventDefault()
    if (!livraisonPourPerte) return
    const { livraisonId, commande } = livraisonPourPerte

    const quantite = Number(formPerte.quantite)
    if (!quantite || quantite <= 0) { setErreurAction('Indique une quantité perdue.'); return }

    setPerteSaving(true)
    try {
      const { error } = await supabase.from('pertes_livraison').insert({
        livraison_id: livraisonId,
        commande_id: commande.id,
        client_id: commande.client_id,
        quantite_perdue: quantite,
        unite: formPerte.unite,
        quantite_bouteilles: toBouteilles(formPerte.unite, quantite),
        motif: formPerte.motif,
        statut: 'En_attente',
        declare_par: user.id,
      })
      if (error) throw error

      setShowPerte(false)
      setLivraisonPourPerte(null)
      await fetchAll()
    } catch (err) {
      setErreurAction(`Erreur lors de la déclaration de la perte : ${err.message}`)
    } finally {
      setPerteSaving(false)
    }
  }

  // ── MODIFIÉ : le chauffeur DÉCLARE le montant/mode récupéré, il ne
  // clôture plus la commande. statut passe à 'Livree' (générique "livré,
  // en attente de clôture comptable") au lieu de 'Facture_et_livree'. Le
  // reçu officiel et le passage en Facture_et_livree se font désormais
  // côté comptable, dans MurDesCredits.jsx (onglet "Livraison à valider").
  // CORRIGÉ (2026-08, bug trouvé sur 6 commandes — OGS-2026-0195/0294/
  // 0268/0282/0277/0300) : cette fonction écrivait à tort
  // commandes.montant_regle dès cette DÉCLARATION du chauffeur, avant
  // toute validation comptable réelle — malgré le commentaire ci-dessus
  // ("il ne clôture plus la commande") et le texte de ModalEncaissement.jsx
  // lui-même ("Le comptable validera... dans l'onglet Livraison à
  // valider"). Conséquence : la commande apparaissait avec
  // montant_regle = montant déclaré (souvent = montant_total) SANS
  // aucune ligne dans paiements_partiels — un vrai encaissement n'est
  // créé que par handleValiderLivraison() (murDesCredits/useMurDesCredits.js),
  // qui appelle enregistrerPaiement() AVANT de poser montant_regle. Ça
  // faisait à tort passer ces commandes pour "soldées" partout où
  // montant_regle est comparé à montant_total (y compris
  // v_fermeture_compte.creances_restantes depuis le lot 37, qui inclut
  // désormais statut='Livree' — ces commandes se retrouvaient masquées
  // au lieu d'apparaître comme créances actives).
  // montant_regle n'est donc plus touché ici — seul mode_reglement reste
  // écrit (légitime : ouvrirValidationLivraison() le relit pour
  // pré-remplir le mode côté comptable, alors que montant_regle n'était
  // lu nulle part pour un pré-remplissage — voir son commentaire propre,
  // qui utilise délibérément montant_total pour éviter une valeur
  // obsolète). montantEncaisse reste saisi par le chauffeur (affichage
  // seulement, aucune autre utilité aujourd'hui sans colonne dédiée — non
  // ajoutée ici, voir le rapport).
  async function confirmerEncaissementLivraison(e) {
    e.preventDefault()
    if (!livraisonAEncaisser) return
    setEncaissementSaving(true)

    const { livraisonId, commande } = livraisonAEncaisser

    await supabase.from('livraisons').update({
      statut: 'Livree',
      date_effective: dateLivraisonEffective,
    }).eq('id', livraisonId)

    await supabase.from('commandes').update({
      statut:         'Livree',
      mode_reglement:  modeEncaissement,
      date_livraison:  dateLivraisonEffective,
    }).eq('id', commande.id)

    setShowEncaissement(false)
    setLivraisonAEncaisser(null)
    setMontantEncaisse('')
    await fetchAll()
    setEncaissementSaving(false)
  }

  async function genererFeuilleRoute() {
    const doc   = new jsPDF()
    const vert  = [10, 80, 40]
    const or    = [34, 165, 89]
    const dark  = [15, 23, 42]
    const pageW = doc.internal.pageSize.width
    const pageH = doc.internal.pageSize.height

    doc.setFillColor(...vert)
    doc.rect(0, 0, pageW, 35, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('OUGOUL SPRING', 14, 15)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Feuille de Route — Service Livraison', 14, 23)
    doc.setFillColor(...or)
    doc.roundedRect(pageW - 60, 8, 50, 12, 2, 2, 'F')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(new Date().toLocaleDateString('fr-FR'), pageW - 35, 16.5, { align: 'center' })

    doc.setFillColor(240, 247, 240)
    doc.rect(0, 35, pageW, 12, 'F')
    doc.setTextColor(...vert)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('LIVRAISONS DU JOUR', pageW / 2, 44, { align: 'center' })

    doc.setTextColor(...dark)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Total livraisons : ${livraisons.length}`, 14, 58)
    doc.text(`Planifiées : ${livraisons.filter(l => l.statut === 'Planifiee').length}`, 80, 58)
    doc.text(`En cours : ${livraisons.filter(l => l.statut === 'En_cours').length}`, 140, 58)

    const rows = livraisons.map((l, i) => [
      i + 1,
      l.nom_entreprise || '—',
      l.type_client || '—',
      l.adresse || '—',
      l.telephone_client || '—',
      l.quantite_texte || '—',
      `${l.nom_chauffeur || '—'}\n${l.telephone_chauffeur || ''}`,
      l.immatriculation || '—',
      l.statut === 'Planifiee' ? 'Planifiee' : l.statut === 'En_cours' ? 'En cours' : 'Livree',
    ])

    autoTable(doc, {
      startY: 65,
      head:   [['#', 'Client', 'Type', 'Adresse', 'Téléphone', 'Quantité', 'Chauffeur', 'Véhicule', 'Statut']],
      body:   rows,
      theme:  'grid',
      headStyles: { fillColor: vert, textColor: [255,255,255], fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7, textColor: dark },
      alternateRowStyles: { fillColor: [245, 250, 245] },
      columnStyles: {
        0: { cellWidth: 7,  halign: 'center' },
        2: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 20, halign: 'center' },
        8: { cellWidth: 16, halign: 'center' },
      },
    })

    doc.setFillColor(...vert)
    doc.rect(0, pageH - 14, pageW, 14, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Ougoul Spring — Service Logistique', 14, pageH - 5)
    doc.text(`Imprimé le ${new Date().toLocaleDateString('fr-FR')}`, pageW - 14, pageH - 5, { align: 'right' })

    doc.save(`FeuilleRoute_${aujourdhui}.pdf`)
  }

  // AJOUT : "Livraisons du jour" exclut toute livraison bloquée par une
  // perte non résolue (gérée exclusivement dans le module Pertes & dommages)
  // CORRIGÉ (2026-08, régression trouvée sur OGS-2026-0129) : partition
  // stricte via estLivraisonDuJour() (helpers.js) — chaque livraison
  // fetchée tombe dans exactement un des deux onglets, jamais aucun ni
  // les deux. Voir le commentaire de estLivraisonDuJour() pour le détail
  // de la règle (le filtre précédent, basé sur estConfirmeeEnRetard/écart
  // > 1 jour, laissait passer dans "Livraisons du jour" toute livraison
  // Livree dont l'écart planifiee/effective était <= 1 jour, même avec
  // une date_planifiee très ancienne).
  const livraisonsJourFiltrees = livraisons.filter(l =>
    !idsLivraisonsAvecPerte.has(l.id) && estLivraisonDuJour(l, aujourdhui)
  )
  const livraisonsConfirmeesEnRetard = livraisons.filter(l =>
    !idsLivraisonsAvecPerte.has(l.id) && !estLivraisonDuJour(l, aujourdhui)
  )

  // CORRIGÉ (2026-08) : basé sur livraisonsJourFiltrees, plus sur
  // livraisons brut — depuis l'ajout de la requête confirmeesRecemment
  // (fetchLivraisonsJour, jusqu'à 30 jours d'historique Livree), `livraisons`
  // contient aussi les livraisons confirmées en retard. Les basculer sur
  // livraisonsJourFiltrees évite que les tuiles "Total du jour"/"Livrées"
  // et le texte d'en-tête ne gonflent avec de l'historique hors sujet —
  // même symptôme que le bug remonté sur OGS-2026-0129, ici sur les stats.
  const stats = {
    total:     livraisonsJourFiltrees.length,
    planifiee: livraisonsJourFiltrees.filter(l => l.statut === 'Planifiee').length,
    en_cours:  livraisonsJourFiltrees.filter(l => l.statut === 'En_cours').length,
    livree:    livraisonsJourFiltrees.filter(l => l.statut === 'Livree').length,
  }

  const parType = {
    Distributeur: livraisonsJourFiltrees.filter(l => l.type_client === 'Distributeur').length,
    Entreprise:   livraisonsJourFiltrees.filter(l => l.type_client === 'Entreprise').length,
    Particulier:  livraisonsJourFiltrees.filter(l => l.type_client === 'Particulier').length,
  }

  const commandesTriees = [...commandes].sort((a, b) => {
    const tierA = TIER_CONFIG[tiersClients[a.client_id] || 'Normal'].priorite
    const tierB = TIER_CONFIG[tiersClients[b.client_id] || 'Normal'].priorite
    if (tierA !== tierB) return tierA - tierB
    return new Date(a.cree_le) - new Date(b.cree_le)
  })

  return {
    onglet, setOnglet, livraisons, commandes, chauffeurs, vehicules, tiersClients, loading, aujourdhui,
    showAffectation, setShowAffectation, cmdSelectionnee, chauffeurId, setChauffeurId,
    vehiculeId, setVehiculeId, datePlanifiee, setDatePlanifiee, noteChauffeur, setNoteChauffeur,
    affSaving, retraitClient, setRetraitClient,
    showEncaissement, setShowEncaissement, livraisonAEncaisser, modeEncaissement, setModeEncaissement,
    montantEncaisse, setMontantEncaisse, encaissementSaving,
    dateLivraisonEffective, setDateLivraisonEffective,
    showConfirmerLivraison, setShowConfirmerLivraison, livraisonAConfirmer,
    executerConfirmerLivraison, confirmerLivraisonSaving,
    showPerte, setShowPerte, livraisonPourPerte, formPerte, setFormPerte, perteSaving,
    commandesChaine, chainePartielle, setChainePartielle, blSpecialSaving,
    confirmation, fermerConfirmation, confirmerAction,
    erreurAction, setErreurAction,
    fetchAll, ouvrirHistoriquePartiel, handleGenererBLSpecial,
    handleAnnulerCommande, ouvrirAffectation, handleAffectation, demarrerLivraison,
    retirerVersPlanifier, remettreEnAttente, remettreToutEnAttente,
    imprimerBonLivraison, confirmerLivraison, ouvrirDeclarationPerte, soumettrePerte,
    confirmerEncaissementLivraison, genererFeuilleRoute,
    stats, parType, commandesTriees, livraisonsJourFiltrees, livraisonsConfirmeesEnRetard,
  }
}
