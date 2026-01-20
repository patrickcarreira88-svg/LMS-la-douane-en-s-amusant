/**
 * TutoringModule - Welcome Modal for LMS
 * 
 * Description:
 *   - Displays welcome modale on first visit
 *   - Captures user email (optional)
 *   - Sends email to backend via webhook
 *   - Persists state in localStorage
 *   - Graceful error handling + fallback
 * 
 * Usage:
 *   TutoringModule.init({
 *     webhookUrl: 'https://api.example.com/api/tutoring-email'
 *   })
 * 
 * Browser Support:
 *   - Chrome/Edge 60+
 *   - Firefox 55+
 *   - Safari 11+
 *   - Mobile browsers (iOS 11+, Android 5+)
 * 
 * Dependencies: None (Vanilla JS)
 * Size: ~12 KB
 * Performance: <100ms load + <500ms interaction
 */

console.log('[DEBUG] 🟢 tutoring-module.js starting to load...');

const TutoringModule = (() => {
  console.log('[DEBUG] 🔵 IIFE starting...');
  
  // ═══════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════
  
  const CONFIG = {
    // 🔗 URL Webhook - À personnaliser:
    // Option 1: Webhook.site gratuit (aucune config nécessaire)
    //   Créez une URL ici: https://webhook.site
    //   Copiez l'URL unique générée ci-dessous
    // 
    // Option 2: Votre propre serveur
    //   Remplacez par votre URL d'API
    //
    webhookUrl: 'https://webhook.site/YOUR_UNIQUE_ID_HERE',
    
    // Alternativement, utilisez FormSubmit (gratuit)
    // webhookUrl: 'https://formspree.io/f/YOUR_FORM_ID',
    
    storageKey: 'tutoring',
    modalId: 'tutoring-modal',
    debug: true // Set false in production
  };
  
  // ═══════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════
  
  let state = {
    viewed: false,
    email: null,
    emailSent: false,
    viewedAt: null,
    error: null
  };
  
  // ═══════════════════════════════════════════════════════════
  // LOGGING
  // ═══════════════════════════════════════════════════════════
  
  const log = (message, type = 'log') => {
    if (!CONFIG.debug) return;
    const timestamp = new Date().toLocaleTimeString();
    const prefix = '[TutoringModule]';
    console.log(`${timestamp} ${prefix} ${message}`);
  };
  
  const logError = (message, error) => {
    const timestamp = new Date().toLocaleTimeString();
    console.error(`${timestamp} [TutoringModule] ❌ ${message}`, error);
  };
  
  // ═══════════════════════════════════════════════════════════
  // STORAGE
  // ═══════════════════════════════════════════════════════════
  
  const getFromStorage = () => {
    try {
      const stored = localStorage.getItem(CONFIG.storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      logError('Failed to read localStorage', error);
      return null;
    }
  };
  
  const saveToStorage = (data) => {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
      log('Data saved to localStorage');
    } catch (error) {
      logError('Failed to save localStorage', error);
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════
  
  const validateEmail = (email) => {
    if (!email || email.trim() === '') {
      return true; // Empty is OK (optional field)
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };
  
  const showError = (message) => {
    const errorEl = document.querySelector('.tutoring-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
      log(`Error shown: ${message}`);
    }
  };
  
  const hideError = () => {
    const errorEl = document.querySelector('.tutoring-error');
    if (errorEl) {
      errorEl.style.display = 'none';
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // MODAL DISPLAY
  // ═══════════════════════════════════════════════════════════
  
  const getModal = () => {
    return document.getElementById(CONFIG.modalId);
  };
  
  const showModal = () => {
    const modal = getModal();
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
      log('✅ Modal displayed');
    } else {
      log('❌ Modal NOT FOUND - displayError');
    }
  };
  
  const closeModal = () => {
    const modal = getModal();
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
      log('Modal closed');
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // EXERCISE CONTEXT
  // ═══════════════════════════════════════════════════════════
  
  /**
   * 🔍 RÉCUPÈRE LE CONTEXTE DE L'EXERCICE ACTUEL
   * Depuis localStorage ou depuis les données du LMS
   */
  const getExerciseContext = () => {
    try {
      // Option 1: Depuis localStorage (si défini explicitement)
      const savedContext = localStorage.getItem('tutoringExerciseContext');
      if (savedContext) {
        return JSON.parse(savedContext);
      }
      
      // Option 2: Récupérer depuis l'app LMS
      const chapitreId = localStorage.getItem('currentChapitreId') || 'CH0';
      const stepIndex = localStorage.getItem('currentStepIndex') || '1';
      const stepTitle = localStorage.getItem('currentStepTitle') || 'Exercice';
      
      return {
        chapter: `Chapitre ${chapitreId}`,
        step: `Étape ${stepIndex}`,
        exerciseTitle: stepTitle,
        exerciseId: `${chapitreId}_STEP_${stepIndex}`,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      log(`Contexte exercice non disponible: ${error.message}`);
      
      // Fallback par défaut
      return {
        chapter: 'Chapitre inconnu',
        step: 'Étape inconnu',
        exerciseTitle: 'Exercice',
        exerciseId: 'UNKNOWN',
        timestamp: new Date().toISOString()
      };
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // LEARNER DATA
  // ═══════════════════════════════════════════════════════════
  
  /**
   * 👤 RÉCUPÈRE LES DONNÉES DE L'APPRENANT
   * Depuis le profil utilisateur dans localStorage douanelmsv2
   */
  const getLearnerData = () => {
    try {
      // Récupérer les données du profil depuis localStorage
      const userDataStr = localStorage.getItem('douanelmsv2');
      
      if (!userDataStr) {
        log('Données apprenant non trouvées dans localStorage');
        return {
          fullName: 'Apprenant',
          firstName: '',
          lastName: '',
          matricule: '',
          email: ''
        };
      }
      
      const userData = JSON.parse(userDataStr);
      
      // Structure réelle trouvée:
      // userData.user.nom (pas name)
      // userData.user.prenom (pas firstName)
      // userData.user.matricule ✓
      // userData.user.nickname ✓
      // Pas d'email
      
      const fullName = 
        userData.user?.nom || 
        userData.user?.nickname ||
        userData.nom || 
        'Non renseigné';
      
      const firstName = 
        userData.user?.prenom || 
        userData.prenom || 
        'Non renseigné';
      
      const lastName = 
        userData.user?.nom || 
        userData.nom || 
        'Non renseigné';
      
      const matricule = 
        userData.user?.matricule || 
        userData.matricule || 
        'Non renseigné';
      
      const email = 
        userData.user?.email || 
        userData.email || 
        'Non renseigné';
      
      const result = {
        fullName: fullName,
        firstName: firstName,
        lastName: lastName,
        matricule: matricule,
        email: email
      };
      
      log('[TutoringModule] Données apprenant extraites:', result);
      
      return result;
      
    } catch (error) {
      logError('[TutoringModule] Erreur récupération données apprenant:', error);
      
      // Fallback par défaut
      return {
        fullName: 'Apprenant',
        firstName: '',
        lastName: '',
        matricule: '',
        email: ''
      };
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // TUTORING REQUEST HISTORY
  // ═══════════════════════════════════════════════════════════
  
  /**
   * 💾 SAUVEGARDE LA DEMANDE LOCALEMENT
   * Garde historique même si l'email n'est pas envoyé
   */
  const saveTutoringRequest = (formData, exerciseContext) => {
    try {
      const history = JSON.parse(
        localStorage.getItem('tutoringHistory') || '[]'
      );
      
      // Récupérer les données apprenant
      const learnerData = getLearnerData();
      
      const request = {
        id: `tutoring_${Date.now()}`,
        timestamp: new Date().toISOString(),
        formData: formData,
        exerciseContext: exerciseContext,
        learnerData: learnerData,
        status: 'pending'
      };
      
      history.push(request);
      
      // Garder seulement les 50 dernières demandes
      if (history.length > 50) {
        history.shift();
      }
      
      localStorage.setItem('tutoringHistory', JSON.stringify(history));
      log('✅ Demande sauvegardée localement avec données apprenant');
      
    } catch (error) {
      logError('Erreur sauvegarde:', error);
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // EMAIL SUBMISSION
  // ═══════════════════════════════════════════════════════════
  
  const getEmailInput = () => {
    return document.getElementById('tutoring-email');
  };
  
  const getSubmitButton = () => {
    return document.querySelector('.tutoring-btn--primary');
  };
  
  const submitEmail = async () => {
    hideError();
    
    const emailInput = getEmailInput();
    const email = emailInput ? emailInput.value.trim() : '';
    
    log(`Submitting email: ${email || '(empty)'}`);
    
    // Validate
    if (!validateEmail(email)) {
      showError('Format email invalide');
      return;
    }
    
    // Disable button during submission
    const button = getSubmitButton();
    if (button) {
      button.disabled = true;
      button.style.opacity = '0.6';
    }
    
    // Send email (with fallback)
    await sendEmail(email);
    
    // Re-enable button
    if (button) {
      button.disabled = false;
      button.style.opacity = '1';
    }
    
    // Close modale
    closeModal();
  };
  
  // ═══════════════════════════════════════════════════════════
  // EMAIL WITH MAILTO (Opens email client with context)
  // ═══════════════════════════════════════════════════════════
  
  /**
   * 📧 OUVRE EMAIL AVEC RÉFÉRENCES EXERCICE
   * Récupère contexte depuis localStorage
   * Ouvre client email (Outlook, Gmail, etc.)
   */
  const sendEmail = async (email) => {
    try {
      log('[TutoringModule] Ouverture email client...');
      
      // 1️⃣ ADRESSE FORMATEUR
      const TUTORING_EMAIL = 'patrick.carreira@test.test.ch';
      
      // 2️⃣ RÉCUPÉRER CONTEXTE D'EXERCICE
      const exerciseContext = getExerciseContext();
      
      // 3️⃣ RÉCUPÉRER DONNÉES APPRENANT
      const learnerData = getLearnerData();
      
      // 4️⃣ CONSTRUIRE SUJET EMAIL
      const subject = encodeURIComponent(
        `[Tutoring] ${exerciseContext.chapter} - ${exerciseContext.exerciseTitle}`
      );
      
      // 5️⃣ CONSTRUIRE CORPS EMAIL
      const bodyLines = [
        'Bonjour,',
        '',
        '📚 DEMANDE D\'AIDE - TUTORING DOUANE',
        '═══════════════════════════════════',
        '',
        '🔗 RÉFÉRENCES EXERCICE:',
        `   Chapitre: ${exerciseContext.chapter}`,
        `   Étape: ${exerciseContext.step}`,
        `   Exercice: ${exerciseContext.exerciseTitle}`,
        `   ID Ref: ${exerciseContext.exerciseId}`,
        '',
        '👤 DONNÉES APPRENANT:',
        `   Prénom: ${learnerData.firstName || '(non fourni)'}`,
        `   Nom: ${learnerData.lastName || '(non fourni)'}`,
        `   Matricule: ${learnerData.matricule || '(non fourni)'}`,
        `   Email: ${learnerData.email || email || '(non fourni)'}`,
        '',
        '💬 MESSAGE:',
        '   [Veuillez décrire votre question ici]',
        '',
        '───────────────────────────────────',
        'Message généré par LMS Douane v2.0'
      ];
      
      const body = encodeURIComponent(bodyLines.join('\n'));
      
      // 6️⃣ OUVRIR CLIENT EMAIL
      const mailtoLink = `mailto:${TUTORING_EMAIL}?subject=${subject}&body=${body}`;
      window.location.href = mailtoLink;
      
      log('✅ [TutoringModule] Email client ouvert');
      
      // 7️⃣ SAUVEGARDER AUSSI LOCALEMENT
      saveTutoringRequest({ email: email }, exerciseContext);
      
      state.emailSent = true;
      return true;
      
    } catch (error) {
      logError('[TutoringModule] ✗ Erreur email:', error);
      return false;
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════
  
  const checkTutoringViewed = () => {
    const stored = getFromStorage();
    
    if (stored && stored.viewed === true) {
      state = stored;
      log('Tutoring already viewed, hiding modale');
      return true;
    }
    
    log('First visit detected, showing modale');
    return false;
  };
  
  const attachEventListeners = () => {
    // Close button
    const closeBtn = document.querySelector('.tutoring-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }
    
    // Close on overlay click
    const overlay = document.querySelector('.tutoring-overlay');
    if (overlay) {
      overlay.addEventListener('click', closeModal);
    }
    
    // Secondary button (close)
    const secondaryBtn = document.querySelector('.tutoring-btn--secondary');
    if (secondaryBtn) {
      secondaryBtn.addEventListener('click', () => {
        // Still mark as viewed even if close
        state.viewed = true;
        state.viewedAt = new Date().toISOString();
        saveToStorage(state);
        closeModal();
      });
    }
    
    // Primary button (submit)
    const primaryBtn = document.querySelector('.tutoring-btn--primary');
    if (primaryBtn) {
      primaryBtn.addEventListener('click', async () => {
        const emailInput = getEmailInput();
        const email = emailInput ? emailInput.value.trim() : '';
        
        // Mark as viewed + save email
        state.viewed = true;
        state.email = email || null;
        state.viewedAt = new Date().toISOString();
        saveToStorage(state);
        
        // Submit email
        await submitEmail();
      });
    }
    
    // Email input - clear error on focus
    const emailInput = getEmailInput();
    if (emailInput) {
      emailInput.addEventListener('focus', hideError);
      emailInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          submitEmail();
        }
      });
    }
    
    log('Event listeners attached');
  };
  
  const init = (options = {}) => {
    log('Initializing TutoringModule...');
    
    // Merge config
    Object.assign(CONFIG, options);
    log(`Config: webhookUrl=${CONFIG.webhookUrl}`);
    
    // ⭐ TOUJOURS attacher les event listeners (même si déjà vu)
    attachEventListeners();
    
    // Check if already viewed
    if (checkTutoringViewed()) {
      log('Tutoring already viewed, keeping modal hidden');
      return; // Already viewed, don't show modal
    }
    
    // Show modale (first visit only)
    showModal();
    
    log('✅ TutoringModule initialized');
  };
  
  // ═══════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════
  
  return {
    init,
    config: CONFIG,
    state: state,
    getFromStorage,
    saveToStorage,
    showModal,
    closeModal,
    getExerciseContext,
    getLearnerData,
    saveTutoringRequest,
    validateEmail,
    log
  };
  
})();

console.log('[DEBUG] 🟡 IIFE executed, TutoringModule:', typeof TutoringModule, TutoringModule);

// ═══════════════════════════════════════════════════════════
// EXPOSE GLOBALEMENT (IMPORTANT!)
// ═══════════════════════════════════════════════════════════
if (typeof window !== 'undefined') {
  window.TutoringModule = TutoringModule;
  console.log('[DEBUG] 🟠 window.TutoringModule set:', typeof window.TutoringModule);
}

// ═══════════════════════════════════════════════════════════
// GLOBAL FUNCTION - Accessible from anywhere
// ═══════════════════════════════════════════════════════════

/**
 * 🔥 OUVRE LE MODAL TUTORING AVEC CONTEXTE EXERCICE
 * Fonction globale pour ouvrir le modal depuis n'importe où
 */
function openTutoringModal() {
  console.log('[TutoringModule] 🔥 Ouverture modal tutoring...');
  
  if (typeof TutoringModule !== 'undefined') {
    // Sauvegarder le contexte AVANT d'ouvrir
    const context = TutoringModule.getExerciseContext();
    localStorage.setItem('tutoringExerciseContext', JSON.stringify(context));
    console.log('📍 Contexte exercice sauvegardé:', context);
    
    // Afficher le modal
    TutoringModule.showModal();
    console.log('✅ Modal tutoring OUVERT avec contexte');
  } else {
    console.error('❌ TutoringModule non disponible');
  }
}

// Auto-initialize if script loaded at end of body
// Remove if manual initialization preferred
document.addEventListener('DOMContentLoaded', () => {
  // Only auto-init if webhook URL configured
  if (typeof TutoringModule !== 'undefined' && TutoringModule.config.webhookUrl) {
    // Uncomment to auto-init:
    // TutoringModule.init();
  }
});
