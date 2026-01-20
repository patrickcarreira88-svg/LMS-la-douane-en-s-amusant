/**
 * 📝 LOGGER.JS - Système de logging conditionnel LMS Douane
 * 
 * Wrapper pour console.* avec activation/désactivation selon environnement
 * Évite la pollution console en production
 * 
 * @version 2.0
 * @date 2025
 */

const Logger = (function() {
  
  // ═══════════════════════════════════════════════════════════
  // ⚙️ CONFIGURATION
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Récupère la config depuis AppConfig (si disponible)
   * Sinon fallback sur valeurs par défaut
   */
  const config = typeof AppConfig !== 'undefined' && AppConfig.LOGGING 
    ? AppConfig.LOGGING 
    : {
        ENABLED: true,      // Activé par défaut
        LEVEL: 'debug',     // Niveau minimum: debug, info, warn, error
        PREFIX: '[LMS]'     // Préfixe pour tous les messages
      };
  
  // Niveaux de priorité (pour filtrage)
  const LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    none: 999  // Désactiver complètement
  };
  
  // Niveau minimum configuré
  const minLevel = LEVELS[config.LEVEL] || 0;
  
  // ═══════════════════════════════════════════════════════════
  // 🎨 STYLES CONSOLE (pour meilleure lisibilité)
  // ═══════════════════════════════════════════════════════════
  
  const styles = {
    debug: 'color: #888; font-weight: normal;',
    info: 'color: #0066cc; font-weight: bold;',
    warn: 'color: #ff8c00; font-weight: bold;',
    error: 'color: #cc0000; font-weight: bold;',
    success: 'color: #00aa00; font-weight: bold;'
  };
  
  // ═══════════════════════════════════════════════════════════
  // 🔧 FONCTIONS PRIVÉES
  // ═══════════════════════════════════════════════════════════
  
  /**
   * Formatte le message avec timestamp et préfixe
   */
  function formatMessage(level, ...args) {
    const timestamp = new Date().toLocaleTimeString('fr-FR');
    const prefix = `${config.PREFIX} [${level.toUpperCase()}] ${timestamp}`;
    return [prefix, ...args];
  }
  
  /**
   * Vérifie si le niveau de log doit être affiché
   */
  function shouldLog(level) {
    if (!config.ENABLED) return false;
    return LEVELS[level] >= minLevel;
  }
  
  // ═══════════════════════════════════════════════════════════
  // 📤 API PUBLIQUE
  // ═══════════════════════════════════════════════════════════
  
  return {
    
    /**
     * 🐛 DEBUG - Messages de débogage détaillés
     * Usage: Logger.debug('Message', data)
     */
    debug(...args) {
      if (!shouldLog('debug')) return;
      console.log(...formatMessage('debug', ...args));
    },
    
    /**
     * ℹ️ INFO - Informations générales
     * Usage: Logger.info('Utilisateur connecté', user)
     */
    info(...args) {
      if (!shouldLog('info')) return;
      console.log(...formatMessage('info', ...args));
    },
    
    /**
     * ⚠️ WARN - Avertissements (non-bloquants)
     * Usage: Logger.warn('Donnée manquante', field)
     */
    warn(...args) {
      if (!shouldLog('warn')) return;
      console.warn(...formatMessage('warn', ...args));
    },
    
    /**
     * ❌ ERROR - Erreurs critiques
     * Usage: Logger.error('Validation échouée', error)
     */
    error(...args) {
      if (!shouldLog('error')) return;
      console.error(...formatMessage('error', ...args));
    },
    
    /**
     * ✅ SUCCESS - Messages de succès
     * Usage: Logger.success('Exercice validé', score)
     */
    success(...args) {
      if (!shouldLog('info')) return;
      console.log(...formatMessage('success', ...args));
    },
    
    /**
     * 📊 TABLE - Affiche un tableau de données
     * Usage: Logger.table(users)
     */
    table(data, label = '') {
      if (!shouldLog('debug')) return;
      if (label) console.log(formatMessage('debug', label)[0]);
      console.table(data);
    },
    
    /**
     * 👥 GROUP - Groupe de messages liés
     * Usage: 
     *   Logger.group('Validation');
     *   Logger.info('Score: 80%');
     *   Logger.groupEnd();
     */
    group(label) {
      if (!shouldLog('debug')) return;
      console.group(formatMessage('debug', label)[0]);
    },
    
    groupEnd() {
      if (!shouldLog('debug')) return;
      console.groupEnd();
    },
    
    /**
     * 📋 GROUP COLLAPSED - Groupe replié par défaut
     */
    groupCollapsed(label) {
      if (!shouldLog('debug')) return;
      console.groupCollapsed(formatMessage('debug', label)[0]);
    },
    
    /**
     * ⏱️ TIME - Mesure de performance
     * Usage:
     *   Logger.time('LoadChapter');
     *   // ... code ...
     *   Logger.timeEnd('LoadChapter'); // → "LoadChapter: 245ms"
     */
    time(label) {
      if (!shouldLog('debug')) return;
      console.time(`${config.PREFIX} ${label}`);
    },
    
    timeEnd(label) {
      if (!shouldLog('debug')) return;
      console.timeEnd(`${config.PREFIX} ${label}`);
    },
    
    /**
     * 🔍 TRACE - Stack trace complet
     * Usage: Logger.trace('Point de passage')
     */
    trace(...args) {
      if (!shouldLog('debug')) return;
      console.trace(...formatMessage('debug', ...args));
    },
    
    /**
     * 🎯 ASSERT - Assertion conditionnelle
     * Usage: Logger.assert(score >= 0, 'Score négatif!', score)
     */
    assert(condition, ...args) {
      if (!shouldLog('error')) return;
      if (!condition) {
        console.error(...formatMessage('error', 'ASSERTION FAILED:', ...args));
      }
    },
    
    /**
     * 🔧 UTILITIES - Fonctions utilitaires
     */
    
    /**
     * Active/désactive le logging globalement
     * Usage: Logger.setEnabled(false) // Désactive tous les logs
     */
    setEnabled(enabled) {
      config.ENABLED = !!enabled;
      this.info(`Logging ${enabled ? 'activé' : 'désactivé'}`);
    },
    
    /**
     * Change le niveau minimum de log
     * Usage: Logger.setLevel('error') // Affiche uniquement erreurs
     */
    setLevel(level) {
      if (!LEVELS.hasOwnProperty(level)) {
        this.warn(`Niveau invalide: ${level}. Utilisez: debug, info, warn, error, none`);
        return;
      }
      config.LEVEL = level;
      this.info(`Niveau de log: ${level}`);
    },
    
    /**
     * Vérifie si le logging est activé
     */
    isEnabled() {
      return config.ENABLED;
    },
    
    /**
     * Retourne le niveau actuel
     */
    getLevel() {
      return config.LEVEL;
    },
    
    /**
     * Efface la console
     * Usage: Logger.clear()
     */
    clear() {
      if (!config.ENABLED) return;
      console.clear();
      this.info('Console cleared');
    },
    
    /**
     * 🎨 STYLED - Log avec style custom
     * Usage: Logger.styled('Hello', 'color: red; font-size: 20px;')
     */
    styled(message, style) {
      if (!shouldLog('info')) return;
      console.log(`%c${message}`, style);
    },
    
    /**
     * 📦 JSON - Affiche objet JSON formaté
     * Usage: Logger.json(user)
     */
    json(obj, label = '') {
      if (!shouldLog('debug')) return;
      if (label) this.debug(label);
      console.log(JSON.stringify(obj, null, 2));
    },
    
    /**
     * 🎯 CONTEXT - Log avec contexte métier
     * Usage: Logger.context('VALIDATION', 'Étape validée', {score: 80})
     */
    context(context, ...args) {
      if (!shouldLog('info')) return;
      console.log(`${config.PREFIX} [${context}]`, ...args);
    }
    
  };
  
})();

// ═══════════════════════════════════════════════════════════
// 📤 EXPORT (Node.js + Browser)
// ═══════════════════════════════════════════════════════════
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Logger;
}

// ═══════════════════════════════════════════════════════════
// 💡 EXEMPLES D'UTILISATION
// ═══════════════════════════════════════════════════════════

/*

// 1. LOGS BASIQUES
Logger.debug('Détails de debug', { id: 123 });
Logger.info('Utilisateur connecté', user);
Logger.warn('Donnée manquante', field);
Logger.error('Validation échouée', error);
Logger.success('Exercice validé!', score);

// 2. GROUPES
Logger.group('Validation Exercice');
Logger.info('Score: 80%');
Logger.info('Tentatives: 2/3');
Logger.groupEnd();

// 3. PERFORMANCE
Logger.time('LoadChapter');
// ... code long ...
Logger.timeEnd('LoadChapter'); // → "LoadChapter: 245ms"

// 4. TABLEAUX
Logger.table(users, 'Liste utilisateurs');

// 5. CONTEXT MÉTIER
Logger.context('QCM', 'Question validée', { questionId: 5 });
Logger.context('PORTFOLIO', 'Swipe detected', { direction: 'right' });

// 6. PRODUCTION MODE
Logger.setLevel('error');  // Désactive debug/info/warn
Logger.setEnabled(false);  // Désactive TOUS les logs

// 7. STYLED LOGS
Logger.styled('🎉 Niveau complété!', 'color: gold; font-size: 24px; font-weight: bold;');

// 8. JSON
Logger.json(chapitreData, 'Chapitre chargé:');

*/
