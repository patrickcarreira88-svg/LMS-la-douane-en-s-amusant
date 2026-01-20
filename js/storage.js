/**
 * StorageManager - Wrapper LocalStorage avec fallback
 * Gère TOUTES les données de l'application
 * 
 * Structure LocalStorage:
 * {
 *   user: { nickname, totalPoints, consecutiveDays, startDate },
 *   chaptersProgress: { ch1: { completion, etapes }, ch2: { ... } },
 *   exercisesCompleted: { ex1: true, ex2: false },
 *   badges: [ "badge1", "badge2" ],
 *   spacedRepetition: [ { exerciseId, niveau, nextReviewDate } ],
 *   journal: [ { id, date, chapter, reflection } ]
 * }
 */

const StorageManager = {
    // Clé principale
    APP_KEY: 'douanelmsv2',
    
    /**
     * Initialise le storage avec données par défaut
     */
    init() {
        console.log('🔄 Initialisation StorageManager...');
        
        if (!this.exists()) {
            this.setDefault();
        } else {
            // Même si localStorage existe, s'assurer que chaptersProgress a les chapitres
            const chaptersProgress = this.get('chaptersProgress') || {};
            const requiredChapters = {
                ch1: {
                    title: 'Introduction Douane',
                    completion: 0,
                    stepsCompleted: [],
                    stepsLocked: [],
                    badgeEarned: false
                },
                '101BT': {
                    title: 'Marchandises & Processus: Mise en Pratique',
                    completion: 0,
                    stepsCompleted: [],
                    stepsLocked: [],
                    badgeEarned: false
                },
                ch2: {
                    title: 'Législation Douanière',
                    completion: 0,
                    stepsCompleted: [],
                    stepsLocked: [],
                    badgeEarned: false
                },
                ch3: {
                    title: 'Procédures Douanières',
                    completion: 0,
                    stepsCompleted: [],
                    stepsLocked: [],
                    badgeEarned: false
                },
                ch4: {
                    title: 'Commerce International',
                    completion: 0,
                    stepsCompleted: [],
                    stepsLocked: [],
                    badgeEarned: false
                },
                ch5: {
                    title: 'Sécurité et Fiscalité',
                    completion: 0,
                    stepsCompleted: [],
                    stepsLocked: [],
                    badgeEarned: false
                }
            };
            
            // Ajouter les chapitres manquants
            let updated = false;
            for (const [chId, chData] of Object.entries(requiredChapters)) {
                if (!chaptersProgress[chId]) {
                    chaptersProgress[chId] = chData;
                    updated = true;
                }
            }
            
            if (updated) {
                this.update('chaptersProgress', chaptersProgress);
                console.log('✅ Chapitres manquants ajoutés à localStorage');
            }
        }
        
        console.log('✅ StorageManager initialisé');
    },
    
    /**
     * Vérifie si le storage existe
     */
    exists() {
        try {
            return !!localStorage.getItem(this.APP_KEY);
        } catch (e) {
            console.warn('⚠️ LocalStorage non disponible', e);
            return false;
        }
    },
    
    /**
     * Définit les données par défaut
     */
    setDefault() {
        const defaultData = {
            user: {
                nickname: 'Apprenti Douanier',
                totalPoints: 0,
                consecutiveDays: 0,
                startDate: new Date().toISOString(),
                lastActivityDate: new Date().toISOString(),
                nom: null,
                prenom: null,
                matricule: null,
                email: null,
                profileCreated: false,
                // Structure multi-niveaux (N1-N4)
                niveaux: {
                    N1: {
                        completion: 0,
                        chapters: {}
                    },
                    N2: {
                        completion: 0,
                        chapters: {}
                    },
                    N3: {
                        completion: 0,
                        chapters: {}
                    },
                    N4: {
                        completion: 0,
                        chapters: {}
                    }
                }
            },
            chaptersProgress: {
                ch1: {
                    title: 'Introduction Douane',
                    completion: 0,
                    stepsCompleted: [],
                    stepsLocked: [],
                    steps: {},
                    badgeEarned: false
                },
                '101BT': {
                    title: 'Marchandises & Processus: Mise en Pratique',
                    completion: 0,
                    stepsCompleted: [],
                    stepsLocked: [],
                    steps: {},
                    badgeEarned: false
                },
                ch2: {
                    title: 'Législation Douanière',
                    completion: 0,
                    stepsCompleted: [],
                    stepsLocked: [],
                    steps: {},
                    badgeEarned: false
                },
                ch3: {
                    title: 'Procédures Douanières',
                    completion: 0,
                    stepsCompleted: [],
                    stepsLocked: [],
                    steps: {},
                    badgeEarned: false
                },
                ch4: {
                    title: 'Commerce International',
                    completion: 0,
                    stepsCompleted: [],
                    stepsLocked: [],
                    steps: {},
                    badgeEarned: false
                },
                ch5: {
                    title: 'Sécurité et Fiscalité',
                    completion: 0,
                    stepsCompleted: [],
                    stepsLocked: [],
                    steps: {},
                    badgeEarned: false
                },
                ch6: {
                    title: 'Pratiques et Cas d\'Étude',
                    completion: 0,
                    stepsCompleted: [],
                    stepsLocked: [],
                    steps: {},
                    badgeEarned: false
                }
            },
            stepsPoints: {},
            exercisesCompleted: {},
            badges: [],
            spacedRepetition: [],
            journal: []
        };
        
        this.set(defaultData);
        console.log('📝 Données par défaut créées');
    },
    
    /**
     * Récupère TOUTES les données
     */
    getAll() {
        try {
            const data = localStorage.getItem(this.APP_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('❌ Erreur lecture storage', e);
            return null;
        }
    },
    
    /**
     * Sauvegarde TOUTES les données
     */
    set(data) {
        try {
            localStorage.setItem(this.APP_KEY, JSON.stringify(data));
            console.log('💾 Données sauvegardées');
            return true;
        } catch (e) {
            console.error('❌ Erreur sauvegarde storage', e);
            return false;
        }
    },
    
    /**
     * Récupère une clé spécifique
     */
    get(key) {
        const data = this.getAll();
        return data ? data[key] : null;
    },
    
    /**
     * Met à jour une clé spécifique
     */
    update(key, value) {
        const data = this.getAll();
        if (data) {
            data[key] = value;
            return this.set(data);
        }
        return false;
    },
    
    /**
     * Récupère les stats utilisateur
     */
    getUser() {
        return this.get('user') || {
            nickname: 'Apprenti Douanier',
            totalPoints: 0,
            consecutiveDays: 0
        };
    },
    
    /**
     * Met à jour les stats utilisateur
     */
    updateUser(updates) {
        const user = this.getUser();
        const updated = { ...user, ...updates };
        this.update('user', updated);
        return updated;
    },
    
    /**
     * Ajoute des points
     */
    addPoints(points = 10) {
        const user = this.getUser();
        user.totalPoints += points;
        this.update('user', user);
        console.log(`✨ +${points} points (Total: ${user.totalPoints})`);
        return user.totalPoints;
    },
    
    /**
     * Récupère les points gagnés par étape
     */
    getStepsPoints() {
        return this.get('stepsPoints') || {};
    },
    
    /**
     * Ajoute/met à jour les points pour une étape
     * Retourne: {pointsAdded, totalForStep, maxPoints}
     */
    addPointsToStep(stepId, pointsEarned, maxPoints) {
        const stepsPoints = this.getStepsPoints();
        const previousPoints = stepsPoints[stepId] || 0;
        const pointsToAdd = Math.max(0, Math.min(pointsEarned, maxPoints) - previousPoints);
        
        // Mettre à jour avec le max entre l'ancien et le nouveau score
        const newTotal = Math.max(previousPoints, Math.min(pointsEarned, maxPoints));
        stepsPoints[stepId] = newTotal;
        this.update('stepsPoints', stepsPoints);
        
        // Ajouter les points au compte utilisateur
        if (pointsToAdd > 0) {
            this.addPoints(pointsToAdd);
        }
        
        return {
            pointsAdded: pointsToAdd,
            totalForStep: newTotal,
            maxPoints: maxPoints,
            message: pointsToAdd > 0 ? `+${pointsToAdd} points!` : 'Excellent! Même score que précédemment.'
        };
    },
    
    /**
     * Récupère la progression chapitres
     */
    getChaptersProgress() {
        return this.get('chaptersProgress') || {};
    },
    
    /**
     * Met à jour progression chapitre
     */
    updateChapterProgress(chapterId, updates) {
        const chapters = this.getChaptersProgress();
        if (chapters[chapterId]) {
            chapters[chapterId] = { ...chapters[chapterId], ...updates };
            this.update('chaptersProgress', chapters);
        }
        return chapters[chapterId];
    },
    
    /**
     * Récupère les exercices complétés
     */
    getCompletedExercises() {
        return this.get('exercisesCompleted') || {};
    },
    
    /**
     * Marque un exercice comme complété
     */
    completeExercise(exerciseId) {
        const completed = this.getCompletedExercises();
        completed[exerciseId] = true;
        this.update('exercisesCompleted', completed);
        this.addPoints(10); // +10 points par exercice
        console.log(`✅ Exercice ${exerciseId} complété`);
        return completed;
    },
    
    /**
     * Récupère les badges
     */
    getBadges() {
        return this.get('badges') || [];
    },
    
    /**
     * Ajoute un badge
     */
    addBadge(badgeId) {
        const badges = this.getBadges();
        if (!badges.includes(badgeId)) {
            badges.push(badgeId);
            this.update('badges', badges);
            console.log(`🏆 Badge débloqué: ${badgeId}`);
        }
        return badges;
    },
    
    /**
     * Récupère les données spaced repetition
     */
    getSpacedRepetition() {
        return this.get('spacedRepetition') || [];
    },
    
    /**
     * Ajoute/met à jour une révision SM2
     */
    updateSpacedRep(exerciseId, niveau, nextReviewDate) {
        const sr = this.getSpacedRepetition();
        const index = sr.findIndex(item => item.exerciseId === exerciseId);
        
        if (index >= 0) {
            sr[index] = { exerciseId, niveau, nextReviewDate };
        } else {
            sr.push({ exerciseId, niveau, nextReviewDate });
        }
        
        this.update('spacedRepetition', sr);
        return sr;
    },
    
    /**
     * Récupère le journal
     */
    getJournal() {
        return this.get('journal') || [];
    },
    
    /**
     * Ajoute une entrée journal
     */
    addJournalEntry(chapterId, stepId, reflection) {
        const journal = this.getJournal();
        const entry = {
            id: `j${Date.now()}`,
            date: new Date().toISOString(),
            chapter: chapterId,
            step: stepId,
            reflection: reflection,
            mood: '😊'
        };
        
        journal.push(entry);
        this.update('journal', journal);
        console.log('📝 Entrée journal ajoutée');
        return entry;
    },
    
    /**
     * Exporte TOUTES les données (RGPD - Droit à la portabilité)
     */
    exportData() {
        const data = this.getAll();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `douane-lms-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        console.log('📥 Données exportées');
    },
    
    /**
     * Importe des données (RGPD - Droit à la portabilité)
     */
    importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    this.set(data);
                    console.log('📤 Données importées');
                    resolve(data);
                } catch (error) {
                    console.error('❌ Erreur import', error);
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    },
    
    /**
     * Réinitialise TOUTES les données (RGPD - Droit à l'oubli)
     */
    reset() {
        console.warn('🗑️ Réinitialisation complète des données demandée');
        localStorage.removeItem(this.APP_KEY);
        this.setDefault();
        console.log('🗑️ Toutes les données réinitialisées');
        return true;
    },

    // ================================================================
    // MULTI-NIVEAUX (N1, N2, N3, N4) - Nouvelles fonctions
    // ================================================================

    /**
     * 1. Initialise la structure multi-niveaux (N1-N4)
     * - Crée la structure si elle n'existe pas
     * - Migre les anciennes données (chapitres plat) vers le nouveau format
     */
    initializeNiveaux() {
        const data = this.getAll();
        if (!data) return false;

        // Si la structure N1-N4 n'existe pas, la créer
        if (!data.user.niveaux) {
            console.log('🔄 Migration vers structure multi-niveaux...');
            
            // Récupérer les chapitres actuels (ancien format)
            const oldChapters = data.chaptersProgress || {};
            
            // Créer la structure N1-N4
            data.user.niveaux = {
                N1: {
                    completion: 0,
                    chapters: {}
                },
                N2: {
                    completion: 0,
                    chapters: {}
                },
                N3: {
                    completion: 0,
                    chapters: {}
                },
                N4: {
                    completion: 0,
                    chapters: {}
                }
            };
            
            // Migrer les chapitres existants vers N1
            if (Object.keys(oldChapters).length > 0) {
                data.user.niveaux.N1.chapters = oldChapters;
                console.log(`✅ ${Object.keys(oldChapters).length} chapitres migrés vers N1`);
            }
            
            // Recalculer la complétion de N1
            data.user.niveaux.N1.completion = this.calculateNiveauCompletion('N1');
            
            this.set(data);
            console.log('✅ Structure multi-niveaux initialisée');
            return true;
        }
        
        return false;
    },

    /**
     * 2. Calcule le % de complétion d'un niveau
     * Retour: nombre entre 0 et 100 (moyenne des chapitres du niveau)
     * 🔧 DYNAMIQUE: Lit les chapitres depuis window.allNiveaux (chargé depuis l'API)
     *              Fallback sur mapping statique si données pas encore chargées
     */
    calculateNiveauCompletion(niveauId) {
        // 🔧 DYNAMIQUE: Récupérer les chapitres depuis les données chargées par l'API
        let chapterIds = [];
        
        if (window.allNiveaux && window.allNiveaux[niveauId]) {
            // Données API disponibles - extraire les IDs des chapitres
            chapterIds = window.allNiveaux[niveauId].map(ch => ch.id);
        } else {
            // Fallback: mapping statique (utilisé si API pas encore appelée)
            const FALLBACK_MAP = {
                'N1': ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'ch8'],
                'N2': ['101BT'],
                'N3': [],
                'N4': []
            };
            chapterIds = FALLBACK_MAP[niveauId] || [];
        }
        
        if (chapterIds.length === 0) {
            console.warn(`⚠️ Aucun chapitre mappé pour ${niveauId}`);
            return 0;
        }
        
        // Lire depuis chaptersProgress
        const chaptersProgress = this.getChaptersProgress();
        
        let totalCompletion = 0;
        
        chapterIds.forEach(chId => {
            if (chaptersProgress[chId]) {
                totalCompletion += chaptersProgress[chId].completion || 0;
            }
        });
        
        const average = Math.round(totalCompletion / chapterIds.length);
        console.log(`📊 calculateNiveauCompletion(${niveauId}): ${totalCompletion}/${chapterIds.length} = ${average}%`);
        return average;
    },

    /**
     * 3. Met à jour la progression d'un niveau
     * - Recalcule le % de complétion après changement de chapitre
     * - Sauvegarde dans localStorage
     * Retour: nouveau % de complétion du niveau
     */
    updateNiveauProgress(niveauId) {
        const user = this.getUser();
        
        if (!user.niveaux || !user.niveaux[niveauId]) {
            console.warn(`⚠️ Niveau ${niveauId} introuvable`);
            return 0;
        }
        
        // Recalculer la complétion
        const newCompletion = this.calculateNiveauCompletion(niveauId);
        user.niveaux[niveauId].completion = newCompletion;
        
        // Sauvegarder
        this.updateUser(user);
        
        console.log(`📊 Niveau ${niveauId}: ${newCompletion}% complété`);
        return newCompletion;
    },

    /**
     * 4. Récupère les chapitres d'un niveau
     * Retour: {ch1: {completion: 100}, 101BT: {...}, ...}
     */
    getNiveauChapitres(niveauId) {
        const user = this.getUser();
        
        if (!user.niveaux || !user.niveaux[niveauId]) {
            return {};
        }
        
        return user.niveaux[niveauId].chapters || {};
    },

    /**
     * 5. Vérifie si un niveau est déverrouillé
     * Logique de déblocage:
     * - N1: toujours déverrouillé
     * - N2: si N1 = 100%
     * - N3: si N2 = 100%
     * - N4: si N3 = 100%
     * Retour: boolean
     */
    isNiveauUnlocked(niveauId) {
        const user = this.getUser();
        
        if (!user.niveaux) {
            return niveauId === 'N1'; // N1 toujours accessible
        }
        
        switch (niveauId) {
            case 'N1':
                return true; // N1 toujours déverrouillé
            case 'N2':
                return user.niveaux.N1.completion === 100;
            case 'N3':
                return user.niveaux.N2.completion === 100;
            case 'N4':
                return user.niveaux.N3.completion === 100;
            default:
                return false;
        }
    },

    /**
     * 6. Modifie la progression d'un chapitre et met à jour son niveau
     * - Trouvé quel niveau contient ce chapitre
     * - Mise à jour du chapitre
     * - Recalcul de la complétion du niveau
     */
    setChapterProgress(chapterId, updates) {
        const user = this.getUser();
        
        if (!user.niveaux) {
            console.warn('⚠️ Structure niveaux non initialisée');
            return null;
        }
        
        // Trouver quel niveau contient ce chapitre
        let foundNiveauId = null;
        for (const niveauId in user.niveaux) {
            if (user.niveaux[niveauId].chapters[chapterId]) {
                foundNiveauId = niveauId;
                break;
            }
        }
        
        if (!foundNiveauId) {
            console.warn(`⚠️ Chapitre ${chapterId} non trouvé dans aucun niveau`);
            return null;
        }
        
        // Mise à jour du chapitre
        const chapter = user.niveaux[foundNiveauId].chapters[chapterId];
        if (chapter) {
            user.niveaux[foundNiveauId].chapters[chapterId] = {
                ...chapter,
                ...updates
            };
            
            // Sauvegarder l'utilisateur mis à jour
            this.updateUser(user);
            
            // Recalculer la complétion du niveau
            this.updateNiveauProgress(foundNiveauId);
            
            console.log(`✅ Chapitre ${chapterId} mis à jour dans ${foundNiveauId}`);
            return user.niveaux[foundNiveauId].chapters[chapterId];
        }
        
        return null;
    },

    /**
     * 7. Sauvegarde l'état d'une étape visitée
     * - Marque l'étape comme visitée/en cours
     * - Initialise la structure d'étape si nécessaire
     * Retour: état sauvegardé
     */
    saveEtapeState: function(chapitreId, etapeIndex, stateData) {
        if (!this.exists()) {
            this.init();
        }
        
        const data = this.getAll();
        
        // Initialize structure
        if (!data.chaptersProgress) data.chaptersProgress = {};
        if (!data.chaptersProgress[chapitreId]) {
            data.chaptersProgress[chapitreId] = {
                completion: 0,
                stepsCompleted: [],
                stepsLocked: [],
                steps: {},
                badgeEarned: false
            };
        }
        if (!data.chaptersProgress[chapitreId].steps) {
            data.chaptersProgress[chapitreId].steps = {};
        }
        
        // MERGE: Récupérer l'état ancien et le fusionner avec le nouveau
        const oldState = data.chaptersProgress[chapitreId].steps[etapeIndex] || {};
        data.chaptersProgress[chapitreId].steps[etapeIndex] = {
            ...oldState,
            ...stateData
        };
        
        // Update stepsCompleted
        if (stateData.completed && !data.chaptersProgress[chapitreId].stepsCompleted.includes(etapeIndex)) {
            data.chaptersProgress[chapitreId].stepsCompleted.push(etapeIndex);
        }
        
        this.set(data);
        
        // 🔷 SYNCHRONISER AVEC localStorage POUR PERSISTENCE IMMÉDIATE
        const stepKey = `step_${chapitreId}_${etapeIndex}`;
        localStorage.setItem(stepKey, JSON.stringify(stateData));
        console.log(`✅ [saveEtapeState] ${chapitreId}:${etapeIndex} saved to both StorageManager & localStorage`);
        return true;
    },

    /**
     * 8. Récupère l'état d'une étape
     */
    getEtapeState: function(chapitreId, etapeIndex) {
        try {
            const data = this.getAll();
            
            if (!data?.chaptersProgress?.[chapitreId]?.steps) {
                return null;
            }
            
            const etapeState = data.chaptersProgress[chapitreId].steps[etapeIndex];
            return etapeState || null;
            
        } catch (error) {
            console.error('❌ [getEtapeState] Error:', error.message);
            return null;
        }
    },

    /**
     * 8b. ALIAS: loadEtapeState = getEtapeState (pour compatibilité)
     * Utilisé par app.js updateStepIcons() et marquerEtapeComplete()
     * FIX: Refactoring race condition a changé le nom, mais 4 appels n'ont pas été mis à jour
     */
    loadEtapeState(chapterId, etapeIndex) {
        return this.getEtapeState(chapterId, etapeIndex);
    },

    /**
     * 9. Sauvegarde le statut du portfolio pour un chapitre
     * Portfolio n'est pas une étape régulière, donc on le track séparément
    /**
     * 9. Sauvegarde le statut du portfolio pour un chapitre
     * ✅ FIX: Utilise localStorage directement pour simplicité et fiabilité
     */
    savePortfolioStatus(chapterId, isCompleted) {
        const portfolioKey = `portfolio_${chapterId}`;
        const data = {
            completed: isCompleted,
            completedAt: isCompleted ? new Date().toISOString() : null
        };
        localStorage.setItem(portfolioKey, JSON.stringify(data));
        console.log(`📍 Portfolio ${chapterId} marqué comme: ${isCompleted ? 'complété ✅' : 'non-complété'}`);
        return data;
    },

    /**
     * 10. Récupère le statut du portfolio pour un chapitre
     * ✅ FIX: Lit depuis localStorage directement
     */
    getPortfolioStatus(chapterId) {
        const portfolioKey = `portfolio_${chapterId}`;
        const data = localStorage.getItem(portfolioKey);
        if (data) {
            try {
                return JSON.parse(data);
            } catch (e) {
                console.error(`❌ Erreur parsing portfolio ${chapterId}:`, e);
                return null;
            }
        }
        return null;
    },

    /**
     * 11. Sauvegarde le statut des objectifs visuels pour un chapitre
     * ✅ FIX OPTION B: Les objectifs sont un jalon VISUEL, pas une étape dans chapitre.etapes[]
     * Trackés séparément comme le portfolio
     */
    /**
     * 11. Sauvegarde le statut des objectifs visuels pour un chapitre
     * ✅ FIX: Utilise localStorage directement pour simplicité et fiabilité
     */
    saveObjectifsStatus(chapterId, isCompleted) {
        const objectifsKey = `objectives_${chapterId}`;
        const data = {
            completed: isCompleted,
            completedAt: isCompleted ? new Date().toISOString() : null
        };
        localStorage.setItem(objectifsKey, JSON.stringify(data));
        console.log(`📋 Objectifs ${chapterId} marqués comme: ${isCompleted ? 'complétés ✅' : 'non-complétés'}`);
        return data;
    },

    /**
     * 12. Récupère le statut des objectifs visuels pour un chapitre
     * ✅ FIX: Lit depuis localStorage directement
     */
    getObjectifsStatus(chapterId) {
        const objectifsKey = `objectives_${chapterId}`;
        const data = localStorage.getItem(objectifsKey);
        if (data) {
            try {
                return JSON.parse(data);
            } catch (e) {
                console.error(`❌ Erreur parsing objectifs ${chapterId}:`, e);
                return null;
            }
        }
        return null;
    }
};

// ✅ Exposer StorageManager globalement
window.StorageManager = StorageManager;

// Initialiser au chargement
document.addEventListener('DOMContentLoaded', () => {
    StorageManager.init();
    // Initialiser la structure multi-niveaux au premier chargement
    StorageManager.initializeNiveaux();
});
