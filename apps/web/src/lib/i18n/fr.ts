// ═══════════════════════════════════════════════════════════════════════════
// INTERNATIONALISATION — Chaînes françaises centralisées
// ═══════════════════════════════════════════════════════════════════════════
// Usage: import { t } from '@/lib/i18n/fr';
// Remplacer progressivement les strings hardcodées par t.xxx
// ═══════════════════════════════════════════════════════════════════════════

export const t = {
  // ── Actions communes ─────────────────────────────────────────────────
  actions: {
    add: 'Ajouter',
    edit: 'Modifier',
    delete: 'Supprimer',
    cancel: 'Annuler',
    save: 'Enregistrer',
    saving: 'Enregistrement...',
    create: 'Créer',
    creating: 'Création...',
    confirm: 'Confirmer',
    validate: 'Valider',
    view: 'Voir',
    close: 'Fermer',
    refresh: 'Actualiser',
    reset: 'Réinitialiser',
    resetting: 'Réinitialisation...',
    search: 'Rechercher',
    export: 'Exporter',
    history: 'Historique',
    back: 'Retour',
    next: 'Suivant',
    previous: 'Précédent',
    send: 'Envoyer',
    download: 'Télécharger',
  },

  // ── États & Statuts ──────────────────────────────────────────────────
  status: {
    draft: 'Brouillon',
    submitted: 'Soumise',
    validated: 'Validée',
    rejected: 'Rejetée',
    cancelled: 'Annulée',
    inProgress: 'En cours',
    completed: 'Terminée',
    active: 'Actif',
    inactive: 'Inactif',
    paid: 'Payée',
    pending: 'En attente',
    sent: 'Envoyé',
    confirmed: 'Confirmé',
    received: 'Réceptionnée',
    partial: 'Partielle',
    ordered: 'Commandée',
    bcGenerated: 'BC généré',
  },

  // ── Chargement & Messages vides ──────────────────────────────────────
  loading: {
    default: 'Chargement...',
    alerts: 'Chargement des alertes...',
    purchaseOrders: 'Chargement des bons de commande...',
    suppliers: 'Chargement des fournisseurs...',
    clients: 'Chargement des clients...',
    invoices: 'Chargement des factures...',
    stock: 'Chargement du stock...',
  },

  empty: {
    clients: 'Aucun client trouvé',
    suppliers: 'Aucun fournisseur',
    invoices: 'Aucune facture trouvée',
    alerts: 'Aucune alerte active',
    alertsResolved: 'Toutes les alertes ont été traitées',
    movements: 'Aucun mouvement trouvé',
    receptions: 'Aucune réception trouvée pour cette période',
    purchaseOrders: 'Aucun bon de commande trouvé',
    products: 'Aucun produit trouvé',
  },

  // ── Erreurs ──────────────────────────────────────────────────────────
  errors: {
    generic: 'Une erreur est survenue',
    unknown: 'Erreur inconnue',
    save: 'Erreur lors de la sauvegarde',
    delete: 'Erreur lors de la suppression',
    create: 'Erreur lors de la création',
    update: 'Erreur lors de la mise à jour',
    load: 'Erreur lors du chargement',
    send: "Erreur lors de l'envoi",
    network: 'Erreur réseau',
    session: 'Session expirée',
    fixErrors: 'Veuillez corriger les erreurs ci-dessus',
  },

  // ── Succès ───────────────────────────────────────────────────────────
  success: {
    save: 'Enregistré avec succès',
    create: 'Créé avec succès',
    delete: 'Supprimé avec succès',
    update: 'Mis à jour avec succès',
    send: 'Envoyé avec succès',
    bcSent: 'BC envoyé avec succès',
    bcGenerated: 'Bon de commande généré avec succès',
    passwordReset: 'Mot de passe réinitialisé avec succès',
  },

  // ── Validation (formulaires) ─────────────────────────────────────────
  validation: {
    required: 'Ce champ est obligatoire',
    clientCodeRequired: 'Le code client est obligatoire',
    clientNameRequired: 'Le nom du client est obligatoire',
    nifRequired: 'Le NIF est obligatoire',
    nifInvalid: 'NIF invalide – 15 chiffres requis',
    rcInvalid: 'RC invalide – doit contenir au moins une lettre et des chiffres',
    aiInvalid: 'AI invalide – alphanumérique 3-20 caractères',
    nisInvalid: 'NIS invalide – 15 chiffres requis',
    phoneInvalid: 'Téléphone invalide – format: 05/06/07XXXXXXXX',
    emailInvalid: 'Email invalide',
    passwordMin: 'Le mot de passe doit contenir au moins 8 caractères',
    quantityPositive: 'La quantité doit être positive',
    justificationRequired: 'La justification est obligatoire',
  },

  // ── Entités & Labels ─────────────────────────────────────────────────
  entities: {
    client: 'Client',
    clients: 'Clients',
    supplier: 'Fournisseur',
    suppliers: 'Fournisseurs',
    invoice: 'Facture',
    invoices: 'Factures',
    product: 'Produit',
    products: 'Produits',
    rawMaterial: 'Matière première',
    finishedProduct: 'Produit fini',
    purchaseOrder: 'Bon de commande',
    purchaseOrders: 'Bons de commande',
    demand: 'Demande',
    demands: 'Demandes',
    delivery: 'Livraison',
    deliveries: 'Livraisons',
    recipe: 'Recette',
    recipes: 'Recettes',
    production: 'Production',
    stock: 'Stock',
    inventory: 'Inventaire',
    user: 'Utilisateur',
    users: 'Utilisateurs',
    device: 'Appareil',
    devices: 'Appareils',
    alert: 'Alerte',
    alerts: 'Alertes',
  },

  // ── Colonnes de tableaux ─────────────────────────────────────────────
  columns: {
    code: 'Code',
    name: 'Nom',
    type: 'Type',
    address: 'Adresse',
    phone: 'Téléphone',
    contact: 'Contact',
    actions: 'Actions',
    quantity: 'Quantité',
    amount: 'Montant',
    totalHt: 'Total HT',
    totalTtc: 'Total TTC',
    netToPay: 'Net à payer',
    unitPriceHt: 'Prix unit. HT',
    date: 'Date',
    reference: 'Référence',
    status: 'Statut',
    receptions: 'Réceptions',
  },

  // ── Types client ─────────────────────────────────────────────────────
  clientTypes: {
    DISTRIBUTEUR: 'Distributeur',
    GROSSISTE: 'Grossiste',
    SUPERETTE: 'Superette',
    FAST_FOOD: 'Fast Food',
    AUTRE: 'Autre',
  } as Record<string, string>,

  // ── Types alerte ─────────────────────────────────────────────────────
  alertTypes: {
    MP_CRITIQUE: 'MP Critique',
    RUPTURE: 'Rupture Stock',
    FOURNISSEUR_RETARD: 'Fournisseur Retard',
    PRODUCTION_BLOQUEE: 'Production Bloquée',
  } as Record<string, string>,

  // ── Mois ─────────────────────────────────────────────────────────────
  months: [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ],

  // ── Filtres ──────────────────────────────────────────────────────────
  filters: {
    all: 'Tous',
    allFeminine: 'Toutes',
    year: 'Année',
    month: 'Mois',
    from: 'Du',
    to: 'Au',
    period: 'Période',
  },

  // ── Titres modals ────────────────────────────────────────────────────
  modals: {
    newClient: 'Nouveau client',
    editClient: 'Modifier le client',
    salesHistory: 'Historique Ventes',
    receptionHistory: 'Historique Réceptions',
    movementHistory: 'Historique Mouvements',
    newReception: 'Nouvelle Réception MP',
    inventoryStock: 'Inventaire Stock',
    newProduction: 'Nouvelle production',
    alertCenter: "Centre d'Alertes",
    generateBc: 'Générer un bon de commande fournisseur',
  },

  // ── Fiscal (DGI) ────────────────────────────────────────────────────
  fiscal: {
    dgiCompliance: 'Informations fiscales (conformité DGI)',
    nif: 'NIF',
    rc: 'RC',
    ai: 'AI',
    nis: 'NIS',
    tva: 'TVA',
    timbreFiscal: 'Timbre fiscal',
  },

  // ── Pagination ───────────────────────────────────────────────────────
  pagination: {
    page: 'Page',
    of: 'sur',
    previousPage: 'Page précédente',
    nextPage: 'Page suivante',
  },
} as const;
