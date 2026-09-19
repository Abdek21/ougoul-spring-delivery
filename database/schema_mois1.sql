-- Types ENUM (26) + fonction calculer_its — prérequis avant les tables

CREATE TYPE "action_prevue" AS ENUM ('Rappeler', 'Visiter_a_nouveau', 'Envoyer_une_offre', 'Presenter_un_echantillon', 'En_attente_du_lancement');
CREATE TYPE "cas_vente" AS ENUM ('Comptant', 'Livraison', 'Credit', 'Paiement30j');
CREATE TYPE "categorie_mp" AS ENUM ('Preforme_500ml', 'Bouchon', 'Stickers', 'Intercalaire', 'Shrink', 'Stretch', 'Preforme_1_5L', 'Preforme_350ml', 'Preforme_2L', 'Poignee');
CREATE TYPE "categorie_tache" AS ENUM ('Prospection', 'Suivi_client', 'Livraison', 'Administration', 'Reunion', 'Stock', 'Autre');
CREATE TYPE "mode_paiement_compta" AS ENUM ('Especes', 'Cheque', 'Virement', 'D_Money', 'Waafi', 'CAC', 'Sans_facture');
CREATE TYPE "mode_reglement" AS ENUM ('Especes', 'D_Money', 'Waafi', 'Virement', 'CAC', 'Cheque');
CREATE TYPE "niveau_consommation" AS ENUM ('Faible', 'Moyenne', 'Elevee');
CREATE TYPE "niveau_interet" AS ENUM ('Tres_interesse', 'Interesse', 'Peu_interesse', 'Pas_interesse');
CREATE TYPE "resultat_prospect" AS ENUM ('Prospect_actif', 'Client_obtenu', 'A_suivre', 'Refus');
CREATE TYPE "role_utilisateur" AS ENUM ('admin', 'commercial', 'logistique', 'magasinier', 'comptable', 'gestionnaire', 'client', 'livreur', 'rh', 'audit');
CREATE TYPE "secteur_activite" AS ENUM ('Hotel', 'Restaurant', 'Cafe', 'Supermarche', 'Epicerie', 'Ecole', 'Clinique', 'Entreprise', 'Administration', 'Autre');
CREATE TYPE "service_employe" AS ENUM ('Production', 'Logistique', 'Chauffeur', 'Magasinier', 'Administration', 'Commercial', 'Autre');
CREATE TYPE "statut_commande" AS ENUM ('En_preparation', 'Livree', 'Payee', 'Annulee', 'Facture_acquittee', 'Facture_et_livree', 'Livree_creance_active');
CREATE TYPE "statut_employe" AS ENUM ('Actif', 'Inactif');
CREATE TYPE "statut_livraison" AS ENUM ('Planifiee', 'En_cours', 'Livree', 'Echouee');
CREATE TYPE "statut_paiement_salaire" AS ENUM ('A_payer', 'Paye');
CREATE TYPE "statut_perte_livraison" AS ENUM ('En_attente', 'Resolue', 'Annule');
CREATE TYPE "statut_stock" AS ENUM ('En_attente', 'Validee', 'Corrigee');
CREATE TYPE "statut_vehicule" AS ENUM ('Disponible', 'En_route', 'Maintenance', 'Hors_service');
CREATE TYPE "type_client" AS ENUM ('Distributeur', 'Particulier', 'Entreprise');
CREATE TYPE "type_ligne_salaire" AS ENUM ('Prime', 'Retenue');
CREATE TYPE "type_mouvement" AS ENUM ('Entree_production', 'Sortie_livraison', 'Correction_admin', 'Inventaire', 'Perte_livraison');
CREATE TYPE "type_mouvement_mp" AS ENUM ('Entree_fournisseur', 'Sortie_production', 'Ajustement');
CREATE TYPE "type_sortie_usine" AS ENUM ('En_attente', 'Validee', 'Corrigee');
CREATE TYPE "unite_commande" AS ENUM ('Palette', 'Carton', 'Pack', 'Bouteille');
CREATE TYPE "unite_mp" AS ENUM ('Unite', 'Rouleau', 'Bobine', 'Carton');

-- FUNCTION: calculer_its (dépendance de la vue v_declaration_cnss)
-- NOTE : référence la table "bareme_its" (tranches d'impôt ITS) qui
-- n'a pas encore été exportée — voir generate_bareme_its.sql, à lancer
-- avant que cette fonction soit réellement utilisable.
CREATE OR REPLACE FUNCTION public.calculer_its(assiette numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  v_montant NUMERIC;
BEGIN
  IF assiette < 50000 THEN
    RETURN 0;
  END IF;

  SELECT montant_impot INTO v_montant
  FROM bareme_its
  WHERE assiette >= tranche_basse AND assiette <= tranche_haute
  LIMIT 1;

  IF v_montant IS NOT NULL THEN
    RETURN v_montant;
  END IF;

  IF assiette > 1999999 THEN
    RETURN 595900 + CEIL((assiette - 1999999) / 5000.0) * 2250;
  END IF;

  RETURN 0;
END;
$function$

-- TABLE: avertissements
CREATE TABLE IF NOT EXISTS "avertissements" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "employe_id" uuid,
  "employe_nom_libre" text,
  "employe_fonction_libre" text,
  "numero" integer NOT NULL,
  "date_avertissement" date NOT NULL DEFAULT CURRENT_DATE,
  "objet" text NOT NULL,
  "motif_court" text NOT NULL,
  "motif_precedent" text,
  "paragraphe_principal" text NOT NULL,
  "paragraphe_consequences" text NOT NULL,
  "civilite" text NOT NULL,
  "cree_par" uuid,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("cree_par") REFERENCES "profiles"("id"),
  FOREIGN KEY ("employe_id") REFERENCES "employes"("id"),
  CONSTRAINT "avertissements_employe_xor_libre" CHECK ((((employe_id IS NOT NULL) AND (employe_nom_libre IS NULL) AND (employe_fonction_libre IS NULL)) OR ((employe_id IS NULL) AND (employe_nom_libre IS NOT NULL) AND (employe_fonction_libre IS NOT NULL)))),
  CONSTRAINT "avertissements_civilite_check" CHECK ((civilite = ANY (ARRAY['M.'::text, 'Mme'::text])))
);
ALTER TABLE "avertissements" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "avertissements_authenticated_all" ON "avertissements" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: candidatures
CREATE TABLE IF NOT EXISTS "candidatures" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "nom_complet" text NOT NULL,
  "poste_vise" text NOT NULL,
  "telephone" text,
  "email" text,
  "cv_url" text,
  "source" text,
  "statut" text NOT NULL DEFAULT 'Recu'::text,
  "note_entretien" text,
  "date_entretien" date,
  "cree_par" uuid,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  "mis_a_jour_le" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("cree_par") REFERENCES "profiles"("id"),
  CONSTRAINT "candidatures_source_check" CHECK ((source = ANY (ARRAY['Spontanee'::text, 'Annonce'::text, 'Recommandation'::text, 'Reseau_social'::text, 'Autre'::text]))),
  CONSTRAINT "candidatures_statut_check" CHECK ((statut = ANY (ARRAY['Recu'::text, 'Preselectionne'::text, 'Entretien_planifie'::text, 'Entretien_fait'::text, 'Offre_envoyee'::text, 'Embauche'::text, 'Refuse'::text])))
);
ALTER TABLE "candidatures" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "candidatures_authenticated_all" ON "candidatures" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: chauffeurs
CREATE TABLE IF NOT EXISTS "chauffeurs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "nom_complet" text NOT NULL,
  "telephone" text,
  "num_permis" text,
  "actif" boolean NOT NULL DEFAULT true,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  "mis_a_jour_le" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
ALTER TABLE "chauffeurs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chauffeurs_authenticated_all" ON "chauffeurs" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: clients
CREATE TABLE IF NOT EXISTS "clients" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "nom_entreprise" text NOT NULL,
  "type_client" type_client NOT NULL DEFAULT 'Entreprise'::type_client,
  "secteur" secteur_activite,
  "nom_contact" text,
  "telephone" text,
  "email" text,
  "adresse" text,
  "solde_credit" numeric(12,2) NOT NULL DEFAULT 0,
  "actif" boolean NOT NULL DEFAULT true,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  "mis_a_jour_le" timestamp with time zone NOT NULL DEFAULT now(),
  "user_id" uuid,
  PRIMARY KEY ("id")
);
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_authenticated_all" ON "clients" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: commandes
CREATE TABLE IF NOT EXISTS "commandes" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL,
  "type_client" type_client NOT NULL,
  "statut" statut_commande NOT NULL DEFAULT 'En_preparation'::statut_commande,
  "mode_reglement" mode_reglement,
  "montant_total" numeric(12,2) NOT NULL,
  "montant_regle" numeric(12,2) NOT NULL DEFAULT 0,
  "note" text,
  "numero_facture" text,
  "cree_par" uuid,
  "date_livraison" date,
  "date_paiement" date,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  "mis_a_jour_le" timestamp with time zone NOT NULL DEFAULT now(),
  "cas_vente" cas_vente NOT NULL DEFAULT 'Livraison'::cas_vente,
  "date_livraison_ts" timestamp with time zone,
  "planifie_livraison" boolean NOT NULL DEFAULT false,
  "date_planification" timestamp with time zone,
  "commande_parent_id" uuid,
  "eau_potable" boolean NOT NULL DEFAULT true,
  "date_derogation_potable" timestamp with time zone,
  "facture_consolidee_id" uuid,
  "date_echeance" date,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("commande_parent_id") REFERENCES "commandes"("id"),
  FOREIGN KEY ("client_id") REFERENCES "clients"("id"),
  FOREIGN KEY ("cree_par") REFERENCES "profiles"("id")
);
ALTER TABLE "commandes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commandes_authenticated_all" ON "commandes" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: commandes_lignes
CREATE TABLE IF NOT EXISTS "commandes_lignes" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "commande_id" uuid NOT NULL,
  "unite" unite_commande NOT NULL DEFAULT 'Carton'::unite_commande,
  "quantite" integer NOT NULL,
  "quantite_bouteilles" integer NOT NULL DEFAULT 0,
  "prix_unitaire" numeric(10,2) NOT NULL,
  "sous_total" numeric(12,2) DEFAULT ((quantite)::numeric * prix_unitaire),
  "format" text NOT NULL DEFAULT '500ml'::text,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("commande_id") REFERENCES "commandes"("id"),
  CONSTRAINT "commandes_lignes_quantite_check" CHECK ((quantite > 0))
);
ALTER TABLE "commandes_lignes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commandes_lignes_authenticated_all" ON "commandes_lignes" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: conges
CREATE TABLE IF NOT EXISTS "conges" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "employe_id" uuid NOT NULL,
  "type_conge" text NOT NULL,
  "date_debut" date NOT NULL,
  "date_fin" date NOT NULL,
  "nb_jours" integer NOT NULL,
  "motif" text,
  "statut" text NOT NULL DEFAULT 'En_attente'::text,
  "note_refus" text,
  "cree_par" uuid,
  "valide_par" uuid,
  "valide_le" timestamp with time zone,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("valide_par") REFERENCES "profiles"("id"),
  FOREIGN KEY ("cree_par") REFERENCES "profiles"("id"),
  FOREIGN KEY ("employe_id") REFERENCES "employes"("id"),
  CONSTRAINT "conges_type_conge_check" CHECK ((type_conge = ANY (ARRAY['Conge_paye'::text, 'Maladie'::text, 'Sans_solde'::text, 'Exceptionnel'::text, 'Maternite_paternite'::text]))),
  CONSTRAINT "conges_statut_check" CHECK ((statut = ANY (ARRAY['En_attente'::text, 'Approuve'::text, 'Refuse'::text, 'Annule'::text])))
);
ALTER TABLE "conges" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conges_authenticated_all" ON "conges" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: declarations_cnss
CREATE TABLE IF NOT EXISTS "declarations_cnss" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "employe_id" uuid NOT NULL,
  "mois" integer NOT NULL,
  "annee" integer NOT NULL,
  "assiette" numeric(12,2) NOT NULL DEFAULT 0,
  "saisi_par" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "heures_supplementaires" numeric(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("employe_id") REFERENCES "employes"("id"),
  FOREIGN KEY ("saisi_par") REFERENCES "profiles"("id"),
  CONSTRAINT "declarations_cnss_mois_check" CHECK (((mois >= 1) AND (mois <= 12))),
  CONSTRAINT "declarations_cnss_annee_check" CHECK ((annee >= 2020)),
  CONSTRAINT "declarations_cnss_salaire_brut_check" CHECK ((assiette >= (0)::numeric))
);
ALTER TABLE "declarations_cnss" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "declarations_cnss_authenticated_all" ON "declarations_cnss" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: depenses
CREATE TABLE IF NOT EXISTS "depenses" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "numero_piece" text NOT NULL,
  "date_depense" date NOT NULL DEFAULT CURRENT_DATE,
  "numero_facture" text,
  "fournisseur" text,
  "libelle" text NOT NULL,
  "mode_paiement" mode_paiement_compta NOT NULL DEFAULT 'Especes'::mode_paiement_compta,
  "montant" numeric(12,2) NOT NULL DEFAULT 0,
  "numero_cheque" text,
  "nom_banque" text,
  "mois_cloture" text,
  "cree_par" uuid,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  "mis_a_jour_le" timestamp with time zone NOT NULL DEFAULT now(),
  "sans_facture" boolean NOT NULL DEFAULT false,
  "mois_concerne" text,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("cree_par") REFERENCES "profiles"("id")
);
ALTER TABLE "depenses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "depenses_authenticated_all" ON "depenses" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: employes
CREATE TABLE IF NOT EXISTS "employes" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "matricule" text,
  "nom" text NOT NULL,
  "prenom" text,
  "poste" text NOT NULL,
  "service" service_employe NOT NULL DEFAULT 'Autre'::service_employe,
  "telephone" text,
  "numero_cni" text,
  "numero_cnss" text,
  "date_naissance" date,
  "salaire_base" numeric(12,2) NOT NULL,
  "date_embauche" date NOT NULL DEFAULT CURRENT_DATE,
  "statut" statut_employe NOT NULL DEFAULT 'Actif'::statut_employe,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "employes_salaire_base_check" CHECK ((salaire_base >= (0)::numeric))
);
ALTER TABLE "employes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employes_authenticated_all" ON "employes" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: fiches_commande
CREATE TABLE IF NOT EXISTS "fiches_commande" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "type_client" text NOT NULL,
  "client_id" uuid,
  "nom_client" text NOT NULL,
  "secteur_activite" text,
  "nom_contact" text,
  "fonction" text,
  "telephone" text,
  "adresse_livraison" text,
  "quartier_secteur" text,
  "lignes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "mode_paiement" text,
  "commentaire" text,
  "date_prise_commande" date NOT NULL DEFAULT CURRENT_DATE,
  "heure_prise_commande" time without time zone,
  "statut" text NOT NULL DEFAULT 'En_attente'::text,
  "motif_rejet" text,
  "commande_id" uuid,
  "valide_par" uuid,
  "valide_le" timestamp with time zone,
  "cree_par" uuid,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  "photo_url" text,
  "cas_vente_souhaite" text NOT NULL DEFAULT 'Livraison'::text,
  "corrige_par" uuid,
  "corrige_le" timestamp with time zone,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("cree_par") REFERENCES "profiles"("id"),
  FOREIGN KEY ("corrige_par") REFERENCES "profiles"("id"),
  FOREIGN KEY ("valide_par") REFERENCES "profiles"("id"),
  FOREIGN KEY ("commande_id") REFERENCES "commandes"("id"),
  FOREIGN KEY ("client_id") REFERENCES "clients"("id"),
  CONSTRAINT "fiches_commande_statut_check" CHECK ((statut = ANY (ARRAY['En_attente'::text, 'Validee'::text, 'Rejetee'::text]))),
  CONSTRAINT "fiches_commande_type_client_check" CHECK ((type_client = ANY (ARRAY['Entreprise'::text, 'Particulier'::text])))
);
ALTER TABLE "fiches_commande" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fiches_commande_authenticated_all" ON "fiches_commande" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: fiches_enregistrement_distributeur
CREATE TABLE IF NOT EXISTS "fiches_enregistrement_distributeur" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "nom_entreprise" text NOT NULL,
  "nom_distributeur" text,
  "responsable" text,
  "telephone" text,
  "adresse_personnelle" text,
  "adresse_professionnelle" text,
  "copie_cni" boolean NOT NULL DEFAULT false,
  "autres_documents" text,
  "volume_previsionnel" text,
  "secteur_desservi" text,
  "nombre_voyages_souhaite" integer,
  "commentaires" text,
  "statut" text NOT NULL DEFAULT 'En_attente'::text,
  "motif_rejet" text,
  "client_id" uuid,
  "valide_par" uuid,
  "valide_le" timestamp with time zone,
  "cree_par" uuid,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  "photo_url" text,
  "commande_initiale_lignes" jsonb,
  "commande_initiale_cas_vente" text,
  "commande_initiale_mode_paiement" text,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("valide_par") REFERENCES "profiles"("id"),
  FOREIGN KEY ("client_id") REFERENCES "clients"("id"),
  FOREIGN KEY ("cree_par") REFERENCES "profiles"("id"),
  CONSTRAINT "fiches_enreg_distrib_statut_check" CHECK ((statut = ANY (ARRAY['En_attente'::text, 'Validee'::text, 'Rejetee'::text])))
);
ALTER TABLE "fiches_enregistrement_distributeur" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fiches_enregistrement_distributeur_authenticated_all" ON "fiches_enregistrement_distributeur" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: fiches_modification_client
CREATE TABLE IF NOT EXISTS "fiches_modification_client" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL,
  "champs_modifies" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "motif" text,
  "photo_url" text,
  "statut" text NOT NULL DEFAULT 'En_attente'::text,
  "motif_rejet" text,
  "valide_par" uuid,
  "valide_le" timestamp with time zone,
  "cree_par" uuid,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("client_id") REFERENCES "clients"("id"),
  FOREIGN KEY ("cree_par") REFERENCES "profiles"("id"),
  FOREIGN KEY ("valide_par") REFERENCES "profiles"("id"),
  CONSTRAINT "fiches_modif_client_statut_check" CHECK ((statut = ANY (ARRAY['En_attente'::text, 'Validee'::text, 'Rejetee'::text])))
);
ALTER TABLE "fiches_modification_client" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fiches_modification_client_authenticated_all" ON "fiches_modification_client" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: fiches_reclamation
CREATE TABLE IF NOT EXISTS "fiches_reclamation" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "client_id" uuid,
  "nom_client" text NOT NULL,
  "telephone" text,
  "type_reclamation" text NOT NULL,
  "description" text NOT NULL,
  "photo_url" text,
  "statut" text NOT NULL DEFAULT 'Nouvelle'::text,
  "reponse" text,
  "traite_par" uuid,
  "traite_le" timestamp with time zone,
  "cree_par" uuid,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("traite_par") REFERENCES "profiles"("id"),
  FOREIGN KEY ("cree_par") REFERENCES "profiles"("id"),
  FOREIGN KEY ("client_id") REFERENCES "clients"("id"),
  CONSTRAINT "fiches_reclamation_type_check" CHECK ((type_reclamation = ANY (ARRAY['Retard_livraison'::text, 'Produit_endommage'::text, 'Erreur_facturation'::text, 'Qualite_produit'::text, 'Autre'::text]))),
  CONSTRAINT "fiches_reclamation_statut_check" CHECK ((statut = ANY (ARRAY['Nouvelle'::text, 'En_cours'::text, 'Resolue'::text, 'Rejetee'::text])))
);
ALTER TABLE "fiches_reclamation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fiches_reclamation_authenticated_all" ON "fiches_reclamation" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: fiches_renouvellement_document
CREATE TABLE IF NOT EXISTS "fiches_renouvellement_document" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "vehicule_id" uuid NOT NULL,
  "type_document" text NOT NULL,
  "nouvelle_date_expiration" date NOT NULL,
  "nouveau_prix" numeric,
  "photo_url" text,
  "statut" text NOT NULL DEFAULT 'En_attente'::text,
  "motif_rejet" text,
  "valide_par" uuid,
  "valide_le" timestamp with time zone,
  "cree_par" uuid,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("valide_par") REFERENCES "profiles"("id"),
  FOREIGN KEY ("cree_par") REFERENCES "profiles"("id"),
  FOREIGN KEY ("vehicule_id") REFERENCES "vehicules"("id"),
  CONSTRAINT "fiches_renouv_doc_type_check" CHECK ((type_document = ANY (ARRAY['assurance'::text, 'vignette'::text]))),
  CONSTRAINT "fiches_renouv_doc_statut_check" CHECK ((statut = ANY (ARRAY['En_attente'::text, 'Validee'::text, 'Rejetee'::text])))
);
ALTER TABLE "fiches_renouvellement_document" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fiches_renouvellement_document_authenticated_all" ON "fiches_renouvellement_document" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: livraisons
CREATE TABLE IF NOT EXISTS "livraisons" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "commande_id" uuid NOT NULL,
  "chauffeur_id" uuid,
  "vehicule_id" uuid,
  "statut" statut_livraison NOT NULL DEFAULT 'Planifiee'::statut_livraison,
  "date_planifiee" date NOT NULL DEFAULT CURRENT_DATE,
  "date_effective" date,
  "note_chauffeur" text,
  "cree_par" uuid,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  "mis_a_jour_le" timestamp with time zone NOT NULL DEFAULT now(),
  "palettes_retournees" integer NOT NULL DEFAULT 0,
  "cartons_retournes" integer NOT NULL DEFAULT 0,
  "packs_retournes" integer NOT NULL DEFAULT 0,
  "note_retour" text,
  "nombre_ouvriers" integer,
  "prix_par_ouvrier" numeric,
  "depense_main_oeuvre_id" uuid,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("vehicule_id") REFERENCES "vehicules"("id"),
  FOREIGN KEY ("cree_par") REFERENCES "profiles"("id"),
  FOREIGN KEY ("commande_id") REFERENCES "commandes"("id"),
  FOREIGN KEY ("chauffeur_id") REFERENCES "chauffeurs"("id"),
  FOREIGN KEY ("depense_main_oeuvre_id") REFERENCES "depenses"("id")
);
ALTER TABLE "livraisons" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "livraisons_authenticated_all" ON "livraisons" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: matieres_premieres
CREATE TABLE IF NOT EXISTS "matieres_premieres" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "designation" text NOT NULL,
  "categorie" categorie_mp NOT NULL,
  "unite" unite_mp NOT NULL DEFAULT 'Unite'::unite_mp,
  "conditionnement" text,
  "seuil_alerte" integer NOT NULL DEFAULT 0,
  "actif" boolean NOT NULL DEFAULT true,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
ALTER TABLE "matieres_premieres" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matieres_premieres_authenticated_all" ON "matieres_premieres" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: mouvements_matieres_premieres
CREATE TABLE IF NOT EXISTS "mouvements_matieres_premieres" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "matiere_id" uuid NOT NULL,
  "date_mouvement" date NOT NULL DEFAULT CURRENT_DATE,
  "type_mouvement" type_mouvement_mp NOT NULL,
  "quantite_entree" integer NOT NULL DEFAULT 0,
  "quantite_sortie" integer NOT NULL DEFAULT 0,
  "stock_apres" integer NOT NULL DEFAULT 0,
  "reference_id" uuid,
  "note" text,
  "cree_par" uuid,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("cree_par") REFERENCES "profiles"("id"),
  FOREIGN KEY ("matiere_id") REFERENCES "matieres_premieres"("id")
);
ALTER TABLE "mouvements_matieres_premieres" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mouvements_matieres_premieres_authenticated_all" ON "mouvements_matieres_premieres" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: paiements_administratifs
CREATE TABLE IF NOT EXISTS "paiements_administratifs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "type_paiement" text NOT NULL,
  "periode" text,
  "montant" numeric NOT NULL,
  "numero_reference" text,
  "photo_url" text,
  "statut" text NOT NULL DEFAULT 'En_attente'::text,
  "motif_rejet" text,
  "depense_id" uuid,
  "valide_par" uuid,
  "valide_le" timestamp with time zone,
  "cree_par" uuid,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("valide_par") REFERENCES "profiles"("id"),
  FOREIGN KEY ("depense_id") REFERENCES "depenses"("id"),
  FOREIGN KEY ("cree_par") REFERENCES "profiles"("id"),
  CONSTRAINT "paiements_administratifs_type_check" CHECK ((type_paiement = ANY (ARRAY['Patente'::text, 'CNSS'::text, 'EDD'::text, 'Internet'::text, 'Autre'::text]))),
  CONSTRAINT "paiements_administratifs_statut_check" CHECK ((statut = ANY (ARRAY['En_attente'::text, 'Validee'::text, 'Rejetee'::text])))
);
ALTER TABLE "paiements_administratifs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "paiements_administratifs_authenticated_all" ON "paiements_administratifs" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: pertes_livraison
CREATE TABLE IF NOT EXISTS "pertes_livraison" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "livraison_id" uuid NOT NULL,
  "commande_id" uuid NOT NULL,
  "client_id" uuid NOT NULL,
  "quantite_perdue" integer NOT NULL,
  "unite" unite_commande NOT NULL DEFAULT 'Carton'::unite_commande,
  "quantite_bouteilles" integer NOT NULL,
  "motif" text,
  "statut" statut_perte_livraison NOT NULL DEFAULT 'En_attente'::statut_perte_livraison,
  "declare_par" uuid,
  "date_declaration" timestamp with time zone NOT NULL DEFAULT now(),
  "note" text,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  "mis_a_jour_le" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("client_id") REFERENCES "clients"("id"),
  FOREIGN KEY ("declare_par") REFERENCES "profiles"("id"),
  FOREIGN KEY ("commande_id") REFERENCES "commandes"("id"),
  FOREIGN KEY ("livraison_id") REFERENCES "livraisons"("id"),
  CONSTRAINT "pertes_livraison_quantite_perdue_check" CHECK ((quantite_perdue > 0)),
  CONSTRAINT "pertes_livraison_quantite_bouteilles_check" CHECK ((quantite_bouteilles > 0))
);
ALTER TABLE "pertes_livraison" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pertes_livraison_authenticated_all" ON "pertes_livraison" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: productions
CREATE TABLE IF NOT EXISTS "productions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "date_production" date NOT NULL DEFAULT CURRENT_DATE,
  "preformes_prelevees" integer NOT NULL DEFAULT 0,
  "bouchons_preleves" integer NOT NULL DEFAULT 0,
  "stickers_preleves" integer NOT NULL DEFAULT 0,
  "quantite_bouteilles_ok" integer NOT NULL DEFAULT 0,
  "quantite_dechets" integer NOT NULL DEFAULT 0,
  "quantite_cartons" integer DEFAULT (quantite_bouteilles_ok / 24),
  "taux_rebut_pct" numeric(5,2) DEFAULT
CASE
    WHEN ((quantite_bouteilles_ok + quantite_dechets) > 0) THEN round((((quantite_dechets)::numeric / ((quantite_bouteilles_ok + quantite_dechets))::numeric) * (100)::numeric), 2)
    ELSE (0)::numeric
END,
  "observation" text,
  "cree_par" uuid,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  "type_bouteille" text NOT NULL DEFAULT '500ml'::text,
  "intercalaires_preleves" integer NOT NULL DEFAULT 0,
  "shrink_preleve" integer NOT NULL DEFAULT 0,
  "stretch_preleve" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("cree_par") REFERENCES "profiles"("id")
);
ALTER TABLE "productions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "productions_authenticated_all" ON "productions" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: profiles
CREATE TABLE IF NOT EXISTS "profiles" (
  "id" uuid NOT NULL,
  "nom_complet" text NOT NULL,
  "role" role_utilisateur NOT NULL DEFAULT 'commercial'::role_utilisateur,
  "avatar_url" text,
  "actif" boolean NOT NULL DEFAULT true,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  "mis_a_jour_le" timestamp with time zone NOT NULL DEFAULT now(),
  "approuve_client" boolean DEFAULT false,
  "telephone" text,
  "quartier" text,
  "livreur_vehicule_type" text,
  "livreur_vehicule_immatriculation" text,
  "livreur_actif" boolean NOT NULL DEFAULT true,
  "photo_url" text,
  PRIMARY KEY ("id")
);
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_authenticated_all" ON "profiles" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: prospects
CREATE TABLE IF NOT EXISTS "prospects" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "date_visite" date NOT NULL DEFAULT CURRENT_DATE,
  "nom_entreprise" text NOT NULL,
  "secteur" secteur_activite NOT NULL,
  "nom_contact" text,
  "fonction" text,
  "telephone" text,
  "email" text,
  "adresse" text,
  "marque_actuelle" text,
  "consommation" niveau_consommation,
  "niveau_interet" niveau_interet,
  "observations" text,
  "objections" text,
  "action_prevue" action_prevue,
  "date_relance" date,
  "resultat" resultat_prospect DEFAULT 'Prospect_actif'::resultat_prospect,
  "cree_par" uuid,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  "mis_a_jour_le" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("cree_par") REFERENCES "profiles"("id")
);
ALTER TABLE "prospects" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prospects_authenticated_all" ON "prospects" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: registre_appels
CREATE TABLE IF NOT EXISTS "registre_appels" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "date_appel" timestamp with time zone NOT NULL DEFAULT now(),
  "nom_appelant" text NOT NULL,
  "telephone" text,
  "motif" text NOT NULL,
  "suivi_a_faire" text,
  "statut" text NOT NULL DEFAULT 'A_traiter'::text,
  "traite_par" uuid,
  "traite_le" timestamp with time zone,
  "cree_par" uuid,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("traite_par") REFERENCES "profiles"("id"),
  FOREIGN KEY ("cree_par") REFERENCES "profiles"("id"),
  CONSTRAINT "registre_appels_statut_check" CHECK ((statut = ANY (ARRAY['A_traiter'::text, 'Traite'::text])))
);
ALTER TABLE "registre_appels" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "registre_appels_authenticated_all" ON "registre_appels" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: salaires
CREATE TABLE IF NOT EXISTS "salaires" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "employe_id" uuid NOT NULL,
  "numero_bulletin" text,
  "mois" integer NOT NULL,
  "annee" integer NOT NULL,
  "salaire_base_effectif" numeric(12,2) NOT NULL DEFAULT 0,
  "proratise" boolean NOT NULL DEFAULT false,
  "jours_travailles" integer,
  "jours_mois" integer,
  "heures_supplementaires" numeric(12,2) NOT NULL DEFAULT 0,
  "total_primes" numeric(12,2) NOT NULL DEFAULT 0,
  "salaire_brut" numeric(12,2) NOT NULL DEFAULT 0,
  "cnss_montant" numeric(12,2) NOT NULL DEFAULT 0,
  "its_montant" numeric(12,2) NOT NULL DEFAULT 0,
  "waqf_montant" numeric(12,2) NOT NULL DEFAULT 400,
  "retenue_absence" numeric(12,2) NOT NULL DEFAULT 0,
  "total_retenues" numeric(12,2) NOT NULL DEFAULT 0,
  "net_a_payer" numeric(12,2) DEFAULT ((((((salaire_brut - cnss_montant) - its_montant) - waqf_montant) - retenue_absence) + total_primes) - total_retenues),
  "statut" statut_paiement_salaire NOT NULL DEFAULT 'A_payer'::statut_paiement_salaire,
  "mode_paiement" text,
  "date_paiement" date,
  "depense_id" uuid,
  "saisi_par" uuid,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("depense_id") REFERENCES "depenses"("id"),
  FOREIGN KEY ("employe_id") REFERENCES "employes"("id"),
  FOREIGN KEY ("saisi_par") REFERENCES "profiles"("id"),
  CONSTRAINT "salaires_heures_supplementaires_check" CHECK ((heures_supplementaires >= (0)::numeric)),
  CONSTRAINT "salaires_annee_check" CHECK ((annee >= 2020)),
  CONSTRAINT "salaires_cnss_montant_check" CHECK ((cnss_montant >= (0)::numeric)),
  CONSTRAINT "salaires_its_montant_check" CHECK ((its_montant >= (0)::numeric)),
  CONSTRAINT "salaires_waqf_montant_check" CHECK ((waqf_montant >= (0)::numeric)),
  CONSTRAINT "salaires_total_retenues_check" CHECK ((total_retenues >= (0)::numeric)),
  CONSTRAINT "salaires_total_primes_check" CHECK ((total_primes >= (0)::numeric)),
  CONSTRAINT "salaires_salaire_brut_check" CHECK ((salaire_brut >= (0)::numeric)),
  CONSTRAINT "salaires_salaire_base_effectif_check" CHECK ((salaire_base_effectif >= (0)::numeric)),
  CONSTRAINT "salaires_retenue_absence_check" CHECK ((retenue_absence >= (0)::numeric)),
  CONSTRAINT "salaires_mois_check" CHECK (((mois >= 1) AND (mois <= 12))),
  CONSTRAINT "salaires_mode_paiement_check" CHECK (((mode_paiement IS NULL) OR (mode_paiement = ANY (ARRAY['Especes'::text, 'Cheque'::text, 'Virement'::text, 'D_Money'::text, 'Waafi'::text, 'CAC'::text]))))
);
ALTER TABLE "salaires" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salaires_authenticated_all" ON "salaires" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: salaires_lignes
CREATE TABLE IF NOT EXISTS "salaires_lignes" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "salaire_id" uuid NOT NULL,
  "type" type_ligne_salaire NOT NULL,
  "libelle" text NOT NULL,
  "montant" numeric(12,2) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("salaire_id") REFERENCES "salaires"("id"),
  CONSTRAINT "salaires_lignes_montant_check" CHECK ((montant >= (0)::numeric))
);
ALTER TABLE "salaires_lignes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "salaires_lignes_authenticated_all" ON "salaires_lignes" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: sorties_usine
CREATE TABLE IF NOT EXISTS "sorties_usine" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "date_sortie" date NOT NULL DEFAULT CURRENT_DATE,
  "quantite_palettes" integer NOT NULL DEFAULT 0,
  "quantite_cartons" integer NOT NULL DEFAULT 0,
  "statut" type_sortie_usine NOT NULL DEFAULT 'En_attente'::type_sortie_usine,
  "note" text,
  "note_correction" text,
  "cree_par" uuid,
  "valide_par" uuid,
  "valide_le" timestamp with time zone,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("valide_par") REFERENCES "profiles"("id"),
  FOREIGN KEY ("cree_par") REFERENCES "profiles"("id")
);
ALTER TABLE "sorties_usine" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sorties_usine_authenticated_all" ON "sorties_usine" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: stocks
CREATE TABLE IF NOT EXISTS "stocks" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "type_mouvement" type_mouvement NOT NULL,
  "statut" statut_stock NOT NULL DEFAULT 'En_attente'::statut_stock,
  "unite_saisie" unite_commande NOT NULL DEFAULT 'Carton'::unite_commande,
  "quantite_saisie" integer NOT NULL,
  "quantite_bouteilles" integer NOT NULL,
  "reference_id" uuid,
  "note" text,
  "note_correction" text,
  "cree_par" uuid,
  "valide_par" uuid,
  "valide_le" timestamp with time zone,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("cree_par") REFERENCES "profiles"("id"),
  FOREIGN KEY ("valide_par") REFERENCES "profiles"("id"),
  CONSTRAINT "stocks_quantite_saisie_check" CHECK ((quantite_saisie > 0))
);
ALTER TABLE "stocks" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stocks_authenticated_all" ON "stocks" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: suivi_quotidien
CREATE TABLE IF NOT EXISTS "suivi_quotidien" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "utilisateur_id" uuid NOT NULL,
  "tache_type_id" uuid NOT NULL,
  "date_saisie" date NOT NULL DEFAULT CURRENT_DATE,
  "commentaire" text,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("tache_type_id") REFERENCES "taches_types"("id"),
  FOREIGN KEY ("utilisateur_id") REFERENCES "profiles"("id")
);
ALTER TABLE "suivi_quotidien" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suivi_quotidien_authenticated_all" ON "suivi_quotidien" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: taches_types
CREATE TABLE IF NOT EXISTS "taches_types" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "libelle" text NOT NULL,
  "categorie" categorie_tache NOT NULL,
  "roles" role_utilisateur[] NOT NULL DEFAULT '{commercial,logistique}'::role_utilisateur[],
  "actif" boolean NOT NULL DEFAULT true,
  "ordre" smallint DEFAULT 0,
  PRIMARY KEY ("id")
);
ALTER TABLE "taches_types" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "taches_types_authenticated_all" ON "taches_types" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: vehicules
CREATE TABLE IF NOT EXISTS "vehicules" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "immatriculation" text NOT NULL,
  "type_vehicule" text NOT NULL DEFAULT 'Camion'::text,
  "capacite_palettes" integer NOT NULL DEFAULT 10,
  "statut" statut_vehicule NOT NULL DEFAULT 'Disponible'::statut_vehicule,
  "note" text,
  "actif" boolean NOT NULL DEFAULT true,
  "cree_le" timestamp with time zone NOT NULL DEFAULT now(),
  "mis_a_jour_le" timestamp with time zone NOT NULL DEFAULT now(),
  "assurance_expiration" date,
  "carte_grise_expiration" date,
  "vignette_expiration" date,
  "vignette_prix" numeric,
  "chauffeur_habituel_id" uuid,
  "assurance_document_url" text,
  "vignette_document_url" text,
  PRIMARY KEY ("id"),
  FOREIGN KEY ("chauffeur_habituel_id") REFERENCES "chauffeurs"("id")
);
ALTER TABLE "vehicules" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicules_authenticated_all" ON "vehicules" FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- VIEW: v_client_tier
CREATE OR REPLACE VIEW "v_client_tier" AS
 WITH commandes_ordonnees AS (
         SELECT c.client_id,
            c.id,
            c.cas_vente,
            c.statut,
            c.cree_le,
            row_number() OVER (PARTITION BY c.client_id ORDER BY c.cree_le DESC) AS rang
           FROM commandes c
          WHERE c.statut <> 'Annulee'::statut_commande
        ), marquage AS (
         SELECT commandes_ordonnees.client_id,
            commandes_ordonnees.id,
            commandes_ordonnees.cas_vente,
            commandes_ordonnees.statut,
            commandes_ordonnees.cree_le,
            commandes_ordonnees.rang,
                CASE
                    WHEN commandes_ordonnees.cas_vente = 'Comptant'::cas_vente AND commandes_ordonnees.statut = 'Facture_acquittee'::statut_commande THEN 0
                    ELSE 1
                END AS casse_serie
           FROM commandes_ordonnees
        ), premiere_casse AS (
         SELECT marquage.client_id,
            min(marquage.rang) AS rang_casse
           FROM marquage
          WHERE marquage.casse_serie = 1
          GROUP BY marquage.client_id
        ), streak AS (
         SELECT m.client_id,
            count(*) AS serie_comptant_consecutive
           FROM marquage m
             LEFT JOIN premiere_casse pc ON pc.client_id = m.client_id
          WHERE m.casse_serie = 0 AND (pc.rang_casse IS NULL OR m.rang < pc.rang_casse)
          GROUP BY m.client_id
        ), retard AS (
         SELECT DISTINCT commandes.client_id
           FROM commandes
          WHERE commandes.statut = 'Livree_creance_active'::statut_commande AND commandes.montant_regle < commandes.montant_total AND commandes.date_livraison < CURRENT_DATE
        )
 SELECT cl.id AS client_id,
    cl.nom_entreprise,
    COALESCE(s.serie_comptant_consecutive, 0::bigint) AS serie_comptant_consecutive,
        CASE
            WHEN r.client_id IS NOT NULL THEN 'Retardataire'::text
            WHEN COALESCE(s.serie_comptant_consecutive, 0::bigint) >= 6 THEN 'VIP'::text
            ELSE 'Normal'::text
        END AS tier
   FROM clients cl
     LEFT JOIN streak s ON s.client_id = cl.id
     LEFT JOIN retard r ON r.client_id = cl.id;

-- VIEW: v_declaration_cnss
CREATE OR REPLACE VIEW "v_declaration_cnss" AS
 SELECT d.id AS declaration_id,
    d.mois,
    d.annee,
    e.id AS employe_id,
    e.nom,
    e.prenom,
    e.numero_cnss,
    e.date_naissance,
    e.poste,
    d.assiette AS salaire_brut,
    d.heures_supplementaires,
    round(d.assiette * 0.217, 2) AS cotisation_cnss_totale,
    round(d.assiette * 0.06, 2) AS part_salariale,
    round(d.assiette * 0.157, 2) AS part_patronale,
    calculer_its(d.assiette - round(d.assiette * 0.06, 2)) AS its_calcule
   FROM declarations_cnss d
     JOIN employes e ON e.id = d.employe_id
  ORDER BY d.annee DESC, d.mois DESC, e.nom;

-- VIEW: v_livraisons_jour
CREATE OR REPLACE VIEW "v_livraisons_jour" AS
 SELECT l.id,
    l.commande_id,
    l.chauffeur_id,
    l.vehicule_id,
    l.statut,
    l.date_planifiee,
    l.date_effective,
    l.note_chauffeur,
    l.cree_par,
    l.cree_le,
    l.mis_a_jour_le,
    cmd.numero_facture,
    cmd.montant_total,
    cmd.type_client,
    cl.nom_entreprise,
    cl.adresse,
    cl.telephone AS telephone_client,
    ch.nom_complet AS nom_chauffeur,
    ch.telephone AS telephone_chauffeur,
    v.immatriculation,
    v.type_vehicule,
    v.capacite_palettes
   FROM livraisons l
     JOIN commandes cmd ON cmd.id = l.commande_id
     JOIN clients cl ON cl.id = cmd.client_id
     LEFT JOIN chauffeurs ch ON ch.id = l.chauffeur_id
     LEFT JOIN vehicules v ON v.id = l.vehicule_id
  WHERE l.date_planifiee = CURRENT_DATE
  ORDER BY l.cree_le;

-- VIEW: v_mouvements_mp_chrono
CREATE OR REPLACE VIEW "v_mouvements_mp_chrono" AS
 SELECT m.id,
    m.date_mouvement,
    mp.designation,
    mp.unite,
    mp.conditionnement,
    m.quantite_entree,
    m.quantite_sortie,
    sum(m.quantite_entree - m.quantite_sortie) OVER (PARTITION BY m.matiere_id ORDER BY m.date_mouvement, m.cree_le ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS stock_cumule,
    m.note,
    mp.categorie
   FROM mouvements_matieres_premieres m
     JOIN matieres_premieres mp ON mp.id = m.matiere_id
  ORDER BY mp.categorie, m.date_mouvement, m.cree_le;

-- VIEW: v_solde_conges
CREATE OR REPLACE VIEW "v_solde_conges" AS
 SELECT e.id AS employe_id,
    (e.nom || ' '::text) || e.prenom AS nom_complet,
    e.poste,
    COALESCE(sum(c.nb_jours) FILTER (WHERE c.type_conge = 'Conge_paye'::text AND c.statut = 'Approuve'::text AND EXTRACT(year FROM c.date_debut) = EXTRACT(year FROM CURRENT_DATE)), 0::bigint) AS jours_pris_annee,
    18 - COALESCE(sum(c.nb_jours) FILTER (WHERE c.type_conge = 'Conge_paye'::text AND c.statut = 'Approuve'::text AND EXTRACT(year FROM c.date_debut) = EXTRACT(year FROM CURRENT_DATE)), 0::bigint) AS jours_restants
   FROM employes e
     LEFT JOIN conges c ON c.employe_id = e.id
  GROUP BY e.id, e.nom, e.prenom, e.poste;

-- VIEW: v_stock_disponible
CREATE OR REPLACE VIEW "v_stock_disponible" AS
 SELECT COALESCE(sum(
        CASE
            WHEN type_mouvement = ANY (ARRAY['Entree_production'::type_mouvement, 'Inventaire'::type_mouvement, 'Correction_admin'::type_mouvement]) THEN quantite_bouteilles
            WHEN type_mouvement = 'Sortie_livraison'::type_mouvement THEN - quantite_bouteilles
            ELSE NULL::integer
        END), 0::bigint) AS stock_bouteilles,
    COALESCE(sum(
        CASE
            WHEN type_mouvement = ANY (ARRAY['Entree_production'::type_mouvement, 'Inventaire'::type_mouvement, 'Correction_admin'::type_mouvement]) THEN quantite_bouteilles
            WHEN type_mouvement = 'Sortie_livraison'::type_mouvement THEN - quantite_bouteilles
            ELSE NULL::integer
        END), 0::bigint) / 24 AS stock_cartons,
    COALESCE(sum(
        CASE
            WHEN type_mouvement = ANY (ARRAY['Entree_production'::type_mouvement, 'Inventaire'::type_mouvement, 'Correction_admin'::type_mouvement]) THEN quantite_bouteilles
            WHEN type_mouvement = 'Sortie_livraison'::type_mouvement THEN - quantite_bouteilles
            ELSE NULL::integer
        END), 0::bigint) / 1080 AS stock_palettes
   FROM stocks
  WHERE statut = ANY (ARRAY['Validee'::statut_stock, 'Corrigee'::statut_stock]);

-- VIEW: v_stock_matieres_premieres
CREATE OR REPLACE VIEW "v_stock_matieres_premieres" AS
 SELECT mp.id,
    mp.designation,
    mp.categorie,
    mp.unite,
    mp.conditionnement,
    mp.seuil_alerte,
    COALESCE(sum(m.quantite_entree), 0::bigint) - COALESCE(sum(m.quantite_sortie), 0::bigint) AS stock_actuel,
    (COALESCE(sum(m.quantite_entree), 0::bigint) - COALESCE(sum(m.quantite_sortie), 0::bigint)) <= mp.seuil_alerte AS alerte_stock_faible
   FROM matieres_premieres mp
     LEFT JOIN mouvements_matieres_premieres m ON m.matiere_id = mp.id
  WHERE mp.actif = true
  GROUP BY mp.id, mp.designation, mp.categorie, mp.unite, mp.conditionnement, mp.seuil_alerte
  ORDER BY mp.categorie;

-- TABLE: bareme_its (bareme officiel ITS Djibouti, donnee reglementaire publique)
CREATE TABLE IF NOT EXISTS "bareme_its" (
  "id" integer NOT NULL,
  "tranche_basse" numeric NOT NULL,
  "tranche_haute" numeric NOT NULL,
  "montant_impot" numeric NOT NULL,
  PRIMARY KEY ("id")
);
ALTER TABLE "bareme_its" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bareme_its_authenticated_all" ON "bareme_its" FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (1, 0, 4999, 0);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (2, 5000, 9999, 100);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (3, 10000, 14999, 200);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (4, 15000, 19999, 300);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (5, 20000, 24999, 400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (6, 25000, 29999, 500);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (7, 30000, 34999, 1100);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (8, 35000, 39999, 1700);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (9, 40000, 44999, 2300);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (10, 45000, 49999, 2900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (11, 50000, 54999, 3650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (12, 55000, 59999, 4400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (13, 60000, 64999, 5150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (14, 65000, 69999, 5900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (15, 70000, 74999, 6650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (16, 75000, 79999, 7400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (17, 80000, 84999, 8150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (18, 85000, 89999, 8900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (19, 90000, 94999, 9650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (20, 95000, 99999, 10400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (21, 100000, 104999, 11150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (22, 105000, 109999, 11900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (23, 110000, 114999, 12650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (24, 115000, 119999, 13400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (25, 120000, 124999, 14150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (26, 125000, 129999, 14900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (27, 130000, 134999, 15650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (28, 135000, 139999, 16400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (29, 140000, 144999, 17150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (30, 145000, 149999, 17900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (31, 150000, 154999, 19000);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (32, 155000, 159999, 20100);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (33, 160000, 164999, 21200);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (34, 165000, 169999, 22300);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (35, 170000, 174999, 23400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (36, 175000, 179999, 24500);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (37, 180000, 184999, 25600);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (38, 185000, 189999, 26700);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (39, 190000, 194999, 27800);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (40, 195000, 199999, 28900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (41, 200000, 204999, 30000);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (42, 205000, 209999, 31100);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (43, 210000, 214999, 32200);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (44, 215000, 219999, 33300);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (45, 220000, 224999, 34400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (46, 225000, 229999, 35500);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (47, 230000, 234999, 36600);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (48, 235000, 239999, 37700);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (49, 240000, 244999, 38800);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (50, 245000, 249999, 39900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (51, 250000, 254999, 41000);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (52, 255000, 259999, 42100);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (53, 260000, 264999, 43200);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (54, 265000, 269999, 44300);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (55, 270000, 274999, 45400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (56, 275000, 279999, 46500);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (57, 280000, 284999, 47600);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (58, 285000, 289999, 48700);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (59, 290000, 294999, 49800);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (60, 295000, 299999, 50900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (61, 300000, 304999, 52150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (62, 305000, 309999, 53400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (63, 310000, 314999, 54650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (64, 315000, 319999, 55900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (65, 320000, 324999, 57150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (66, 325000, 329999, 58400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (67, 330000, 334999, 59650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (68, 335000, 339999, 60900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (69, 340000, 344999, 62150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (70, 345000, 349999, 63400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (71, 350000, 354999, 64650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (72, 355000, 359999, 65900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (73, 360000, 364999, 67150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (74, 365000, 369999, 68400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (75, 370000, 374999, 69650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (76, 375000, 379999, 70900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (77, 380000, 384999, 72150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (78, 385000, 389999, 73400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (79, 390000, 394999, 74650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (80, 395000, 399999, 75900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (81, 400000, 404999, 77150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (82, 405000, 409999, 78400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (83, 410000, 414999, 79650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (84, 415000, 419999, 80900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (85, 420000, 424999, 82150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (86, 425000, 429999, 83400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (87, 430000, 434999, 84650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (88, 435000, 439999, 85900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (89, 440000, 444999, 87150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (90, 445000, 449999, 88400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (91, 450000, 454999, 89650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (92, 455000, 459999, 90900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (93, 460000, 464999, 92150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (94, 465000, 469999, 93400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (95, 470000, 474999, 94650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (96, 475000, 479999, 95900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (97, 480000, 484999, 97150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (98, 485000, 489999, 98400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (99, 490000, 494999, 99650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (100, 495000, 499999, 100900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (101, 500000, 504999, 102150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (102, 505000, 509999, 103400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (103, 510000, 514999, 104650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (104, 515000, 519999, 105900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (105, 520000, 524999, 107150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (106, 525000, 529999, 108400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (107, 530000, 534999, 109650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (108, 535000, 539999, 110900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (109, 540000, 544999, 112150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (110, 545000, 549999, 113400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (111, 550000, 554999, 114650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (112, 555000, 559999, 115900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (113, 560000, 564999, 117150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (114, 565000, 569999, 118400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (115, 570000, 574999, 119650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (116, 575000, 579999, 120900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (117, 580000, 584999, 122150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (118, 585000, 589999, 123400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (119, 590000, 594999, 124650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (120, 595000, 599999, 125900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (121, 600000, 604999, 127400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (122, 605000, 609999, 128900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (123, 610000, 614999, 130400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (124, 615000, 619999, 131900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (125, 620000, 624999, 133400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (126, 625000, 629999, 134900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (127, 630000, 634999, 136400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (128, 635000, 639999, 137900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (129, 640000, 644999, 139400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (130, 645000, 649999, 140900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (131, 650000, 654999, 142400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (132, 655000, 659999, 143900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (133, 660000, 664999, 145400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (134, 665000, 669999, 146900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (135, 670000, 674999, 148400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (136, 675000, 679999, 149900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (137, 680000, 684999, 151400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (138, 685000, 689999, 152900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (139, 690000, 694999, 154400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (140, 695000, 699999, 155900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (141, 700000, 704999, 157400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (142, 705000, 709999, 158900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (143, 710000, 714999, 160400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (144, 715000, 719999, 161900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (145, 720000, 724999, 163400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (146, 725000, 729999, 164900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (147, 730000, 734999, 166400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (148, 735000, 739999, 167900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (149, 740000, 744999, 169400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (150, 745000, 749999, 170900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (151, 750000, 754999, 172400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (152, 755000, 759999, 173900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (153, 760000, 764999, 175400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (154, 765000, 769999, 176900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (155, 770000, 774999, 178400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (156, 775000, 779999, 179900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (157, 780000, 784999, 181400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (158, 785000, 789999, 182900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (159, 790000, 794999, 184400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (160, 795000, 799999, 185900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (161, 800000, 804999, 187400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (162, 805000, 809999, 188900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (163, 810000, 814999, 190400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (164, 815000, 819999, 191900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (165, 820000, 824999, 193400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (166, 825000, 829999, 194900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (167, 830000, 834999, 196400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (168, 835000, 839999, 197900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (169, 840000, 844999, 199400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (170, 845000, 849999, 200900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (171, 850000, 854999, 202400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (172, 855000, 859999, 203900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (173, 860000, 864999, 205400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (174, 865000, 869999, 206900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (175, 870000, 874999, 208400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (176, 875000, 879999, 209900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (177, 880000, 884999, 211400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (178, 885000, 889999, 212900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (179, 890000, 894999, 214400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (180, 895000, 899999, 215900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (181, 900000, 904999, 217400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (182, 905000, 909999, 218900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (183, 910000, 914999, 220400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (184, 915000, 919999, 221900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (185, 920000, 924999, 223400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (186, 925000, 929999, 224900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (187, 930000, 934999, 226400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (188, 935000, 939999, 227900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (189, 940000, 944999, 229400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (190, 945000, 949999, 230900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (191, 950000, 954999, 232400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (192, 955000, 959999, 233900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (193, 960000, 964999, 235400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (194, 965000, 969999, 236900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (195, 970000, 974999, 238400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (196, 975000, 979999, 239900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (197, 980000, 984999, 241400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (198, 985000, 989999, 242900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (199, 990000, 994999, 244400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (200, 995000, 999999, 245900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (201, 1000000, 1004999, 247650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (202, 1005000, 1009999, 249400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (203, 1010000, 1014999, 251150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (204, 1015000, 1019999, 252900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (205, 1020000, 1024999, 254650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (206, 1025000, 1029999, 256400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (207, 1030000, 1034999, 258150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (208, 1035000, 1039999, 259900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (209, 1040000, 1044999, 261650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (210, 1045000, 1049999, 263400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (211, 1050000, 1054999, 265150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (212, 1055000, 1059999, 266900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (213, 1060000, 1064999, 268650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (214, 1065000, 1069999, 270400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (215, 1070000, 1074999, 272150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (216, 1075000, 1079999, 273900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (217, 1080000, 1084999, 275650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (218, 1085000, 1089999, 277400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (219, 1090000, 1094999, 279150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (220, 1095000, 1099999, 280900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (221, 1100000, 1104999, 282650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (222, 1105000, 1109999, 284400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (223, 1110000, 1114999, 286150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (224, 1115000, 1119999, 287900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (225, 1120000, 1124999, 289650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (226, 1125000, 1129999, 291400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (227, 1130000, 1134999, 293150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (228, 1135000, 1139999, 294900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (229, 1140000, 1144999, 296650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (230, 1145000, 1149999, 298400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (231, 1150000, 1154999, 300150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (232, 1155000, 1159999, 301900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (233, 1160000, 1164999, 303650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (234, 1165000, 1169999, 305400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (235, 1170000, 1174999, 307150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (236, 1175000, 1179999, 308900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (237, 1180000, 1184999, 310650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (238, 1185000, 1189999, 312400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (239, 1190000, 1194999, 314150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (240, 1195000, 1199999, 315900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (241, 1200000, 1204999, 317650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (242, 1205000, 1209999, 319400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (243, 1210000, 1214999, 321150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (244, 1215000, 1219999, 322900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (245, 1220000, 1224999, 324650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (246, 1225000, 1229999, 326400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (247, 1230000, 1234999, 328150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (248, 1235000, 1239999, 329900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (249, 1240000, 1244999, 331650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (250, 1245000, 1249999, 333400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (251, 1250000, 1254999, 335150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (252, 1255000, 1259999, 336900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (253, 1260000, 1264999, 338650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (254, 1265000, 1269999, 340400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (255, 1270000, 1274999, 342150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (256, 1275000, 1279999, 343900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (257, 1280000, 1284999, 345650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (258, 1285000, 1289999, 347400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (259, 1290000, 1294999, 349150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (260, 1295000, 1299999, 350900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (261, 1300000, 1304999, 352650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (262, 1305000, 1309999, 354400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (263, 1310000, 1314999, 356150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (264, 1315000, 1319999, 357900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (265, 1320000, 1324999, 359650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (266, 1325000, 1329999, 361400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (267, 1330000, 1334999, 363150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (268, 1335000, 1339999, 364900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (269, 1340000, 1344999, 366650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (270, 1345000, 1349999, 368400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (271, 1350000, 1354999, 370150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (272, 1355000, 1359999, 371900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (273, 1360000, 1364999, 373650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (274, 1365000, 1369999, 375400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (275, 1370000, 1374999, 377150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (276, 1375000, 1379999, 378900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (277, 1380000, 1384999, 380650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (278, 1385000, 1389999, 382400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (279, 1390000, 1394999, 384150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (280, 1395000, 1399999, 385900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (281, 1400000, 1404999, 387650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (282, 1405000, 1409999, 389400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (283, 1410000, 1414999, 391150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (284, 1415000, 1419999, 392900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (285, 1420000, 1424999, 394650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (286, 1425000, 1429999, 396400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (287, 1430000, 1434999, 398150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (288, 1435000, 1439999, 399900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (289, 1440000, 1444999, 401650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (290, 1445000, 1449999, 403400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (291, 1450000, 1454999, 405150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (292, 1455000, 1459999, 406900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (293, 1460000, 1464999, 408650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (294, 1465000, 1469999, 410400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (295, 1470000, 1474999, 412150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (296, 1475000, 1479999, 413900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (297, 1480000, 1484999, 415650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (298, 1485000, 1489999, 417400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (299, 1490000, 1494999, 419150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (300, 1495000, 1499999, 420900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (301, 1500000, 1504999, 422650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (302, 1505000, 1509999, 424400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (303, 1510000, 1514999, 426150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (304, 1515000, 1519999, 427900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (305, 1520000, 1524999, 429650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (306, 1525000, 1529999, 431400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (307, 1530000, 1534999, 433150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (308, 1535000, 1539999, 434900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (309, 1540000, 1544999, 436650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (310, 1545000, 1549999, 438400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (311, 1550000, 1554999, 440150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (312, 1555000, 1559999, 441900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (313, 1560000, 1564999, 443650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (314, 1565000, 1569999, 445400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (315, 1570000, 1574999, 447150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (316, 1575000, 1579999, 448900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (317, 1580000, 1584999, 450650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (318, 1585000, 1589999, 452400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (319, 1590000, 1594999, 454150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (320, 1595000, 1599999, 455900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (321, 1600000, 1604999, 457650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (322, 1605000, 1609999, 459400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (323, 1610000, 1614999, 461150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (324, 1615000, 1619999, 462900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (325, 1620000, 1624999, 464650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (326, 1625000, 1629999, 466400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (327, 1630000, 1634999, 468150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (328, 1635000, 1639999, 469900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (329, 1640000, 1644999, 471650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (330, 1645000, 1649999, 473400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (331, 1650000, 1654999, 475150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (332, 1655000, 1659999, 476900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (333, 1660000, 1664999, 478650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (334, 1665000, 1669999, 480400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (335, 1670000, 1674999, 482150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (336, 1675000, 1679999, 483900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (337, 1680000, 1684999, 485650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (338, 1685000, 1689999, 487400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (339, 1690000, 1694999, 489150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (340, 1695000, 1699999, 490900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (341, 1700000, 1704999, 492650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (342, 1705000, 1709999, 494400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (343, 1710000, 1714999, 496150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (344, 1715000, 1719999, 497900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (345, 1720000, 1724999, 499650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (346, 1725000, 1729999, 501400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (347, 1730000, 1734999, 503150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (348, 1735000, 1739999, 504900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (349, 1740000, 1744999, 506650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (350, 1745000, 1749999, 508400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (351, 1750000, 1754999, 510150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (352, 1755000, 1759999, 511900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (353, 1760000, 1764999, 513650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (354, 1765000, 1769999, 515400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (355, 1770000, 1774999, 517150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (356, 1775000, 1779999, 518900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (357, 1780000, 1784999, 520650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (358, 1785000, 1789999, 522400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (359, 1790000, 1794999, 524150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (360, 1795000, 1799999, 525900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (361, 1800000, 1804999, 527650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (362, 1805000, 1809999, 529400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (363, 1810000, 1814999, 531150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (364, 1815000, 1819999, 532900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (365, 1820000, 1824999, 534650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (366, 1825000, 1829999, 536400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (367, 1830000, 1834999, 538150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (368, 1835000, 1839999, 539900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (369, 1840000, 1844999, 541650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (370, 1845000, 1849999, 543400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (371, 1850000, 1854999, 545150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (372, 1855000, 1859999, 546900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (373, 1860000, 1864999, 548650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (374, 1865000, 1869999, 550400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (375, 1870000, 1874999, 552150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (376, 1875000, 1879999, 553900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (377, 1880000, 1884999, 555650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (378, 1885000, 1889999, 557400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (379, 1890000, 1894999, 559150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (380, 1895000, 1899999, 560900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (381, 1900000, 1904999, 562650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (382, 1905000, 1909999, 564400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (383, 1910000, 1914999, 566150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (384, 1915000, 1919999, 567900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (385, 1920000, 1924999, 569650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (386, 1925000, 1929999, 571400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (387, 1930000, 1934999, 573150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (388, 1935000, 1939999, 574900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (389, 1940000, 1944999, 576650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (390, 1945000, 1949999, 578400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (391, 1950000, 1954999, 580150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (392, 1955000, 1959999, 581900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (393, 1960000, 1964999, 583650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (394, 1965000, 1969999, 585400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (395, 1970000, 1974999, 587150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (396, 1975000, 1979999, 588900);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (397, 1980000, 1984999, 590650);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (398, 1985000, 1989999, 592400);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (399, 1990000, 1994999, 594150);
INSERT INTO "bareme_its" ("id", "tranche_basse", "tranche_haute", "montant_impot") VALUES (400, 1995000, 1999999, 595900);
