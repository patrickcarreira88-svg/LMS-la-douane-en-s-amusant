/**
 * JournalAdvanceUI - UI Module for Advanced Learning Journal
 * 
 * Handles DOM rendering, event management, and user interactions
 * Works in conjunction with JournalAvance module
 * 
 * Usage:
 * JournalAdvanceUI.init();
 * JournalAdvanceUI.switchToAdvancedMode();
 */

const JournalAdvanceUI = (() => {
  
  const CONFIG = {
    debug: true,
    formatterEmail: 'patrick.carreira@test.test.ch'
  };
  
  let state = {
    currentMode: 'simple', // 'simple' or 'advanced'
    selectedVerbs: {
      section1: null,
      section2: null,
      section3: null
    },
    initialized: false
  };
  
  const log = (message, data = null) => {
    if (CONFIG.debug) {
      console.log(`[JournalAdvanceUI] ${message}`, data || '');
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════
  
  const init = () => {
    try {
      log('Initializing JournalAdvanceUI...');
      
      // Note: attachAdvancedEventListeners is called in renderAdvancedJournal()
      
      state.initialized = true;
      log('✅ JournalAdvanceUI initialized');
      
    } catch (error) {
      console.error('[JournalAdvanceUI] Initialization failed:', error);
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // RENDER ADVANCED JOURNAL
  // ═══════════════════════════════════════════════════════════
  
  const renderAdvancedJournal = () => {
    // Find the advanced content container
    let container = document.getElementById('journal-advanced-content');
    
    if (!container) {
      log('⚠️ journal-advanced-content not found in DOM');
      return;
    }
    
    const bloomVerbs = JournalAvance.getBloomVerbs();
    
    
    container.innerHTML = `
      <div class="journal-advanced">
        
        <!-- ENTRY FORM -->
        <div class="journal-entry-form">
          <h3>✍️ Nouvelle Entrée</h3>
          
          <!-- Section 1 -->
          <div class="journal-section">
            <div class="section-header">
              <h4>1️⃣ ${bloomVerbs.section1.title}</h4>
              <p class="section-description">${bloomVerbs.section1.description}</p>
            </div>
            
            <textarea 
              id="section1-text" 
              class="journal-textarea" 
              placeholder="Écrivez votre réponse ici..."
              rows="4"
            ></textarea>
            
            <div class="bloom-verbs-section">
              <label class="bloom-label">Sélectionnez le niveau approprié:</label>
              <div id="section1-verbs" class="bloom-verbs-container">
                ${renderVerbButtons(bloomVerbs.section1.levels, 'section1')}
              </div>
            </div>
            
            <div id="section1-suggestion" class="bloom-suggestion"></div>
          </div>
          
          <!-- Section 2 -->
          <div class="journal-section">
            <div class="section-header">
              <h4>2️⃣ ${bloomVerbs.section2.title}</h4>
              <p class="section-description">${bloomVerbs.section2.description}</p>
            </div>
            
            <textarea 
              id="section2-text" 
              class="journal-textarea" 
              placeholder="Écrivez votre réponse ici..."
              rows="4"
            ></textarea>
            
            <div class="bloom-verbs-section">
              <label class="bloom-label">Sélectionnez le niveau approprié:</label>
              <div id="section2-verbs" class="bloom-verbs-container">
                ${renderVerbButtons(bloomVerbs.section2.levels, 'section2')}
              </div>
            </div>
            
            <div id="section2-suggestion" class="bloom-suggestion"></div>
          </div>
          
          <!-- Section 3 -->
          <div class="journal-section">
            <div class="section-header">
              <h4>3️⃣ ${bloomVerbs.section3.title}</h4>
              <p class="section-description">${bloomVerbs.section3.description}</p>
            </div>
            
            <textarea 
              id="section3-text" 
              class="journal-textarea" 
              placeholder="Écrivez votre réponse ici..."
              rows="4"
            ></textarea>
            
            <div class="bloom-verbs-section">
              <label class="bloom-label">Sélectionnez le niveau approprié:</label>
              <div id="section3-verbs" class="bloom-verbs-container">
                ${renderVerbButtons(bloomVerbs.section3.levels, 'section3')}
              </div>
            </div>
            
            <div id="section3-suggestion" class="bloom-suggestion"></div>
          </div>
          
          <!-- Link to chapter (optional) -->
          <div class="journal-section">
            <label class="checkbox-label">
              <input 
                type="checkbox" 
                id="link-chapter-checkbox"
                class="journal-checkbox"
              />
              <span>Lier cette entrée au chapitre courant</span>
            </label>
            <div id="current-chapter-info" class="chapter-info" style="display: none;"></div>
          </div>
          
          <!-- Action buttons -->
          <div class="journal-actions">
            <button id="save-entry-btn" class="btn btn-primary">
              💾 Enregistrer l'entrée
            </button>
            <button id="export-pdf-btn" class="btn btn-secondary">
              📄 Exporter en PDF
            </button>
            <button id="send-email-btn" class="btn btn-secondary">
              📧 Envoyer au formateur
            </button>
          </div>
        </div>
        
        <!-- HISTORY -->
        <div class="journal-history">
          <h3>📚 Historique (${JournalAvance.getHistory().length} entrées)</h3>
          <div id="journal-entries-list" class="journal-entries-list">
            ${renderHistory()}
          </div>
        </div>
      </div>
    `;
    
    attachAdvancedEventListeners();
    log('Advanced journal rendered');
  };
  
  // ═══════════════════════════════════════════════════════════
  // RENDER HELPER FUNCTIONS
  // ═══════════════════════════════════════════════════════════
  
  const renderVerbButtons = (levels, sectionId) => {
    let html = '';
    
    Object.entries(levels).forEach(([levelKey, levelData]) => {
      html += `
        <div class="bloom-level-group">
          <div class="bloom-level-label">${levelData.label}</div>
          <div class="verb-buttons-group">
      `;
      
      levelData.verbs.forEach(verb => {
        html += `
          <button 
            class="verb-btn" 
            data-section="${sectionId}" 
            data-level="${levelKey}" 
            data-verb="${verb}"
          >
            ${verb}
          </button>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    });
    
    return html;
  };
  
  const renderHistory = () => {
    const entries = JournalAvance.getHistory();
    
    if (entries.length === 0) {
      return '<p class="empty-state">Aucune entrée pour le moment. Créez votre première entrée ci-dessus ! 🚀</p>';
    }
    
    return entries.map((entry, index) => {
      const date = new Date(entry.timestamp).toLocaleString('fr-FR');
      
      return `
        <div class="journal-entry-card" data-entry-id="${entry.id}">
          <div class="entry-header">
            <div class="entry-date">📅 ${date}</div>
            <button class="btn-delete-entry" data-entry-id="${entry.id}" title="Supprimer">🗑️</button>
          </div>
          
          <div class="entry-content">
            <div class="entry-section">
              <div class="section-title">1️⃣ Qu'ai-je appris ?</div>
              <div class="verb-badge">${entry.section1.verb} <span class="bloom-tag">${entry.section1.bloomLevel}</span></div>
              <p>${escapeHtml(entry.section1.text)}</p>
            </div>
            
            <div class="entry-section">
              <div class="section-title">2️⃣ Comment l'appliquer ?</div>
              <div class="verb-badge">${entry.section2.verb} <span class="bloom-tag">${entry.section2.bloomLevel}</span></div>
              <p>${escapeHtml(entry.section2.text)}</p>
            </div>
            
            <div class="entry-section">
              <div class="section-title">3️⃣ Quel impact personnel ?</div>
              <div class="verb-badge">${entry.section3.verb} <span class="bloom-tag">${entry.section3.bloomLevel}</span></div>
              <p>${escapeHtml(entry.section3.text)}</p>
            </div>
            
            ${entry.linkedChapter ? `<div class="linked-chapter">📌 Lié au chapitre: ${entry.linkedChapter}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  };
  
  // ═══════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════
  
  const attachAdvancedEventListeners = () => {
    // Verb button clicks
    document.querySelectorAll('.verb-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        selectVerb(btn);
      });
    });
    
    // Save entry
    const saveBtn = document.getElementById('save-entry-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveEntry);
    }
    
    // Export PDF
    const exportBtn = document.getElementById('export-pdf-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportPDF);
    }
    
    // Send email
    const emailBtn = document.getElementById('send-email-btn');
    if (emailBtn) {
      emailBtn.addEventListener('click', showEmailModal);
    }
    
    // Delete entry
    document.querySelectorAll('.btn-delete-entry').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const entryId = btn.dataset.entryId;
        deleteEntry(entryId);
      });
    });
    
    // Link to chapter checkbox
    const linkCheckbox = document.getElementById('link-chapter-checkbox');
    if (linkCheckbox) {
      linkCheckbox.addEventListener('change', (e) => {
        updateChapterInfo(e.target.checked);
      });
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // VERB SELECTION
  // ═══════════════════════════════════════════════════════════
  
  const selectVerb = (button) => {
    const sectionId = button.dataset.section;
    const level = button.dataset.level;
    const verb = button.dataset.verb;
    
    // Deselect other verbs in the same section
    const sectionContainer = document.getElementById(`${sectionId}-verbs`);
    if (sectionContainer) {
      sectionContainer.querySelectorAll('.verb-btn').forEach(btn => {
        btn.classList.remove('selected');
      });
    }
    
    // Select this verb
    button.classList.add('selected');
    
    // Store selection
    state.selectedVerbs[sectionId] = {
      level: level,
      verb: verb
    };
    
    // INSERT VERB INTO TEXTAREA
    const textareaId = `${sectionId}-text`;
    const textarea = document.getElementById(textareaId);
    
    if (textarea) {
      const cursorPos = textarea.selectionStart;
      const textBefore = textarea.value.substring(0, cursorPos);
      const textAfter = textarea.value.substring(cursorPos);
      
      // Insert verb with space
      const newText = textBefore + verb + ' ' + textAfter;
      textarea.value = newText;
      
      // Move cursor after inserted verb
      textarea.selectionStart = textarea.selectionEnd = cursorPos + verb.length + 1;
      textarea.focus();
      
      log(`Verb inserted into ${sectionId}: ${verb}`);
    }
    
    // Show suggestion
    showSuggestion(sectionId, level);
    
    log(`Verb selected: ${sectionId} -> ${verb} (${level})`);
  };
  
  const showSuggestion = (sectionId, bloomLevel) => {
    const suggestion = JournalAvance.getSuggestion(bloomLevel);
    const suggestionDiv = document.getElementById(`${sectionId}-suggestion`);
    
    if (suggestionDiv) {
      suggestionDiv.textContent = suggestion;
      suggestionDiv.style.display = 'block';
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // ENTRY MANAGEMENT
  // ═══════════════════════════════════════════════════════════
  
  const saveEntry = () => {
    try {
      // Get values
      const section1Text = document.getElementById('section1-text').value;
      const section2Text = document.getElementById('section2-text').value;
      const section3Text = document.getElementById('section3-text').value;
      
      // Check if all sections have selected verbs
      if (!state.selectedVerbs.section1 || !state.selectedVerbs.section2 || !state.selectedVerbs.section3) {
        alert('❌ Veuillez sélectionner un verbe pour chaque section.');
        return;
      }
      
      // Check chapter link
      const linkCheckbox = document.getElementById('link-chapter-checkbox');
      const linkedChapter = linkCheckbox && linkCheckbox.checked ? 
        localStorage.getItem('currentChapitreId') || null : null;
      
      // Build entry data
      const entry = {
        section1: {
          bloomLevel: state.selectedVerbs.section1.level,
          verb: state.selectedVerbs.section1.verb,
          text: section1Text
        },
        section2: {
          bloomLevel: state.selectedVerbs.section2.level,
          verb: state.selectedVerbs.section2.verb,
          text: section2Text
        },
        section3: {
          bloomLevel: state.selectedVerbs.section3.level,
          verb: state.selectedVerbs.section3.verb,
          text: section3Text
        }
      };
      
      // Add to journal
      JournalAvance.addEntry(entry.section1, entry.section2, entry.section3, linkedChapter);
      
      // Show confirmation
      alert('✅ Entrée enregistrée avec succès !');
      
      // Clear form
      clearForm();
      
      // Refresh history
      renderAdvancedJournal();
      
    } catch (error) {
      console.error('Error saving entry:', error);
      alert(`❌ Erreur lors de l'enregistrement: ${error.message}`);
    }
  };
  
  const deleteEntry = (entryId) => {
    if (confirm('⚠️ Êtes-vous sûr de vouloir supprimer cette entrée ? Cette action est irréversible.')) {
      const success = JournalAvance.deleteEntry(entryId);
      
      if (success) {
        alert('✅ Entrée supprimée.');
        renderAdvancedJournal();
      } else {
        alert('❌ Erreur lors de la suppression.');
      }
    }
  };
  
  const clearForm = () => {
    document.getElementById('section1-text').value = '';
    document.getElementById('section2-text').value = '';
    document.getElementById('section3-text').value = '';
    
    document.querySelectorAll('.verb-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelectorAll('.bloom-suggestion').forEach(div => div.style.display = 'none');
    
    state.selectedVerbs = {
      section1: null,
      section2: null,
      section3: null
    };
  };
  
  // ═══════════════════════════════════════════════════════════
  // CHAPTER LINKING
  // ═══════════════════════════════════════════════════════════
  
  const updateChapterInfo = (isChecked) => {
    const infoDiv = document.getElementById('current-chapter-info');
    if (!infoDiv) return;
    
    if (isChecked) {
      const chapterId = localStorage.getItem('currentChapitreId');
      const chapterTitle = localStorage.getItem('currentChapterTitle') || chapterId || 'Chapitre courant';
      
      infoDiv.innerHTML = `✅ Cette entrée sera liée à: <strong>${chapterTitle}</strong>`;
      infoDiv.style.display = 'block';
    } else {
      infoDiv.style.display = 'none';
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // PDF EXPORT
  // ═══════════════════════════════════════════════════════════
  
  const exportPDF = () => {
    try {
      const doc = JournalAvance.generatePDF();
      const filename = `Journal_Apprentissage_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);
      
      alert(`✅ PDF téléchargé: ${filename}`);
    } catch (error) {
      console.error('PDF export error:', error);
      alert(`❌ Erreur lors de la génération du PDF: ${error.message}`);
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // EMAIL MODAL
  // ═══════════════════════════════════════════════════════════
  
  const showEmailModal = () => {
    const modal = document.createElement('div');
    modal.id = 'email-modal';
    modal.className = 'email-modal';
    modal.innerHTML = `
      <div class="email-modal-content">
        <div class="email-modal-header">
          <h3>📧 Envoyer au formateur</h3>
          <button class="close-btn" data-close-modal>✕</button>
        </div>
        
        <div class="email-modal-body">
          <label>Message personnel (optionnel):</label>
          <textarea 
            id="email-message" 
            class="email-textarea" 
            placeholder="Ajoutez un message personnel..."
            rows="5"
          ></textarea>
        </div>
        
        <div class="email-modal-footer">
          <button class="btn btn-secondary" data-cancel-email>Annuler</button>
          <button class="btn btn-primary" data-send-email>Envoyer par email</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Attach event listeners
    modal.querySelector('[data-close-modal]').addEventListener('click', () => {
      modal.remove();
    });
    
    modal.querySelector('[data-cancel-email]').addEventListener('click', () => {
      modal.remove();
    });
    
    modal.querySelector('[data-send-email]').addEventListener('click', () => {
      const message = document.getElementById('email-message').value;
      sendEmail(message);
      modal.remove();
    });
  };
  
  const sendEmail = (personalMessage = '') => {
    try {
      // Generate PDF first (may be fallback HTML)
      const doc = JournalAvance.generatePDF();
      
      // Try to get PDF data if available
      let pdfData = null;
      try {
        pdfData = doc.output('dataurlstring');
      } catch (e) {
        // Fallback doesn't support dataurlstring, that's ok
        log('Note: PDF data URI not available, will open print dialog');
      }
      
      // Log that they're sending
      log('Sending email to formateur...');
      
      // Open email client
      JournalAvance.sendEmail(personalMessage);
      
      alert(`✅ Votre client email s'ouvre avec le contenu pré-rempli.\n\nℹ️ Astuce: Vous pouvez cliquer "Enregistrer en tant que PDF" dans le dialogue d'impression pour créer le PDF à joindre.`);
      
    } catch (error) {
      console.error('Email send error:', error);
      alert(`❌ Erreur lors de l'envoi: ${error.message}`);
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════
  
  const escapeHtml = (text) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  };
  
  // ═══════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════
  
  return {
    init,
    renderAdvancedJournal,
    log,
    state: () => state
  };
  
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof JournalAdvanceUI !== 'undefined') {
      JournalAdvanceUI.init();
    }
  });
} else {
  if (typeof JournalAdvanceUI !== 'undefined') {
    JournalAdvanceUI.init();
  }
}
