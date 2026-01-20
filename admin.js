// =====================================================
// 🔐 AUTHENTIFICATION
// =====================================================

const ADMIN_PASSWORD = '1234';
let isAuthenticated = false;

// ============================================
// INITIALIZATION & GLOBAL STATE
// ============================================

// Global variables - initialized on page load
let CHAPITRES = [];
let NIVEAUX = { N1: [], N2: [], N3: [], N4: [] };
let selectedNiveau = null;
let selectedChapitreId = null;
let selectedEtapeIndex = null;
let currentChapitreIndex = null;
let currentChapitreId = null; // ✅ ID du chapitre au lieu de l'index
let currentEtapeIndex = null;

/**
 * Initialize admin panel - load chapters data from chapitres.json
 * Called once on page load via DOMContentLoaded
 */
async function initializeAdminPanel() {
  try {
    console.log('[ADMIN-INIT] Starting initialization...');
    
    // STEP 1: Load chapters data from JSON file
    const response = await fetch('./data/chapitres.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch chapitres.json: HTTP ${response.status}`);
    }
    const data = await response.json();
    
    // STEP 1b: Extract chapters array from object
    // chapitres.json structure: { "chapitres": [...] }
    CHAPITRES = data.chapitres || data || [];
    
    if (!Array.isArray(CHAPITRES)) {
      throw new Error('CHAPITRES is not an array. Check chapitres.json structure.');
    }
    
    console.log('[ADMIN-INIT] ✅ Loaded', CHAPITRES.length, 'chapters');
    
    // STEP 2: Group chapters by niveau
    // ✅ RESET NIVEAUX pour éviter les doublons
    NIVEAUX = { N1: [], N2: [], N3: [], N4: [] };
    
    // Extract niveau from chapter ID:
    // - ch1, ch2, ch3, ch4, ch5 → N1
    // - 101BT and others starting with 10 → N2
    // - 20xxx → N3
    // - 30xxx → N4
    
    CHAPITRES.forEach(chapitre => {
      const id = chapitre.id;
      let niveau = 'N1'; // default for ch1-ch5
      
      if (id.startsWith('10')) {
        niveau = 'N2';
      } else if (id.startsWith('20')) {
        niveau = 'N3';
      } else if (id.startsWith('30')) {
        niveau = 'N4';
      }
      
      if (!NIVEAUX[niveau]) {
        NIVEAUX[niveau] = [];
      }
      NIVEAUX[niveau].push(chapitre);
    });
    
    console.log('[ADMIN-INIT] ✅ Grouped chapters by niveau');
    console.log('[ADMIN-INIT] NIVEAUX:', NIVEAUX);
    
    // STEP 3: Populate UI selectors
    populateNiveauSelector();
    console.log('[ADMIN-INIT] ✅ UI initialized');
    
    console.log('[ADMIN-INIT] ✅✅✅ ADMIN PANEL READY');
    
  } catch (error) {
    console.error('[ADMIN-INIT] ❌ INITIALIZATION FAILED:', error);
    console.error('[ADMIN-INIT] Error details:', error.message);
    alert('❌ Erreur lors du chargement des données : ' + error.message);
  }
}

/**
 * Populate niveau dropdown with N1, N2, N3, N4 options
 */
function populateNiveauSelector() {
  const selectNiveau = document.getElementById('selectNiveau');
  if (!selectNiveau) {
    console.warn('[ADMIN-INIT] selectNiveau element not found');
    return;
  }
  
  selectNiveau.innerHTML = '<option value="">-- Choisir un niveau --</option>';
  
  // ✅ Afficher TOUS les niveaux, même vides (pour permettre la création)
  ['N1', 'N2', 'N3', 'N4'].forEach(niveau => {
    const count = NIVEAUX[niveau]?.length || 0;
    const option = document.createElement('option');
    option.value = niveau;
    option.textContent = count > 0 
      ? `${niveau} (${count} chapitre${count !== 1 ? 's' : ''})` 
      : `${niveau} (vide)`;
    selectNiveau.appendChild(option);
  });
  
  console.log('[ADMIN-INIT] ✅ Niveau selector populated');
}

/**
 * CRITICAL: Trigger initialization when page loads
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('[ADMIN] Page loaded, starting initialization...');
  initializeAdminPanel();
});

// =====================================================
// END INITIALIZATION
// =====================================================

// =====================================================
// 🎯 CONTEXTE HIÉRARCHIQUE - Sélection Niveau/Chapitre/Étape
// =====================================================

function onNiveauChange(niveau) {
    console.log('[ADMIN] onNiveauChange:', niveau);
    
    const selectChapitre = document.getElementById('selectChapitre');
    const selectEtape = document.getElementById('selectEtape');
    const btnCreer = document.getElementById('createExerciceBtn');
    
    if (!selectChapitre || !selectEtape || !btnCreer) {
        console.error('[ADMIN] Missing select elements');
        return;
    }
    
    // Reset dependent selectors
    selectChapitre.innerHTML = '<option value="">-- Choisir un chapitre --</option>';
    selectEtape.innerHTML = '<option value="">-- Choisir une étape --</option>';
    btnCreer.disabled = true;
    selectedNiveau = niveau;  // ✅ SAVE THE NIVEAU
    selectedChapitreId = null;
    selectedEtapeIndex = null;
    
    if (!niveau) {
        selectChapitre.disabled = true;
        console.log('[ADMIN] No niveau selected');
        return;
    }
    
    // Get chapters for this niveau from NIVEAUX global
    const chapitres = NIVEAUX[niveau] || [];
    console.log('[ADMIN] Found', chapitres.length, 'chapters for', niveau);
    
    // Load into dropdown
    loadChapitresForNiveauNew(chapitres, selectChapitre);
    selectChapitre.disabled = false;
}

/**
 * Helper: Load chapters into select dropdown
 */
function loadChapitresForNiveauNew(chapitres, selectElement) {
    if (!selectElement) {
        console.error('[ADMIN] selectElement is null/undefined');
        return;
    }
    
    selectElement.innerHTML = '<option value="">-- Choisir un chapitre --</option>';
    
    chapitres.forEach(chapitre => {
        const option = document.createElement('option');
        option.value = chapitre.id;
        option.textContent = `${chapitre.id} - ${chapitre.titre || 'Sans titre'}`;
        selectElement.appendChild(option);
    });
    
    console.log('[ADMIN] Loaded', chapitres.length, 'chapters into selector');
}

function onChapitreChange(chapitreId) {
    console.log('[ADMIN] onChapitreChange:', chapitreId);
    
    const selectEtape = document.getElementById('selectEtape');
    const btnCreer = document.getElementById('createExerciceBtn');
    
    if (!selectEtape || !btnCreer) {
        console.error('[ADMIN] Missing select elements');
        return;
    }
    
    selectedChapitreId = chapitreId;
    currentChapitreId = chapitreId; // ✅ Mettre à jour aussi currentChapitreId
    selectEtape.innerHTML = '<option value="">-- Choisir une étape --</option>';
    btnCreer.disabled = true;
    selectedEtapeIndex = null;
    
    if (!chapitreId) {
        selectEtape.disabled = true;
        console.log('[ADMIN] No chapitre selected');
        return;
    }
    
    // Find chapter in CHAPITRES array (loaded during initialization)
    const chapitre = CHAPITRES.find(c => c.id === chapitreId);
    if (!chapitre) {
        console.error('[ADMIN] Chapter not found in CHAPITRES:', chapitreId);
        return;
    }
    
    console.log('[ADMIN] Found chapter:', chapitre.titre);
    
    // ✅ Mettre à jour currentChapitreIndex aussi
    currentChapitreIndex = CHAPITRES.findIndex(c => c.id === chapitreId);
    
    // Load etapes for this chapter
    const etapes = chapitre.etapes || [];
    loadEtapesForChapitreNew(etapes, selectEtape);
    selectEtape.disabled = false;
}

/**
 * Helper: Load steps into select dropdown
 */
function loadEtapesForChapitreNew(etapes, selectElement) {
    if (!selectElement) {
        console.error('[ADMIN] selectElement is null/undefined');
        return;
    }
    
    selectElement.innerHTML = '<option value="">-- Choisir une étape --</option>';
    
    etapes.forEach((etape, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `Étape ${index + 1} - ${etape.titre || 'Sans titre'}`;
        selectElement.appendChild(option);
    });
    
    console.log('[ADMIN] Loaded', etapes.length, 'steps into selector');
}

function onEtapeChange(etapeIndex) {
    console.log('[ADMIN] onEtapeChange:', etapeIndex);
    
    const btnCreer = document.getElementById('createExerciceBtn');
    if (!btnCreer) {
        console.error('[ADMIN] btnCreerExercice not found');
        return;
    }
    
    selectedEtapeIndex = etapeIndex;
    
    // Enable button only if all three selections are made
    const canCreate = selectedChapitreId && selectedEtapeIndex !== null && selectedEtapeIndex !== '';
    btnCreer.disabled = !canCreate;
    
    console.log('[ADMIN] Create button is now', canCreate ? 'ENABLED' : 'DISABLED');
    
    if (canCreate) {
        const chapitre = CHAPITRES.find(c => c.id === selectedChapitreId);
        const etape = chapitre?.etapes?.[selectedEtapeIndex];
        console.log('[ADMIN] Ready to create exercise for:', {
            chapitreId: selectedChapitreId,
            etapeIndex: selectedEtapeIndex,
            chapitreTitre: chapitre?.titre,
            etapeTitre: etape?.titre
        });
    }
}

function showCreateExerciceFromHierarchy() {
    if (!selectedNiveau || !selectedChapitreId || selectedEtapeIndex === null) {
        alert('⚠️ Veuillez sélectionner un niveau, chapitre et étape');
        return;
    }
    
    // Définir le contexte global
    const chapitre = CHAPITRES.find(ch => ch.id === selectedChapitreId);
    if (!chapitre) {
        alert('❌ Chapitre non trouvé');
        return;
    }
    
    // Ouvrir le modal de création d'exercice avec le contexte pré-rempli
    currentChapitreIndex = CHAPITRES.findIndex(ch => ch.id === selectedChapitreId);
    currentEtapeIndex = selectedEtapeIndex;
    
    showCreateExerciceModal();
}

// =====================================================
// �️ UTILITAIRES
// =====================================================

function generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// =====================================================
// �📋 TEMPLATES D'EXERCICES
// =====================================================

const EXERCISE_TEMPLATES = [
    {
        name: "QCM Simple 4 Options",
        type: "qcm_unique",
        description: "Un QCM classique avec 4 options et une seule bonne réponse",
        template: {
            question: "Votre question ici?",
            reponses: ["Option A", "Option B", "Option C", "Option D"],
            bonneReponse: 0,
            explication: "Explication de la réponse correcte",
            difficulte: "moyen"
        }
    },
    {
        name: "QCM Vrai/Faux",
        type: "qcm_unique",
        description: "Un QCM simple avec deux options: Vrai ou Faux",
        template: {
            question: "Votre affirmation ici?",
            reponses: ["Vrai", "Faux"],
            bonneReponse: 0,
            explication: "",
            difficulte: "facile"
        }
    },
    {
        name: "QCM Réponses Multiples",
        type: "qcm_multiple",
        description: "Un QCM où plusieurs réponses peuvent être correctes",
        template: {
            question: "Quelles affirmations sont correctes?",
            reponses: [
                { texte: "Réponse 1", correct: true },
                { texte: "Réponse 2", correct: false },
                { texte: "Réponse 3", correct: true },
                { texte: "Réponse 4", correct: false }
            ],
            explication: "Explication des bonnes réponses",
            difficulte: "moyen"
        }
    },
    {
        name: "Réponse Courte",
        type: "texte",
        description: "Un exercice où l'étudiant doit écrire une réponse",
        template: {
            question: "Votre question?",
            reponseAttendus: ["Réponse attendue"],
            tolerance: "partiel",
            difficulte: "moyen"
        }
    },
    {
        name: "Vocabulaire Anglais-Français",
        type: "flashcard",
        description: "Cartes mémoire pour apprendre du vocabulaire",
        template: {
            titre: "Vocabulaire Anglais-Français",
            langueRecto: "English",
            langueVerso: "Français",
            cartes: [
                { recto: "Apple", verso: "Pomme" },
                { recto: "Water", verso: "Eau" },
                { recto: "House", verso: "Maison" }
            ],
            difficulte: "facile"
        }
    },
    {
        name: "Formules Mathématiques",
        type: "flashcard",
        description: "Cartes mémoire pour les formules de maths",
        template: {
            titre: "Formules Mathématiques",
            langueRecto: "Concept",
            langueVerso: "Formule",
            cartes: [
                { recto: "Aire d'un carré", verso: "a²" },
                { recto: "Aire d'un rectangle", verso: "a × b" },
                { recto: "Périmètre d'un carré", verso: "4 × a" }
            ],
            difficulte: "moyen"
        }
    },
    {
        name: "Capitales et Pays",
        type: "dragdrop_matching",
        description: "Associer des éléments de deux colonnes",
        template: {
            titre: "Associer les capitales",
            colonneGauche: [
                { id: "item-1", texte: "France" },
                { id: "item-2", texte: "Espagne" },
                { id: "item-3", texte: "Allemagne" }
            ],
            colonneDroite: [
                { id: "ans-1", texte: "Paris" },
                { id: "ans-2", texte: "Madrid" },
                { id: "ans-3", texte: "Berlin" }
            ],
            associations: [
                { gauche: "item-1", droite: "ans-1" },
                { gauche: "item-2", droite: "ans-2" },
                { gauche: "item-3", droite: "ans-3" }
            ],
            difficulte: "facile"
        }
    },
    {
        name: "Ordre Chronologique",
        type: "classement",
        description: "Classer des éléments dans le bon ordre",
        template: {
            titre: "Classer par ordre chronologique",
            instruction: "Classez les événements du plus ancien au plus récent",
            items: [
                { id: "item-1", texte: "Événement 1", ordre: 1 },
                { id: "item-2", texte: "Événement 2", ordre: 2 },
                { id: "item-3", texte: "Événement 3", ordre: 3 }
            ],
            difficulte: "moyen"
        }
    },
    {
        name: "Tableau Simple",
        type: "tableau",
        description: "Remplir un tableau avec des informations",
        template: {
            titre: "Remplir le tableau",
            instruction: "Complétez le tableau avec les informations",
            colonnes: ["Pays", "Capitale", "Population"],
            lignes: [
                {
                    id: "row-1",
                    cellules: [
                        { contenu: "France", editable: false, reponse: "France" },
                        { contenu: "", editable: true, reponse: "Paris" },
                        { contenu: "", editable: true, reponse: "67 millions" }
                    ]
                }
            ],
            difficulte: "moyen"
        }
    }
];

// =====================================================
// 🎨 THÈMES DE CHAPITRES
// =====================================================

const CHAPTER_THEMES = [
    {
        name: "Formation Douane Basique",
        description: "3 étapes + 8 exercices",
        chapitres: [{
            titre: "Fondamentaux de la Douane",
            description: "Formation de base sur les processus douaniers",
            etapes: [
                {
                    id: generateId(),
                    titre: "Diagnostic - Connaissances Initiales",
                    type: "diagnostic",
                    duree: 15,
                    exercices: [
                        { id: generateId(), type: "qcm_unique", question: "Qu'est-ce que la douane?", reponses: ["Un service public", "Une entreprise privée", "Un ministère"], bonneReponse: 0, difficulte: "facile" },
                        { id: generateId(), type: "qcm_unique", question: "Quel est le rôle principal de la douane?", reponses: ["Contrôler les frontières", "Vendre des produits", "Fabriquer des biens"], bonneReponse: 0, difficulte: "facile" }
                    ]
                },
                {
                    id: generateId(),
                    titre: "Apprentissage - Concepts Clés",
                    type: "apprentissage",
                    duree: 30,
                    exercices: [
                        { id: generateId(), type: "qcm_multiple", question: "Parmi ces éléments, lesquels sont contrôlés par la douane?", reponses: [{ texte: "Les marchandises importées", correct: true }, { texte: "Les personnes", correct: true }, { texte: "Les bâtiments publics", correct: false }], difficulte: "moyen" },
                        { id: generateId(), type: "texte", question: "Expliquez en une phrase le rôle de la douane.", difficulte: "moyen" },
                        { id: generateId(), type: "flashcard", titre: "Terminologie Douanière", langueRecto: "Français", langueVerso: "Définition", cartes: [{ recto: "Tarif douanier", verso: "Droit appliqué aux marchandises" }], difficulte: "moyen" }
                    ]
                },
                {
                    id: generateId(),
                    titre: "Évaluation - Validation des Savoirs",
                    type: "evaluation",
                    duree: 20,
                    exercices: [
                        { id: generateId(), type: "qcm_unique", question: "Quel est l'objectif principal du contrôle douanier?", reponses: ["Taxer les biens", "Assurer la sécurité des frontières", "Augmenter les prix"], bonneReponse: 1, difficulte: "moyen" },
                        { id: generateId(), type: "qcm_unique", question: "La douane opère-t-elle uniquement aux frontières?", reponses: ["Oui", "Non"], bonneReponse: 1, difficulte: "facile" },
                        { id: generateId(), type: "matching", titre: "Associer les termes aux définitions", colonneGauche: [{ id: "t1", texte: "Tarif" }], colonneDroite: [{ id: "d1", texte: "Droit douanier" }], associations: [{ gauche: "t1", droite: "d1" }], difficulte: "moyen" }
                    ]
                }
            ]
        }]
    },
    {
        name: "Cours Intensif",
        description: "5 étapes + 15 exercices + vidéos",
        chapitres: [{
            titre: "Cours Intensif Douane",
            description: "Formation approfondie avec contenus variés",
            etapes: [
                {
                    id: generateId(),
                    titre: "Module 1 - Fondamentaux",
                    type: "apprentissage",
                    duree: 45,
                    exercices: [
                        { id: generateId(), type: "qcm_unique", question: "Q1", reponses: ["A", "B", "C"], bonneReponse: 0, difficulte: "facile" },
                        { id: generateId(), type: "qcm_unique", question: "Q2", reponses: ["X", "Y", "Z"], bonneReponse: 1, difficulte: "facile" }
                    ]
                },
                {
                    id: generateId(),
                    titre: "Module 2 - Procédures",
                    type: "apprentissage",
                    duree: 45,
                    exercices: [
                        { id: generateId(), type: "qcm_multiple", question: "Sélectionner les bonnes réponses", reponses: [{ texte: "Réponse A", correct: true }, { texte: "Réponse B", correct: false }], difficulte: "moyen" },
                        { id: generateId(), type: "texte", question: "Décrire la procédure", difficulte: "moyen" }
                    ]
                },
                {
                    id: generateId(),
                    titre: "Module 3 - Cas Pratiques",
                    type: "entrainement",
                    duree: 40,
                    exercices: [
                        { id: generateId(), type: "flashcard", titre: "Cas pratiques", langueRecto: "Scénario", langueVerso: "Solution", cartes: [{ recto: "Cas 1", verso: "Réponse 1" }], difficulte: "moyen" },
                        { id: generateId(), type: "classement", titre: "Ordonner les étapes", instruction: "Classez les étapes dans le bon ordre", items: [{ id: "i1", texte: "Étape 1", ordre: 1 }, { id: "i2", texte: "Étape 2", ordre: 2 }], difficulte: "moyen" }
                    ]
                },
                {
                    id: generateId(),
                    titre: "Module 4 - Spécialisation",
                    type: "apprentissage",
                    duree: 35,
                    exercices: [
                        { id: generateId(), type: "qcm_unique", question: "Q spécialisation", reponses: ["S1", "S2", "S3"], bonneReponse: 0, difficulte: "difficile" },
                        { id: generateId(), type: "matching", titre: "Appariement domaines", colonneGauche: [{ id: "d1", texte: "Domaine 1" }], colonneDroite: [{ id: "c1", texte: "Catégorie 1" }], associations: [{ gauche: "d1", droite: "c1" }], difficulte: "difficile" }
                    ]
                },
                {
                    id: generateId(),
                    titre: "Évaluation Finale",
                    type: "evaluation",
                    duree: 60,
                    exercices: [
                        { id: generateId(), type: "qcm_unique", question: "Question finale 1", reponses: ["F1", "F2", "F3"], bonneReponse: 0, difficulte: "difficile" },
                        { id: generateId(), type: "tableau", titre: "Tableau synthèse", instruction: "Remplissez le tableau", colonnes: ["Colonne 1", "Colonne 2"], lignes: [{ id: "r1", cellules: [{ contenu: "", editable: true }, { contenu: "", editable: true }] }], difficulte: "difficile" }
                    ]
                }
            ]
        }]
    },
    {
        name: "Module de Certification",
        description: "7 étapes + 20 exercices",
        chapitres: [{
            titre: "Module de Certification",
            description: "Préparation à la certification douanière",
            etapes: [
                { id: generateId(), titre: "Préparation 1", type: "apprentissage", duree: 40, exercices: [{ id: generateId(), type: "qcm_unique", question: "Cert Q1", reponses: ["A", "B"], bonneReponse: 0, difficulte: "moyen" }] },
                { id: generateId(), titre: "Préparation 2", type: "apprentissage", duree: 40, exercices: [{ id: generateId(), type: "qcm_unique", question: "Cert Q2", reponses: ["X", "Y"], bonneReponse: 0, difficulte: "moyen" }] },
                { id: generateId(), titre: "Préparation 3", type: "apprentissage", duree: 40, exercices: [{ id: generateId(), type: "qcm_multiple", question: "Cert Q3", reponses: [{ texte: "A", correct: true }], difficulte: "difficile" }] },
                { id: generateId(), titre: "Test pratique 1", type: "entrainement", duree: 50, exercices: [{ id: generateId(), type: "tableau", titre: "Tableau test", instruction: "Test", colonnes: ["Col"], lignes: [{ id: "r1", cellules: [{ contenu: "", editable: true }] }], difficulte: "difficile" }] },
                { id: generateId(), titre: "Révision", type: "entrainement", duree: 45, exercices: [{ id: generateId(), type: "flashcard", titre: "Révision", langueRecto: "Terme", langueVerso: "Définition", cartes: [{ recto: "T", verso: "D" }], difficulte: "difficile" }] },
                { id: generateId(), titre: "Examen blanc 1", type: "evaluation", duree: 90, exercices: [{ id: generateId(), type: "qcm_unique", question: "Exam Q1", reponses: ["E1", "E2"], bonneReponse: 0, difficulte: "difficile" }] },
                { id: generateId(), titre: "Examen blanc 2", type: "evaluation", duree: 90, exercices: [{ id: generateId(), type: "qcm_multiple", question: "Exam Q2", reponses: [{ texte: "E3", correct: true }], difficulte: "difficile" }] }
            ]
        }]
    },
    {
        name: "Atelier Interactif",
        description: "4 étapes + 12 exercices (matching, tableau)",
        chapitres: [{
            titre: "Atelier Interactif",
            description: "Apprentissage par la pratique et l'interaction",
            etapes: [
                {
                    id: generateId(),
                    titre: "Atelier 1 - Appariement",
                    type: "entrainement",
                    duree: 30,
                    exercices: [
                        { id: generateId(), type: "matching", titre: "Appariement 1", colonneGauche: [{ id: "g1", texte: "Terme 1" }], colonneDroite: [{ id: "d1", texte: "Définition 1" }], associations: [{ gauche: "g1", droite: "d1" }], difficulte: "facile" },
                        { id: generateId(), type: "matching", titre: "Appariement 2", colonneGauche: [{ id: "g2", texte: "Concept 1" }], colonneDroite: [{ id: "d2", texte: "Explication 1" }], associations: [{ gauche: "g2", droite: "d2" }], difficulte: "moyen" }
                    ]
                },
                {
                    id: generateId(),
                    titre: "Atelier 2 - Tableaux",
                    type: "entrainement",
                    duree: 35,
                    exercices: [
                        { id: generateId(), type: "tableau", titre: "Tableau 1", instruction: "Complétez", colonnes: ["Colonne 1", "Colonne 2", "Colonne 3"], lignes: [{ id: "t1", cellules: [{ contenu: "", editable: true }, { contenu: "", editable: true }, { contenu: "", editable: true }] }], difficulte: "moyen" },
                        { id: generateId(), type: "tableau", titre: "Tableau 2", instruction: "Compléter le tableau comparatif", colonnes: ["Aspect", "Élément A", "Élément B"], lignes: [{ id: "t2", cellules: [{ contenu: "Aspect 1", editable: false }, { contenu: "", editable: true }, { contenu: "", editable: true }] }], difficulte: "moyen" }
                    ]
                },
                {
                    id: generateId(),
                    titre: "Atelier 3 - Cas Mixtes",
                    type: "entrainement",
                    duree: 40,
                    exercices: [
                        { id: generateId(), type: "classement", titre: "Classement 1", instruction: "Ordonnez les éléments", items: [{ id: "c1", texte: "Élément 1", ordre: 1 }, { id: "c2", texte: "Élément 2", ordre: 2 }, { id: "c3", texte: "Élément 3", ordre: 3 }], difficulte: "moyen" },
                        { id: generateId(), type: "flashcard", titre: "Révision interactive", langueRecto: "Question", langueVerso: "Réponse", cartes: [{ recto: "Q1", verso: "R1" }, { recto: "Q2", verso: "R2" }], difficulte: "moyen" }
                    ]
                },
                {
                    id: generateId(),
                    titre: "Atelier 4 - Évaluation Pratique",
                    type: "evaluation",
                    duree: 50,
                    exercices: [
                        { id: generateId(), type: "matching", titre: "Évaluation appariement", colonneGauche: [{ id: "ev1", texte: "Terme évalué" }], colonneDroite: [{ id: "ed1", texte: "Définition évaluée" }], associations: [{ gauche: "ev1", droite: "ed1" }], difficulte: "difficile" },
                        { id: generateId(), type: "tableau", titre: "Tableau évaluation", instruction: "Évaluez vos connaissances", colonnes: ["Domaine", "Performance"], lignes: [{ id: "ev2", cellules: [{ contenu: "Domaine 1", editable: false }, { contenu: "", editable: true }] }], difficulte: "difficile" },
                        { id: generateId(), type: "qcm_multiple", question: "Question finale d'atelier", reponses: [{ texte: "Réponse A", correct: true }, { texte: "Réponse B", correct: false }], difficulte: "difficile" }
                    ]
                }
            ]
        }]
    }
];

// =====================================================
// 🔧 VARIABLES GLOBALES
// =====================================================

function adminLogin() {
    const password = document.getElementById('passwordInput').value;
    const errorMsg = document.getElementById('errorMessage');
    
    if (password === ADMIN_PASSWORD) {
        isAuthenticated = true;
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('adminSection').style.display = 'flex';
        document.getElementById('adminSection').style.flexDirection = 'column';
        
        // Data already initialized by initializeAdminPanel() on DOMContentLoaded
        console.log('[AUTH] ✅ Authentification réussie');
    } else {
        errorMsg.textContent = '❌ Mot de passe incorrect';
        errorMsg.style.display = 'block';
        document.getElementById('passwordInput').value = '';
        console.log('[AUTH] ❌ Tentative de connexion échouée');
    }
}

function adminLogout() {
    isAuthenticated = false;
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('adminSection').style.display = 'none';
    document.getElementById('passwordInput').value = '';
    document.getElementById('errorMessage').style.display = 'none';
    
    console.log('[AUTH] ✅ Déconnexion réussie');
}

// =====================================================
// 🧭 NAVIGATION ENTRE TABS
// =====================================================

function switchTab(tabName) {
    // Masquer tous les sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Désactiver tous les boutons nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Afficher la section active
    document.getElementById(tabName + '-section').classList.add('active');
    
    // Activer le bouton nav
    event.target.classList.add('active');
    
    console.log('[NAV] Switched to tab:', tabName);
}

// =====================================================
// 💬 AFFICHAGE MESSAGES
// =====================================================

function showMessage(message, type = 'success') {
    const messageEl = document.getElementById('statusMessage');
    messageEl.textContent = message;
    messageEl.className = 'message ' + type;
    
    console.log('[MSG] ' + type.toUpperCase() + ':', message);
    
    // Auto-hide après 5 secondes
    setTimeout(() => {
        messageEl.className = 'message';
    }, 5000);
}

// =====================================================
// 📡 APPELS API
// =====================================================

const API_BASE = 'http://localhost:5000/api';

async function apiCall(method, endpoint, data = null) {
    try {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(API_BASE + endpoint, options);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('[API ERROR]', error.message);
        showMessage('❌ Erreur API: ' + error.message, 'error');
        return null;
    }
}

// =====================================================
// � FORMULAIRE CHAPITRES
// =====================================================

let editingChapterId = null;

function showCreateChapitreForm() {
    const html = `
        <div class="form-container">
            <h3>📝 Nouveau Chapitre</h3>
            <div class="form-group">
                <label>Niveau*</label>
                <select id="formNiveau" required>
                    <option value="">-- Sélectionne un niveau --</option>
                    <option value="N1">N1 - Fondamentaux</option>
                    <option value="N2">N2 - Intermédiaire</option>
                    <option value="N3">N3 - Avancé</option>
                    <option value="N4">N4 - Expert</option>
                </select>
            </div>
            <div class="form-group">
                <label>Titre*</label>
                <input type="text" id="formTitre" placeholder="Ex: Introduction à la Douane" required>
            </div>
            <div class="form-group">
                <label>ID Chapitre*</label>
                <input type="text" id="formId" placeholder="Ex: ch1" required>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="formDescription" placeholder="Description optionnelle du chapitre"></textarea>
            </div>
            <div class="btn-group">
                <button class="btn btn-primary" onclick="saveNewChapitre()">💾 Enregistrer</button>
                <button class="btn btn-secondary" onclick="cancelForm()">❌ Annuler</button>
            </div>
        </div>
    `;
    
    const list = document.getElementById('chapitresList');
    list.innerHTML = html;
    console.log('[FORM] Formulaire création chapitre affiché');
}

async function saveNewChapitre() {
    const niveau = document.getElementById('formNiveau').value;
    const titre = document.getElementById('formTitre').value;
    const id = document.getElementById('formId').value;
    const description = document.getElementById('formDescription').value;
    
    if (!niveau || !titre || !id) {
        showMessage('❌ Remplissez tous les champs obligatoires', 'error');
        return;
    }
    
    const newChapitre = {
        niveau,
        titre,
        id,
        description,
        etapes: []
    };
    
    console.log('[FORM] Création chapitre:', newChapitre);
    
    try {
        // ✅ Charger chapitres.json actuel depuis API
        const response = await fetch('/api/chapitres');
        const data = await response.json();
        
        // Vérifier que l'ID n'existe pas
        if (data.chapitres.some(ch => ch.id === id)) {
            showMessage('❌ Un chapitre avec l\'ID "' + id + '" existe déjà', 'error');
            return;
        }
        
        // Ajouter le nouveau chapitre
        data.chapitres.push(newChapitre);
        
        // Sauvegarder via POST /api/chapitres
        const saveResponse = await fetch('/api/chapitres', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await saveResponse.json();
        
        if (result.success) {
            console.log('[FORM] ✅ Chapitre sauvegardé:', result.message);
            showMessage('✅ Chapitre créé: ' + titre, 'success');
            
            // Recharger CHAPITRES et NIVEAUX
            await initializeAdminPanel();
            loadChapitres();
        } else {
            throw new Error(result.error || 'Erreur sauvegarde');
        }
        
    } catch (error) {
        console.error('[FORM] ❌ Erreur sauvegarde chapitre:', error);
        showMessage('❌ Erreur: ' + error.message, 'error');
    }
}

function cancelForm() {
    loadChapitres();
}

// =====================================================
// �📚 GESTION CHAPITRES
// =====================================================

async function loadChapitres() {
    console.log('[CHAPITRES] Chargement des chapitres...');
    
    try {
        // ✅ Si chapitres n'est pas initialisé, le faire maintenant
        if (chapitres.length === 0) {
            await initializeChapitres();
        }
        
        const list = document.getElementById('chapitresList');
        list.innerHTML = '';
        
        if (!chapitres || chapitres.length === 0) {
            list.innerHTML = '<p>Aucun chapitre trouvé</p>';
            console.log('[CHAPITRES] ✅ 0 chapitres chargés');
            return;
        }
        
        chapitres.forEach((chapitre, index) => {
            const niveauId = chapitre.niveau || 'N1';
            const nbEtapes = chapitre.etapes?.length || 0;
            
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div class="list-item-info" style="cursor: pointer;" onclick="switchTab('etapes'); loadEtapesByChapitreId('${chapitre.id}')">
                    <h3>[${niveauId}] ${chapitre.titre || 'Sans titre'}</h3>
                    <p>ID: ${chapitre.id} | ${nbEtapes} étapes</p>
                </div>
                <div class="list-item-actions">
                    <button class="btn btn-secondary" onclick="editChapitre(${index})">✏️ Modifier</button>
                    <button class="btn btn-info" onclick="duplicateChapitre(${index})">📋 Dupliquer</button>
                    <button class="btn btn-info" onclick="copyChapitre(${index})">📋 Copier</button>
                    <button class="btn btn-danger" onclick="deleteChapitre(${index})">🗑️ Supprimer</button>
                </div>
            `;
            list.appendChild(item);
        });
        
        console.log('[CHAPITRES] ✅ ' + chapitres.length + ' chapitres chargés');
        showMessage('✅ ' + chapitres.length + ' chapitres chargés', 'success');
        
    } catch (error) {
        console.error('[CHAPITRES] ❌ Erreur:', error.message);
        showMessage('❌ Impossible de charger les chapitres: ' + error.message, 'error');
    }
}

async function editChapitre(index) {
    console.log('[CHAPITRES] Edit chapitre index:', index);
    
    const chapitre = CHAPITRES[index];
    if (!chapitre) {
        alert('❌ Chapitre introuvable');
        return;
    }
    
    // Afficher un formulaire de modification
    const nouveauTitre = prompt('Nouveau titre:', chapitre.titre);
    if (!nouveauTitre) return; // Annulé
    
    const nouvelleDescription = prompt('Nouvelle description:', chapitre.description || '');
    
    try {
        // Mettre à jour le chapitre
        chapitre.titre = nouveauTitre;
        chapitre.description = nouvelleDescription;
        
        // Sauvegarder via POST /api/chapitres
        const response = await fetch('/api/chapitres', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapitres: CHAPITRES })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('✅ Chapitre modifié: ' + nouveauTitre, 'success');
            await initializeAdminPanel();
            loadChapitres();
        } else {
            throw new Error(result.error || 'Erreur modification');
        }
    } catch (error) {
        console.error('[CHAPITRES] ❌ Erreur modification:', error);
        alert('❌ Erreur: ' + error.message);
    }
}

async function deleteChapitre(index) {
    if (!confirm('⚠️ Êtes-vous sûr de vouloir supprimer ce chapitre et toutes ses étapes?')) {
        return;
    }
    
    console.log('[CHAPITRES] Delete chapitre index:', index);
    
    const chapitre = CHAPITRES[index];
    if (!chapitre) {
        alert('❌ Chapitre introuvable');
        return;
    }
    
    try {
        // Supprimer le chapitre du tableau
        CHAPITRES.splice(index, 1);
        
        // Sauvegarder via POST /api/chapitres
        const response = await fetch('/api/chapitres', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapitres: CHAPITRES })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('✅ Chapitre supprimé: ' + chapitre.titre, 'success');
            await initializeAdminPanel();
            loadChapitres();
        } else {
            throw new Error(result.error || 'Erreur suppression');
        }
    } catch (error) {
        console.error('[CHAPITRES] ❌ Erreur suppression:', error);
        alert('❌ Erreur: ' + error.message);
    }
}

// =====================================================
// 🌟 GESTION DES ÉTAPES
// =====================================================

let chapitres = [];  // ✅ Tableau global des chapitres
// NOTE: currentChapitreIndex et currentEtapeIndex already declared at line 18-19
let currentExerciceIndex = null;
let selectedTemplateIndex = null;  // Pour templates d'exercices
let selectedThemeIndex = null;     // Pour thèmes de chapitres
let window_CLIPBOARD = null;       // Presse-papiers interne

// Charger les chapitres en mémoire au démarrage
async function initializeChapitres() {
    const response = await fetch('data/chapitres.json');
    let loadedChapitres = await response.json();
    if (!Array.isArray(loadedChapitres)) loadedChapitres = loadedChapitres.chapitres || [];
    
    const saved = localStorage.getItem('CHAPITRES');
    if (saved) {
        const savedChapitres = JSON.parse(saved);
        const newOnes = savedChapitres.filter(sc => !loadedChapitres.some(jc => jc.id === sc.id));
        chapitres = [...loadedChapitres, ...newOnes];
    } else {
        chapitres = loadedChapitres;
    }
}

function saveToLocalStorage() {
    // ═══════════════════════════════════════════════════════════
    // DUAL-SAVE: Sauvegarder pour Admin ET pour App (fallback)
    // ═══════════════════════════════════════════════════════════
    
    try {
        const chapitresJSON = JSON.stringify(chapitres);
        
        // 1️⃣ Clé primaire Admin (ancien format, rétro-compat)
        localStorage.setItem('CHAPITRES', chapitresJSON);
        console.log('[ADMIN-STORAGE] ✅ Sauvegarde CHAPITRES (legacy format)');
        
        // 2️⃣ Clé fallback App (nouveau, pour index.html)
        localStorage.setItem('CHAPITRES_AUTEUR', chapitresJSON);
        console.log('[ADMIN-STORAGE] ✅ Sauvegarde CHAPITRES_AUTEUR (App fallback)');
        
        // 3️⃣ Notifier autres onglets si StorageSync disponible
        if (typeof StorageSync !== 'undefined' && StorageSync.notifyChaptersUpdated) {
            StorageSync.notifyChaptersUpdated(chapitres);
            console.log('[ADMIN-STORAGE] 📢 Signal cross-tab envoyé');
        }
        
        // 4️⃣ Feedback utilisateur
        console.log(`[ADMIN-STORAGE] 💾 Sauvegarde complète: ${chapitres.length} chapitres`);
        
    } catch (error) {
        console.error('[ADMIN-STORAGE] ❌ Erreur sauvegarde:', error.message);
        alert('Erreur sauvegarde: ' + error.message);
    }
}

async function loadEtapes(chapitreIndex) {
    console.log('[ETAPES] Chargement des étapes du chapitre', chapitreIndex);
    currentChapitreIndex = chapitreIndex;  // ✅ Sauvegarder pour les opérations
    currentChapitreId = CHAPITRES[chapitreIndex]?.id; // ✅ Utiliser CHAPITRES majuscule
    
    const chapitre = CHAPITRES[chapitreIndex]; // ✅ Utiliser CHAPITRES majuscule
    if (!chapitre) {
        alert('❌ Chapitre introuvable');
        return;
    }
    
    // Afficher le titre du chapitre
    const etapesTitle = document.getElementById('etapesTitle');
    if (etapesTitle) {
        etapesTitle.textContent = `Étapes - ${chapitre.titre}`;
    }
    
    // Afficher les étapes
    const etapesList = document.getElementById('etapesList');
    etapesList.innerHTML = '';
    
    if (!chapitre.etapes || chapitre.etapes.length === 0) {
        etapesList.innerHTML = '<p>Aucune étape. Créez-en une!</p>';
        return;
    }
    
    chapitre.etapes.forEach((etape, index) => {
        const nbExercices = etape.exercices?.length || 0;
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div class="list-item-info" style="cursor: pointer;" onclick="switchTab('exercices'); loadExercices(${chapitreIndex}, ${index})">
                <h3>${etape.titre || 'Sans titre'}</h3>
                <p>ID: ${etape.id} | ${nbExercices} exercices | Type: ${etape.type || 'standard'}</p>
            </div>
            <div class="list-item-actions">
                <button class="btn btn-secondary" onclick="editEtape(${chapitreIndex}, ${index})">✏️ Modifier</button>
                <button class="btn btn-info" onclick="duplicateEtape(${chapitreIndex}, ${index})">📋 Dupliquer</button>
                <button class="btn btn-info" onclick="copyEtape(${chapitreIndex}, ${index})">📋 Copier</button>
                <button class="btn btn-danger" onclick="deleteEtape(${chapitreIndex}, ${index})">🗑️ Supprimer</button>
            </div>
        `;
        etapesList.appendChild(item);
    });
    
    console.log('[ETAPES] ✅ ' + chapitre.etapes.length + ' étapes affichées');
}

// ✅ Nouvelle fonction: Charger les étapes par ID de chapitre
async function loadEtapesByChapitreId(chapitreId) {
    console.log('[ETAPES] Chargement des étapes du chapitre ID:', chapitreId);
    
    // Trouver le chapitre par ID
    const chapitreIndex = CHAPITRES.findIndex(ch => ch.id === chapitreId);
    if (chapitreIndex === -1) {
        console.error('[ETAPES] Chapitre non trouvé:', chapitreId);
        alert('❌ Chapitre introuvable');
        return;
    }
    
    // Mettre à jour les variables globales
    currentChapitreIndex = chapitreIndex;
    currentChapitreId = chapitreId;
    
    // Appeler loadEtapes avec l'index
    await loadEtapes(chapitreIndex);
}

// ✅ FONCTION 1: Afficher modal création étape
function showCreateEtapeModal() {
    if (currentChapitreIndex === null) {
        showMessage('📁 Sélectionnez un chapitre d\'abord', 'error');
        return;
    }
    
    console.log('[ETAPES] Affichage modal création pour chapitre', currentChapitreIndex);
    
    // Réinitialiser le formulaire
    document.getElementById('etapeFormId').value = '';
    document.getElementById('etapeFormTitre').value = '';
    document.getElementById('etapeFormType').value = 'standard';
    document.getElementById('etapeFormDescription').value = '';
    document.getElementById('etapeFormDuree').value = '30';
    
    // Changer le titre et le bouton
    document.getElementById('etapeModalTitle').textContent = '🃋 Créer une Étape';
    document.getElementById('etapeModalButton').textContent = '💾 Créer';
    document.getElementById('etapeModalButton').onclick = () => saveEtape(currentChapitreIndex, null);
    
    // Afficher le modal
    document.getElementById('etapeModal').style.display = 'flex';
}

// ✅ FONCTION 2: Éditer une étape
async function editEtape(chapitreIndex, etapeIndex) {
    console.log('[ETAPES] Édition:', chapitreIndex, etapeIndex);
    currentChapitreIndex = chapitreIndex;
    
    // ✅ Utiliser CHAPITRES global au lieu de recharger
    const chapitre = CHAPITRES[chapitreIndex];
    
    if (!chapitre) {
        alert('❌ Chapitre introuvable');
        console.error('[ETAPES] Chapitre introuvable à l\'index:', chapitreIndex);
        return;
    }
    
    const etape = chapitre.etapes?.[etapeIndex];
    
    if (!etape) {
        alert('❌ Étape introuvable');
        console.error('[ETAPES] Étape introuvable à l\'index:', etapeIndex);
        return;
    }
    
    console.log('[ETAPES] Édition de l\'étape:', etape.titre);
    
    // Pré-remplir le formulaire
    document.getElementById('etapeFormId').value = etape.id || '';
    document.getElementById('etapeFormTitre').value = etape.titre || '';
    document.getElementById('etapeFormType').value = etape.type || 'standard';
    document.getElementById('etapeFormDescription').value = etape.description || '';
    document.getElementById('etapeFormDuree').value = etape.duree || '30';
    
    // Changer le titre et le bouton
    document.getElementById('etapeModalTitle').textContent = '✏️ Modifier l\'Étape';
    document.getElementById('etapeModalButton').textContent = '💾 Modifier';
    document.getElementById('etapeModalButton').onclick = () => saveEtape(chapitreIndex, etapeIndex);
    
    // Afficher le modal
    document.getElementById('etapeModal').style.display = 'flex';
}

// ✅ FONCTION 3: Sauvegarder étape
async function saveEtape(chapitreIndex, etapeIndex) {
    const id = document.getElementById('etapeFormId').value;
    const titre = document.getElementById('etapeFormTitre').value;
    const type = document.getElementById('etapeFormType').value;
    const description = document.getElementById('etapeFormDescription').value;
    const duree = parseInt(document.getElementById('etapeFormDuree').value) || 30;
    
    // Validation
    if (!titre) {
        showMessage('❌ Le titre est obligatoire', 'error');
        return;
    }
    
    console.log('[ETAPES] saveEtape - currentChapitreId:', currentChapitreId);
    console.log('[ETAPES] saveEtape - CHAPITRES.length:', CHAPITRES.length);
    
    try {
        // ✅ Utiliser CHAPITRES global au lieu de recharger
        const chapitre = CHAPITRES.find(ch => ch.id === currentChapitreId);
        if (!chapitre) {
            console.error('[ETAPES] Chapitre non trouvé dans CHAPITRES:', currentChapitreId);
            console.error('[ETAPES] CHAPITRES disponibles:', CHAPITRES.map(ch => ch.id));
            throw new Error('Chapitre non trouvé: ' + currentChapitreId);
        }
        
        console.log('[ETAPES] Chapitre trouvé:', chapitre.titre);
        
        if (!chapitre.etapes) chapitre.etapes = [];
        
        if (etapeIndex === null) {
            // ✅ CRÉATION
            const newEtape = {
                id: id || 'etape-' + Date.now(),
                titre,
                type,
                description,
                duree,
                exercices: [],
                createdAt: new Date().toISOString()
            };
            
            chapitre.etapes.push(newEtape);
            console.log('[ETAPES] ✅ Étape créée:', newEtape);
            showMessage('✅ Étape créée: ' + titre, 'success');
        } else {
            // ✅ MODIFICATION
            const etape = chapitre.etapes[etapeIndex];
            etape.titre = titre;
            etape.type = type;
            etape.description = description;
            etape.duree = duree;
            console.log('[ETAPES] ✅ Étape modifiée:', etape);
            showMessage('✅ Étape modifiée: ' + titre, 'success');
        }
        
        // ✅ Sauvegarder TOUS les chapitres via POST /api/chapitres
        const saveResponse = await fetch('/api/chapitres', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapitres: CHAPITRES })
        });
        
        const result = await saveResponse.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Erreur sauvegarde');
        }
        
        console.log('[ETAPES] ✅ Sauvegardé dans chapitres.json');
        
        // Fermer le modal
        document.getElementById('etapeModal').style.display = 'none';
        
        // ✅ Recharger CHAPITRES et NIVEAUX pour mettre à jour les sélecteurs
        await initializeAdminPanel();
        
        // ✅ Trouver le nouvel index du chapitre après rechargement
        const newChapitreIndex = CHAPITRES.findIndex(ch => ch.id === currentChapitreId);
        
        // ✅ Mettre à jour le menu déroulant des étapes dans l'onglet exercices
        onChapitreChange(currentChapitreId);
        
        // ✅ Si création, sélectionner automatiquement la nouvelle étape
        if (etapeIndex === null && newChapitreIndex !== -1) {
            const chapitre = CHAPITRES[newChapitreIndex];
            const newEtapeIndex = chapitre.etapes.length - 1; // Dernière étape créée
            
            // Mettre à jour le select et la variable globale
            const selectEtape = document.getElementById('selectEtape');
            if (selectEtape) {
                selectEtape.value = newEtapeIndex;
                onEtapeChange(newEtapeIndex);
            }
        }
        
        // Recharger la liste des étapes
        if (newChapitreIndex !== -1) {
            loadEtapes(newChapitreIndex);
        }
        
    } catch (error) {
        console.error('[ETAPES] ❌ Erreur:', error);
        showMessage('❌ Erreur: ' + error.message, 'error');
    }
}

// ✅ FONCTION 4: Supprimer étape
async function deleteEtape(chapitreIndex, etapeIndex) {
    if (!confirm('⚠️ Êtes-vous sûr de vouloir supprimer cette étape et tous ses exercices?')) {
        return;
    }
    
    console.log('[ETAPES] Suppression:', chapitreIndex, etapeIndex);
    
    try {
        const chapitre = CHAPITRES[chapitreIndex];
        if (!chapitre || !chapitre.etapes || !chapitre.etapes[etapeIndex]) {
            throw new Error('Étape introuvable');
        }
        
        const deletedEtape = chapitre.etapes[etapeIndex];
        
        // Supprimer l'étape
        chapitre.etapes.splice(etapeIndex, 1);
        
        // Sauvegarder via POST /api/chapitres
        const response = await fetch('/api/chapitres', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapitres: CHAPITRES })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Erreur sauvegarde');
        }
        
        console.log('[ETAPES] ✅ Étape supprimée:', deletedEtape.titre);
        showMessage('✅ Étape supprimée: ' + deletedEtape.titre, 'success');
        
        // Recharger l'interface
        await initializeAdminPanel();
        
        // Recharger la liste des étapes pour ce chapitre
        const newIndex = CHAPITRES.findIndex(ch => ch.id === chapitre.id);
        if (newIndex !== -1) {
            loadEtapes(newIndex);
        }
    } catch (error) {
        console.error('[ETAPES] ❌ Erreur suppression:', error);
        showMessage('❌ Erreur: ' + error.message, 'error');
    }
}

// ✅ Fermer modal
function closeEtapeModal() {
    document.getElementById('etapeModal').style.display = 'none';
}

// =====================================================
// 📈 GESTION DES EXERCICES
// =====================================================

async function loadExercices(chapitreId, etapeIndex) {
    // Support both old style (indices) and new style (IDs)
    let chapitre, etapeIdx;
    
    if (typeof chapitreId === 'number') {
        // Old style: using indices
        chapitre = CHAPITRES[chapitreId];
        etapeIdx = etapeIndex;
        currentChapitreIndex = chapitreId;
        currentEtapeIndex = etapeIndex;
    } else {
        // New style: using chapitre ID
        chapitre = CHAPITRES.find(ch => ch.id === chapitreId);
        if (!chapitre) {
            console.error('[EXERCICES] Chapitre non trouvé:', chapitreId);
            return;
        }
        currentChapitreIndex = CHAPITRES.indexOf(chapitre);
        etapeIdx = selectedEtapeIndex;
        currentEtapeIndex = etapeIdx;
        selectedChapitreId = chapitreId;
    }
    
    console.log('[EXERCICES] Chargement des exercices pour:', {chapitreId, etapeIdx});
    
    const etape = chapitre?.etapes?.[etapeIdx];
    
    if (!chapitre || !etape) {
        console.error('❌ Chapitre ou Étape introuvable');
        return;
    }
    
    // Afficher le titre
    const exercicesTitle = document.getElementById('exercicesTitle');
    if (exercicesTitle) {
        exercicesTitle.textContent = `Exercices - ${chapitre.titre} > ${etape.titre}`;
    }
    
    // Afficher les exercices
    const exercicesList = document.getElementById('exercicesList');
    exercicesList.innerHTML = '';
    
    if (!etape.exercices || etape.exercices.length === 0) {
        exercicesList.innerHTML = '<p>Aucun exercice. Créez-en un!</p>';
        return;
    }
    
    etape.exercices.forEach((exercice, index) => {
        const typeLabel = {
            qcm_unique: 'QCM Unique',
            qcm_multiple: 'QCM Multiple',
            texte: 'Texte',
            photos: 'Photos',
            dragdrop: 'Drag & Drop',
            flashcard: 'Flashcard'
        }[exercice.type] || exercice.type;
        
        const item = document.createElement('div');
        item.className = 'list-item exercice-item';
        item.draggable = true;
        item.dataset.exerciceType = exercice.type;
        item.dataset.exerciceIndex = index;
        item.innerHTML = `
            <div class="drag-handle">☰</div>
            <div class="list-item-info">
                <h3>${exercice.question || exercice.titre || 'Sans titre'}</h3>
                <p>Type: ${typeLabel} | ID: ${exercice.id}</p>
            </div>
            <div class="list-item-actions">
                <button class="btn btn-secondary" onclick="previewExercice(${index})">👁️ Aperçu</button>
                <button class="btn btn-secondary" onclick="editExercice(${currentChapitreIndex}, ${etapeIdx}, ${index})">✏️ Modifier</button>
                <button class="btn btn-info" onclick="duplicateExercice(${currentChapitreIndex}, ${etapeIdx}, ${index})">📋 Dupliquer</button>
                <button class="btn btn-info" onclick="copyExercice_wrapper(${currentChapitreIndex}, ${etapeIdx}, ${index})">📋 Copier</button>
                <button class="btn btn-danger" onclick="deleteExercice(${currentChapitreIndex}, ${etapeIdx}, ${index})">🗑️ Supprimer</button>
            </div>
        `;
        
        // Ajouter les événements drag-drop
        item.addEventListener('dragstart', handleExerciceDragStart);
        item.addEventListener('dragover', handleExerciceDragOver);
        item.addEventListener('drop', handleExerciceDrop);
        item.addEventListener('dragend', handleExerciceDragEnd);
        item.addEventListener('dragleave', handleExerciceDragLeave);
        
        exercicesList.appendChild(item);
    });
    
    // Initialiser le filtre
    filterExercicesByType('all');
    
    console.log('[EXERCICES] ✅ ' + etape.exercices.length + ' exercices affichés');
}
function showCreateExerciceModal() {
    if (currentChapitreIndex === null || currentEtapeIndex === null) {
        showMessage('📁 Sélectionnez un chapitre ET une étape d\'abord', 'error');
        return;
    }
    
    console.log('[EXERCICES] Affichage modal création');
    
    currentExerciceIndex = null;
    document.getElementById('exerciceType').value = '';
    document.getElementById('exerciceFormContainer').innerHTML = '';
    document.getElementById('exerciceModalTitle').textContent = '📈 Créer un Exercice';
    document.getElementById('exerciceSaveBtn').textContent = '💾 Créer';
    
    document.getElementById('exerciceModal').style.display = 'flex';
}

function selectExerciceType(type) {
    const container = document.getElementById('exerciceFormContainer');
    container.innerHTML = '';
    
    if (!type) return;
    
    console.log('[EXERCICES] Type sélectionné:', type);
    
    if (type === 'qcm_unique') {
        container.innerHTML = `
            <div class="form-group">
                <label>Titre*</label>
                <input type="text" id="exerciceTitre" placeholder="Titre de l'exercice" required />
            </div>
            <div class="form-group">
                <label>Question*</label>
                <textarea id="exerciceQuestion" placeholder="Posez votre question" required></textarea>
            </div>
            <div class="form-group">
                <label>Réponses (4 options)</label>
                <input type="text" id="exerciceReponse1" placeholder="Option 1" />
                <input type="text" id="exerciceReponse2" placeholder="Option 2" />
                <input type="text" id="exerciceReponse3" placeholder="Option 3" />
                <input type="text" id="exerciceReponse4" placeholder="Option 4" />
            </div>
            <div class="form-group">
                <label>Bonne Réponse*</label>
                <select id="exerciceBonneReponse" required>
                    <option value="">-- Sélectionnez --</option>
                    <option value="0">Option 1</option>
                    <option value="1">Option 2</option>
                    <option value="2">Option 3</option>
                    <option value="3">Option 4</option>
                </select>
            </div>
            <div class="form-group">
                <label>Explication</label>
                <textarea id="exerciceExplication" placeholder="Explication de la réponse"></textarea>
            </div>
            <div class="form-group">
                <label>Difficulté</label>
                <select id="exerciceDifficulte">
                    <option value="facile">Facile</option>
                    <option value="moyen" selected>Moyen</option>
                    <option value="difficile">Difficile</option>
                </select>
            </div>
        `;
    } else if (type === 'qcm_multiple') {
        container.innerHTML = `
            <div class="form-group">
                <label>Question*</label>
                <textarea id="exerciceQuestion" placeholder="Posez votre question" required></textarea>
            </div>
            <div class="form-group">
                <label>Réponses (cochez les bonnes)</label>
                <div style="margin-bottom: 10px;">
                    <input type="checkbox" id="exerciceReponseCheck1" />
                    <input type="text" id="exerciceReponse1" placeholder="Option 1" style="width: calc(100% - 30px);" />
                </div>
                <div style="margin-bottom: 10px;">
                    <input type="checkbox" id="exerciceReponseCheck2" />
                    <input type="text" id="exerciceReponse2" placeholder="Option 2" style="width: calc(100% - 30px);" />
                </div>
                <div style="margin-bottom: 10px;">
                    <input type="checkbox" id="exerciceReponseCheck3" />
                    <input type="text" id="exerciceReponse3" placeholder="Option 3" style="width: calc(100% - 30px);" />
                </div>
                <div style="margin-bottom: 10px;">
                    <input type="checkbox" id="exerciceReponseCheck4" />
                    <input type="text" id="exerciceReponse4" placeholder="Option 4" style="width: calc(100% - 30px);" />
                </div>
            </div>
            <div class="form-group">
                <label>Explication</label>
                <textarea id="exerciceExplication" placeholder="Explication de la réponse"></textarea>
            </div>
            <div class="form-group">
                <label>Difficulté</label>
                <select id="exerciceDifficulte">
                    <option value="facile">Facile</option>
                    <option value="moyen" selected>Moyen</option>
                    <option value="difficile">Difficile</option>
                </select>
            </div>
        `;
    } else if (type === 'texte') {
        container.innerHTML = `
            <div class="form-group">
                <label>Titre*</label>
                <input type="text" id="exerciceTitre" placeholder="Titre de l'exercice" required />
            </div>
            <div class="form-group">
                <label>Question*</label>
                <textarea id="exerciceQuestion" placeholder="Posez votre question" required></textarea>
            </div>
            <div class="form-group">
                <label>Réponse Attendue*</label>
                <textarea id="exerciceReponseAttendus" placeholder="Réponse attendue" required></textarea>
            </div>
            <div class="form-group">
                <label>Tolérance de Correction</label>
                <select id="exerciceTolerance">
                    <option value="exact">Exact</option>
                    <option value="partiel" selected>Partiel</option>
                    <option value="flexible">Flexible</option>
                </select>
            </div>
            <div class="form-group">
                <label>Difficulté</label>
                <select id="exerciceDifficulte">
                    <option value="facile">Facile</option>
                    <option value="moyen" selected>Moyen</option>
                    <option value="difficile">Difficile</option>
                </select>
            </div>
        `;
    } else if (type === 'photos') {
        container.innerHTML = `
            <div class="form-group">
                <label>Titre*</label>
                <input type="text" id="exerciceTitre" placeholder="Titre de l'exercice" required />
            </div>
            <div class="form-group">
                <label>Images</label>
                <div style="margin-bottom: 15px;">
                    <input type="text" id="exerciceImage1Url" placeholder="URL Image 1" />
                    <input type="text" id="exerciceImage1Label" placeholder="Label Image 1" />
                </div>
                <div style="margin-bottom: 15px;">
                    <input type="text" id="exerciceImage2Url" placeholder="URL Image 2" />
                    <input type="text" id="exerciceImage2Label" placeholder="Label Image 2" />
                </div>
                <div style="margin-bottom: 15px;">
                    <input type="text" id="exerciceImage3Url" placeholder="URL Image 3" />
                    <input type="text" id="exerciceImage3Label" placeholder="Label Image 3" />
                </div>
                <div style="margin-bottom: 15px;">
                    <input type="text" id="exerciceImage4Url" placeholder="URL Image 4" />
                    <input type="text" id="exerciceImage4Label" placeholder="Label Image 4" />
                </div>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="exerciceDescription" placeholder="Description optionnelle"></textarea>
            </div>
            <div class="form-group">
                <label>Difficulté</label>
                <select id="exerciceDifficulte">
                    <option value="facile">Facile</option>
                    <option value="moyen" selected>Moyen</option>
                    <option value="difficile">Difficile</option>
                </select>
            </div>
        `;
    } else if (type === 'flashcard') {
        container.innerHTML = `
            <div class="form-group">
                <label>Titre*</label>
                <input type="text" id="flashcardTitre" placeholder="ex: Vocabulaire Français" required />
            </div>
            <div class="form-group">
                <label>Langue Recto:</label>
                <input type="text" id="flashcardLangueRecto" placeholder="ex: English" />
            </div>
            <div class="form-group">
                <label>Langue Verso:</label>
                <input type="text" id="flashcardLangueVerso" placeholder="ex: Français" />
            </div>
            <div class="form-group">
                <label>Cartes (Recto | Verso)*</label>
                <textarea id="flashcardCartes" 
                    placeholder="Une par ligne, format: recto | verso
Apple | Pomme
Water | Eau
House | Maison" required></textarea>
            </div>
            <div class="form-group">
                <label>Difficulté</label>
                <select id="flashcardDifficulte">
                    <option value="facile">Facile</option>
                    <option value="moyen" selected>Moyen</option>
                    <option value="difficile">Difficile</option>
                </select>
            </div>
        `;
    } else if (type === 'dragdrop_matching') {
        container.innerHTML = `
            <div class="form-group">
                <label>Titre*</label>
                <input type="text" id="matchingTitre" placeholder="ex: Associer capitales et pays" required />
            </div>
            <div class="form-row" style="display: flex; gap: 15px;">
                <div class="form-group" style="flex: 1;">
                    <label>Colonne Gauche*</label>
                    <textarea id="matchingGauche" 
                        placeholder="Un item par ligne
Paris
Madrid
Berlin" required></textarea>
                </div>
                <div class="form-group" style="flex: 1;">
                    <label>Colonne Droite*</label>
                    <textarea id="matchingDroite" 
                        placeholder="Un item par ligne
France
Espagne
Allemagne" required></textarea>
                </div>
            </div>
            <div class="info-box">
                💡 Les lignes doivent correspondre dans le même ordre (1ère gauche = 1ère droite)
            </div>
            <div class="form-group">
                <label>Difficulté</label>
                <select id="matchingDifficulte">
                    <option value="facile">Facile</option>
                    <option value="moyen" selected>Moyen</option>
                    <option value="difficile">Difficile</option>
                </select>
            </div>
        `;
    } else if (type === 'classement') {
        container.innerHTML = `
            <div class="form-group">
                <label>Titre*</label>
                <input type="text" id="classementTitre" placeholder="ex: Classer par ordre de taille" required />
            </div>
            <div class="form-group">
                <label>Instruction*</label>
                <input type="text" id="classementInstruction" placeholder="ex: Classez du plus petit au plus grand" required />
            </div>
            <div class="form-group">
                <label>Items à classer (un par ligne)*</label>
                <textarea id="classementItems" 
                    placeholder="Un item par ligne
Souris
Éléphant
Chat" required></textarea>
            </div>
            <div class="form-group">
                <label>Difficulté</label>
                <select id="classementDifficulte">
                    <option value="facile">Facile</option>
                    <option value="moyen" selected>Moyen</option>
                    <option value="difficile">Difficile</option>
                </select>
            </div>
            <div class="info-box">
                💡 Les items seront mélangés aléatoirement au jeu. L'ordre ici est la bonne réponse.
            </div>
        `;
    } else if (type === 'tableau') {
        container.innerHTML = `
            <div class="form-group">
                <label>Titre*</label>
                <input type="text" id="tableauTitre" placeholder="ex: Remplir le tableau" required />
            </div>
            <div class="form-group">
                <label>Instruction*</label>
                <input type="text" id="tableauInstruction" placeholder="ex: Complétez le tableau" required />
            </div>
            <div class="form-row" style="display: flex; gap: 15px;">
                <div class="form-group" style="flex: 1;">
                    <label>Nombre de colonnes*</label>
                    <input type="number" id="tableauColonnes" value="3" min="2" max="6" required />
                </div>
                <div class="form-group" style="flex: 1;">
                    <label>Nombre de lignes*</label>
                    <input type="number" id="tableauLignes" value="3" min="2" max="10" required />
                </div>
            </div>
            <div class="form-group">
                <label>Difficulté</label>
                <select id="tableauDifficulte">
                    <option value="facile">Facile</option>
                    <option value="moyen" selected>Moyen</option>
                    <option value="difficile">Difficile</option>
                </select>
            </div>
            <div id="tableauBuilder"></div>
            <div class="info-box">
                💡 Cliquez sur "Générer tableau" pour créer le formulaire
            </div>
            <button type="button" class="btn btn-secondary" onclick="buildTableauEditor(parseInt(document.getElementById('tableauColonnes').value), parseInt(document.getElementById('tableauLignes').value))">
                Générer tableau
            </button>
        `;
    } else if (type === 'video_questions') {
        container.innerHTML = `
            <div class="form-group">
                <label>Titre*</label>
                <input type="text" id="videoTitre" placeholder="ex: Les fractions expliquées" required />
            </div>
            <div class="form-group">
                <label>URL Vidéo (YouTube embed link)*</label>
                <input type="url" id="videoUrl" placeholder="https://youtube.com/embed/..." required />
            </div>
            <div class="form-group">
                <label>Difficulté</label>
                <select id="videoDifficulte">
                    <option value="facile">Facile</option>
                    <option value="moyen" selected>Moyen</option>
                    <option value="difficile">Difficile</option>
                </select>
            </div>
            <div class="form-group">
                <label>Questions intégrées:</label>
                <div id="videoQuestionsContainer" style="margin: 10px 0; padding: 10px; background: #f9f9f9; border-radius: 4px; min-height: 50px;"></div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="addVideoQuestion()" style="margin-top: 10px;">
                ➕ Ajouter question
            </button>
            <div class="info-box" style="margin-top: 15px;">
                💡 Ajoutez des questions qui s'afficheront à des moments clés de la vidéo
            </div>
        `;
    }
}


async function editExercice(chapitreIndex, etapeIndex, exerciceIndex) {
    console.log('[EXERCICES] Édition:', chapitreIndex, etapeIndex, exerciceIndex);
    currentChapitreIndex = chapitreIndex;
    currentEtapeIndex = etapeIndex;
    currentExerciceIndex = exerciceIndex;
    
    // ✅ Utiliser CHAPITRES global au lieu de recharger
    const chapitre = CHAPITRES[chapitreIndex];
    if (!chapitre) {
        alert('❌ Chapitre introuvable');
        console.error('[EXERCICES] Chapitre introuvable à l\'index:', chapitreIndex);
        return;
    }
    
    const etape = chapitre.etapes?.[etapeIndex];
    if (!etape) {
        alert('❌ Étape introuvable');
        console.error('[EXERCICES] Étape introuvable à l\'index:', etapeIndex);
        return;
    }
    
    const exercice = etape.exercices?.[exerciceIndex];
    if (!exercice) {
        alert('❌ Exercice introuvable');
        console.error('[EXERCICES] Exercice introuvable à l\'index:', exerciceIndex);
        return;
    }
    
    console.log('[EXERCICES] Édition de l\'exercice:', exercice.titre || exercice.question);
    
    // Définir le type et peupler le formulaire
    document.getElementById('exerciceType').value = exercice.type || '';
    selectExerciceType(exercice.type);
    
    // Pré-remplir selon le type
    if (exercice.type === 'qcm_unique') {
        document.getElementById('exerciceTitre').value = exercice.titre || '';
        document.getElementById('exerciceQuestion').value = exercice.question || '';
        (exercice.reponses || []).forEach((rep, i) => {
            const field = document.getElementById(`exerciceReponse${i + 1}`);
            if (field) field.value = rep;
        });
        document.getElementById('exerciceBonneReponse').value = exercice.bonneReponse || '';
        document.getElementById('exerciceExplication').value = exercice.explication || '';
        document.getElementById('exerciceDifficulte').value = exercice.difficulte || 'moyen';
    } else if (exercice.type === 'qcm_multiple') {
        document.getElementById('exerciceTitre').value = exercice.titre || '';
        document.getElementById('exerciceQuestion').value = exercice.question || '';
        (exercice.reponses || []).forEach((rep, i) => {
            const checkField = document.getElementById(`exerciceReponseCheck${i + 1}`);
            const textField = document.getElementById(`exerciceReponse${i + 1}`);
            if (checkField && rep) {
                checkField.checked = rep.correct || false;
                if (textField) textField.value = rep.texte || '';
            }
        });
        document.getElementById('exerciceExplication').value = exercice.explication || '';
        document.getElementById('exerciceDifficulte').value = exercice.difficulte || 'moyen';
    } else if (exercice.type === 'texte') {
        document.getElementById('exerciceTitre').value = exercice.titre || '';
        document.getElementById('exerciceQuestion').value = exercice.question || '';
        document.getElementById('exerciceReponseAttendus').value = (exercice.reponseAttendus || [])[0] || '';
        document.getElementById('exerciceTolerance').value = exercice.tolerance || 'partiel';
        document.getElementById('exerciceDifficulte').value = exercice.difficulte || 'moyen';
    } else if (exercice.type === 'photos') {
        document.getElementById('exerciceTitre').value = exercice.titre || '';
        (exercice.images || []).forEach((img, i) => {
            const urlField = document.getElementById(`exerciceImage${i + 1}Url`);
            const labelField = document.getElementById(`exerciceImage${i + 1}Label`);
            if (urlField && labelField) {
                urlField.value = img.url || '';
                labelField.value = img.label || '';
            }
        });
        document.getElementById('exerciceDescription').value = exercice.description || '';
        document.getElementById('exerciceDifficulte').value = exercice.difficulte || 'moyen';
    } else if (exercice.type === 'flashcard') {
        document.getElementById('flashcardTitre').value = exercice.titre || '';
        document.getElementById('flashcardLangueRecto').value = exercice.langueRecto || 'Recto';
        document.getElementById('flashcardLangueVerso').value = exercice.langueVerso || 'Verso';
        const cartesText = (exercice.cartes || []).map(c => `${c.recto} | ${c.verso}`).join('\n');
        document.getElementById('flashcardCartes').value = cartesText;
        document.getElementById('flashcardDifficulte').value = exercice.difficulte || 'moyen';
    } else if (exercice.type === 'dragdrop_matching') {
        document.getElementById('matchingTitre').value = exercice.titre || '';
        const gaucheText = (exercice.colonneGauche || []).map(g => g.texte).join('\n');
        const droiteText = (exercice.colonneDroite || []).map(d => d.texte).join('\n');
        document.getElementById('matchingGauche').value = gaucheText;
        document.getElementById('matchingDroite').value = droiteText;
        document.getElementById('matchingDifficulte').value = exercice.difficulte || 'moyen';
    } else if (exercice.type === 'classement') {
        document.getElementById('classementTitre').value = exercice.titre || '';
        document.getElementById('classementInstruction').value = exercice.instruction || '';
        const itemsText = (exercice.items || []).map(i => i.texte).join('\n');
        document.getElementById('classementItems').value = itemsText;
        document.getElementById('classementDifficulte').value = exercice.difficulte || 'moyen';
    } else if (exercice.type === 'tableau') {
        document.getElementById('tableauTitre').value = exercice.titre || '';
        document.getElementById('tableauInstruction').value = exercice.instruction || '';
        const nbCols = (exercice.colonnes || []).length;
        const nbRows = (exercice.lignes || []).length;
        document.getElementById('tableauColonnes').value = nbCols;
        document.getElementById('tableauLignes').value = nbRows;
        buildTableauEditor(nbCols, nbRows);
        // Pré-remplir le tableau
        setTimeout(() => {
            (exercice.colonnes || []).forEach((col, i) => {
                const colHeader = document.querySelector(`.tableau-col-header[data-col="${i}"]`);
                if (colHeader) colHeader.value = col;
            });
            (exercice.lignes || []).forEach((row, r) => {
                row.cellules.forEach((cell, c) => {
                    const cellInput = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                    const editableCheck = document.querySelector(`.tableau-editable[data-row="${r}"][data-col="${c}"]`);
                    if (cellInput) cellInput.value = cell.contenu || '';
                    if (editableCheck) editableCheck.checked = cell.editable || false;
                });
            });
        }, 50);
        document.getElementById('tableauDifficulte').value = exercice.difficulte || 'moyen';
    } else if (exercice.type === 'video_questions') {
        document.getElementById('videoTitre').value = exercice.titre || '';
        document.getElementById('videoUrl').value = exercice.videoUrl || '';
        document.getElementById('videoDifficulte').value = exercice.difficulte || 'moyen';
        // Remplir les questions
        const container = document.getElementById('videoQuestionsContainer');
        container.innerHTML = '';
        (exercice.questions || []).forEach(q => {
            const qId = q.id || 'q-' + Date.now();
            const qHtml = `
                <div class="video-question" id="${qId}" style="margin-bottom: 15px; padding: 10px; background: white; border-left: 3px solid #667eea; border-radius: 4px;">
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <input type="text" placeholder="Timestamp (mm:ss)" class="video-question-timestamp" value="${q.timestamp || ''}" style="width: 100px; padding: 8px;" />
                        <select class="video-question-type" style="padding: 8px;">
                            <option value="qcm_unique" ${q.type === 'qcm_unique' ? 'selected' : ''}>QCM Unique</option>
                            <option value="texte" ${q.type === 'texte' ? 'selected' : ''}>Texte</option>
                        </select>
                        <button type="button" class="btn btn-danger btn-sm" onclick="removeVideoQuestion('${qId}')" style="padding: 5px 10px;">✕</button>
                    </div>
                    <textarea class="video-question-content" placeholder="Question et réponses (format libre)" style="width: 100%; height: 80px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">${q.content || ''}</textarea>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', qHtml);
        });
    }
    
    document.getElementById('exerciceModalTitle').textContent = '✏️ Modifier l\'Exercice';
    document.getElementById('exerciceSaveBtn').textContent = '💾 Modifier';
    document.getElementById('exerciceModal').style.display = 'flex';
}

async function saveExercice() {
    const type = document.getElementById('exerciceType').value;
    
    if (!type) {
        showMessage('❌ Sélectionnez un type d\'exercice', 'error');
        return;
    }
    
    // Verify we have selected chapter and etape
    if (!selectedChapitreId || selectedEtapeIndex === null) {
        showMessage('❌ Sélectionnez d\'abord un chapitre et une étape', 'error');
        return;
    }
    
    // Load chapter data to get etape
    const chapitre = CHAPITRES.find(ch => ch.id === selectedChapitreId);
    if (!chapitre) {
        showMessage('❌ Chapitre non trouvé', 'error');
        return;
    }
    
    const etape = chapitre.etapes?.[selectedEtapeIndex];
    if (!etape) {
        showMessage('❌ Étape non trouvée', 'error');
        return;
    }
    
    // Build exercice object based on type
    let exercice = {};
    
    if (type === 'qcm_unique') {
        const titre = document.getElementById('exerciceTitre').value;
        const question = document.getElementById('exerciceQuestion').value;
        const reponses = [
            document.getElementById('exerciceReponse1').value,
            document.getElementById('exerciceReponse2').value,
            document.getElementById('exerciceReponse3').value,
            document.getElementById('exerciceReponse4').value
        ].filter(r => r);
        const bonneReponse = parseInt(document.getElementById('exerciceBonneReponse').value);
        const explication = document.getElementById('exerciceExplication').value;
        const difficulte = document.getElementById('exerciceDifficulte').value;
        
        if (!titre || !question || reponses.length < 2 || bonneReponse === '') {
            showMessage('❌ Remplissez tous les champs obligatoires', 'error');
            return;
        }
        
        exercice = {
            type: 'qcm_unique',
            titre,
            question,
            reponses,
            bonneReponse,
            explication,
            difficulte
        };
    } else if (type === 'qcm_multiple') {
        const titre = document.getElementById('exerciceTitre').value;
        const question = document.getElementById('exerciceQuestion').value;
        const reponses = [
            { texte: document.getElementById('exerciceReponse1').value, correct: document.getElementById('exerciceReponseCheck1').checked },
            { texte: document.getElementById('exerciceReponse2').value, correct: document.getElementById('exerciceReponseCheck2').checked },
            { texte: document.getElementById('exerciceReponse3').value, correct: document.getElementById('exerciceReponseCheck3').checked },
            { texte: document.getElementById('exerciceReponse4').value, correct: document.getElementById('exerciceReponseCheck4').checked }
        ].filter(r => r.texte);
        const explication = document.getElementById('exerciceExplication').value;
        const difficulte = document.getElementById('exerciceDifficulte').value;
        
        if (!titre || !question || reponses.length < 2) {
            showMessage('❌ Remplissez tous les champs obligatoires', 'error');
            return;
        }
        
        exercice = {
            type: 'qcm_multiple',
            titre,
            question,
            reponses,
            explication,
            difficulte
        };
    } else if (type === 'texte') {
        const titre = document.getElementById('exerciceTitre').value;
        const question = document.getElementById('exerciceQuestion').value;
        const reponseAttendus = document.getElementById('exerciceReponseAttendus').value;
        const tolerance = document.getElementById('exerciceTolerance').value;
        const difficulte = document.getElementById('exerciceDifficulte').value;
        
        if (!titre || !question || !reponseAttendus) {
            showMessage('❌ Remplissez tous les champs obligatoires', 'error');
            return;
        }
        
        exercice = {
            type: 'texte',
            titre,
            question,
            reponseAttendus: [reponseAttendus],
            tolerance,
            difficulte
        };
    } else if (type === 'photos') {
        const titre = document.getElementById('exerciceTitre').value;
        const images = [];
        for (let i = 1; i <= 4; i++) {
            const url = document.getElementById(`exerciceImage${i}Url`).value;
            const label = document.getElementById(`exerciceImage${i}Label`).value;
            if (url) images.push({ url, label });
        }
        const description = document.getElementById('exerciceDescription').value;
        const difficulte = document.getElementById('exerciceDifficulte').value;
        
        if (!titre || images.length < 1) {
            showMessage('❌ Remplissez tous les champs obligatoires', 'error');
            return;
        }
        
        exercice = {
            type: 'photos',
            titre,
            images,
            description,
            difficulte
        };
    } else if (type === 'flashcard') {
        const titre = document.getElementById('flashcardTitre').value;
        const langueRecto = document.getElementById('flashcardLangueRecto').value;
        const langueVerso = document.getElementById('flashcardLangueVerso').value;
        const cartesText = document.getElementById('flashcardCartes').value;
        const difficulte = document.getElementById('flashcardDifficulte').value;
        
        const cartes = parseFlashcardCartes(cartesText);
        
        if (!titre || cartes.length < 1) {
            showMessage('❌ Remplissez tous les champs obligatoires', 'error');
            return;
        }
        
        exercice = {
            type: 'flashcard',
            titre,
            cartes,
            difficulte,
            langueRecto: langueRecto || 'Recto',
            langueVerso: langueVerso || 'Verso'
        };
    } else if (type === 'dragdrop_matching') {
        const titre = document.getElementById('matchingTitre').value;
        const gaucheText = document.getElementById('matchingGauche').value;
        const droiteText = document.getElementById('matchingDroite').value;
        const difficulte = document.getElementById('matchingDifficulte').value;
        
        const { colonneGauche, colonneDroite, associations } = parseMatchingItems(gaucheText, droiteText);
        
        if (!titre || colonneGauche.length < 1 || colonneDroite.length < 1) {
            showMessage('❌ Remplissez tous les champs obligatoires', 'error');
            return;
        }
        
        if (colonneGauche.length !== colonneDroite.length) {
            showMessage('❌ Les deux colonnes doivent avoir le même nombre d\'items', 'error');
            return;
        }
        
        exercice = {
            type: 'dragdrop_matching',
            titre,
            colonneGauche,
            colonneDroite,
            associations,
            difficulte
        };
    } else if (type === 'classement') {
        const titre = document.getElementById('classementTitre').value;
        const instruction = document.getElementById('classementInstruction').value;
        const itemsText = document.getElementById('classementItems').value;
        const difficulte = document.getElementById('classementDifficulte').value;
        
        const items = parseClassementItems(itemsText);
        
        if (!titre || !instruction || items.length < 2) {
            showMessage('❌ Remplissez tous les champs obligatoires (min 2 items)', 'error');
            return;
        }
        
        exercice = {
            type: 'classement',
            titre,
            instruction,
            items,
            difficulte
        };
    } else if (type === 'tableau') {
        const titre = document.getElementById('tableauTitre').value;
        const instruction = document.getElementById('tableauInstruction').value;
        const difficulte = document.getElementById('tableauDifficulte').value;
        
        const { colonnes, lignes } = parseTableauData();
        
        if (!titre || !instruction || !colonnes || colonnes.length < 2) {
            showMessage('❌ Remplissez tous les champs obligatoires', 'error');
            return;
        }
        
        exercice = {
            type: 'tableau',
            titre,
            instruction,
            colonnes,
            lignes,
            difficulte
        };
    } else if (type === 'video_questions') {
        const titre = document.getElementById('videoTitre').value;
        const videoUrl = document.getElementById('videoUrl').value;
        const difficulte = document.getElementById('videoDifficulte').value;
        
        const questions = getVideoQuestions();
        
        if (!titre || !videoUrl) {
            showMessage('❌ Remplissez tous les champs obligatoires', 'error');
            return;
        }
        
        exercice = {
            type: 'video_questions',
            titre,
            videoUrl,
            questions: questions || [],
            difficulte
        };
    }

    try {
        if (currentExerciceIndex === null) {
            // ===== CRÉATION - Appeler POST /api/etape/:etapeId/exercice =====
            console.log('[EXERCICE-CREATE] Building etapeId from:', {selectedChapitreId, selectedEtapeIndex, selectedNiveau});
            
            // Get the actual etape ID from CHAPITRES
            const etape = chapitre.etapes?.[selectedEtapeIndex];
            if (!etape || !etape.id) {
                showMessage('❌ Étape introuvable', 'error');
                return;
            }
            
            const etapeId = etape.id;  // Use actual etape.id like "ch1_step1"
            
            console.log('[EXERCICE-CREATE] Posting to /api/etape/', etapeId, '/exercice');
            
            // ✅ Restructurer pour l'API: {type, titre, content}
            const apiPayload = {
                type: exercice.type,
                titre: exercice.titre,
                content: { ...exercice }  // Tout le reste dans content
            };
            
            // Retirer les champs dupliqués
            delete apiPayload.content.type;
            delete apiPayload.content.titre;
            
            console.log('[EXERCICE-CREATE] API Payload:', apiPayload);
            
            const response = await fetch(`/api/etape/${etapeId}/exercice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiPayload)
            });
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || `HTTP ${response.status}`);
            }
            
            const result = await response.json();
            console.log('[EXERCICE-CREATE] ✅ Exercice créé via API:', result.exercice);
            
            // ✅ Sauvegarder selectedEtapeIndex avant rechargement
            const savedEtapeIndex = selectedEtapeIndex;
            const savedChapitreId = selectedChapitreId;
            
            // Reload CHAPITRES from server to sync UI
            const chapResponse = await fetch('/api/chapitres');
            const chapData = await chapResponse.json();
            CHAPITRES = chapData.chapitres || chapData || [];
            
            // ✅ Restaurer les sélections
            selectedEtapeIndex = savedEtapeIndex;
            selectedChapitreId = savedChapitreId;
            
            showMessage('✅ Exercice créé', 'success');
        } else {
            // ===== MODIFICATION - Appeler PUT /api/exercice/:exerciceId =====
            const currentExercice = etape.exercices[currentExerciceIndex];
            const exerciceId = currentExercice.id;
            
            console.log('[EXERCICE-UPDATE] Putting to /api/exercice/', exerciceId);
            
            const response = await fetch(`/api/exercice/${exerciceId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(exercice)
            });
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || `HTTP ${response.status}`);
            }
            
            const result = await response.json();
            console.log('[EXERCICE-UPDATE] ✅ Exercice modifié via API:', result.exercice);
            
            // ✅ Sauvegarder selectedEtapeIndex avant rechargement
            const savedEtapeIndex = selectedEtapeIndex;
            const savedChapitreId = selectedChapitreId;
            
            // Reload CHAPITRES from server to sync UI
            const chapResponse = await fetch('/api/chapitres');
            const chapData = await chapResponse.json();
            CHAPITRES = chapData.chapitres || chapData || [];
            
            // ✅ Restaurer les sélections
            selectedEtapeIndex = savedEtapeIndex;
            selectedChapitreId = savedChapitreId;
            
            showMessage('✅ Exercice modifié', 'success');
        }
        
        closeExerciceModal();
        loadExercices(selectedChapitreId);
    } catch (error) {
        console.error('[EXERCICE-SAVE] ❌ Error:', error);
        showMessage(`❌ Erreur: ${error.message}`, 'error');
    }
}

async function deleteExercice(chapitreIndex, etapeIndex, exerciceIndex) {
    if (!confirm('⚠️ Êtes-vous sûr de vouloir supprimer cet exercice?')) return;
    
    try {
        // Get exercice ID from current CHAPITRES
        const chapitre = CHAPITRES[chapitreIndex];
        if (!chapitre) {
            showMessage('❌ Chapitre non trouvé', 'error');
            return;
        }
        
        const etape = chapitre.etapes?.[etapeIndex];
        if (!etape) {
            showMessage('❌ Étape non trouvée', 'error');
            return;
        }
        
        const exercice = etape.exercices?.[exerciceIndex];
        if (!exercice) {
            showMessage('❌ Exercice non trouvé', 'error');
            return;
        }
        
        const exerciceId = exercice.id;
        
        // Call DELETE /api/exercice/:exerciceId
        const response = await fetch(`/api/exercice/${exerciceId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || `HTTP ${response.status}`);
        }
        
        console.log('[EXERCICE-DELETE] ✅ Exercice supprimé via API:', exerciceId);
        
        // Reload CHAPITRES from server to sync UI
        const chapResponse = await fetch('/api/chapitres');
        const chapData = await chapResponse.json();
        CHAPITRES = chapData.chapitres || chapData || [];
        
        showMessage('✅ Exercice supprimé', 'success');
        loadExercices(selectedChapitreId);
    } catch (error) {
        console.error('[EXERCICE-DELETE] ❌ Error:', error);
        showMessage(`❌ Erreur: ${error.message}`, 'error');
    }
}

function closeExerciceModal() {
    document.getElementById('exerciceModal').style.display = 'none';
    document.getElementById('exerciceType').value = '';
    document.getElementById('exerciceFormContainer').innerHTML = '';
}

// =====================================================
// 🔧 FONCTIONS DE PARSING & HELPERS
// =====================================================

function parseFlashcardCartes(text) {
    return text.split('\n')
        .map(line => line.trim())
        .filter(line => line && line.includes('|'))
        .map(line => {
            const [recto, verso] = line.split('|').map(s => s.trim());
            return { recto, verso };
        });
}

function parseMatchingItems(gaucheText, droiteText) {
    const gauche = gaucheText.split('\n').map(l => l.trim()).filter(l => l);
    const droite = droiteText.split('\n').map(l => l.trim()).filter(l => l);
    
    const colonneGauche = gauche.map((texte, idx) => ({
        id: `item-${idx + 1}`,
        texte
    }));
    
    const colonneDroite = droite.map((texte, idx) => ({
        id: `ans-${idx + 1}`,
        texte
    }));
    
    const associations = colonneGauche.map((item, idx) => ({
        gauche: item.id,
        droite: colonneDroite[idx]?.id || `ans-${idx + 1}`
    }));
    
    return { colonneGauche, colonneDroite, associations };
}

function parseClassementItems(text) {
    return text.split('\n')
        .map(line => line.trim())
        .filter(line => line)
        .map((texte, idx) => ({
            id: `item-${idx + 1}`,
            texte,
            ordre: idx + 1
        }));
}

function buildTableauEditor(cols, rows) {
    const builder = document.getElementById('tableauBuilder');
    if (!builder) return;
    
    let html = '<div style="margin-top: 20px; overflow-x: auto;"><table style="border-collapse: collapse; width: 100%; font-size: 12px;">';
    
    // En-têtes de colonnes
    html += '<tr>';
    for (let c = 0; c < cols; c++) {
        html += `<th style="border: 1px solid #ddd; padding: 10px; background: #667eea; color: white;">
                    <input type="text" class="tableau-col-header" data-col="${c}" placeholder="Col ${c + 1}" style="width: 100%; padding: 5px; border: none; background: white; color: #333;" />
                 </th>`;
    }
    html += '</tr>';
    
    // Lignes
    for (let r = 0; r < rows; r++) {
        html += '<tr>';
        for (let c = 0; c < cols; c++) {
            const cellId = `tableau-cell-${r}-${c}`;
            html += `<td style="border: 1px solid #ddd; padding: 5px;">
                        <input type="text" id="${cellId}" class="tableau-cell" data-row="${r}" data-col="${c}" placeholder="Texte" 
                               style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 3px;" />
                        <label style="display: block; margin-top: 3px; font-size: 10px;">
                            <input type="checkbox" class="tableau-editable" data-row="${r}" data-col="${c}" /> Éditable
                        </label>
                     </td>`;
        }
        html += '</tr>';
    }
    
    html += '</table></div>';
    builder.innerHTML = html;
}

function parseTableauData() {
    const colonnes = [];
    const headers = document.querySelectorAll('.tableau-col-header');
    headers.forEach((h, i) => {
        colonnes.push(h.value || `Colonne ${i + 1}`);
    });
    
    const lignes = [];
    const cells = document.querySelectorAll('.tableau-cell');
    const maxRow = Math.max(...Array.from(cells).map(c => parseInt(c.dataset.row))) + 1;
    const maxCol = Math.max(...Array.from(cells).map(c => parseInt(c.dataset.col))) + 1;
    
    for (let r = 0; r < maxRow; r++) {
        const cellules = [];
        for (let c = 0; c < maxCol; c++) {
            const cell = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
            const editableCheck = document.querySelector(`.tableau-editable[data-row="${r}"][data-col="${c}"]`);
            
            cellules.push({
                contenu: cell ? cell.value : '',
                editable: editableCheck ? editableCheck.checked : false,
                reponse: cell ? cell.value : ''
            });
        }
        lignes.push({
            id: `row-${r + 1}`,
            cellules
        });
    }
    
    return { colonnes, lignes };
}

function addVideoQuestion() {
    const container = document.getElementById('videoQuestionsContainer');
    if (!container) return;
    
    const qId = 'q-' + Date.now();
    const qHtml = `
        <div class="video-question" id="${qId}" style="margin-bottom: 15px; padding: 10px; background: white; border-left: 3px solid #667eea; border-radius: 4px;">
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                <input type="text" placeholder="Timestamp (mm:ss)" class="video-question-timestamp" style="width: 100px; padding: 8px;" />
                <select class="video-question-type" style="padding: 8px;">
                    <option value="qcm_unique">QCM Unique</option>
                    <option value="texte">Texte</option>
                </select>
                <button type="button" class="btn btn-danger btn-sm" onclick="removeVideoQuestion('${qId}')" style="padding: 5px 10px;">✕</button>
            </div>
            <textarea class="video-question-content" placeholder="Question et réponses (format libre)" style="width: 100%; height: 80px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;"></textarea>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', qHtml);
}

function removeVideoQuestion(qId) {
    const el = document.getElementById(qId);
    if (el) el.remove();
}

function getVideoQuestions() {
    const questions = [];
    const items = document.querySelectorAll('.video-question');
    
    items.forEach((item, idx) => {
        const timestamp = item.querySelector('.video-question-timestamp').value || `00:${idx * 30}`;
        const type = item.querySelector('.video-question-type').value;
        const content = item.querySelector('.video-question-content').value;
        
        questions.push({
            id: `q-${idx + 1}`,
            timestamp,
            type,
            question: content.split('\n')[0] || 'Question',
            content
        });
    });
    
    return questions;
}

// =====================================================
// � FILTRAGE EXERCICES
// =====================================================

function filterExercicesByType(type) {
    const items = document.querySelectorAll('.exercice-item');
    let visibleCount = 0;
    
    items.forEach(item => {
        if (type === 'all' || item.dataset.exerciceType === type) {
            item.style.display = '';
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });
    
    console.log(`[FILTER] ${visibleCount} exercices affichés (type: ${type})`);
}

// =====================================================
// 👁️ APERÇU EXERCICE
// =====================================================

function previewExercice(exerciceIndex) {
    const response = fetch('data/chapitres.json');
    response.then(r => r.json()).then(chapitres => {
        if (!Array.isArray(chapitres)) chapitres = chapitres.chapitres || [];
        
        // Merger avec localStorage
        const saved = localStorage.getItem('CHAPITRES');
        if (saved) {
            const savedChapitres = JSON.parse(saved);
            const newOnes = savedChapitres.filter(sc => !chapitres.some(jc => jc.id === sc.id));
            chapitres = [...chapitres, ...newOnes];
        }
        
        const exercice = chapitres[currentChapitreIndex]?.etapes?.[currentEtapeIndex]?.exercices?.[exerciceIndex];
        if (!exercice) {
            showMessage('❌ Exercice introuvable', 'error');
            return;
        }
        
        let previewHTML = '';
        
        if (exercice.type === 'qcm_unique') {
            previewHTML = `
                <div class="preview-exercise">
                    <h3 class="preview-question">${exercice.question || 'Question'}</h3>
                    <div class="preview-options">
                        ${(exercice.reponses || [])
                            .map((r, i) => `<div class="preview-option">○ ${r}</div>`)
                            .join('')}
                    </div>
                    ${exercice.explication ? `<p class="preview-explication"><strong>💡 Explication:</strong> ${exercice.explication}</p>` : ''}
                    <p class="preview-meta">Difficulté: ${exercice.difficulte || 'Moyen'}</p>
                </div>
            `;
        } else if (exercice.type === 'qcm_multiple') {
            previewHTML = `
                <div class="preview-exercise">
                    <h3 class="preview-question">${exercice.question || 'Question'}</h3>
                    <div class="preview-options">
                        ${(exercice.reponses || [])
                            .map((r, i) => `<div class="preview-option">☑ ${typeof r === 'string' ? r : r.texte}</div>`)
                            .join('')}
                    </div>
                    ${exercice.explication ? `<p class="preview-explication"><strong>💡 Explication:</strong> ${exercice.explication}</p>` : ''}
                    <p class="preview-meta">Difficulté: ${exercice.difficulte || 'Moyen'}</p>
                </div>
            `;
        } else if (exercice.type === 'texte') {
            previewHTML = `
                <div class="preview-exercise">
                    <h3 class="preview-question">${exercice.question || 'Question'}</h3>
                    <p class="preview-instruction">Répondez par écrit ci-dessous:</p>
                    <textarea class="preview-textarea" placeholder="Votre réponse..." disabled></textarea>
                    ${(exercice.reponseAttendus && exercice.reponseAttendus[0]) ? `<p class="preview-explication"><strong>✓ Réponse attendue:</strong> ${exercice.reponseAttendus[0]}</p>` : ''}
                    <p class="preview-meta">Tolérance: ${exercice.tolerance || 'Exact'} | Difficulté: ${exercice.difficulte || 'Moyen'}</p>
                </div>
            `;
        } else if (exercice.type === 'photos') {
            previewHTML = `
                <div class="preview-exercise">
                    <h3 class="preview-question">${exercice.titre || 'Question'}</h3>
                    <p class="preview-instruction">${exercice.description || 'Identifiez les images:'}</p>
                    <div class="preview-photos">
                        ${(exercice.images || [])
                            .map(p => `
                                <div class="preview-photo-item">
                                    <img src="${p.url}" alt="${p.label}" onerror="this.src='assets/images/placeholder.png'" style="max-width: 100%; max-height: 150px;" />
                                    <p class="preview-photo-label">${p.label}</p>
                                </div>
                            `)
                            .join('')}
                    </div>
                    <p class="preview-meta">Difficulté: ${exercice.difficulte || 'Moyen'}</p>
                </div>
            `;
        } else if (exercice.type === 'flashcard') {
            previewHTML = `
                <div class="preview-exercise">
                    <h3 class="preview-question">${exercice.titre || 'Flashcard'}</h3>
                    <p style="color: #666; font-size: 13px; margin-bottom: 15px;">
                        ${exercice.langueRecto || 'Recto'} ↔ ${exercice.langueVerso || 'Verso'}
                    </p>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                        ${(exercice.cartes || []).slice(0, 3).map((carte, i) => `
                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
                                <div style="font-size: 12px; opacity: 0.8; margin-bottom: 10px;">${exercice.langueRecto || 'Recto'}</div>
                                <div style="font-size: 16px; font-weight: bold; margin-bottom: 15px;">${carte.recto}</div>
                                <div style="font-size: 12px; opacity: 0.8; margin-bottom: 10px;">${exercice.langueVerso || 'Verso'}</div>
                                <div style="font-size: 14px;">${carte.verso}</div>
                            </div>
                        `).join('')}
                    </div>
                    <p class="preview-meta">Total: ${(exercice.cartes || []).length} cartes | Difficulté: ${exercice.difficulte || 'Moyen'}</p>
                </div>
            `;
        } else if (exercice.type === 'dragdrop_matching') {
            previewHTML = `
                <div class="preview-exercise">
                    <h3 class="preview-question">${exercice.titre || 'Matching'}</h3>
                    <div style="display: flex; gap: 30px; margin: 20px 0;">
                        <div style="flex: 1;">
                            <h4 style="color: #667eea; margin-bottom: 10px;">Colonne 1</h4>
                            ${(exercice.colonneGauche || []).map((item, i) => `
                                <div style="padding: 10px; background: #f0f0f0; margin-bottom: 5px; border-radius: 4px;">
                                    ${i + 1}. ${item.texte}
                                </div>
                            `).join('')}
                        </div>
                        <div style="flex: 1;">
                            <h4 style="color: #667eea; margin-bottom: 10px;">Colonne 2</h4>
                            ${(exercice.colonneDroite || []).map((item, i) => `
                                <div style="padding: 10px; background: #f0f0f0; margin-bottom: 5px; border-radius: 4px;">
                                    ${i + 1}. ${item.texte}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <p class="preview-meta">Difficulté: ${exercice.difficulte || 'Moyen'}</p>
                </div>
            `;
        } else if (exercice.type === 'classement') {
            previewHTML = `
                <div class="preview-exercise">
                    <h3 class="preview-question">${exercice.titre || 'Classement'}</h3>
                    <p style="color: #666; font-style: italic; margin: 10px 0;">${exercice.instruction || ''}</p>
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 4px; margin: 15px 0;">
                        ${(exercice.items || []).map((item, i) => `
                            <div style="padding: 8px; background: white; margin-bottom: 5px; border-left: 3px solid #667eea; border-radius: 2px;">
                                <strong>${i + 1}.</strong> ${item.texte}
                            </div>
                        `).join('')}
                    </div>
                    <p class="preview-meta">Difficulté: ${exercice.difficulte || 'Moyen'}</p>
                </div>
            `;
        } else if (exercice.type === 'tableau') {
            const cols = (exercice.colonnes || []).length;
            const rows = (exercice.lignes || []).length;
            previewHTML = `
                <div class="preview-exercise">
                    <h3 class="preview-question">${exercice.titre || 'Tableau'}</h3>
                    <p style="color: #666; margin: 10px 0;">${exercice.instruction || ''}</p>
                    <div style="overflow-x: auto; margin: 15px 0;">
                        <table style="border-collapse: collapse; width: 100%; font-size: 12px;">
                            <tr>
                                ${(exercice.colonnes || []).map(col => `
                                    <th style="border: 1px solid #ddd; padding: 10px; background: #667eea; color: white;">
                                        ${col}
                                    </th>
                                `).join('')}
                            </tr>
                            ${(exercice.lignes || []).slice(0, 3).map(row => `
                                <tr>
                                    ${row.cellules.map(cell => `
                                        <td style="border: 1px solid #ddd; padding: 8px; background: ${cell.editable ? '#fffacd' : '#f9f9f9'};">
                                            ${cell.contenu || '...'}
                                        </td>
                                    `).join('')}
                                </tr>
                            `).join('')}
                        </table>
                    </div>
                    <p class="preview-meta">${cols} colonnes × ${rows} lignes | Difficulté: ${exercice.difficulte || 'Moyen'}</p>
                </div>
            `;
        } else if (exercice.type === 'video_questions') {
            previewHTML = `
                <div class="preview-exercise">
                    <h3 class="preview-question">${exercice.titre || 'Vidéo'}</h3>
                    <div style="background: #000; padding: 20px; border-radius: 8px; margin: 15px 0; aspect-ratio: 16/9; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px;">
                        🎥 Vidéo (${(exercice.questions || []).length} questions intégrées)
                    </div>
                    ${(exercice.questions || []).length > 0 ? `
                        <div style="background: #f9f9f9; padding: 15px; border-radius: 4px; margin: 15px 0;">
                            <h4 style="color: #333; margin-bottom: 10px;">Questions intégrées:</h4>
                            ${(exercice.questions || []).slice(0, 3).map((q, i) => `
                                <div style="padding: 8px; background: white; margin-bottom: 5px; border-left: 3px solid #667eea; border-radius: 2px; font-size: 12px;">
                                    <strong>⏱ ${q.timestamp}</strong> - ${q.type} <br/> ${q.question || 'Question'}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    <p class="preview-meta">Difficulté: ${exercice.difficulte || 'Moyen'}</p>
                </div>
            `;
        }
        
        document.getElementById('previewContent').innerHTML = previewHTML;
        document.getElementById('previewModal').style.display = 'flex';
        console.log('[PREVIEW] ✅ Aperçu affiché');
    });
}

function closePreviewModal() {
    document.getElementById('previewModal').style.display = 'none';
    document.getElementById('previewContent').innerHTML = '';
}

// =====================================================
// 🔄 DRAG & DROP RÉORDONNER
// =====================================================

let draggedItem = null;

function handleExerciceDragStart(e) {
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    console.log('[DRAG] Début du drag');
}

function handleExerciceDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (this !== draggedItem) {
        this.classList.add('drag-over');
    }
}

function handleExerciceDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleExerciceDrop(e) {
    e.preventDefault();
    
    if (this === draggedItem) return;
    
    // Récupérer les indices
    const draggedIndex = parseInt(draggedItem.dataset.exerciceIndex);
    const targetIndex = parseInt(this.dataset.exerciceIndex);
    
    // Charger et réorganiser
    fetch('data/chapitres.json')
        .then(r => r.json())
        .then(chapitres => {
            if (!Array.isArray(chapitres)) chapitres = chapitres.chapitres || [];
            
            // Merger avec localStorage
            const saved = localStorage.getItem('CHAPITRES');
            if (saved) {
                const savedChapitres = JSON.parse(saved);
                const newOnes = savedChapitres.filter(sc => !chapitres.some(jc => jc.id === sc.id));
                chapitres = [...chapitres, ...newOnes];
            }
            
            const exercices = chapitres[currentChapitreIndex].etapes[currentEtapeIndex].exercices;
            
            // Réorganiser: retirer et insérer
            const [moved] = exercices.splice(draggedIndex, 1);
            exercices.splice(targetIndex, 0, moved);
            
            // Sauvegarder
            localStorage.setItem('CHAPITRES', JSON.stringify(chapitres));
            
            console.log('[DRAG] ✅ Exercices réorganisés');
            showMessage('✅ Ordre réorganisé', 'success');
            
            // Recharger la liste
            loadExercices(currentChapitreIndex, currentEtapeIndex);
        });
}

function handleExerciceDragEnd(e) {
    draggedItem?.classList.remove('dragging');
    document.querySelectorAll('.exercice-item').forEach(item => {
        item.classList.remove('drag-over');
    });
}

// =====================================================
// 💾 EXPORT & IMPORT
// =====================================================

function exportChapitres() {
    fetch('data/chapitres.json')
        .then(r => r.json())
        .then(chapitres => {
            if (!Array.isArray(chapitres)) chapitres = chapitres.chapitres || [];
            
            // Merger avec localStorage
            const saved = localStorage.getItem('CHAPITRES');
            if (saved) {
                const savedChapitres = JSON.parse(saved);
                const newOnes = savedChapitres.filter(sc => !chapitres.some(jc => jc.id === sc.id));
                chapitres = [...chapitres, ...newOnes];
            }
            
            // Créer et télécharger
            const dataStr = JSON.stringify(chapitres, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `chapitres_export_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);
            
            console.log('[EXPORT] ✅ Données exportées');
            showMessage('✅ Données exportées avec succès', 'success');
        });
}

function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // Validation basique
            if (!Array.isArray(importedData)) {
                showMessage('❌ Format JSON invalide (doit être un tableau)', 'error');
                return;
            }
            
            // Merger avec les données existantes
            fetch('data/chapitres.json')
                .then(r => r.json())
                .then(chapitres => {
                    if (!Array.isArray(chapitres)) chapitres = chapitres.chapitres || [];
                    
                    // Ajouter les nouveaux chapitres
                    const newOnes = importedData.filter(ic => !chapitres.some(jc => jc.id === ic.id));
                    chapitres = [...chapitres, ...newOnes];
                    
                    // Sauvegarder
                    localStorage.setItem('CHAPITRES', JSON.stringify(chapitres));
                    
                    console.log('[IMPORT] ✅ Données importées');
                    showMessage(`✅ ${newOnes.length} chapitre(s) importé(s) avec succès`, 'success');
                    
                    // Recharger
                    loadChapitres();
                });
        } catch (error) {
            console.error('[IMPORT] ❌ Erreur:', error);
            showMessage('❌ Erreur lors de la lecture du fichier', 'error');
        }
    };
    
    reader.readAsText(file);
    
    // Réinitialiser l'input pour permettre la réimportation
    event.target.value = '';
}

// =====================================================
// 📋 TEMPLATES & THEMES - FUNCTIONS
// =====================================================

function showTemplatesModal() {
    if (currentChapitreIndex === null || currentEtapeIndex === null) {
        showMessage('📁 Sélectionnez un chapitre ET une étape d\'abord', 'error');
        return;
    }
    document.getElementById('templatesModal').style.display = 'flex';
    displayTemplates('all');
}

function closeTemplatesModal() {
    document.getElementById('templatesModal').style.display = 'none';
    selectedTemplateIndex = null;
}

function displayTemplates(type) {
    const container = document.getElementById('templatesContainer');
    container.innerHTML = '';
    
    const templates = type === 'all' ? EXERCISE_TEMPLATES : EXERCISE_TEMPLATES.filter(t => t.type === type);
    
    templates.forEach((template, idx) => {
        const realIdx = EXERCISE_TEMPLATES.findIndex(t => t === template);
        const card = document.createElement('div');
        card.className = `template-card ${selectedTemplateIndex === realIdx ? 'selected' : ''}`;
        card.onclick = () => selectTemplate(realIdx);
        
        card.innerHTML = `
            <div class="template-header">
                <h4 class="template-name">${template.name}</h4>
                <span class="template-type-badge">${template.type}</span>
            </div>
            <p class="template-description">${template.description || ''}</p>
        `;
        
        container.appendChild(card);
    });
}

function filterTemplates(type) {
    displayTemplates(type);
}

function selectTemplate(idx) {
    selectedTemplateIndex = idx;
    displayTemplates(document.getElementById('templateTypeFilter')?.value || 'all');
    
    const template = EXERCISE_TEMPLATES[idx];
    const preview = document.getElementById('templatePreview');
    if (preview) {
        preview.innerHTML = `
            <div class="template-preview">
                <h5>${template.name}</h5>
                <p><strong>Type:</strong> ${template.type}</p>
                <p><strong>Description:</strong> ${template.description || 'N/A'}</p>
                <pre>${JSON.stringify(template.template, null, 2)}</pre>
            </div>
        `;
        preview.classList.remove('hidden');
    }
}

function useSelectedTemplate() {
    if (selectedTemplateIndex === null) {
        showMessage('⚠️ Sélectionnez un template d\'abord', 'warning');
        return;
    }
    
    const template = EXERCISE_TEMPLATES[selectedTemplateIndex];
    loadExerciseFromTemplate(template);
    closeTemplatesModal();
    showMessage('✅ Template appliqué', 'success');
}

function loadExerciseFromTemplate(template) {
    const exerciceTypeSelect = document.getElementById('exerciceType');
    exerciceTypeSelect.value = template.type;
    selectExerciceType();
    
    // Pré-remplir selon le type
    const data = template.template;
    
    switch(template.type) {
        case 'qcm_unique':
            document.getElementById('qcmQuestion').value = data.question || '';
            const qcmReponsesContainer = document.getElementById('qcmReponsesContainer');
            if (qcmReponsesContainer) {
                qcmReponsesContainer.innerHTML = '';
                data.reponses.forEach((rep, i) => {
                    const div = document.createElement('div');
                    div.innerHTML = `
                        <input type="radio" name="qcmBonne" value="${i}" ${i === data.bonneReponse ? 'checked' : ''}>
                        <input type="text" value="${rep}" placeholder="Réponse ${i+1}">
                        <button onclick="this.parentElement.remove()">Supprimer</button>
                    `;
                    qcmReponsesContainer.appendChild(div);
                });
            }
            document.getElementById('qcmExplication').value = data.explication || '';
            document.getElementById('qcmDifficulte').value = data.difficulte || 'moyen';
            break;
            
        case 'qcm_multiple':
            document.getElementById('qcmQuestion').value = data.question || '';
            document.getElementById('qcmDifficulte').value = data.difficulte || 'difficile';
            break;
            
        case 'texte':
            document.getElementById('textQuestion').value = data.question || '';
            document.getElementById('textDifficulte').value = data.difficulte || 'moyen';
            break;
            
        case 'flashcard':
            document.getElementById('flashcardTitre').value = data.titre || '';
            document.getElementById('flashcardLangue1').value = data.langueRecto || 'Français';
            document.getElementById('flashcardLangue2').value = data.langueVerso || 'Anglais';
            break;
            
        case 'dragdrop_matching':
            document.getElementById('matchingTitre').value = data.titre || '';
            break;
            
        case 'classement':
            document.getElementById('classementTitre').value = data.titre || '';
            document.getElementById('classementInstruction').value = data.instruction || '';
            break;
            
        case 'tableau':
            document.getElementById('tableauTitre').value = data.titre || '';
            document.getElementById('tableauInstruction').value = data.instruction || '';
            break;
            
        case 'video':
            document.getElementById('videoUrl').value = data.url || '';
            document.getElementById('videoDuree').value = data.duree || '';
            break;
    }
}

function showChapterThemesModal() {
    if (currentChapitreIndex === null) {
        showMessage('📁 Sélectionnez un chapitre d\'abord', 'error');
        return;
    }
    document.getElementById('themesModal').style.display = 'flex';
    displayChapterThemes();
}

function closeThemesModal() {
    document.getElementById('themesModal').style.display = 'none';
    selectedThemeIndex = null;
}

function displayChapterThemes() {
    const container = document.getElementById('themesContainer');
    container.innerHTML = '';
    
    CHAPTER_THEMES.forEach((theme, idx) => {
        const card = document.createElement('div');
        card.className = `theme-card ${selectedThemeIndex === idx ? 'selected' : ''}`;
        card.onclick = () => selectChapterTheme(idx);
        
        card.innerHTML = `
            <h4 class="theme-title">${theme.name}</h4>
            <p class="theme-description">${theme.description}</p>
            <div class="theme-stats">
                <span class="theme-stat">📚 ${theme.chapitres[0].etapes.length} étapes</span>
                <span class="theme-stat">✏️ ${theme.chapitres[0].etapes.reduce((sum, e) => sum + e.exercices.length, 0)} exercices</span>
            </div>
        `;
        
        container.appendChild(card);
    });
}

function selectChapterTheme(idx) {
    selectedThemeIndex = idx;
    displayChapterThemes();
    
    const theme = CHAPTER_THEMES[idx];
    const preview = document.getElementById('themePreview');
    const createBtn = document.getElementById('createThemeBtn');
    
    if (preview) {
        const etapes = theme.chapitres[0].etapes;
        const totalExercices = etapes.reduce((sum, e) => sum + e.exercices.length, 0);
        
        preview.innerHTML = `
            <div class="theme-preview">
                <h5>${theme.name}</h5>
                <p>${theme.description}</p>
                <h6>Structure:</h6>
                <ul class="theme-preview-steps">
                    ${etapes.map(e => `<li>${e.titre} (${e.exercices.length} exercices)</li>`).join('')}
                </ul>
                <p><strong>Total:</strong> ${totalExercices} exercices</p>
            </div>
        `;
        preview.classList.remove('hidden');
    }
    
    // Activer le bouton de création
    if (createBtn) {
        createBtn.disabled = false;
    }
}

function createChapterFromTheme() {
    if (selectedThemeIndex === null) {
        showMessage('⚠️ Sélectionnez un thème d\'abord', 'warning');
        return;
    }
    
    const theme = CHAPTER_THEMES[selectedThemeIndex];
    const sourceChapter = theme.chapitres[0];
    
    // Créer une copie du chapitre avec un ID unique
    const newChapter = {
        id: generateId(),
        titre: sourceChapter.titre + ' - ' + new Date().getFullYear(),
        description: sourceChapter.description,
        ordre: chapitres.length,
        etapes: sourceChapter.etapes.map(etape => ({
            ...etape,
            id: generateId(),
            exercices: etape.exercices.map(exo => ({
                ...exo,
                id: generateId()
            }))
        }))
    };
    
    chapitres.push(newChapter);
    saveToLocalStorage();
    loadChapitres();
    closeThemesModal();
    showMessage(`✅ Chapitre "${newChapter.titre}" créé avec ${newChapter.etapes.length} étapes`, 'success');
}

// =====================================================
// ⚡ DUPLICATION RAPIDE - QUICK DUPLICATION
// =====================================================

function duplicateExercice(chapitreIdx, etapeIdx, exerciceIdx) {
    if (chapitreIdx === null || etapeIdx === null || exerciceIdx === null) {
        showMessage('⚠️ Sélectionnez un exercice d\'abord', 'warning');
        return;
    }
    
    const sourceExercice = chapitres[chapitreIdx].etapes[etapeIdx].exercices[exerciceIdx];
    
    // Créer une copie avec ID unique et titre modifié
    const newExercice = {
        ...JSON.parse(JSON.stringify(sourceExercice)), // Deep copy
        id: generateId(),
        titre: (sourceExercice.titre || sourceExercice.type) + ' (copie)'
    };
    
    chapitres[chapitreIdx].etapes[etapeIdx].exercices.push(newExercice);
    saveToLocalStorage();
    loadEtapes();
    showMessage(`✅ Exercice dupliqué: "${newExercice.titre}"`, 'success');
}

function duplicateEtape(chapitreIdx, etapeIdx) {
    if (chapitreIdx === null || etapeIdx === null) {
        showMessage('⚠️ Sélectionnez une étape d\'abord', 'warning');
        return;
    }
    
    const sourceEtape = chapitres[chapitreIdx].etapes[etapeIdx];
    
    // Créer une copie avec ID unique et titre modifié
    const newEtape = {
        ...JSON.parse(JSON.stringify(sourceEtape)), // Deep copy
        id: generateId(),
        titre: sourceEtape.titre + ' (copie)',
        exercices: sourceEtape.exercices.map(exo => ({
            ...exo,
            id: generateId()
        }))
    };
    
    chapitres[chapitreIdx].etapes.push(newEtape);
    saveToLocalStorage();
    loadEtapes();
    showMessage(`✅ Étape dupliquée: "${newEtape.titre}" avec ${newEtape.exercices.length} exercices`, 'success');
}

function duplicateChapitre(chapitreIdx) {
    if (chapitreIdx === null) {
        showMessage('⚠️ Sélectionnez un chapitre d\'abord', 'warning');
        return;
    }
    
    const sourceChapitre = chapitres[chapitreIdx];
    
    // Créer une copie avec ID unique et titre modifié
    const newChapitre = {
        ...JSON.parse(JSON.stringify(sourceChapitre)), // Deep copy
        id: generateId(),
        titre: sourceChapitre.titre + ' (copie)',
        etapes: sourceChapitre.etapes.map(etape => ({
            ...etape,
            id: generateId(),
            exercices: etape.exercices.map(exo => ({
                ...exo,
                id: generateId()
            }))
        }))
    };
    
    chapitres.push(newChapitre);
    saveToLocalStorage();
    loadChapitres();
    showMessage(`✅ Chapitre dupliqué: "${newChapitre.titre}" avec ${newChapitre.etapes.length} étapes`, 'success');
}

// =====================================================
// 📋 COPIER/COLLER - COPY/PASTE
// =====================================================

function copyExercice(chapitreIdx, etapeIdx, exerciceIdx) {
    if (chapitreIdx === null || etapeIdx === null || exerciceIdx === null) {
        showMessage('⚠️ Sélectionnez un exercice d\'abord', 'warning');
        return;
    }
    
    // Stocker l'exercice dans le presse-papiers interne
    window_CLIPBOARD = {
        type: 'exercice',
        data: JSON.parse(JSON.stringify(chapitres[chapitreIdx].etapes[etapeIdx].exercices[exerciceIdx]))
    };
    
    showMessage(`✅ Exercice copié: "${window_CLIPBOARD.data.titre || window_CLIPBOARD.data.type}"`, 'success');
}

function pasteExercice(chapitreIdx, etapeIdx) {
    if (window_CLIPBOARD === null || window_CLIPBOARD.type !== 'exercice') {
        showMessage('⚠️ Aucun exercice dans le presse-papiers', 'warning');
        return;
    }
    
    if (chapitreIdx === null || etapeIdx === null) {
        showMessage('⚠️ Sélectionnez une étape d\'abord', 'warning');
        return;
    }
    
    // Créer une nouvelle copie avec ID unique
    const pastedExercice = {
        ...JSON.parse(JSON.stringify(window_CLIPBOARD.data)),
        id: generateId(),
        titre: (window_CLIPBOARD.data.titre || window_CLIPBOARD.data.type) + ' (collé)'
    };
    
    chapitres[chapitreIdx].etapes[etapeIdx].exercices.push(pastedExercice);
    saveToLocalStorage();
    loadEtapes();
    showMessage(`✅ Exercice collé: "${pastedExercice.titre}"`, 'success');
}

function copyEtape(chapitreIdx, etapeIdx) {
    if (chapitreIdx === null || etapeIdx === null) {
        showMessage('⚠️ Sélectionnez une étape d\'abord', 'warning');
        return;
    }
    
    window_CLIPBOARD = {
        type: 'etape',
        data: JSON.parse(JSON.stringify(chapitres[chapitreIdx].etapes[etapeIdx]))
    };
    
    showMessage(`✅ Étape copiée: "${window_CLIPBOARD.data.titre}" (${window_CLIPBOARD.data.exercices.length} exercices)`, 'success');
}

function pasteEtape(chapitreIdx) {
    if (window_CLIPBOARD === null || window_CLIPBOARD.type !== 'etape') {
        showMessage('⚠️ Aucune étape dans le presse-papiers', 'warning');
        return;
    }
    
    if (chapitreIdx === null) {
        showMessage('⚠️ Sélectionnez un chapitre d\'abord', 'warning');
        return;
    }
    
    // Créer une nouvelle copie avec IDs uniques
    const pastedEtape = {
        ...JSON.parse(JSON.stringify(window_CLIPBOARD.data)),
        id: generateId(),
        titre: window_CLIPBOARD.data.titre + ' (collée)',
        exercices: window_CLIPBOARD.data.exercices.map(exo => ({
            ...exo,
            id: generateId()
        }))
    };
    
    chapitres[chapitreIdx].etapes.push(pastedEtape);
    saveToLocalStorage();
    loadEtapes();
    showMessage(`✅ Étape collée: "${pastedEtape.titre}" (${pastedEtape.exercices.length} exercices)`, 'success');
}

function copyChapitre(chapitreIdx) {
    if (chapitreIdx === null) {
        showMessage('⚠️ Sélectionnez un chapitre d\'abord', 'warning');
        return;
    }
    
    window_CLIPBOARD = {
        type: 'chapitre',
        data: JSON.parse(JSON.stringify(chapitres[chapitreIdx]))
    };
    
    showMessage(`✅ Chapitre copié: "${window_CLIPBOARD.data.titre}" (${window_CLIPBOARD.data.etapes.length} étapes)`, 'success');
}

function pasteChapitre() {
    if (window_CLIPBOARD === null || window_CLIPBOARD.type !== 'chapitre') {
        showMessage('⚠️ Aucun chapitre dans le presse-papiers', 'warning');
        return;
    }
    
    // Créer une nouvelle copie avec IDs uniques
    const pastedChapitre = {
        ...JSON.parse(JSON.stringify(window_CLIPBOARD.data)),
        id: generateId(),
        titre: window_CLIPBOARD.data.titre + ' (collé)',
        etapes: window_CLIPBOARD.data.etapes.map(etape => ({
            ...etape,
            id: generateId(),
            exercices: etape.exercices.map(exo => ({
                ...exo,
                id: generateId()
            }))
        }))
    };
    
    chapitres.push(pastedChapitre);
    saveToLocalStorage();
    loadChapitres();
    showMessage(`✅ Chapitre collé: "${pastedChapitre.titre}" (${pastedChapitre.etapes.length} étapes)`, 'success');
}

// Raccourcis clavier pour Copier/Coller
document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        // Copier l'exercice sélectionné
        if (currentExerciceIndex !== null && currentEtapeIndex !== null && currentChapitreIndex !== null) {
            copyExercice(currentChapitreIndex, currentEtapeIndex, currentExerciceIndex);
            event.preventDefault();
        }
    }
    
    if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        // Coller dans l'étape sélectionnée
        if (currentEtapeIndex !== null && currentChapitreIndex !== null && window_CLIPBOARD?.type === 'exercice') {
            pasteExercice(currentChapitreIndex, currentEtapeIndex);
            event.preventDefault();
        }
    }
});

// Mettre à jour la visibilité des boutons "Coller"
function updatePasteButtons() {
    const pasteChapitreBtn = document.getElementById('pasteChapitreBtn');
    const pasteEtapeBtn = document.getElementById('pasteEtapeBtn');
    const pasteExerciceBtn = document.getElementById('pasteExerciceBtn');
    
    if (pasteChapitreBtn) {
        pasteChapitreBtn.style.display = window_CLIPBOARD?.type === 'chapitre' ? 'inline-block' : 'none';
    }
    if (pasteEtapeBtn) {
        pasteEtapeBtn.style.display = (window_CLIPBOARD?.type === 'etape' && currentChapitreIndex !== null) ? 'inline-block' : 'none';
    }
    if (pasteExerciceBtn) {
        pasteExerciceBtn.style.display = (window_CLIPBOARD?.type === 'exercice' && currentChapitreIndex !== null && currentEtapeIndex !== null) ? 'inline-block' : 'none';
    }
}

// Appelé automatiquement après chaque copie
const originalCopyExercice = copyExercice;
const originalCopyEtape = copyEtape;
const originalCopyChapitre = copyChapitre;

function copyExercice_wrapper(chapitreIdx, etapeIdx, exerciceIdx) {
    originalCopyExercice(chapitreIdx, etapeIdx, exerciceIdx);
    updatePasteButtons();
}

function copyEtape_wrapper(chapitreIdx, etapeIdx) {
    originalCopyEtape(chapitreIdx, etapeIdx);
    updatePasteButtons();
}

function copyChapitre_wrapper(chapitreIdx) {
    originalCopyChapitre(chapitreIdx);
    updatePasteButtons();
}

// Remplacer les appels aux fonctions de copie
copyExercice = copyExercice_wrapper;
copyEtape = copyEtape_wrapper;
copyChapitre = copyChapitre_wrapper;

// =====================================================
// �📝 GESTION EXERCICES
// =====================================================

async function loadExercices() {
    console.log('[EXERCICES] Chargement des exercices...');
    showMessage('✏️ Sélectionnez une étape pour voir ses exercices', 'info');
}

// =====================================================
// 🚀 INITIALISATION
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('[INIT] Admin panel initialized');
    
    // Vérifier si déjà authentifié (optionnel)
    // (On pourrait utiliser sessionStorage ici)
});
