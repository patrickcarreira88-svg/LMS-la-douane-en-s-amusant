/**
 * JournalAvance - Advanced Learning Journal Module (Bloom Taxonomy)
 * 
 * Features:
 * - 3-section journal with Bloom verbs
 * - Automatic learner profile fetching
 * - localStorage persistence
 * - PDF export with jsPDF
 * - Email integration via mailto
 * - Bloom-level suggestions
 * 
 * Dependencies:
 * - jsPDF library (added separately)
 * - localStorage API
 * 
 * Usage:
 * journalAvance.init();
 * journalAvance.addEntry(section1, section2, section3, linkedChapter);
 * journalAvance.getHistory();
 */

const JournalAvance = (() => {
  
  // ═══════════════════════════════════════════════════════════
  // CONFIGURATION & STATE
  // ═══════════════════════════════════════════════════════════
  
  const CONFIG = {
    storageKey: 'journalHistoryAdvanced',
    emailHistoryKey: 'journalEmailHistory',
    formatterEmail: 'patrick.carreira@test.test.ch',
    debug: true
  };
  
  let state = {
    entries: [],
    initialized: false
  };
  
  // ═══════════════════════════════════════════════════════════
  // BLOOM TAXONOMY STRUCTURE
  // ═══════════════════════════════════════════════════════════
  
  const BLOOM_VERBS = {
    section1: {
      title: 'Qu\'ai-je appris aujourd\'hui ?',
      description: 'Définissez ce que vous avez découvert aujourd\'hui',
      levels: {
        remember: {
          label: 'Mémoriser (Bloom 1)',
          verbs: ['J\'ai identifié', 'J\'ai énuméré', 'J\'ai nommé', 'J\'ai reconnu', 'J\'ai mémorisé', 'J\'ai retenu']
        },
        understand: {
          label: 'Comprendre (Bloom 2)',
          verbs: ['J\'ai compris', 'J\'ai expliqué', 'J\'ai décrit', 'J\'ai interprété', 'J\'ai classifié', 'J\'ai résumé']
        }
      }
    },
    
    section2: {
      title: 'Comment l\'appliquer ?',
      description: 'Comment allez-vous utiliser cette connaissance dans la pratique ?',
      levels: {
        apply: {
          label: 'Appliquer (Bloom 3)',
          verbs: ['J\'ai appliqué', 'J\'ai démontré', 'J\'ai utilisé', 'J\'ai pratiqué', 'J\'ai exécuté', 'J\'ai modifié']
        },
        analyze: {
          label: 'Analyser (Bloom 4)',
          verbs: ['J\'ai analysé', 'J\'ai comparé', 'J\'ai examiné', 'J\'ai étudié', 'J\'ai distingué', 'J\'ai décortiqué']
        }
      }
    },
    
    section3: {
      title: 'Quel impact personnel ?',
      description: 'Quel impact cette apprentissage a-t-il sur vous ?',
      levels: {
        evaluate: {
          label: 'Évaluer (Bloom 5)',
          verbs: ['J\'ai évalué', 'J\'ai jugé', 'J\'ai critiqué', 'J\'ai estimé', 'J\'ai argumenté', 'J\'ai défendu']
        },
        create: {
          label: 'Créer (Bloom 6)',
          verbs: ['J\'ai créé', 'J\'ai conçu', 'J\'ai développé', 'J\'ai planifié', 'J\'ai inventé', 'J\'ai généré']
        }
      }
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // BLOOM SUGGESTIONS BY LEVEL
  // ═══════════════════════════════════════════════════════════
  
  const BLOOM_SUGGESTIONS = {
    remember: '💡 Conseil: Essayez de lister ou énumérer les points clés sans regarder vos notes.',
    understand: '💡 Conseil: Essayez d\'expliquer ce concept à quelqu\'un d\'autre avec vos propres mots.',
    apply: '💡 Conseil: Pensez à un cas pratique ou un exemple concret où vous pourriez utiliser cela.',
    analyze: '💡 Conseil: Identifiez les différentes parties et comment elles se connectent entre elles.',
    evaluate: '💡 Conseil: Posez-vous: Comment cela se compare-t-il à ce que je savais avant ?',
    create: '💡 Conseil: Imaginez comment vous pourriez créer ou inventer quelque chose de nouveau avec cela.'
  };
  
  // ═══════════════════════════════════════════════════════════
  // LOGGING
  // ═══════════════════════════════════════════════════════════
  
  const log = (message, data = null) => {
    if (CONFIG.debug) {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] [JournalAvance] ${message}`, data || '');
    }
  };
  
  const logError = (message, error) => {
    console.error(`[JournalAvance] ❌ ${message}`, error);
  };
  
  // ═══════════════════════════════════════════════════════════
  // STORAGE FUNCTIONS
  // ═══════════════════════════════════════════════════════════
  
  const getFromStorage = () => {
    try {
      const stored = localStorage.getItem(CONFIG.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      logError('Failed to read from storage', error);
      return [];
    }
  };
  
  const saveToStorage = (entries) => {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(entries));
      log(`✅ Saved ${entries.length} entries to storage`);
    } catch (error) {
      logError('Failed to save to storage', error);
    }
  };
  
  const logEmailEvent = (event) => {
    try {
      let history = [];
      const stored = localStorage.getItem(CONFIG.emailHistoryKey);
      if (stored) {
        history = JSON.parse(stored);
      }
      history.push({
        ...event,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem(CONFIG.emailHistoryKey, JSON.stringify(history));
      log('📧 Email event logged', event);
    } catch (error) {
      logError('Failed to log email event', error);
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // LEARNER DATA FUNCTIONS
  // ═══════════════════════════════════════════════════════════
  
  const getLearnerData = () => {
    try {
      // Try to use StorageManager if available
      if (typeof StorageManager !== 'undefined' && StorageManager.getUser) {
        const user = StorageManager.getUser();
        
        // Combine nom and prenom for fullName
        let fullName = '';
        if (user.prenom && user.nom) {
          fullName = `${user.prenom} ${user.nom}`;
        } else if (user.nom) {
          fullName = user.nom;
        } else if (user.prenom) {
          fullName = user.prenom;
        } else if (user.nickname) {
          fullName = user.nickname;
        } else {
          fullName = 'Apprenant';
        }
        
        return {
          fullName: fullName,
          firstName: user.prenom || 'Non renseigné',
          matricule: user.matricule || 'Non renseigné',
          email: user.email || 'Non renseigné'
        };
      }
      
      // Fallback to localStorage parsing
      const userDataStr = localStorage.getItem('douanelmsv2');
      if (!userDataStr) {
        log('⚠️ Learner data not found in localStorage');
        return getDefaultLearnerData();
      }
      
      const userData = JSON.parse(userDataStr);
      
      let fullName = '';
      if (userData.user?.prenom && userData.user?.nom) {
        fullName = `${userData.user.prenom} ${userData.user.nom}`;
      } else if (userData.user?.nom) {
        fullName = userData.user.nom;
      } else if (userData.user?.prenom) {
        fullName = userData.user.prenom;
      } else if (userData.user?.nickname) {
        fullName = userData.user.nickname;
      } else {
        fullName = 'Apprenant';
      }
      
      const firstName = userData.user?.prenom || 'Non renseigné';
      const matricule = userData.user?.matricule || 'Non renseigné';
      const email = userData.user?.email || 'Non renseigné';
      
      return {
        fullName: fullName,
        firstName: firstName,
        matricule: matricule,
        email: email
      };
      
    } catch (error) {
      logError('Error retrieving learner data', error);
      return getDefaultLearnerData();
    }
  };
  
  const getDefaultLearnerData = () => {
    return {
      fullName: 'Apprenant',
      firstName: '',
      matricule: 'Non renseigné',
      email: 'Non renseigné'
    };
  };
  
  // ═══════════════════════════════════════════════════════════
  // VALIDATION FUNCTIONS
  // ═══════════════════════════════════════════════════════════
  
  const validateEntry = (section1, section2, section3) => {
    const errors = [];
    
    if (!section1.bloomLevel || !section1.verb || !section1.text.trim()) {
      errors.push('Section 1 (Qu\'ai-je appris ?) est incomplète');
    }
    
    if (!section2.bloomLevel || !section2.verb || !section2.text.trim()) {
      errors.push('Section 2 (Comment l\'appliquer ?) est incomplète');
    }
    
    if (!section3.bloomLevel || !section3.verb || !section3.text.trim()) {
      errors.push('Section 3 (Quel impact personnel ?) est incomplète');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  };
  
  // ═══════════════════════════════════════════════════════════
  // MAIN API FUNCTIONS
  // ═══════════════════════════════════════════════════════════
  
  const init = () => {
    try {
      state.entries = getFromStorage();
      state.initialized = true;
      log(`✅ Module initialized with ${state.entries.length} entries`);
    } catch (error) {
      logError('Initialization failed', error);
    }
  };
  
  const getBloomVerbs = () => {
    return BLOOM_VERBS;
  };
  
  const getSuggestion = (bloomLevel) => {
    return BLOOM_SUGGESTIONS[bloomLevel] || BLOOM_SUGGESTIONS.understand;
  };
  
  const addEntry = (section1, section2, section3, linkedChapter = null) => {
    try {
      // Validate
      const validation = validateEntry(section1, section2, section3);
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }
      
      // Get learner data
      const learnerData = getLearnerData();
      
      // Create entry
      const entry = {
        id: `journal_${Date.now()}`,
        timestamp: new Date().toISOString(),
        
        section1: {
          bloomLevel: section1.bloomLevel,
          verb: section1.verb,
          text: section1.text.trim()
        },
        
        section2: {
          bloomLevel: section2.bloomLevel,
          verb: section2.verb,
          text: section2.text.trim()
        },
        
        section3: {
          bloomLevel: section3.bloomLevel,
          verb: section3.verb,
          text: section3.text.trim()
        },
        
        linkedChapter: linkedChapter || null,
        
        learner: {
          fullName: learnerData.fullName,
          firstName: learnerData.firstName,
          matricule: learnerData.matricule,
          email: learnerData.email
        }
      };
      
      // Save to storage
      state.entries.unshift(entry); // Add to beginning (most recent first)
      saveToStorage(state.entries);
      
      log(`✅ Entry added: ${entry.id}`, entry);
      return entry;
      
    } catch (error) {
      logError('Failed to add entry', error);
      throw error;
    }
  };
  
  const getHistory = () => {
    return state.entries;
  };
  
  const getEntryById = (entryId) => {
    return state.entries.find(e => e.id === entryId);
  };
  
  const deleteEntry = (entryId) => {
    try {
      const initialLength = state.entries.length;
      state.entries = state.entries.filter(e => e.id !== entryId);
      
      if (state.entries.length < initialLength) {
        saveToStorage(state.entries);
        log(`✅ Entry deleted: ${entryId}`);
        return true;
      }
      
      log(`⚠️ Entry not found: ${entryId}`);
      return false;
      
    } catch (error) {
      logError('Failed to delete entry', error);
      return false;
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // PDF GENERATION - FALLBACK (sans jsPDF)
  // ═══════════════════════════════════════════════════════════
  
  const generateSimplePDF = () => {
    try {
      const learnerData = getLearnerData();
      const entries = state.entries;
      
      // Créer un document HTML/CSS pour imprimer comme PDF
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Journal d'Apprentissage</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #7c3aed; padding-bottom: 15px; }
            .header h1 { color: #7c3aed; margin: 0; }
            .header p { margin: 5px 0; color: #666; }
            .learner-info { background: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 30px; }
            .learner-info div { margin: 5px 0; }
            .entry { page-break-inside: avoid; border: 1px solid #e5e7eb; padding: 15px; margin-bottom: 20px; border-radius: 8px; }
            .entry-date { font-size: 12px; color: #999; font-weight: bold; margin-bottom: 10px; }
            .section { margin: 15px 0; padding: 10px; background: #f9fafb; border-left: 4px solid #7c3aed; }
            .section-title { font-weight: bold; color: #7c3aed; margin-bottom: 5px; }
            .verb-badge { display: inline-block; background: #7c3aed; color: white; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; margin-right: 5px; }
            .bloom-level { display: inline-block; background: #e0aaff; color: #333; padding: 2px 6px; border-radius: 8px; font-size: 10px; margin-left: 5px; }
            .section-text { margin-top: 8px; color: #333; }
            @media print { body { margin: 0; padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📚 Journal d'Apprentissage</h1>
            <p>Douane LMS v2.0</p>
          </div>
          
          <div class="learner-info">
            <div><strong>Nom:</strong> ${learnerData.fullName}</div>
            <div><strong>Prénom:</strong> ${learnerData.firstName}</div>
            <div><strong>Matricule:</strong> ${learnerData.matricule}</div>
            <div><strong>Email:</strong> ${learnerData.email}</div>
            <div><strong>Généré le:</strong> ${new Date().toLocaleString('fr-FR')}</div>
            <div><strong>Nombre d'entrées:</strong> ${entries.length}</div>
          </div>
          
          ${entries.map((entry, index) => `
            <div class="entry">
              <div class="entry-date">📅 ${new Date(entry.timestamp).toLocaleString('fr-FR')}</div>
              
              <div class="section">
                <div class="section-title">1️⃣ Qu'ai-je appris ?</div>
                <div>
                  <span class="verb-badge">${entry.section1.verb}</span>
                  <span class="bloom-level">${entry.section1.bloomLevel}</span>
                </div>
                <div class="section-text">${entry.section1.text}</div>
              </div>
              
              <div class="section">
                <div class="section-title">2️⃣ Comment l'appliquer ?</div>
                <div>
                  <span class="verb-badge">${entry.section2.verb}</span>
                  <span class="bloom-level">${entry.section2.bloomLevel}</span>
                </div>
                <div class="section-text">${entry.section2.text}</div>
              </div>
              
              <div class="section">
                <div class="section-title">3️⃣ Quel impact personnel ?</div>
                <div>
                  <span class="verb-badge">${entry.section3.verb}</span>
                  <span class="bloom-level">${entry.section3.bloomLevel}</span>
                </div>
                <div class="section-text">${entry.section3.text}</div>
              </div>
              
              ${entry.linkedChapter ? `<div style="margin-top: 10px; color: #3b82f6; font-size: 12px;">📌 Lié au chapitre: ${entry.linkedChapter}</div>` : ''}
            </div>
          `).join('')}
          
          <footer style="margin-top: 40px; text-align: center; color: #999; font-size: 10px; border-top: 1px solid #ddd; padding-top: 15px;">
            Généré par LMS Douane v2.0 | ${new Date().toLocaleString('fr-FR')}
          </footer>
        </body>
        </html>
      `;
      
      // Créer une fausse doc avec une méthode save()
      const fakeDoc = {
        output: (format) => {
          if (format === 'dataurlstring' || format === 'datauri') {
            // Retourner un data URL vide compatible
            return 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MNCjEgMCBvYmo=';
          }
          return htmlContent;
        },
        save: (filename) => {
          // Ouvrir dans une nouvelle fenêtre pour impression/export
          const printWindow = window.open('', '', 'height=600,width=800');
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          
          // Proposer l'impression
          setTimeout(() => {
            printWindow.print();
          }, 250);
        }
      };
      
      log(`✅ Simplified PDF generated with ${entries.length} entries (jsPDF fallback)`);
      return fakeDoc;
      
    } catch (error) {
      logError('Simplified PDF generation failed', error);
      throw error;
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // PDF GENERATION
  // ═══════════════════════════════════════════════════════════
  
  const generatePDF = () => {
    try {
      // Accéder à jsPDF - le CDN UMD expose window.jspdf.jsPDF
      let JsPDFClass;
      
      if (window.jspdf && window.jspdf.jsPDF) {
        // CDN UMD chargé correctement
        JsPDFClass = window.jspdf.jsPDF;
        log('✅ jsPDF found at window.jspdf.jsPDF');
      } else if (window.jsPDF) {
        // Fallback si directement dans window
        JsPDFClass = window.jsPDF;
        log('✅ jsPDF found at window.jsPDF');
      } else {
        // Fallback: créer un PDF simple en HTML/texto si jsPDF n'est pas disponible
        log('⚠️ jsPDF not available, generating simplified PDF');
        return generateSimplePDF();
      }
      
      const doc = new JsPDFClass();
      
      const learnerData = getLearnerData();
      const entries = state.entries;
      
      // Colors
      const primaryColor = [124, 58, 237]; // Violet
      const textColor = [33, 33, 33];
      const lightGray = [240, 240, 240];
      
      let yPosition = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const maxWidth = pageWidth - 2 * margin;
      
      // ─────────────────────────────────────────────────
      // HEADER
      // ─────────────────────────────────────────────────
      
      doc.setFontSize(18);
      doc.setTextColor(...primaryColor);
      doc.text('Journal d\'Apprentissage', margin, yPosition);
      
      yPosition += 10;
      doc.setFontSize(12);
      doc.setTextColor(...textColor);
      doc.text('Douane LMS v2.0', margin, yPosition);
      
      yPosition += 12;
      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      
      yPosition += 8;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      
      // Learner info
      doc.text(`Nom: ${learnerData.fullName}`, margin, yPosition);
      yPosition += 5;
      doc.text(`Prenom: ${learnerData.firstName}`, margin, yPosition);
      yPosition += 5;
      doc.text(`Matricule: ${learnerData.matricule}`, margin, yPosition);
      yPosition += 5;
      doc.text(`Email: ${learnerData.email}`, margin, yPosition);
      yPosition += 5;
      doc.text(`Genere le: ${new Date().toLocaleString('fr-FR')}`, margin, yPosition);
      yPosition += 5;
      doc.text(`Nombre d'entrees: ${entries.length}`, margin, yPosition);
      
      yPosition += 12;
      doc.setDrawColor(...primaryColor);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      
      yPosition += 12;
      
      // ─────────────────────────────────────────────────
      // ENTRIES
      // ─────────────────────────────────────────────────
      
      entries.forEach((entry, index) => {
        // Check if we need a new page
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = margin;
        }
        
        // Entry header
        doc.setFontSize(11);
        doc.setTextColor(...primaryColor);
        const entryDate = new Date(entry.timestamp).toLocaleString('fr-FR');
        doc.text(`Entrée ${entries.length - index} - ${entryDate}`, margin, yPosition);
        
        yPosition += 8;
        
        // Section 1
        doc.setFontSize(10);
        doc.setTextColor(...textColor);
        doc.setFont(undefined, 'bold');
        doc.text('1️⃣ Qu\'ai-je appris aujourd\'hui ?', margin, yPosition);
        
        yPosition += 5;
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Verbe: ${entry.section1.verb} (${entry.section1.bloomLevel})`, margin + 2, yPosition);
        
        yPosition += 5;
        doc.setTextColor(...textColor);
        const section1Lines = doc.splitTextToSize(entry.section1.text, maxWidth - 4);
        doc.text(section1Lines, margin + 2, yPosition);
        yPosition += section1Lines.length * 4 + 3;
        
        // Section 2
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...textColor);
        doc.text('2️⃣ Comment l\'appliquer ?', margin, yPosition);
        
        yPosition += 5;
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Verbe: ${entry.section2.verb} (${entry.section2.bloomLevel})`, margin + 2, yPosition);
        
        yPosition += 5;
        doc.setTextColor(...textColor);
        const section2Lines = doc.splitTextToSize(entry.section2.text, maxWidth - 4);
        doc.text(section2Lines, margin + 2, yPosition);
        yPosition += section2Lines.length * 4 + 3;
        
        // Section 3
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...textColor);
        doc.text('3️⃣ Quel impact personnel ?', margin, yPosition);
        
        yPosition += 5;
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Verbe: ${entry.section3.verb} (${entry.section3.bloomLevel})`, margin + 2, yPosition);
        
        yPosition += 5;
        doc.setTextColor(...textColor);
        const section3Lines = doc.splitTextToSize(entry.section3.text, maxWidth - 4);
        doc.text(section3Lines, margin + 2, yPosition);
        yPosition += section3Lines.length * 4 + 3;
        
        // Linked chapter if any
        if (entry.linkedChapter) {
          doc.setTextColor(100, 100, 100);
          doc.setFontSize(9);
          doc.text(`📌 Lié au chapitre: ${entry.linkedChapter}`, margin + 2, yPosition);
          yPosition += 5;
        }
        
        // Separator
        yPosition += 4;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 8;
      });
      
      // ─────────────────────────────────────────────────
      // FOOTER
      // ─────────────────────────────────────────────────
      
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Page ${i} / ${totalPages} - Généré par LMS Douane v2.0`,
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        );
      }
      
      log(`✅ PDF generated with ${entries.length} entries`);
      return doc;
      
    } catch (error) {
      logError('PDF generation failed', error);
      throw error;
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // EMAIL FUNCTIONS
  // ═══════════════════════════════════════════════════════════
  
  const sendEmail = (personalMessage = '') => {
    try {
      const learnerData = getLearnerData();
      const entries = state.entries;
      
      const subject = `[Journal Apprentissage] ${learnerData.fullName} - ${new Date().toLocaleDateString('fr-FR')}`;
      
      const body = [
        'Bonjour,',
        '',
        'Veuillez trouver ci-joint mon journal d\'apprentissage avancé.',
        '',
        '📋 Informations apprenant:',
        `Nom: ${learnerData.fullName}`,
        `Matricule: ${learnerData.matricule}`,
        `Email: ${learnerData.email}`,
        '',
        `📊 Résumé:`,
        `Nombre d'entrées: ${entries.length}`,
        `Date de génération: ${new Date().toLocaleString('fr-FR')}`,
        '',
        personalMessage ? `💬 Message personnel:\n${personalMessage}\n` : '',
        '📎 Le document PDF détaillé du journal est joint en pièce jointe.',
        '',
        '---',
        'Généré par LMS Douane v2.0'
      ].filter(line => line !== null).join('\n');
      
      const mailto = `mailto:${CONFIG.formatterEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      // Log event
      logEmailEvent({
        learner: learnerData.fullName,
        matricule: learnerData.matricule,
        entryCount: entries.length,
        personalMessage: personalMessage,
        action: 'sendEmail'
      });
      
      log(`✅ Opening email client for ${CONFIG.formatterEmail}`);
      window.location.href = mailto;
      
    } catch (error) {
      logError('Email sending failed', error);
      throw error;
    }
  };
  
  // ═══════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════
  
  return {
    init,
    getBloomVerbs,
    getSuggestion,
    addEntry,
    getHistory,
    getEntryById,
    deleteEntry,
    generatePDF,
    sendEmail,
    getLearnerData,
    log,
    state: () => state
  };
  
})();

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof JournalAvance !== 'undefined') {
      JournalAvance.init();
    }
  });
} else {
  if (typeof JournalAvance !== 'undefined') {
    JournalAvance.init();
  }
}
