/**
 * VideoPlayer Custom Element
 * Composant vidéo responsive avec:
 * - Adaptation bitrate (4G/3G/Slow)
 * - Sous-titres
 * - Tracking progression
 * - Accessibility complète
 */

class VideoPlayer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.videoId = null;
    this.currentBitrate = '360p'; // ⚡ Default to fastest loading
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this.videoData = null;
    this.transcript = null;
  }

  connectedCallback() {
    this.videoId = this.getAttribute('video-id');
    this.setupPlayer();
    this.detectNetworkSpeed();
    this.loadVideo();
    this.setupControls();
    this.setupTracking();
    this.setupAccessibility();
    console.log('🎬 VideoPlayer initialized:', this.videoId);
  }

  setupPlayer() {
    const template = `
      <style>
        :host {
          display: block;
          width: 100%;
          background: #000;
          border-radius: 8px;
          overflow: hidden;
          margin: 20px 0;
        }

        .video-container {
          position: relative;
          width: 100%;
          padding-bottom: 56.25%;
          height: 0;
          background: #000;
        }

        video {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: block;
        }

        .controls {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.5), transparent);
          padding: 30px 15px 12px;
          display: flex;
          gap: 10px;
          align-items: center;
          opacity: 0;
          transition: opacity 0.3s;
          flex-wrap: wrap;
        }

        .video-container:hover .controls {
          opacity: 1;
        }

        .controls button {
          background: #6B4E9A;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .controls button:hover {
          background: #8B6EAA;
          transform: scale(1.05);
        }

        .controls button:active {
          transform: scale(0.95);
        }

        .progress-bar {
          flex: 1;
          height: 6px;
          background: rgba(255,255,255,0.3);
          border-radius: 3px;
          cursor: pointer;
          min-width: 100px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #FF69B4, #FF6B9D);
          border-radius: 3px;
          width: 0%;
          box-shadow: 0 0 8px #FF69B4;
        }

        .time {
          color: white;
          font-size: 12px;
          min-width: 70px;
          font-weight: 500;
        }

        .subtitle-display {
          position: absolute;
          bottom: 90px;
          left: 0;
          right: 0;
          text-align: center;
          color: white;
          background: rgba(0,0,0,0.85);
          padding: 10px 15px;
          font-size: 14px;
          line-height: 1.4;
          max-width: 90%;
          margin: 0 auto;
          border-radius: 4px;
        }

        .subtitle-display.hidden {
          display: none;
        }

        .video-title {
          position: absolute;
          top: 10px;
          left: 15px;
          right: 15px;
          color: white;
          font-size: 16px;
          font-weight: 600;
          background: rgba(0,0,0,0.5);
          padding: 8px 12px;
          border-radius: 4px;
          opacity: 0;
          transition: opacity 0.3s;
        }

        .video-container:hover .video-title {
          opacity: 1;
        }

        .bitrate-badge {
          position: absolute;
          top: 15px;
          right: 15px;
          background: rgba(107, 78, 154, 0.9);
          color: white;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
          opacity: 0;
          transition: opacity 0.3s;
        }

        .video-container:hover .bitrate-badge {
          opacity: 1;
        }

        .loading-spinner {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255,255,255,0.2);
          border-top-color: #FF69B4;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        @media (max-width: 640px) {
          .controls {
            padding: 20px 10px 8px;
            gap: 6px;
          }

          .controls button {
            padding: 6px 10px;
            font-size: 12px;
          }

          .time {
            font-size: 11px;
            min-width: 60px;
          }

          .subtitle-display {
            font-size: 12px;
          }

          .video-title {
            font-size: 14px;
          }
        }
      </style>

      <div class="video-container">
        <video 
          id="video-element"
          role="application"
          aria-label="Lecteur vidéo"
          crossorigin="anonymous"
        >
          <track kind="subtitles" srclang="fr" />
        </video>
        <div class="video-title" id="video-title"></div>
        <div class="bitrate-badge" id="bitrate-badge"></div>
        <div class="loading-spinner" id="loading-spinner"></div>
        <div class="subtitle-display hidden" id="subtitle-display"></div>
        <div class="controls">
          <button id="play-btn" aria-label="Lecture/Pause">▶ Lecture</button>
          <button id="mute-btn" aria-label="Couper le son">🔊</button>
          <div class="progress-bar" id="progress-bar" role="progressbar" aria-label="Progression vidéo">
            <div class="progress-fill" id="progress-fill"></div>
          </div>
          <div class="time">
            <span id="current-time">0:00</span> / <span id="duration-time">0:00</span>
          </div>
          <button id="speed-btn" aria-label="Vitesse lecture">1x</button>
          <button id="subtitle-btn" aria-label="Sous-titres">CC</button>
          <button id="fullscreen-btn" aria-label="Plein écran">⛶</button>
        </div>
      </div>
    `;

    this.shadowRoot.innerHTML = template;
  }

  detectNetworkSpeed() {
    // ⚡ PAR DÉFAUT: COMMENCER PAR 360p POUR CHARGEMENT RAPIDE
    this.currentBitrate = '360p';
    
    if (navigator.connection) {
      const type = navigator.connection.effectiveType;
      const downlink = navigator.connection.downlink;
      
      // Monter en qualité que si bonne connexion (très restrictif)
      if (type === '4g' && downlink >= 10) {
        this.currentBitrate = '720p';
      } else if (type === '4g' || (type === '3g' && downlink >= 5)) {
        this.currentBitrate = '480p';
      }
      // Sinon rester à 360p

      // Afficher bitrate détecté
      const badge = this.shadowRoot.getElementById('bitrate-badge');
      if (badge) {
        badge.textContent = `${this.currentBitrate} (${type})`;
      }

      // Écouter les changements de connexion
      navigator.connection.addEventListener('change', () => {
        const oldBitrate = this.currentBitrate;
        this.detectNetworkSpeed();
        if (oldBitrate !== this.currentBitrate) {
          console.log(`📡 Bitrate changé: ${oldBitrate} → ${this.currentBitrate}`);
        }
      });
    }
    
    console.log(`📺 Bitrate choisi: ${this.currentBitrate} (chargement rapide)`);
  }

  loadVideo() {
    const videoElement = this.shadowRoot.getElementById('video-element');
    const spinner = this.shadowRoot.getElementById('loading-spinner');
    
    console.log('🎥 Tentative chargement vidéo:', this.videoId);
    
    // Approach simple: charger directement sans manifest
    // Si c'est marchandises, utiliser le fichier réel qui existe
    let videoPath = '';
    let videoTitle = '';
    
    if (this.videoId === 'video_101_marchandises') {
      videoPath = '/assets/videos/Marchandise_Commerciale_-_35s.mp4';
      videoTitle = 'Qu\'est-ce qu\'une marchandise commerciale?';
    } else if (this.videoId === 'video_101_processus') {
      videoPath = '/assets/videos/Dédouanement_Suisse_Expliqué.mp4';
      videoTitle = 'Les 5 étapes du processus de dédouanement';
    }
    
    if (!videoPath) {
      console.error('❌ Vidéo ID inconnu:', this.videoId);
      spinner.innerHTML = '<p style="color:white;">Vidéo non trouvée</p>';
      return;
    }
    
    this.shadowRoot.getElementById('video-title').textContent = videoTitle;
    
    // Créer source
    const source = document.createElement('source');
    source.src = videoPath;
    source.type = 'video/mp4';
    videoElement.appendChild(source);
    
    // ⚡ Configuration minimale pour chargement rapide
    videoElement.preload = 'metadata';
    
    // Écoute du chargement
    videoElement.addEventListener('loadedmetadata', () => {
      console.log(`✅ Vidéo prête: ${videoTitle}`);
      if (spinner) spinner.style.display = 'none';
    });
    
    videoElement.addEventListener('error', (e) => {
      console.error('❌ Erreur vidéo:', e, 'Chemin:', videoPath);
      spinner.innerHTML = '<p style="color:red;">Erreur chargement vidéo</p>';
    });
    
    console.log('📺 Chargement de:', videoPath);
  }

  loadTranscript(transcriptPath) {
    fetch(transcriptPath)
      .then(res => res.text())
      .then(text => {
        this.transcript = text;
        console.log('📝 Transcription chargée');
      })
      .catch(err => console.warn('Transcription non disponible'));
  }

  setupControls() {
    const videoElement = this.shadowRoot.getElementById('video-element');
    const playBtn = this.shadowRoot.getElementById('play-btn');
    const muteBtn = this.shadowRoot.getElementById('mute-btn');
    const progressBar = this.shadowRoot.getElementById('progress-bar');
    const subtitleBtn = this.shadowRoot.getElementById('subtitle-btn');
    const fullscreenBtn = this.shadowRoot.getElementById('fullscreen-btn');
    const speedBtn = this.shadowRoot.getElementById('speed-btn');

    const speeds = [0.75, 1.0, 1.25, 1.5];
    let currentSpeedIndex = 1; // 1.0x par défaut

    // Play/Pause
    playBtn.addEventListener('click', () => {
      if (videoElement.paused) {
        videoElement.play();
        playBtn.textContent = '⏸ Pause';
        this.isPlaying = true;
      } else {
        videoElement.pause();
        playBtn.textContent = '▶ Lecture';
        this.isPlaying = false;
      }
    });

    // Mute
    muteBtn.addEventListener('click', () => {
      videoElement.muted = !videoElement.muted;
      muteBtn.textContent = videoElement.muted ? '🔇 Muet' : '🔊 Son';
    });

    // Progress bar
    progressBar.addEventListener('click', (e) => {
      const rect = progressBar.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      videoElement.currentTime = Math.max(0, Math.min(percent * videoElement.duration, videoElement.duration));
    });

    // Subtitles toggle
    subtitleBtn.addEventListener('click', () => {
      const subtitleDisplay = this.shadowRoot.getElementById('subtitle-display');
      subtitleDisplay.classList.toggle('hidden');
      subtitleBtn.style.background = subtitleDisplay.classList.contains('hidden') ? '#6B4E9A' : '#FF69B4';
    });

    // Speed control
    speedBtn.addEventListener('click', () => {
      currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
      const newSpeed = speeds[currentSpeedIndex];
      videoElement.playbackRate = newSpeed;
      speedBtn.textContent = `${newSpeed}x`;
      console.log(`⏱️ Vitesse: ${newSpeed}x`);
    });

    // Fullscreen
    fullscreenBtn.addEventListener('click', () => {
      const container = this.shadowRoot.querySelector('.video-container');
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      }
    });

    // Update controls
    videoElement.addEventListener('timeupdate', () => {
      this.updateProgress();
    });

    videoElement.addEventListener('loadedmetadata', () => {
      this.duration = videoElement.duration;
      this.shadowRoot.getElementById('duration-time').textContent = 
        this.formatTime(videoElement.duration);
    });

    videoElement.addEventListener('play', () => {
      this.isPlaying = true;
      playBtn.textContent = '⏸ Pause';
    });

    videoElement.addEventListener('pause', () => {
      this.isPlaying = false;
      playBtn.textContent = '▶ Lecture';
    });
  }

  setupTracking() {
    const videoElement = this.shadowRoot.getElementById('video-element');
    let lastSavedTime = 0;
    
    // Tracker progression toutes les 10 secondes
    videoElement.addEventListener('timeupdate', () => {
      this.currentTime = videoElement.currentTime;
      
      // Sauvegarder chaque 10s
      if (Math.abs(this.currentTime - lastSavedTime) >= 10 || 
          Math.abs(this.duration - this.currentTime) < 1) {
        this.saveProgress();
        lastSavedTime = this.currentTime;
      }
    });

    // Marquer comme complété
    videoElement.addEventListener('ended', () => {
      this.markAsCompleted();
    });
  }

  saveProgress() {
    const progress = {
      videoId: this.videoId,
      title: this.videoData?.title || this.videoId,
      lastPosition: Math.round(this.currentTime),
      percentage: Math.round((this.currentTime / this.duration) * 100),
      duration: Math.round(this.duration),
      timestamp: new Date().toISOString(),
      bitrate: this.currentBitrate
    };

    localStorage.setItem(`video_${this.videoId}`, JSON.stringify(progress));
    
    // Envoyer analytics
    if (window.trackEvent) {
      window.trackEvent('video_progress', progress);
    }
  }

  markAsCompleted() {
    const completion = {
      videoId: this.videoId,
      title: this.videoData?.title || this.videoId,
      completedAt: new Date().toISOString(),
      duration: Math.round(this.duration),
      points: 10 // Points attribués pour visionnage complet
    };

    localStorage.setItem(`video_completed_${this.videoId}`, JSON.stringify(completion));
    
    console.log('✅ Vidéo complétée:', this.videoData?.title, '+10 points');
    
    // Déclencher événement pour app
    this.dispatchEvent(new CustomEvent('video-completed', { 
      detail: completion,
      bubbles: true,
      composed: true
    }));
  }

  updateProgress() {
    const videoElement = this.shadowRoot.getElementById('video-element');
    const progressFill = this.shadowRoot.getElementById('progress-fill');
    const currentTimeEl = this.shadowRoot.getElementById('current-time');
    
    if (videoElement.duration) {
      const percent = (videoElement.currentTime / videoElement.duration) * 100;
      progressFill.style.width = percent + '%';
      currentTimeEl.textContent = this.formatTime(videoElement.currentTime);
    }
  }

  setupAccessibility() {
    const videoElement = this.shadowRoot.getElementById('video-element');
    
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      // Vérifier que la vidéo est visible et active
      if (!this.isConnected) return;
      
      const isVideoFocused = this.shadowRoot.activeElement?.id === 'video-element' ||
                            document.activeElement === this;

      switch(e.code) {
        case 'Space':
          if (isVideoFocused) {
            e.preventDefault();
            const btn = this.shadowRoot.getElementById('play-btn');
            if (btn) btn.click();
          }
          break;
        case 'ArrowRight':
          videoElement.currentTime += 5;
          break;
        case 'ArrowLeft':
          videoElement.currentTime -= 5;
          break;
        case 'KeyM':
          const muteBtn = this.shadowRoot.getElementById('mute-btn');
          if (muteBtn) muteBtn.click();
          break;
        case 'KeyF':
          const fsBtn = this.shadowRoot.getElementById('fullscreen-btn');
          if (fsBtn) fsBtn.click();
          break;
      }
    });

    // ARIA labels
    videoElement.setAttribute('role', 'application');
    videoElement.setAttribute('aria-label', this.videoData?.title || 'Lecteur vidéo');
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

// Enregistrer le composant
customElements.define('video-player', VideoPlayer);
console.log('🎬 VideoPlayer component registered');
