/**
 * Portfolio Swipe - Gestion du portfolio interactif
 * Permet aux utilisateurs de créer leur plan de révision avec swipe
 * Basé sur le prototype de révision adaptatif
 */

const PortfolioSwipe = {
    deck: [],
    currentIndex: 0,
    isInitialized: false,
    chapitreId: null, // 🔓 NOUVEAU: Stocker le chapitreId pour updateStepIcons()

    /**
     * Initialise le portfolio swipe avec les objectifs du chapitre
     */
    init(chapitreId) {
        console.log('📱 Initialisation Portfolio Swipe...');
        this.chapitreId = chapitreId; // 🔓 NOUVEAU: Stocker le chapitreId
        const chapitre = CHAPITRES.find(ch => ch.id === chapitreId);
        if (!chapitre || !chapitre.objectifs) {
            console.error('❌ Chapitre ou objectifs non trouvés');
            return;
        }

        // Créer les cartes à partir des objectifs
        this.deck = chapitre.objectifs.map((objectif, index) => ({
            id: `card-${index}`,
            h3: `Point clé ${index + 1}`,
            p: objectif,
            mastery: null, // null, 'pas-maitrise', 'a-approfondir', 'maitrise'
            completed: false
        }));

        this.currentIndex = 0;
        this.isInitialized = true;

        this.render();
        this.attachEvents();
        console.log('✅ Portfolio initialisé avec', this.deck.length, 'cartes');
    },

    /**
     * Démarrer le portfolio (première carte)
     */
    startPortfolio() {
        if (this.deck.length === 0) {
            console.error('❌ Aucune carte disponible');
            return null;
        }
        this.currentIndex = 0;
        this.render();
        this.attachEvents();
        return this.deck[0];
    },

    /**
     * Rend le deck de cartes
     */
    render() {
        const deckElement = document.getElementById('portfolio-swipe-container');
        if (!deckElement) return;

        // Créer le HTML du deck
        let deckHTML = `
            <div class="deck" id="deck" aria-live="polite">
        `;

        this.deck.forEach((card, index) => {
            const isActive = index === this.currentIndex;
            const transform = this.getCardTransform(index);
            
            deckHTML += `
                <div class="card" id="${card.id}" style="transform: ${transform}; opacity: ${isActive ? 1 : 0}; pointer-events: ${isActive ? 'auto' : 'none'}; z-index: ${this.deck.length - index};">
                    <h3>${card.h3}</h3>
                    <p>${card.p}</p>
                </div>
            `;
        });

        deckHTML += `
            </div>
            <div class="deck-counter">
                <span id="card-counter">${this.currentIndex + 1} / ${this.deck.length}</span>
            </div>
        `;

        deckElement.innerHTML = deckHTML;
    },

    /**
     * Calcule la transformation CSS pour une carte
     */
    getCardTransform(index) {
        const diff = index - this.currentIndex;
        
        if (diff < -1) {
            return 'translateX(-200%) scale(0.95)';
        } else if (diff === -1) {
            return 'translateX(-110%) scale(0.97)';
        } else if (diff === 0) {
            return 'translateX(0) scale(1)';
        } else if (diff === 1) {
            return 'translateX(110%) scale(0.97)';
        } else {
            return 'translateX(200%) scale(0.95)';
        }
    },

    /**
     * Attache les événements aux boutons et gestes tactiles
     */
    attachEvents() {
        const btnLeft = document.getElementById('btn-portfolio-left');
        const btnUp = document.getElementById('btn-portfolio-up');
        const btnRight = document.getElementById('btn-portfolio-right');

        if (btnLeft) {
            btnLeft.addEventListener('click', () => this.swipeCard('left'));
        }
        if (btnUp) {
            btnUp.addEventListener('click', () => this.swipeCard('up'));
        }
        if (btnRight) {
            btnRight.addEventListener('click', () => this.swipeCard('right'));
        }

        // Support clavier
        document.addEventListener('keydown', (e) => {
            if (!this.isInitialized || !document.getElementById('portfolio-modal').classList.contains('hidden') === false) return;
            
            if (e.key === 'ArrowLeft') this.swipeCard('left');
            if (e.key === 'ArrowUp') this.swipeCard('up');
            if (e.key === 'ArrowRight') this.swipeCard('right');
        });

        // Support tactile (swipe mobile)
        this.addTouchSupport();
    },

    /**
     * Ajoute le support des gestes tactiles (swipe)
     */
    addTouchSupport() {
        const deck = document.getElementById('deck');
        if (!deck) return;

        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;
        const SWIPE_THRESHOLD = 30; // Minimum de pixels pour déclencher le swipe

        deck.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].clientX;
            touchStartY = e.changedTouches[0].clientY;
            
            // Feedback visuel: réduire la carte légèrement
            const activeCard = deck.querySelector('.card[style*="opacity: 1"]');
            if (activeCard) {
                activeCard.style.transition = 'none';
            }
        }, false);

        deck.addEventListener('touchmove', (e) => {
            touchEndX = e.changedTouches[0].clientX;
            touchEndY = e.changedTouches[0].clientY;

            // Feedback visuel pendant le drag
            const activeCard = deck.querySelector('.card[style*="opacity: 1"]');
            if (activeCard) {
                const dragDistance = touchEndX - touchStartX;
                activeCard.style.transform = `translateX(${dragDistance * 0.5}px) scale(${1 - Math.abs(dragDistance) / 1000})`;
            }
        }, false);

        deck.addEventListener('touchend', (e) => {
            const dragDistance = touchEndX - touchStartX;
            const dragVertical = touchEndY - touchStartY;

            // Reset transition
            const activeCard = deck.querySelector('.card[style*="opacity: 1"]');
            if (activeCard) {
                activeCard.style.transition = 'all 0.3s ease-out';
            }

            // Déterminer la direction du swipe
            if (Math.abs(dragVertical) > Math.abs(dragDistance) && Math.abs(dragVertical) > SWIPE_THRESHOLD) {
                // Swipe vertical (up)
                if (dragVertical < 0) {
                    this.swipeCard('up');
                }
            } else if (Math.abs(dragDistance) > SWIPE_THRESHOLD) {
                // Swipe horizontal
                if (dragDistance < 0) {
                    // Swipe gauche (left) = pas maîtrisé
                    this.swipeCard('left');
                } else {
                    // Swipe droit (right) = maîtrisé
                    this.swipeCard('right');
                }
            }
        }, false);

        console.log('✅ Gestes tactiles activés pour le portfolio');
    },

    /**
     * Swipe une carte avec notation
     */
    swipeCard(direction) {
        if (this.currentIndex >= this.deck.length) return;

        const mastery = {
            'left': 'pas-maitrise',
            'up': 'a-approfondir',
            'right': 'maitrise'
        }[direction];

        // Enregistrer la notation
        this.deck[this.currentIndex].mastery = mastery;
        this.deck[this.currentIndex].completed = true;

        // Animation du swipe
        const card = document.getElementById(this.deck[this.currentIndex].id);
        if (card) {
            const direction_map = { 'left': '-', 'up': '↑', 'right': '→' };
            card.style.transform = `translateX(${direction === 'left' ? '-150%' : direction === 'right' ? '150%' : '0'}) rotate(${direction === 'left' ? '-20deg' : direction === 'right' ? '20deg' : '0deg'})`;
            card.style.opacity = '0';
        }

        // Aller à la carte suivante
        setTimeout(() => {
            this.currentIndex++;
            if (this.currentIndex < this.deck.length) {
                this.render();
                this.attachEvents();
            } else {
                this.showCompletion();
            }
        }, 200);
    },

    /**
     * Affiche le message de fin + plan de révision personnalisé
     */
    showCompletion() {
        // 🔓 NOUVEAU: Marquer le portfolio (dernière étape) comme complété
        if (this.chapitreId) {
            const chapitre = CHAPITRES.find(ch => ch.id === this.chapitreId);
            if (chapitre) {
                // 🔓 NOUVEAU: Marquer le portfolio comme complété (puisqu'il ne peut pas être une étape régulière)
                // Portfolio n'est pas dans chapitre.etapes[], donc on utilise un flag séparé
                chapitre.portfolioCompleted = true;
                
                // Sauvegarder le statut du portfolio via StorageManager
                if (window.StorageManager) {
                    StorageManager.savePortfolioStatus(this.chapitreId, true);
                    console.log(`✅ Portfolio marqué comme complété via StorageManager`);
                }
                
                console.log(`✅ Chapitre ${this.chapitreId} portfolio marqué comme complété`);
                
                // Mettre à jour les icônes visuelles
                setTimeout(() => {
                    updateStepIcons(this.chapitreId, chapitre);
                    console.log(`✅ Icônes des étapes mises à jour après portfolio`);
                }, 100);
            }
        }

        const deckElement = document.getElementById('portfolio-swipe-container');
        if (!deckElement) return;

        const stats = this.getStats();
        const weakThemes = this.getWeakThemesWithContext();
        const schedule = this.generateRevisionSchedule(weakThemes);

        // Générer HTML plan de révision
        let planHTML = '';
        if (schedule.length > 0) {
            planHTML = schedule
                .filter(s => s.numero !== undefined)
                .map(session => `
                    <div class="revision-session" style="margin: 15px 0; padding: 12px; background: #f9f9f9; border-left: 4px solid #667eea; border-radius: 4px;">
                        <h4 style="margin: 0 0 8px 0; color: #333;">📅 Séance ${session.numero} : ${session.dateFormatee}</h4>
                        <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;"><strong>${session.titre}</strong> (⏱️ ${session.duree} min)</p>
                        <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #555;">
                            ${session.activites.map(a => `<li style="margin: 4px 0;">${a}</li>`).join('')}
                        </ul>
                    </div>
                `)
                .join('');

            if (schedule.metadata) {
                planHTML += `
                    <div style="margin-top: 15px; padding: 12px; background: #e8f4f8; border-radius: 4px; text-align: center; font-size: 13px; color: #333;">
                        <strong>⏳ ${schedule.metadata.dureeTotal}</strong> | 📊 ${schedule.metadata.totalSessions} séances | Fréquence: ${schedule.metadata.frequence}
                    </div>
                `;
            }
        }

        deckElement.innerHTML = `
            <div class="completion-screen" style="max-height: 80vh; overflow-y: auto;">
                <h2 style="margin-top: 0;">🎉 Plan de révision terminé!</h2>
                
                <div class="stats" style="display: flex; gap: 12px; margin: 20px 0; justify-content: space-between;">
                    <div class="stat-box" style="padding: 15px; background: #e8f5e9; border-radius: 8px; text-align: center; flex: 1; max-width: calc(33.333% - 8px);">
                        <span class="stat-value" style="font-size: 32px; color: #27ae60; display: block;">${stats.mastery}</span>
                        <span class="stat-label" style="color: #27ae60; font-size: 12px; display: block;">Maîtrisés ✓</span>
                    </div>
                    <div class="stat-box" style="padding: 15px; background: #fff3e0; border-radius: 8px; text-align: center; flex: 1; max-width: calc(33.333% - 8px);">
                        <span class="stat-value" style="font-size: 32px; color: #f39c12; display: block;">${stats.approfondir}</span>
                        <span class="stat-label" style="color: #f39c12; font-size: 12px; display: block;">À approfondir ⚡</span>
                    </div>
                    <div class="stat-box" style="padding: 15px; background: #ffebee; border-radius: 8px; text-align: center; flex: 1; max-width: calc(33.333% - 8px);">
                        <span class="stat-value" style="font-size: 32px; color: #e74c3c; display: block;">${stats.pasMaitrise}</span>
                        <span class="stat-label" style="color: #e74c3c; font-size: 12px; display: block;">À revoir ✕</span>
                    </div>
                </div>

                ${stats.approfondir > 0 || stats.pasMaitrise > 0 ? `
                    <h3 style="margin-top: 25px; margin-bottom: 15px; color: #333;">📋 Votre Plan de Révision Personnalisé (14 jours)</h3>
                    ${planHTML}
                ` : `
                    <div style="margin: 20px 0; padding: 15px; background: #e8f5e9; border-radius: 4px; text-align: center; color: #27ae60;">
                        <strong>🎉 Excellente maîtrise!</strong> Vous avez bien assimilé tous les concepts. Continuez à réviser régulièrement.
                    </div>
                `}

                <div style="margin-top: 20px; text-align: center;">
                    <button onclick="location.reload();" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">↻ Recommencer</button>
                    ${schedule.length > 0 && schedule.metadata ? `
                        <button onclick="PortfolioSwipe.generatePDF();" style="margin-left: 10px; padding: 10px 20px; background: #27ae60; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">📄 Télécharger en PDF</button>
                    ` : ''}
                </div>
            </div>
        `;

        console.log('✅ Completion écran affiché avec plan:', schedule.length > 0 ? 'Oui' : 'Non');
    },

    /**
     * Obtient les statistiques du plan
     */
    getStats() {
        return {
            mastery: this.deck.filter(c => c.mastery === 'maitrise').length,
            approfondir: this.deck.filter(c => c.mastery === 'a-approfondir').length,
            pasMaitrise: this.deck.filter(c => c.mastery === 'pas-maitrise').length
        };
    },

    /**
     * Récupère les données du plan
     */
    getPlanData() {
        return this.deck;
    },

    /**
     * Efface le portfolio
     */
    clear() {
        this.deck = [];
        this.currentIndex = 0;
        this.isInitialized = false;
    },

    /**
     * Obtenir thèmes faibles avec contexte (texte complet + score)
     */
    getWeakThemesWithContext() {
        return this.deck
            .filter(card => card.mastery === 'pas-maitrise' || card.mastery === 'a-approfondir')
            .map(card => ({
                numero: card.id,
                texte: card.p,
                bloom: 'apply',
                score: card.mastery === 'pas-maitrise' ? 25 : 50,
                priorite: card.mastery === 'pas-maitrise' ? 'HAUTE' : 'MOYENNE'
            }));
    },

    /**
     * Récupérer activités par jour (avec tâches SMART et vérifications)
     */
    getActivitiesByDay(dayOffset) {
        const activities = {
            1: [
                '☐ Revoir vidéo du module (15 min)',
                '☐ Relire vos réponses du portfolio',
                '☐ Souligner 3 points clés',
                '✓ Vérification : Pouvez-vous expliquer 2 concepts SANS relire ?'
            ],
            3: [
                '☐ Faire 3-5 QCM du module',
                '☐ Réviser flashcards (5-10 min)',
                '☐ Traiter 1 cas pratique complet',
                '✓ Vérification : Score ≥ 70% au QCM ?'
            ],
            7: [
                '☐ Quiz 5 questions SANS ressources',
                '☐ Expliquer à voix haute le sujet (10 min)',
                '☐ Créer résumé personnel 1 page',
                '✓ Vérification : Score ≥ 75% au quiz ?'
            ],
            14: [
                '☐ Cas intégré complet (tous objectifs)',
                '☐ Exercice mêlant 2-3 objectifs',
                '☐ Débriefing personnel : Qu\'ai-je progressé ?',
                '✓ Vérification finale : Cas NOUVEAU compris ≥ 80% ?'
            ]
        };

        return activities[dayOffset] || [];
    },

    /**
     * Générer plan de révision sur 14 jours (spaced repetition)
     */
    generateRevisionSchedule(weakThemes) {
        if (!weakThemes || weakThemes.length === 0) {
            console.warn('⚠️ Aucun thème faible pour la révision');
            return [];
        }

        const today = new Date();
        const schedule = [];

        const jours = [1, 3, 7, 14];
        jours.forEach((jour, index) => {
            const date = new Date(today);
            date.setDate(date.getDate() + jour);
            const dateFormatee = date.toLocaleDateString('fr-FR', { weekday: 'short', month: 'short', day: 'numeric' });

            const titres = [
                '📚 PREMIÈRE RÉVISION (Consolidation)',
                '🧠 DEUXIÈME RÉVISION (Compréhension)',
                '💪 TROISIÈME RÉVISION (Maîtrise)',
                '🎯 RÉVISION FINALE (Vérification)'
            ];

            const durees = [15, 20, 10, 15];

            schedule.push({
                numero: index + 1,
                dateFormatee: dateFormatee,
                titre: titres[index],
                duree: durees[index],
                activites: this.getActivitiesByDay(jour)
            });
        });

        // Ajouter info timing total
        const totalMinutes = [15, 20, 10, 15].reduce((a, b) => a + b, 0);
        const totalSessions = schedule.length;

        schedule.metadata = {
            totalMinutes: totalMinutes,
            totalSessions: totalSessions,
            dureeTotal: `${totalMinutes} minutes sur 14 jours`,
            frequence: 'J+1, J+3, J+7, J+14'
        };

        return schedule;
    },

    /**
     * Exporter plan révision en texte simple (pour email/copier)
     */
    exportRevisionScheduleAsText(weakThemes) {
        const schedule = this.generateRevisionSchedule(weakThemes);
        if (!schedule || schedule.length === 0) return '';

        let text = '🎓 PLAN DE RÉVISION PERSONNALISÉ - 14 JOURS\n';
        text += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

        schedule.forEach((session) => {
            if (session.numero !== undefined) {  // Skip metadata
                text += `📅 SÉANCE ${session.numero} : ${session.dateFormatee}\n`;
                text += `⏱️ ${session.titre} (${session.duree} min)\n`;
                text += '──────────────────────────────────\n';
                session.activites.forEach((activity) => {
                    text += `  ${activity}\n`;
                });
                text += '\n';
            }
        });

        if (schedule.metadata) {
            text += `⏳ TOTAL : ${schedule.metadata.totalMinutes} min sur ${schedule.metadata.totalSessions} séances\n`;
        }

        return text;
    },

    /**
     * Générer PDF du plan de révision avec ressources
     */
    generatePDF() {
        if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
            console.warn('⚠️ jsPDF non disponible, utilisation fallback HTML');
            return this.generateSimplePDF();
        }

        try {
            const jsPDFClass = window.jspdf.jsPDF;
            const doc = new jsPDFClass();
            const pageHeight = doc.internal.pageSize.height;
            const pageWidth = doc.internal.pageSize.width;
            const margin = 15;
            let currentY = 20;

            // En-tête
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text('PLAN DE REVISION PERSONNALISE', margin, currentY);
            currentY += 10;

            // Date
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            const today = new Date().toLocaleDateString('fr-FR');
            doc.text(`Genere le : ${today}`, margin, currentY);
            currentY += 10;

            // Calendrier 14 jours
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('CALENDRIER 14 JOURS', margin, currentY);
            currentY += 8;

            const schedule = this.generateRevisionSchedule(this.getWeakThemesWithContext());
            doc.setFont(undefined, 'normal');
            doc.setFontSize(9);

            schedule.forEach((session) => {
                if (session.numero !== undefined) {
                    if (currentY > pageHeight - 30) {
                        doc.addPage();
                        currentY = 20;
                    }
                    
                    doc.setFont(undefined, 'bold');
                    doc.text(`Seance ${session.numero} : ${session.dateFormatee}`, margin, currentY);
                    currentY += 4;
                    
                    doc.setFont(undefined, 'normal');
                    doc.setFontSize(8);
                    doc.text(`${session.titre} (${session.duree} min)`, margin + 3, currentY);
                    currentY += 4;
                    
                    session.activites.forEach((activity) => {
                        if (currentY > pageHeight - 15) {
                            doc.addPage();
                            currentY = 20;
                        }
                        // Nettoyer les symboles problématiques
                        const cleanActivity = activity
                            .replace(/☐/g, '[ ]')
                            .replace(/✓/g, '[V]')
                            .replace(/✕/g, '[X]')
                            .replace(/→/g, '-');
                        doc.text(cleanActivity, margin + 5, currentY);
                        currentY += 3;
                    });
                    currentY += 3;
                }
            });

            // Ressources disponibles
            currentY += 8;
            if (currentY > pageHeight - 40) {
                doc.addPage();
                currentY = 20;
            }
            
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('RESSOURCES DISPONIBLES', margin, currentY);
            currentY += 8;

            doc.setFont(undefined, 'normal');
            doc.setFontSize(9);
            const resources = [
                '- Video du module (15 min)',
                '- QCM thematiques (3-5 questions)',
                '- Flashcards concepts cles',
                '- Cas pratiques (2 scenarios)',
                '- Chat formateur (mercredi 14h-16h)',
                '- Email : patrick.carreira@douane.ch'
            ];

            resources.forEach((resource) => {
                if (currentY > pageHeight - 15) {
                    doc.addPage();
                    currentY = 20;
                }
                doc.text(resource, margin + 3, currentY);
                currentY += 5;
            });

            // Engagement personnel
            currentY += 8;
            if (currentY > pageHeight - 30) {
                doc.addPage();
                currentY = 20;
            }
            
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('ENGAGEMENT PERSONNEL', margin, currentY);
            currentY += 8;
            
            doc.setFont(undefined, 'normal');
            doc.setFontSize(9);
            doc.text('Je m\'engage a suivre ce plan de revision et a valider chaque etape.', margin, currentY);
            currentY += 6;
            doc.text('Signature : ___________________     Date : ___________________', margin, currentY);

            // Informations timing
            currentY += 12;
            if (currentY > pageHeight - 15) {
                doc.addPage();
                currentY = 20;
            }
            
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            if (schedule.metadata) {
                const infoText = `Total: ${schedule.metadata.totalMinutes} minutes sur ${schedule.metadata.totalSessions} seances - Frequence: ${schedule.metadata.frequence}`;
                doc.text(infoText, margin, currentY);
            }

            // Télécharger
            doc.save('plan-revision-personnalise.pdf');
            console.log('✅ PDF genere avec succes');
            return doc.output('dataurlstring');
        } catch (error) {
            console.error('❌ Erreur generation PDF:', error);
            return this.generateSimplePDF();
        }
    },

    /**
     * Fallback PDF : génération HTML/CSS pour impression
     */
    generateSimplePDF() {
        const schedule = this.generateRevisionSchedule(this.getWeakThemesWithContext());
        const html = this.exportRevisionScheduleAsText(this.getWeakThemesWithContext());
        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow.document.write(`
            <html>
            <head>
                <title>Plan de Révision</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { color: #333; }
                    pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
                </style>
            </head>
            <body>
                <h1>🎓 Plan de Révision Personnalisé</h1>
                <p>Généré le : ${new Date().toLocaleDateString('fr-FR')}</p>
                <pre>${html}</pre>
                <button onclick="window.print();">🖨️ Imprimer / Sauvegarder en PDF</button>
            </body>
            </html>
        `);
        printWindow.document.close();
        return null;
    }
};

