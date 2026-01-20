/**
 * App.js - Contrôleur Principal
 * Gère: Routing, pages, gamification
 */

// ═══════════════════════════════════════════════════════════════
// IMPORTS ET INSTANCES GLOBALES
// ═══════════════════════════════════════════════════════════════

// Modules d'exercices (désactivés - logique intégrée dans app.js)
// const exerciseLoader = new ExerciseLoader();
// const exerciseValidator = new ExerciseValidator();
// const exerciseNormalizer = new ExerciseNormalizer();

// 🔒 FLAGS POUR PRÉVENIR RACE CONDITIONS
let isFlashcardsProcessing = false;  // Prévient double-click flashcards
let isEtapeProcessing = false;       // Prévient double-click navigation

// 🏠 DÉTECTION MODE LOCAL vs SERVEUR
// GitHub Pages utilise https:// mais pas de serveur backend
const IS_LOCAL_MODE = window.location.protocol === 'file:' || !window.location.hostname.includes('localhost');
const API_BASE = window.location.hostname.includes('localhost') ? 'http://localhost:3000' : '';
Logger.debug(`[MODE] ${IS_LOCAL_MODE ? '🏠 LOCAL (sans serveur - GitHub Pages ou file://)' : '🌐 SERVEUR (Node.js actif)'}`);
if (IS_LOCAL_MODE) {
    Logger.debug('[LOCAL] Lecture directe depuis data/chapitres.js embarqué');
}

// ═══════════════════════════════════════════════════════════════
// CHARGE DES DONNÉES ET FONCTIONS UTILITAIRES
// ═══════════════════════════════════════════════════════════════

/**
 * Charge les données des chapitres depuis les nouvelles API
 */
async function loadChapitres(niveauId = 'N1') {
    try {
        let chapitres = [];
        
        // ═══ MODE LOCAL : Charger depuis chapitres.js embarqué ═══
        if (IS_LOCAL_MODE) {
            Logger.debug(`[LOCAL] Chargement chapitres niveau ${niveauId} depuis données embarquées...`);
            
            // Vérifier que CHAPITRES_DATA existe (chargé depuis chapitres.js)
            if (typeof CHAPITRES_DATA === 'undefined') {
                throw new Error('CHAPITRES_DATA non trouvé. Assurez-vous que data/chapitres.js est inclus dans index.html');
            }
            
            const allChapitres = CHAPITRES_DATA.chapitres || [];
            
            // Filtrer par niveau côté client
            chapitres = allChapitres.filter(ch => ch.niveau === niveauId);
            
            Logger.debug(`✅ [LOCAL] ${chapitres.length} chapitres niveau ${niveauId} chargés depuis données embarquées`);
        } 
        // ═══ MODE SERVEUR : Charger depuis API ═══
        else {
            Logger.debug(`[SERVEUR] Chargement chapitres niveau ${niveauId} depuis API...`);
            
            // Charger depuis la nouvelle API: GET /api/niveaux/:niveauId/chapitres
            const response = await fetch(`${API_BASE}/api/niveaux/${niveauId}/chapitres`);
            if (!response.ok) throw new Error(`Erreur chargement chapitres: ${response.status}`);
            
            const data = await response.json();
            if (!data.success) throw new Error(data.message || 'Erreur API');
            
            chapitres = data.chapitres || [];
            Logger.debug(`✅ [SERVEUR] ${chapitres.length} chapitres niveau ${niveauId} chargés depuis API`);
        }
        
        // ✅ CHARGER ET ATTACHER LES EXERCICES À CHAQUE CHAPITRE
        // Note: En mode local, exercices déjà imbriqués dans chapitres
        // En mode serveur, on pourrait charger depuis API exercices (optionnel si déjà imbriqués)
        Logger.debug('📚 Vérification exercices attachés...');
        for (let chapitre of chapitres) {
            // Vérifier que chaque étape a ses exercices
            if (chapitre.etapes) {
                for (let etape of chapitre.etapes) {
                    if (!etape.exercices) etape.exercices = [];
                }
            }
        }
        
        // ✅ INITIALISER localStorage APRÈS chargement
        // ✅ INITIALISER localStorage APRÈS chargement
        for (let chapitre of chapitres) {
            initializeChapterStorage(chapitre);
            // ✅ VALIDER ET NETTOYER les données suspectes
            validateAndCleanStorage(chapitre);
        }
        
        // ✅ EXERCICES DÉJÀ IMBRIQUÉS dans chapitres.json (OPTION B)
        Logger.debug('✅ Exercices déjà attachés aux chapitres');
        Logger.debug(`📊 Chapitres du niveau ${niveauId} avec exercices:`, chapitres);
        
        return chapitres;
    } catch (apiError) {
        Logger.error('[PLAYER] ❌ Erreur chargement chapitres:', apiError.message);
        
        // Mode local : pas de fallback nécessaire
        if (IS_LOCAL_MODE) {
            alert('❌ Erreur chargement données. Vérifiez que data/chapitres.js existe.');
            return [];
        }
        
        // Mode serveur : tentative fallback localStorage
        Logger.warn('[PLAYER] ⚠️ API échouée, tentative fallback localStorage...');
        
        // ═══════════════════════════════════════════════════════════
        // FALLBACK 1: localStorage['CHAPITRES_AUTEUR'] (Data Admin)
        // ═══════════════════════════════════════════════════════════
        try {
            Logger.debug('[PLAYER] 📦 Fallback 1: Cherche CHAPITRES_AUTEUR...');
            const authorDataRaw = localStorage.getItem('CHAPITRES_AUTEUR');
            
            if (authorDataRaw) {
                const authorData = JSON.parse(authorDataRaw);
                
                if (Array.isArray(authorData) && authorData.length > 0) {
                    Logger.debug(`[PLAYER] ✅ Fallback 1 SUCCESS: ${authorData.length} chapitres depuis Admin`);
                    
                    // Initialiser & valider
                    for (let chapitre of authorData) {
                        initializeChapterStorage(chapitre);
                        validateAndCleanStorage(chapitre);
                    }
                    
                    // Exercices déjà imbriqués (pas de normalisation nécessaire)
                    Logger.debug(`[PLAYER] ✅ Chapitres Admin prêts (exercices imbriqués)`);
                    return authorData;
                }
            }
            throw new Error('CHAPITRES_AUTEUR vide ou invalide');
            
        } catch (fallback1Error) {
            Logger.warn('[PLAYER] ⚠️ Fallback 1 échoué:', fallback1Error.message);
            
            // ═══════════════════════════════════════════════════════════
            // FALLBACK 2: localStorage['CHAPITRES'] (Legacy format)
            // ═══════════════════════════════════════════════════════════
            try {
                Logger.debug('[PLAYER] 📦 Fallback 2: Cherche CHAPITRES (legacy)...');
                const legacyDataRaw = localStorage.getItem('CHAPITRES');
                
                if (legacyDataRaw) {
                    const legacyData = JSON.parse(legacyDataRaw);
                    
                    if (Array.isArray(legacyData) && legacyData.length > 0) {
                        Logger.debug(`[PLAYER] ✅ Fallback 2 SUCCESS: ${legacyData.length} chapitres depuis legacy`);
                        
                        // Initialiser & valider
                        for (let chapitre of legacyData) {
                            initializeChapterStorage(chapitre);
                            validateAndCleanStorage(chapitre);
                        }
                        
                        // Normaliser
                        const normalized = legacyData; // Exercices déjà imbriqués
                        Logger.debug(`[PLAYER] ✅ Chapitres legacy normalisés et prêts`);
                        return normalized;
                    }
                }
                throw new Error('CHAPITRES (legacy) vide ou invalide');
                
            } catch (fallback2Error) {
                Logger.error('[PLAYER] ❌ TOUS LES FALLBACKS ÉCHOUÉS');
                Logger.debug('[PLAYER] 💡 Solutions:');
                Logger.debug('   1. Lancer admin.html pour créer du contenu');
                Logger.debug('   2. Vérifier que admin.html a sauvegardé des données');
                Logger.debug('   3. Importer des chapitres JSON');
                Logger.debug('   4. Déployer backend API');
                
                // Fallback final: array vide
                return [];
            }
        }
    }
}

/**
 * Vérifie si un niveau est déverrouillé
 * 
 * Règles de déblocage:
 * - N1: Toujours déverrouillé ✅
 * - N2: Déverrouillé si N1.completion === 100%
 * - N3: Déverrouillé si N2.completion === 100%
 * - N4: Déverrouillé si N3.completion === 100%
 * 
 * @param {string} niveauId - ID du niveau ('N1', 'N2', 'N3', 'N4')
 * @returns {boolean} true si déverrouillé, false si verrouillé
 */
function isNiveauUnlocked(niveauId) {
    try {
        const unlocked = StorageManager.isNiveauUnlocked(niveauId);
        const status = unlocked ? '✅ Déverrouillé' : '🔒 Verrouillé';
        Logger.debug(`🔓 Niveau ${niveauId}: ${status}`);
        return unlocked;
    } catch (error) {
        Logger.error(`❌ Erreur vérification déblocage ${niveauId}:`, error);
        return false;
    }
}

/**
 * Compte le nombre réel de chapitres pour un niveau
 * Lit depuis les données JSON, pas depuis StorageManager
 * 
 * @async
 * @param {string} niveauId - ID du niveau ('N1', 'N2', etc.)
 * @returns {Promise<number>} Nombre de chapitres
 */
async function getChapitresCount(niveauId) {
    try {
        const response = await fetch(`/api/niveaux/${niveauId}/chapitres`);
        if (!response.ok) throw new Error(`Erreur chargement chapitres niveau ${niveauId}`);
        
        const data = await response.json();
        const niveau = data.niveaux.find(n => n.id === niveauId);
        const count = niveau?.chapitres?.length || 0;
        
        Logger.debug(`📊 Chapitres ${niveauId}: ${count}`);
        return count;
    } catch (error) {
        Logger.error(`❌ Erreur getChapitresCount(${niveauId}):`, error);
        return 0;
    }
}

/**
 * Obtient l'état d'un niveau avec complétude
 * 
 * @param {string} niveauId - ID du niveau
 * @returns {Object} { unlocked: boolean, completion: number, chapitres: number }
 */
function getNiveauState(niveauId) {
    try {
        // 🔧 FIX: Calculer la completion en temps réel depuis chaptersProgress
        const completion = StorageManager.calculateNiveauCompletion(niveauId);
        
        return {
            unlocked: isNiveauUnlocked(niveauId),
            completion: completion,
            chapitres: 0  // Sera mis à jour dynamiquement par afficherNiveaux
        };
    } catch (error) {
        Logger.error(`❌ Erreur récupération état ${niveauId}:`, error);
        return { unlocked: false, completion: 0, chapitres: 0 };
    }
}

/**
 * Affiche les 4 niveaux avec cartes interactives
 * Génère HTML avec progress ring SVG, titre, description, statut
 * 
 * @async
 * @returns {Promise<string>} HTML des 4 niveaux
 */
async function afficherNiveaux() {
    try {
        // 1. Charger depuis API
        const response = await fetch('/api/niveaux');
        if (!response.ok) throw new Error('Erreur chargement niveaux');
        
        const data = await response.json();
        
        // 🌉 Sauvegarder les données pour les bridge functions
        window.allNiveaux = {};
        data.niveaux.forEach(niveau => {
            window.allNiveaux[niveau.id] = niveau.chapitres || [];
        });
        window.niveauxData = data.niveaux;  // Aussi sauvegarder les données complètes
        
        // 2. Vérifier structure
        if (!data.niveaux || !Array.isArray(data.niveaux)) {
            throw new Error('Structure niveaux invalide dans JSON');
        }
        
        // 3. Générer HTML des 4 niveaux
        let html = '<div class="niveaux-section">\n';
        html += '<h2>🎯 Niveaux de Formation</h2>\n';
        html += '<div class="niveaux-grid">\n';
        
        const niveaux = ['N1', 'N2', 'N3', 'N4'];
        
        niveaux.forEach(niveauId => {
            // Récupérer l'état du niveau
            const state = getNiveauState(niveauId);
            
            // Récupérer les infos du JSON
            const niveauData = data.niveaux.find(n => n.id === niveauId);
            const titre = niveauData?.titre || `Niveau ${niveauId}`;
            const description = niveauData?.description || 'Compétences essentielles';
            const couleur = niveauData?.couleur || 'E0AAFF';
            
            // 🔧 FIX: Compter les chapitres RÉELS depuis les données, pas depuis StorageManager
            const chapitresCount = niveauData?.chapitres?.length || 0;
            
            // Calculer offset du progress ring (circumference = 2*π*r = 2*π*54 ≈ 339)
            const circumference = 2 * Math.PI * 54;
            const strokeDashoffset = circumference * (100 - state.completion) / 100;
            
            Logger.debug(`📊 Niveau ${niveauId}: ${chapitresCount} chapitres (réels)`);
            
            // Générer HTML carte
            html += `
    <div class="niveau-card" data-niveau="${niveauId}" data-locked="${!state.unlocked}">
        <div class="niveau-header">
            <h3>${niveauId}</h3>
            <span class="niveau-status">${state.unlocked ? '✅' : '🔒'}</span>
        </div>
        
        <h4>${titre}</h4>
        <p class="niveau-description">${description}</p>
        
        <!-- Progress Ring SVG -->
        <svg class="progress-ring" viewBox="0 0 120 120" width="120" height="120">
            <circle cx="60" cy="60" r="54" class="progress-background" />
            <circle cx="60" cy="60" r="54" class="progress-fill" 
                    style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${strokeDashoffset};" />
            <text x="60" y="70" class="progress-text" text-anchor="middle">${state.completion}%</text>
        </svg>
        
        <div class="niveau-stats">
            <p class="stat"><strong>${chapitresCount}</strong> chapitres</p>
            <p class="stat"><strong>${state.completion}%</strong> complété</p>
        </div>
        
        <div class="niveau-footer">
            ${state.unlocked 
                ? `<button class="btn btn--primary btn--small" onclick="App.afficherNiveau('${niveauId}')">Commencer</button>`
                : `<button class="btn btn--disabled" disabled>Verrouillé</button>`
            }
            ${!state.unlocked 
                ? `<p class="unlock-message">🔒 Déblocage: Complétez N${parseInt(niveauId.slice(1))-1} à 100%</p>`
                : ''
            }
        </div>
    </div>
`;
        });
        
        html += '</div>\n</div>\n';
        
        Logger.debug('✅ Niveaux HTML générés');
        return html;
        
    } catch (error) {
        Logger.error('❌ Erreur afficherNiveaux():', error);
        return '<p class="error">Erreur chargement des niveaux</p>';
    }
}

/**
 * ════════════════════════════════════════════════════════════════════
 * LOCALSTORAGE INITIALIZATION & MANAGEMENT
 * ════════════════════════════════════════════════════════════════════
 */

/**
 * Initialise localStorage pour un chapitre
 * Crée les clés pour chaque étape avec structure par défaut
 * N'écrase PAS les données existantes
 * 
 * @param {Object} chapitre - Le chapitre à initialiser
 */
function initializeChapterStorage(chapitre) {
    if (!chapitre || !chapitre.etapes) {
        Logger.warn(`⚠️ Chapitre invalide pour initialisation localStorage:`, chapitre);
        return;
    }
    
    const chapitreId = chapitre.id;
    let stepsInitialized = 0;
    
    // ✅ Parcourir toutes les étapes du chapitre
    chapitre.etapes.forEach((etape, index) => {
        const stepKey = `step_${etape.id}`;
        
        // ✅ Ne CRÉER que si n'existe pas déjà
        if (localStorage.getItem(stepKey) === null) {
            const defaultStepData = {
                id: etape.id,
                chapitreId: chapitreId,
                completed: false,                    // ← Première étape NOT locked
                points: 0,
                maxPoints: etape.points || 10,
                timestamp: null,                     // Date de complétude
                attempts: 0,                         // Nombre de tentatives
                lastAttempt: null                    // Date dernière tentative
            };
            
            try {
                localStorage.setItem(stepKey, JSON.stringify(defaultStepData));
                stepsInitialized++;
            } catch (e) {
                Logger.error(`❌ Erreur écriture localStorage pour ${stepKey}:`, e);
            }
        }
    });
    
    // ✅ Créer aussi la clé du chapitre si n'existe pas
    const chapitreKey = `chapter_${chapitreId}`;
    if (localStorage.getItem(chapitreKey) === null) {
        const defaultChapterData = {
            id: chapitreId,
            titre: chapitre.titre,
            completed: false,
            totalSteps: chapitre.etapes.length,
            completedSteps: 0,
            totalPoints: 0,
            startedAt: new Date().toISOString()
        };
        
        try {
            localStorage.setItem(chapitreKey, JSON.stringify(defaultChapterData));
        } catch (e) {
            Logger.error(`❌ Erreur écriture localStorage pour ${chapitreKey}:`, e);
        }
    }
    
    Logger.debug(`✅ localStorage initialisé pour ${chapitreId}: ${stepsInitialized} étapes créées`);
}

/**
 * ✅ VALIDATION: Nettoie les données localStorage corrompues
 * PROBLÈME: L'ancien code auto-complétait tous les steps, 
 * ce qui laisse localStorage avec completed=true pour tout.
 * Cette fonction détecte et nettoie les données suspectes.
 */
function validateAndCleanStorage(chapitre) {
    if (!chapitre || !chapitre.etapes) return;
    
    const chapitreId = chapitre.id;
    let completedCount = 0;
    let suspiciousSteps = [];
    
    // Compter combien de steps sont marqués comme complétés
    chapitre.etapes.forEach((etape, index) => {
        const stepKey = `step_${etape.id}`;
        const stored = localStorage.getItem(stepKey);
        
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed.completed === true) {
                    completedCount++;
                    suspiciousSteps.push({
                        id: etape.id,
                        type: etape.type,
                        index: index
                    });
                }
            } catch (e) {
                // Ignorer les erreurs de parsing
            }
        }
    });
    
    // 🚨 DÉTECTION: Si plus de 70% des steps sont complétés, c'est probablement une corruption
    // (Les utilisateurs réels ne complètent pas 5+ steps sans jamais relancer le navigateur)
    const suspiciousRatio = completedCount / chapitre.etapes.length;
    
    if (suspiciousRatio > 0.6) {
        Logger.warn(`⚠️ DÉTECTION: ${completedCount}/${chapitre.etapes.length} steps marqués comme complétés`);
        Logger.warn(`   → Ratio suspect: ${(suspiciousRatio * 100).toFixed(0)}% (seuil: 60%)`);
        Logger.warn(`   → Réinitialisant tous les steps pour ${chapitreId}...`);
        
        // Réinitialiser TOUS les steps
        chapitre.etapes.forEach((etape) => {
            const stepKey = `step_${etape.id}`;
            const cleanData = {
                id: etape.id,
                chapitreId: chapitreId,
                completed: false,  // ← RESET to incomplete
                points: 0,
                maxPoints: etape.points || 10,
                timestamp: null,
                attempts: 0,
                lastAttempt: null
            };
            localStorage.setItem(stepKey, JSON.stringify(cleanData));
        });
        
        Logger.debug(`✅ localStorage nettoyé pour ${chapitreId}`);
    }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * SYSTÈME DE VERROUS D'ÉTAPES - PROGRESSION SÉQUENTIELLE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Détermine l'état de verrouillage d'une étape selon les règles :
 * 1. Nouvelle chapitre: 1ère étape déverrouillée, autres verrouillées
 * 2. Objectifs complétés: Étape 1 active, autres verrouillées
 * 3. Étape N complétée: Étape N+1 déverrouillée, autres verrouillées
 * 4. Toutes étapes complétées: Seul Portfolio reste actif
 * 5. Portfolio complété: Tous les états = "completed", chapitre.completed = true
 */

/**
 * Détermine l'état de verrou d'une étape
 * 
 * @param {Object} chapitre - L'objet chapitre contenant les étapes
 * @param {number} etapeIndex - Index de l'étape à vérifier (0-based)
 * @param {string} chapitreId - ID du chapitre (optionnel, pour logs)
 * @returns {string} 'completed' | 'active' | 'locked'
 * 
 * Logique:
 * - 'completed': L'étape est complétée (✅)
 * - 'active': L'étape est déverrouillée et peut être utilisée (⚡)
 * - 'locked': L'étape est verrouillée (🔒)
 */
function getStepLockState(chapitre, etapeIndex, chapitreId = '') {
    if (!chapitre || !chapitre.etapes || etapeIndex < 0 || etapeIndex >= chapitre.etapes.length) {
        Logger.warn(`⚠️ getStepLockState: Paramètres invalides (index=${etapeIndex}, total=${chapitre?.etapes?.length})`);
        return 'locked';
    }
    
    const etapeActuelle = chapitre.etapes[etapeIndex];
    
    // Rule: Si l'étape est déjà complétée (vérifier aussi localStorage)
    const etapeState = StorageManager?.loadEtapeState?.(chapitreId, etapeIndex);
    if (etapeActuelle.completed === true || etapeState?.completed === true) {
        return 'completed';
    }
    
    // Rule: 🔓 FIX OPTION B - La première étape (index 0) nécessite les OBJECTIFS VISUELS complétés
    // Les objectifs visuels sont un jalon SVG séparé, pas dans chapitre.etapes[]
    // On vérifie via StorageManager.getObjectifsStatus() ou chapitre.objectifsCompleted
    if (etapeIndex === 0) {
        // Première vraie étape: Vérifier si les objectifs (jalon visuel) sont complétés
        const objectifsStatus = StorageManager?.getObjectifsStatus?.(chapitreId);
        if (objectifsStatus?.completed === true || chapitre.objectifsCompleted === true) {
            return 'active';
        } else {
            // Par défaut, la première étape est active si pas d'objectifs ou objectifs pas tracké
            // Ceci permet le fonctionnement même si getObjectifsStatus n'existe pas
            return 'active';  // La première étape doit être accessible
        }
    }
    
    // Rule: Pour les autres étapes (index >= 1), vérifier si l'étape précédente est complétée
    const etapePrecedente = chapitre.etapes[etapeIndex - 1];
    const etapePrecState = StorageManager?.loadEtapeState?.(chapitreId, etapeIndex - 1);
    if (etapePrecedente?.completed === true || etapePrecState?.completed === true) {
        return 'active';
    }
    
    // Par défaut: verrouillée si l'étape précédente n'est pas complétée
    return 'locked';
}

/**
 * Met à jour les icônes visuelles et états de toutes les étapes d'un chapitre
 * Applique les classes CSS correspondant à leur état de verrou
 * 
 * @param {string} chapitreId - ID du chapitre
 * @param {Object} chapitre - L'objet chapitre (optionnel, récupéré si non fourni)
 */
function updateStepIcons(chapitreId, chapitre = null) {
    // ⏸️ FIX CRITICAL: Délai augmenté de 100ms → 200ms pour garantir localStorage sync
    // Cela élimine la boucle infinie de retries qui causait 20+ warnings en cascade
    setTimeout(() => {
        // Vérifier que StorageManager est bien prêt avant de lire
        const testState = StorageManager.getEtapeState(chapitreId, 0);
        
        if (!testState && chapitre) {
            console.debug('ℹ️ updateStepIcons: Réessai après 100ms (attente localStorage sync)');
            // Retry UNE SEULE FOIS après 100ms supplémentaires
            setTimeout(() => updateStepIcons(chapitreId, chapitre), 100);
            return;
        }
        
        // Récupérer le chapitre si non fourni
        if (!chapitre) {
            if (CHAPITRES && Array.isArray(CHAPITRES)) {
                chapitre = CHAPITRES.find(ch => ch.id === chapitreId);
            }
            if (!chapitre && window.allNiveaux) {
                for (let niveauId in window.allNiveaux) {
                    const chapitres = window.allNiveaux[niveauId];
                    if (Array.isArray(chapitres)) {
                        chapitre = chapitres.find(ch => ch.id === chapitreId);
                        if (chapitre) break;
                    }
                }
            }
        }
        
        if (!chapitre) {
            Logger.error(`❌ updateStepIcons: Chapitre ${chapitreId} non trouvé`);
            return;
        }
        
        Logger.debug(`🔄 updateStepIcons: Updating icons for ${chapitreId} (localStorage verified)`);
        
        // Récupérer tous les éléments step-group du SVG
        const stepGroups = document.querySelectorAll('.step-group');
        if (stepGroups.length === 0) {
            Logger.warn(`⚠️ updateStepIcons: Aucun step-group trouvé dans le DOM`);
            return;
        }
        
        // ✅ FIX OPTION B: Compteur d'étapes réelles - index 0 dans JSON = première vraie étape
        let etapeIndex = 0;
        
        stepGroups.forEach((el, groupIndex) => {
            const isObjectives = el.dataset.isObjectives === 'true';
            const isPortfolio = el.dataset.isPortfolio === 'true';
            const isMidpoint = el.dataset.isMidpoint === 'true';
            
            let state = 'locked';
            let emoji = '🔒';
            
            // Les jalons spéciaux (objectifs/portfolio) sont des jalons VISUELS, pas dans chapitre.etapes[]
            if (isObjectives) {
                // ✅ FIX: Les objectifs visuels utilisent un storage séparé (pas loadEtapeState(0)!)
                const objectifState = StorageManager?.getObjectifsStatus?.(chapitreId);
                
                if (objectifState?.completed === true || chapitre.objectifsCompleted === true) {
                    state = 'completed';
                    emoji = '✅';
                } else {
                    // Les objectifs sont toujours actifs au départ (premier jalon cliquable)
                    state = 'active';
                    emoji = '📋';  // Emoji spécial pour objectifs non complétés
                }
                Logger.debug(`  Objectifs (jalon visuel): state=${state}`);
            } else if (isPortfolio) {
                // ✅ CHARGER STATE DEPUIS localStorage
                const portfolioState = StorageManager?.getPortfolioStatus?.(chapitreId);
                const allStepsCompleted = chapitre.etapes.every((e, idx) => {
                    const stepState = StorageManager?.loadEtapeState?.(chapitreId, idx);
                    return stepState?.completed === true || e.completed === true;
                });
                const portfolioCompleted = portfolioState?.completed === true || chapitre.portfolioCompleted === true;
                
                if (!allStepsCompleted) {
                    state = 'locked';
                    emoji = '🔒';
                } else if (!portfolioCompleted) {
                    state = 'active';
                    emoji = '🎯';  // Emoji spécial pour portfolio actif
                } else {
                    state = 'completed';
                    emoji = '✅';
                }
                Logger.debug(`  Portfolio: allCompleted=${allStepsCompleted}, portfolioCompleted=${portfolioCompleted}`);
            } 
            // Étapes normales (correspondent directement à chapitre.etapes[])
            else {
                // ✅ FIX OPTION B: etapeIndex correspond DIRECTEMENT à chapitre.etapes[etapeIndex]
                if (etapeIndex < chapitre.etapes.length) {
                    // Charger depuis localStorage D'ABORD
                    const etapeState = StorageManager?.loadEtapeState?.(chapitreId, etapeIndex);
                    const isCompleted = etapeState?.completed === true || chapitre.etapes[etapeIndex]?.completed === true;
                    
                    state = getStepLockState(chapitre, etapeIndex, chapitreId);
                    
                    // Si localStorage dit completed, forcer completed
                    if (isCompleted) {
                        state = 'completed';
                    }
                    
                    // Assigner le bon emoji selon l'état
                    if (state === 'completed') {
                        emoji = '✅';
                    } else if (state === 'active') {
                        emoji = '⚡';
                    } else if (state === 'locked') {
                        emoji = '🔒';
                    }
                    
                    Logger.debug(`  Étape ${etapeIndex} (${chapitre.etapes[etapeIndex]?.titre}): state=${state}`);
                    etapeIndex++;
                }
            }
            
            // ✅ METTRE À JOUR data-state
            el.dataset.state = state;
            
            // ✅ CHANGER LE SYMBOLE EMOJI DYNAMIQUEMENT
            const emojiElement = el.querySelector('.step-emoji');
            if (emojiElement) {
                emojiElement.textContent = emoji;
            }
            
            // ✅ GÉRER LES CLASSES CSS
            el.classList.remove('completed', 'active', 'locked');
            el.classList.add(state);
            
            // ✅ METTRE À JOUR LE FILL DU RECT (CSS cascade fix)
            const rectElement = el.querySelector('.step-box');
            if (rectElement) {
                const colors = {
                    'completed': '#22c55e',  // Green
                    'active': '#f97316',     // Orange
                    'locked': '#d1d5db'      // Grey
                };
                rectElement.setAttribute('fill', colors[state] || '#d1d5db');
            }
        });
        
        Logger.debug(`✅ updateStepIcons: Icônes mises à jour pour ${chapitreId}`);
    }, 200);  // FIX: Augmenté de 100ms → 200ms pour garantir localStorage sync
}

/**
 * Récupère les données de progression d'une étape avec fallback par défaut
 * Utilise try/catch pour gérer les données corrompues
 * 
 * @param {string} stepId - ID de l'étape
 * @returns {Object} Objet progression avec defaults sûrs
 */
function getStepProgress(stepId) {
    const key = `step_${stepId}`;
    const defaults = {
        id: stepId,
        completed: false,
        points: 0,
        maxPoints: 10,
        timestamp: null,
        attempts: 0,
        lastAttempt: null
    };
    
    try {
        const stored = localStorage.getItem(key);
        if (!stored) {
            Logger.warn(`⚠️ Clé localStorage manquante: ${key}, utilisation defaults`);
            return defaults;
        }
        
        const parsed = JSON.parse(stored);
        // ✅ Fusionner avec defaults pour garantir tous les champs
        return { ...defaults, ...parsed };
    } catch (e) {
        Logger.error(`❌ Erreur parsing localStorage ${key}:`, e);
        return defaults;
    }
}

/**
 * Définit les données de progression d'une étape
 * Fusionne avec les données existantes pour ne pas perdre de champs
 * 
 * @param {string} stepId - ID de l'étape
 * @param {Object} data - Données à mettre à jour (fusion, pas remplacement)
 */
function setStepProgress(stepId, data) {
    const key = `step_${stepId}`;
    
    try {
        // ✅ Récupérer les données existantes
        const existing = getStepProgress(stepId);
        
        // ✅ Fusionner (pas remplacer)
        const updated = {
            ...existing,
            ...data,
            id: stepId  // ← Forcer l'ID pour éviter confusion
        };
        
        localStorage.setItem(key, JSON.stringify(updated));
        Logger.debug(`✅ Progression mise à jour pour ${stepId}:`, updated);
    } catch (e) {
        Logger.error(`❌ Erreur écriture localStorage ${key}:`, e);
    }
}

/**
 * Réinitialise COMPLÈTEMENT localStorage pour un chapitre
 * Utile pour tester ou relancer le chapitre
 * ⚠️ ATTENTION: Supprime TOUS les progrès du chapitre
 * 
 * @param {string} chapitreId - ID du chapitre
 */
function resetChapterProgress(chapitreId) {
    try {
        // Trouver le chapitre dans TOUS les niveaux
        const chapitre = findChapitreGlobal(chapitreId);
        if (!chapitre) {
            Logger.error(`❌ Chapitre non trouvé: ${chapitreId}`);
            return;
        }
        
        let stepsDeleted = 0;
        
        // ✅ Supprimer toutes les clés step_* pour ce chapitre
        chapitre.etapes.forEach(etape => {
            const stepKey = `step_${etape.id}`;
            if (localStorage.getItem(stepKey) !== null) {
                localStorage.removeItem(stepKey);
                stepsDeleted++;
            }
        });
        
        // ✅ Supprimer la clé chapter_*
        const chapitreKey = `chapter_${chapitreId}`;
        if (localStorage.getItem(chapitreKey) !== null) {
            localStorage.removeItem(chapitreKey);
        }
        
        Logger.debug(`🔄 localStorage réinitialisé pour ${chapitreId}: ${stepsDeleted} étapes supprimées`);
        Logger.warn(`⚠️ ATTENTION: Tous les progrès du chapitre ${chapitreId} ont été supprimés!`);
        
        // ✅ Réinitialiser le stockage pour recommencer
        if (chapitre) {
            initializeChapterStorage(chapitre);
            validateAndCleanStorage(chapitre);
        }
    } catch (e) {
        Logger.error(`❌ Erreur réinitialisation localStorage:`, e);
    }
}

/**
 * Affiche les statistiques localStorage pour debug
 * Utile pour vérifier l'état du stockage
 * 
 * @param {string} chapitreId - ID du chapitre (optionnel, affiche tous si absent)
 */
function debugChapterStorage(chapitreId = null) {
    try {
        Logger.group(`📊 Debug localStorage${chapitreId ? ` - ${chapitreId}` : ''}`);
        
        let totalSteps = 0;
        let completedSteps = 0;
        let totalPoints = 0;
        
        // Parcourir toutes les clés
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            
            if (key.startsWith('step_')) {
                const data = getStepProgress(key.replace('step_', ''));
                
                // Filtrer par chapitre si spécifié
                if (chapitreId && data.chapitreId !== chapitreId) {
                    continue;
                }
                
                totalSteps++;
                if (data.completed) completedSteps++;
                totalPoints += data.points;
                
                Logger.debug(`  ${key}:`, {
                    completed: data.completed,
                    points: `${data.points}/${data.maxPoints}`,
                    attempts: data.attempts,
                    timestamp: data.timestamp ? new Date(data.timestamp).toLocaleString() : 'N/A'
                });
            }
        }
        
        Logger.debug(`\n📈 Résumé: ${completedSteps}/${totalSteps} étapes complétées, ${totalPoints} points`);
        Logger.groupEnd();
    } catch (e) {
        Logger.error(`❌ Erreur affichage debug:`, e);
    }
}

/**
 * Charge les données externes d'un chapitre (exercices, steps, etc.)
 * @param {object} chapitre - L'objet chapitre
 */
/**
 * Fusionne intelligemment les étapes externes avec les étapes existantes
 * @param {Array} existingEtapes - Étapes existantes du chapitre
 * @param {Array} externalEtapes - Étapes chargées du fichier externe
 * @returns {Array} Étapes fusionnées
 */
function mergeEtapes(existingEtapes = [], externalEtapes = []) {
    if (!existingEtapes || existingEtapes.length === 0) {
        return externalEtapes;
    }
    
    return existingEtapes.map((etape, index) => {
        const externalEtape = externalEtapes[index];
        
        if (!externalEtape) {
            return etape;
        }
        
        // Fusion intelligente : conserver la structure existante + ajouter les exercices
        return {
            ...etape,                                    // Copier toutes les propriétés existantes
            ...externalEtape,                            // Surcharger avec données externes
            // Fusionner les exercices (ne pas remplacer complètement)
            exercices: mergeExercices(
                etape.exercices || [],
                externalEtape.exercices || []
            ),
            // Fusionner les propriétés critiques
            id: etape.id || externalEtape.id,
            titre: etape.titre || externalEtape.titre,
            description: etape.description || externalEtape.description
        };
    });
}

/**
 * Fusionne les exercices de deux étapes
 * @param {Array} existingExercices - Exercices existants
 * @param {Array} externalExercices - Exercices externes
 * @returns {Array} Exercices fusionnés
 */
function mergeExercices(existingExercices = [], externalExercices = []) {
    if (!existingExercices || existingExercices.length === 0) {
        return externalExercices;
    }
    
    // Fusionner par index
    return existingExercices.map((exercice, index) => {
        const externalExercice = externalExercices[index];
        
        if (!externalExercice) {
            return exercice;
        }
        
        return {
            ...exercice,           // Propriétés existantes (type, titre, etc.)
            ...externalExercice,   // Données externes (questions, options, etc.)
            // Préserver l'ID du chapitre si défini
            chapitre: exercice.chapitre || externalExercice.chapitre
        };
    });
}

async function loadExternalChapterData(chapitre) {
    try {
        const response = await fetch(chapitre.externalDataFile);
        if (!response.ok) throw new Error(`Erreur chargement ${chapitre.externalDataFile}`);
        
        const externalData = await response.json();
        Logger.debug(`✅ Données externes chargées pour ${chapitre.id}:`, externalData);
        
        // Fusionner INTELLIGEMMENT les données externes avec le chapitre
        const sourceEtapes = externalData.etapes || externalData.steps || [];
        
        if (sourceEtapes.length > 0) {
            chapitre.etapes = mergeEtapes(chapitre.etapes, sourceEtapes);
            Logger.debug(`✅ Étapes fusionnées pour ${chapitre.id}:`, chapitre.etapes);
        }
        
        // Fusionner les métadonnées supplémentaires
        if (externalData.metadata) {
            chapitre.metadata = { ...chapitre.metadata, ...externalData.metadata };
        }
        
    } catch (error) {
        Logger.error(`❌ Erreur chargement données externes:`, error);
    }
}

/**
 * ════════════════════════════════════════════════════════════════════
 * DRAG-AND-DROP MANAGEMENT
 * ════════════════════════════════════════════════════════════════════
 */

/**
 * Initialise les événements drag-and-drop HTML5 pour un conteneur
 * @param {string} dragId - ID du conteneur drag-drop
 */
function initDragDrop(dragId) {
    const container = document.getElementById(dragId);
    if (!container) {
        Logger.warn(`❌ Container drag-drop introuvable: ${dragId}`);
        return;
    }
    
    const itemsContainer = container.querySelector('.drag-items');
    if (!itemsContainer) {
        Logger.warn(`❌ Conteneur d'items introuvable pour: ${dragId}`);
        return;
    }
    
    const items = itemsContainer.querySelectorAll('.drag-item');
    Logger.debug(`✅ Initialisation drag-drop pour ${dragId} - ${items.length} items`);
    
    let draggedElement = null; // Stockage global du contexte de drag
    
    /**
     * DRAGSTART - Au commencement du drag
     * Stocke les informations de l'élément en cours de déplacement
     */
    items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedElement = item;
            
            // ✅ Indiquer visuellement l'élément en cours de déplacement
            item.style.opacity = '0.5';
            item.style.transform = 'scale(0.95)';
            item.style.borderLeft = '4px solid rgba(255, 255, 255, 0.5)';
            item.style.cursor = 'grabbing';
            
            // ✅ Stocker l'ID du conteneur dans le dataTransfer
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', item.innerHTML);
            
            Logger.debug(`🎯 Drag started: ${item.textContent.trim()}`);
        });
        
        /**
         * DRAGOVER - Lorsqu'un élément est survolé pendant le drag
         * Affiche la zone de drop active
         */
        item.addEventListener('dragover', (e) => {
            e.preventDefault(); // ⚠️ OBLIGATOIRE pour permettre le drop
            
            // Indiquer que le drop est accepté
            e.dataTransfer.dropEffect = 'move';
            
            // Afficher la zone de drop si on survole un élément différent
            if (draggedElement && draggedElement !== item) {
                item.style.backgroundColor = 'rgba(76, 175, 80, 0.3)'; // Vert semi-transparent
                item.style.borderTop = '3px solid rgba(76, 175, 80, 0.8)';
                item.style.transform = 'scale(1.02)';
            }
        });
        
        /**
         * DRAGLEAVE - Lorsqu'on quitte un élément pendant le drag
         * Nettoie les styles de drop active
         */
        item.addEventListener('dragleave', (e) => {
            if (draggedElement !== item) {
                item.style.backgroundColor = '';
                item.style.borderTop = '';
                // Ne pas réinitialiser le transform ici si c'est pas draggedElement
            }
        });
        
        /**
         * DROP - Lorsqu'on relâche l'élément draggé
         * Exécute l'échange d'éléments dans le DOM
         */
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Nettoyer les styles
            item.style.backgroundColor = '';
            item.style.borderTop = '';
            item.style.transform = '';
            
            // Si c'est un vrai drop (pas sur le même élément)
            if (draggedElement && draggedElement !== item) {
                // ✅ VRAI SWAP DOM : utiliser insertBefore pour un vrai échange
                const allItems = Array.from(itemsContainer.querySelectorAll('.drag-item'));
                const draggedIndex = allItems.indexOf(draggedElement);
                const targetIndex = allItems.indexOf(item);
                
                // Insérer l'élément draggé à la bonne place
                if (draggedIndex < targetIndex) {
                    item.parentElement.insertBefore(draggedElement, item.nextSibling);
                } else {
                    item.parentElement.insertBefore(draggedElement, item);
                }
                
                Logger.debug(`✅ Éléments échangés: position ${draggedIndex} ↔ position ${targetIndex}`);
                
                // ✅ Mettre à jour les data-attributes avec les positions actuelles
                const updatedItems = itemsContainer.querySelectorAll('.drag-item');
                updatedItems.forEach((el, idx) => {
                    el.setAttribute('data-current-position', idx);
                    // ✅ Réinitialiser les styles IMMÉDIATEMENT après swap
                    el.style.opacity = '1';
                    el.style.backgroundColor = '';
                    el.style.borderTop = '';
                    el.style.transform = '';
                    el.style.borderLeft = '4px solid transparent';
                    el.style.cursor = 'move';
                });
                
                // ✅ Mettre à jour le stockage DRAG_DATA
                updateDragOrder(dragId);
            }
        });
        
        /**
         * DRAGEND - À la fin du drag (avec ou sans drop)
         * Nettoie tous les styles temporaires
         */
        item.addEventListener('dragend', (e) => {
            // ✅ NETTOYER TOUS LES STYLES COMPLÈTEMENT
            itemsContainer.querySelectorAll('.drag-item').forEach(el => {
                el.style.opacity = '1';
                el.style.backgroundColor = '';
                el.style.borderTop = '';
                el.style.transform = '';
                el.style.borderLeft = '4px solid transparent';
                el.style.cursor = 'move';
            });
            
            draggedElement = null; // Réinitialiser le référence
            Logger.debug(`🔚 Drag ended - Tous les styles réinitialisés`);
        });
    });
    
    Logger.debug(`✅ Événements drag-drop attachés pour ${dragId}`);
}

/**
 * Met à jour l'ordre des éléments après drag-drop
 * @param {string} dragId - ID du conteneur
 */
function updateDragOrder(dragId) {
    const container = document.getElementById(dragId);
    if (!container || !window.DRAG_DATA?.[dragId]) return;
    
    const items = container.querySelectorAll('.drag-item');
    const newOrder = Array.from(items).map((item, idx) => ({
        id: item.dataset.itemId,
        position: idx,
        correctPosition: parseInt(item.dataset.correctPosition)
    }));
    
    window.DRAG_DATA[dragId].currentOrder = newOrder;
    Logger.debug(`✅ Ordre mis à jour:`, newOrder);
}

/**
 * Valide l'ordre des éléments drag-drop et attribue les points
 * @param {string} dragId - ID du conteneur drag-drop
 */
function initDragDropValidation(dragId) {
    const container = document.getElementById(dragId);
    const feedbackDiv = document.getElementById(`feedback_${dragId}`);
    
    if (!container || !feedbackDiv || !window.DRAG_DATA?.[dragId]) {
        Logger.error(`❌ Validation impossible pour ${dragId}`);
        return;
    }
    
    const dragData = window.DRAG_DATA[dragId];
    const items = container.querySelectorAll('.drag-item');
    
    // Vérifier l'ordre correct
    let isCorrect = true;
    const correctPositions = dragData.items.map(item => 
        item.correctPosition !== undefined ? item.correctPosition : dragData.items.indexOf(item)
    );
    
    items.forEach((item, currentIdx) => {
        const itemId = item.dataset.itemId || item.dataset.itemId;
        const correctPos = parseInt(item.dataset.correctPosition);
        
        if (correctPos !== currentIdx) {
            isCorrect = false;
            item.style.borderLeft = '4px solid #f44336'; // Rouge pour erreur
        } else {
            item.style.borderLeft = '4px solid #4caf50'; // Vert pour correct
        }
    });
    
    // Afficher le feedback
    if (isCorrect) {
        feedbackDiv.innerHTML = `
            <div style="background: rgba(76, 175, 80, 0.1); border-left: 4px solid #4caf50; padding: var(--spacing-md); border-radius: var(--radius-md); color: #2e7d32; font-weight: 600;">
                ✅ Bravo! L'ordre est correct!
            </div>
        `;
        feedbackDiv.style.display = 'block';
        
        // ✅ Ajouter les points
        if (dragData.exerciseId) {
            const points = 25; // Points par défaut
            addPoints(points);
            Logger.debug(`✅ +${points} points pour l'exercice ${dragData.exerciseId}`);
        }
    } else {
        feedbackDiv.innerHTML = `
            <div style="background: rgba(244, 67, 54, 0.1); border-left: 4px solid #f44336; padding: var(--spacing-md); border-radius: var(--radius-md); color: #c62828; font-weight: 600;">
                ❌ L'ordre n'est pas correct. Réessayez!
            </div>
        `;
        feedbackDiv.style.display = 'block';
    }
    
    Logger.debug(`📊 Validation drag-drop: ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);
}

/**
 * ════════════════════════════════════════════════════════════════════
 * EXERCICE FORMAT NORMALIZATION
 * ════════════════════════════════════════════════════════════════════
 */

/**
 * Normalise un exercice d'un ancien format vers le format unifié
 * Convertit automatiquement les champs incompatibles
 * @param {Object} exercice - L'exercice à normaliser
 * @returns {Object} Exercice au format unifié
 */
function normalizeExercise(exercice) {
    if (!exercice || typeof exercice !== 'object') {
        return exercice;
    }
    
    // ✅ Créer une copie pour ne pas modifier l'original
    const normalized = { ...exercice };
    
    // ✅ Si le format est déjà moderne (a une clé 'content'), retourner tel quel
    if (normalized.content && typeof normalized.content === 'object') {
        return normalized;
    }
    
    /**
     * CONVERSION FORMAT ANCIEN → FORMAT UNIFIÉ
     * Détecte et convertit les champs spécifiques à chaque type d'exercice
     */
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1️⃣ QCM: "choix" → "options"
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (normalized.type === 'qcm' && normalized.choix && !normalized.content) {
        normalized.content = {
            question: normalized.question || 'Question',
            options: normalized.choix.map(choice => choice.texte || choice),
            correctAnswer: normalized.choix.findIndex(c => c.correct === true),
            explanation: normalized.explication || ''
        };
        delete normalized.choix;
        delete normalized.question;
        delete normalized.explication;
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 2️⃣ VRAI/FAUX: "affirmations" → "items"
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (normalized.type === 'true_false' && normalized.affirmations && !normalized.content) {
        normalized.content = {
            items: normalized.affirmations.map(aff => ({
                statement: aff.texte || aff.affirmation || aff,
                answer: aff.correct === true || aff.answer === true
            }))
        };
        delete normalized.affirmations;
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3️⃣ DRAG-DROP: "items" → "content.items"
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (normalized.type === 'drag_drop' && normalized.items && !normalized.content) {
        normalized.content = {
            items: normalized.items
        };
        delete normalized.items;
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 4️⃣ MATCHING: "paires" → "content.pairs"
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (normalized.type === 'matching' && normalized.paires && !normalized.content) {
        normalized.content = {
            pairs: normalized.paires
        };
        delete normalized.paires;
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 5️⃣ LIKERT SCALE: "items" → "content.items"
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (normalized.type === 'likert_scale' && normalized.items && !normalized.content) {
        normalized.content = {
            items: normalized.items
        };
        delete normalized.items;
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 6️⃣ FLASHCARDS: "cartes" → "content.cards" + type normalization
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Normaliser le type: 'flashcard' → 'flashcards' (plural)
    if (normalized.type === 'flashcard') {
        normalized.type = 'flashcards';
    }
    
    if (normalized.type === 'flashcards' && normalized.cartes && !normalized.content) {
        normalized.content = {
            cards: normalized.cartes
        };
        delete normalized.cartes;
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 7️⃣ LECTURE: "texte" → "content.text"
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (normalized.type === 'lecture' && normalized.texte && !normalized.content) {
        normalized.content = {
            text: normalized.texte
        };
        delete normalized.texte;
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 8️⃣ QUIZ: "questions" → "content.questions"
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (normalized.type === 'quiz' && normalized.questions && !normalized.content) {
        normalized.content = {
            questions: normalized.questions
        };
        delete normalized.questions;
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 9️⃣ VIDEO: Pas de conversion nécessaire (déjà OK)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    Logger.debug(`✅ Exercice ${normalized.id || normalized.type} normalisé:`, normalized);
    return normalized;
}

// Stocker les chapitres globalement
let CHAPITRES = [];
// Alias pour faciliter debug console
window.CHAPITRES = CHAPITRES;
window.CHAPTERS = CHAPITRES;

/**
 * 🌉 HELPER GLOBAL: Chercher un chapitre dans tous les endroits
 * Cherche d'abord dans CHAPITRES[], puis dans allNiveaux
 */
function findChapitreGlobal(chapitreId) {
    // D'abord chercher dans CHAPITRES (niveau actuel)
    if (CHAPITRES && Array.isArray(CHAPITRES)) {
        const found = CHAPITRES.find(ch => ch.id === chapitreId);
        if (found) return found;
    }
    
    // Sinon chercher dans tous les niveaux chargés
    if (window.allNiveaux) {
        for (let niveauId in window.allNiveaux) {
            const chapitres = window.allNiveaux[niveauId];
            if (Array.isArray(chapitres)) {
                const found = chapitres.find(ch => ch.id === chapitreId);
                if (found) return found;
            }
        }
    }
    
    return null;
}

/**
 * Charge et affiche les objectifs du chapitre sélectionné
 * @param {string} chapitreId - ID du chapitre
 * @returns {array} Tableau des objectifs
 */
function getChapitreObjectifs(chapitreId) {
  const chapitre = findChapitreGlobal(chapitreId);
  if (!chapitre || !chapitre.objectifs) {
    Logger.warn(`Aucun objectif trouvé pour ${chapitreId}`);
    return [];
  }
  return chapitre.objectifs;
}

/**
 * Calcule le total des points à partir de stepsPoints
 * @param {Object} stepsPoints - Objet avec {stepId: points, ...}
 * @returns {number} Somme totale des points
 */
function calculateTotalPoints(stepsPoints) {
    if (!stepsPoints || typeof stepsPoints !== 'object') {
        return 0;
    }
    return Object.values(stepsPoints).reduce((sum, points) => {
        return sum + (parseInt(points) || 0);
    }, 0);
}

/**
 * ✅ HELPER: Charge l'état d'une étape depuis localStorage de façon sécurisée
 * Évite les données suspectes
 */
function getStepCompletionStatus(stepId, defaultValue = false) {
    try {
        const stored = localStorage.getItem(`step_${stepId}`);
        if (!stored) return defaultValue;
        
        const parsed = JSON.parse(stored);
        return parsed.completed === true;
    } catch (e) {
        Logger.warn(`⚠️ Erreur lecture localStorage pour ${stepId}:`, e);
        return defaultValue;
    }
}

/**
 * Génère le SVG du chemin serpentin
 */
function generatePathSVG(etapes, chapitre = null) {
    const stepSize = 60;
    const spacing = 100;
    const verticalSpacing = 120;
    const lineWidth = 3;
    const lineColor = '#C77DFF';
    
    let positions = [];
    let row = 0;
    let col = 0;
    
    // ✅ AJOUTER LES JALONS SPÉCIAUX
    let allItems = [];
    
    // 1. Jalon Objectifs en premier
    if (chapitre && chapitre.objectifs) {
        allItems.push({
            id: `objectives-${chapitre.id}`,
            titre: 'Objectifs du chapitre',
            completed: false,
            isObjectives: true,
            chapitre: chapitre
        });
    }
    
    // 2. Ajouter les étapes
    allItems.push(...etapes);
    
    // 3. Jalon Portfolio à la fin (et au milieu si > 10 étapes)
    // ✅ FIX OPTION B: Vérifier si le chapitre a DÉJÀ un portfolio dans ses étapes (ex: 101BT_08_portfolio)
    const hasPortfolioInEtapes = etapes.some(e => 
        e.type === 'portfolio_swipe' || 
        e.id?.includes('portfolio') || 
        e.titre?.toLowerCase().includes('portfolio')
    );
    
    if (chapitre && chapitre.objectifs && !hasPortfolioInEtapes) {
        const totalItems = allItems.length;
        
        // Si plus de 10 étapes, ajouter portfolio au milieu aussi
        if (totalItems > 10) {
            const midPoint = Math.floor(totalItems / 2);
            allItems.splice(midPoint, 0, {
                id: `portfolio-mid-${chapitre.id}`,
                titre: 'Plan de révision (Checkpoint)',
                completed: false,
                isPortfolio: true,
                isMidpoint: true,
                chapitre: chapitre
            });
        }
        
        // Ajouter portfolio à la fin
        allItems.push({
            id: `portfolio-${chapitre.id}`,
            titre: 'Plan de révision final',
            completed: false,
            isPortfolio: true,
            chapitre: chapitre
        });
    } else if (hasPortfolioInEtapes) {
        Logger.debug(`ℹ️ generatePathSVG: Portfolio déjà présent dans les étapes de ${chapitre?.id}, pas de doublon ajouté`);
    }
    
    // Calculer les positions
    allItems.forEach((item, index) => {
        const x = col * spacing + 50;
        const y = row * verticalSpacing + 50;
        positions.push({ x, y, step: item, index });
        
        col++;
        if (col >= 5) {
            col = 0;
            row++;
        }
    });
    
    let lines = '';
    for (let i = 0; i < positions.length - 1; i++) {
        const from = positions[i];
        const to = positions[i + 1];
        
        lines += `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" 
                        stroke="${lineColor}" stroke-width="${lineWidth}" 
                        stroke-dasharray="5,5" opacity="0.5"/>`;
    }
    
    let steps = '';
    positions.forEach(({ x, y, step, index }) => {
        // ✅ Charger l'état réel depuis localStorage (avec validation)
        let isCompleted = step.completed;
        
        if (step.id && !step.isObjectives && !step.isPortfolio) {
            isCompleted = getStepCompletionStatus(step.id, step.completed);
        }
        
        const isLocked = index > 0 && !positions[index - 1].step.completed;
        const isObjectives = step.isObjectives;
        const isPortfolio = step.isPortfolio;
        
        let bgColor = '#95A5A6';
        let emoji = '🔒';
        
        // ✅ COULEURS SPÉCIALES POUR LES JALONS
        if (isObjectives) {
            bgColor = '#6B5B95';  // Pourpre spécial
            emoji = '📋';         // Symbole objectifs
        } else if (isPortfolio) {
            bgColor = '#FF6B9D';  // Rose/magenta spécial
            emoji = '🎯';         // Symbole portfolio
        } else if (isCompleted) {
            bgColor = '#2ECC71';
            emoji = '✅';
        } else if (!isLocked) {
            bgColor = '#F39C12';
            emoji = '⚡';
        }
        
        steps += `
            <g class="step-group" data-step-id="${step.id}" data-is-objectives="${isObjectives}" data-is-portfolio="${isPortfolio}" data-is-midpoint="${step.isMidpoint || false}" data-state="${isCompleted ? 'completed' : isLocked ? 'locked' : 'active'}">
                <rect x="${x - stepSize/2}" y="${y - stepSize/2}" 
                      width="${stepSize}" height="${stepSize}" 
                      rx="12" 
                      stroke="${lineColor}" stroke-width="2"
                      class="step-rect"/>
                <text x="${x}" y="${y + 8}" 
                      text-anchor="middle" font-size="28" 
                      class="step-emoji">${emoji}</text>
                <title>${step.titre}</title>
                <!-- ✅ SUPPRIMÉ: Affichage des titres sous les icônes (trop chargé visuellement) -->
            </g>
        `;
        Logger.debug("Titres supprimés du SVG");
    });
    
    const width = 550;
    const height = Math.max(200, (Math.floor((allItems.length - 1) / 5) + 1) * verticalSpacing + 100);
    
    return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" 
             class="path-svg" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <style>
                    .step-box {
                        cursor: pointer;
                        transition: all 0.3s ease;
                    }
                    .step-box:hover {
                        filter: brightness(1.1);
                    }
                    .step-emoji {
                        pointer-events: none;
                    }
                </style>
            </defs>
            ${lines}
            ${steps}
        </svg>
    `;
}

/**
 * Affiche une notification stylisée au centre de l'écran
 */
function showSuccessNotification(title, message, icon = '🎉', duration = 2000) {
    const existingNotif = document.getElementById('success-notification');
    if (existingNotif) existingNotif.remove();
    
    const notif = document.createElement('div');
    notif.id = 'success-notification';
    notif.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 40px 60px;
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        z-index: 10000;
        text-align: center;
        min-width: 350px;
        animation: slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    notif.innerHTML = `
        <div style="font-size: 60px; margin-bottom: 15px; animation: bounce 0.6s ease-in-out;">${icon}</div>
        <h2 style="margin: 0 0 10px 0; font-size: 28px; font-weight: bold;">${title}</h2>
        <p style="margin: 0; font-size: 16px; opacity: 0.95;">${message}</p>
    `;
    
    document.body.appendChild(notif);
    
    // Ajouter les animations CSS si elles n'existent pas
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translate(-50%, -60%);
                    opacity: 0;
                }
                to {
                    transform: translate(-50%, -50%);
                    opacity: 1;
                }
            }
            
            @keyframes bounce {
                0%, 100% {
                    transform: scale(1);
                }
                50% {
                    transform: scale(1.1);
                }
            }
            
            @keyframes slideOut {
                from {
                    transform: translate(-50%, -50%);
                    opacity: 1;
                }
                to {
                    transform: translate(-50%, -60%);
                    opacity: 0;
                }
            }
            
            @keyframes shake {
                0%, 100% {
                    transform: rotate(0deg);
                }
                25% {
                    transform: rotate(-10deg);
                }
                75% {
                    transform: rotate(10deg);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Supprimer après la durée
    setTimeout(() => {
        notif.style.animation = 'slideOut 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        setTimeout(() => notif.remove(), 400);
    }, duration);
}

/**
 * Affiche une notification d'erreur stylisée
 */
function showErrorNotification(message, duration = 2000) {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #E74C3C 0%, #C0392B 100%);
        color: white;
        padding: 30px 40px;
        border-radius: 15px;
        box-shadow: 0 10px 40px rgba(231, 76, 60, 0.3);
        z-index: 10000;
        text-align: center;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        animation: slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        max-width: 90%;
    `;
    
    notif.innerHTML = `
        <div style="font-size: 60px; margin-bottom: 15px; animation: bounce 0.6s ease-in-out;">⚠️</div>
        <p style="margin: 0; font-size: 16px; opacity: 0.95;">${message}</p>
    `;
    
    document.body.appendChild(notif);
    
    // Supprimer après la durée
    setTimeout(() => {
        notif.style.animation = 'slideOut 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        setTimeout(() => notif.remove(), 400);
    }, duration);
}

// ═══════════════════════════════════════════════════════════════
// GESTION VIDÉOS MODULE 101AB
// ═══════════════════════════════════════════════════════════════

/**
 * Charger module vidéo du chapitre
 * S'appelle automatiquement quand on clique sur un chapitre
 */
async function loadChapterVideos(chapterId) {
  try {
    const response = await fetch('/assets/videos/101ab/video-manifest.json');
    const manifest = await response.json();
    
    // Filtrer vidéos du chapitre
    const chapterVideos = manifest.videos.filter(v => v.module === chapterId);
    
    Logger.debug(`🎬 ${chapterVideos.length} vidéos trouvées pour ${chapterId}`);
    
    chapterVideos.forEach(video => {
      renderVideoPlayer(video);
    });
    
  } catch (error) {
    Logger.error('❌ Erreur chargement vidéos:', error);
  }
}

/**
 * Afficher composant vidéo dans le DOM
 */
function renderVideoPlayer(videoData) {
  const container = document.querySelector(`[data-step-id="${videoData.stepId}"]`);
  
  if (!container) {
    Logger.warn('⚠️ Conteneur non trouvé pour:', videoData.stepId);
    return;
  }

  // Vérifier si vidéo déjà présente
  if (container.querySelector('video')) {
    return;
  }

  // Résoudre le chemin vidéo depuis le manifest
  const videoSrc = videoData.sources['720p'] || videoData.sources['480p'] || videoData.sources['360p'];
  const resolvedPath = videoSrc.replace('../', '/assets/videos/');

  // Créer élément vidéo HTML5
  const videoElement = document.createElement('video');
  videoElement.setAttribute('controls', 'true');
  videoElement.setAttribute('width', '100%');
  videoElement.setAttribute('height', 'auto');
  videoElement.className = 'video-player-container';
  videoElement.style.maxWidth = '100%';
  videoElement.style.marginBottom = '20px';
  
  // Source vidéo
  const sourceElement = document.createElement('source');
  sourceElement.setAttribute('src', resolvedPath);
  sourceElement.setAttribute('type', 'video/mp4');
  videoElement.appendChild(sourceElement);
  
  // Sous-titres si disponibles
  if (videoData.captions?.fr) {
    const trackElement = document.createElement('track');
    trackElement.setAttribute('kind', 'subtitles');
    trackElement.setAttribute('src', `/assets/videos/101ab/${videoData.captions.fr}`);
    trackElement.setAttribute('srclang', 'fr');
    trackElement.setAttribute('label', 'Français');
    videoElement.appendChild(trackElement);
  }
  
  // Fallback message
  const fallback = document.createElement('p');
  fallback.textContent = 'Votre navigateur ne supporte pas la vidéo HTML5.';
  videoElement.appendChild(fallback);

  // Insérer dans le conteneur
  container.appendChild(videoElement);
  Logger.debug(`✅ Vidéo chargée: ${videoData.title} (${resolvedPath})`);


  // Listener pour complétude vidéo
  videoElement.addEventListener('video-completed', (e) => {
    handleVideoCompleted(videoData, e.detail);
  });

  Logger.debug('✅ Vidéo insertée:', videoData.title);
}

/**
 * Gestion complétude vidéo
 * - Déverrouille étape suivante
 * - Attribue points
 * - Met à jour progression
 */
function handleVideoCompleted(videoData, completionData) {
  Logger.debug('✅ Vidéo complétée:', videoData.title);
  
  // Ajouter points au total
  if (App.addPoints) {
    App.addPoints(completionData.points, `Vidéo: ${videoData.title}`);
  }

  // Déverrouiller exercices associés
  if (videoData.relatedExercises && videoData.relatedExercises.length > 0) {
    Logger.debug(`🔓 Déverrouillage ${videoData.relatedExercises.length} exercices`);
  }

  // Mettre à jour progression module
  if (App.updateChapterProgress) {
    App.updateChapterProgress(videoData.module);
  }
}

/**
 * Adapter bitrate en fonction vitesse réseau
 */
function getOptimalBitrate() {
  if (!navigator.connection) return '720p';

  const effectiveType = navigator.connection.effectiveType;
  const downlink = navigator.connection.downlink;

  if (effectiveType === '4g' && downlink >= 5) {
    return '720p';
  } else if (effectiveType === '3g' || downlink < 5) {
    return '480p';
  } else {
    return '360p';
  }
}

/**
 * Envoyer événement tracking
 */
function trackEvent(eventName, data = {}) {
  Logger.debug(`📊 Event: ${eventName}`, data);
  
  if (window.analytics) {
    window.analytics.track(eventName, data);
  }
}

// ═══════════════════════════════════════════════════════════════
// FONCTIONS UNIFIÉES CONSULTATION vs VALIDATION (GLOBALES)
// ═══════════════════════════════════════════════════════════════

/**
 * ✅ COMPLÈTE une étape de type CONSULTATION
 * Utilisée pour: vidéos, lectures, contenus théoriques sans scoring
 * 
 * @param {string} chapitreId - "ch1", "101BT", etc.
 * @param {number} etapeIndex - Index: 0, 1, 2, etc.
 * @param {object} metadata - { timeSpent, viewed: true, etc. }
 * @returns {object} { success, message, nextStepUnlocked, nextStepId }
 */
function completerEtapeConsultation(chapitreId, etapeIndex, metadata = {}) {
  Logger.debug(`[📖 CONSULTATION] Complétant étape ${chapitreId}:${etapeIndex}`, metadata);
  
  try {
    // 1. SAUVEGARDER l'étape comme COMPLÉTÉE dans StorageManager
    StorageManager.saveEtapeState(chapitreId, etapeIndex, {
      completed: true,                              // ← CLEF
      status: 'completed',
      completedAt: new Date().toISOString(),
      visitedAt: metadata.visitedAt || new Date().toISOString(),
      timeSpent: metadata.timeSpent || 0,
      viewed: metadata.viewed !== false,
      attempts: 1,
      score: 100  // Consultation = score auto 100%
    });
    Logger.debug(`[✅] Étape ${chapitreId}:${etapeIndex} marquée COMPLÉTÉE`);
    
    // 1b. SYNCHRONISER avec localStorage pour compatibilité avec App.getStepState()
    const stepKey = `step_${chapitreId}_${etapeIndex}`;
    localStorage.setItem(stepKey, JSON.stringify({
      status: 'completed',
      score: 100,
      visited: true,
      pointsAwarded: true
    }));

    // 2. METTRE À JOUR progression du chapitre
    const progressResult = StorageManager.updateChapterProgress(chapitreId);
    Logger.debug(`[📊] Progression chapitre ${chapitreId}:`, progressResult);

    // 3. DÉBLOQUER étape suivante AUTOMATIQUEMENT
    const chapitre = CHAPITRES.find(c => c.id === chapitreId);
    if (!chapitre) {
      Logger.error(`Chapitre ${chapitreId} non trouvé!`);
      return { success: false, message: 'Chapitre non trouvé' };
    }

    const nextIndex = etapeIndex + 1;
    if (nextIndex < chapitre.etapes.length) {
      // Débloquer étape suivante
      App.unlockNextStep(chapitreId, etapeIndex);
      const nextEtape = chapitre.etapes[nextIndex];
      Logger.debug(`[🔓] Étape suivante ${chapitreId}:${nextIndex} débloquée`);
      
      return {
        success: true,
        message: '✅ Étape de consultation complétée',
        nextStepUnlocked: true,
        nextStepId: nextEtape.id,
        nextStepTitle: nextEtape.titre
      };
    } else {
      // Dernière étape du chapitre
      Logger.debug(`[🏁] Dernière étape du chapitre ${chapitreId} complétée`);
      return {
        success: true,
        message: '✅ Chapitre complété!',
        nextStepUnlocked: false
      };
    }

  } catch (error) {
    Logger.error(`[❌] Erreur completerEtapeConsultation:`, error);
    showErrorNotification('Erreur lors de la sauvegarde');
    return { success: false, message: error.message };
  }
}

/**
 * 🎯 VALIDE une étape avec seuil de scoring (≥ 80%)
 * Utilisée pour: QCM, Quiz, Assessments, Exercices de validation
 * 
 * @param {string} chapitreId - "ch1", "101BT", etc.
 * @param {number} etapeIndex - 0, 1, 2, etc.
 * @param {number} score - Score obtenu (0-100)
 * @param {object} metadata - { answers, duration, maxPoints }
 * @returns {object} { success, passed, score, message, nextStepUnlocked }
 */
function validateStepWithThreshold(chapitreId, etapeIndex, score, metadata = {}) {
  const MIN_SCORE_THRESHOLD = AppConfig.VALIDATION.MIN_SCORE_THRESHOLD;  // 80%
  const MAX_ATTEMPTS = AppConfig.VALIDATION.MAX_ATTEMPTS;  // 3

  Logger.debug(
    `[🎯 VALIDATION] Étape ${chapitreId}:${etapeIndex} | Score: ${score}%`
  );

  try {
    // 1. RÉCUPÉRER état actuel de l'étape
    const currentState = StorageManager.getEtapeState(chapitreId, etapeIndex);
    const currentAttempts = (currentState?.attempts || 0) + 1;

    Logger.debug(`[📋] État actuel - Tentatives: ${currentAttempts}/${MAX_ATTEMPTS}`);

    // 2. DÉTERMINER si score ≥ 80%
    const passed = score >= MIN_SCORE_THRESHOLD;

    // 3. SAUVEGARDER cette tentative
    StorageManager.saveEtapeState(chapitreId, etapeIndex, {
      completed: passed,  // ← true si score ≥ 80%, false sinon
      status: passed ? 'completed' : 'failed',
      completedAt: passed ? new Date().toISOString() : null,
      score: score,
      attempts: currentAttempts,
      lastAttemptAt: new Date().toISOString(),
      duration: metadata.duration || 0,
      answers: metadata.answers || []
    });
    Logger.debug(
      `[💾] Sauvegardé: score=${score}%, attempts=${currentAttempts}, completed=${passed}`
    );

    // 4. CAS 1: Score < 80% ET tentatives restantes
    if (!passed && currentAttempts < MAX_ATTEMPTS) {
      const remainingAttempts = MAX_ATTEMPTS - currentAttempts;
      const errorMsg = 
        `❌ Score insuffisant: ${score}% < ${MIN_SCORE_THRESHOLD}%\n` +
        `Tentatives restantes: ${remainingAttempts}/${MAX_ATTEMPTS}`;

      Logger.debug(`[⚠️] ${errorMsg}`);
      showErrorNotification(errorMsg);

      return {
        success: true,  // Opération réussie (mais test échoué)
        passed: false,
        score: score,
        message: errorMsg,
        attemptsRemaining: remainingAttempts,
        nextStepUnlocked: false
      };
    }

    // 5. CAS 2: Score < 80% ET pas de tentatives
    if (!passed && currentAttempts >= MAX_ATTEMPTS) {
      const errorMsg = 
        `❌ Score insuffisant: ${score}%\n` +
        `Tentatives épuisées (${MAX_ATTEMPTS}). Contactez l'instructeur.`;

      Logger.debug(`[🚫] ${errorMsg}`);
      showErrorNotification(errorMsg);

      return {
        success: true,
        passed: false,
        score: score,
        message: errorMsg,
        attemptsRemaining: 0,
        nextStepUnlocked: false
      };
    }

    // 6. CAS 3: Score ≥ 80% - SUCCÈS!
    if (passed) {
      Logger.debug(`[🎉] SUCCÈS! Score ${score}% ≥ ${MIN_SCORE_THRESHOLD}%`);

      // a. CALCULER et AJOUTER points
      const maxPoints = metadata.maxPoints || 100;
      const pointsEarned = Math.round((score / 100) * maxPoints);
      StorageManager.addPoints(pointsEarned);
      Logger.debug(`[💎] +${pointsEarned} points`);

      // b. DÉBLOQUER étape suivante
      const chapitre = CHAPITRES.find(c => c.id === chapitreId);
      const nextIndex = etapeIndex + 1;

      if (chapitre && nextIndex < chapitre.etapes.length) {
        App.unlockNextStep(chapitreId, etapeIndex);
        Logger.debug(`[🔓] Étape suivante ${chapitreId}:${nextIndex} débloquée`);
      }

      // c. METTRE À JOUR progression chapitre
      StorageManager.updateChapterProgress(chapitreId);
      Logger.debug(`[📊] Progression chapitre mise à jour`);

      // d. Badges vérifiés automatiquement via updateChapterProgress -> checkAndUnlockBadges

      // e. Construire message succès
      const successMsg = 
        `✅ RÉUSSI!\n` +
        `Score: ${score}%\n` +
        `Points gagnés: +${pointsEarned}`;

      showSuccessNotification(successMsg);

      return {
        success: true,
        passed: true,
        score: score,
        pointsEarned: pointsEarned,
        message: successMsg,
        attemptsRemaining: 0,
        nextStepUnlocked: nextIndex < chapitre?.etapes.length,
        nextStepId: chapitre?.etapes[nextIndex]?.id
      };
    }

  } catch (error) {
    Logger.error(`[❌] Erreur validateStepWithThreshold:`, error);
    showErrorNotification(`Erreur: ${error.message}`);
    return { 
      success: false, 
      message: error.message,
      passed: false 
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// FONCTIONS DE CALCUL DE SCORE PAR TYPE
// ═══════════════════════════════════════════════════════════════

/**
 * Calcule le score d'un QCM basé sur la réponse sélectionnée
 * @param {object} etape - L'étape contenant les exercices QCM
 * @param {string} chapitreId - ID du chapitre
 * @param {number} etapeIndex - Index de l'étape
 * @returns {number} Score en pourcentage (0-100)
 */
function calculateQCMScore(etape, chapitreId, etapeIndex) {
  try {
    if (!etape?.exercices || etape.exercices.length === 0) {
      Logger.warn(`[⚠️] Aucun exercice trouvé pour ${chapitreId}:${etapeIndex}`);
      return 0;
    }

    let correctCount = 0;
    const totalQuestions = etape.exercices.length;

    etape.exercices.forEach((exercice, exIdx) => {
      // Récupérer la réponse sélectionnée par l'utilisateur
      const selectedAnswerId = document.querySelector(
        `input[name="exercice_${exIdx}"]:checked`
      )?.value;

      if (!selectedAnswerId) {
        Logger.debug(`[⚠️] Q${exIdx + 1}: Pas de réponse sélectionnée`);
        return;
      }

      // Vérifier si c'est la bonne réponse
      const isCorrect = selectedAnswerId === exercice.correctAnswer;
      if (isCorrect) {
        correctCount++;
        Logger.debug(`[✅] Q${exIdx + 1}: Correct`);
      } else {
        Logger.debug(`[❌] Q${exIdx + 1}: Incorrect (sélectionné: ${selectedAnswerId}, correct: ${exercice.correctAnswer})`);
      }
    });

    const score = Math.round((correctCount / totalQuestions) * 100);
    Logger.debug(`[📊] QCM Score: ${correctCount}/${totalQuestions} = ${score}%`);
    return score;

  } catch (error) {
    Logger.error(`[❌] Erreur calculateQCMScore:`, error);
    return 0;
  }
}

/**
 * Calcule le score des flashcards basé sur la maîtrise
 * @param {object} etape - L'étape contenant les flashcards
 * @param {string} chapitreId - ID du chapitre
 * @param {number} etapeIndex - Index de l'étape
 * @returns {number} Score en pourcentage (0-100)
 */
function calculateFlashcardsScore(etape, chapitreId, etapeIndex) {
  try {
    if (!etape?.flashcards || etape.flashcards.length === 0) {
      Logger.warn(`[⚠️] Aucune flashcard trouvée pour ${chapitreId}:${etapeIndex}`);
      return 0;
    }

    let masteredCount = 0;
    const totalCards = etape.flashcards.length;

    etape.flashcards.forEach((card, idx) => {
      // Une flashcard est maîtrisée si l'utilisateur l'a marquée comme "known" 3+ fois
      const cardState = sessionStorage.getItem(`flashcard_${etapeIndex}_${idx}_known`) || 0;
      if (parseInt(cardState) >= 3) {
        masteredCount++;
      }
    });

    const score = Math.round((masteredCount / totalCards) * 100);
    Logger.debug(`[📊] Flashcards Score: ${masteredCount}/${totalCards} = ${score}%`);
    return score;

  } catch (error) {
    Logger.error(`[❌] Erreur calculateFlashcardsScore:`, error);
    return 0;
  }
}

/**
 * Calcule le score du Matching/Drag-Drop basé sur les bonnes appairements
 * @param {object} etape - L'étape contenant les éléments à appairer
 * @param {string} chapitreId - ID du chapitre
 * @param {number} etapeIndex - Index de l'étape
 * @returns {number} Score en pourcentage (0-100)
 */
function calculateMatchingScore(etape, chapitreId, etapeIndex) {
  try {
    if (!etape?.matchingPairs || etape.matchingPairs.length === 0) {
      Logger.warn(`[⚠️] Aucun appairage trouvé pour ${chapitreId}:${etapeIndex}`);
      return 0;
    }

    let correctPairings = 0;
    const totalPairs = etape.matchingPairs.length;

    etape.matchingPairs.forEach((pair, pairIdx) => {
      // Récupérer l'appairage sélectionné par l'utilisateur
      const selectedMatch = document.querySelector(
        `select[data-pair="${pairIdx}"]`
      )?.value;

      if (!selectedMatch) {
        Logger.debug(`[⚠️] Paire ${pairIdx + 1}: Pas d'appairage sélectionné`);
        return;
      }

      // Vérifier si c'est le bon appairage
      const isCorrect = selectedMatch === pair.correctMatch;
      if (isCorrect) {
        correctPairings++;
        Logger.debug(`[✅] Paire ${pairIdx + 1}: Correct`);
      } else {
        Logger.debug(`[❌] Paire ${pairIdx + 1}: Incorrect`);
      }
    });

    const score = Math.round((correctPairings / totalPairs) * 100);
    Logger.debug(`[📊] Matching Score: ${correctPairings}/${totalPairs} = ${score}%`);
    return score;

  } catch (error) {
    Logger.error(`[❌] Erreur calculateMatchingScore:`, error);
    return 0;
  }
}

/**
 * Soumet une réponse d'exercice de validation
 * Calcule le score et appelle validateStepWithThreshold()
 * 
 * @param {string} chapitreId - ID du chapitre (ex: 'ch1')
 * @param {number} etapeIndex - Index de l'étape (0-based)
 * @returns {object} Résultat de la validation
 */
function submitValidationExercise(chapitreId, etapeIndex) {
  const chapitre = CHAPITRES.find(c => c.id === chapitreId);
  const etape = chapitre?.etapes[etapeIndex];

  if (!etape) {
    Logger.error(`Étape ${chapitreId}:${etapeIndex} non trouvée`);
    showErrorNotification('Étape non trouvée');
    return { success: false, message: 'Étape non trouvée' };
  }

  Logger.debug(`[📤 SUBMIT] Soumettant réponses pour ${chapitreId}:${etapeIndex}`);

  // RÉCUPÉRER les réponses de l'utilisateur selon le type
  let score = 0;
  const metadata = {};

  if (etape.type === 'qcm' || etape.type === 'quiz' || etape.type === 'qcm_scenario') {
    // Calculer score QCM/Quiz/QCM_Scenario
    score = calculateQCMScore(etape, chapitreId, etapeIndex);
    metadata.maxPoints = 100;
  } 
  else if (etape.type === 'flashcards') {
    // Calculer score flashcards
    score = calculateFlashcardsScore(etape, chapitreId, etapeIndex);
    metadata.maxPoints = 100;
  }
  else if (etape.type === 'matching' || etape.type === 'drag-drop') {
    // Calculer score pour appariement/drag-drop
    score = calculateMatchingScore(etape, chapitreId, etapeIndex);
    metadata.maxPoints = 100;
  }
  else {
    // Autres types: score auto à 100%
    score = 100;
  }

  Logger.debug(`[📊] Score calculé: ${score}%`);

  // Incrémenter tentatives
  if (!metadata.attempts) metadata.attempts = 0;
  metadata.attempts++;

  // VALIDER avec seuil
  const result = validateStepWithThreshold(chapitreId, etapeIndex, score, metadata);

  // RAFRAÎCHIR l'affichage après validation
  if (typeof App !== 'undefined' && App.rafraichirAffichage) {
    App.rafraichirAffichage();
  }

  return result;
}

/**
 * Valide une étape (router universal)
 * Détecte le type et redirige vers completerEtapeConsultation() ou validateStepWithThreshold()
 * 
 * @param {string} chapitreId - ID du chapitre (ex: 'ch1')
 * @param {number} etapeIndex - Index de l'étape (0-based)
 * @param {number} score - Score optionnel (requis pour VALIDATION)
 */
function validerExercice(chapitreId, etapeIndex, score = null) {
  const chapitre = CHAPITRES.find(c => c.id === chapitreId);
  const etape = chapitre?.etapes[etapeIndex];

  if (!etape) {
    Logger.error(`Étape ${chapitreId}:${etapeIndex} non trouvée`);
    showErrorNotification('Étape non trouvée');
    return;
  }

  // DÉTECTER type d'étape
  const isConsultation = etape.consultation === true;
  const isValidation = etape.validation === true || ['qcm', 'quiz'].includes(etape.type);

  Logger.debug(`[🔀 VALIDER] Étape ${etape.titre} | Type: ${isConsultation ? 'CONSULTATION' : 'VALIDATION'}`);

  if (isConsultation) {
    // === CONSULTATION ===
    completerEtapeConsultation(chapitreId, etapeIndex, { viewed: true });

  } else if (isValidation) {
    // === VALIDATION ===
    if (score === null) {
      Logger.error('Score requis pour validation');
      showErrorNotification('Score manquant');
      return;
    }
    validateStepWithThreshold(chapitreId, etapeIndex, score, { maxPoints: 100 });
  }

  // Rafraîchir UI
  if (typeof App !== 'undefined' && App.rafraichirAffichage) {
    App.rafraichirAffichage();
  }
}

// ═══════════════════════════════════════════════════════════════
// OBJET APP PRINCIPAL
// ═══════════════════════════════════════════════════════════════

const App = {
    currentPage: 'accueil',
    returnPath: null,  // 🔄 Track où retourner après exercice (pratique, chapitre, etc)
    eventsAttached: false,
    
    init() {
        Logger.debug('🚀 Initialisation App...');
        
        // Charger le manifest vidéo (synchrone - attendre avant de continuer)
        this.loadVideoManifest().then(() => {
            // Vérifier si le profil doit être créé au premier démarrage
            const user = StorageManager.getUser();
            if (!user.profileCreated) {
                Logger.debug('📝 Premier démarrage détecté - affichage modal création profil');
                this.showProfileCreationModal();
                return; // Ne pas continuer l'initialisation jusqu'à création du profil
            }
            
            this.loadPage('accueil');
            
            if (!this.eventsAttached) {
                this.setupNavigation();
                this.eventsAttached = true;
            }
            
            this.updateHeader();
            
            // 🆕 Initialiser le bouton Mode Auteur (visible seulement sur PROFIL)
            window.currentPageName = 'accueil';  // Page par défaut
            if (typeof updateAdminButtonVisibility === 'function') {
                updateAdminButtonVisibility();
            }
            
            Logger.debug('✅ App initialisée');
        });
    },
    
    /**
     * Charge le manifest des vidéos
     */
    async loadVideoManifest() {
        try {
            const response = await fetch('/assets/videos/101ab/video-manifest.json');
            const manifest = await response.json();
            window.videoManifest = manifest;
            Logger.debug(`✅ Manifest vidéo chargé: ${manifest.videos?.length || 0} vidéos`);
            manifest.videos?.forEach(v => {
                Logger.debug(`   📺 ${v.id}: ${v.title}`);
            });
            return manifest;
        } catch (e) {
            Logger.warn('⚠️ Manifest vidéo non trouvé:', e.message);
            return null;
        }
    },
    
    /**
     * Cache la barre de navigation (pendant les modaux d'exercices)
     */
    hideBottomNav() {
        const nav = document.querySelector('.bottom-nav');
        if (nav) {
            nav.style.display = 'none';
            Logger.debug('🙈 Barre de navigation cachée');
        }
    },
    
    /**
     * Affiche la barre de navigation
     */
    showBottomNav() {
        const nav = document.querySelector('.bottom-nav');
        if (nav) {
            nav.style.display = 'flex';
            Logger.debug('👁️ Barre de navigation affichée');
        }
    },
    
    setupNavigation() {
        Logger.debug('🔗 Attachement événements navigation...');
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });
    },

    /**
     * Ajouter des points à l'utilisateur
     */
    addPoints(points, reason = '') {
        const user = StorageManager.getUser();
        user.totalPoints = (user.totalPoints || 0) + points;
        StorageManager.updateUser(user);
        
        Logger.debug(`⭐ +${points} points${reason ? ' (' + reason + ')' : ''}`);
        
        // Mettre à jour header
        this.updateHeader();
        
        // Afficher notification
        if (typeof showSuccessMessage === 'function') {
            showSuccessMessage(`⭐ +${points} points! ${reason}`);
        }
    },

    /**
     * Mettre à jour progression chapitre
     */
    updateChapterProgress(chapterId) {
        Logger.debug(`📊 Mise à jour progression: ${chapterId}`);
        
        const chapitre = CHAPITRES.find(ch => ch.id === chapterId);
        if (!chapitre) return;
        
        // 🔧 FIX: Compter les étapes complétées depuis StorageManager (source de vérité)
        let completedSteps = 0;
        const totalSteps = chapitre.etapes.length;
        
        for (let i = 0; i < totalSteps; i++) {
            const state = StorageManager.getEtapeState(chapterId, i);
            if (state && (state.completed || state.status === 'completed')) {
                completedSteps++;
            }
        }
        
        const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
        
        // Mettre à jour directement dans chaptersProgress (clé séparée)
        const chapters = StorageManager.getChaptersProgress();
        if (!chapters[chapterId]) {
            chapters[chapterId] = { completion: 0, etapes: {} };
        }
        chapters[chapterId].completion = percentage;
        chapters[chapterId].completedSteps = completedSteps;
        chapters[chapterId].totalSteps = totalSteps;
        chapters[chapterId].lastUpdated = new Date().toISOString();
        StorageManager.update('chaptersProgress', chapters);
        
        Logger.debug(`✅ Progression ${chapterId}: ${percentage}% (${completedSteps}/${totalSteps})`);
        
        // 🔧 FIX: Vérifier si badge à débloquer
        if (percentage === 100) {
            this.checkAndUnlockBadges(chapterId);
        }
    },
    
    /**
     * Vérifie et débloque les badges pour un chapitre complété
     * @param {string} chapitreId - ID du chapitre
     */
    checkAndUnlockBadges(chapitreId) {
        const chaptersProgress = StorageManager.getChaptersProgress();
        const progress = chaptersProgress[chapitreId];
        
        if (!progress) return;
        
        // Vérifier si chapitre à 100% et badge pas encore gagné
        if (progress.completion === 100 && !progress.badgeEarned) {
            Logger.debug(`🏆 Chapitre ${chapitreId} complété à 100% - Déblocage badge!`);
            this.deverrouillerBadge(chapitreId);
        }
        
        // Vérifier badge "Expert Douanier" (tous chapitres complétés)
        const allComplete = CHAPITRES.every(ch => {
            const chProgress = chaptersProgress[ch.id];
            return chProgress?.completion === 100;
        });
        
        if (allComplete) {
            const expertBadgeId = 'badge_expert_douanier';
            const existingBadges = StorageManager.getBadges();
            if (!existingBadges.includes(expertBadgeId)) {
                StorageManager.addBadge(expertBadgeId);
                this.afficherNotificationBadge({
                    id: expertBadgeId,
                    titre: 'Expert Douanier',
                    emoji: '🏆'
                });
                Logger.debug(`🏆 Badge Expert Douanier débloqué!`);
            }
        }
    },
    
    navigateTo(pageName) {
        Logger.debug(`📖 Navigation vers: ${pageName}`);
        
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.dataset.page === pageName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        this.loadPage(pageName);
        this.currentPage = pageName;
        
        // 🆕 Mettre à jour visibilité du bouton Mode Auteur
        if (typeof updateAdminButtonVisibility === 'function') {
            updateAdminButtonVisibility();
        }
    },
    
    loadPage(pageName) {
        const content = document.getElementById('app-content');
        
        if (!content) {
            Logger.error('❌ #app-content non trouvé!');
            return;
        }
        
        // ✅ TRACKER LA PAGE COURANTE
        window.currentPageName = pageName;
        Logger.debug(`📄 Chargement page: ${pageName}`);
        
        let html = '';
        
        switch (pageName) {
            case 'accueil':
                html = this.renderAccueil();
                break;
            case 'chapitres':
                html = this.renderChapitres();
                break;
            case 'pratique':
                html = this.renderPratique();
                break;
            case 'journal':
                html = this.renderJournal();
                break;
            case 'profil':
                html = this.renderProfil();
                break;
            default:
                html = `<p>Page non trouvée</p>`;
        }
        
        content.innerHTML = html;
        this.attachPageEvents(pageName);
    },
    
    attachPageEvents(pageName) {
        Logger.debug(`📌 Événements pour ${pageName} attachés`);

        if (pageName === 'accueil') {
            // ✅ CHARGER LES NIVEAUX dynamiquement
            afficherNiveaux().then(niveauxHtml => {
                const container = document.getElementById('niveaux-container-accueil');
                if (container) {
                    container.innerHTML = niveauxHtml;
                    Logger.debug('✅ Niveaux chargés dans accueil');
                }
            }).catch(error => {
                Logger.error('❌ Erreur chargement niveaux:', error);
            });
            
            document.querySelectorAll('.chapitre-card-accueil').forEach(card => {
                card.addEventListener('click', () => {
                    const chapitreId = card.dataset.chapitreId;
                    Logger.debug(`📖 Clic chapitre: ${chapitreId}`);
                    App.navigateTo('chapitres');
                    setTimeout(() => {
                        App.afficherChapitre(chapitreId);
                    }, 100);
                });
            });
        }

        if (pageName === 'chapitres') {
            // Attacher les event listeners aux cartes chapitres
            document.querySelectorAll('.chapitre-card').forEach(card => {
                card.addEventListener('click', () => {
                    const chapitreId = card.dataset.chapitreId;
                    if (chapitreId) {
                        Logger.debug(`📖 Clic chapitre: ${chapitreId}`);
                        App.afficherChapitre(chapitreId);
                    }
                });
            });
        }
    },

    /**
     * Vérifier si un niveau est déverrouillé
     * @param {string} niveauId - ID du niveau (N1, N2, N3, N4)
     * @returns {boolean} true si déverrouillé
     */
    isNiveauUnlocked(niveauId) {
        return isNiveauUnlocked(niveauId);
    },

    /**
     * Calculer la progression d'un niveau
     * @param {string} niveauId - ID du niveau (N1, N2, N3, N4)
     * @returns {number} Pourcentage de complétion (0-100)
     */
    calculateNiveauCompletion(niveauId) {
        try {
            const userData = StorageManager.getUser();
            if (!userData || !userData.niveaux || !userData.niveaux[niveauId]) {
                return 0;
            }
            
            const niveauData = userData.niveaux[niveauId];
            const totalChapitres = niveauData.chapitres ? niveauData.chapitres.length : 0;
            
            if (totalChapitres === 0) {
                return 0;
            }
            
            const completedChapitres = niveauData.chapitres.filter(ch => ch.completed).length;
            const completion = Math.round((completedChapitres / totalChapitres) * 100);
            
            Logger.debug(`📊 Completion ${niveauId}: ${completion}% (${completedChapitres}/${totalChapitres})`);
            return completion;
        } catch (error) {
            Logger.error(`❌ Erreur calculateNiveauCompletion(${niveauId}):`, error);
            return 0;
        }
    },

    /**
     * Affiche un chapitre spécifique avec vue liste
     * ✅ FIX: Injecte dynamiquement les étapes "Objectifs" (première) et "Portfolio" (dernière)
     */
    afficherChapitre(chapitreId) {
        const chapter = CHAPITRES.find(c => c.id === chapitreId);
        
        if (!chapter) {
            Logger.error(`❌ Chapitre ${chapitreId} non trouvé`);
            return;
        }
        
        // Stocker le chapitre actuel
        this.chapitreActuel = chapitreId;
        
        // ✅ INITIALISER localStorage pour les étapes si nécessaire
        for (let i = 0; i < chapter.etapes.length; i++) {
            const stepKey = `step_${chapitreId}_${i}`;
            if (!localStorage.getItem(stepKey)) {
                const state = StorageManager.getEtapeState(chapitreId, i);
                
                if (state?.completed) {
                    localStorage.setItem(stepKey, JSON.stringify({
                        status: 'completed',
                        score: state.score || 100,
                        visited: true,
                        pointsAwarded: true
                    }));
                } else if (state?.unlocked || state?.status === "in_progress") {
                    localStorage.setItem(stepKey, JSON.stringify({
                        status: 'in_progress',
                        score: null,
                        visited: state.visited || false,
                        pointsAwarded: false
                    }));
                } else if (i === 0) {
                    localStorage.setItem(stepKey, JSON.stringify({
                        status: 'in_progress',
                        score: null,
                        visited: false,
                        pointsAwarded: false
                    }));
                } else {
                    localStorage.setItem(stepKey, JSON.stringify({
                        status: 'locked',
                        score: null,
                        visited: false,
                        pointsAwarded: false
                    }));
                }
            }
        }
        
        // ✅ Charger les états depuis StorageManager
        this.loadChapitreEtapesStates(chapitreId);
        
        // ✅ Calculer la progression (incluant Objectifs et Portfolio)
        const objectifsStatus = StorageManager?.getObjectifsStatus?.(chapitreId);
        const portfolioStatus = StorageManager?.getPortfolioStatus?.(chapitreId);
        const objectifsCompleted = objectifsStatus?.completed === true || chapter.objectifsCompleted === true;
        const portfolioCompleted = portfolioStatus?.completed === true || chapter.portfolioCompleted === true;
        
        const realStepsCompleted = chapter.etapes.filter(e => e.completed === true).length;
        const totalRealSteps = chapter.etapes.length;
        const allRealStepsCompleted = realStepsCompleted === totalRealSteps;
        
        // Total = Objectifs + vraies étapes + Portfolio
        const totalSteps = totalRealSteps + 2;
        const completedSteps = (objectifsCompleted ? 1 : 0) + realStepsCompleted + (portfolioCompleted ? 1 : 0);
        const progressPercentage = Math.round((completedSteps / totalSteps) * 100);
        
        Logger.debug(`📊 Progression ${chapitreId}: Objectifs=${objectifsCompleted}, Étapes=${realStepsCompleted}/${totalRealSteps}, Portfolio=${portfolioCompleted} → ${completedSteps}/${totalSteps} (${progressPercentage}%)`);
        
        const container = document.getElementById('app-content');
        if (!container) {
            Logger.error('❌ Container #app-content manquant');
            return;
        }
        
        // ══════════════════════════════════════════════════════════════
        // GÉNÉRATION HTML
        // ══════════════════════════════════════════════════════════════
        
        // Header du chapitre
        let html = `
            <div class="chapter-view">
                <button class="btn btn--secondary" onclick="App.loadPage('chapitres')" style="margin-bottom: 20px;">
                    ← Retour
                </button>
                
                <div class="chapter-progress">
                    <h2>${chapter.emoji || '📖'} ${chapter.titre || chapter.id}</h2>
                    <div class="progress-bar" style="margin: 20px 0;">
                        <div class="progress-fill" style="width: ${progressPercentage}%; background-color: ${chapter.couleur || '#4caf50'};"></div>
                    </div>
                    <p style="text-align: center; color: #666;">
                        ${completedSteps}/${totalSteps} étapes complétées (${progressPercentage}%)
                    </p>
                </div>
                
                <div class="steps-list" style="margin-top: 30px;">
        `;
        
        // ══════════════════════════════════════════════════════════════
        // 1. ÉTAPE OBJECTIFS (toujours en premier, toujours accessible)
        // ══════════════════════════════════════════════════════════════
        const objectifsIcon = objectifsCompleted ? '✅' : '📋';
        const objectifsBgColor = objectifsCompleted ? '#d4edda' : '#fff3cd';
        const objectifsBorderColor = objectifsCompleted ? '#28a745' : '#ffc107';
        
        html += `
            <div class="step-item step-objectives" style="padding: 15px; border: 2px solid ${objectifsBorderColor}; border-radius: 8px; margin-bottom: 12px; background: ${objectifsBgColor};">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div class="step-icon" style="font-size: 1.8em;">${objectifsIcon}</div>
                    <div style="flex: 1;">
                        <h3 style="margin: 0 0 5px 0; color: #333;">📋 Objectifs du chapitre</h3>
                        <p style="margin: 0; color: #666; font-size: 0.9em;">Découvrez les objectifs pédagogiques de ce chapitre</p>
                    </div>
                    <button 
                        class="btn btn--primary"
                        onclick="App.afficherModalObjectives('${chapitreId}')"
                        style="padding: 10px 20px; background: #6B5B95; color: white; border: none; border-radius: 6px; cursor: pointer;"
                    >
                        ${objectifsCompleted ? '✓ Revoir' : '▶ Consulter'}
                    </button>
                </div>
            </div>
        `;
        
        // ══════════════════════════════════════════════════════════════
        // 2. VRAIES ÉTAPES (depuis chapter.etapes[])
        // ══════════════════════════════════════════════════════════════
        chapter.etapes.forEach((step, idx) => {
            const stepState = StorageManager.getEtapeState(chapitreId, idx);
            const isCompleted = stepState?.completed === true || step.completed === true;
            
            // Logique de verrouillage : 
            // - Étape 0 accessible si Objectifs complétés
            // - Autres étapes accessibles si précédente complétée
            let accessible = false;
            if (idx === 0) {
                accessible = objectifsCompleted;
            } else {
                const prevStepState = StorageManager.getEtapeState(chapitreId, idx - 1);
                accessible = prevStepState?.completed === true || chapter.etapes[idx - 1]?.completed === true;
            }
            
            // Si déjà complétée, toujours accessible
            if (isCompleted) accessible = true;
            
            const stepIcon = isCompleted ? '✅' : (accessible ? '⚡' : '🔒');
            const bgColor = isCompleted ? '#d4edda' : (accessible ? '#fff' : '#f5f5f5');
            const borderColor = isCompleted ? '#28a745' : (accessible ? '#ddd' : '#ccc');
            const opacity = accessible ? '1' : '0.6';
            
            html += `
                <div class="step-item" data-step="${chapitreId}_${idx}" style="padding: 15px; border: 1px solid ${borderColor}; border-radius: 6px; margin-bottom: 12px; background: ${bgColor}; opacity: ${opacity};">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="step-icon" style="font-size: 1.5em;">${stepIcon}</div>
                        <div style="flex: 1;">
                            <h3 style="margin: 0 0 5px 0;">Étape ${idx + 1}: ${step.titre || ''}</h3>
                            <p style="margin: 0; color: #666; font-size: 0.9em;">${step.contenu || step.description || ''}</p>
                        </div>
                        <button 
                            class="btn btn--primary"
                            onclick="App.afficherEtape('${chapitreId}', ${idx})"
                            ${!accessible ? 'disabled' : ''}
                            style="padding: 10px 20px; background: ${accessible ? '#4A3F87' : '#ccc'}; color: white; border: none; border-radius: 6px; cursor: ${accessible ? 'pointer' : 'not-allowed'};"
                        >
                            ${isCompleted ? '✓ Revoir' : (accessible ? '▶ Accéder' : '🔒 Verrouillée')}
                        </button>
                    </div>
                </div>
            `;
        });
        
        // ══════════════════════════════════════════════════════════════
        // 3. ÉTAPE PORTFOLIO (toujours en dernier, verrouillée si étapes incomplètes)
        // ══════════════════════════════════════════════════════════════
        const portfolioAccessible = allRealStepsCompleted;
        const portfolioIcon = portfolioCompleted ? '✅' : (portfolioAccessible ? '🎯' : '🔒');
        const portfolioBgColor = portfolioCompleted ? '#d4edda' : (portfolioAccessible ? '#e8f4fd' : '#f5f5f5');
        const portfolioBorderColor = portfolioCompleted ? '#28a745' : (portfolioAccessible ? '#FF6B9D' : '#ccc');
        const portfolioOpacity = portfolioAccessible ? '1' : '0.6';
        
        html += `
            <div class="step-item step-portfolio" style="padding: 15px; border: 2px solid ${portfolioBorderColor}; border-radius: 8px; margin-bottom: 12px; background: ${portfolioBgColor}; opacity: ${portfolioOpacity};">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div class="step-icon" style="font-size: 1.8em;">${portfolioIcon}</div>
                    <div style="flex: 1;">
                        <h3 style="margin: 0 0 5px 0; color: #333;">🎯 Portfolio - Plan de révision</h3>
                        <p style="margin: 0; color: #666; font-size: 0.9em;">Évaluez votre maîtrise des objectifs et créez votre plan de révision</p>
                    </div>
                    <button 
                        class="btn btn--primary"
                        onclick="App.afficherPortfolioModal('${chapitreId}')"
                        ${!portfolioAccessible ? 'disabled' : ''}
                        style="padding: 10px 20px; background: ${portfolioAccessible ? '#FF6B9D' : '#ccc'}; color: white; border: none; border-radius: 6px; cursor: ${portfolioAccessible ? 'pointer' : 'not-allowed'};"
                    >
                        ${portfolioCompleted ? '✓ Revoir' : (portfolioAccessible ? '▶ Accéder' : '🔒 Verrouillée')}
                    </button>
                </div>
            </div>
        `;
        
        // Fermer les divs
        html += `
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        Logger.debug(`✅ Chapitre ${chapitreId} affiché avec ${totalSteps} étapes (Objectifs + ${totalRealSteps} étapes + Portfolio)`);
        
        // 🔷 METTRE À JOUR LES ICÔNES VISUELLEMENT APRÈS RENDU
        // Ceci assure que les couleurs/icônes reflètent l'état réel du localStorage
        setTimeout(() => {
            chapter.etapes.forEach((step, idx) => {
                const stepState = StorageManager.getEtapeState(chapitreId, idx);
                const stepElement = document.querySelector(`[data-step="${chapitreId}_${idx}"]`);
                
                if (stepElement && stepState) {
                    const isCompleted = stepState.completed === true;
                    const stepIcon = stepElement.querySelector('.step-icon');
                    const bgColor = isCompleted ? '#d4edda' : '#fff';
                    const borderColor = isCompleted ? '#28a745' : '#ddd';
                    
                    if (stepIcon) {
                        stepIcon.textContent = isCompleted ? '✅' : '⚡';
                    }
                    
                    stepElement.style.background = bgColor;
                    stepElement.style.borderColor = borderColor;
                    
                    Logger.debug(`🎨 Mise à jour icône étape ${idx}: ${isCompleted ? 'complétée ✅' : 'accessible ⚡'}`);
                }
            });
            
            // Mettre à jour aussi les icônes des étapes Objectifs et Portfolio
            const objectifsElement = document.querySelector('.step-objectives');
            if (objectifsElement) {
                const objectifsStatus = StorageManager?.getObjectifsStatus?.(chapitreId);
                const isCompleted = objectifsStatus?.completed === true || chapter.objectifsCompleted === true;
                const icon = objectifsElement.querySelector('.step-icon');
                
                if (icon) {
                    icon.textContent = isCompleted ? '✅' : '📋';
                }
                
                objectifsElement.style.background = isCompleted ? '#d4edda' : '#fff3cd';
                objectifsElement.style.borderColor = isCompleted ? '#28a745' : '#ffc107';
                Logger.debug(`🎨 Mise à jour Objectifs: ${isCompleted ? 'complétés ✅' : 'en attente 📋'}`);
            }
            
            const portfolioElement = document.querySelector('.step-portfolio');
            if (portfolioElement) {
                const portfolioStatus = StorageManager?.getPortfolioStatus?.(chapitreId);
                const allRealStepsCompleted = chapter.etapes.every(e => {
                    const state = StorageManager.getEtapeState(chapitreId, chapter.etapes.indexOf(e));
                    return state?.completed === true || e.completed === true;
                });
                
                const isCompleted = portfolioStatus?.completed === true || chapter.portfolioCompleted === true;
                const isAccessible = allRealStepsCompleted;
                const icon = portfolioElement.querySelector('.step-icon');
                
                if (icon) {
                    icon.textContent = isCompleted ? '✅' : (isAccessible ? '🎯' : '🔒');
                }
                
                portfolioElement.style.background = isCompleted ? '#d4edda' : (isAccessible ? '#e8f4fd' : '#f5f5f5');
                portfolioElement.style.borderColor = isCompleted ? '#28a745' : (isAccessible ? '#FF6B9D' : '#ccc');
                portfolioElement.style.opacity = isAccessible ? '1' : '0.6';
                Logger.debug(`🎨 Mise à jour Portfolio: ${isCompleted ? 'complété ✅' : (isAccessible ? 'accessible 🎯' : 'verrouillé 🔒')}`);
            }
        }, 50);
    },
    
    // ✅ MÉTHODE afficherNiveau DÉPLACÉE LIGNE 8254 - Version consolidée
    
    /**
     * Ajoute le bouton "Demander aide" aux exercices
     * @param {string} chapitreId - ID du chapitre actuel
     * @param {number} stepIndex - Index de l'étape actuelle
     */
    addTutoringHelpButton(chapitreId, stepIndex) {
        Logger.debug('[Tutoring] 🔍 Appelée avec:', chapitreId, stepIndex);
        
        // Ne créer qu'une seule fois
        if (document.querySelector('.tutoring-help-btn')) {
            Logger.debug('[Tutoring] Suppression bouton existant');
            document.querySelector('.tutoring-help-btn').remove();
        }
        
        // Récupérer les infos
        Logger.debug('[Tutoring] Recherche chapitre:', chapitreId);
        const chapitre = this.findChapitreById(chapitreId);
        Logger.debug('[Tutoring] Chapitre trouvé?', !!chapitre);
        
        const etape = chapitre ? chapitre.etapes[stepIndex] : null;
        Logger.debug('[Tutoring] Étape trouvée?', !!etape);
        
        const questionTitle = etape ? `${etape.titre}` : 'Aide sur cet exercice';
        
        // Créer le bouton
        const button = document.createElement('button');
        button.className = 'tutoring-help-btn';
        button.innerHTML = '❓ Demander aide';
        button.title = 'Cliquez pour demander de l\'aide sur cet exercice';
        button.type = 'button';
        
        Logger.debug('[Tutoring] ✅ Bouton créé');
        
        // Ajouter l'événement click
        button.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            Logger.debug('[App] Clic bouton aide - TutoringModule disponible?', typeof TutoringModule);
            
            // Essayer d'ouvrir via la fonction globale d'abord
            if (typeof openTutoringModal !== 'undefined') {
                Logger.debug('[App] Ouverture via openTutoringModal()');
                openTutoringModal();
            } 
            // Sinon essayer directement TutoringModule
            else if (typeof TutoringModule !== 'undefined' && TutoringModule.showModal) {
                Logger.debug('[App] Ouverture via TutoringModule.showModal()');
                TutoringModule.showModal();
            } 
            // Fallback: Message d'erreur
            else {
                Logger.error('[App] ❌ Impossible d\'ouvrir le modal - TutoringModule non disponible');
                alert('Erreur: Module tutoring non chargé. Rechargez la page.');
            }
        };
        
        // Injecter le bouton dans le DOM
        document.body.appendChild(button);
        Logger.debug('[Tutoring] ✅ Bouton ajouté au DOM');
        
        // Vérification
        const check = document.querySelector('.tutoring-help-btn');
        Logger.debug('[Tutoring] ✅ Bouton dans le DOM?', !!check);
    },

    /**
     * Récupère l'état d'une étape depuis localStorage
     * @param {string} chapitreId - ID du chapitre
     * @param {number} stepIndex - Index de l'étape
     * @returns {Object} État de l'étape {status, score, visited, pointsAwarded}
     */
    getStepState(chapitreId, stepIndex) {
        const key = `step_${chapitreId}_${stepIndex}`;
        const saved = localStorage.getItem(key);
        
        if (!saved) {
            return {
                status: "locked",
                score: null,
                visited: false,
                pointsAwarded: false
            };
        }
        
        return JSON.parse(saved);
    },

    /**
     * Sauvegarde l'état d'une étape dans localStorage
     * @param {string} chapitreId - ID du chapitre
     * @param {number} stepIndex - Index de l'étape
     * @param {Object} stateObject - État à sauvegarder {status, score, visited, pointsAwarded}
     * @returns {boolean} true si succès, false si erreur
     */
    saveStepState(chapitreId, stepIndex, stateObject) {
        const key = `step_${chapitreId}_${stepIndex}`;
        try {
            localStorage.setItem(key, JSON.stringify(stateObject));
            return true;
        } catch (error) {
            Logger.error(`Erreur sauvegarde step ${key}:`, error);
            return false;
        }
    },

    /**
     * Vérifie si une étape est accessible (ordre strict)
     * @param {string} chapitreId - ID du chapitre
     * @param {number} stepIndex - Index de l'étape
     * @returns {boolean} true si l'étape est accessible, false sinon
     */
    canAccessStep(chapitreId, stepIndex) {
        // 1ère étape toujours accessible
        if (stepIndex === 0) {
            return true;
        }
        
        // Vérifier que l'étape précédente est complétée en utilisant StorageManager
        const previousStep = StorageManager.getEtapeState(chapitreId, stepIndex - 1);
        return previousStep?.completed === true;
    },

    /**
     * Calcule la progression d'un chapitre
     * @param {string} chapitreId - ID du chapitre
     * @returns {Object} {completed: nombre_complétées, total: nombre_total, percentage: pourcentage}
     */
    getChapterProgress(chapitreId) {
        const chapter = CHAPITRES.find(c => c.id === chapitreId);
        if (!chapter) {
            return { completed: 0, total: 0, percentage: 0 };
        }
        
        const totalSteps = chapter.etapes.length;
        let completedSteps = 0;
        
        for (let i = 0; i < totalSteps; i++) {
            const stepState = this.getStepState(chapitreId, i);
            if (stepState.status === "completed") {
                completedSteps++;
            }
        }
        
        const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
        
        return {
            completed: completedSteps,
            total: totalSteps,
            percentage: percentage
        };
    },

    /**
     * Met à jour l'icône d'une étape selon son statut
     * @param {string} chapitreId - ID du chapitre
     * @param {number} stepIndex - Index de l'étape
     */
    updateStepIcon(chapitreId, stepIndex) {
        const state = this.getStepState(chapitreId, stepIndex);
        const iconEl = document.querySelector(`[data-step="${chapitreId}_${stepIndex}"] .step-icon`);
        
        if (!iconEl) return;
        
        // Enlever les anciennes classes
        iconEl.classList.remove("locked", "in-progress", "completed");
        
        // Ajouter la nouvelle classe
        iconEl.classList.add(state.status);
        
        // Changer l'emoji
        switch (state.status) {
            case "locked":
                iconEl.textContent = "🔒";
                break;
            case "in-progress":
                iconEl.textContent = "⚡";
                break;
            case "completed":
                iconEl.textContent = "✅";
                break;
        }
    },

    /**
     * Marque une étape comme visitée/complétée (Type A)
     * @param {string} chapitreId - ID du chapitre
     * @param {number} stepIndex - Index de l'étape
     */
    markStepVisited(chapitreId, stepIndex) {
        const chapter = CHAPITRES.find(c => c.id === chapitreId);
        
        if (!chapter || !chapter.etapes[stepIndex]) {
            Logger.error(`❌ Étape non trouvée: ${chapitreId} index ${stepIndex}`);
            return;
        }
        
        const step = chapter.etapes[stepIndex];
        
        // Marquer comme complétée dans StorageManager
        StorageManager.saveEtapeState(chapitreId, stepIndex, {
            completed: true,
            status: 'completed',
            visited: true,
            completedAt: new Date().toISOString(),
            score: 100  // Consultation = score auto 100%
        });
        
        // Synchroniser avec localStorage
        const stepKey = `step_${chapitreId}_${stepIndex}`;
        localStorage.setItem(stepKey, JSON.stringify({
            status: 'completed',
            score: 100,
            visited: true,
            pointsAwarded: true
        }));
        
        // Donner les points (1 seule fois)
        const oldState = StorageManager.getEtapeState(chapitreId, stepIndex) || {};
        if (!oldState.pointsAwarded && step.points) {
            this.addPoints(step.points, `${chapitreId} étape ${stepIndex}`);
            Logger.debug(`✅ Points gagnés: ${step.points} pts pour ${chapitreId} étape ${stepIndex}`);
        }
        
        // Déverrouiller étape suivante
        this.unlockNextStep(chapitreId, stepIndex);
        
        // Mettre à jour l'icône
        this.updateStepIcon(chapitreId, stepIndex);
        
        // 🔧 FIX: Mettre à jour la progression du chapitre
        this.updateChapterProgress(chapitreId);
        
        Logger.debug(`✅ Étape ${stepIndex} marquée comme complétée pour ${chapitreId}`);
    },

    /**
     * Marque une étape comme tentée avec score (Type B: QCM, Quiz, etc)
     * @param {string} chapitreId - ID du chapitre
     * @param {number} stepIndex - Index de l'étape
     * @param {number} score - Score obtenu (0-100)
     * @returns {Object} État mis à jour
     */
    markStepAttempted(chapitreId, stepIndex, score) {
        const chapter = CHAPITRES.find(c => c.id === chapitreId);
        
        if (!chapter || !chapter.etapes[stepIndex]) {
            Logger.error(`❌ Étape non trouvée: ${chapitreId} index ${stepIndex}`);
            return null;
        }
        
        const step = chapter.etapes[stepIndex];
        const passingScore = step.passingScore || 80;
        
        // 🔴 TOUJOURS lire de StorageManager (source de vérité)
        let state = StorageManager.getEtapeState(chapitreId, stepIndex);
        
        // ✅ Si state est null, initialiser avec un objet vide
        if (!state) {
            state = {
                visited: false,
                completed: false,
                status: 'not_started',
                score: 0,
                pointsAwarded: false
            };
        }
        
        // Garder le MEILLEUR score
        if (!state.score || score > state.score) {
            state.score = score;
            Logger.debug(`📊 Score enregistré: ${score}% pour ${chapitreId} étape ${stepIndex}`);
        }
        
        state.visited = true;
        
        if (score >= passingScore) {
            // ✅ RÉUSSI - Marquer comme complétée
            state.status = "completed";
            state.completed = true;
            Logger.debug(`✅ RÉUSSI! Score ${score}% >= ${passingScore}% pour ${chapitreId} étape ${stepIndex}`);
            
            // Donner les points (1 seule fois)
            if (!state.pointsAwarded && step.points) {
                this.addPoints(step.points, `${chapitreId} étape ${stepIndex}`);
                state.pointsAwarded = true;
                Logger.debug(`🏆 Points gagnés: ${step.points} pts pour ${chapitreId} étape ${stepIndex}`);
            }
        } else {
            // ❌ ÉCHOUÉ - Marquer comme en cours
            state.status = "in_progress";
            Logger.debug(`❌ ÉCHOUÉ. Score ${score}% < ${passingScore}% pour ${chapitreId} étape ${stepIndex}`);
        }
        
        // 🔷 Sauvegarder dans StorageManager
        StorageManager.saveEtapeState(chapitreId, stepIndex, state);
        
        // 🔷 Synchroniser à localStorage aussi
        const stepKey = `step_${chapitreId}_${stepIndex}`;
        localStorage.setItem(stepKey, JSON.stringify(state));
        Logger.debug(`[saveStepState] Données sauvegardées pour ${stepKey}`);
        
        // 🔷 Si réussi, déverrouiller l'étape suivante
        if (score >= passingScore) {
            this.unlockNextStep(chapitreId, stepIndex);
        }
        
        // Mettre à jour l'icône
        this.updateStepIcon(chapitreId, stepIndex);
        
        // 🔧 FIX: Mettre à jour la progression du chapitre
        this.updateChapterProgress(chapitreId);
        
        return state;
    },

    /**
     * Déverrouille l'étape suivante quand l'étape actuelle est complétée
     * @param {string} chapitreId - ID du chapitre
     * @param {number} stepIndex - Index de l'étape complétée
     */
    unlockNextStep(chapitreId, stepIndex) {
        const chapter = CHAPITRES.find(c => c.id === chapitreId);
        if (!chapter) {
            Logger.error(`❌ Chapitre ${chapitreId} non trouvé`);
            return;
        }
        
        const nextIndex = stepIndex + 1;
        
        // Vérifier que l'étape suivante existe
        if (nextIndex >= chapter.etapes.length) {
            Logger.debug(`✅ Chapitre "${chapter.titre || chapitreId}" complété! Pas d'étape suivante.`);
            return;
        }
        
        // Déverrouiller l'étape suivante en utilisant StorageManager
        const nextEtapeState = StorageManager.getEtapeState(chapitreId, nextIndex) || {};
        if (!nextEtapeState.completed) {
            StorageManager.saveEtapeState(chapitreId, nextIndex, {
                ...nextEtapeState,
                status: "in_progress",
                unlocked: true
            });
            
            // Synchroniser aussi avec localStorage
            const nextStepKey = `step_${chapitreId}_${nextIndex}`;
            localStorage.setItem(nextStepKey, JSON.stringify({
                status: 'in_progress',
                score: null,
                visited: false,
                pointsAwarded: false
            }));
            
            this.updateStepIcon(chapitreId, nextIndex);
            Logger.debug(`🔓 Étape ${nextIndex} déverrouillée pour ${chapitreId}!`);
        }
    },
    
    /**
     * Affiche une modal de consultation (Type A - Objectifs, Vidéos, Lectures, Portfolio)
     * @param {string} chapitreId - ID du chapitre
     * @param {number} stepIndex - Index de l'étape
     * @param {Object} step - Objet étape
     */
    renderConsultModal(chapitreId, stepIndex, step) {
        // 🔧 GÉRER PLUSIEURS FORMATS: texte simple OU structure complexe
        const titreTape = step.titre || step.title || 'Étape';
        
        // 1. Format simple: step.contenu (texte brut)
        let contenuHTML = '';
        if (step.contenu) {
            contenuHTML = `
                <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #4A3F87;">
                    <p style="font-size: 1em; line-height: 1.8; color: #333; margin: 0; white-space: pre-wrap;">${step.contenu}</p>
                </div>
            `;
        }
        // 2. Format structuré: step.content avec {title, introduction, sections, keyTakeaway}
        else if (step.content && typeof step.content === 'object') {
            const content = step.content;
            
            // Titre du contenu
            if (content.title) {
                contenuHTML += `<h3 style="color: #4A3F87; margin-bottom: 15px;">${content.title}</h3>`;
            }
            
            // Introduction
            if (content.introduction) {
                contenuHTML += `<p style="font-size: 1.1em; line-height: 1.6; color: #555; margin-bottom: 25px;">${content.introduction}</p>`;
            }
            
            // Sections
            if (content.sections && Array.isArray(content.sections)) {
                content.sections.forEach(section => {
                    contenuHTML += `
                        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #667eea;">
                            ${section.heading ? `<h4 style="color: #333; margin-bottom: 12px;">${section.heading}</h4>` : ''}
                            ${section.text ? `<div style="font-size: 1em; line-height: 1.8; color: #333; white-space: pre-wrap;">${section.text}</div>` : ''}
                        </div>
                    `;
                });
            }
            
            // Key Takeaway
            if (content.keyTakeaway) {
                contenuHTML += `
                    <div style="background: linear-gradient(135deg, #667eea15, #764ba215); padding: 20px; border-radius: 8px; margin-top: 25px; border: 2px solid #667eea;">
                        <p style="font-size: 1em; line-height: 1.6; color: #333; margin: 0;">${content.keyTakeaway}</p>
                    </div>
                `;
            }
            
            // Vidéo
            if (content.videoUrl) {
                let videoHtml = '';
                const videoUrl = content.videoUrl;
                
                // Détecter si c'est une vidéo YouTube
                if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
                    let embedUrl = videoUrl;
                    if (videoUrl.includes('watch?v=')) {
                        const ytId = videoUrl.split('v=')[1]?.split('&')[0];
                        embedUrl = `https://www.youtube-nocookie.com/embed/${ytId}`;
                    } else if (videoUrl.includes('youtu.be/')) {
                        const ytId = videoUrl.split('youtu.be/')[1]?.split('?')[0];
                        embedUrl = `https://www.youtube-nocookie.com/embed/${ytId}`;
                    }
                    videoHtml = `<iframe width="100%" height="450" src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="border-radius: 8px;"></iframe>`;
                } else {
                    videoHtml = `<video controls style="width: 100%; max-height: 500px;"><source src="${videoUrl}" type="video/mp4">Votre navigateur ne supporte pas les vidéos.</video>`;
                }
                
                contenuHTML += `
                    <div style="background: #000; padding: 0; border-radius: 8px; margin: 20px 0; overflow: hidden;">
                        ${videoHtml}
                        ${content.videoTitle ? `<p style="padding: 10px; background: #333; color: white; margin: 0;">${content.videoTitle} - ${content.duration || ''}</p>` : ''}
                    </div>
                `;
            }
            
            // Image
            if (content.imageUrl) {
                contenuHTML += `
                    <div style="text-align: center; margin: 20px 0;">
                        ${content.title ? `<h4 style="color: #333; margin-bottom: 15px;">${content.title}</h4>` : ''}
                        <img src="${content.imageUrl}" alt="${content.title || 'Infographie'}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" onerror="this.style.display='none'; this.insertAdjacentHTML('afterend', '<p style=color:red>❌ Image non trouvée: ${content.imageUrl}</p>')">
                    </div>
                `;
            }
        }
        
        // Créer le contenu HTML de la modal
        const modalHTML = `
            <div class="modal-overlay consult-modal" id="consult-modal">
                <div class="modal-content" style="background: white; border-radius: 0; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; margin: 0; padding: 0;">
                    
                    <!-- HEADER FIXE -->
                    <div class="exercise-modal-header">
                        <div>
                            <h2>${titreTape}</h2>
                            <p>⏱️ ${step.duree || '-'}</p>
                        </div>
                        <button class="btn-close" onclick="App.showBottomNav(); document.getElementById('consult-modal').remove()">✕</button>
                    </div>
                    
                    <!-- CONTENU SCROLLABLE -->
                    <div class="modal-body" style="padding: 30px; padding-top: 80px; overflow-y: auto; flex: 1; margin-bottom: 80px;">
                        ${contenuHTML}
                        
                        <!-- Afficher les exercices de consultation (vidéos, lectures) -->
                        <div id="consult-exercises">
                            <!-- Les exercices seront renderisés ici -->
                        </div>
                    </div>
                    
                    <!-- FOOTER FIXE -->
                    <div class="modal-footer" style="background: transparent; padding: 20px; display: flex; gap: 12px; justify-content: space-between; align-items: center; border-top: 1px solid #ddd; flex-shrink: 0; position: fixed; bottom: 0; left: 0; right: 0; z-index: 1001; margin: 0;">
                        <button class="btn btn--secondary" onclick="App.showBottomNav(); document.getElementById('consult-modal').remove()" style="padding: 10px 20px; border: 1px solid #ddd; border-radius: 6px; background: white; cursor: pointer;">
                            ← Fermer
                        </button>
                        <div style="display: flex; gap: 12px;">
                            <button class="btn btn--primary" onclick="App.showBottomNav(); App.markStepVisited('${chapitreId}', ${stepIndex}); document.getElementById('consult-modal')?.remove(); if (App.returnPath === 'pratique') { App.returnPath = null; App.loadPage('pratique'); } else { App.afficherChapitre('${chapitreId}'); }" style="padding: 10px 20px; background: #4A3F87; color: white; border: none; border-radius: 6px; cursor: pointer;">
                                ✅ Marquer comme complétée
                            </button>
                            <button class="btn btn--primary" onclick="if (typeof openTutoringModal !== 'undefined') { openTutoringModal(); } else if (typeof TutoringModule !== 'undefined' && TutoringModule.showModal) { TutoringModule.showModal(); } else { alert('Erreur: Module tutoring non chargé'); }" style="padding: 10px 20px; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                                ❓ Demander aide
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Injecter dans le DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // 🙈 Cacher la barre de navigation pendant l'exercice
        this.hideBottomNav();
        
        // Styliser l'overlay (fond semi-transparent)
        const overlay = document.getElementById('consult-modal');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            display: block;
            z-index: 1000;
            margin: 0;
            padding: 0;
        `;
        
        // 🔧 Remplir les exercices de consultation si présents
        this.renderConsultExercises(chapitreId, stepIndex, step);
        
        Logger.debug(`📖 Modal Type A affichée: ${titreTape}`);
    },
    
    /**
     * Rend les exercices de consultation (vidéos, lectures) dans la modal
     */
    renderConsultExercises(chapitreId, stepIndex, step) {
        if (!step.exercices || step.exercices.length === 0) {
            return;
        }
        
        const container = document.getElementById('consult-exercises');
        if (!container) {
            Logger.error('❌ Container consult-exercises NOT FOUND!');
            return;
        }
        
        Logger.debug(`🎬 renderConsultExercises: ${step.exercices.length} exercice(s)`);
        
        let exercicesHTML = '';
        
        step.exercices.forEach((exo, idx) => {
            const type = exo.type;
            const titre = exo.titre || 'Exercice';
            const description = exo.description || '';
            
            Logger.debug(`📝 Exercice ${idx}: type=${type}, titre=${titre}`);
            
            if (type === 'video') {
                // Afficher la vidéo
                let videoType = exo.content?.videoType;
                let videoUrl = exo.content?.url || exo.url;  // Chercher url au niveau racine aussi
                const videoDescription = exo.content?.description || '';
                // Chercher le videoId: d'abord dans exo, sinon dans la step
                const videoId = exo.videoId || step.videoId;
                
                Logger.debug(`🎬 Vidéo détectée: videoId=${videoId}, type=${videoType}, url=${videoUrl}`);
                
                // Si les données vidéo manquent, chercher dans le manifest
                if (!videoType && !videoUrl && videoId) {
                    Logger.debug(`📺 Cherche vidéo ${videoId} dans le manifest...`);
                    // Le manifest est chargé globalement
                    if (window.videoManifest) {
                        const video = window.videoManifest.videos?.find(v => v.id === videoId);
                        if (video) {
                            videoType = video.sources?.['720p'] ? 'local' : 'youtube';
                            videoUrl = video.sources?.['720p'] || video.sources?.['480p'];
                            // Résoudre les chemins relatifs: ../file.mp4 → /assets/videos/file.mp4
                            if (videoUrl && videoUrl.startsWith('../')) {
                                videoUrl = `/assets/videos/${videoUrl.slice(3)}`;
                            }
                            Logger.debug(`✅ Vidéo trouvée: ${videoUrl}`);
                        }
                    }
                }
                
                // ✅ DÉTERMINE le type de vidéo si pas encore défini
                if (!videoType && videoUrl) {
                    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
                        videoType = 'youtube';
                    } else if (videoUrl.endsWith('.mp4') || videoUrl.endsWith('.webm') || videoUrl.endsWith('.ogg')) {
                        videoType = 'local';
                    }
                    Logger.debug(`🔍 Type détecté auto: ${videoType} (URL: ${videoUrl})`);
                }
                
                Logger.debug(`🎬 Vidéo finale:`, {videoType, videoUrl, videoDescription});
                
                if (videoType === 'youtube') {
                    // YouTube iframe - extraction robuste de l'ID
                    let iframeUrl = videoUrl;
                    
                    // Extraire l'ID YouTube de différents formats
                    if (videoUrl.includes('watch?v=')) {
                        // Format: https://www.youtube.com/watch?v=jNQXAC9IVRw
                        const ytId = videoUrl.split('v=')[1]?.split('&')[0];
                        if (ytId) iframeUrl = `https://www.youtube-nocookie.com/embed/${ytId}`;
                    } else if (videoUrl.includes('youtu.be/')) {
                        // Format: https://youtu.be/jNQXAC9IVRw
                        const ytId = videoUrl.split('youtu.be/')[1]?.split('?')[0];
                        if (ytId) iframeUrl = `https://www.youtube-nocookie.com/embed/${ytId}`;
                    } else if (!videoUrl.includes('/embed/')) {
                        // Extraction par regex en dernier recours
                        const match = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\s]{11})/);
                        if (match && match[1]) iframeUrl = `https://www.youtube-nocookie.com/embed/${match[1]}`;
                    }
                    
                    Logger.debug(`✅ YouTube URL finale: ${iframeUrl}`);
                    
                    exercicesHTML += `
                        <div style="margin-bottom: 30px; padding: 20px; background: #f0f0f0; border-radius: 8px;">
                            <h3 style="margin: 0 0 10px 0; color: #4A3F87;">🎬 ${titre}</h3>
                            ${description ? `<p style="margin: 0 0 15px 0; font-size: 0.9em; color: #666;">${description}</p>` : ''}
                            <iframe width="100%" height="550" src="${iframeUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="border-radius: 8px;"></iframe>
                        </div>
                    `;
                } else if (videoType === 'local') {
                    // Vidéo locale
                    exercicesHTML += `
                        <div style="margin-bottom: 30px; padding: 20px; background: #f0f0f0; border-radius: 8px;">
                            <h3 style="margin: 0 0 10px 0; color: #4A3F87;">🎬 ${titre}</h3>
                            ${description ? `<p style="margin: 0 0 15px 0; font-size: 0.9em; color: #666;">${description}</p>` : ''}
                            <video width="100%" height="550" controls style="border-radius: 8px; background: #000;">
                                <source src="${videoUrl}" type="video/mp4">
                                Votre navigateur ne supporte pas les vidéos.
                            </video>
                        </div>
                    `;
                } else {
                    // Vidéo sans type détecté
                    exercicesHTML += `
                        <div style="margin-bottom: 30px; padding: 20px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 8px;">
                            <h3 style="margin: 0 0 10px 0; color: #ff9800;">🎬 ${titre}</h3>
                            <p style="margin: 0; color: #666;">⚠️ Vidéo non trouvée ou format non supporté</p>
                        </div>
                    `;
                }
            } else if (type === 'lecture') {
                // Afficher le texte de lecture
                const lectureText = exo.content?.text || '';
                exercicesHTML += `
                    <div style="margin-bottom: 30px; padding: 20px; background: #fffacd; border-left: 4px solid #ff9800; border-radius: 8px;">
                        <h3 style="margin: 0 0 10px 0; color: #ff9800;">📚 ${titre}</h3>
                        ${description ? `<p style="margin: 0 0 15px 0; font-size: 0.9em; color: #666;">${description}</p>` : ''}
                        <p style="margin: 0; line-height: 1.8; white-space: pre-wrap; color: #333;">${lectureText}</p>
                    </div>
                `;
            } else if (type === 'flashcards') {
                // Afficher les flashcards
                const cards = exo.content?.cards || [];
                const instruction = exo.content?.instruction || '';
                exercicesHTML += `
                    <div style="margin-bottom: 30px;">
                        <h3 style="margin: 0 0 15px 0; color: #4A3F87;">🗂️ ${titre}</h3>
                        ${instruction ? `<p style="margin: 0 0 15px 0; font-size: 0.9em; color: #666;">${instruction}</p>` : ''}
                        <div style="display: grid; gap: 15px;">
                            ${cards.map((card, cidx) => `
                                <div style="padding: 15px; background: white; border: 2px solid #4A3F87; border-radius: 8px; cursor: pointer; transition: all 0.3s;" 
                                     onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" 
                                     onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none'">
                                    <div style="color: #666; font-size: 0.9em; margin-bottom: 8px;">❓ ${card.frontText || card.recto || 'Question'}</div>
                                    <div style="background: #f0f0f0; padding: 10px; border-radius: 4px; color: #333; font-weight: 500;">✅ ${card.backText || card.verso || 'Réponse'}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        });
        
        Logger.debug(`✅ HTML généré: ${exercicesHTML.length} caractères`);
        container.innerHTML = exercicesHTML;
        Logger.debug(`✅ ${step.exercices.length} exercice(s) de consultation rendus`);
    },
    
    /**
     * Affiche une modal d'exercice (Type B - QCM, Flashcards, Quiz)
     * @param {string} chapitreId - ID du chapitre
     * @param {number} stepIndex - Index de l'étape
     * @param {Object} step - Objet étape
     */
    renderExerciseModal(chapitreId, stepIndex, step) {
        // 🔧 ADAPTER à la vraie structure: step.exercices[0] au lieu de step.content
        if (!step.exercices || step.exercices.length === 0) {
            Logger.error('❌ Pas d\'exercice dans cette étape');
            alert('Aucun exercice à afficher');
            return;
        }
        
        const exercice = step.exercices[0]; // Premier exercice
        const titreTape = step.titre || step.title || 'Exercice';
        const typeExo = exercice.type;
        
        // ========== DÉTERMINER TYPE D'ÉTAPE ==========
        // CONSULTATION: video, lecture, objectives, portfolio
        // VALIDATION: qcm, qcm_scenario, quiz, assessment, scenario, calculation
        const CONSULTATION_TYPES = ['video', 'lecture', 'objectives', 'portfolio', 'flashcards'];
        const VALIDATION_TYPES = ['qcm', 'qcm_scenario', 'quiz', 'assessment', 'scenario', 'calculation'];
        
        const isConsultation = CONSULTATION_TYPES.includes(typeExo) || step.consultation === true;
        const isValidation = VALIDATION_TYPES.includes(typeExo) || step.validation === true;
        
        Logger.debug(`[🔍 MODAL] ${titreTape} | Consultation: ${isConsultation}, Validation: ${isValidation}`);
        
        // Générer le contenu HTML selon le type d'exercice
        let contenuExerciceHTML = '';
        
        if (typeExo === 'qcm' || typeExo === 'qcm_scenario') {
            // Vérifier si c'est un quiz multi-questions ou un QCM simple
            const hasMultipleQuestions = exercice.content?.questions && exercice.content.questions.length > 0;
            
            if (hasMultipleQuestions) {
                // Quiz avec plusieurs questions - utiliser renderExerciceQuiz
                contenuExerciceHTML = this.renderExerciceQuiz(exercice);
            } else {
                // QCM simple avec une seule question
                const question = exercice.content?.question || '';
                const options = exercice.content?.options || [];
                
                contenuExerciceHTML = `
                    <div style="margin-bottom: 20px;">
                        <h3 style="margin: 0 0 15px 0; font-size: 1.1em; color: #333;">${question}</h3>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            ${options.map((opt, idx) => `
                                <label style="display: flex; align-items: center; padding: 12px; border: 2px solid #ddd; border-radius: 6px; cursor: pointer; transition: all 0.2s; background: white;" 
                                       onmouseover="this.style.background='#f0f0f0'; this.style.borderColor='#4A3F87';" 
                                       onmouseout="this.style.background='white'; this.style.borderColor='#ddd';">
                                    <input type="radio" name="qcm_answer" value="${idx}" style="margin-right: 12px; cursor: pointer; width: 18px; height: 18px;">
                                    <span style="flex: 1; color: #333;">${opt.label}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        } else if (typeExo === 'quiz') {
            // Quiz: utiliser le rendu spécifique
            contenuExerciceHTML = this.renderExerciceQuiz(exercice);
        } else if (typeExo === 'flashcards') {
            // Flashcards: utiliser la vraie fonction de rendu
            contenuExerciceHTML = this.renderExerciceFlashcards(exercice);
        } else if (typeExo === 'lecture') {
            // Lecture: afficher le texte
            const texte = exercice.content?.text || '';
            
            contenuExerciceHTML = `
                <div style="padding: 20px; background: #fffacd; border-left: 4px solid #ff9800; border-radius: 8px;">
                    <p style="margin: 0; line-height: 1.8; white-space: pre-wrap; color: #333;">${texte}</p>
                </div>
                <p style="margin-top: 15px; text-align: center; color: #666; font-style: italic;">Marquez l'étape comme complétée après avoir lu.</p>
            `;
        } else if (typeExo === 'video') {
            // Vidéo: afficher le lecteur avec détection YouTube vs local
            let videoType = exercice.content?.videoType;
            let videoUrl = exercice.content?.url || exercice.url;  // Fallback à exo.url
            const videoDescription = exercice.content?.description || '';
            const videoId = exercice.videoId || step.videoId;
            
            // Si les données vidéo manquent, chercher dans le manifest
            if (!videoType && !videoUrl && videoId) {
                if (window.videoManifest) {
                    const video = window.videoManifest.videos?.find(v => v.id === videoId);
                    if (video) {
                        videoType = video.sources?.['720p'] ? 'local' : 'youtube';
                        videoUrl = video.sources?.['720p'] || video.sources?.['480p'];
                        // Résoudre les chemins relatifs
                        if (videoUrl && videoUrl.startsWith('../')) {
                            videoUrl = `assets/videos/${videoUrl.slice(3)}`;
                        }
                    }
                }
            }
            
            // ✅ AUTO-DETECT le type de vidéo si pas encore défini
            if (!videoType && videoUrl) {
                if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
                    videoType = 'youtube';
                } else if (videoUrl.endsWith('.mp4') || videoUrl.endsWith('.webm') || videoUrl.endsWith('.ogg')) {
                    videoType = 'local';
                }
            }
            
            if (videoType === 'youtube') {
                // YouTube iframe - extraction robuste de l'ID
                let iframeUrl = videoUrl;
                
                // Extraire l'ID YouTube de différents formats
                if (videoUrl.includes('watch?v=')) {
                    const ytId = videoUrl.split('v=')[1]?.split('&')[0];
                    if (ytId) iframeUrl = `https://www.youtube-nocookie.com/embed/${ytId}`;
                } else if (videoUrl.includes('youtu.be/')) {
                    const ytId = videoUrl.split('youtu.be/')[1]?.split('?')[0];
                    if (ytId) iframeUrl = `https://www.youtube-nocookie.com/embed/${ytId}`;
                } else if (!videoUrl.includes('/embed/')) {
                    const match = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\s]{11})/);
                    if (match && match[1]) iframeUrl = `https://www.youtube-nocookie.com/embed/${match[1]}`;
                }
                
                Logger.debug(`✅ YouTube URL finale (modal): ${iframeUrl}`);
                
                contenuExerciceHTML = `
                    <div style="margin-bottom: 20px;">
                        ${videoDescription ? `<p style="margin: 0 0 15px 0; color: #666;">${videoDescription}</p>` : ''}
                        <iframe width="100%" height="550" src="${iframeUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="border-radius: 8px;"></iframe>
                    </div>
                    <p style="margin-top: 15px; text-align: center; color: #666; font-style: italic;">Marquez l'étape comme complétée après avoir regardé.</p>
                `
            } else if (videoType === 'local') {
                contenuExerciceHTML = `
                    <div style="margin-bottom: 20px;">
                        ${videoDescription ? `<p style="margin: 0 0 15px 0; color: #666;">${videoDescription}</p>` : ''}
                        <video width="100%" height="550" controls style="border-radius: 8px; background: #000;">
                            <source src="${videoUrl}" type="video/mp4">
                            Votre navigateur ne supporte pas les vidéos.
                        </video>
                    </div>
                    <p style="margin-top: 15px; text-align: center; color: #666; font-style: italic;">Marquez l'étape comme complétée après avoir regardé.</p>
                `
            } else {
                contenuExerciceHTML = `<p style="color: #666;">⚠️ Vidéo non trouvée ou format non supporté</p>`;
            }
        } else {
            // Type inconnu
            contenuExerciceHTML = `<p style="color: #666;">Type d'exercice non supporté: ${typeExo}</p>`;
        }
        
        // Créer la modal HTML
        const modalHTML = `
            <div class="modal-overlay exercise-modal" id="exercise-modal">
                <div class="modal-content" style="background: white; border-radius: 0; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;">
                    
                    <!-- HEADER FIXE -->
                    <div class="exercise-modal-header">
                        <div>
                            <h2>${titreTape}</h2>
                            <p>⏱️ ${step.duree || '-'} | 🎯 ${step.points || 0} pts</p>
                        </div>
                        <button class="btn-close" onclick="App.showBottomNav(); document.getElementById('exercise-modal').remove()">✕</button>
                    </div>
                    
                    <!-- CONTENU SCROLLABLE -->
                    <div class="modal-body" style="padding: 30px; padding-top: 80px; overflow-y: auto; flex: 1; margin-bottom: 80px;">
                        <div id="exercise-content">
                            ${contenuExerciceHTML}
                        </div>
                        
                        <div id="result-section" style="display: none; margin-top: 25px; padding: 20px; border-radius: 8px; border-left: 4px solid;">
                            <h3 id="result-title" style="margin: 0 0 10px 0; font-size: 1.3em;"></h3>
                            <p id="result-message" style="margin: 0; font-size: 1em;"></p>
                        </div>
                    </div>
                    
                    <!-- FOOTER FIXE -->
                    <div class="modal-footer" style="background: transparent; padding: 20px; display: flex; gap: 12px; justify-content: space-between; align-items: center; border-top: 1px solid #ddd; flex-shrink: 0; position: fixed; bottom: 0; left: 0; right: 0; z-index: 1001;">
                        <button class="btn btn--secondary" onclick="App.showBottomNav(); document.getElementById('exercise-modal').remove()" style="padding: 10px 20px; border: 1px solid #ddd; border-radius: 6px; background: white; cursor: pointer;">
                            ← Fermer
                        </button>
                        <div style="display: flex; gap: 12px;">
                            ${isConsultation ? `
                                <button class="btn btn--primary" id="btn-validate" onclick="App.showBottomNav(); completerEtapeConsultation('${chapitreId}', ${stepIndex}, {viewed: true}); document.getElementById('exercise-modal')?.remove(); setTimeout(() => { if (App.returnPath === 'pratique') { App.returnPath = null; App.loadPage('pratique'); } else { App.afficherChapitre('${chapitreId}'); } }, 500);" style="padding: 10px 20px; background: #4A3F87; color: white; border: none; border-radius: 6px; cursor: pointer;">
                                    ✅ Marquer comme complété
                                </button>
                            ` : `
                                <button class="btn btn--primary" id="btn-validate" onclick="App.validerExerciceRenderModal('${typeExo}', '${chapitreId}', ${stepIndex})" style="padding: 10px 20px; background: #4A3F87; color: white; border: none; border-radius: 6px; cursor: pointer;">
                                    🎯 Soumettre réponses
                                </button>
                            `}
                            <button class="btn btn--primary" id="btn-next" style="display: none; padding: 10px 20px; background: #2ECC71; color: white; border: none; border-radius: 6px; cursor: pointer;" onclick="(function() { App.showBottomNav(); const m=document.getElementById('exercise-modal'); if(m)m.remove(); setTimeout(() => { if (App.returnPath === 'pratique') { App.returnPath = null; App.loadPage('pratique'); } else { App.afficherChapitre('${chapitreId}'); } }, 300); })()">
                                ➜ Exercice suivant
                            </button>
                            <button class="btn btn--secondary" id="btn-retry" style="display: none; padding: 10px 20px; border: 2px solid #ff9800; background: white; color: #ff9800; border-radius: 6px; cursor: pointer; font-weight: bold;" onclick="document.getElementById('exercise-content').innerHTML = window.lastExerciseHTML; document.getElementById('result-section').style.display = 'none'; document.getElementById('btn-validate').style.display = 'block'; document.getElementById('btn-next').style.display = 'none'; document.getElementById('btn-retry').style.display = 'none';">
                                🔄 Réessayer
                            </button>
                            <button class="btn btn--primary" onclick="if (typeof openTutoringModal !== 'undefined') { openTutoringModal(); } else if (typeof TutoringModule !== 'undefined' && TutoringModule.showModal) { TutoringModule.showModal(); } else { alert('Erreur: Module tutoring non chargé'); }" style="padding: 10px 20px; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                                ❓ Demander aide
                            </button>
                        </div>
                </div>
            </div>
        `;
        
        // ✅ STOCKER pour le bouton retry (évite template literal imbriqué)
        window.lastExerciseHTML = contenuExerciceHTML;
        
        // Injecter dans le DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // 🙈 Cacher la barre de navigation pendant l'exercice
        this.hideBottomNav();
        
        // Styliser l'overlay
        const overlay = document.getElementById('exercise-modal');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            display: block;
            z-index: 1000;
            margin: 0;
            padding: 0;
        `
        
        // ✅ Si c'est une flashcard, les événements auront été attachés dans renderExerciceFlashcards()
        // Mais on doit re-attacher après insertion dans le DOM de la modal
        if (typeExo === 'flashcards') {
            setTimeout(() => {
                document.querySelectorAll('.flashcard-wrapper').forEach(wrapper => {
                    const inner = wrapper.querySelector('.flashcard-inner');
                    let isFlipped = false;
                    
                    // Clic pour retourner la carte
                    wrapper.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        isFlipped = !isFlipped;
                        inner.style.transform = isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
                    });
                    
                    // Hover pour feedback visuel
                    wrapper.addEventListener('mouseover', function() {
                        this.style.boxShadow = '0 12px 24px rgba(0,0,0,0.3)';
                        this.style.transform = 'translateY(-5px)';
                    });
                    
                    wrapper.addEventListener('mouseout', function() {
                        this.style.boxShadow = 'none';
                        this.style.transform = 'translateY(0)';
                    });
                });
            }, 150);
        }
        
        Logger.debug(`✏️ Modal Type B (${typeExo}) affichée: ${titreTape}`);
    },
    
    /**
     * Soumet l'exercice et affiche le résultat
     * @param {string} chapitreId - ID du chapitre
     * @param {number} stepIndex - Index de l'étape
     */
    submitExercise(chapitreId, stepIndex) {
        // 🎯 UTILISER LE SCORE DÉFINI PAR validerQCMSecurise() S'IL EXISTE
        let score = window.lastScore !== undefined ? window.lastScore : 0;
        
        // Si window.lastScore n'était pas défini, essayer de calculer le score
        if (window.lastScore === undefined) {
            if (typeof this.calculateScore === 'function') {
                score = this.calculateScore();
            } else if (typeof calculateScore === 'function') {
                score = calculateScore();
            } else {
                // Fallback: utiliser le score par défaut
                Logger.warn('⚠️ calculateScore() non trouvée - utilisation du score par défaut');
                score = 0;
            }
            window.lastScore = score;
        }
        
        Logger.debug(`📊 Score soumis: ${window.lastScore}%`);
        
        // Marquer la tentative
        const state = this.markStepAttempted(chapitreId, stepIndex, score);
        
        // Récupérer la modal et les éléments
        const resultSection = document.getElementById('result-section');
        const resultTitle = document.getElementById('result-title');
        const resultMessage = document.getElementById('result-message');
        const btnValidate = document.getElementById('btn-validate');
        const btnNext = document.getElementById('btn-next');
        const btnRetry = document.getElementById('btn-retry');
        
        const chapter = CHAPITRES.find(c => c.id === chapitreId);
        const step = chapter?.etapes[stepIndex];
        const points = step?.points || 0;
        
        // Afficher le résultat
        if (state.status === "completed") {
            // ✅ RÉUSSI (score >= 80%)
            resultTitle.textContent = '🎉 Bravo!';
            resultMessage.innerHTML = `
                <p style="margin: 8px 0;">Score: <strong style="font-size: 1.2em; color: #2ECC71;">${score}%</strong></p>
                <p style="margin: 8px 0;">💰 + ${points} points</p>
            `;
            resultSection.style.background = '#d4edda';
            resultSection.style.borderLeftColor = '#28a745';
            resultSection.style.display = 'block';
            
            btnValidate.style.display = 'none';
            btnRetry.style.display = 'none';
            btnNext.style.display = 'block';
            
            Logger.debug(`✅ RÉUSSI! Score ${score}% >= 80% | +${points} points`);
        } else {
            // ❌ ÉCHOUÉ (score < 80%)
            resultTitle.textContent = '❌ Score insuffisant';
            resultMessage.innerHTML = `
                <p style="margin: 8px 0;">Votre score: <strong style="font-size: 1.2em; color: #dc3545;">${score}%</strong></p>
                <p style="margin: 8px 0;">Minimum requis: <strong>80%</strong></p>
                <p style="margin: 12px 0 0 0; font-style: italic; opacity: 0.8;">Réessayez pour obtenir les points.</p>
            `;
            resultSection.style.background = '#f8d7da';
            resultSection.style.borderLeftColor = '#dc3545';
            resultSection.style.display = 'block';
            
            btnValidate.style.display = 'none';
            btnNext.style.display = 'none';
            btnRetry.style.display = 'block';
            
            Logger.debug(`❌ ÉCHOUÉ. Score ${score}% < 80% - Réessai possible`);
        }
    },
    
    /**
     * Affiche une étape (Router Type A vs Type B)
     * @param {string} chapitreId - ID du chapitre
     * @param {number} stepIndex - Index de l'étape
     */
    afficherEtape(chapitreId, stepIndex) {
        // 🔄 SAUVEGARDER LE CHEMIN DE RETOUR (d'où on vient)
        if (!this.returnPath) {
            this.returnPath = this.currentPage; // 'pratique', 'chapitre', 'accueil', etc.
            Logger.debug(`🔖 Chemin de retour défini: ${this.returnPath}`);
        }
        
        // Vérifier l'accès
        if (!this.canAccessStep(chapitreId, stepIndex)) {
            alert("🔒 Cette étape est verrouillée. Complétez l'étape précédente d'abord.");
            Logger.warn(`⛔ Accès refusé à l'étape ${stepIndex} du chapitre ${chapitreId}`);
            return;
        }
        
        // Récupérer le chapitre et l'étape
        const chapter = CHAPITRES.find(c => c.id === chapitreId);
        if (!chapter) {
            Logger.error(`❌ Chapitre ${chapitreId} non trouvé`);
            return;
        }
        
        const step = chapter.etapes[stepIndex];
        if (!step) {
            Logger.error(`❌ Étape non trouvée: ${chapitreId} - ${stepIndex}`);
            return;
        }
        
        // 🔧 AUTO-MAP: Si typeCategory n'existe pas, mapper depuis type d'exercice
        if (!step.typeCategory) {
            if (step.exercices && step.exercices.length > 0) {
                const exoType = step.exercices[0].type;
                Logger.debug(`📋 Auto-mapping: exercice type="${exoType}"`);
                
                const consultExoTypes = ["video", "lecture", "objectives", "portfolio"];
                step.typeCategory = consultExoTypes.includes(exoType) ? "consult" : "score";
                Logger.debug(`✅ Mapped to typeCategory="${step.typeCategory}"`);
            } else {
                step.typeCategory = "consult"; // fallback
                Logger.debug(`⚠️ Pas d'exercice - typeCategory par défaut: "consult"`);
            }
        }
        
        // Mettre à jour currentChapitreId et currentStepId pour les autres fonctions
        window.currentChapitreId = chapitreId;
        window.currentStepId = step.id;
        
        // Router selon le type d'étape
        if (step.typeCategory === "consult") {
            // Type A: Objectifs, Vidéos, Lectures, Portfolio
            Logger.debug(`📖 Affichage Type A (consult): ${step.title}`);
            this.renderConsultModal(chapitreId, stepIndex, step);
        } else if (step.typeCategory === "score") {
            // Type B: QCM, Flashcards, Quiz, Exercices
            Logger.debug(`✏️ Affichage Type B (score): ${step.title}`);
            this.renderExerciseModal(chapitreId, stepIndex, step);
        } else {
            Logger.error(`❌ Type d'étape inconnu: ${step.typeCategory}`);
            alert(`Type d'étape inconnu: ${step.typeCategory}`);
        }
    },

    /**
     * Complète l'étape actuelle et avance à la suivante
     * ✅ FIX: Utilise StorageManager + met à jour la propriété en mémoire
     */
    nextEtape(chapitreId, etapeIndex) {
        // Fermer les modals (Type A et Type B)
        const consultModal = document.getElementById('consult-modal');
        if (consultModal) consultModal.remove();
        
        const exerciseModal = document.getElementById('exercise-modal');
        if (exerciseModal) exerciseModal.remove();
        
        // 👁️ Réafficher la barre de navigation
        this.showBottomNav();
        
        // ✅ Vérifier si exercice vient de PRATIQUE
        if (this.returnPath === 'pratique') {
            this.returnPath = null;  // Reset le chemin
            Logger.debug('🎯 Retour à la page Pratique, pas au chapitre');
            this.loadPage('pratique');  // Retour à Pratique
            return;  // IMPORTANT: Exit ici, pas afficherChapitre
        }
        
        // Retourner au chemin
        this.afficherChapitre(chapitreId);
        
        // Mettre à jour la progression
        const progress = this.getChapterProgress(chapitreId);
        Logger.debug(`📊 Progression: ${progress.completed}/${progress.total} (${progress.percentage}%)`);
    },

    /**
     * Remplir les exercices de l'étape
     */
    remplirExercicesEtape(etape) {
        const container = document.getElementById('etape-exercices');
        if (!container) return;

        if (!etape.exercices || etape.exercices.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--color-text-light);">Aucun exercice pour cette étape.</p>';
            return;
        }

        let html = '';
        etape.exercices.forEach((exo, idx) => {
            // ✅ Normaliser l'exercice pour gérer différents formats
            const normalized = normalizeExercise(exo);
            
            // 🔧 FIX: Assurer que l'exercice a un ID unique
            if (!normalized.id) {
                normalized.id = etape.id + '_ex_' + idx;
            }
            
            // 🔧 FIX: Hériter le videoId et videoPath de l'étape parent si absent
            if (!normalized.videoId && etape.videoId) {
                normalized.videoId = etape.videoId;
            }
            if (!normalized.videoPath && etape.videoPath) {
                normalized.videoPath = etape.videoPath;
            }
            
            const type = normalized.type || 'unknown';
            
            // Générer HTML selon le type d'exercice normalisé
            html += this.renderExerciceHTML(normalized, type);
        });

        container.innerHTML = html;
        
        // ✅ Attacher les event listeners après rendu
        setTimeout(() => {
            this.attachExerciceEvents(etape);
        }, 100);
    },

    /**
     * Générer le HTML pour un exercice selon son type
     */
    renderExerciceHTML(exercice, type) {
        const titre = exercice.titre || 'Exercice';
        const description = exercice.description || '';
        const baseStyle = 'margin-bottom: 20px; border-left: 4px solid var(--color-accent); padding: 15px; background: #f9f9f9; border-radius: 8px;';
        
        if (type === 'video') {
            const videoUrl = exercice.content?.url || '';
            const videoId = exercice.videoId || '';
            const videoPath = exercice.videoPath || '/assets/videos';
            
            // 🔧 FIX: Gérer les vidéos locales (fichiers MP4) vs YouTube
            let finalVideoUrl = videoUrl;
            let isLocalVideo = false;
            
            if (!finalVideoUrl && videoId) {
                // Chercher dans le manifest si c'est une vidéo locale
                if (window.VIDEO_MANIFEST && window.VIDEO_MANIFEST[videoId]) {
                    const videoData = window.VIDEO_MANIFEST[videoId];
                    const sourceUrl = videoData.sources['720p'] || videoData.sources['480p'] || videoData.sources['360p'];
                    // Les sources dans le manifest utilisent ../ pour remonter d'un niveau
                    finalVideoUrl = sourceUrl.replace('../', 'assets/videos/');
                    isLocalVideo = true;
                } else {
                    finalVideoUrl = `${videoPath}/${videoId}`;
                }
            }
            
            // ✅ DÉTERMINER SI C'EST UNE VIDÉO LOCALE OU DISTANTE
            // Si pas déjà détecté par le manifest, vérifier l'URL
            if (!isLocalVideo && finalVideoUrl) {
                if (finalVideoUrl.endsWith('.mp4') || finalVideoUrl.endsWith('.webm') || finalVideoUrl.endsWith('.ogg') || 
                    finalVideoUrl.includes('/assets/videos/') || finalVideoUrl.startsWith('/videos/')) {
                    isLocalVideo = true;
                }
            }
            
            const iframeUrl = this.convertToEmbed(finalVideoUrl);
            
            // Pour les vidéos locales, utiliser <video> tag
            if (isLocalVideo) {
                return `
                    <div style="${baseStyle}">
                        <h4 style="margin: 0 0 10px 0; color: var(--color-primary);">${titre}</h4>
                        <p style="color: var(--color-text-light); margin-bottom: 15px;">${description}</p>
                        <video width="100%" height="550" controls style="border-radius: 4px; background: #000;">
                            <source src="${finalVideoUrl}" type="video/mp4">
                            Votre navigateur ne supporte pas le tag vidéo.
                        </video>
                    </div>
                `;
            }
            
            // Pour les URLs YouTube, utiliser iframe
            if (iframeUrl) {
                return `
                    <div style="${baseStyle}">
                        <h4 style="margin: 0 0 10px 0; color: var(--color-primary);">${titre}</h4>
                        <p style="color: var(--color-text-light); margin-bottom: 15px;">${description}</p>
                        <iframe width="100%" height="550" src="${iframeUrl}" title="${titre}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="border-radius: 4px;"></iframe>
                    </div>
                `;
            }
            
            // Fallback si vidéo manquante
            if (!finalVideoUrl) {
                return `
                    <div style="${baseStyle}">
                        <h4 style="margin: 0 0 10px 0; color: var(--color-primary);">${titre}</h4>
                        <p style="color: var(--color-error); margin-bottom: 15px;">❌ URL vidéo manquante pour: ${videoId}</p>
                    </div>
                `;
            }
            
            return `
                <div style="${baseStyle}">
                    <h4 style="margin: 0 0 10px 0; color: var(--color-primary);">${titre}</h4>
                    <p style="color: var(--color-text-light); margin-bottom: 15px;">${description}</p>
                    <a href="${finalVideoUrl}" target="_blank" class="btn btn--primary">🎬 Regarder la vidéo</a>
                </div>
            `;
        } 
        else if (type === 'qcm') {
            const q = exercice.content?.question || '';
            const opts = exercice.content?.options || [];
            let optionsHtml = '';
            opts.forEach((o, idx) => {
                const label = typeof o === 'string' ? o : o.label;
                optionsHtml += `
                    <label style="display: block; margin: 10px 0; padding: 10px; border: 1px solid var(--color-border); border-radius: 4px; cursor: pointer; transition: all 0.2s;">
                        <input type="radio" name="qcm_${exercice.id}" value="${idx}" style="margin-right: 10px; cursor: pointer;">
                        ${label}
                    </label>
                `;
            });
            return `
                <div style="${baseStyle}">
                    <h4 style="margin: 0 0 10px 0; color: var(--color-primary);">${titre}</h4>
                    <p style="font-weight: 500; margin-bottom: 15px;">${q}</p>
                    <div style="margin-bottom: 15px;">
                        ${optionsHtml}
                    </div>
                    <button class="btn btn--primary" onclick="App.validerQCM('${exercice.id}')">
                        ✓ Valider
                    </button>
                </div>
            `;
        }
        else if (type === 'true_false') {
            const items = exercice.content?.items || [];
            let itemsHtml = '';
            items.forEach((item, idx) => {
                const statement = typeof item === 'string' ? item : item.statement;
                itemsHtml += `
                    <div style="margin: 12px 0; padding: 10px; border: 1px solid var(--color-border); border-radius: 4px;">
                        <div style="margin-bottom: 8px; font-weight: 500;">${statement}</div>
                        <div>
                            <label style="margin-right: 15px; cursor: pointer;">
                                <input type="radio" name="tf_${exercice.id}_${idx}" value="true" style="margin-right: 5px;">
                                Vrai
                            </label>
                            <label style="cursor: pointer;">
                                <input type="radio" name="tf_${exercice.id}_${idx}" value="false" style="margin-right: 5px;">
                                Faux
                            </label>
                        </div>
                    </div>
                `;
            });
            return `
                <div style="${baseStyle}">
                    <h4 style="margin: 0 0 10px 0; color: var(--color-primary);">${titre}</h4>
                    ${itemsHtml}
                    <button class="btn btn--primary" onclick="App.validerExercice('${exercice.id}', 'true_false')">
                        ✓ Valider
                    </button>
                </div>
            `;
        }
        else if (type === 'drag_drop') {
            return `
                <div style="${baseStyle}">
                    <h4 style="margin: 0 0 10px 0; color: var(--color-primary);">${titre}</h4>
                    <p style="color: var(--color-text-light);">Exercice Drag & Drop - À implémentation interactive complète</p>
                    <button class="btn btn--primary" onclick="App.afficherExerciceInteractif('${exercice.id}')">
                        🎯 Lancer l'exercice
                    </button>
                </div>
            `;
        }
        else if (type === 'matching') {
            return `
                <div style="${baseStyle}">
                    <h4 style="margin: 0 0 10px 0; color: var(--color-primary);">${titre}</h4>
                    <p style="color: var(--color-text-light);">Exercice Matching - À implémentation interactive complète</p>
                    <button class="btn btn--primary" onclick="App.afficherExerciceInteractif('${exercice.id}')">
                        🎯 Lancer l'exercice
                    </button>
                </div>
            `;
        }
        else if (type === 'flashcards') {
            // Extraire les cartes du format unifié
            const cards = exercice.content?.cards || exercice.cartes || [];
            
            if (!cards || cards.length === 0) {
                return `
                    <div style="${baseStyle}">
                        <h4 style="margin: 0 0 10px 0; color: var(--color-primary);">${titre}</h4>
                        <p style="color: var(--color-error);">❌ Aucune flashcard trouvée</p>
                    </div>
                `;
            }
            
            let cardsHtml = '';
            cards.forEach((carte, index) => {
                const recto = carte.recto || carte.question || '';
                const verso = carte.verso || carte.answer || '';

                cardsHtml += `
                    <div class="flashcard-wrapper" style="
                        margin: 20px 0;
                        height: 220px;
                        cursor: pointer;
                    " data-index="${index}">
                        <div class="flashcard-inner" style="
                            position: relative;
                            width: 100%;
                            height: 100%;
                            transition: transform 0.6s;
                            transform-style: preserve-3d;
                        ">
                            <!-- RECTO (Face avant) -->
                            <div class="flashcard-recto" style="
                                position: absolute;
                                width: 100%;
                                height: 100%;
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                color: white;
                                padding: 30px;
                                border-radius: 12px;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                text-align: center;
                                font-size: 18px;
                                font-weight: 600;
                                box-shadow: 0 8px 16px rgba(0,0,0,0.2);
                                backface-visibility: hidden;
                                -webkit-backface-visibility: hidden;
                            ">
                                <span style="font-size: 14px; opacity: 0.8; margin-bottom: 10px;">❓ QUESTION</span>
                                <span>${recto}</span>
                                <span style="font-size: 12px; opacity: 0.7; margin-top: 15px;">(Cliquer pour répondre)</span>
                            </div>
                            
                            <!-- VERSO (Face arrière) -->
                            <div class="flashcard-verso" style="
                                position: absolute;
                                width: 100%;
                                height: 100%;
                                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                                color: white;
                                padding: 30px;
                                border-radius: 12px;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                text-align: center;
                                font-size: 18px;
                                font-weight: 600;
                                box-shadow: 0 8px 16px rgba(0,0,0,0.2);
                                backface-visibility: hidden;
                                -webkit-backface-visibility: hidden;
                            ">
                                <span style="font-size: 14px; opacity: 0.8; margin-bottom: 10px;">✅ RÉPONSE</span>
                                <span>${verso}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            return `
                <div style="${baseStyle}">
                    <h4 style="margin: 0 0 10px 0; color: var(--color-primary);">${titre}</h4>
                    <p style="color: var(--color-text-light); margin-bottom: 15px;">${description}</p>
                    <p style="color: var(--color-text-light); font-size: 14px; margin-bottom: 15px;">
                        Cliquez sur une carte pour voir la réponse (${cards.length} cartes)
                    </p>
                    <div id="flashcard-container" style="perspective: 1000px;">
                        ${cardsHtml}
                    </div>
                </div>
            `;
        }
        else if (type === 'quiz') {
            // Extraire les questions du format unifié
            const questions = exercice.content?.questions || exercice.questions || [];
            
            if (!questions || questions.length === 0) {
                return `
                    <div style="${baseStyle}">
                        <h4 style="margin: 0 0 10px 0; color: var(--color-primary);">${titre}</h4>
                        <p style="color: var(--color-error);">❌ Aucune question trouvée</p>
                    </div>
                `;
            }
            
            let questionsHtml = '';
            questions.forEach((question, qIndex) => {
                questionsHtml += `
                    <div style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 8px;">
                        <h5 style="margin: 0 0 15px 0; font-size: 16px; color: var(--color-primary);">Q${qIndex + 1}: ${question.question}</h5>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                `;
                
                const options = question.options || question.choix || [];
                options.forEach((option, optIndex) => {
                    const optionText = typeof option === 'string' ? option : (option.label || option.texte || option.text || '');
                    const isCorrect = optIndex === question.correctAnswer || option.correct;
                    
                    questionsHtml += `
                        <label style="display: flex; align-items: center; cursor: pointer; padding: 8px; border-radius: 4px; transition: background 0.2s;">
                            <input type="radio" name="q${question.id || qIndex}" value="${optIndex}" data-correct="${isCorrect}" style="cursor: pointer; margin-right: 10px;">
                            <span>${optionText}</span>
                        </label>
                    `;
                });
                
                questionsHtml += `
                        </div>
                    </div>
                `;
            });
            
            return `
                <div style="${baseStyle}">
                    <h4 style="margin: 0 0 10px 0; color: var(--color-primary);">${titre}</h4>
                    <p style="color: var(--color-text-light); margin-bottom: 15px;">${description}</p>
                    ${questionsHtml}
                    <button class="btn btn--primary" style="width: 100%; margin-top: 20px;" onclick="App.validerQuiz('${exercice.id}')">Soumettre le quiz</button>
                    <div id="quiz-feedback-${exercice.id}" style="margin-top: 15px; padding: 15px; border-radius: 8px; display: none;"></div>
                </div>
            `;
        }
        else if (type === 'lecture') {
            const texte = exercice.content?.text || exercice.text || '';
            
            return `
                <div style="${baseStyle}">
                    <h4 style="margin: 0 0 10px 0; color: var(--color-primary);">${titre}</h4>
                    <p style="color: var(--color-text-light); margin-bottom: 15px;">${description}</p>
                    <div style="padding: 20px; background: #fffacd; border-left: 4px solid #ff9800; border-radius: 8px;">
                        <p style="margin: 0; line-height: 1.8; white-space: pre-wrap; color: #333;">${texte}</p>
                    </div>
                    <p style="margin-top: 15px; text-align: center; color: #666; font-style: italic; font-size: 14px;">
                        Marquez l'étape comme complétée après avoir lu.
                    </p>
                </div>
            `;
        }
        else {
            // Type inconnu ou autre
            return `
                <div style="${baseStyle}">
                    <h4 style="margin: 0 0 10px 0; color: var(--color-primary);">${titre}</h4>
                    <p>${description || 'Contenu non disponible'}</p>
                </div>
            `;
        }
    },

    /**
     * Attacher les event listeners aux exercices
     */
    attachExerciceEvents(etape) {
        // Attacher les événements pour les flashcards
        document.querySelectorAll('.flashcard-wrapper').forEach(wrapper => {
            const inner = wrapper.querySelector('.flashcard-inner');
            let isFlipped = false;
            
            // Clic pour retourner la carte
            wrapper.addEventListener('click', function(e) {
                e.preventDefault();
                isFlipped = !isFlipped;
                inner.style.transform = isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
            });
            
            // Hover pour feedback visuel
            wrapper.addEventListener('mouseover', function() {
                this.style.boxShadow = '0 12px 24px rgba(0,0,0,0.3)';
                this.style.transform = 'translateY(-5px)';
            });
            
            wrapper.addEventListener('mouseout', function() {
                this.style.boxShadow = 'none';
                this.style.transform = 'translateY(0)';
            });
            
            // Support tactile pour mobile
            let touchStartX = 0;
            wrapper.addEventListener('touchstart', function(e) {
                touchStartX = e.touches[0].clientX;
            });
            
            wrapper.addEventListener('touchend', function(e) {
                const touchEndX = e.changedTouches[0].clientX;
                const diff = Math.abs(touchEndX - touchStartX);
                
                // Si déplacement minimal, considérer comme un clic
                if (diff < 20) {
                    isFlipped = !isFlipped;
                    inner.style.transform = isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
                }
            });
        });
    },

    /**
     * Afficher un exercice interactif (Drag-drop, Matching, etc.)
     */
    afficherExerciceInteractif(exerciceId) {
        Logger.info('🎯 Exercice interactif à implémenter: ' + exerciceId);
        // TODO: Charger le module d'exercice interactif
    },

    /**
     * Convertir URL vidéo YouTube en iframe embed
     */
    convertToEmbed(url) {
        if (!url) return '';
        
        // YouTube
        const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
        if (youtubeMatch) {
            return `https://www.youtube-nocookie.com/embed/${youtubeMatch[1]}`;
        }
        
        // Vimeo
        const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
        if (vimeoMatch) {
            return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
        }
        
        return '';
    },

    /**
     * Valider QCM
     */
    validerQCM(exerciceId) {
        Logger.debug(`🔍 Cherchant réponse pour QCM ID: ${exerciceId}`);
        Logger.debug(`📍 Sélecteur: input[name="qcm_${exerciceId}"]:checked`);
        
        // 🔧 DEBUG: Afficher tous les inputs disponibles
        const allInputs = document.querySelectorAll('input[type="radio"]');
        Logger.debug(`📊 Inputs radio trouvés: ${allInputs.length}`);
        allInputs.forEach(input => {
            Logger.debug(`  - name="${input.name}", value="${input.value}", checked=${input.checked}`);
        });
        
        const radio = document.querySelector(`input[name="qcm_${exerciceId}"]:checked`);
        if (!radio) {
            Logger.warn(`⚠️ Sélectionnez une réponse`);
            return;
        }
        
        Logger.debug(`✅ Réponse trouvée: value=${radio.value}`);
        Logger.debug(`✅ Merci! Vous avez répondu.`);
        
        // 🔧 FIX: Activer le bouton "Étape suivante"
        this.activerBoutonEtapeSuivante();
    },

    /**
     * Compléter un chapitre
     */
    completerChapitre(chapitreId) {
        const chapitre = CHAPITRES.find(ch => ch.id === chapitreId);
        if (!chapitre) return;

        chapitre.etapes.forEach(e => { e.completed = true; });
        chapitre.progression = 100;

        if (window.StorageManager) {
            StorageManager.updateChapterProgress(chapitreId, 100);
        }

        // ✅ FIX #1: Refresh visual state after marking all complete
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => {
            updateStepIcons(chapitreId, chapitre);
        }, 100);

        Logger.debug(`✅ Bravo! "${chapitre.titre}" terminé!`);
        this.afficherChapitreContenu(chapitreId);
    },

    /**
     * ATTACHER LES ÉVÉNEMENTS POUR MATCHING
     */
    attachMatchingEvents() {
        document.querySelectorAll('.matching-situation').forEach(situation => {
            situation.addEventListener('click', (e) => {
                e.stopPropagation();
                const containerId = situation.closest('.matching-container')?.id;
                if (containerId) {
                    this.selectSituation(situation, containerId);
                }
            });
        });

        document.querySelectorAll('.matching-status-button').forEach(statusBtn => {
            statusBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const containerId = statusBtn.closest('.matching-container')?.id;
                if (containerId) {
                    this.selectStatus(statusBtn, containerId);
                }
            });
        });
    },

    /**
     * Rend les exercices d'une étape (gère exercise_group et exercices uniques)
     * Affiche UN SEUL exercice à la fois avec navigation
     */
    renderExercices(etape, type) {
        // ✅ Si c'est un groupe d'exercices (exercise_group), afficher UN SEUL à la fois
        if (type === 'exercise_group' && etape.exercices && Array.isArray(etape.exercices)) {
            if (etape.exercices.length === 0) {
                return '<p>Aucun exercice</p>';
            }
            
            // Initialiser l'index si pas encore fait
            if (!window.currentExerciceIndex) {
                window.currentExerciceIndex = 0;
            }
            if (!window.currentEtapeId) {
                window.currentEtapeId = etape.id;
            }
            
            const currentIndex = window.currentExerciceIndex;
            const exercice = etape.exercices[currentIndex];
            const totalExercices = etape.exercices.length;
            
            // Construire l'entête avec progression
            let html = `
                <div style="margin-bottom: var(--spacing-lg); padding-bottom: var(--spacing-lg); border-bottom: 1px solid var(--color-border);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-md);">
                        <span style="color: var(--color-text-light); font-size: 0.9em;">
                            📍 Exercice <strong>${currentIndex + 1}</strong> / <strong>${totalExercices}</strong>
                        </span>
                        <div style="width: 150px; height: 8px; background: var(--color-border); border-radius: 4px; overflow: hidden;">
                            <div style="width: ${((currentIndex + 1) / totalExercices) * 100}%; height: 100%; background: var(--color-accent);"></div>
                        </div>
                    </div>
                    ${this.renderExercice(exercice, exercice.type, etape)}
                </div>
            `;
            
            return html;
        }
        
        // ✅ Si c'est un exercice unique (pas de groupe)
        if (etape.exercice) {
            return this.renderExercice(etape.exercice, etape.type, etape);
        }
        
        return '<p>Aucun exercice</p>';
    },

    /**
     * Passe à l'exercice suivant d'une étape
     */
    allerExerciceSuivant() {
        const chapitreId = window.currentChapitreId;
        const stepId = window.currentStepId;
        
        if (!chapitreId || !stepId) {
            Logger.error('❌ Contexte d\'étape invalide');
            return;
        }
        
        const chapitre = CHAPITRES.find(ch => ch.id === chapitreId);
        const etape = chapitre?.etapes.find(e => e.id === stepId);
        
        if (!etape || etape.type !== 'exercise_group') {
            Logger.error('❌ Étape invalide ou pas de groupe d\'exercices');
            return;
        }
        
        if (!window.currentExerciceIndex) {
            window.currentExerciceIndex = 0;
        }
        
        const totalExercices = etape.exercices.length;
        const nextIndex = window.currentExerciceIndex + 1;
        
        if (nextIndex < totalExercices) {
            // Il y a un exercice suivant
            window.currentExerciceIndex = nextIndex;
            // ✅ FIX OPTION B: Convertir stepId en index numérique
            const etapeIndex = chapitre.etapes.findIndex(e => e.id === stepId);
            if (etapeIndex >= 0) {
                this.afficherEtape(chapitreId, etapeIndex);
            } else {
                Logger.error(`❌ Étape ${stepId} non trouvée dans chapitre.etapes[]`);
            }
        } else {
            // C'est le dernier exercice - Tous les exercices complétés
            Logger.debug(`✅ Dernier exercice complété`);
            
            // FIX FLASHCARDS: Ne pas appeler marquerEtapeComplete() de nouveau
            // (déjà appelé dans validerExercice() au début)
            // marquerEtapeComplete() est un double appel - à eviter
            
            window.currentExerciceIndex = 0; // Reset
            showSuccessNotification('🎉 Étape complétée!', 'Passage à l\'étape suivante...', '✅', 2000);
            
            setTimeout(() => {
                App.fermerModal();
                
                // FIX FLASHCARDS: Passer à l'ÉTAPE SUIVANTE au lieu de revenir au menu
                const etapeIndex = chapitre.etapes.findIndex(e => e.id === stepId);
                const nextEtapeIndex = etapeIndex + 1;
                
                if (nextEtapeIndex < chapitre.etapes.length) {
                    // Il y a une étape suivante - l'afficher immédiatement
                    Logger.debug(`✅ Passage à l'étape suivante (index ${nextEtapeIndex})`);
                    App.afficherEtape(chapitreId, nextEtapeIndex);
                } else {
                    // C'est la dernière étape du chapitre - retour au menu
                    Logger.debug(`✅ Dernier étape atteinte - retour au menu du chapitre`);
                    App.afficherChapitre(chapitreId);
                }
            }, 2000);
        }
    },

    /**
     * Rend l'exercice selon son type
     */
    renderExercice(exercice, etapeType = null, etape = null) {
        if (!exercice) return '<p>Aucun exercice</p>';
        
        // ✅ NORMALISER L'EXERCICE (convertir ancien format → format unifié)
        exercice = normalizeExercise(exercice);
        
        // ⭐ Si exercice incomplet (pas de content), ajouter script pour le charger async
        if (!exercice.content) {
            return `
                <div id="exercice-${exercice.id}" data-exercice-id="${exercice.id}">
                    <div style="text-align: center; padding: var(--spacing-lg);">
                        <p>⏳ Chargement de l'exercice...</p>
                    </div>
                </div>
                <script>
                    (async function() {
                        const exerciceId = '${exercice.id}';
                        const container = document.getElementById('exercice-' + exerciceId);
                        if (!container) return;
                        
                        try {
                            Logger.debug('📚 Chargement exercice:', exerciceId);
                            // Note: exercice déjà complet depuis chapitres.json (structure imbriquée)
                            // Pas besoin de charger séparément
                            const fullExercice = exercice; // Utiliser l'exercice tel quel
                            if (!fullExercice) {
                                container.innerHTML = '<p>❌ Exercice non trouvé</p>';
                                return;
                            }
                            Logger.debug('✅ Exercice prêt:', exerciceId);
                            const html = App.renderExercice(fullExercice, fullExercice.type);
                            container.outerHTML = html;
                        } catch (error) {
                            Logger.error('❌ Erreur chargement exercice:', error);
                            container.innerHTML = '<p>❌ Erreur lors du chargement</p>';
                        }
                    })();
                </script>
            `;
        }
        
        // Passer l'étape aux fonctions de rendu pour accès au videoId
        switch(exercice.type) {
            case 'video':
                return this.renderExerciceVideo(exercice, etape);
            case 'qcm':
                return this.renderExerciceQCM(exercice);
            case 'vrai-faux':
            case 'true_false':
                return this.renderExerciceVraisFaux(exercice);
            case 'dragdrop':
            case 'drag_drop':
                return this.renderExerciceDragDrop(exercice);
            case 'matching':
                return this.renderExerciceMatching(exercice);
            case 'scenario':
            case 'qcm_scenario':
                return this.renderExerciceQCMScenario(exercice);
            case 'likert_scale':
                return this.renderExerciceLikertScale(exercice);
            case 'lecture':
                return this.renderExerciceLecture(exercice);
            case 'flashcards':
                return this.renderExerciceFlashcards(exercice);
            case 'calculation':
                return this.renderExerciceCalculation(exercice);
            case 'quiz':
                return this.renderExerciceQuiz(exercice);
            default:
                return `
                    <div style="background: var(--color-surface); padding: var(--spacing-md); border-radius: var(--radius-md);">
                        <h3>${exercice.titre || 'Exercice'}</h3>
                        <p>${exercice.description || ''}</p>
                        <p style="color: var(--color-text-light); margin-top: var(--spacing-md);">
                            ℹ️ Type d'exercice non supporté: <strong>${exercice.type}</strong>
                        </p>
                        <button class="btn btn--primary" style="margin-top: var(--spacing-md); width: 100%;" onclick="App.validerExercice('default')">✅ Marquer comme lu</button>
                    </div>
                `;
        }
    },

    /**
     * Rendu VIDEO (Support à la fois YouTube et lecteur local)
     */
    renderExerciceVideo(exercice, etape = null) {
        // ✅ NOUVELLE STRUCTURE UNIFIÉE avec videoType dans content
        const content = exercice.content;
        const videoType = content?.videoType;
        const videoUrl = content?.url || exercice.url || exercice.videoUrl;
        
        Logger.debug(`📹 renderExerciceVideo - Type: ${videoType}, URL: ${videoUrl}`, exercice);
        
        // ✅ GESTION VIDÉOS YOUTUBE (videoType: "youtube")
        if (videoType === 'youtube' || (videoUrl && (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')))) {
            let embedUrl = videoUrl;
            
            // ✅ CONVERSION DES FORMATS YOUTUBE
            if (embedUrl.includes('watch?v=')) {
                // Format: https://www.youtube.com/watch?v=jNQXAC9IVRw
                const videoId = embedUrl.split('v=')[1]?.split('&')[0];
                if (videoId) {
                    embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;
                }
            } else if (embedUrl.includes('youtu.be/')) {
                // Format: https://youtu.be/jNQXAC9IVRw
                const videoId = embedUrl.split('youtu.be/')[1]?.split('?')[0];
                if (videoId) {
                    embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;
                }
            } else if (!embedUrl.includes('/embed/')) {
                // Si l'URL n'est pas déjà au format embed, essayer de l'extraire
                const videoIdMatch = embedUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\s]{11})/);
                if (videoIdMatch && videoIdMatch[1]) {
                    embedUrl = `https://www.youtube-nocookie.com/embed/${videoIdMatch[1]}`;
                }
            }
            
            Logger.debug(`✅ Vidéo YouTube chargée: ${embedUrl}`);
            
            return `
                <div style="background: var(--color-surface); padding: var(--spacing-md); border-radius: var(--radius-md);">
                    <h3>${exercice.titre}</h3>
                    <p style="color: var(--color-text-light); margin-bottom: var(--spacing-md);">${exercice.description || ''}</p>
                    <div class="video-container">
                        <iframe width="100%" height="550" title="${exercice.titre}" src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="border-radius: 8px;"></iframe>
                    </div>
                    <button class="btn btn--primary" style="margin-top: var(--spacing-md); width: 100%;" onclick="App.validerExercice('video')">✅ J'ai regardé la vidéo</button>
                </div>
            `;
        }
        
        // ✅ GESTION VIDÉOS LOCALES (videoType: "local")
        if (videoType === 'local' && videoUrl) {
            // Utiliser l'URL directement pour HTML5 video
            const containerId = `video-container-${exercice.id}`;
            
            return `
                <div class="video-section">
                    <h3>🎬 ${exercice.titre}</h3>
                    <p style="color: var(--color-text-light); margin-bottom: 20px;">${exercice.description}</p>
                    
                    <div id="${containerId}" style="width: 100%; margin-bottom: var(--spacing-md); background: #000; border-radius: 8px; overflow: hidden;">
                        <video style="width: 100%; height: auto; display: block;" controls preload="metadata">
                            <source src="${videoUrl}" type="video/mp4">
                            Votre navigateur ne supporte pas la lecture vidéo HTML5.
                        </video>
                    </div>
                    
                    <button class="btn btn--primary" style="margin-top: var(--spacing-md); width: 100%;" onclick="App.validerExercice('video')">✅ J'ai regardé la vidéo</button>
                </div>
            `;
        }
        
        // Si c'est une vidéo locale avec notre VideoPlayer (ancien format avec videoId)
        const videoId = etape?.videoId || exercice.videoId;
        if (videoId) {
            // Générer un container ID unique pour le VideoPlayer
            const containerId = `video-container-${videoId}`;
            
            return `
                <div class="video-section">
                    <h3>🎬 ${exercice.titre}</h3>
                    <p style="color: var(--color-text-light); margin-bottom: 20px;">${exercice.description}</p>
                    
                    <div id="${containerId}" style="width: 100%; margin-bottom: var(--spacing-md);">
                        <video-player video-id="${videoId}"></video-player>
                    </div>
                    
                    <button class="btn btn--primary" style="margin-top: var(--spacing-md); width: 100%;" onclick="App.validerExercice('video')">✅ J'ai regardé la vidéo</button>
                </div>
            `;
        }
        
        Logger.warn(`❌ Format vidéo non supporté pour:`, exercice);
        return `<p>❌ Format vidéo non supporté</p>`;
    },

    /**
     * Rendu QCM - Sécurisé (pas d'exposition réponses en HTML)
     */
    renderExerciceQCM(exercice) {
        const qcmId = Math.random().toString(36).substr(2, 9);
        
        // ✅ Extraire les données du format JSON
        const content = exercice.content;
        if (!content || !content.question || !content.options) {
            return '<p>❌ Format QCM invalide</p>';
        }
        
        // ✅ Stocker les bonnes réponses en mémoire SEULE, jamais en HTML
        window.QCM_ANSWERS = window.QCM_ANSWERS || {};
        window.QCM_ANSWERS[qcmId] = {
            correctAnswer: content.correctAnswer,
            options: content.options,
            question: content.question,
            explication: content.explanation
        };

        let html = `
            <div style="background: var(--color-surface); padding: var(--spacing-md); border-radius: var(--radius-md);" data-qcm-id="${qcmId}">
                <h3>❓ ${content.question}</h3>
                <div style="display: flex; flex-direction: column; gap: var(--spacing-md); margin-top: var(--spacing-md);">
        `;
        
        content.options.forEach((option, index) => {
            // ✅ NE PAS ajouter data-correct en HTML
            const optionText = typeof option === 'string' ? option : option.label;
            html += `
                <label style="display: flex; align-items: center; padding: var(--spacing-md); border: 2px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s;">
                    <input type="radio" name="${qcmId}" value="${index}" style="margin-right: var(--spacing-md);" class="qcm-input">
                    <span>${optionText}</span>
                </label>
            `;
        });
        
        html += `
                </div>
                <button class="btn btn--primary" style="margin-top: var(--spacing-md); width: 100%;" onclick="App.validerQCMSecurise('${qcmId}')">Soumettre la réponse</button>
                <div id="feedback_${qcmId}" style="margin-top: var(--spacing-md); display: none;"></div>
            </div>
        `;
        
        return html;
    },

    /**
     * Rendu VRAI/FAUX
     * Supporte deux formats:
     * 1. Format multi-items: content.items = [{statement, answer}, ...]
     * 2. Format single (authoring-tool): content.statement + content.correctAnswer
     */
    renderExerciceVraisFaux(exercice) {
        const vrfId = 'vf_' + Math.random().toString(36).substr(2, 9);
        const content = exercice.content;
        
        // ✅ SUPPORT FORMAT SINGLE (authoring-tool)
        // Convertit content.statement en format items pour un rendu uniforme
        let items = [];
        
        if (content && content.items && Array.isArray(content.items)) {
            // Format multi-items (ancien format)
            items = content.items;
        } else if (content && content.statement !== undefined) {
            // Format single (authoring-tool)
            items = [{
                statement: content.statement || '',
                answer: content.correctAnswer === true || content.correctAnswer === 'true'
            }];
        } else {
            return '<p>❌ Format Vrai/Faux invalide</p>';
        }
        
        if (items.length === 0) {
            return '<p>❌ Aucune affirmation dans cet exercice</p>';
        }
        
        // ✅ Stocker les données pour la validation
        window.VRF_DATA = window.VRF_DATA || {};
        window.VRF_DATA[vrfId] = {
            items: items,
            explanation: content.explanation || ''
        };
        
        let html = `
            <div style="background: var(--color-surface); padding: var(--spacing-md); border-radius: var(--radius-md);">
                <h3>✔️ ${exercice.titre || 'Vrai ou Faux?'}</h3>
                <div style="margin-top: var(--spacing-md);">
        `;
        
        items.forEach((item, index) => {
            const itemId = `${vrfId}_${index}`;
            html += `
                <div style="margin-bottom: var(--spacing-lg); padding-bottom: var(--spacing-lg); border-bottom: 1px solid var(--color-border);">
                    <p style="margin-bottom: var(--spacing-md); font-weight: 500;">${items.length > 1 ? (index + 1) + '. ' : ''}${item.statement}</p>
                    <div style="display: flex; gap: var(--spacing-md);">
                        <label style="display: flex; align-items: center; padding: var(--spacing-sm) var(--spacing-md); border: 2px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer;">
                            <input type="radio" name="${itemId}" value="true" style="margin-right: var(--spacing-sm);" class="vf-input">
                            <span>✅ Vrai</span>
                        </label>
                        <label style="display: flex; align-items: center; padding: var(--spacing-sm) var(--spacing-md); border: 2px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer;">
                            <input type="radio" name="${itemId}" value="false" style="margin-right: var(--spacing-sm);" class="vf-input">
                            <span>❌ Faux</span>
                        </label>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
                <button class="btn btn--primary" style="margin-top: var(--spacing-md); width: 100%;" onclick="App.validerVraisFaux('${vrfId}', ${items.length})">Soumettre</button>
                <div id="feedback_${vrfId}" style="margin-top: var(--spacing-md); display: none;"></div>
            </div>
        `;
        
        return html;
    },

    /**
     * Rendu DRAG-DROP
     */
    /**
     * Rendu DRAG-DROP - Approche stable avec IDs uniques
     */
    renderExerciceDragDrop(exercice) {
        const dragId = 'drag_' + Math.random().toString(36).substr(2, 9);
        const content = exercice.content;
        
        if (!content || !content.items) {
            return '<p>❌ Format Drag-Drop invalide</p>';
        }
        
        // Normaliser les items (string simple ou objet)
        const normalizedItems = content.items.map((item, idx) => {
            if (typeof item === 'string') {
                return { id: idx, text: item, correctPosition: idx };
            }
            return item;
        });
        
        let html = `
            <div id="${dragId}" class="drag-container" style="background: var(--color-surface); padding: var(--spacing-md); border-radius: var(--radius-md);">
                <h3>🎯 ${exercice.titre || 'Ordonner les éléments'}</h3>
                <p style="color: var(--color-text-light); margin-bottom: var(--spacing-md);">${content.instruction || 'Drag and drop pour ordonner correctement'}</p>
                <div class="drag-items" style="display: flex; flex-direction: column; gap: var(--spacing-md); min-height: 100px; border: 2px dashed var(--color-border); padding: var(--spacing-md); border-radius: var(--radius-md);">
        `;
        
        // ✅ Stocker les données
        window.DRAG_DATA = window.DRAG_DATA || {};
        window.DRAG_DATA[dragId] = {
            items: normalizedItems,
            correctOrder: normalizedItems.map((item, idx) => item.correctPosition !== undefined ? item.correctPosition : idx),
            currentOrder: normalizedItems.map((_, idx) => idx),
            exerciseId: exercice.id
        };
        
        normalizedItems.forEach((item, index) => {
            const itemText = item.text || item.label || item;
            html += `
                <div class="drag-item" 
                     data-item-id="${item.id || index}"
                     data-correct-position="${item.correctPosition !== undefined ? item.correctPosition : index}"
                     data-current-position="${index}"
                     draggable="true"
                     data-drag-id="${dragId}"
                     style="
                        padding: var(--spacing-md);
                        background: var(--color-accent);
                        color: white;
                        border-radius: var(--radius-md);
                        cursor: move;
                        user-select: none;
                        transition: all 0.2s ease;
                        border-left: 4px solid transparent;
                     ">
                    <span style="font-weight: 600;">${itemText}</span>
                </div>
            `;
        });
        
        html += `
                </div>
                <button class="btn btn--primary" style="margin-top: var(--spacing-md); width: 100%;" onclick="initDragDropValidation('${dragId}')">Vérifier l'ordre</button>
                <div id="feedback_${dragId}" style="margin-top: var(--spacing-md); display: none;"></div>
            </div>
        `;
        
        // ✅ Initialiser les événements drag-drop après rendu
        setTimeout(() => {
            initDragDrop(dragId);
        }, 100);
        
        return html;
    },

    /**
     * Rendu LIKERT SCALE (Auto-évaluation)
     */
    renderExerciceLikertScale(exercice) {
        const likertId = 'likert_' + Math.random().toString(36).substr(2, 9);
        const content = exercice.content;
        
        if (!content || !content.items) {
            return '<p>❌ Format Likert Scale invalide</p>';
        }
        
        const scale = ['Pas du tout', 'Un peu', 'Moyennement', 'Beaucoup', 'Totalement'];
        
        let html = `
            <div style="background: var(--color-surface); padding: var(--spacing-md); border-radius: var(--radius-md);">
                <h3>📊 ${exercice.titre || 'Auto-évaluation'}</h3>
                <div style="margin-top: var(--spacing-md);">
        `;
        
        content.items.forEach((item, itemIndex) => {
            html += `
                <div style="margin-bottom: var(--spacing-lg); padding-bottom: var(--spacing-lg); border-bottom: 1px solid var(--color-border);">
                    <p style="margin-bottom: var(--spacing-md); font-weight: 500;">${item.label || item.competencyId}</p>
                    <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--spacing-sm);">
            `;
            
            scale.forEach((scaleLabel, scaleIndex) => {
                const inputId = `${likertId}_${itemIndex}_${scaleIndex}`;
                html += `
                    <label style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
                        <input type="radio" name="likert_${itemIndex}" value="${scaleIndex}" style="margin-bottom: var(--spacing-sm);" class="likert-input">
                        <span style="font-size: 0.8em; text-align: center;">${scaleLabel}</span>
                    </label>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
                <button class="btn btn--primary" style="margin-top: var(--spacing-md); width: 100%;" onclick="App.validerLikert('${likertId}')">Valider l'auto-évaluation</button>
                <div id="feedback_${likertId}" style="margin-top: var(--spacing-md); display: none;"></div>
            </div>
        `;
        
        return html;
    },

    /**
     * Rendu LECTURE
     */
    renderExerciceLecture(exercice) {
        // Extraire le texte du format unifié (supporte markdown et text)
        const lectureText = exercice.content?.markdown || exercice.content?.text || exercice.texte || '';
        
        return `
            <div style="background: var(--color-surface); padding: var(--spacing-md); border-radius: var(--radius-md);">
                <h3>${exercice.titre}</h3>
                <div style="white-space: pre-wrap; line-height: 1.6; margin: var(--spacing-md) 0; color: var(--color-text);">
                    ${lectureText}
                </div>
                <button class="btn btn--primary" style="margin-top: var(--spacing-md); width: 100%;" onclick="App.validerExercice('lecture')">✅ J'ai lu la leçon</button>
            </div>
        `;
    },

    /**
     * Rendu FLASHCARDS
     */
    renderExerciceFlashcards(exercice) {
        // Extraire les cartes du format unifié
        const cards = exercice.content?.cards || exercice.cartes || [];
        
        Logger.debug('🎴 renderExerciceFlashcards DEBUG:', {
            exerciceId: exercice.id,
            hasContent: !!exercice.content,
            hasCards: !!exercice.content?.cards,
            cardsLength: cards.length,
            cards: cards,
            fullExercice: exercice
        });
        
        if (!cards || cards.length === 0) {
            return '<p>❌ Aucune flashcard trouvée</p>';
        }
        
        let html = `
            <div style="background: var(--color-surface); padding: var(--spacing-md); border-radius: var(--radius-md);">
                <h3>🎴 Flashcards - Mémorisation</h3>
                <p style="color: var(--color-text-light); margin-bottom: var(--spacing-md);">Cliquez sur une carte pour voir la réponse (${cards.length} cartes)</p>
                <div id="flashcard-container" style="perspective: 1000px;">
        `;
        
        cards.forEach((carte, index) => {
            const safeId = `card-${index}`;
            const recto = carte.frontText || carte.recto || carte.question || '❓ Question';
            const verso = carte.backText || carte.verso || carte.answer || '✅ Réponse';

            html += `
                <div class="flashcard-wrapper" style="
                    margin: 20px 0;
                    height: 220px;
                    cursor: pointer;
                " data-index="${index}">
                    <div class="flashcard-inner" style="
                        position: relative;
                        width: 100%;
                        height: 100%;
                        transition: transform 0.6s;
                        transform-style: preserve-3d;
                    ">
                        <!-- RECTO (Face avant) -->
                        <div class="flashcard-recto" style="
                            position: absolute;
                            width: 100%;
                            height: 100%;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            padding: 30px;
                            border-radius: 12px;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            text-align: center;
                            font-size: 18px;
                            font-weight: 600;
                            box-shadow: 0 8px 16px rgba(0,0,0,0.2);
                            backface-visibility: hidden;
                            -webkit-backface-visibility: hidden;
                        ">
                            <span style="font-size: 14px; opacity: 0.8; margin-bottom: 10px;">❓ QUESTION</span>
                            <span>${recto}</span>
                            <span style="font-size: 12px; opacity: 0.7; margin-top: 15px;">(Cliquer pour répondre)</span>
                        </div>
                        
                        <!-- VERSO (Face arrière) -->
                        <div class="flashcard-verso" style="
                            position: absolute;
                            width: 100%;
                            height: 100%;
                            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                            color: white;
                            padding: 30px;
                            border-radius: 12px;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            text-align: center;
                            font-size: 18px;
                            font-weight: 600;
                            box-shadow: 0 8px 16px rgba(0,0,0,0.2);
                            transform: rotateY(180deg);
                            backface-visibility: hidden;
                            -webkit-backface-visibility: hidden;
                        ">
                            <span style="font-size: 14px; opacity: 0.8; margin-bottom: 10px;">✅ RÉPONSE</span>
                            <span>${verso}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
                <div style="margin-top: var(--spacing-lg); text-align: center;">
                    <p style="color: var(--color-text-light); font-size: 14px; margin-bottom: var(--spacing-md);">
                        Naviguez à travers les cartes et cliquez pour révéler les réponses
                    </p>
                </div>
            </div>
        `;
        
        // Retourner le HTML et attacher les événements après le rendu
        setTimeout(() => {
            document.querySelectorAll('.flashcard-wrapper').forEach(wrapper => {
                const inner = wrapper.querySelector('.flashcard-inner');
                let isFlipped = false;
                
                // Clic pour retourner la carte
                wrapper.addEventListener('click', function(e) {
                    e.preventDefault();
                    isFlipped = !isFlipped;
                    inner.style.transform = isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
                });
                
                // Hover pour feedback visuel
                wrapper.addEventListener('mouseover', function() {
                    this.style.boxShadow = '0 12px 24px rgba(0,0,0,0.3)';
                    this.style.transform = 'translateY(-5px)';
                });
                
                wrapper.addEventListener('mouseout', function() {
                    this.style.boxShadow = 'none';
                    this.style.transform = 'translateY(0)';
                });
                
                // Support tactile pour mobile
                let touchStartX = 0;
                wrapper.addEventListener('touchstart', function(e) {
                    touchStartX = e.touches[0].clientX;
                });
                
                wrapper.addEventListener('touchend', function(e) {
                    const touchEndX = e.changedTouches[0].clientX;
                    const diff = Math.abs(touchEndX - touchStartX);
                    
                    // Si déplacement minimal, considérer comme un clic
                    if (diff < 20) {
                        isFlipped = !isFlipped;
                        inner.style.transform = isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
                    }
                });
            });
        }, 100);
        
        return html;
    },

    /**
     * Rendu CALCULATION - Questions numériques avec validation
     */
    renderExerciceCalculation(exercice) {
        if (!exercice.content || !exercice.content.questions) {
            return '<p>❌ Format exercice calcul invalide</p>';
        }

        const content = exercice.content;
        const calcId = 'calc_' + Math.random().toString(36).substr(2, 9);

        // Stocker les réponses correctes en mémoire
        window.CALC_ANSWERS = window.CALC_ANSWERS || {};
        window.CALC_ANSWERS[calcId] = {
            questions: content.questions,
            scenario: content.scenario,
            summary: content.summary
        };

        let html = `
            <div class="exercice-calculation" id="${calcId}">
                <div style="background: #f0f4ff; padding: 16px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #8b5cf6;">
                    <h4 style="margin-top: 0; color: #5b21b6; font-size: 16px;">📋 Scénario</h4>
                    <pre style="white-space: pre-wrap; font-size: 14px; line-height: 1.5; color: #333; font-family: inherit;">
${content.scenario}
                    </pre>
                </div>

                <div class="questions-container">
        `;

        // Générer chaque question numérique
        content.questions.forEach((question, qIndex) => {
            const inputId = `${calcId}_q${qIndex}`;
            html += `
                <div style="margin-bottom: 24px; padding: 16px; background: #fafafa; border-radius: 8px; border: 1px solid #e5e7eb;">
                    <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 15px;">
                        Q${qIndex + 1}: ${question.question}
                    </label>
                    
                    <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 12px;">
                        <input 
                            type="number" 
                            id="${inputId}" 
                            placeholder="Votre réponse..."
                            step="0.01"
                            style="flex: 1; padding: 10px; border: 2px solid #d1d5db; border-radius: 6px; font-size: 14px;"
                        />
                        <span style="min-width: 60px; color: #666; font-weight: 500;">
                            ${question.unit || ''}
                        </span>
                    </div>

                    <details style="margin-bottom: 8px;">
                        <summary style="cursor: pointer; color: #0066cc; font-weight: 500; user-select: none;">💡 Indice</summary>
                        <p style="margin: 8px 0 0 0; padding: 8px; background: #fff3cd; border-left: 3px solid #ffc107; color: #856404; border-radius: 4px;">
                            ${question.hint}
                        </p>
                    </details>

                    <div id="feedback_${inputId}" style="display: none; padding: 12px; border-radius: 6px; margin-top: 8px; font-weight: 500; border: 2px solid;"></div>
                </div>
            `;
        });

        html += `
                </div>

                <button 
                    onclick="App.validerCalculation('${calcId}')"
                    class="btn btn--primary"
                    style="width: 100%; padding: 12px; margin-top: 20px; font-size: 16px; font-weight: 600;"
                >
                    📊 Valider mes réponses
                </button>

                <div id="summary_${calcId}" style="display: none; margin-top: 20px; padding: 16px; background: #ecfdf5; border: 2px solid #10b981; border-radius: 8px;">
                    <h4 style="margin-top: 0; color: #065f46;">✅ Résumé</h4>
                    <pre style="white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #333; margin: 0; font-family: inherit;">
${content.summary}
                    </pre>
                </div>
            </div>
        `;

        return html;
    },

    /**
     * Valide les réponses de calcul avec tolérance
     */
    validerCalculation(calcId) {
        const calcData = window.CALC_ANSWERS?.[calcId];
        if (!calcData) {
            showErrorNotification('❌ Erreur: données de calcul non trouvées');
            return;
        }

        let allCorrect = true;
        let correctCount = 0;
        const questions = calcData.questions;

        // Vérifier chaque réponse
        questions.forEach((question, qIndex) => {
            const inputId = `${calcId}_q${qIndex}`;
            const userInput = document.getElementById(inputId);
            const userAnswer = parseFloat(userInput.value);
            const correctAnswer = question.correctAnswer;
            const tolerance = question.tolerance || 0;

            const isCorrect = Math.abs(userAnswer - correctAnswer) <= tolerance;
            const feedback = document.getElementById(`feedback_${inputId}`);

            if (isCorrect) {
                correctCount++;
                feedback.style.background = '#dcfce7';
                feedback.style.color = '#166534';
                feedback.style.borderColor = '#22c55e';
                feedback.innerHTML = `
                    ✅ <strong>Correct!</strong> ${question.explanation}
                `;
                userInput.style.borderColor = '#22c55e';
            } else {
                allCorrect = false;
                feedback.style.background = '#fee2e2';
                feedback.style.color = '#991b1b';
                feedback.style.borderColor = '#ef4444';
                feedback.innerHTML = `
                    ❌ <strong>Incorrect.</strong> Votre réponse: <strong>${userAnswer}</strong>, Correcte: <strong>${correctAnswer}</strong><br/><br/>
                    ${question.explanation}
                `;
                userInput.style.borderColor = '#ef4444';
            }

            feedback.style.display = 'block';
        });

        // Afficher résumé
        const summaryDiv = document.getElementById(`summary_${calcId}`);
        summaryDiv.style.display = 'block';

        // Marquer étape complète si tout juste
        if (allCorrect) {
            showSuccessNotification('🎉 Parfait!', `${correctCount}/${questions.length} réponses correctes!`, '✅', 2000);
            
            // Marquer l'étape comme complétée
            if (window.currentStepId && window.currentChapitreId) {
                App.marquerEtapeComplete(window.currentChapitreId, window.currentStepId);
                const chapitre = CHAPITRES.find(ch => ch.id === window.currentChapitreId);
                const etape = chapitre?.etapes.find(e => e.id === window.currentStepId);
                const maxPoints = etape?.points || 10;
                StorageManager.addPointsToStep(window.currentStepId, maxPoints, maxPoints);
                App.updateHeader();
                
                // 🔧 FIX: Activer le bouton "Étape suivante"
                App.activerBoutonEtapeSuivante();
            }

            setTimeout(() => {
                App.allerExerciceSuivant();
            }, 2000);
        } else {
            showErrorNotification(`⚠️ ${correctCount}/${questions.length} réponses correctes - Réessayez!`, 3000);
        }
    },

    /**
     * Rendu QUIZ
     */
    renderExerciceQuiz(exercice) {
        // Extraire les questions du format unifié
        const questions = exercice.content?.questions || exercice.questions || [];
        
        if (!questions || questions.length === 0) {
            return '<p>❌ Aucune question trouvée</p>';
        }
        
        let html = `
            <div style="background: var(--color-surface); padding: var(--spacing-md); border-radius: var(--radius-md);">
                <h3>${exercice.titre}</h3>
                <p style="color: var(--color-text-light); margin-bottom: var(--spacing-md);">${exercice.description}</p>
        `;
        
        questions.forEach((question, qIndex) => {
            html += `
                <div style="margin-bottom: var(--spacing-lg); padding: var(--spacing-md); background: white; border-radius: var(--radius-md);">
                    <h4>Q${qIndex + 1}: ${question.question}</h4>
            `;
            
            // Gérer les différents types de questions
            if (question.type === 'ordering') {
                // Question d'ordonnancement
                const items = question.items || [];
                html += `
                    <p style="color: #666; font-style: italic; margin: 10px 0;">${question.instruction || 'Glissez pour ordonner les éléments :'}</p>
                    <div id="ordering-${question.questionId || qIndex}" style="display: flex; flex-direction: column; gap: 8px; margin-top: var(--spacing-md);">
                `;
                
                // Mélanger les items pour l'affichage
                const shuffledItems = [...items].sort(() => Math.random() - 0.5);
                
                shuffledItems.forEach((item, itemIndex) => {
                    html += `
                        <div class="ordering-item" 
                             data-correct-order="${item.order}" 
                             data-question-id="${question.questionId || qIndex}"
                             style="display: flex; align-items: center; padding: 12px; background: #f8f9fa; border: 2px solid #ddd; border-radius: 8px; cursor: move; user-select: none;">
                            <span class="drag-handle" style="margin-right: 12px; font-size: 20px; color: #999;">⋮⋮</span>
                            <span style="flex: 1;">${item.text}</span>
                            <span class="order-number" style="min-width: 30px; height: 30px; border-radius: 50%; background: #4A3F87; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold;">${itemIndex + 1}</span>
                        </div>
                    `;
                });
                
                html += `
                    </div>
                `;
            } else {
                // Question à choix multiples (type par défaut)
                html += `<div style="display: flex; flex-direction: column; gap: var(--spacing-md); margin-top: var(--spacing-md);">`;
                
                const options = question.answers || question.options || question.choix || [];
                options.forEach((option, optIndex) => {
                    const optionText = typeof option === 'string' ? option : (option.text || option.label || option.texte || '');
                    const isCorrect = optIndex === question.correctAnswer || option.correct;
                    
                    html += `
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="radio" name="q${question.questionId || question.id || qIndex}" value="${optIndex}" data-correct="${isCorrect}" style="cursor: pointer;">
                            <span style="margin-left: var(--spacing-md);">${optionText}</span>
                        </label>
                    `;
                });
                
                html += `</div>`;
            }
            
            html += `
                </div>
            `;
        });
        
        html += `
                <div id="quiz-feedback" style="margin-top: var(--spacing-lg); padding: var(--spacing-md); border-radius: var(--radius-md); display: none;"></div>
            </div>
        `;
        
        // Ajouter le code de drag and drop pour les questions d'ordonnancement
        setTimeout(() => {
            document.querySelectorAll('.ordering-item').forEach(item => {
                item.draggable = true;
                
                item.addEventListener('dragstart', (e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/html', item.innerHTML);
                    item.classList.add('dragging');
                    item.style.opacity = '0.4';
                });
                
                item.addEventListener('dragend', (e) => {
                    item.classList.remove('dragging');
                    item.style.opacity = '1';
                });
                
                item.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    const dragging = document.querySelector('.dragging');
                    const afterElement = getDragAfterElement(item.parentElement, e.clientY);
                    if (afterElement == null) {
                        item.parentElement.appendChild(dragging);
                    } else {
                        item.parentElement.insertBefore(dragging, afterElement);
                    }
                    updateOrderNumbers(item.parentElement);
                });
            });
            
            function getDragAfterElement(container, y) {
                const draggableElements = [...container.querySelectorAll('.ordering-item:not(.dragging)')];
                return draggableElements.reduce((closest, child) => {
                    const box = child.getBoundingClientRect();
                    const offset = y - box.top - box.height / 2;
                    if (offset < 0 && offset > closest.offset) {
                        return { offset: offset, element: child };
                    } else {
                        return closest;
                    }
                }, { offset: Number.NEGATIVE_INFINITY }).element;
            }
            
            function updateOrderNumbers(container) {
                container.querySelectorAll('.ordering-item').forEach((item, idx) => {
                    const numberSpan = item.querySelector('.order-number');
                    if (numberSpan) numberSpan.textContent = idx + 1;
                });
            }
        }, 100);
        
        return html;
    },

    /**
     * RENDU MATCHING - Associer situations à statuts
     */
    renderExerciceMatching(exercice) {
        if (!exercice.pairs || exercice.pairs.length === 0) {
            return `<p>❌ Aucune paire d'association</p>`;
        }

        const containerId = `matching-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const statusesShuffled = [...exercice.statuses].sort(() => Math.random() - 0.5);

        let html = `
            <div class="matching-container" id="${containerId}">
                <p class="matching-instructions">🎯 Associez chaque élément de gauche à son équivalent à droite en cliquant</p>
                
                <div class="matching-content">
                    <!-- COLONNE GAUCHE (SITUATIONS) -->
                    <div class="matching-column">
                        <h4 class="matching-column-title">📍 Éléments</h4>
                        <div class="matching-situations">
        `;

        // Créer les situations (gauche)
        exercice.pairs.forEach((pair, idx) => {
            html += `
                <div class="matching-situation" 
                     data-pair-id="${pair.id}"
                     data-correct-status="${pair.status}">
                    <div class="matching-situation-number">${idx + 1}</div>
                    <div class="matching-situation-text">${pair.situation}</div>
                    <div class="matching-situation-status" style="display: none;"></div>
                </div>
            `;
        });

        html += `
                        </div>
                    </div>

                    <!-- COLONNE DROITE (STATUTS) -->
                    <div class="matching-column">
                        <h4 class="matching-column-title">🏷️ Réponses</h4>
                        <div class="matching-statuses">
        `;

        // Créer les statuts (droite)
        statusesShuffled.forEach((status) => {
            html += `
                <div class="matching-status-button"
                     data-status-id="${status.id}"
                     data-status-name="${status.name}"
                     style="background-color: ${status.color}20; border: 2px solid ${status.color};">
                    <span class="matching-status-text">${status.name}</span>
                </div>
            `;
        });

        html += `
                        </div>
                    </div>
                </div>

                <!-- FEEDBACK -->
                <div id="matching-feedback-${containerId}" class="matching-feedback" style="margin-top: 20px; display: none;"></div>

                <!-- BOUTONS -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px;">
                    <button class="btn btn--primary" onclick="App.validerMatching('${containerId}')">
                        ✅ Valider les associations
                    </button>
                    <button class="btn btn--secondary" onclick="App.reinitialiserMatching('${containerId}')">
                        🔄 Recommencer
                    </button>
                </div>
            </div>
        `;

        return html;
    },

    /**
     * RENDU QCM SCÉNARIO - Afficher scénario + questions
     * Supporte format ancien (exercice.scenario) et nouveau (content.scenario)
     */
    renderExerciceQCMScenario(exercice) {
        // Supporter les deux formats
        const scenario = exercice.content?.scenario || exercice.scenario;
        const questions = exercice.content?.questions || exercice.questions;
        
        if (!scenario || !questions || questions.length === 0) {
            return `<p>❌ Scénario ou questions manquants</p>`;
        }
        
        // Adapter format simplifié (authoring-tool) vers format complet
        const normalizedScenario = typeof scenario === 'string' 
            ? { title: exercice.titre || 'Scénario', description: scenario }
            : scenario;
        
        const normalizedQuestions = questions.map((q, idx) => {
            // Si format simplifié {question, options: ['A','B','C'], correct: 0}
            if (Array.isArray(q.options) && typeof q.options[0] === 'string') {
                return {
                    id: `q${idx}`,
                    question: q.question,
                    points: q.points || 10,
                    options: q.options.map((opt, optIdx) => ({
                        id: `opt${optIdx}`,
                        text: opt,
                        correct: optIdx === q.correct,
                        explanation: ''
                    }))
                };
            }
            return q;
        });

        const containerId = `qcm-scenario-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        let html = `
            <div class="qcm-scenario-container" id="${containerId}">
                
                <!-- SCÉNARIO -->
                <div class="scenario-panel" style="background-color: ${normalizedScenario.background_color || '#f5f5f5'};">
                    <div class="scenario-header">
                        <h3 class="scenario-title">
                            <span class="scenario-icon">${normalizedScenario.icon || '📋'}</span>
                            ${normalizedScenario.title || exercice.titre}
                        </h3>
                    </div>
                    <div class="scenario-description">
                        ${(normalizedScenario.description || '').replace(/\\n/g, '<br>')}
                    </div>
                </div>

                <!-- QUESTIONS -->
                <div class="qcm-scenario-questions">
        `;

        // Créer chaque question
        normalizedQuestions.forEach((question, qIdx) => {
            html += `
                <div class="qcm-scenario-question-card" data-question-id="${question.id}">
                    <div class="question-header">
                        <h4 class="question-number">Question ${qIdx + 1}/${normalizedQuestions.length}</h4>
                        <span class="question-points" data-points="${question.points || 10}">${question.points || 10} pts</span>
                    </div>

                    <p class="question-text">${question.question}</p>

                    <div class="question-options">
            `;

            // Créer les options de réponse
            question.options.forEach((option, oIdx) => {
                const optionId = `opt_${question.id}_${option.id}`;
                html += `
                    <label class="option-label" data-option-id="${option.id}" data-correct="${option.correct}">
                        <input type="radio" 
                               name="question_${question.id}" 
                               id="${optionId}"
                               value="${option.id}"
                               class="option-input"
                               data-explanation="${option.explanation || ''}">
                        <span class="option-text">${option.text}</span>
                    </label>
                `;
            });

            html += `
                    </div>

                    <!-- FEEDBACK QUESTION -->
                    <div class="question-feedback" style="display: none; margin-top: 15px;"></div>
                </div>
            `;
        });

        html += `
                </div>

                <!-- FEEDBACK GLOBAL -->
                <div id="qcm-scenario-feedback-${containerId}" class="qcm-scenario-feedback" style="margin-top: 25px; display: none;"></div>

                <!-- BOUTONS -->
                <div class="qcm-scenario-buttons">
                    <button class="btn btn--primary" style="flex: 1;"
                            onclick="App.validerQCMScenario('${containerId}')">
                        ✅ Valider mes réponses
                    </button>
                    <button class="btn btn--secondary" style="flex: 1; margin-left: 10px;"
                            onclick="App.reinitialiserQCMScenario('${containerId}')">
                        🔄 Recommencer
                    </button>
                </div>
            </div>
        `;

        return html;
    },

    /**
     * CLIQUER SUR UNE SITUATION
     */
    selectSituation(situationElement, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.querySelectorAll('.matching-situation.selected').forEach(el => {
            el.classList.remove('selected');
            el.style.backgroundColor = '';
            el.style.borderLeft = 'none';
        });

        situationElement.classList.add('selected');
        situationElement.style.backgroundColor = 'rgba(102, 126, 234, 0.15)';
        situationElement.style.borderLeft = '4px solid var(--color-primary)';

        Logger.debug(`📍 Situation sélectionnée: ${situationElement.dataset.pairId}`);
    },

    /**
     * CLIQUER SUR UN STATUT
     */
    selectStatus(statusButton, containerId) {
        const statusName = statusButton.dataset.statusName;
        const statusId = statusButton.dataset.statusId;

        const container = document.getElementById(containerId);
        if (!container) return;

        const selectedSituation = container.querySelector('.matching-situation.selected');

        if (!selectedSituation) {
            showErrorNotification('⚠️ Sélectionnez d\'abord un élément!');
            return;
        }

        const pairId = selectedSituation.dataset.pairId;

        selectedSituation.dataset.selectedStatus = statusId;
        selectedSituation.dataset.selectedStatusName = statusName;

        const statusDisplay = selectedSituation.querySelector('.matching-situation-status');
        statusDisplay.textContent = statusName;
        statusDisplay.style.display = 'block';
        statusDisplay.style.color = statusButton.style.borderColor || '#333';
        statusDisplay.style.fontWeight = 'bold';
        statusDisplay.style.marginTop = '8px';
        statusDisplay.style.padding = '6px 12px';
        statusDisplay.style.borderRadius = '4px';
        statusDisplay.style.backgroundColor = statusButton.style.backgroundColor;

        selectedSituation.classList.remove('selected');
        selectedSituation.style.backgroundColor = '';
        selectedSituation.style.borderLeft = 'none';

        Logger.debug(`✅ Associé: ${pairId} → ${statusName}`);
    },

    /**
     * RÉINITIALISER LES ASSOCIATIONS
     */
    reinitialiserMatching(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.querySelectorAll('.matching-situation').forEach(el => {
            el.dataset.selectedStatus = '';
            el.dataset.selectedStatusName = '';
            el.classList.remove('selected');
            el.style.backgroundColor = '';
            el.style.borderLeft = 'none';
            const statusDisplay = el.querySelector('.matching-situation-status');
            if (statusDisplay) {
                statusDisplay.textContent = '';
                statusDisplay.style.display = 'none';
            }
        });

        const feedback = container.querySelector(`#matching-feedback-${containerId}`);
        if (feedback) {
            feedback.style.display = 'none';
            feedback.innerHTML = '';
        }

        showSuccessNotification('🔄 Réinitialisé', 'Les associations ont été effacées');
    },

    /**
     * VALIDER TOUTES LES ASSOCIATIONS
     */
    validerMatching(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const situations = container.querySelectorAll('.matching-situation');
        const feedback = container.querySelector(`#matching-feedback-${containerId}`);

        let allCorrect = true;
        let correctCount = 0;

        situations.forEach((situation) => {
            const selectedStatus = situation.dataset.selectedStatus;
            const correctStatus = situation.dataset.correctStatus;

            if (!selectedStatus || selectedStatus === '') {
                allCorrect = false;
                situation.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                situation.style.borderLeft = '4px solid #EF4444';
                return;
            }

            if (selectedStatus === correctStatus) {
                situation.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
                situation.style.borderLeft = '4px solid #22C55E';
                correctCount++;
            } else {
                situation.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                situation.style.borderLeft = '4px solid #EF4444';
                allCorrect = false;
            }
        });

        if (allCorrect) {
            feedback.innerHTML = `
                <div style="background: rgba(34, 197, 94, 0.15);
                            border: 2px solid #22C55E;
                            color: #22C55E;
                            padding: 20px;
                            border-radius: 10px;
                            text-align: center;
                            font-weight: bold;">
                    ✅ <strong>PARFAIT!</strong> Toutes les associations sont correctes! (${correctCount}/${situations.length})
                </div>
            `;
            feedback.style.display = 'block';

            if (window.currentStepId && window.currentChapitreId) {
                const chapitre = CHAPITRES.find(ch => ch.id === window.currentChapitreId);
                const etape = chapitre?.etapes.find(e => e.id === window.currentStepId);
                const maxPoints = etape?.points || 75;
                
                this.marquerEtapeComplete(window.currentChapitreId, window.currentStepId);
                const result = StorageManager.addPointsToStep(window.currentStepId, maxPoints, maxPoints);
                this.updateHeader();

                // 🔧 FIX: Activer le bouton "Étape suivante"
                this.activerBoutonEtapeSuivante();

                setTimeout(() => {
                    showSuccessNotification('🎉 Excellent!', 'Vous avez réussi l\'exercice d\'association!');
                    this.fermerModal();
                    this.rafraichirAffichage();
                }, 1500);
            }
        } else {
            feedback.innerHTML = `
                <div style="background: rgba(239, 68, 68, 0.15);
                            border: 2px solid #EF4444;
                            color: #EF4444;
                            padding: 20px;
                            border-radius: 10px;
                            text-align: center;
                            font-weight: bold;">
                    ❌ <strong>Pas encore bon</strong> - ${correctCount}/${situations.length} associations correctes<br/>
                    <small>Vérifiez les cases rouges</small>
                </div>
            `;
            feedback.style.display = 'block';
        }
    },

    /**
     * 🔧 FIX: Active le bouton "Étape suivante" après validation d'un exercice
     */
    activerBoutonEtapeSuivante() {
        const btn = document.getElementById('next-etape-btn');
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.textContent = 'Étape suivante →';
            Logger.debug(`✅ Bouton "Étape suivante" activé`);
        }
    },

    /**
     * Valide un exercice simple (vidéo, lecture, flashcards)
     */
    validerExercice(type) {
        Logger.debug(`✅ Exercice ${type} validé!`);
        
        // Marquer l'étape comme complétée
        if (window.currentStepId && window.currentChapitreId) {
            // Vérifier si l'étape est déjà complétée
            const chapitre = CHAPITRES.find(ch => ch.id === window.currentChapitreId);
            const etape = chapitre?.etapes.find(e => e.id === window.currentStepId);
            const maxPoints = etape?.points || 10;
            
            this.marquerEtapeComplete(window.currentChapitreId, window.currentStepId);
            
            // Pour les exercices simples (video, lecture, flashcards), l'utilisateur gagne 100% des points
            const result = StorageManager.addPointsToStep(window.currentStepId, maxPoints, maxPoints);
            this.updateHeader();
            Logger.debug(`✅ ${result.message} (${result.totalForStep}/${result.maxPoints} points)`);
        }
        
        // 🔧 FIX: Activer le bouton "Étape suivante"
        this.activerBoutonEtapeSuivante();
        
        showSuccessNotification('🎉 Bravo!', 'Vous avez complété cet exercice!', '🎉', 2000);
        
        // ✅ PASSER À L'EXERCICE SUIVANT OU REVENIR AU MENU
        setTimeout(() => {
            this.allerExerciceSuivant();
        }, 2000);
    },

    /**
     * Retourner une flashcard (flip animation)
     */
    flipCard(cardElement) {
        if (!cardElement) return;
        
        const inner = cardElement.querySelector('.flashcard-inner');
        if (!inner) return;
        
        const isFlipped = cardElement.dataset.flipped === 'true';
        const newState = !isFlipped;
        
        cardElement.dataset.flipped = newState;
        inner.style.transform = newState ? 'rotateY(180deg)' : 'rotateY(0deg)';
        
        Logger.debug(`🎴 Flashcard ${newState ? 'retournée' : 'recto'}`);
    },

    /**
     * SÉLECTIONNER UNE RÉPONSE QCM SCÉNARIO
     */
    selectQCMScenarioOption(optionLabel, containerId) {
        const input = optionLabel.querySelector('.option-input');
        const questionCard = optionLabel.closest('.qcm-scenario-question-card');
        const allOptionsInQuestion = questionCard.querySelectorAll('.option-label');

        // Désélectionner les autres options
        allOptionsInQuestion.forEach(opt => {
            opt.classList.remove('selected');
            opt.style.backgroundColor = '';
            opt.style.borderLeft = 'none';
        });

        // Sélectionner la nouvelle option
        optionLabel.classList.add('selected');
        optionLabel.style.backgroundColor = 'rgba(102, 126, 234, 0.1)';
        optionLabel.style.borderLeft = '4px solid var(--color-primary)';

        Logger.debug(`✅ Option sélectionnée: ${input.value}`);
    },

    /**
     * RÉINITIALISER LES RÉPONSES QCM SCÉNARIO
     */
    reinitialiserQCMScenario(containerId) {
        const container = document.getElementById(containerId);

        // Décocher tous les radio buttons
        container.querySelectorAll('.option-input').forEach(input => {
            input.checked = false;
            const label = input.closest('.option-label');
            label.classList.remove('selected');
            label.style.backgroundColor = '';
            label.style.borderLeft = 'none';
        });

        // Masquer les feedbacks
        container.querySelectorAll('.question-feedback').forEach(fb => {
            fb.style.display = 'none';
            fb.innerHTML = '';
        });

        const globalFeedback = container.querySelector(`#qcm-scenario-feedback-${containerId}`);
        globalFeedback.style.display = 'none';
        globalFeedback.innerHTML = '';

        showSuccessNotification('🔄 Réinitialisé', 'Toutes vos réponses ont été effacées');
    },

    /**
     * VALIDER TOUTES LES RÉPONSES QCM SCÉNARIO
     */
    validerQCMScenario(containerId) {
        const container = document.getElementById(containerId);
        const questionCards = container.querySelectorAll('.qcm-scenario-question-card');
        const globalFeedback = container.querySelector(`#qcm-scenario-feedback-${containerId}`);

        let totalQuestions = 0;
        let correctAnswers = 0;
        let totalPoints = 0;
        let earnedPoints = 0;
        const results = [];

        // Parcourir chaque question
        questionCards.forEach((card) => {
            const questionId = card.dataset.questionId;
            const questionPointsElement = card.querySelector('.question-points');
            const questionPoints = parseInt(questionPointsElement.dataset.points);
            const selectedInput = card.querySelector('.option-input:checked');
            const questionFeedback = card.querySelector('.question-feedback');

            totalQuestions++;
            totalPoints += questionPoints;

            if (!selectedInput) {
                // ❌ QUESTION NON RÉPONDUE
                questionFeedback.innerHTML = `
                    <div style="background: rgba(255, 152, 0, 0.15); 
                                border: 1px solid #FF9800;
                                color: #E65100;
                                padding: 12px;
                                border-radius: 6px;
                                font-weight: bold;">
                        ⚠️ Question non répondue (${questionPoints} pts perdus)
                    </div>
                `;
                questionFeedback.style.display = 'block';
                results.push({ questionId, status: 'missing', points: 0 });
                return;
            }

            const isCorrect = selectedInput.dataset.correct === 'true';
            const explanation = selectedInput.dataset.explanation;

            if (isCorrect) {
                // ✅ RÉPONSE CORRECTE
                correctAnswers++;
                earnedPoints += questionPoints;
                
                const selectedLabel = selectedInput.closest('.option-label');
                selectedLabel.style.backgroundColor = 'rgba(34, 197, 94, 0.15)';
                selectedLabel.style.borderLeft = '4px solid var(--color-success)';

                questionFeedback.innerHTML = `
                    <div style="background: rgba(34, 197, 94, 0.15);
                                border: 1px solid var(--color-success);
                                color: var(--color-success);
                                padding: 12px;
                                border-radius: 6px;
                                font-weight: bold;">
                        ✅ <strong>Correct!</strong> (+${questionPoints} pts)<br/>
                        <small style="font-weight: normal;">${explanation}</small>
                    </div>
                `;
                questionFeedback.style.display = 'block';
                results.push({ questionId, status: 'correct', points: questionPoints });
            } else {
                // ❌ RÉPONSE INCORRECTE
                const selectedLabel = selectedInput.closest('.option-label');
                selectedLabel.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                selectedLabel.style.borderLeft = '4px solid var(--color-error)';

                // Afficher la bonne réponse
                const goodOption = card.querySelector('.option-input[data-correct="true"]');
                const goodLabel = goodOption.closest('.option-label');
                goodLabel.style.backgroundColor = 'rgba(34, 197, 94, 0.15)';
                goodLabel.style.borderLeft = '4px solid var(--color-success)';
                goodLabel.style.color = 'var(--color-success)';

                questionFeedback.innerHTML = `
                    <div style="background: rgba(239, 68, 68, 0.15);
                                border: 1px solid var(--color-error);
                                color: var(--color-error);
                                padding: 12px;
                                border-radius: 6px;
                                font-weight: bold;">
                        ❌ <strong>Incorrect</strong> (0 pts)<br/>
                        <small style="font-weight: normal; color: var(--color-text-light);">
                            Bonne réponse: ${goodOption.closest('.option-label').querySelector('.option-text').textContent}<br/>
                            ${goodOption.dataset.explanation}
                        </small>
                    </div>
                `;
                questionFeedback.style.display = 'block';
                results.push({ questionId, status: 'incorrect', points: 0 });
            }
        });

        // CALCUL FINAL
        const percentage = Math.round((correctAnswers / totalQuestions) * 100);
        const isPassed = percentage >= 70;

        // AFFICHER FEEDBACK GLOBAL
        let feedbackHTML = `
            <div style="${isPassed ? 
                'background: rgba(34, 197, 94, 0.15); border: 2px solid var(--color-success); color: var(--color-success);' :
                'background: rgba(239, 68, 68, 0.15); border: 2px solid var(--color-error); color: var(--color-error);'
            } padding: 20px; border-radius: 10px; text-align: center; font-weight: bold;">
                ${isPassed ? '✅ <strong>SUCCÈS!</strong>' : '❌ <strong>À AMÉLIORER</strong>'}<br/>
                <div style="font-size: 24px; margin: 10px 0;">
                    ${correctAnswers}/${totalQuestions} bonnes réponses (${percentage}%)
                </div>
                <div style="font-size: 18px; margin-top: 10px;">
                    ${earnedPoints}/${totalPoints} points
                </div>
        `;

        if (isPassed) {
            feedbackHTML += `<div style="margin-top: 10px; font-size: 14px;">Vous avez atteint le minimum de 70%!</div>`;
        } else {
            feedbackHTML += `<div style="margin-top: 10px; font-size: 14px;">Vous devez obtenir au moins 70% pour réussir. Essayez à nouveau!</div>`;
        }

        feedbackHTML += `</div>`;

        globalFeedback.innerHTML = feedbackHTML;
        globalFeedback.style.display = 'block';

        // MARQUER COMME COMPLÉTÉE SI RÉUSSI
        if (isPassed && window.currentStepId && window.currentChapitreId) {
            this.marquerEtapeComplete(window.currentChapitreId, window.currentStepId);
            this.addPoints(earnedPoints, `QCM Scénario réussi (${percentage}%)`);
            
            // 🔧 FIX: Activer le bouton "Étape suivante"
            this.activerBoutonEtapeSuivante();

            setTimeout(() => {
                showSuccessNotification('🎉 Bravo!', `Vous avez réussi avec ${percentage}%!`);
                this.fermerModal();
            }, 2500);
        }

        Logger.debug('Résultats:', results);
    },

    /**
     * 🌉 BRIDGE FUNCTION 1️⃣: Trouver un chapitre par son ID dans tous les niveaux
     */
    findChapitreById(chapId) {
        // D'abord chercher dans CHAPITRES (niveau actuel)
        if (CHAPITRES && Array.isArray(CHAPITRES)) {
            const found = CHAPITRES.find(ch => ch.id === chapId);
            if (found) return found;
        }
        
        // Sinon chercher dans tous les niveaux chargés
        if (window.allNiveaux) {
            for (let niveauId in window.allNiveaux) {
                const chapitres = window.allNiveaux[niveauId];
                if (Array.isArray(chapitres)) {
                    const found = chapitres.find(ch => ch.id === chapId);
                    if (found) return found;
                }
            }
        }
        
        return null;
    },

    /**
     * 🌉 BRIDGE FUNCTION 2️⃣: Obtenir tous les chapitres d'un niveau
     */
    getChapitresForNiveau(niveauId) {
        // Normaliser l'ID en majuscule (N1, N2, N3, N4)
        const normalizedId = niveauId.toUpperCase();
        
        // D'abord vérifier si c'est le niveau actuel et CHAPITRES est chargé
        if (window.currentNiveauId === normalizedId && CHAPITRES && Array.isArray(CHAPITRES) && CHAPITRES.length > 0) {
            return CHAPITRES;
        }
        
        // Sinon chercher dans allNiveaux (chargé par afficherNiveaux)
        if (window.allNiveaux && window.allNiveaux[normalizedId]) {
            return window.allNiveaux[normalizedId];
        }
        
        // Chercher dans window.niveauxData si allNiveaux n'est pas disponible
        if (window.niveauxData) {
            const niveauData = window.niveauxData.find(n => n.id === normalizedId);
            if (niveauData && niveauData.chapitres) {
                return niveauData.chapitres;
            }
        }
        
        Logger.warn(`⚠️ Chapitres pour ${normalizedId} non trouvés`);
        return [];
    },

    /**
     * 🌉 BRIDGE FUNCTION 3️⃣: Calculer la progression globale d'un niveau
     */
    calculateNiveauProgress(niveauId) {
        const chapitres = this.getChapitresForNiveau(niveauId);
        
        if (!chapitres || chapitres.length === 0) {
            Logger.warn(`⚠️ Aucun chapitre trouvé pour le niveau ${niveauId}`);
            return 0;
        }
        
        // Compter les étapes complétées et totales
        let totalCompleted = 0;
        let totalSteps = 0;
        
        chapitres.forEach(chapitre => {
            if (chapitre.etapes && Array.isArray(chapitre.etapes)) {
                totalSteps += chapitre.etapes.length;
                totalCompleted += chapitre.etapes.filter(e => e.completed === true).length;
            }
        });
        
        const progress = totalSteps > 0 ? Math.round((totalCompleted / totalSteps) * 100) : 0;
        
        Logger.debug(`📊 Niveau ${niveauId}: ${totalCompleted}/${totalSteps} étapes = ${progress}%`);
        return progress;
    },

    /**
     * 🌉 BRIDGE FUNCTION 4️⃣: Mettre à jour l'affichage de la progression du niveau
     */
    updateNiveauProgressDisplay(niveauId) {
        // Normaliser l'ID en majuscule (N1, N2, N3, N4)
        const normalizedId = niveauId.toUpperCase();
        
        const progress = this.calculateNiveauProgress(normalizedId);
        
        // Trouver l'élément de barre de progression pour ce niveau
        const niveauElement = document.querySelector(`[data-niveau-id="${normalizedId}"]`);
        if (!niveauElement) {
            Logger.warn(`⚠️ Élément niveau ${normalizedId} non trouvé dans le DOM`);
            return;
        }
        
        // Mettre à jour la barre de progression (cercle SVG ou autre)
        const progressBar = niveauElement.querySelector('.progress-bar');
        const progressFill = niveauElement.querySelector('.progress-fill');
        const progressText = niveauElement.querySelector('.progress-text');
        
        if (progressFill) {
            progressFill.style.width = progress + '%';
            Logger.debug(`✅ Barre progression ${normalizedId}: ${progress}%`);
        }
        
        if (progressText) {
            progressText.textContent = progress + '% complété';
            Logger.debug(`✅ Texte progression ${normalizedId}: ${progress}% complété`);
        }
        
        // Aussi chercher un SVG de cercle (pour le cercle du niveau)
        const svgCircle = niveauElement.querySelector('.niveau-progress-circle');
        if (svgCircle) {
            // Le cercle SVG a généralement un attribut stroke-dashoffset
            // qui dépend du pourcentage
            const circumference = 2 * Math.PI * 45; // Si rayon = 45
            const offset = circumference - (progress / 100) * circumference;
            svgCircle.style.strokeDashoffset = offset;
            
            const percentText = niveauElement.querySelector('.niveau-progress-percent');
            if (percentText) {
                percentText.textContent = progress + '%';
            }
            
            Logger.debug(`✅ Cercle ${niveauId}: ${progress}%`);
        }
    },

    /**
     * ✅ CHARGE les états de TOUTES les étapes d'un chapitre depuis StorageManager
     * FIX #1: Synchronise chapitre.etapes[].completed avec les données persistées
     * ✅ FIX OPTION B: Charge aussi l'état des objectifs visuels (jalon séparé)
     * CRITIQUE: À appeler quand on affiche un chapitre, sinon les étapes réapparaissent incomplètes après reload
     */
    loadChapitreEtapesStates(chapitreId) {
        const chapitre = this.findChapitreById(chapitreId);
        if (!chapitre || !chapitre.etapes) {
            Logger.warn(`⚠️ loadChapitreEtapesStates: Chapitre ${chapitreId} invalide`);
            return;
        }
        
        Logger.debug(`🔄 FIX #1: Chargement des états des étapes pour ${chapitreId}...`);
        
        // ✅ FIX OPTION B: Charger l'état des objectifs visuels (jalon séparé)
        const objectifsStatus = StorageManager?.getObjectifsStatus?.(chapitreId);
        if (objectifsStatus?.completed === true) {
            chapitre.objectifsCompleted = true;
            Logger.debug(`  ✅ Objectifs visuels: loaded as COMPLETED`);
        } else {
            chapitre.objectifsCompleted = false;
            Logger.debug(`  ⏳ Objectifs visuels: loaded as NOT_COMPLETED`);
        }
        
        // Charger les vraies étapes
        chapitre.etapes.forEach((etape, index) => {
            const etapeState = StorageManager.getEtapeState(chapitreId, index);
            if (etapeState && etapeState.completed === true) {
                etape.completed = true;
                Logger.debug(`  ✅ Étape ${index} (${etape.id}): loaded as COMPLETED`);
            } else {
                etape.completed = false;
                Logger.debug(`  ⏳ Étape ${index} (${etape.id}): loaded as IN_PROGRESS`);
            }
        });
        
        // ✅ FIX OPTION B: Charger l'état du portfolio (si pas dans les étapes)
        const portfolioStatus = StorageManager?.getPortfolioStatus?.(chapitreId);
        if (portfolioStatus?.completed === true) {
            chapitre.portfolioCompleted = true;
            Logger.debug(`  ✅ Portfolio: loaded as COMPLETED`);
        }
        
        Logger.debug(`✅ Tous les états chargés pour ${chapitreId}`);
    },

    /**
     * Calcule la progression d'un chapitre (0-100%)
     * AMÉLIORÉ: Utilise findChapitreById pour chercher dans tous les niveaux
     */
    calculateChapterProgress(chapitreId) {
        // Utiliser la fonction bridge pour trouver le chapitre
        const chapitre = this.findChapitreById(chapitreId);
        
        if (!chapitre || !chapitre.etapes || chapitre.etapes.length === 0) {
            return 0;
        }
        
        const completedCount = chapitre.etapes.filter(e => e.completed === true).length;
        const total = chapitre.etapes.length;
        const progress = Math.round((completedCount / total) * 100);
        
        Logger.debug(`📊 Progression ${chapitreId}: ${completedCount}/${total} = ${progress}%`);
        return progress;
    },

    /**
     * Met à jour la barre de progression visuelle d'un chapitre
     */
    updateChapterProgressBar(chapitreId) {
        const progress = this.calculateChapterProgress(chapitreId);
        const chapitre = CHAPITRES.find(ch => ch.id === chapitreId);
        
        if (!chapitre) return;
        
        // Mettre à jour la propriété du chapitre
        chapitre.progression = progress;
        
        // Mettre à jour le DOM si visible
        const progressFill = document.querySelector(`[data-chapter-id="${chapitreId}"] .progress-fill`);
        if (progressFill) {
            progressFill.style.width = progress + '%';
            progressFill.style.backgroundColor = chapitre.couleur || '#667eea';
        }
        
        const progressText = document.querySelector(`[data-chapter-id="${chapitreId}"] .progress-text`);
        if (progressText) {
            progressText.textContent = progress + '% complété';
        }
        
        Logger.debug(`✅ Progress bar mise à jour pour ${chapitreId}: ${progress}%`);
    },

    /**
     * 🔓 NOUVEAU: Initialise le déverrouillage des étapes
     * - Première étape: toujours accessible
     * - Autres étapes: verrouillées jusqu'à complètion de la précédente
     */
    initChapitreProgress(chapitreId) {
        const chapitre = CHAPITRES.find(ch => ch.id === chapitreId);
        
        if (!chapitre || !chapitre.etapes) {
            Logger.warn(`⚠️ Chapitre ${chapitreId} non trouvé pour initialiser les locks`);
            return;
        }
        
        Logger.debug(`🔓 Initialisation des locks pour ${chapitreId}...`);
        
        chapitre.etapes.forEach((etape, idx) => {
            const isFirstStep = idx === 0;
            
            // Initialiser les états de chaque étape
            const etapeState = {
                isLocked: !isFirstStep,     // Seule la première est accessible
                isAccessible: isFirstStep,
                visited: isFirstStep ? true : false
            };
            
            // Sauvegarder dans StorageManager
            StorageManager.saveEtapeState(chapitreId, idx, etapeState);
            
            Logger.debug(`  ✅ Étape ${idx} (${etape.id}): ${isFirstStep ? '🔓 Déverrouillée' : '🔒 Verrouillée'}`);
        });
        
        Logger.debug(`✅ Déverrouillage initialisé pour ${chapitreId}`);
    },

    /**
     * ✅ CALCULE la progression du chapitre depuis localStorage
     * FIX V2: Les clés localStorage utilisent UNIQUEMENT le stepId
     */
    calculateChapterCompletionFromStorage(chapId) {
        Logger.debug(`🔍 Calculant progression pour ${chapId}...`);
        
        const chapitre = CHAPITRES?.find(c => c.id === chapId);
        if (!chapitre) {
            Logger.error(`❌ Chapitre ${chapId} non trouvé`);
            return 0;
        }

        let stepsCompleted = 0;
        const totalSteps = chapitre.etapes ? chapitre.etapes.length : 0;
        
        if (!chapitre.etapes || totalSteps === 0) {
            Logger.warn(`⚠️ Chapitre ${chapId} a 0 étapes`);
            return 0;
        }

        chapitre.etapes.forEach(etape => {
            // CRUCIAL: Extraire le stepId SANS le chapitre.id au début
            const stepId = etape.id.replace(`${chapId}_`, '');
            
            // Construire la clé localStorage CORRECTE
            const stepKey = `step_${chapId}_${stepId}`;
            
            Logger.debug(`  Cherchant: ${stepKey} (etape.id=${etape.id})`);
            
            const stepData = localStorage.getItem(stepKey);
            
            if (stepData) {
                try {
                    const parsed = JSON.parse(stepData);
                    if (parsed.completed === true) {
                        stepsCompleted++;
                        Logger.debug(`    ✅ Trouvée et complétée`);
                    } else {
                        Logger.debug(`    ⏳ Pas complétée (${parsed.completed})`);
                    }
                } catch (e) {
                    Logger.error(`    ❌ Erreur parsing ${stepKey}:`, e);
                }
            } else {
                Logger.debug(`    ⏳ Pas trouvée dans localStorage`);
            }
        });

        const completion = totalSteps > 0 ? (stepsCompleted / totalSteps) * 100 : 0;
        
        Logger.debug(`📊 ${chapId}: ${stepsCompleted}/${totalSteps} = ${completion.toFixed(1)}%`);
        
        return completion;
    },

    /**
     * Marque une étape comme complétée - Améliorée avec SVG re-render
     * ✅ AVEC PROTECTION CONTRE RACE CONDITIONS
     */
    marquerEtapeComplete(chapitreId, stepId) {
        Logger.debug(`✅ Marquer complète: ${stepId} du chapitre ${chapitreId}`);
        
        // 🔒 FIX: Prévenir appels simultanés (race condition)
        if (isEtapeProcessing) {
            Logger.warn('⚠️ Étape déjà en cours de validation. Double-click ignoré.');
            return;
        }
        isEtapeProcessing = true;
        
        // 🔒 Désactiver TOUS les boutons de navigation pendant le traitement
        const allNavButtons = document.querySelectorAll('[onclick*="afficherEtape"], [onclick*="allerExercice"], .btn-next, .btn-previous, [data-action="next"], [data-action="previous"]');
        const disableButtons = () => {
            allNavButtons.forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.pointerEvents = 'none';
            });
        };
        
        // 🔓 RÉACTIVER les boutons après traitement
        const enableButtons = () => {
            allNavButtons.forEach(btn => {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            });
        };
        
        disableButtons();
        
        try {
            // 🌉 Utiliser la fonction bridge pour trouver le chapitre
            const chapitre = this.findChapitreById(chapitreId);
            const etape = chapitre?.etapes.find(e => e.id === stepId);
            
            if (etape) {
                etape.completed = true;
                
                // 1️⃣ Sauvegarder dans localStorage (ancien système)
                const stepProgress = {
                    completed: true,
                    timestamp: new Date().toISOString(),
                    score: 100
                };
                localStorage.setItem(`step_${stepId}`, JSON.stringify(stepProgress));
                
                // 🔧 NOUVEAU: Sauvegarder via StorageManager avec status 'completed'
                // Chercher l'index de l'étape
                const etapeIndex = chapitre.etapes.findIndex(e => e.id === stepId);
                StorageManager.saveEtapeState(chapitreId, etapeIndex, {
                    visited: true,
                    completed: true,
                    status: 'completed',
                    completedAt: new Date().toISOString()
                });
                Logger.debug(`✅ StorageManager: Étape ${stepId} marquée COMPLETED`);
                
                // ⏸️ Attendre que localStorage soit écrit avant de continuer
                // Cela évite que updateStepIcons() lise des données incohérentes
                const savedState = StorageManager.loadEtapeState(chapitreId, etapeIndex);
                if (!savedState?.completed) {
                    Logger.warn('⚠️ Attention: localStorage n\'a pas bien persisté completed: true');
                }
                
                // Calculer la progression du chapitre
                const completedCount = chapitre.etapes.filter(e => e.completed).length;
                chapitre.progression = Math.round((completedCount / chapitre.etapes.length) * 100);
                
                // 🔄 NOUVEAU: Mettre à jour la barre de progression visuelle
                this.updateChapterProgressBar(chapitreId);
                
                // 📊 NOUVEAU: Tracker les points de l'étape
                const points = etape.points || 10;
                const data = JSON.parse(localStorage.getItem('douanelmsv2'));
                if (data && data.stepsPoints) {
                    data.stepsPoints[stepId] = points;
                    data.user.totalPoints = calculateTotalPoints(data.stepsPoints);
                    localStorage.setItem('douanelmsv2', JSON.stringify(data));
                    Logger.debug(`📊 Points mis à jour: +${points}pts (Total: ${data.user.totalPoints}pts)`);
                }
                
                // 2️⃣ Sauvegarder dans le localStorage
                const chaptersProgress = StorageManager.getChaptersProgress();
                if (!chaptersProgress[chapitreId]) {
                    chaptersProgress[chapitreId] = {
                        title: chapitre.titre,
                        completion: 0,
                        stepsCompleted: []
                    };
                }
                chaptersProgress[chapitreId].completion = chapitre.progression;
                if (!chaptersProgress[chapitreId].stepsCompleted.includes(stepId)) {
                    chaptersProgress[chapitreId].stepsCompleted.push(stepId);
                }
                StorageManager.update('chaptersProgress', chaptersProgress);
                
                // ➕ NOUVEAU: Recalculer la progression depuis les données persistées
                // Cela garantit que la progression est toujours synchronisée avec les étapes réelles
                const recalculatedCompletion = this.calculateChapterCompletionFromStorage(chapitreId);
                Logger.debug(`✅ Étape ${stepId} marquée comme complétée`);
                Logger.debug(`📊 Progression du chapitre: ${chapitre.progression}% (calculé: ${recalculatedCompletion}%)`);
                
                // ➕ SYNCHRONISER: Forcer la progression mise à jour dans StorageManager
                StorageManager.updateChapterProgress(chapitreId, {
                    completion: recalculatedCompletion,
                    stepsCompleted: chaptersProgress[chapitreId].stepsCompleted
                });
                Logger.debug(`✅ Synchronisation StorageManager: ${chapitreId} = ${recalculatedCompletion}%`);
                
                // 🔓 SYSTÈME DE VERROUS: Mettre à jour les icônes visuelles après completion
                // AUGMENTÉ de 100ms → 300ms pour GARANTIR localStorage sync (FIX race condition)
                setTimeout(() => {
                    updateStepIcons(chapitreId, chapitre);
                }, 300);

                // 🔓 NOUVEAU: Déverrouiller l'étape suivante si elle existe
                const currentIndex = etapeIndex;
                if (currentIndex + 1 < chapitre.etapes.length) {
                    const nextEtape = chapitre.etapes[currentIndex + 1];
                
                StorageManager.saveEtapeState(chapitreId, currentIndex + 1, {
                    isLocked: false,        // Déverrouiller
                    isAccessible: true
                });
                
                Logger.debug(`🔓 Étape suivante déverrouillée: ${nextEtape.id}`);
            } else {
                Logger.debug(`✨ Dernière étape complétée!`);
            }

            // 🌉 NOUVEAU: Mettre à jour la progression du NIVEAU
            // Trouver le niveauId en cherchant dans allNiveaux ou en utilisant currentNiveauId
            const niveauId = window.currentNiveauId;
            if (niveauId) {
                this.updateNiveauProgressDisplay(niveauId);
                Logger.debug(`🌟 Progression du niveau ${niveauId} mise à jour`);
            }

            // 3️⃣ ✅ NOUVEAU : RE-GÉNÉRER LE SVG avec les nouveaux états
            const pathContainer = document.querySelector(
                `[data-chapitre-id="${chapitreId}"] .path-svg`
            );
            
            if (pathContainer && chapitre) {
                Logger.debug(`🎨 Re-générant SVG pour ${chapitreId}...`);
                
                // 🔧 FIX: Do NOT reload from localStorage - we just updated storage!
                // Directly regenerate SVG with current in-memory state
                // (generatePathSVG will read localStorage if needed, which is fine)
                
                // Régénérer le SVG avec les nouveaux états
                const newSVG = generatePathSVG(chapitre.etapes, chapitre);
                pathContainer.innerHTML = newSVG;
                
                // ✅ Re-attacher les événements click sur les nouvelles étapes SVG
                pathContainer.querySelectorAll('.step-group').forEach((step, svgIndex) => {
                    step.style.cursor = 'pointer';
                    step.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const stepId = step.getAttribute('data-step-id');
                        const isObjectives = step.dataset.isObjectives === 'true';
                        const isPortfolio = step.dataset.isPortfolio === 'true';
                        
                        if (stepId) {
                            // Si c'est les objectifs ou portfolio, les traiter spécialement
                            if (isObjectives || stepId.includes('objectives')) {
                                App.afficherModalObjectives(chapitreId);
                            } else if (isPortfolio || stepId.includes('portfolio')) {
                                App.afficherPortfolioModal(chapitreId);
                            } else {
                                // ✅ FIX OPTION B: Calculer l'index réel dans chapitre.etapes[]
                                // L'index SVG n'est pas l'index JSON à cause du jalon Objectifs ajouté en premier
                                const allStepGroups = Array.from(pathContainer.querySelectorAll('.step-group'));
                                let etapeIndex = 0;
                                for (let i = 0; i < svgIndex; i++) {
                                    const prevEl = allStepGroups[i];
                                    const prevIsObj = prevEl.dataset.isObjectives === 'true';
                                    const prevIsPort = prevEl.dataset.isPortfolio === 'true';
                                    if (!prevIsObj && !prevIsPort) {
                                        etapeIndex++;
                                    }
                                }
                                App.afficherEtape(chapitreId, etapeIndex);
                            }
                        }
                    });
                });

                Logger.debug(`✅ SVG régénéré avec nouveaux états`);
            }

            // 🔧 FIX: DO NOT AUTO-DISPLAY PORTFOLIO
            // Portfolio should only display when user clicks on it or after explicitly completing swipes
            // NOT when all etapes are marked complete (because Portfolio is NOT in chapitre.etapes[])
            const estDerniere = chapitre.etapes.every(e => e.completed);
            const estEnPratique = window.currentPageName === 'pratique';
            
            if (estDerniere && !estEnPratique) {
                Logger.debug('✅ Tous les objectifs atteints! Portfolio est maintenant accessible.');
                // Do NOT call afficherPortfolioModal() here - let user click on it
                // This prevents the auto-display bug where Portfolio appears before user can swipe
            } else if (estDerniere && estEnPratique) {
                Logger.debug('📚 Tous les objectifs atteints mais on est en révision (pratique)');
            }
            } // Ferme if(etape)
        } catch (error) {
            Logger.error('❌ Erreur dans marquerEtapeComplete():', error);
        } finally {
            // 🔓 RÉACTIVER les boutons après tout traitement (CRITIQUE FIX)
            setTimeout(() => {
                enableButtons();
                isEtapeProcessing = false;
                Logger.debug('✅ marquerEtapeComplete: Traitement terminé - boutons réactivés et flag reset');
            }, 500);  // 500ms = délai suffisant pour tout le traitement
        }
    },
    
    /**
     * Rafraîchit l'affichage du chapitre
     */
    rafraichirAffichage() {
        if (window.currentChapitreId) {
            setTimeout(() => {
                this.afficherChapitre(window.currentChapitreId);
            }, 500);
        }
    },

    /**
     * ✅ COMPLÈTE une étape CONSULTATION (Type A)
     * Utilisée pour: Vidéos, Lectures, Contenus théoriques sans scoring
     * 
     * @param {string} chapitreId - ID du chapitre
     * @param {number} etapeIndex - Index de l'étape
     * @param {object} metadata - { viewed, timeSpent, etc. }
     */
    completerEtapeConsultation(chapitreId, etapeIndex, metadata = {}) {
        Logger.debug(`[📖 CONSULTATION] Complétant étape ${chapitreId}:${etapeIndex}`, metadata);
        
        try {
            const chapter = CHAPITRES.find(c => c.id === chapitreId);
            const etape = chapter?.etapes[etapeIndex];
            
            if (!etape) {
                Logger.error(`❌ Étape ${chapitreId}:${etapeIndex} non trouvée`);
                showErrorNotification('Étape non trouvée');
                return { success: false };
            }
            
            // 1. SAUVEGARDER comme COMPLÉTÉE (Consultation = score 100%)
            this.markStepAttempted(chapitreId, etapeIndex, 100);
            
            // 2. Mettre à jour localStorage legacy
            localStorage.setItem(`step_${etape.id}`, JSON.stringify({
                completed: true,
                timestamp: new Date().toISOString(),
                score: 100,
                type: 'consultation'
            }));
            
            // 3. Afficher notification
            showSuccessNotification('✅ Étape de consultation complétée!');
            
            Logger.debug(`[✅] Étape ${etape.titre} marquée COMPLÉTÉE (Consultation)`);
            
            return {
                success: true,
                message: 'Étape complétée',
                nextStepUnlocked: etapeIndex + 1 < chapter.etapes.length
            };
            
        } catch (error) {
            Logger.error(`[❌] Erreur completerEtapeConsultation:`, error);
            showErrorNotification('Erreur lors de la sauvegarde');
            return { success: false, message: error.message };
        }
    },

    /**
     * 🎯 VALIDE une étape VALIDATION (Type B)
     * Utilisée pour: QCM, Quiz, Assessments avec seuil ≥ 80%
     * 
     * @param {string} chapitreId - ID du chapitre
     * @param {number} etapeIndex - Index de l'étape
     * @param {number} score - Score obtenu (0-100)
     * @param {object} metadata - { answers, duration, etc. }
     */
    validerEtapeAvecSeuil(chapitreId, etapeIndex, score, metadata = {}) {
        const MIN_SCORE = 80;
        
        Logger.debug(`[🎯 VALIDATION] Étape ${chapitreId}:${etapeIndex} | Score: ${score}%`);
        
        try {
            const chapter = CHAPITRES.find(c => c.id === chapitreId);
            const etape = chapter?.etapes[etapeIndex];
            
            if (!etape) {
                Logger.error(`❌ Étape ${chapitreId}:${etapeIndex} non trouvée`);
                return { success: false, passed: false };
            }
            
            // DÉTERMINER si score ≥ 80%
            const passed = score >= MIN_SCORE;
            
            // SAUVEGARDER la tentative
            const state = this.markStepAttempted(chapitreId, etapeIndex, score);
            
            if (passed) {
                // ✅ SUCCÈS!
                Logger.debug(`[🎉] SUCCÈS! Score ${score}% ≥ ${MIN_SCORE}%`);
                showSuccessNotification(`✅ RÉUSSI! Score: ${score}%`);
                
                // Note: unlockNextStep() est déjà appelé dans markStepAttempted()
                
                return {
                    success: true,
                    passed: true,
                    score: score,
                    message: `✅ Réussi avec ${score}%`
                };
            } else {
                // ❌ ÉCHOUÉ
                const attempts = (state.attempts || 0) + 1;
                const attemptsRemaining = Math.max(0, AppConfig.VALIDATION.MAX_ATTEMPTS - attempts);
                
                Logger.debug(`[❌] ÉCHOUÉ. Score ${score}% < ${MIN_SCORE}%`);
                Logger.debug(`[📍] Tentatives: ${attempts}/${AppConfig.VALIDATION.MAX_ATTEMPTS}, Restantes: ${attemptsRemaining}`);
                
                if (attemptsRemaining > 0) {
                    showErrorNotification(
                        `❌ Score insuffisant: ${score}% < ${MIN_SCORE}%\n` +
                        `Tentatives restantes: ${attemptsRemaining}/${AppConfig.VALIDATION.MAX_ATTEMPTS}`
                    );
                } else {
                    showErrorNotification(
                        `❌ Score insuffisant: ${score}%\n` +
                        `Tentatives épuisées (${AppConfig.VALIDATION.MAX_ATTEMPTS}/${AppConfig.VALIDATION.MAX_ATTEMPTS})`
                    );
                }
                
                return {
                    success: true,  // Opération réussie (mais test échoué)
                    passed: false,
                    score: score,
                    attemptsRemaining: attemptsRemaining,
                    message: `Score insuffisant: ${score}% < ${MIN_SCORE}%`
                };
            }
            
        } catch (error) {
            Logger.error(`[❌] Erreur validateStepWithThreshold:`, error);
            showErrorNotification('Erreur validation');
            return { success: false, message: error.message, passed: false };
        }
    },

    /**
     * Valide un exercice depuis la modal renderExerciseModal
     * DÉTECTE automatiquement: CONSULTATION vs VALIDATION
     * Routes vers completerEtapeConsultation() ou validateStepWithThreshold()
     */
    validerExerciceRenderModal(typeExo, chapitreId, stepIndex) {
        Logger.debug(`[🔀 EXERCICE] Type: ${typeExo} | Ch: ${chapitreId} | Step: ${stepIndex}`);
        
        // Récupérer l'étape et l'exercice
        const chapter = CHAPITRES.find(c => c.id === chapitreId);
        const step = chapter?.etapes[stepIndex];
        if (!step || !step.exercices || step.exercices.length === 0) {
            Logger.error('❌ Étape/Exercice non trouvé');
            return;
        }
        
        const exercice = step.exercices[0];
        
        // ========== DÉTERMINER TYPE D'ÉTAPE ==========
        // CONSULTATION: video, lecture, objectives, portfolio, flashcards (libre)
        // VALIDATION: qcm, qcm_scenario, quiz, assessment, scenario, calculation (seuil ≥ 80%)
        const CONSULTATION_TYPES = ['video', 'lecture', 'objectives', 'portfolio'];
        const VALIDATION_TYPES = ['qcm', 'qcm_scenario', 'quiz', 'assessment', 'scenario', 'calculation', 'flashcards'];
        
        const isConsultation = CONSULTATION_TYPES.includes(typeExo) || step.consultation === true;
        const isValidation = VALIDATION_TYPES.includes(typeExo) || step.validation === true;
        
        Logger.debug(`[🎯] Détection: Consultation=${isConsultation}, Validation=${isValidation}`);
        
        // ========== CAS 1: CONSULTATION (Type A) ==========
        if (isConsultation) {
            Logger.debug(`[📖] MODE CONSULTATION: Marquer simplement comme complétée`);
            const result = this.completerEtapeConsultation(chapitreId, stepIndex, {
                viewed: true,
                type: typeExo
            });
            
            if (result.success) {
                // Fermer la modal et aller à l'étape suivante
                const modal = document.getElementById('exercise-modal');
                if (modal) modal.remove();
                
                // Recharger le chapitre pour montrer progression
                setTimeout(() => {
                    if (this.returnPath === 'pratique') {
                        this.returnPath = null;
                        this.loadPage('pratique');
                    } else {
                        this.afficherChapitre(chapitreId);
                    }
                }, 1000);
            }
            return;
        }
        
        // ========== CAS 2: VALIDATION (Type B) ==========
        if (isValidation) {
            Logger.debug(`[🎯] MODE VALIDATION: Calculer le score`);
            
            let score = 0;
            
            if (typeExo === 'quiz') {
                // ✅ Validation QUIZ: appeler validerQuiz directement
                Logger.debug(`[📋] Quiz Validation: Appel à validerQuiz()`);
                this.validerQuiz();
                return;
                
            } else if (typeExo === 'qcm' || typeExo === 'qcm_scenario') {
                // Vérifier si c'est un QCM multi-questions ou simple
                const hasMultipleQuestions = exercice.content?.questions && exercice.content.questions.length > 0;
                
                if (hasMultipleQuestions) {
                    // QCM avec plusieurs questions - utiliser validerQuiz
                    Logger.debug(`[📋] QCM Multi-questions: Appel à validerQuiz()`);
                    this.validerQuiz();
                    return;
                } else {
                    // ✅ Validation QCM simple avec une seule question
                    const selectedRadio = document.querySelector('input[name="qcm_answer"]:checked');
                    if (!selectedRadio) {
                        showErrorNotification('⚠️ Veuillez sélectionner une réponse');
                        return;
                    }
                    
                    const correctAnswer = parseInt(exercice.content.correctAnswer);
                    const selectedIndex = parseInt(selectedRadio.value);
                    const isCorrect = selectedIndex === correctAnswer;
                    
                    score = isCorrect ? 100 : 0;
                    
                    Logger.debug(`[🔍] QCM Validation:
  Correct: ${correctAnswer}, Selected: ${selectedIndex}
  Result: ${isCorrect ? '✅' : '❌'}
  Score: ${score}%`);
                }
                
            } else if (typeExo === 'flashcards') {
                // Flashcards: Score automatique 100% si étudié
                score = 100;
                
            } else {
                // Autres types: score 100% par défaut
                score = 100;
            }
            
            // VALIDER avec seuil ≥ 80%
            const result = validateStepWithThreshold(chapitreId, stepIndex, score, {
                type: typeExo,
                duration: 0
            });
            
            // Afficher le résultat dans submitExercise (pour cohérence avec ancienne UI)
            window.lastScore = score;
            this.submitExercise(chapitreId, stepIndex);
            return;
        }
        
        // ========== CAS 3: TYPE INCONNU ==========
        Logger.warn(`[⚠️] Type d'exercice non géré: ${typeExo}`);
        showErrorNotification(`Type d'exercice non supporté: ${typeExo}`);
    },

    /**
     * Valide un QCM - Version SÉCURISÉE sans exposition réponses
     */
    validerQCMSecurise(qcmId) {
        const qcmData = window.QCM_ANSWERS?.[qcmId];
        if (!qcmData) {
            Logger.error('❌ QCM ID invalide');
            showErrorNotification('❌ Erreur: QCM invalide');
            return;
        }

        const selectedInput = document.querySelector(
            `input[name="${qcmId}"]:checked`
        );

        if (!selectedInput) {
            showErrorNotification('⚠️ Veuillez sélectionner une réponse');
            return;
        }

        const selectedIndex = parseInt(selectedInput.value);
        
        // 🔍 DEBUG: Afficher les types et valeurs pour diagnostiquer le bug "réponse juste = faux"
        Logger.debug('🔍 DEBUG validerQCMSecurise:');
        Logger.debug('  selectedInput.value:', selectedInput.value, '| typeof:', typeof selectedInput.value);
        Logger.debug('  selectedIndex:', selectedIndex, '| typeof:', typeof selectedIndex);
        Logger.debug('  qcmData.correctAnswer:', qcmData.correctAnswer, '| typeof:', typeof qcmData.correctAnswer);
        Logger.debug('  Comparaison (===):', selectedIndex === qcmData.correctAnswer);
        Logger.debug('  Comparaison (==):', selectedIndex == qcmData.correctAnswer);
        Logger.debug('  qcmData complet:', qcmData);
        Logger.debug('  selectedInput Element:', selectedInput);
        
        // 🔴 HYPOTHÈSE 1: window.currentChapitreId est NULL?
        Logger.debug('🔴 HYPOTHÈSE 1 - Variables globales window:');
        Logger.debug('  window.currentChapitreId:', window.currentChapitreId);
        Logger.debug('  window.currentStepId:', window.currentStepId);
        Logger.debug('  window.lastScore (avant affectation):', window.lastScore);
        
        // 🔴 HYPOTHÈSE 2: qcmData.correctAnswer n'existe pas?
        Logger.debug('🔴 HYPOTHÈSE 2 - qcmData:');
        Logger.debug('  qcmData existe?', !!qcmData);
        Logger.debug('  qcmData.correctAnswer existe?', qcmData?.correctAnswer !== undefined);
        Logger.debug('  qcmData.correctAnswer === null?', qcmData?.correctAnswer === null);
        Logger.debug('  qcmData.correctAnswer === undefined?', qcmData?.correctAnswer === undefined);
        
        // 🔴 HYPOTHÈSE 3: Type mismatch string vs number?
        Logger.debug('🔴 HYPOTHÈSE 3 - Type mismatch:');
        Logger.debug('  selectedIndex est NUMBER?', typeof selectedIndex === 'number');
        Logger.debug('  qcmData.correctAnswer est NUMBER?', typeof qcmData?.correctAnswer === 'number');
        Logger.debug('  Si on force les deux en nombres: parseInt(selectedIndex) === parseInt(qcmData.correctAnswer):', parseInt(selectedIndex) === parseInt(qcmData?.correctAnswer));
        
        const isCorrect = selectedIndex === qcmData.correctAnswer;

        const feedback = document.getElementById(`feedback_${qcmId}`);
        
        if (isCorrect) {
            // 🎯 SCORE: Réponse correcte = 100%
            window.lastScore = 100;
            Logger.debug('✅ QCM Correct! Score: 100%');
            
            feedback.innerHTML = `
                <div style="background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 12px; border-radius: 6px;">
                    <strong>✅ Correct!</strong><br/>
                    ${qcmData.explication ? `<p style="margin-top: 8px; font-style: italic;"><strong>💡 Explication:</strong> ${qcmData.explication}</p>` : ''}
                    <button class="btn btn--primary" style="margin-top: 12px; width: 100%;" onclick="App.allerExerciceSuivant()">
                        ➡️ Exercice Suivant
                    </button>
                </div>
            `;
            feedback.style.display = 'block';

            // Marquer comme complétée
            if (window.currentStepId && window.currentChapitreId) {
                const stepProgress = {
                    completed: true,
                    timestamp: new Date().toISOString(),
                    score: 100
                };
                localStorage.setItem(`step_${window.currentStepId}`, JSON.stringify(stepProgress));
                
                this.marquerEtapeComplete(window.currentChapitreId, window.currentStepId);
                const chapitre = CHAPITRES.find(ch => ch.id === window.currentChapitreId);
                const etape = chapitre?.etapes.find(e => e.id === window.currentStepId);
                const maxPoints = etape?.points || 10;
                const result = StorageManager.addPointsToStep(window.currentStepId, maxPoints, maxPoints);
                this.updateHeader();
                Logger.debug(`✅ ${result.message} (${result.totalForStep}/${result.maxPoints} points)`);
            }

            // 🔧 FIX: Activer le bouton "Étape suivante"
            this.activerBoutonEtapeSuivante();

            showSuccessNotification('✅ Excellent!', `Bonne réponse!`, '✅', 1500);
        } else {
            // 🎯 SCORE: Réponse incorrecte = 0%
            window.lastScore = 0;
            Logger.debug('❌ QCM Incorrect! Score: 0%');
            
            feedback.innerHTML = `
                <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 12px; border-radius: 6px;">
                    <strong>❌ Incorrect.</strong><br/>
                    Bonne réponse: <em>${qcmData.options[qcmData.correctAnswer]}</em><br/>
                    ${qcmData.explication ? `<p style="margin-top: 8px; font-style: italic;"><strong>💡 Explication:</strong> ${qcmData.explication}</p>` : ''}
                    <button class="btn btn--secondary" style="margin-top: 12px; width: 100%;" onclick="App.allerExerciceSuivant()">
                        ➡️ Exercice Suivant
                    </button>
                </div>
            `;
            feedback.style.display = 'block';
            selectedInput.checked = false;
        }

        // Nettoyer après validation (optionnel - garder pour rejouer)
        // delete window.QCM_ANSWERS[qcmId];
    },

    /**
     * Valide un QCM (ancienne version - mantenue pour compatibilité)
     */
    /**
     * Valide un exercice Vrai/Faux - Affiche la correction et permet de recommencer
     */
    validerVraisFaux(vrfId, totalItems) {
        let allAnswered = true;
        let correctCount = 0;
        let vrfItems = [];
        
        // Récupérer les données du Vrai/Faux (doit être stockées lors du rendu)
        const vrfData = window.VRF_DATA?.[vrfId];
        
        // Vérifier que toutes les questions sont répondues et compter les bonnes
        for (let i = 0; i < totalItems; i++) {
            const itemId = `${vrfId}_${i}`;
            const selected = document.querySelector(`input[name="${itemId}"]:checked`);
            if (!selected) {
                allAnswered = false;
                break;
            }
            
            const userAnswer = selected.value === 'true';
            const isCorrect = vrfData && vrfData.items[i].answer === userAnswer;
            if (isCorrect) {
                correctCount++;
            }
            
            vrfItems.push({
                statement: vrfData?.items[i].statement,
                userAnswer: userAnswer,
                correctAnswer: vrfData?.items[i].answer,
                isCorrect: isCorrect
            });
        }
        
        if (!allAnswered) {
            showErrorNotification('⚠️ Veuillez répondre à toutes les questions');
            return;
        }
        
        const isAllCorrect = correctCount === totalItems;
        const feedback = document.getElementById(`feedback_${vrfId}`);
        
        // Afficher la correction
        let html = `
            <div style="margin-top: var(--spacing-lg); padding: var(--spacing-md); border-radius: var(--radius-md);">
                <div style="margin-bottom: var(--spacing-md); padding: var(--spacing-md); border-radius: var(--radius-md); ${isAllCorrect ? 'background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724;' : 'background-color: #fff3cd; border: 1px solid #ffc107; color: #856404;'}">
                    <strong>${isAllCorrect ? '✅ Parfait! Toutes les réponses sont correctes!' : `⚠️ ${correctCount}/${totalItems} réponses correctes`}</strong>
                </div>
        `;
        
        // Afficher chaque question avec la correction
        vrfItems.forEach((item, index) => {
            const bgColor = item.isCorrect ? '#e7f5e7' : '#ffe7e7';
            const borderColor = item.isCorrect ? '#28a745' : '#dc3545';
            const icon = item.isCorrect ? '✅' : '❌';
            
            html += `
                <div style="margin-bottom: var(--spacing-md); padding: var(--spacing-md); border: 1px solid ${borderColor}; border-radius: var(--radius-md); background-color: ${bgColor};">
                    <p style="margin: 0 0 var(--spacing-sm) 0; font-weight: 500;">${index + 1}. ${item.statement}</p>
                    <div style="display: flex; gap: var(--spacing-md); margin-top: var(--spacing-sm);">
                        <span style="padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--radius-sm); ${item.userAnswer === true ? 'background: #f0f0f0; font-weight: 500;' : ''}">
                            Votre réponse: <strong>${item.userAnswer ? '✅ Vrai' : '❌ Faux'}</strong>
                        </span>
                        ${item.isCorrect ? '' : `
                            <span style="padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--radius-sm); background: #d4edda;">
                                Bonne réponse: <strong>${item.correctAnswer ? '✅ Vrai' : '❌ Faux'}</strong>
                            </span>
                        `}
                    </div>
                </div>
            `;
        });
        
        // Boutons d'action
        if (isAllCorrect) {
            // Afficher l'explication si présente
            if (vrfData?.explanation) {
                html += `
                    <div style="margin-top: var(--spacing-md); padding: var(--spacing-md); background: #e3f2fd; border-radius: var(--radius-md); border-left: 4px solid #2196f3;">
                        <strong>💡 Explication:</strong> ${vrfData.explanation}
                    </div>
                `;
            }
            html += `
                <button class="btn btn--primary" style="margin-top: var(--spacing-md); width: 100%;" onclick="App.allerExerciceSuivant()">
                    ➡️ Exercice Suivant
                </button>
            `;
        } else {
            // Afficher l'explication même si incorrect pour aider l'apprenant
            if (vrfData?.explanation) {
                html += `
                    <div style="margin-top: var(--spacing-md); padding: var(--spacing-md); background: #fff3cd; border-radius: var(--radius-md); border-left: 4px solid #ffc107;">
                        <strong>💡 Indice:</strong> ${vrfData.explanation}
                    </div>
                `;
            }
            html += `
                <button class="btn btn--secondary" style="margin-top: var(--spacing-md); width: 100%;" onclick="App.recommencerVraisFaux('${vrfId}', ${totalItems})">
                    🔄 Recommencer cet exercice
                </button>
            `;
        }
        
        html += `</div>`;
        
        feedback.innerHTML = html;
        feedback.style.display = 'block';
        
        // Marquer comme complétée SEULEMENT si toutes les réponses sont correctes
        if (isAllCorrect && window.currentStepId && window.currentChapitreId) {
            const stepProgress = {
                completed: true,
                timestamp: new Date().toISOString(),
                score: 100
            };
            localStorage.setItem(`step_${window.currentStepId}`, JSON.stringify(stepProgress));
            this.marquerEtapeComplete(window.currentChapitreId, window.currentStepId);
            const chapitre = CHAPITRES.find(ch => ch.id === window.currentChapitreId);
            const etape = chapitre?.etapes.find(e => e.id === window.currentStepId);
            const maxPoints = etape?.points || 10;
            StorageManager.addPointsToStep(window.currentStepId, maxPoints, maxPoints);
            this.updateHeader();
            
            // 🔧 FIX: Activer le bouton "Étape suivante"
            this.activerBoutonEtapeSuivante();
            
            showSuccessNotification('✅ Excellent!', 'Exercice complété!', '✅', 1500);
        } else if (!isAllCorrect) {
            showSuccessNotification('⚠️ À relire', 'Certaines réponses ne sont pas correctes', '📚', 1500);
        }
    },

    /**
     * Recommence l'exercice Vrai/Faux en réinitialisant les réponses
     */
    recommencerVraisFaux(vrfId, totalItems) {
        // Décocher toutes les réponses
        for (let i = 0; i < totalItems; i++) {
            const itemId = `${vrfId}_${i}`;
            const inputs = document.querySelectorAll(`input[name="${itemId}"]`);
            inputs.forEach(input => input.checked = false);
        }
        
        // Masquer le feedback
        const feedback = document.getElementById(`feedback_${vrfId}`);
        feedback.innerHTML = '';
        feedback.style.display = 'none';
        
        // Scroll vers le haut de l'exercice
        document.querySelector('.etape-modal')?.scrollIntoView({ behavior: 'smooth' });
        
        showSuccessNotification('🔄 Exercice réinitialisé', 'Recommencez à votre rythme', '🎯', 1000);
    },

    /**
     * Valide un exercice Drag-Drop - Vérifie l'ordre final
     */
    validerDragDrop(dragId) {
        const feedback = document.getElementById(`feedback_${dragId}`);
        const container = document.getElementById(dragId);
        const dragData = window.DRAG_DATA?.[dragId];
        
        if (!dragData || !container) {
            feedback.innerHTML = '<p style="color: var(--color-error);">❌ Erreur: données manquantes</p>';
            feedback.style.display = 'block';
            return;
        }
        
        // ✅ Récupérer l'ordre ACTUEL du DOM
        const itemsContainer = container.querySelector('.drag-items');
        const items = itemsContainer.querySelectorAll('.drag-item');
        
        let isAllCorrect = true;
        const results = [];
        
        // Vérifier chaque item
        items.forEach((itemEl, currentPos) => {
            const correctPos = parseInt(itemEl.getAttribute('data-correct-position'));
            const itemIsCorrect = currentPos === correctPos;
            isAllCorrect = isAllCorrect && itemIsCorrect;
            
            const itemLabel = itemEl.querySelector('span')?.textContent || itemEl.textContent;
            
            results.push({
                label: itemLabel,
                expected: correctPos + 1,
                actual: currentPos + 1,
                isCorrect: itemIsCorrect
            });
            
            // ✅ Appliquer le style de feedback visuel
            if (itemIsCorrect) {
                itemEl.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
                itemEl.style.borderLeft = '4px solid #22c55e';
            } else {
                itemEl.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                itemEl.style.borderLeft = '4px solid #ef4444';
            }
        });
        
        // Afficher la correction détaillée
        let html = `
            <div style="margin-top: var(--spacing-lg); padding: var(--spacing-md); border-radius: var(--radius-md);">
                <div style="margin-bottom: var(--spacing-md); padding: var(--spacing-md); border-radius: var(--radius-md); ${isAllCorrect ? 'background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724;' : 'background-color: #fff3cd; border: 1px solid #ffc107; color: #856404;'}">
                    <strong>${isAllCorrect ? '✅ Parfait! L\'ordre est correct!' : '⚠️ L\'ordre n\'est pas correct'}</strong>
                </div>
        `;
        
        // Afficher le résultat pour chaque item
        results.forEach((result) => {
            const bgColor = result.isCorrect ? '#e7f5e7' : '#ffe7e7';
            const borderColor = result.isCorrect ? '#28a745' : '#dc3545';
            const icon = result.isCorrect ? '✅' : '❌';
            
            html += `
                <div style="margin-bottom: var(--spacing-md); padding: var(--spacing-md); border: 1px solid ${borderColor}; border-radius: var(--radius-md); background-color: ${bgColor};">
                    <p style="margin: 0 0 var(--spacing-sm) 0; font-weight: 500;">${icon} ${result.label}</p>
                    <div style="font-size: 0.9em; color: var(--color-text-light);">
                        Position: <strong>${result.actual}</strong> ${result.isCorrect ? '' : `(attendue: <strong>${result.expected}</strong>)`}
                    </div>
                </div>
            `;
        });
        
        // Boutons d'action
        if (isAllCorrect) {
            html += `
                <button class="btn btn--primary" style="margin-top: var(--spacing-md); width: 100%;" onclick="App.allerExerciceSuivant()">
                    ➡️ Exercice Suivant
                </button>
            `;
        } else {
            html += `
                <button class="btn btn--secondary" style="margin-top: var(--spacing-md); width: 100%;" onclick="App.recommencerDragDrop('${dragId}')">
                    🔄 Recommencer l'exercice
                </button>
            `;
        }
        
        html += `</div>`;
        
        feedback.innerHTML = html;
        feedback.style.display = 'block';
        
        // ✅ Marquer comme complétée SEULEMENT si l'ordre est correct
        if (isAllCorrect && window.currentStepId && window.currentChapitreId) {
            const stepProgress = {
                completed: true,
                timestamp: new Date().toISOString(),
                score: 100
            };
            localStorage.setItem(`step_${window.currentStepId}`, JSON.stringify(stepProgress));
            this.marquerEtapeComplete(window.currentChapitreId, window.currentStepId);
            const chapitre = CHAPITRES.find(ch => ch.id === window.currentChapitreId);
            const etape = chapitre?.etapes.find(e => e.id === window.currentStepId);
            const maxPoints = etape?.points || 10;
            StorageManager.addPointsToStep(window.currentStepId, maxPoints, maxPoints);
            this.updateHeader();
            
            // 🔧 FIX: Activer le bouton "Étape suivante"
            this.activerBoutonEtapeSuivante();
            
            showSuccessNotification('✅ Excellent!', 'Drag-Drop complété!', '✅', 1500);
        } else if (!isAllCorrect) {
            showSuccessNotification('⚠️ À relire', 'L\'ordre n\'est pas correct', '📚', 1500);
        }
    },

    /**
     * Recommence l'exercice Drag-Drop
     */
    recommencerDragDrop(dragId) {
        const dragData = window.DRAG_DATA?.[dragId];
        if (!dragData) return;
        
        const container = document.getElementById(dragId);
        if (!container) return;
        
        const itemsContainer = container.querySelector('.drag-items');
        if (!itemsContainer) return;
        
        const items = itemsContainer.querySelectorAll('.drag-item');
        
        // ✅ Restaurer l'ordre initial (basé sur correctPosition)
        const itemsByCorrectPos = new Map();
        items.forEach(item => {
            const correctPos = parseInt(item.getAttribute('data-correct-position'));
            itemsByCorrectPos.set(correctPos, item);
        });
        
        // Réorganiser dans le bon ordre initial
        for (let pos = 0; pos < itemsByCorrectPos.size; pos++) {
            const item = itemsByCorrectPos.get(pos);
            if (item) {
                itemsContainer.appendChild(item);
                item.setAttribute('data-current-position', pos);
            }
        }
        
        // Réinitialiser les styles
        items.forEach(item => {
            item.style.backgroundColor = '';
            item.style.borderLeft = '';
        });
        
        // Masquer le feedback
        const feedback = document.getElementById(`feedback_${dragId}`);
        feedback.innerHTML = '';
        feedback.style.display = 'none';
        
        showSuccessNotification('🔄 Exercice réinitialisé', 'Recommencez à votre rythme', '🎯', 1000);
    },

    /**
     * Valide un exercice Likert Scale
     */
    validerLikert(likertId) {
        const feedback = document.getElementById(`feedback_${likertId}`);
        const etapeId = window.currentStepId;
        const chapitreId = window.currentChapitreId;
        
        feedback.innerHTML = `
            <div style="background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 12px; border-radius: 6px;">
                <strong>✅ Merci pour votre auto-évaluation!</strong><br/>
                <button class="btn btn--primary" style="margin-top: 12px; width: 100%;" onclick="App.allerExerciceSuivant()">
                    ➡️ Exercice Suivant
                </button>
            </div>
        `;
        feedback.style.display = 'block';
        
        if (window.currentStepId && window.currentChapitreId) {
            const stepProgress = {
                completed: true,
                timestamp: new Date().toISOString(),
                score: 100
            };
            localStorage.setItem(`step_${window.currentStepId}`, JSON.stringify(stepProgress));
            this.marquerEtapeComplete(window.currentChapitreId, window.currentStepId);
            const chapitre = CHAPITRES.find(ch => ch.id === window.currentChapitreId);
            const etape = chapitre?.etapes.find(e => e.id === window.currentStepId);
            const maxPoints = etape?.points || 10;
            StorageManager.addPointsToStep(window.currentStepId, maxPoints, maxPoints);
            this.updateHeader();
            
            // 🔧 FIX: Activer le bouton "Étape suivante"
            this.activerBoutonEtapeSuivante();
        }
        
        showSuccessNotification('✅ Merci!', 'Auto-évaluation enregistrée!', '✅', 1500);
    },

    /**
     * Valide un quiz et affiche les résultats (NE complète PAS l'étape)
     */
    validerQuiz(exerciceId = null) {
        // Déterminer quel feedback utiliser
        const feedbackId = exerciceId ? `quiz-feedback-${exerciceId}` : 'quiz-feedback';
        
        // Trouver toutes les questions avec leurs réponses
        const allInputs = document.querySelectorAll('input[data-correct]');
        let totalQuestions = 0;
        let correctAnswers = 0;
        
        // Compter les questions et les réponses correctes
        const processedQuestions = new Set();
        allInputs.forEach(input => {
            const questionName = input.name;
            if (!processedQuestions.has(questionName)) {
                processedQuestions.add(questionName);
                totalQuestions++;
                
                const selectedInput = document.querySelector(`input[name="${questionName}"]:checked`);
                if (selectedInput && selectedInput.dataset.correct === 'true') {
                    correctAnswers++;
                }
            }
        });
        
        // Calculer le pourcentage
        const percentage = Math.round((correctAnswers / totalQuestions) * 100);
        
        // Afficher les réponses correctes
        const feedback = document.getElementById(feedbackId);
        let feedbackHtml = `
            <div style="background: ${correctAnswers === totalQuestions ? '#d4edda' : '#fff3cd'}; border: 1px solid ${correctAnswers === totalQuestions ? '#c3e6cb' : '#ffeaa7'}; padding: var(--spacing-md); border-radius: var(--radius-md);">
                <h4 style="margin-top: 0; color: ${correctAnswers === totalQuestions ? '#155724' : '#856404'};">
                    ${correctAnswers === totalQuestions ? '✅ Excellent!' : '⚠️ Résultats'}
                </h4>
                <p style="margin: var(--spacing-sm) 0; color: ${correctAnswers === totalQuestions ? '#155724' : '#856404'};">
                    Vous avez réussi <strong>${correctAnswers}/${totalQuestions}</strong> questions (${percentage}%)
                </p>
        `;
        
        // Afficher les réponses correctes pour chaque question
        const questionGroups = new Map();
        allInputs.forEach(input => {
            const questionName = input.name;
            if (!questionGroups.has(questionName)) {
                const label = input.closest('label');
                const question = label ? label.closest('div').previousElementSibling.textContent : 'Question';
                questionGroups.set(questionName, { question, inputs: [] });
            }
            questionGroups.get(questionName).inputs.push(input);
        });
        
        // Afficher les résultats détaillés
        feedbackHtml += `<div style="margin-top: var(--spacing-md); border-top: 1px solid rgba(0,0,0,0.1); padding-top: var(--spacing-md);">`;
        questionGroups.forEach(({ question, inputs }) => {
            const correctInput = inputs.find(i => i.dataset.correct === 'true');
            const selectedInput = inputs.find(i => i.checked);
            
            feedbackHtml += `
                <div style="margin-bottom: var(--spacing-md); padding: var(--spacing-sm); background: white; border-radius: var(--radius-sm);">
                    <p style="margin: 0; font-weight: bold; color: #333;">${question}</p>
                    <p style="margin: var(--spacing-xs) 0; color: #666;">
                        <strong>Bonne réponse:</strong> ${correctInput.closest('label').textContent.trim()}
                    </p>
                    ${selectedInput ? `<p style="margin: var(--spacing-xs) 0; color: ${selectedInput.dataset.correct === 'true' ? '#28a745' : '#dc3545'};">
                        <strong>Votre réponse:</strong> ${selectedInput.closest('label').textContent.trim()}
                    </p>` : ''}
                </div>
            `;
        });
        
        feedbackHtml += `</div>`;
        
        // 🔷 Ajouter le bouton "Marquer comme terminé" ou message d'erreur
        if (correctAnswers >= Math.ceil(totalQuestions / 2)) {
            // Quiz réussi
            feedbackHtml += `
                <div style="margin-top: var(--spacing-md); padding-top: var(--spacing-md); border-top: 1px solid rgba(0,0,0,0.1); text-align: center;">
                    <button class="btn btn--primary" style="width: 100%; background-color: #28a745;" onclick="App.completerQuizEtape(${correctAnswers}, ${totalQuestions})">
                        ✅ Marquer comme terminé
                    </button>
                </div>
            `;
        } else {
            // Quiz échoué - afficher message d'erreur
            feedbackHtml += `
                <div style="margin-top: var(--spacing-md); padding: var(--spacing-md); background: #f8d7da; border: 1px solid #f5c6cb; border-radius: var(--radius-md); color: #721c24;">
                    <strong>⚠️ Résultat insuffisant</strong><br/>
                    Vous avez besoin d'au moins 50% pour passer ce quiz.<br/>
                    Veuillez réessayer.
                </div>
            `;
        }
        
        feedbackHtml += `</div>`;
        
        feedback.innerHTML = feedbackHtml;
        feedback.style.display = 'block';
        
        // Masquer le bouton "Soumettre réponses" et désactiver les inputs
        const submitBtn = document.getElementById('btn-validate');
        if (submitBtn) {
            submitBtn.style.display = 'none';
        }
        allInputs.forEach(input => input.disabled = true);
        
        Logger.debug(`📋 Quiz soumis: ${correctAnswers}/${totalQuestions} (${percentage}%)`);
    },

    /**
     * Complète le quiz et déverrouille l'étape suivante
     * @param {number} correctAnswers - Nombre de réponses correctes
     * @param {number} totalQuestions - Nombre total de questions
     */
    completerQuizEtape(correctAnswers, totalQuestions) {
        Logger.debug(`🎯 Complétude du quiz: ${correctAnswers}/${totalQuestions}`);
        
        if (!window.currentStepId || !window.currentChapitreId) {
            Logger.error('❌ Contexte étape non disponible');
            return;
        }
        
        const chapitre = CHAPITRES.find(ch => ch.id === window.currentChapitreId);
        const etapeIndex = chapitre?.etapes.findIndex(e => e.id === window.currentStepId);
        const etape = chapitre?.etapes[etapeIndex];
        
        if (!etape) {
            Logger.error(`❌ Étape non trouvée: ${window.currentChapitreId} / ${window.currentStepId}`);
            return;
        }
        
        // Marquer comme complétée
        const percentage = Math.round((correctAnswers / totalQuestions) * 100);
        const maxPoints = etape.points || 20;
        const pointsEarned = Math.round((percentage / 100) * maxPoints);
        
        // 🔷 Utiliser markStepAttempted pour enregistrer et dérouiller automatiquement
        this.markStepAttempted(window.currentChapitreId, etapeIndex, percentage);
        
        // Calculer et ajouter les points
        const result = StorageManager.addPointsToStep(window.currentStepId, pointsEarned, maxPoints);
        this.updateHeader();
        
        Logger.debug(`✅ Quiz complété: ${percentage}% → ${pointsEarned}/${maxPoints} points`);
        Logger.debug(`✅ ${result.message}`);
        
        // Animation de succès puis retour au chapitre
        showSuccessNotification('🎊 Quiz terminé!', `${percentage}% (${correctAnswers}/${totalQuestions} bonnes réponses)`, '🎊', 2000);
        
        setTimeout(() => {
            // Fermer la modal exercice
            const exerciseModal = document.getElementById('exercise-modal');
            if (exerciseModal) exerciseModal.remove();
            
            // Retourner au chapitre
            this.afficherChapitre(window.currentChapitreId);
        }, 2100);
    },

    /**
     * Ferme le modal
     */
    fermerModal() {
        document.getElementById('etape-modal').classList.remove('active');
        document.getElementById('etape-detail').innerHTML = '';
        // 👁️ Réafficher la barre de navigation
        this.showBottomNav();
    },

    /**
     * Affiche le modal portfolio swipe en fin de chapitre
     * @param {string} chapitreId - ID du chapitre complété
     */
    afficherPortfolioModal(chapitreId) {
        const chapitre = CHAPITRES.find(ch => ch.id === chapitreId);
        if (!chapitre) return;

        // ✅ INITIALISER LE PORTFOLIO SWIPE AVEC LE CHAPITRE
        if (typeof PortfolioSwipe !== 'undefined') {
            PortfolioSwipe.init(chapitreId);
        }

        this.chapitreEnCours = chapitreId;
        this.chapitreActuel = chapitreId;
        
        // 🙈 Cacher la barre de navigation
        this.hideBottomNav();
        
        const modal = document.getElementById('portfolio-modal');
        modal.classList.remove('hidden');
        
        // Styliser l'overlay (fond semi-transparent)
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            display: block;
            z-index: 1000;
            margin: 0;
            padding: 0;
        `;
        
        Logger.debug('🎯 Portfolio modal affiché pour', chapitreId);
    },

    /**
     * Ferme le modal portfolio SANS valider (bouton Fermer)
     */
    fermerPortfolioModalSansValider() {
        document.getElementById('portfolio-modal').classList.add('hidden');
        
        // 👁️ Réafficher la barre de navigation
        this.showBottomNav();
        
        Logger.debug('✕ Portfolio modal fermé (sans validation)');
        
        // Rafraîchir l'affichage du chapitre
        const chapitreId = this.chapitreActuel || this.chapitreEnCours;
        if (chapitreId) {
            setTimeout(() => {
                this.afficherChapitre(chapitreId);
            }, 50);
        }
    },

    /**
     * Ferme le modal portfolio (utilisé par le bouton ✕)
     */
    fermerPortfolioModal() {
        document.getElementById('portfolio-modal').classList.add('hidden');
        
        // 👁️ Réafficher la barre de navigation
        this.showBottomNav();
        
        // ✅ Rafraîchir l'affichage du chapitre pour montrer le portfolio comme complété
        const chapitreId = this.chapitreActuel || this.chapitreEnCours;
        if (chapitreId) {
            setTimeout(() => {
                this.afficherChapitre(chapitreId);
                Logger.debug(`✅ Affichage du chapitre ${chapitreId} rafraîchi après fermeture portfolio`);
            }, 100);
        }
    },
    
    /**
     * Valide le portfolio et ferme le modal (bouton "Marquer comme terminé")
     * ✅ Sauvegarde le portfolio comme complété dans localStorage
     */
    validerPortfolioEtFermer() {
        const chapitreId = this.chapitreActuel || this.chapitreEnCours;
        const chapitre = CHAPITRES.find(ch => ch.id === chapitreId);
        
        if (chapitre) {
            // ✅ Sauvegarder le portfolio comme complété
            const portfolioKey = `portfolio_${chapitreId}`;
            const data = {
                completed: true,
                completedAt: new Date().toISOString()
            };
            localStorage.setItem(portfolioKey, JSON.stringify(data));
            
            // Marquer en mémoire
            chapitre.portfolioCompleted = true;
            
            Logger.debug(`✅ Portfolio ${chapitreId} marqué comme complété`);
        }
        
        document.getElementById('portfolio-modal').classList.add('hidden');
        
        // 👁️ Réafficher la barre de navigation
        this.showBottomNav();
        
        Logger.debug('✕ Portfolio modal fermé (avec validation)');
        
        // ✅ Rafraîchir l'affichage du chapitre
        if (chapitreId) {
            setTimeout(() => {
                this.afficherChapitre(chapitreId);
                Logger.debug(`✅ Affichage du chapitre ${chapitreId} rafraîchi après validation portfolio`);
            }, 50);
        }
    },

    /**
     * Valide le plan de révision et déverrouille le badge
     */
    validerPlanRevision() {
        const planData = PortfolioSwipe.getPlanData();
        
        if (!planData || planData.length === 0) {
            showErrorNotification('⚠️ Plan de révision vide', 'Veuillez ajouter au moins un point de révision');
            return;
        }

        // Sauvegarder le plan dans localStorage
        const plans = JSON.parse(localStorage.getItem('plans') || '{}');
        plans[this.chapitreEnCours] = {
            chapitreId: this.chapitreEnCours,
            data: planData,
            dateCreation: new Date().toISOString()
        };
        localStorage.setItem('plans', JSON.stringify(plans));

        // Déverrouiller le badge
        this.deverrouillerBadge(this.chapitreEnCours);
        
        // Feedback utilisateur
        showSuccessNotification('🎉 Bravo!', 'Votre plan de révision a été sauvegardé!', '📝');
        
        this.fermerPortfolioModal();
        
        // Rafraîchir le tableau de bord après un délai
        setTimeout(() => {
            if (this.currentPage === 'accueil') {
                this.loadPage('accueil');
            }
        }, 1500);
    },

    /**
     * Affiche le modal avec les objectifs du chapitre (PLEIN ÉCRAN)
     * @param {string} chapitreId - ID du chapitre
     */
    afficherModalObjectives(chapitreId) {
        const chapitre = CHAPITRES.find(ch => ch.id === chapitreId);
        if (!chapitre) return;

        const objectivesList = document.getElementById('objectives-list');
        const icons = ['🎯', '📚', '🔍', '💡', '📝', '🧠'];
        
        objectivesList.innerHTML = chapitre.objectifs
            .map((obj, index) => `
                <div class="objective-item" style="display: flex; align-items: flex-start; gap: 15px; padding: 15px; background: #f9f9f9; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid #4A3F87;">
                    <span class="objective-icon" style="font-size: 1.5em;">${icons[index % icons.length]}</span>
                    <p class="objective-text" style="margin: 0; font-size: 1em; line-height: 1.6; color: #333;">${obj}</p>
                </div>
            `)
            .join('');

        // Stocker le chapitre actuel en session
        this.chapitreActuel = chapitreId;
        
        // 🙈 Cacher la barre de navigation
        this.hideBottomNav();
        
        const modal = document.getElementById('objectives-modal');
        modal.classList.remove('hidden');
        
        // Styliser l'overlay (fond semi-transparent)
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            display: block;
            z-index: 1000;
            margin: 0;
            padding: 0;
        `;

        // Support fermeture: Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.fermerModalObjectivesSansValider();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);

        Logger.debug('📋 Modal objectifs affichés pour:', chapitre.titre);
    },
    
    /**
     * Ferme le modal objectifs SANS valider (bouton Fermer)
     */
    fermerModalObjectivesSansValider() {
        const modal = document.getElementById('objectives-modal');
        modal.classList.add('hidden');
        
        // 👁️ Réafficher la barre de navigation
        this.showBottomNav();
        
        Logger.debug('✕ Modal objectifs fermé (sans validation)');
        
        // Rafraîchir l'affichage du chapitre
        const chapitreId = this.chapitreActuel;
        if (chapitreId) {
            setTimeout(() => {
                this.afficherChapitre(chapitreId);
            }, 50);
        }
    },

    /**
     * Ferme le modal objectifs et marque comme complétés
     * ✅ Rafraîchit l'affichage du chapitre pour débloquer l'étape 1
     * ✅ Solution A: localStorage sync via StorageManager.saveObjectifsStatus()
     */
    fermerModalObjectives() {
        const chapitreId = this.chapitreActuel;
        const chapitre = CHAPITRES.find(ch => ch.id === chapitreId);
        
        if (chapitre) {
            // ✅ Marquer les objectifs comme complétés via StorageManager
            // (saveObjectifsStatus() maintenant synce avec localStorage)
            if (window.StorageManager?.saveObjectifsStatus) {
                StorageManager.saveObjectifsStatus(chapitreId, true);
                Logger.debug(`✅ Objectifs marqués comme complétés (localStorage + StorageManager)`);
            }
            
            // Marquer aussi en mémoire pour éviter appels multiples
            chapitre.objectifsCompleted = true;
        }
        
        const modal = document.getElementById('objectives-modal');
        modal.classList.add('hidden');
        
        // 👁️ Réafficher la barre de navigation
        this.showBottomNav();
        
        Logger.debug('✕ Modal objectifs fermé (avec validation)');
        
        // ✅ Rafraîchir l'affichage du chapitre pour montrer les objectifs comme complétés
        // et débloquer l'étape 1 + mettre à jour les icônes visuellement
        if (chapitreId) {
            setTimeout(() => {
                this.afficherChapitre(chapitreId);
                Logger.debug(`✅ Affichage du chapitre ${chapitreId} rafraîchi après objectifs`);
            }, 50);
        }
    },

    /**
     * Affiche le modal de création de profil au premier démarrage
     */
    showProfileCreationModal() {
        const modal = document.getElementById('profile-creation-modal');
        if (modal) {
            modal.classList.remove('hidden');
            Logger.debug('👤 Modal création profil affichée');
        }
    },

    /**
     * Ferme le modal de création de profil
     */
    closeProfileCreationModal() {
        const modal = document.getElementById('profile-creation-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    /**
     * Sauvegarde le profil utilisateur depuis le formulaire
     */
    saveProfile() {
        const nom = document.getElementById('profile-nom').value.trim();
        const prenom = document.getElementById('profile-prenom').value.trim();
        const matricule = document.getElementById('profile-matricule').value.trim();

        // Validation
        if (!nom || !prenom || !matricule) {
            Logger.warn('⚠️ Veuillez remplir tous les champs obligatoires');
            return;
        }

        // Sauvegarder dans StorageManager
        StorageManager.updateUser({
            nom: nom,
            prenom: prenom,
            matricule: matricule,
            profileCreated: true
        });

        Logger.debug(`👤 Profil créé: ${prenom} ${nom} (${matricule})`);

        // Fermer le modal
        this.closeProfileCreationModal();

        // Afficher notification de succès
        showSuccessNotification('✅ Profil créé!', `Bienvenue ${prenom} ${nom}!`, '🎉', 1500);

        // Initialiser l'app normalement après un court délai
        setTimeout(() => {
            this.init();
        }, 500);
    },

    /**
     * Lance le chapitre après visualisation des objectifs
     * ✅ FIX OPTION B: Les objectifs sont un jalon VISUEL, pas etapes[0]
     */
    commencerChapitre() {
        const chapitre = CHAPITRES.find(ch => ch.id === this.chapitreActuel);
        if (chapitre) {
            // ✅ FIX: Marquer les objectifs VISUELS comme complétés (pas etapes[0]!)
            chapitre.objectifsCompleted = true;
            
            // Mettre à jour localStorage via StorageManager (nouveau storage pour jalons visuels)
            if (window.StorageManager?.saveObjectifsStatus) {
                StorageManager.saveObjectifsStatus(this.chapitreActuel, true);
                Logger.debug(`✅ Objectifs visuels marqués comme complétés`);
            }
            
            // Mettre à jour les icônes visuelles
            setTimeout(() => {
                updateStepIcons(this.chapitreActuel, chapitre);
                Logger.debug(`✅ Icônes des étapes mises à jour après objectifs`);
            }, 100);
        }
        
        // ✅ SUPPRIMER L'APPEL AU MODAL - LES OBJECTIFS SONT MAINTENANT UN JALON DANS LE CHEMIN
        // this.fermerModalObjectives();
        this.afficherChapitreContenu(this.chapitreActuel);
    },

    /**
     * Affiche le contenu du chapitre (chemin SVG)
     * @param {string} chapitreId - ID du chapitre
     */
    afficherChapitreContenu(chapitreId) {
        // 🌉 BRIDGE: Chercher le chapitre dans TOUS les niveaux
        const chapitre = this.findChapitreById(chapitreId);
        if (!chapitre) {
            Logger.error(`❌ Chapitre ${chapitreId} non trouvé`);
            return;
        }
        
        // � FIX: Initialiser le flag portfolioCompleted si pas exists
        if (chapitre.portfolioCompleted === undefined) {
            const portfolioStatus = StorageManager.getPortfolioStatus(chapitreId);
            chapitre.portfolioCompleted = portfolioStatus?.completed || false;
        }
        
        // FIX #1: CHARGER les états des étapes depuis StorageManager
        // CRITIQUE: Sans cela, après reload la page, les étapes réapparaissent comme incomplètes
        this.loadChapitreEtapesStates(chapitreId);
        
        // Recalculer la progression au moment de l'affichage
        const progress = this.calculateChapterProgress(chapitreId);
        chapitre.progression = progress;
        Logger.debug(`📊 Affichage du chapitre ${chapitreId}: ${progress}% complété`);

        
        // ✅ PASSER LE CHAPITRE À generatePathSVG POUR AJOUTER LES OBJECTIFS
        const svg = generatePathSVG(chapitre.etapes, chapitre);
        
        let html = `
            <div class="page active">
                <div class="container">
                    <button class="btn-back" onclick="App.loadPage('chapitres')">← Retour aux chapitres</button>
                    <div class="chapitre-card">
                    <div class="chapitre-header" style="background-color: ${chapitre.couleur}; color: white;">
                        <h2>${chapitre.emoji} ${chapitre.titre}</h2>
                        <p>${chapitre.description}</p>
                </div>
                
                <div class="chapitre-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${chapitre.progression}%; background-color: ${chapitre.couleur};"></div>
                    </div>
                    <span class="progress-text">${chapitre.progression}% complété</span>
                </div>
                
                <div class="chapitre-path">
                    ${svg}
                </div>
                
                <div class="chapitre-stats">
                    <div class="stat-item">
                        <span class="stat-number">${chapitre.etapes.length}</span>
                        <span class="stat-label">Étapes</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${chapitre.etapes.reduce((sum, e) => sum + e.points, 0)}</span>
                        <span class="stat-label">Points possibles</span>
                    </div>
                    </div>
                </div>
                </div>
            </div>
        `;
        
        // Injecter dans #app-content, pas dans #chapitre-detail
        document.getElementById('app-content').innerHTML = html;
        
        // ✅ INITIALISER LES ÉTATS DE VERROUS VISUELS
        updateStepIcons(chapitreId, chapitre);
        
        // ✅ GÉRER LES CLICS SUR LES ÉTAPES, OBJECTIFS ET PORTFOLIO (AVEC SYSTÈME DE VERROUS)
        document.querySelectorAll('.step-group').forEach((el, index) => {
            const isObjectives = el.dataset.isObjectives === 'true';
            const isPortfolio = el.dataset.isPortfolio === 'true';
            const isMidpoint = el.dataset.isMidpoint === 'true';
            
            el.addEventListener('click', () => {
                const stepId = el.dataset.stepId;
                
                // Si c'est les objectifs
                if (isObjectives) {
                    App.afficherModalObjectives(chapitreId);
                    return;
                }
                
                // Si c'est le portfolio
                if (isPortfolio) {
                    // Vérifier que toutes les étapes normales sont complétées
                    const toutesEtapesCompletes = chapitre.etapes.every(e => e.completed === true);
                    if (!toutesEtapesCompletes) {
                        showErrorNotification('⛔ Vous devez compléter toutes les étapes avant d\'accéder au portfolio!');
                        return;
                    }
                    App.afficherPortfolioModal(chapitreId);
                    return;
                }
                
                // Si c'est une étape normale, vérifier le verrouillage
                // Compter les étapes non-portfolio/non-objectives avant cet index
                const allStepGroups = Array.from(document.querySelectorAll('.step-group'));
                let etapeIndex = 0;
                for (let i = 0; i < index; i++) {
                    const prevEl = allStepGroups[i];
                    const prevIsObj = prevEl.dataset.isObjectives === 'true';
                    const prevIsPort = prevEl.dataset.isPortfolio === 'true';
                    if (!prevIsObj && !prevIsPort) {
                        etapeIndex++;
                    }
                }
                
                // ✅ UTILISER getStepLockState POUR VÉRIFIER L'ÉTAT
                const etat = getStepLockState(chapitre, etapeIndex, chapitreId);
                
                if (etat === 'locked') {
                    // Ajouter une animation visuelle au cadenas
                    const lockEmoji = el.querySelector('.step-emoji');
                    if (lockEmoji) {
                        lockEmoji.style.animation = 'shake 0.5s ease-in-out';
                        setTimeout(() => {
                            lockEmoji.style.animation = '';
                        }, 500);
                    }
                    showErrorNotification('🔒 Cette étape est verrouillée. Complétez l\'étape précédente d\'abord!');
                    return;
                }
                
                // ✅ L'étape est déverrouillée ou déjà complétée, on l'affiche
                App.afficherEtape(chapitreId, etapeIndex);
            });
            
            // ✅ APPLIQUER LE STYLE DE CURSEUR SELON L'ÉTAT DE VERROU
            if (!isObjectives && !isPortfolio) {
                // Compter les étapes avant cet index
                const allStepGroups = Array.from(document.querySelectorAll('.step-group'));
                let etapeIndex = 0;
                for (let i = 0; i < index; i++) {
                    const prevEl = allStepGroups[i];
                    const prevIsObj = prevEl.dataset.isObjectives === 'true';
                    const prevIsPort = prevEl.dataset.isPortfolio === 'true';
                    if (!prevIsObj && !prevIsPort) {
                        etapeIndex++;
                    }
                }
                
                const etat = getStepLockState(chapitre, etapeIndex, chapitreId);
                
                if (etat === 'locked') {
                    el.style.cursor = 'not-allowed';
                    el.style.opacity = '0.6';
                    el.style.filter = 'grayscale(1)';
                } else {
                    el.style.cursor = 'pointer';
                    el.style.opacity = '1';
                    el.style.filter = 'grayscale(0)';
                }
            } else {
                el.style.cursor = 'pointer';
                el.style.opacity = '1';
                el.style.filter = 'grayscale(0)';
            }
        });
        
        // ✅ CHARGER LES VIDÉOS DU CHAPITRE
        setTimeout(() => {
            loadChapterVideos(chapitreId);
        }, 100);
    },

    /**
     * Affiche une étape spécifique d'un chapitre avec navigation
     * @param {string} chapitreId - ID du chapitre
     * @param {number} index - Index de l'étape (0-based)
     */
    /**
     * Affiche les exercices d'une étape
     */
    afficherExercicesEtape() {
        // Cette fonction est dépréciée - utiliser remplirExercicesEtape() à la place
    },

    // ═══════════════════════════════════════════════════════════
    // MÉTHODES DE RENDU DES PAGES
    // ═══════════════════════════════════════════════════════════
    
    renderAccueil() {
        // Affichage des 4 niveaux (N1, N2, N3, N4)
        const niveaux = [
            { 
                id: 'N1', 
                titre: 'Niveau 1: Les Fondamentaux', 
                description: 'Découvrez les bases de la douane et du dédouanement. Concepts essentiels pour votre formation.' 
            },
            { 
                id: 'N2', 
                titre: 'Niveau 2: Procédures Avancées', 
                description: 'Maîtrisez les procédures douanières avancées. Prérequis: Niveau 1 complété.' 
            },
            { 
                id: 'N3', 
                titre: 'Niveau 3: Cas Complexes', 
                description: 'Résolvez des cas complexes et des situations réelles. Prérequis: Niveau 2 complété.' 
            },
            { 
                id: 'N4', 
                titre: 'Niveau 4: Certification', 
                description: 'Test final et certification. Prérequis: Niveau 3 complété.' 
            }
        ];

        let html = `
            <div class="page active">
                <!-- HEADER ACCUEIL -->
                <div class="accueil-header" style="margin-bottom: 40px;">
                    <div class="accueil-welcome">
                        <h1>Bienvenue sur la plateforme!</h1>
                        <p class="accueil-subtitle">Formation continue Douane - Et si on jouait? 🎓</p>
                    </div>
                </div>

                <!-- GRILLE DES NIVEAUX -->
                <div class="accueil-content">
                    <h2 style="margin-bottom: 30px;">Parcours de Formation</h2>
                    <div class="niveaux-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; margin-bottom: 40px;">
        `;

        niveaux.forEach((niveau, index) => {
            const isUnlocked = App.isNiveauUnlocked(niveau.id);
            const completion = App.calculateNiveauCompletion(niveau.id);
            const circumference = 2 * Math.PI * 45; // radius = 45
            const strokeDashoffset = circumference - (completion / 100) * circumference;

            const opacityClass = isUnlocked ? 'opacity-100' : 'opacity-60';
            const cursorStyle = isUnlocked ? 'cursor: pointer;' : 'cursor: not-allowed;';
            const buttonDisabled = isUnlocked ? '' : 'disabled';
            const buttonClass = isUnlocked ? 'btn--primary' : 'btn--secondary';

            html += `
                <div class="niveau-card" style="
                    background: white;
                    border-radius: 12px;
                    padding: 25px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    transition: all 0.3s ease;
                    ${cursorStyle}
                    opacity: ${isUnlocked ? '1' : '0.6'};
                    ${isUnlocked ? 'border-top: 4px solid #667eea;' : 'border-top: 4px solid #ccc;'}
                ">
                    <!-- Titre et description -->
                    <div style="margin-bottom: 20px;">
                        <h3 style="margin: 0 0 8px 0; color: #333; font-size: 18px;">${niveau.titre}</h3>
                        <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.5;">${niveau.description}</p>
                    </div>

                    <!-- Progress Ring SVG -->
                    <div style="display: flex; justify-content: center; margin: 25px 0;">
                        <svg width="120" height="120" style="transform: rotate(-90deg);">
                            <!-- Cercle de fond -->
                            <circle cx="60" cy="60" r="45" fill="none" stroke="#e0e0e0" stroke-width="8"/>
                            <!-- Cercle de progression -->
                            <circle 
                                cx="60" cy="60" r="45" 
                                fill="none" 
                                stroke="${isUnlocked ? '#667eea' : '#999'}" 
                                stroke-width="8"
                                stroke-dasharray="${circumference}"
                                stroke-dashoffset="${strokeDashoffset}"
                                stroke-linecap="round"
                                style="transition: stroke-dashoffset 0.5s ease;"
                            />
                        </svg>
                        <div style="position: absolute; display: flex; align-items: center; justify-content: center; width: 120px; height: 120px;">
                            <span style="font-size: 24px; font-weight: bold; color: ${isUnlocked ? '#667eea' : '#999'};">${completion}%</span>
                        </div>
                    </div>

                    <!-- Stats -->
                    <div style="text-align: center; margin-bottom: 20px; padding: 10px 0; border-top: 1px solid #eee; border-bottom: 1px solid #eee;">
                        <p style="margin: 0; font-size: 13px; color: #999;">${isUnlocked ? '✅ Déverrouillé' : '🔒 Verrouillé'}</p>
                    </div>

                    <!-- Bouton -->
                    <button 
                        class="btn ${buttonClass}" 
                        onclick="${isUnlocked ? `App.afficherNiveau('${niveau.id}')` : 'return false;'}"
                        ${buttonDisabled}
                        style="width: 100%; padding: 12px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; transition: all 0.3s ease; ${buttonDisabled ? 'opacity: 0.5; cursor: not-allowed;' : ''}"
                    >
                        ${isUnlocked ? '▶ Continuer' : '🔒 Verrouillé'}
                    </button>
                </div>
            `;
        });

        html += `
                    </div>

                    <!-- STATS RAPIDES - DESIGN COHÉRENT -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin-top: 40px; padding: 20px; background: linear-gradient(135deg, #f5f7fa 0%, #e9ecef 100%); border-radius: 12px;">
                        <div class="stat-accueil">
                            <div style="font-size: 32px; margin-bottom: 10px;">⭐</div>
                            <div style="font-size: 28px; font-weight: bold; color: var(--color-primary); min-height: 40px; display: flex; align-items: center; justify-content: center;">${StorageManager.getUser().totalPoints || 0}</div>
                            <div style="font-size: 13px; color: #666; margin-top: 5px; font-weight: 600;">Points gagnés</div>
                        </div>
                        <div class="stat-accueil">
                            <div style="font-size: 32px; margin-bottom: 10px;">🏆</div>
                            <div style="font-size: 28px; font-weight: bold; color: var(--color-primary); min-height: 40px; display: flex; align-items: center; justify-content: center;">${niveaux.filter(n => App.isNiveauUnlocked(n.id)).length || 0}</div>
                            <div style="font-size: 13px; color: #666; margin-top: 5px; font-weight: 600;">Niveaux déverrouillés</div>
                        </div>
                        <div class="stat-accueil">
                            <div style="font-size: 32px; margin-bottom: 10px;">📚</div>
                            <div style="font-size: 28px; font-weight: bold; color: var(--color-primary); min-height: 40px; display: flex; align-items: center; justify-content: center;">${niveaux.length || 0}</div>
                            <div style="font-size: 13px; color: #666; margin-top: 5px; font-weight: 600;">Niveaux total</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        return html;
    },

    /**
     * Vérifie si un niveau est déverrouillé
     * N1 toujours déverrouillé
     * N2+ si niveau précédent = 100%
     */
    isNiveauUnlocked(niveauId) {
        if (niveauId === 'N1') return true;
        
        const levelMap = { 'N2': 'N1', 'N3': 'N2', 'N4': 'N3' };
        const previousNiveau = levelMap[niveauId];
        
        if (!previousNiveau) return false;
        
        const previousCompletion = this.calculateNiveauCompletion(previousNiveau);
        const isUnlocked = previousCompletion === 100;
        
        Logger.debug(`🔓 ${niveauId} ${isUnlocked ? 'déverrouillé' : 'verrouillé'} (${previousNiveau}: ${previousCompletion}%)`);
        return isUnlocked;
    },

    /**
     * Calcule la progression d'un niveau
     * Basé sur les étapes complétées du niveau
     */
    calculateNiveauCompletion(niveauId) {
        // 🔧 FIX: Déléguer à StorageManager qui lit depuis chaptersProgress
        return StorageManager.calculateNiveauCompletion(niveauId);
    },

    /**
     * Affiche les chapitres d'un niveau
     * Avec vérification de déblocage
     * 🔧 FIX: Utilise chaptersProgress pour la progression (pas chapitre.etapes.completed)
     */
    async afficherNiveau(niveauId) {
        // Vérifier déblocage
        if (!this.isNiveauUnlocked(niveauId)) {
            alert(`🔒 Niveau ${niveauId} verrouillé!\nComplétez le niveau précédent à 100% pour débloquer.`);
            return;
        }

        // Charger les chapitres du niveau
        try {
            CHAPITRES = await loadChapitres(niveauId);
            window.CHAPITRES = CHAPITRES;
            
            if (!CHAPITRES || CHAPITRES.length === 0) {
                alert(`Aucun chapitre trouvé pour le niveau ${niveauId}`);
                return;
            }

            // 🔧 FIX: Lire la progression depuis chaptersProgress (localStorage)
            const chaptersProgress = StorageManager.getChaptersProgress();

            // Générer HTML des chapitres
            let html = `
                <div class="page active">
                    <div class="page-title" style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <span>📚</span>
                            <h2>Chapitres - ${niveauId}</h2>
                        </div>
                        <button class="btn btn--secondary" onclick="App.afficherAccueil()">◀ Retour</button>
                    </div>

                    <div class="chapitres-list" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 10px;">
            `;

            // Ajouter chaque chapitre
            CHAPITRES.forEach(chapitre => {
                const chapId = chapitre.id;
                const total = chapitre.etapes?.length || 0;
                
                // 🔧 FIX: Lire depuis chaptersProgress, pas chapitre.etapes.completed
                const progressData = chaptersProgress[chapId];
                const completedSteps = progressData?.completedSteps || 0;
                const percent = progressData?.completion || 0;

                html += `
                    <div class="chapitre-card" onclick="App.afficherChapitre('${chapitre.id}')" data-chapitre-id="${chapId}" style="cursor: pointer; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 6px 20px rgba(0,0,0,0.15)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)';">
                        <div class="chapitre-card-header" style="background-color: ${chapitre.couleur || '#667eea'}; color: white; padding: 16px; display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 12px; min-height: 80px;">
                            <div style="font-size: 2.5em; flex-shrink: 0;">${chapitre.emoji || '📖'}</div>
                            <h3 style="margin: 0; font-size: 18px; line-height: 1.3; color: #333; text-align: center; font-weight: 700;">${chapitre.titre}</h3>
                        </div>
                        <div class="chapitre-card-body" style="padding: 16px;">
                            <p style="margin: 0 0 12px 0; color: #666; font-size: 13px; line-height: 1.4; min-height: 40px;">${chapitre.description}</p>
                            <div style="margin-bottom: 8px; font-weight: 600; color: #333; text-align: center;">${percent}% (${completedSteps}/${total} étapes)</div>
                            <div class="chapitre-progress">
                                <div class="progress-bar" style="height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
                                    <div class="progress-fill" style="width: ${percent}%; height: 100%; background: linear-gradient(90deg, ${chapitre.couleur || '#667eea'}, ${chapitre.couleur || '#667eea'}cc); border-radius: 4px;"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;

            // Mettre à jour le DOM
            const appContent = document.getElementById('app-content');
            if (appContent) {
                appContent.innerHTML = html;
            }

            Logger.debug(`📚 Affichage ${CHAPITRES.length} chapitres du niveau ${niveauId}`);
        } catch (error) {
            Logger.error(`❌ Erreur afficherNiveau(${niveauId}):`, error);
            alert(`Erreur lors du chargement du niveau ${niveauId}`);
        }
    },

    /**
     * Affiche la page d'accueil
     */
    afficherAccueil() {
        this.loadPage('accueil');
    },

    /**
     * Retourne SEULEMENT les chapitres qui ont une progression > 0%
     * Filtre CHAPITRES basé sur StorageManager.getChaptersProgress()
     * @returns {Array} Chapitres commencés
     */
    getChapitrresCommences() {
        if (!CHAPITRES || CHAPITRES.length === 0) {
            return [];
        }

        const chaptersProgress = StorageManager.getChaptersProgress();
        
        // 🔧 FIX: Filtrer les chapitres EN COURS (> 0% ET < 100%)
        // Les chapitres à 100% sont terminés et ne doivent plus apparaître ici
        const commences = CHAPITRES.filter(chapitre => {
            const progress = chaptersProgress[chapitre.id];
            const completion = progress?.completion || 0;
            // Un chapitre est "en cours" s'il a 0 < completion < 100
            return completion > 0 && completion < 100;
        });

        Logger.debug(`📚 ${commences.length}/${CHAPITRES.length} chapitres en cours`, commences.map(c => `${c.id}:${chaptersProgress[c.id]?.completion || 0}%`).join(', '));
        return commences;
    },

    renderChapitres() {
        if (!CHAPITRES || CHAPITRES.length === 0) {
            return `
                <div class="page active">
                    <div class="page-title">
                        <span>📚</span>
                        <h2>Mes Chapitres</h2>
                    </div>
                    <div class="loading">Chargement des chapitres...</div>
                </div>
            `;
        }

        // Récupérer SEULEMENT les chapitres commencés (progression > 0%)
        const chapitresCommences = this.getChapitrresCommences();

        // SI aucun chapitre n'a de progression
        if (chapitresCommences.length === 0) {
            return `
                <div class="page active">
                    <div class="page-title">
                        <span>📚</span>
                        <h2>Mes Chapitres</h2>
                    </div>
                    
                    <div class="container">
                        <div class="empty-state">
                            <div class="empty-icon">🚀</div>
                            <h3>Aucun chapitre commencé</h3>
                            <p>Allez à l'accueil pour débuter votre apprentissage et sélectionner un niveau.</p>
                            <button class="btn btn--primary" onclick="App.afficherAccueil()">◀ Aller à l'accueil</button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        let html = `
            <div class="page active">
                <div class="page-title">
                    <span>📚</span>
                    <h2>Mes Chapitres</h2>
                </div>
                
                <div class="container">
                    <div class="chapitres-list">
        `;

        const chaptersProgress = StorageManager.getChaptersProgress();
        
        // Afficher SEULEMENT les chapitres EN COURS (pas terminés)
        chapitresCommences.forEach(chapitre => {
            const progress = chaptersProgress[chapitre.id];
            const completion = progress?.completion || 0;
            // 🔧 FIX: Utiliser completedSteps (nombre) au lieu de stepsCompleted (tableau)
            const completedSteps = progress?.completedSteps || 0;
            const total = chapitre.etapes?.length || 0;
            const percent = Math.round(completion);
            
            html += `
                <div class="chapitre-card" onclick="App.afficherChapitre('${chapitre.id}')" data-chapitre-id="${chapitre.id}" style="cursor: pointer;">
                    <div class="chapitre-card-header" style="background-color: ${chapitre.couleur || '#667eea'}; color: white; padding: 16px; border-radius: 12px 12px 0 0; display: flex; align-items: center; justify-content: center;">
                        <h3 style="margin: 0; font-size: 20px; color: #333; display: flex; align-items: center; justify-content: center; gap: 12px; font-weight: 700;">${chapitre.emoji || '📖'} <span>${chapitre.titre}</span></h3>
                    </div>
                    <div class="chapitre-card-body" style="padding: 16px;">
                        <p style="margin: 0 0 12px 0; color: #666; font-size: 14px; line-height: 1.4;">${chapitre.description}</p>
                        <div style="margin-bottom: 8px; font-weight: 600; color: #333;">${percent}% (${completedSteps}/${total} étapes)</div>
                        <div class="chapitre-progress">
                            <div class="progress-bar" style="height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
                                <div class="progress-fill" style="width: ${percent}%; height: 100%; background: linear-gradient(90deg, ${chapitre.couleur || '#667eea'}, ${chapitre.couleur || '#667eea'}cc); border-radius: 4px;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `
                    </div>
                </div>
            </div>
        `;
        
        return html;
    },
    
    renderPratique() {
        // � DÉFINIR QU'ON EST MAINTENANT SUR LA PAGE PRATIQUE
        this.currentPage = 'pratique';
        this.returnPath = null;  // Réinitialiser le chemin de retour
        Logger.debug('📄 Page PRATIQUE activée - returnPath réinitialisé');
        
        // �🔧 FIX: Récupérer les exercices depuis les étapes COMPLÉTÉES dans localStorage
        const exercicesValides = [];
        
        // Vérifier que CHAPITRES est chargé
        if (!CHAPITRES || CHAPITRES.length === 0) {
            Logger.warn('⚠️ CHAPITRES non chargé pour renderPratique');
            return `
                <div class="page active">
                    <div class="page-title">
                        <span>🎯</span>
                        <h2>Exercices de Révision</h2>
                    </div>
                    <div class="container">
                        <div class="empty-state">
                            <div class="empty-icon">📚</div>
                            <h3>Chargement...</h3>
                            <p>Veuillez d'abord accéder à un niveau pour charger les chapitres.</p>
                            <button class="btn btn--primary" onclick="App.afficherAccueil()">Aller à l'accueil</button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Parcourir tous les chapitres et leurs étapes
        CHAPITRES.forEach(ch => {
            if (!ch || !ch.etapes) return;
            
            ch.etapes.forEach((etape, index) => {
                // 🔧 FIX: Lire l'état depuis StorageManager (pas depuis l'objet JSON)
                const etatEtape = StorageManager.getEtapeState(ch.id, index);
                const isCompleted = etatEtape?.completed || etatEtape?.status === 'completed';
                
                // 🔧 FIX: Les vrais types sont exercise_group, diagnostic, apprentissage
                // Les types individuels (qcm, flashcard) sont DANS les exercise_group
                const isExercise = ['exercise_group', 'diagnostic', 'qcm', 'quiz', 'flashcard', 'flashcards', 'matching', 'ordering', 'fill-blank', 'drag-drop'].includes(etape.type);
                
                if (isCompleted && isExercise) {
                    exercicesValides.push({
                        id: etape.id,
                        titre: etape.titre || `Exercice ${index + 1}`,
                        chapitre: ch.titre,
                        chapitreId: ch.id,
                        etapeIndex: index,
                        type: etape.type,
                        points: etape.points || 10
                    });
                }
            });
        });
        
        Logger.debug(`🎯 Pratique: ${exercicesValides.length} exercices complétés trouvés`);
        
        if (exercicesValides.length === 0) {
            return `
                <div class="page active">
                    <div class="page-title">
                        <span>🎯</span>
                        <h2>Exercices de Révision</h2>
                    </div>
                    <div class="container">
                        <div class="empty-state">
                            <div class="empty-icon">📚</div>
                            <h3>Aucun exercice disponible</h3>
                            <p>Complétez au moins une étape pour accéder aux exercices de révision</p>
                            <button class="btn btn--primary" onclick="App.loadPage('chapitres')">Retour aux chapitres</button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Récupérer un exercice aléatoire
        const exerciceActuel = exercicesValides[Math.floor(Math.random() * exercicesValides.length)];
        
        return `
            <div class="page active">
                <div class="page-title">
                    <span>🎯</span>
                    <h2>Exercices de Révision</h2>
                </div>
                
                <div class="container">
                    <div class="pratique-header">
                        <p class="pratique-subtitle">Consolidez vos apprentissages</p>
                    </div>
                    
                    <div class="exercice-container">
                        <div class="exercice-card">
                            <div class="exercice-meta">
                                <span class="meta-badge meta-chapitre">${exerciceActuel.chapitre}</span>
                                <span class="meta-badge meta-type">${exerciceActuel.type}</span>
                                <span class="meta-badge meta-points">⭐ ${exerciceActuel.points} pts</span>
                            </div>
                            
                            <h3 class="exercice-titre">${exerciceActuel.titre}</h3>
                            
                            <div class="exercice-content">
                                <p style="color: var(--color-text-light); text-align: center; padding: var(--spacing-lg);">
                                    Exercice ${exerciceActuel.type} - Cliquez pour ouvrir
                                </p>
                            </div>
                            
                            <div class="exercice-actions">
                                <button class="btn btn--primary" onclick="App.afficherEtape('${exerciceActuel.chapitreId}', ${exerciceActuel.etapeIndex})">
                                    ▶ Commencer l'exercice
                                </button>
                                <button class="btn btn--secondary" onclick="App.loadPage('pratique')">
                                    ↻ Exercice suivant
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="pratique-stats">
                        <div class="stat-row">
                            <span>Exercices disponibles: <strong>${exercicesValides.length}</strong></span>
                            <span>Points possibles: <strong>${exercicesValides.reduce((s, e) => s + e.points, 0)}</strong></span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    renderJournal() {
        // Mode avancé Bloom uniquement
        let html = `
            <div class="page active">
                <div class="page-title">
                    <span>📔</span>
                    <h2 class="journal-header">Mon Journal d'Apprentissage</h2>
                </div>
                
                <!-- CONTENU JOURNAL AVANCÉ (Bloom) -->
                <div id="journal-advanced-content" class="container"></div>
            </div>
        `;
        
        // Auto-initialiser le module journal avancé après rendu
        setTimeout(() => {
            // Initialiser le module journal avancé
            if (typeof JournalAdvanceUI !== 'undefined' && JournalAdvanceUI.init) {
                JournalAdvanceUI.init();
                
                // Rendre le contenu avancé directement
                if (typeof JournalAdvanceUI.renderAdvancedJournal !== 'undefined') {
                    JournalAdvanceUI.renderAdvancedJournal();
                }
            }
        }, 100);
        
        return html;
    },
    
    renderProfil() {
        // Récupérer données utilisateur
        const user = StorageManager.getUser();
        
        // Calculer statistiques
        // 🔧 FIX: Lire depuis chaptersProgress (localStorage) au lieu de e.completed (JSON)
        const chaptersProgress = StorageManager.getChaptersProgress();
        
        const totalEtapes = CHAPITRES.reduce((s, ch) => s + (ch.etapes?.length || 0), 0);
        const completedEtapes = CHAPITRES.reduce((s, ch) => {
            const progress = chaptersProgress[ch.id];
            return s + (progress?.completedSteps || 0);
        }, 0);
        const chapitresComplets = CHAPITRES.filter(ch => {
            const progress = chaptersProgress[ch.id];
            return progress?.completion === 100;
        }).length;
        const points = user.totalPoints;
        
        // 🔧 FIX: Badges basés sur chaptersProgress.completion === 100
        // Dynamique: 1 badge par chapitre + badge Expert global
        const badges = [
            { id: 'expert_global', nom: 'Expert Douanier', icon: '🏆', unlocked: chapitresComplets === CHAPITRES.length },
            ...CHAPITRES.map(ch => {
                const progress = chaptersProgress[ch.id];
                return {
                    id: `badge_${ch.id}`,
                    nom: `Maître de ${ch.titre}`,
                    icon: ch.emoji || '👑',  // Utiliser l'emoji du chapitre
                    unlocked: progress?.completion === 100
                };
            })
        ];
        
        const badgesUnlocked = badges.filter(b => b.unlocked).length;
        
        // Affichage du profil: lecture seule si créé, sinon afficher message
        let profilHtml = '';
        if (user.profileCreated && user.nom && user.prenom && user.matricule) {
            profilHtml = `
                <div class="profil-section profil-user">
                    <h3>👤 Mon Profil</h3>
                    <div class="user-info-display">
                        <div class="info-item">
                            <label>Prénom</label>
                            <p class="info-value">${user.prenom}</p>
                        </div>
                        <div class="info-item">
                            <label>Nom</label>
                            <p class="info-value">${user.nom}</p>
                        </div>
                        <div class="info-item">
                            <label>Numéro de Matricule</label>
                            <p class="info-value">${user.matricule}</p>
                        </div>
                    </div>
                    <p class="profil-info-note">ℹ️ <em>Votre profil a été créé et ne peut pas être modifié.</em></p>
                </div>
            `;
        } else {
            profilHtml = `
                <div class="profil-section profil-user">
                    <h3>👤 Mon Profil</h3>
                    <p class="profil-message">Votre profil n'a pas encore été créé. Rechargez la page pour initialiser votre profil.</p>
                </div>
            `;
        }
        
        return `
            <div class="page active">
                <div class="page-title">
                    <span>👤</span>
                    <h2>Mon Profil</h2>
                </div>
                
                <div class="container profil-container">
                    <!-- SECTION INFOS UTILISATEUR -->
                    ${profilHtml}
                    
                    <!-- SECTION STATISTIQUES -->
                    <div class="profil-section profil-stats">
                        <h3>Statistiques</h3>
                        <div class="stats-grid">
                            <div class="stat-box">
                                <div class="stat-box-icon">⭐</div>
                                <div class="stat-box-value">${points}</div>
                                <div class="stat-box-label">Points gagnés</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-box-icon">✅</div>
                                <div class="stat-box-value">${completedEtapes}/${totalEtapes}</div>
                                <div class="stat-box-label">Étapes complétées</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-box-icon">🏆</div>
                                <div class="stat-box-value">${chapitresComplets}/${CHAPITRES.length}</div>
                                <div class="stat-box-label">Chapitres maîtrisés</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-box-icon">🎖️</div>
                                <div class="stat-box-value">${badgesUnlocked}</div>
                                <div class="stat-box-label">Badges déverrouillés</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- SECTION BADGES -->
                    <div class="profil-section profil-badges">
                        <h3>Mes Badges</h3>
                        <div class="badges-grid">
                            ${badges.map(badge => `
                                <div class="badge ${badge.unlocked ? 'badge-unlocked' : 'badge-locked'}">
                                    <div class="badge-icon">${badge.icon}</div>
                                    <div class="badge-name">${badge.nom}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <!-- SECTION SAUVEGARDE/IMPORT -->
                    <div class="profil-section profil-storage">
                        <h3>Gestion Données</h3>
                        <div class="storage-actions">
                            <button class="btn btn--primary" onclick="App.exporterSauvegarde()">
                                📥 Exporter sauvegarde
                            </button>
                            <button class="btn btn--secondary" onclick="App.importerSauvegarde()">
                                📤 Importer sauvegarde
                            </button>
                            <button class="btn btn--danger" onclick="App.reinitialiserDonnees()">
                                🗑️ Réinitialiser données
                            </button>
                        </div>
                        <p class="storage-hint">Exportez vos données pour les sauvegarder ou les transférer sur un autre appareil</p>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Déverrouille un badge de compétence
     * @param {string} chapitreId - ID du chapitre
     */
    deverrouillerBadge(chapitreId) {
        const chapitre = CHAPITRES.find(ch => ch.id === chapitreId);
        if (!chapitre) return;

        const badgeId = `badge_${chapitreId}`;
        
        // 🔧 FIX: Vérifier si déjà débloqué pour éviter notification en double
        const existingBadges = StorageManager.getBadges();
        if (existingBadges.includes(badgeId)) {
            Logger.debug(`🏆 Badge ${badgeId} déjà débloqué`);
            return;
        }

        const badge = {
            id: badgeId,
            titre: `Maître de ${chapitre.titre}`,
            emoji: chapitre.emoji || '🎖️',
            chapitre: chapitreId,
            condition: 'chapter_completed',
            debloque: true,
            dateDeblocage: new Date().toISOString()
        };

        // 🔧 FIX: Utiliser StorageManager au lieu de localStorage direct
        StorageManager.addBadge(badgeId);
        
        // Marquer badgeEarned dans chaptersProgress
        const chaptersProgress = StorageManager.getChaptersProgress();
        if (chaptersProgress[chapitreId]) {
            chaptersProgress[chapitreId].badgeEarned = true;
            StorageManager.update('chaptersProgress', chaptersProgress);
        }

        // Animation notification
        this.afficherNotificationBadge(badge);
        
        // Mettre à jour l'en-tête
        this.updateHeader();
    },

    /**
     * Affiche une notification animée de badge
     */
    afficherNotificationBadge(badge) {
        const notif = document.createElement('div');
        notif.className = 'badge-notification';
        notif.innerHTML = `
            <div class="badge-content">
                <span class="badge-emoji">${badge.emoji}</span>
                <div>
                    <p class="badge-titre">Badge déverrouillé!</p>
                    <p class="badge-soustitre">${badge.titre}</p>
                </div>
            </div>
        `;
        document.body.appendChild(notif);

        // Animation et suppression
        setTimeout(() => notif.classList.add('show'), 10);
        setTimeout(() => {
            notif.classList.remove('show');
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    },
    
    updateHeader() {
        const user = StorageManager.getUser();
        const badges = StorageManager.getBadges();
        
        // 🔧 FIX: Compter aussi les badges basés sur chapitres complétés
        const chaptersProgress = StorageManager.getChaptersProgress();
        let badgeCount = badges.length;
        
        // Ajouter les badges de chapitres complétés (pour affichage cohérent)
        if (CHAPITRES && CHAPITRES.length > 0) {
            CHAPITRES.forEach(ch => {
                const progress = chaptersProgress[ch.id];
                if (progress?.completion === 100 && !badges.includes(`badge_${ch.id}`)) {
                    // Badge mérité mais pas encore dans la liste
                    badgeCount++;
                }
            });
        }
        
        const pointsEl = document.getElementById('pointsDisplay');
        const daysEl = document.getElementById('daysDisplay');
        const badgesEl = document.getElementById('badgesDisplay');
        
        if (pointsEl) pointsEl.textContent = user.totalPoints;
        if (daysEl) daysEl.textContent = user.consecutiveDays;
        if (badgesEl) badgesEl.textContent = badgeCount;
    },
    
    // ═══════════════════════════════════════════════════════════════
    // MÉTHODES JOURNAL D'APPRENTISSAGE (Onglet 4)
    // ═══════════════════════════════════════════════════════════════
    
    sauvegarderJournalEntree() {
        const appris = document.getElementById('journal-appris')?.value.trim();
        const application = document.getElementById('journal-application')?.value.trim();
        const impact = document.getElementById('journal-impact')?.value.trim();
        
        if (!appris && !application && !impact) {
            showErrorNotification('⚠️ Entrée vide', 'Veuillez remplir au moins un champ');
            return;
        }
        
        // Créer l'entrée
        const entry = {
            date: new Date().toISOString(),
            reflexion: { appris, application, impact }
        };
        
        // Sauvegarder dans localStorage
        const journal = JSON.parse(localStorage.getItem('journal_apprentissage') || '[]');
        journal.push(entry);
        localStorage.setItem('journal_apprentissage', JSON.stringify(journal));
        
        // Feedback
        showSuccessNotification('✅ Entrée sauvegardée', 'Votre réflexion a été enregistrée', '📔');
        
        // Réinitialiser formulaire et rafraîchir
        setTimeout(() => {
            this.loadPage('journal');
        }, 1000);
    },
    
    supprimerJournalEntree(index) {
        Logger.debug('🗑️ Suppression entrée journal à l\'index:', index);
        
        const journal = JSON.parse(localStorage.getItem('journal_apprentissage') || '[]');
        journal.splice(index, 1);
        localStorage.setItem('journal_apprentissage', JSON.stringify(journal));
        
        showSuccessNotification('✅ Supprimée', 'Entrée supprimée avec succès');
        this.loadPage('journal');
    },
    
    // ═══════════════════════════════════════════════════════════════
    // MÉTHODES PROFIL UTILISATEUR (Onglet 5)
    // ═══════════════════════════════════════════════════════════════
    
    sauvegarderProfilUtilisateur() {
        const prenom = document.getElementById('user-prenom')?.value.trim();
        const nom = document.getElementById('user-nom')?.value.trim();
        const matricule = document.getElementById('user-matricule')?.value.trim();
        
        if (!prenom || !nom) {
            showErrorNotification('⚠️ Champs obligatoires', 'Veuillez remplir Prénom et Nom');
            return;
        }
        
        // Sauvegarder dans localStorage
        const userData = JSON.parse(localStorage.getItem('user_douanes_formation') || '{}');
        userData.user = { prenom, nom, matricule: matricule || 'N/A' };
        userData.lastUpdated = new Date().toISOString();
        localStorage.setItem('user_douanes_formation', JSON.stringify(userData));
        
        showSuccessNotification('✅ Profil mis à jour', `Bienvenue ${prenom} ${nom}!`);
    },
    
    exporterSauvegarde() {
        const userData = JSON.parse(localStorage.getItem('user_douanes_formation') || '{}');
        const journal = JSON.parse(localStorage.getItem('journal_apprentissage') || '[]');
        const plans = JSON.parse(localStorage.getItem('plans') || '{}');
        
        // Créer objet sauvegarde complet
        const sauvegarde = {
            version: '1.0',
            dateExport: new Date().toISOString(),
            user: userData.user || {},
            progression: userData.progression || {},
            badges: userData.badges || {},
            points: userData.points || 0,
            journal: journal,
            plans: plans,
            metadata: {
                dateCreation: userData.dateCreation || new Date().toISOString(),
                dateLastUpdate: userData.lastUpdated || new Date().toISOString(),
                navigateur: navigator.userAgent
            }
        };
        
        // Télécharger fichier JSON
        const json = JSON.stringify(sauvegarde, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `douanes-formation-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showSuccessNotification('✅ Exportée', 'Votre sauvegarde a été téléchargée', '📥');
    },
    
    importerSauvegarde() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const sauvegarde = JSON.parse(event.target.result);
                    
                    // Validation structure
                    if (!sauvegarde.user || !sauvegarde.progression) {
                        throw new Error('Format de sauvegarde invalide');
                    }
                    
                    // Confirmation
                    Logger.warn('📥 Import données - Remplacement de TOUTES les données actuelles');
                    
                    // Restaurer données
                    localStorage.setItem('user_douanes_formation', JSON.stringify(sauvegarde));
                    localStorage.setItem('journal_apprentissage', JSON.stringify(sauvegarde.journal || []));
                    localStorage.setItem('plans', JSON.stringify(sauvegarde.plans || {}));
                    
                    showSuccessNotification('✅ Importée', 'Vos données ont été restaurées');
                    
                    // Recharger page
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } catch (err) {
                    showErrorNotification('❌ Erreur', `Impossible d'importer: ${err.message}`);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    },
    
    reinitialiserDonnees() {
        Logger.error('🔥 SUPPRESSION COMPLÈTE: Toutes les données seront supprimées!');
        
        // Supprimer toutes les clés localStorage
        localStorage.clear();
        
        showSuccessNotification('✅ Réinitalisée', 'Toutes vos données ont été supprimées');
        
        // Recharger page
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    }
};


// ═══════════════════════════════════════════════════════════════
// INITIALISATION UNIQUE
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
    // FIX: Handle "null" STRING in localStorage
    const douanelmsv2Raw = localStorage.getItem('douanelmsv2');
    if (douanelmsv2Raw === 'null') {
        Logger.warn('⚠️ Found corrupted "null" STRING');
        const validData = {
            user: {
                id: 'user_' + Date.now(),
                name: 'Apprenant',
                totalPoints: 0,
                level: 1,
                badges: []
            },
            stepsPoints: {},
            chaptersProgress: {},
            lastUpdated: new Date().toISOString()
        };
        localStorage.setItem('douanelmsv2', JSON.stringify(validData));
        Logger.debug('✅ localStorage fixed');
    }
    
    // Initialiser le StorageManager
    StorageManager.init();
    
    // 🔍 Restaurer les données du localStorage avec validation
    const savedData = localStorage.getItem('douanelmsv2');
    if (savedData && savedData !== 'null') {
        try {
            const data = JSON.parse(savedData);
            Logger.debug('✅ localStorage "douanelmsv2" restauré avec succès');
            Logger.debug('📦 Données chargées:', {
                user: data.user,
                chaptersProgress: Object.keys(data.chaptersProgress || {}).length + ' chapitres',
                stepsPoints: Object.keys(data.stepsPoints || {}).length + ' étapes'
            });
        } catch (e) {
            Logger.error('❌ localStorage corromptu - Réinitialisation:', e);
            localStorage.removeItem('douanelmsv2');
            StorageManager.setDefault();
        }
    }
    
    // Vérifier et mettre à jour les jours consécutifs
    const user = StorageManager.getUser();
    const today = new Date().toDateString();
    const lastActivityDate = user.lastActivityDate ? new Date(user.lastActivityDate).toDateString() : null;
    
    if (lastActivityDate !== today) {
        // C'est une nouvelle journée
        if (lastActivityDate === new Date(Date.now() - 86400000).toDateString()) {
            // Hier était le dernier accès - augmenter les jours consécutifs
            user.consecutiveDays = (user.consecutiveDays || 0) + 1;
        } else {
            // Briser la chaîne - recommencer à 1
            user.consecutiveDays = 1;
        }
        
        user.lastActivityDate = new Date().toISOString();
        StorageManager.updateUser(user);
    }
    
    // Charger les chapitres
    CHAPITRES = await loadChapitres();
    // Mettre à jour global window reference
    window.CHAPITRES = CHAPITRES;
    window.CHAPTERS = CHAPITRES;  // Keep alias for backward compatibility
    Logger.debug('✅ CHAPITRES et CHAPTERS alias initialisés');
    
    // 🌉 PRÉ-CHARGER LES DONNÉES POUR LES BRIDGE FUNCTIONS
    try {
        const response = await fetch('/api/niveaux');
        if (response.ok) {
            const data = await response.json();
            window.allNiveaux = {};
            data.niveaux.forEach(niveau => {
                window.allNiveaux[niveau.id] = niveau.chapitres || [];
            });
            window.niveauxData = data.niveaux;
            Logger.debug('🌉 Bridge functions data pré-chargées:', Object.keys(window.allNiveaux));
            Logger.debug('🌉 window.allNiveaux:', window.allNiveaux);
            Logger.debug('🌉 window.niveauxData:', window.niveauxData);
        } else {
            Logger.warn('⚠️ Erreur pré-chargement: response.ok =', response.ok, 'status =', response.status);
        }
    } catch (error) {
        Logger.warn('⚠️ Erreur pré-chargement bridge data:', error);
    }
    
    // 🔧 Charger le manifest vidéo pour les vidéos locales
    try {
        const videoManifestResponse = await fetch('assets/videos/101ab/video-manifest.json');
        if (videoManifestResponse.ok) {
            const manifestData = await videoManifestResponse.json();
            window.VIDEO_MANIFEST = {};
            manifestData.videos.forEach(video => {
                window.VIDEO_MANIFEST[video.id] = video;
            });
            Logger.debug('✅ VIDEO_MANIFEST chargé');
        }
    } catch (e) {
        Logger.warn('⚠️ Impossible de charger video-manifest.json', e);
    }
    
    // Charger la progression sauvegardée
    const chaptersProgress = StorageManager.getChaptersProgress();
    CHAPITRES.forEach(chapitre => {
        if (chaptersProgress[chapitre.id]) {
            const progress = chaptersProgress[chapitre.id];
            // Marquer les étapes comme complétées
            if (progress.stepsCompleted && Array.isArray(progress.stepsCompleted)) {
                progress.stepsCompleted.forEach(stepId => {
                    const etape = chapitre.etapes.find(e => e.id === stepId);
                    if (etape) {
                        etape.completed = true;
                    }
                });
            }
            // Restaurer la progression
            chapitre.progression = progress.completion || 0;
            Logger.debug(`✅ Progression du chapitre ${chapitre.id} restaurée: ${chapitre.progression}%`);
        }
    });
    
    // ═══════════════════════════════════════════════════════════
    // VALIDATION SYSTÈME (À appeler en console: VALIDATE_SYSTEM())
    // ═══════════════════════════════════════════════════════════
    window.VALIDATE_SYSTEM = function() {
        console.clear();
        Logger.debug('%c🔍 VALIDATION SYSTÈME - ONGLET 2 APPRENTISSAGE', 'font-size: 18px; font-weight: bold; color: #4A3F87;');
        Logger.debug('═'.repeat(60));
        
        const results = {
            passed: [],
            failed: [],
            warnings: []
        };
        
        // ✅ TEST 1: Existence des fonctions critiques
        const criticalFunctions = [
            'afficherChapitre',
            'afficherChapitreContenu',
            'afficherModalObjectives',
            'afficherPortfolioModal',
            'marquerEtapeComplete',
            'afficherEtape'
        ];
        
        Logger.debug('\n%c✓ Test 1: Fonctions critiques', 'color: #2ECC71; font-weight: bold;');
        criticalFunctions.forEach(fn => {
            if (typeof App[fn] === 'function') {
                Logger.debug(`  ✅ ${fn}`);
                results.passed.push(`Function ${fn} exists`);
            } else {
                Logger.debug(`  ❌ ${fn} - MANQUANTE!`);
                results.failed.push(`Function ${fn} missing`);
            }
        });
        
        // ✅ TEST 2: Données CHAPITRES chargées
        Logger.debug('\n%c✓ Test 2: Données CHAPITRES', 'color: #2ECC71; font-weight: bold;');
        if (window.CHAPITRES && Array.isArray(window.CHAPITRES)) {
            Logger.debug(`  ✅ CHAPITRES array exists (${CHAPITRES.length} chapitres)`);
            results.passed.push(`CHAPITRES loaded: ${CHAPITRES.length}`);
            
            // Vérifier chaque chapitre
            CHAPITRES.forEach((ch, idx) => {
                const hasId = !!ch.id;
                const hasTitle = !!ch.titre;
                const hasEtapes = Array.isArray(ch.etapes) && ch.etapes.length > 0;
                const hasObjectifs = Array.isArray(ch.objectifs) && ch.objectifs.length > 0;
                
                if (hasId && hasTitle && hasEtapes && hasObjectifs) {
                    Logger.debug(`    ✅ Chapitre ${idx + 1}: "${ch.titre}" (${ch.etapes.length} étapes, ${ch.objectifs.length} objectifs)`);
                    results.passed.push(`Chapitre ${ch.id} structure OK`);
                } else {
                    Logger.debug(`    ⚠️ Chapitre ${idx + 1}: Structure incomplète`);
                    results.warnings.push(`Chapitre ${ch.id} missing: ${!hasId ? 'id' : ''} ${!hasTitle ? 'titre' : ''} ${!hasEtapes ? 'etapes' : ''} ${!hasObjectifs ? 'objectifs' : ''}`);
                }
            });
        } else {
            Logger.debug(`  ❌ CHAPITRES non chargée`);
            results.failed.push('CHAPITRES array missing');
        }
        
        // ✅ TEST 3: PortfolioSwipe disponible
        Logger.debug('\n%c✓ Test 3: PortfolioSwipe', 'color: #2ECC71; font-weight: bold;');
        if (typeof window.PortfolioSwipe === 'object' && typeof PortfolioSwipe.init === 'function') {
            Logger.debug(`  ✅ PortfolioSwipe.init() disponible`);
            results.passed.push('PortfolioSwipe loaded');
        } else {
            Logger.debug(`  ❌ PortfolioSwipe.init() manquante`);
            results.failed.push('PortfolioSwipe missing');
        }
        
        // ✅ TEST 4: Modals HTML présents
        Logger.debug('\n%c✓ Test 4: Modals HTML', 'color: #2ECC71; font-weight: bold;');
        const modalsToCheck = [
            { id: 'objectives-modal', name: 'Objectives Modal' },
            { id: 'portfolio-modal', name: 'Portfolio Modal' },
            { id: 'etape-modal', name: 'Étape Modal' }
        ];
        
        modalsToCheck.forEach(modal => {
            const el = document.getElementById(modal.id);
            if (el) {
                Logger.debug(`  ✅ ${modal.name}`);
                results.passed.push(`${modal.name} found`);
            } else {
                Logger.debug(`  ❌ ${modal.name} - MANQUANT!`);
                results.failed.push(`${modal.name} missing`);
            }
        });
        
        // ✅ TEST 5: SVG Generation function
        Logger.debug('\n%c✓ Test 5: Génération SVG', 'color: #2ECC71; font-weight: bold;');
        if (typeof window.generatePathSVG === 'function') {
            Logger.debug(`  ✅ generatePathSVG() fonction présente`);
            const testSVG = generatePathSVG(CHAPITRES[0].etapes, CHAPITRES[0]);
            if (testSVG && testSVG.includes('<svg')) {
                Logger.debug(`  ✅ SVG généré correctement (contient ${testSVG.match(/step-group/g)?.length || 0} jalons)`);
                results.passed.push('SVG generation working');
            } else {
                Logger.debug(`  ⚠️ SVG retourné mais format suspects`);
                results.warnings.push('SVG format unexpected');
            }
        } else {
            Logger.debug(`  ❌ generatePathSVG() manquante`);
            results.failed.push('generatePathSVG missing');
        }
        
        // ✅ TEST 6: localStorage disponible
        Logger.debug('\n%c✓ Test 6: localStorage', 'color: #2ECC71; font-weight: bold;');
        try {
            const testKey = '__test_' + Date.now();
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            Logger.debug(`  ✅ localStorage accessible`);
            results.passed.push('localStorage working');
        } catch (e) {
            Logger.debug(`  ❌ localStorage error: ${e.message}`);
            results.failed.push('localStorage broken');
        }
        
        // ═══════════════════════════════════════════════════════════
        // RÉSULTATS FINAUX
        // ═══════════════════════════════════════════════════════════
        Logger.debug('\n%c' + '═'.repeat(60), 'color: #4A3F87; font-weight: bold;');
        Logger.debug('%c📊 RÉSULTATS VALIDATION', 'font-size: 16px; font-weight: bold; color: #4A3F87;');
        Logger.debug('═'.repeat(60));
        Logger.debug(`%c✅ Validations réussies: ${results.passed.length}`, 'color: #2ECC71; font-weight: bold;');
        Logger.debug(`%c⚠️  Avertissements: ${results.warnings.length}`, 'color: #F39C12; font-weight: bold;');
        Logger.debug(`%c❌ Erreurs critiques: ${results.failed.length}`, 'color: #E74C3C; font-weight: bold;');
        
        if (results.failed.length === 0 && results.warnings.length === 0) {
            Logger.debug('\n%c🎉 SYSTÈME VALIDÉ - ONGLET 2 PRÊT POUR LUNDI 10h', 'font-size: 16px; font-weight: bold; color: #27AE60; background: #D5F4E6; padding: 10px;');
        } else {
            if (results.failed.length > 0) {
                Logger.debug('\n%c❌ ERREURS À CORRIGER:', 'color: #E74C3C; font-weight: bold;');
                results.failed.forEach(e => Logger.debug(`   • ${e}`));
            }
            if (results.warnings.length > 0) {
                Logger.debug('\n%c⚠️  AVERTISSEMENTS:', 'color: #F39C12; font-weight: bold;');
                results.warnings.forEach(w => Logger.debug(`   • ${w}`));
            }
        }
        
        Logger.debug('\n%c' + '═'.repeat(60), 'color: #4A3F87;');
        Logger.debug('%cCommandes de test disponibles:', 'font-weight: bold;');
        Logger.debug('  VALIDATE_SYSTEM()          - Exécuter cette validation');
        Logger.debug('  App.afficherChapitre("ch1") - Afficher chapitre 1');
        Logger.debug('  App.afficherModalObjectives("ch1") - Voir modal objectifs');
        Logger.debug('═'.repeat(60));
        
        return {
            total: results.passed.length + results.failed.length + results.warnings.length,
            passed: results.passed.length,
            failed: results.failed.length,
            warnings: results.warnings.length
        };
    };
    
    // Auto-run validation on page load
    window.addEventListener('load', () => {
        Logger.debug('%c✨ Page chargée - Appelez VALIDATE_SYSTEM() en console pour valider', 'color: #4A3F87; font-style: italic;');
    });
    
    App.init();
    
    // Initialize Tutoring Module
    if (typeof TutoringModule !== 'undefined') {
        TutoringModule.init();
    }
    
    // Initialize Advanced Journal Module (Bloom Taxonomy)
    if (typeof JournalAvance !== 'undefined') {
        JournalAvance.init();
    }
});
