/**
 * ⚙️ CONFIG.JS - Configuration centralisée LMS Douane
 * 
 * Centralise tous les magic numbers, seuils, limites pour éviter
 * les valeurs hardcodées dispersées dans app.js
 * 
 * @version 2.0
 * @date 2025
 */

const AppConfig = {
  
  // ═══════════════════════════════════════════════════════════
  // 🎯 VALIDATION - Scoring & Attempts
  // ═══════════════════════════════════════════════════════════
  VALIDATION: {
    /**
     * Score minimum pour passer une étape de validation (%)
     * Utilisé dans: validateStepWithThreshold()
     */
    MIN_SCORE_THRESHOLD: 80,
    
    /**
     * Nombre maximum de tentatives autorisées par étape
     * Utilisé dans: validateStepWithThreshold()
     */
    MAX_ATTEMPTS: 3,
    
    /**
     * Score minimum pour QCM (peut être différent de validation standard)
     */
    MIN_QCM_SCORE: 80,
    
    /**
     * Temps minimum requis pour une validation (secondes)
     * Prévient les validations trop rapides (anti-triche)
     */
    MIN_VALIDATION_TIME: 5
  },
  
  // ═══════════════════════════════════════════════════════════
  // 🏆 GAMIFICATION - Points, Badges, Streak
  // ═══════════════════════════════════════════════════════════
  GAMIFICATION: {
    /**
     * Points accordés pour compléter une étape
     */
    POINTS_PER_STEP: 10,
    
    /**
     * Points bonus pour score parfait (100%)
     */
    BONUS_PERFECT_SCORE: 50,
    
    /**
     * Points bonus pour streak de 7 jours
     */
    BONUS_WEEKLY_STREAK: 100,
    
    /**
     * Points bonus pour compléter un chapitre
     */
    BONUS_CHAPTER_COMPLETE: 200,
    
    /**
     * Seuils pour badges de progression (%)
     */
    BADGE_THRESHOLDS: {
      BRONZE: 25,    // 25% progression
      SILVER: 50,    // 50% progression
      GOLD: 75,      // 75% progression
      PLATINUM: 100  // 100% progression
    }
  },
  
  // ═══════════════════════════════════════════════════════════
  // ⏱️ TIMING - Delays, Durations, Timeouts
  // ═══════════════════════════════════════════════════════════
  TIMING: {
    /**
     * Durée d'affichage des notifications (ms)
     */
    NOTIFICATION_DURATION: 3000,
    
    /**
     * Délai pour auto-fermeture modal succès (ms)
     */
    MODAL_AUTO_CLOSE_DELAY: 2000,
    
    /**
     * Délai de debounce pour recherche (ms)
     */
    SEARCH_DEBOUNCE_DELAY: 300,
    
    /**
     * Délai de debounce pour resize (ms)
     */
    RESIZE_DEBOUNCE_DELAY: 200,
    
    /**
     * Timeout pour requêtes API (ms)
     */
    API_TIMEOUT: 10000
  },
  
  // ═══════════════════════════════════════════════════════════
  // 📊 PROGRESS - Thresholds & Limits
  // ═══════════════════════════════════════════════════════════
  PROGRESS: {
    /**
     * Pourcentage minimum pour déverrouiller chapitre suivant
     */
    MIN_CHAPTER_COMPLETION: 80,
    
    /**
     * Nombre d'étapes minimum complétées pour débloquer exercices pratiques
     */
    MIN_STEPS_FOR_PRACTICE: 3,
    
    /**
     * Pourcentage minimum pour accéder au quiz final
     */
    MIN_COMPLETION_FOR_FINAL_QUIZ: 90
  },
  
  // ═══════════════════════════════════════════════════════════
  // 🎨 UI - Dimensions, Limits
  // ═══════════════════════════════════════════════════════════
  UI: {
    /**
     * Nombre maximum d'exercices affichés par page
     */
    MAX_EXERCISES_PER_PAGE: 10,
    
    /**
     * Nombre maximum de notifications simultanées
     */
    MAX_NOTIFICATIONS: 3,
    
    /**
     * Largeur breakpoint mobile (px)
     */
    MOBILE_BREAKPOINT: 768,
    
    /**
     * Nombre maximum de caractères pour aperçu exercice
     */
    EXERCISE_PREVIEW_MAX_CHARS: 150
  },
  
  // ═══════════════════════════════════════════════════════════
  // 💾 STORAGE - Keys & Prefixes
  // ═══════════════════════════════════════════════════════════
  STORAGE: {
    /**
     * Préfixe pour toutes les clés localStorage
     */
    KEY_PREFIX: 'lms_douane_',
    
    /**
     * Clés de stockage principales
     */
    KEYS: {
      USER_PROGRESS: 'user_progress',
      USER_PROFILE: 'user_profile',
      CHAPTER_STATES: 'chapter_states',
      EXERCISE_HISTORY: 'exercise_history',
      PORTFOLIO_DATA: 'portfolio_data',
      LAST_VISIT: 'last_visit'
    },
    
    /**
     * Durée de conservation cache (jours)
     */
    CACHE_EXPIRATION_DAYS: 30
  },
  
  // ═══════════════════════════════════════════════════════════
  // 🔐 SECURITY - Admin & Auth
  // ═══════════════════════════════════════════════════════════
  SECURITY: {
    /**
     * Mot de passe admin par défaut
     * ⚠️ À CHANGER EN PRODUCTION!
     */
    ADMIN_PASSWORD: '1234',
    
    /**
     * Durée de session admin (minutes)
     */
    ADMIN_SESSION_DURATION: 60,
    
    /**
     * Nombre max tentatives login avant blocage
     */
    MAX_LOGIN_ATTEMPTS: 3
  },
  
  // ═══════════════════════════════════════════════════════════
  // 🌐 API - Endpoints & Modes
  // ═══════════════════════════════════════════════════════════
  API: {
    /**
     * URL de base pour API (mode serveur)
     */
    BASE_URL: 'http://localhost:3000',
    
    /**
     * Endpoints disponibles
     */
    ENDPOINTS: {
      CHAPTERS: '/api/chapitres',
      PROGRESS: '/api/progress',
      PORTFOLIO: '/api/portfolio'
    },
    
    /**
     * Mode local détecté automatiquement
     */
    IS_LOCAL_MODE: typeof window !== 'undefined' && window.location.protocol === 'file:'
  },
  
  // ═══════════════════════════════════════════════════════════
  // 📝 LOGGING - Debug & Production
  // ═══════════════════════════════════════════════════════════
  LOGGING: {
    /**
     * Activer logs console (dev: true, prod: false)
     */
    ENABLED: true,
    
    /**
     * Niveau de log minimum (debug|info|warn|error)
     */
    LEVEL: 'debug',
    
    /**
     * Préfixe pour messages de log
     */
    PREFIX: '[LMS]'
  },
  
  // ═══════════════════════════════════════════════════════════
  // 📚 CONTENT - Chapters & Steps
  // ═══════════════════════════════════════════════════════════
  CONTENT: {
    /**
     * Nombre total de chapitres
     */
    TOTAL_CHAPTERS: 7,
    
    /**
     * Nombre total d'étapes (toutes chapitres confondus)
     */
    TOTAL_STEPS: 36,
    
    /**
     * Types d'exercices supportés
     */
    EXERCISE_TYPES: [
      'qcm',
      'text',
      'video',
      'consultation',
      'portfolio',
      'quiz'
    ]
  }
  
};

// ═══════════════════════════════════════════════════════════
// 🔒 PROTECTION: Freeze config pour éviter modifications
// ═══════════════════════════════════════════════════════════
if (typeof Object.freeze === 'function') {
  Object.freeze(AppConfig.VALIDATION);
  Object.freeze(AppConfig.GAMIFICATION);
  Object.freeze(AppConfig.GAMIFICATION.BADGE_THRESHOLDS);
  Object.freeze(AppConfig.TIMING);
  Object.freeze(AppConfig.PROGRESS);
  Object.freeze(AppConfig.UI);
  Object.freeze(AppConfig.STORAGE);
  Object.freeze(AppConfig.STORAGE.KEYS);
  Object.freeze(AppConfig.SECURITY);
  Object.freeze(AppConfig.API);
  Object.freeze(AppConfig.API.ENDPOINTS);
  Object.freeze(AppConfig.LOGGING);
  Object.freeze(AppConfig.CONTENT);
  Object.freeze(AppConfig);
}

// ═══════════════════════════════════════════════════════════
// 📤 EXPORT (Node.js + Browser)
// ═══════════════════════════════════════════════════════════
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppConfig;
}
