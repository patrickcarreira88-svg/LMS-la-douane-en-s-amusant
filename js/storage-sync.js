/**
 * storage-sync.js
 * Synchronise mises à jour entre admin.html et index.html
 * Même onglet, onglets différents, ou fenêtres différentes
 * 
 * Architecture: Observer Pattern
 * Admin publishes "CHAPTERS_UPDATED" → Index reacts
 */

const StorageSync = {
    channel: null,
    isInitialized: false,

    /**
     * Initialise la synchronisation
     * Appelé automatiquement au chargement (voir fin de fichier)
     */
    init() {
        if (this.isInitialized) {
            console.log('[STORAGE-SYNC] ℹ️ Déjà initialisé');
            return;
        }

        console.log('[STORAGE-SYNC] 🔄 Initialisation StorageSync...');

        // ═══════════════════════════════════════════════════════════
        // PRIMARY: BroadcastChannel (Modern Browsers)
        // ═══════════════════════════════════════════════════════════
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                this.channel = new BroadcastChannel('lms_admin_updates');
                this.channel.onmessage = (event) => this._onMessage(event);
                console.log('[STORAGE-SYNC] ✅ BroadcastChannel initialisé (cross-tab sync)');
                this.isInitialized = true;
                return;
            } catch (e) {
                console.warn('[STORAGE-SYNC] ⚠️ BroadcastChannel échoué:', e.message);
                // Fallback to storage events
            }
        } else {
            console.warn('[STORAGE-SYNC] ⚠️ BroadcastChannel non supporté');
        }

        // ═══════════════════════════════════════════════════════════
        // FALLBACK: Storage Events
        // ═══════════════════════════════════════════════════════════
        console.log('[STORAGE-SYNC] 📦 Fallback: Écoute storage events');
        window.addEventListener('storage', (e) => this._onStorageChange(e));
        this.isInitialized = true;
    },

    /**
     * Traite les messages BroadcastChannel reçus
     * @private
     */
    _onMessage(event) {
        const { data } = event;
        console.log('[STORAGE-SYNC] 📢 Message reçu:', data.type, `(${data.chapitresCount || 0} chapitres)`);

        if (data.type === 'CHAPTERS_UPDATED') {
            console.log('[STORAGE-SYNC] 🔄 Chapitres mis à jour détectés');

            // Recharger si on est dans index.html avec App disponible
            if (typeof App !== 'undefined' && typeof App.loadChapitres === 'function') {
                console.log('[STORAGE-SYNC] 🔄 Rechargement des chapitres...');
                try {
                    App.loadChapitres();
                    console.log('[STORAGE-SYNC] ✅ Chapitres rechargés avec succès');
                } catch (e) {
                    console.error('[STORAGE-SYNC] ❌ Erreur rechargement:', e);
                }
            } else {
                console.log('[STORAGE-SYNC] ℹ️ App.loadChapitres pas disponible (probablement admin.html)');
            }
        }
    },

    /**
     * Traite les changements localStorage (fallback cross-tab)
     * @private
     */
    _onStorageChange(event) {
        if (event.key === 'CHAPITRES_AUTEUR' || event.key === 'CHAPITRES') {
            console.log(`[STORAGE-SYNC] 📦 Changement détecté: ${event.key}`);

            // Recharger data
            if (typeof App !== 'undefined' && typeof App.loadChapitres === 'function') {
                console.log('[STORAGE-SYNC] 🔄 Rechargement via storage events...');
                try {
                    App.loadChapitres();
                } catch (e) {
                    console.error('[STORAGE-SYNC] ❌ Erreur rechargement:', e);
                }
            }
        }
    },

    /**
     * Admin appelle ça après saveToLocalStorage()
     * Notifie tous les autres onglets/fenêtres
     */
    notifyChaptersUpdated(chapitres = null) {
        if (!this.isInitialized) {
            console.warn('[STORAGE-SYNC] ⚠️ StorageSync pas encore initialisé');
            return;
        }

        console.log('[STORAGE-SYNC] 📢 Envoi signal: CHAPTERS_UPDATED');

        if (this.channel) {
            try {
                this.channel.postMessage({
                    type: 'CHAPTERS_UPDATED',
                    timestamp: Date.now(),
                    chapitresCount: (chapitres && chapitres.length) || 0,
                    source: 'admin.html'
                });
                console.log('[STORAGE-SYNC] ✅ Signal envoyé avec succès');
            } catch (e) {
                console.error('[STORAGE-SYNC] ❌ Erreur envoi signal:', e);
            }
        } else {
            console.log('[STORAGE-SYNC] ℹ️ BroadcastChannel non disponible, fallback storage events');
        }
    }
};

// Auto-initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        StorageSync.init();
    });
} else {
    StorageSync.init();
}

console.log('[STORAGE-SYNC] 🚀 Module storage-sync.js chargé');
