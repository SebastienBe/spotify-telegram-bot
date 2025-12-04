// Configuration
const CONFIG = {
    N8N_WEBHOOK_BASE: 'https://n8n-seb.sandbox-jerem.com/webhook/spotify-bot',
    PLAYLIST_ID: '0TLNSXMwwnAPQQaPp5UPZS'
};

const DEBUG = true;

function debugLog(message, data) {
    if (DEBUG) console.log(`[DEBUG] ${message}`, data);
}

function safeHaptic(action, style) {
    try {
        if (!tg?.HapticFeedback || typeof tg.HapticFeedback[action] !== "function") return;
        try { tg.HapticFeedback[action](); return; } catch (e1) {}
        try { tg.HapticFeedback[action](style); } catch (e2) {}
    } catch (_) {}
}

// Initialisation Telegram
let tg;
try {
    tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    debugLog('Telegram WebApp initialisé', { user: tg.initDataUnsafe?.user });
} catch (error) {
    console.error('Erreur init Telegram:', error);
    tg = { 
        initDataUnsafe: { user: { id: 'demo' } },
        HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} }
    };
}

// Variables globales
let searchTimeout;
let playlistVisible = false;
const searchInput = document.getElementById('searchInput');
const results = document.getElementById('results');
const trackList = document.getElementById('trackList');
const playlistSection = document.getElementById('playlistSection');
const playlistTracks = document.getElementById('playlistTracks');

// Event listener recherche
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length < 2) {
        results.classList.remove('active');
        return;
    }
    
    playlistSection.classList.remove('active');
    playlistVisible = false;
    trackList.innerHTML = '<div class="loading"><div class="loading-spinner"></div>Recherche en cours...</div>';
    results.classList.add('active');
    searchTimeout = setTimeout(() => searchTracks(query), 500);
});

// Rechercher des tracks
async function searchTracks(query) {
    try {
        const payload = {
            action: 'search',
            q: query
        };
        
        debugLog('🔵 Search payload', payload);
        
        const response = await fetch(CONFIG.N8N_WEBHOOK_BASE, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json' 
            },
            body: JSON.stringify(payload)
        });
        
        debugLog('🟢 Search response status', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            debugLog('❌ Search error response', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        debugLog('✅ Search data', data);
        
        if (data.status === 'ok' && data.tracks) {
            displayTracks(data.tracks);
        } else {
            throw new Error('Invalid response format');
        }
    } catch (error) {
        console.error('Erreur:', error);
        trackList.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><p>Erreur: ${error.message}</p></div>`;
        showToast(`❌ ${error.message}`);
    }
}

// Afficher les tracks
function displayTracks(tracks) {
    if (!tracks || tracks.length === 0) {
        trackList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><p>Aucun résultat trouvé</p></div>';
        return;
    }
    
    trackList.innerHTML = tracks.map(track => `
        <div class="track-item">
            <div class="track-cover">
                ${track.image ? `<img src="${track.image}" alt="${escapeHtml(track.name)}">` : '🎵'}
            </div>
            <div class="track-info">
                <div class="track-name">${escapeHtml(track.name)}</div>
                <div class="track-artist">${escapeHtml(track.artist)}</div>
            </div>
            <div class="track-actions">
                <button class="track-btn track-btn-queue" onclick='addToQueue(${JSON.stringify(track.uri)}, ${JSON.stringify(track.name)}, ${JSON.stringify(track.artist)}, event)'>Queue</button>
                <button class="track-btn track-btn-playlist" onclick='addToPlaylist(${JSON.stringify(track.uri)}, ${JSON.stringify(track.name)}, ${JSON.stringify(track.artist)}, event)'>Otera</button>
            </div>
        </div>
    `).join('');
}

// Ajouter à la queue
async function addToQueue(uri, name, artist, event) {
    if (event) event.stopPropagation();
    
    try {
        safeHaptic('impactOccurred', 'medium');
        
        const response = await fetch(CONFIG.N8N_WEBHOOK_BASE, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Accept': 'application/json' 
            },
            body: JSON.stringify({ 
                action: 'add',
                uri: uri,
                name: name,
                artist: artist
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        debugLog('Add response', data);
        
        if (data.status === 'ok') {
            showToast(`✓ "${name}" ajouté à la queue`);
            safeHaptic('notificationOccurred', 'success');
        } else {
            throw new Error(data.message || 'Erreur lors de l\'ajout');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showToast(`❌ ${error.message}`);
        safeHaptic('notificationOccurred', 'error');
    }
}

// Ajouter à la playlist
async function addToPlaylist(uri, name, artist, event) {
    if (event) event.stopPropagation();
    
    try {
        safeHaptic('impactOccurred', 'medium');
        
        const response = await fetch(CONFIG.N8N_WEBHOOK_BASE, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Accept': 'application/json' 
            },
            body: JSON.stringify({ 
                action: 'addToPlaylist',
                uri: uri,
                name: name,
                artist: artist,
                playlist_id: CONFIG.PLAYLIST_ID
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        debugLog('Add to playlist response', data);
        
        if (data.status === 'ok') {
            showToast(`✓ "${name}" ajouté à Otera`);
            safeHaptic('notificationOccurred', 'success');
        } else {
            throw new Error(data.message || 'Erreur lors de l\'ajout');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showToast(`❌ ${error.message}`);
        safeHaptic('notificationOccurred', 'error');
    }
}

// Toggle playlist
async function togglePlaylist() {
    safeHaptic('impactOccurred', 'light');
    playlistVisible = !playlistVisible;
    
    if (playlistVisible) {
        results.classList.remove('active');
        playlistSection.classList.add('active');
        searchInput.value = '';
        await loadPlaylist();
    } else {
        playlistSection.classList.remove('active');
    }
}

// Charger la playlist
async function loadPlaylist() {
    try {
        playlistTracks.innerHTML = '<div class="loading"><div class="loading-spinner"></div>Chargement...</div>';
        
        const payload = {
            action: 'getPlaylist',
            playlist_id: CONFIG.PLAYLIST_ID
        };
        
        debugLog('🔵 GetPlaylist payload', payload);
        
        const response = await fetch(CONFIG.N8N_WEBHOOK_BASE, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json' 
            },
            body: JSON.stringify(payload)
        });
        
        debugLog('🟢 GetPlaylist response status', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            debugLog('❌ GetPlaylist error response', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        debugLog('✅ GetPlaylist data', data);
        
        if (data.status === 'ok' && data.tracks) {
            displayPlaylistTracks(data.tracks, data.total || 0);
        } else {
            throw new Error('Invalid response format');
        }
    } catch (error) {
        console.error('Erreur:', error);
        playlistTracks.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><p>Erreur: ${error.message}</p></div>`;
        showToast(`❌ ${error.message}`);
    }
}

// Afficher les tracks de la playlist
function displayPlaylistTracks(tracks, total) {
    const countElement = document.getElementById('playlistCount');
    if (countElement) {
        countElement.textContent = `${total} titre${total > 1 ? 's' : ''}`;
    }
    
    if (!tracks || tracks.length === 0) {
        playlistTracks.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><p>La playlist est vide</p></div>';
        return;
    }
    
    playlistTracks.innerHTML = tracks.map((track, index) => `
        <div class="track-item" id="track-${track.uri.split(':')[2]}">
            <div class="track-cover">
                ${track.image ? `<img src="${track.image}" alt="${escapeHtml(track.name)}">` : '🎵'}
            </div>
            <div class="track-info">
                <div class="track-name">${track.position + 1}. ${escapeHtml(track.name)}</div>
                <div class="track-artist">${escapeHtml(track.artist)}</div>
            </div>
            <div class="track-actions">
                <button class="track-btn track-btn-queue" onclick='addToQueue(${JSON.stringify(track.uri)}, ${JSON.stringify(track.name)}, ${JSON.stringify(track.artist)}, event)'>Queue</button>
                <button class="track-btn track-btn-delete" onclick='deleteFromPlaylist(${JSON.stringify(track.uri)}, ${JSON.stringify(track.name)}, ${track.position}, event)'>🗑️ Delete</button>
            </div>
        </div>
    `).join('');
}

// Suivre la playlist sur Spotify
function followPlaylist() {
    try {
        safeHaptic('impactOccurred', 'medium');
        window.open(`https://open.spotify.com/playlist/${CONFIG.PLAYLIST_ID}`, '_blank');
        showToast(`📱 Ouverture de Spotify...`);
        safeHaptic('notificationOccurred', 'success');
    } catch (error) {
        console.error('Erreur:', error);
        showToast(`❌ ${error.message}`);
        safeHaptic('notificationOccurred', 'error');
    }
}

// Supprimer une track de la playlist
async function deleteFromPlaylist(uri, name, position, event) {
    if (event) event.stopPropagation();
    
    try {
        safeHaptic('impactOccurred', 'medium');
        
        const payload = {
            action: 'deleteTrack',
            uri: uri,
            playlist_id: CONFIG.PLAYLIST_ID,
            position: position
        };
        
        debugLog('🔵 DeleteTrack payload', payload);
        
        const response = await fetch(CONFIG.N8N_WEBHOOK_BASE, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Accept': 'application/json' 
            },
            body: JSON.stringify(payload)
        });
        
        debugLog('🟢 DeleteTrack response status', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            debugLog('❌ DeleteTrack error response', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        debugLog('✅ DeleteTrack data', data);
        
        if (data.status === 'ok') {
            // Animation de suppression
            const trackId = uri.split(':')[2];
            const trackElement = document.getElementById(`track-${trackId}`);
            if (trackElement) {
                trackElement.style.opacity = '0';
                trackElement.style.transform = 'translateX(-100%)';
                trackElement.style.transition = 'all 0.3s ease';
                setTimeout(() => {
                    loadPlaylist(); // Recharger la playlist
                }, 300);
            }
            
            showToast(`✓ "${name}" supprimé de la playlist`);
            safeHaptic('notificationOccurred', 'success');
        } else {
            throw new Error(data.message || 'Erreur lors de la suppression');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showToast(`❌ ${error.message}`);
        safeHaptic('notificationOccurred', 'error');
    }
}

// Charger la musique en cours
async function loadNowPlaying() {
    try {
        safeHaptic('impactOccurred', 'light');
        const content = document.getElementById('nowPlayingContent');
        
        // Vérifier que l'élément existe
        if (!content) {
            console.error('Element nowPlayingContent not found');
            return;
        }
        
        content.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
        
        const payload = {
            action: 'nowPlaying'
        };
        
        debugLog('🔵 NowPlaying payload', payload);
        
        const response = await fetch(CONFIG.N8N_WEBHOOK_BASE, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json' 
            },
            body: JSON.stringify(payload)
        });
        
        debugLog('🟢 NowPlaying response status', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            debugLog('❌ NowPlaying error response', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        debugLog('✅ NowPlaying data', data);
        
        if (data.status === 'ok' && data.track && data.track.is_playing) {
            content.innerHTML = `
                <div class="now-playing-content">
                    <div class="now-playing-cover">
                        ${data.track.image ? `<img src="${data.track.image}" alt="${escapeHtml(data.track.name)}">` : '🎵'}
                    </div>
                    <div class="now-playing-info">
                        <div class="now-playing-track">${escapeHtml(data.track.name)}</div>
                        <div class="now-playing-artist">${escapeHtml(data.track.artist)}</div>
                    </div>
                </div>
            `;
            showToast(`🎧 ${data.track.name}`);
        } else {
            content.innerHTML = '<div class="now-playing-empty">Aucune lecture en cours</div>';
        }
    } catch (error) {
        console.error('Erreur:', error);
        const content = document.getElementById('nowPlayingContent');
        if (content) {
            content.innerHTML = `<div class="now-playing-empty">❌ ${error.message}</div>`;
        }
        showToast(`❌ ${error.message}`);
    }
}

// Afficher un toast
// Afficher un toast avec support des types (success/error/info)
function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    
    // Réinitialise les classes et ajoute le type
    toast.className = 'show';
    if (type) toast.classList.add(`toast-${type}`);
    
    setTimeout(() => {
        toast.classList.remove('show', `toast-${type}`);
    }, 3000);
}


// Échapper HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialisation au chargement
setTimeout(() => {
    loadNowPlaying();
    const userName = tg.initDataUnsafe?.user?.first_name;
    if (userName) setTimeout(() => showToast(`👋 Salut ${userName} !`), 1000);
}, 500);

// Auto-refresh toutes les 30 secondes
setInterval(() => {
    if (!results.classList.contains('active')) loadNowPlaying();
}, 30000);
// ============================================
// PLAYBACK CONTROLS (VERSION FINALE)
// ============================================

const PLAYBACK_WEBHOOK = 'https://n8n-seb.sandbox-jerem.com/webhook/playback-control';

async function togglePlayPause() {
    const playIcon = document.getElementById('playIcon');
    const pauseIcon = document.getElementById('pauseIcon');
    const btn = document.getElementById('playPauseBtn');
    
    if (!playIcon || !pauseIcon || !btn) return;
    
    const isPlaying = playIcon.style.display === 'none';
    
    try {
        const response = await fetch(PLAYBACK_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: isPlaying ? 'pause' : 'play'
            })
        });

        if (response.ok) {
            if (isPlaying) {
                // Actuellement en lecture → Pause
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
                btn.classList.remove('playing');
            } else {
                // Actuellement en pause → Play
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
                btn.classList.add('playing');
            }
            showToast(isPlaying ? '⏸️ Musique en pause' : '▶️ Lecture en cours', 'success');
        } else {
            showToast('❌ Erreur de lecture', 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showToast('❌ Erreur de connexion', 'error');
    }
}

async function nextTrack() {
    try {
        const response = await fetch(PLAYBACK_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'skip' })
        });

        if (response.ok) {
            showToast('⏭️ Piste suivante', 'success');
        } else {
            showToast('❌ Erreur de saut', 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showToast('❌ Erreur de connexion', 'error');
    }
}

async function previousTrack() {
    try {
        const response = await fetch(PLAYBACK_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'previous' })
        });

        if (response.ok) {
            showToast('⏮️ Piste précédente', 'success');
            // ❌ SUPPRIMÉ : setTimeout(getCurrentTrack, 500);
        } else {
            showToast('❌ Erreur de retour', 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showToast('❌ Erreur de connexion', 'error');
    }
}
// ============================================
// ADVANCED PLAYBACK CONTROLS
// ============================================

// États globaux
let currentShuffle = false;
let currentRepeat = 'off'; // 'off', 'track', 'context'

// ============================================
// VOLUME CONTROL
// ============================================

let isMuted = false;
let previousVolume = 50;

function updateVolume(value) {
    const slider = document.getElementById('volumeSlider');
    const valueDisplay = document.getElementById('volumeValue');
    
    if (slider) {
        const percentage = value + '%';
        slider.style.setProperty('--volume-percentage', percentage);
        if (!isMuted) {
            previousVolume = parseInt(value);
        }
    }
    
    if (valueDisplay) {
        valueDisplay.textContent = value;
    }
}

function toggleMute() {
    const volumeIcon = document.getElementById('volumeIcon');
    const mutedIcon = document.getElementById('mutedIcon');
    const slider = document.getElementById('volumeSlider');
    const valueDisplay = document.getElementById('volumeValue');
    
    if (!volumeIcon || !mutedIcon || !slider) return;
    
    isMuted = !isMuted;
    
    if (isMuted) {
        // Muter
        previousVolume = parseInt(slider.value);
        slider.value = 0;
        updateVolume(0);
        volumeIcon.style.display = 'none';
        mutedIcon.style.display = 'block';
        setVolume(0);
    } else {
        // Démuter
        slider.value = previousVolume || 50;
        updateVolume(previousVolume || 50);
        volumeIcon.style.display = 'block';
        mutedIcon.style.display = 'none';
        setVolume(previousVolume || 50);
    }
}


async function setVolume(volume) {
    try {
        const response = await fetch(PLAYBACK_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'volume',
                value: parseInt(volume)
            })
        });

        if (response.ok) {
            showToast(`🔊 Volume: ${volume}%`, 'success');
        } else {
            showToast('❌ Erreur de volume', 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showToast('❌ Erreur de connexion', 'error');
    }
}

// ============================================
// SHUFFLE TOGGLE
// ============================================

async function toggleShuffle() {
    const btn = document.getElementById('shuffleBtn');
    if (!btn) return;
    
    currentShuffle = !currentShuffle;
    
    try {
        const response = await fetch(PLAYBACK_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'shuffle',
                value: currentShuffle
            })
        });

        if (response.ok) {
            btn.classList.toggle('active', currentShuffle);
            showToast(currentShuffle ? '🔀 Shuffle activé' : '🔀 Shuffle désactivé', 'success');
        } else {
            showToast('❌ Erreur shuffle', 'error');
            currentShuffle = !currentShuffle; // Rollback
        }
    } catch (error) {
        console.error('Erreur:', error);
        showToast('❌ Erreur de connexion', 'error');
        currentShuffle = !currentShuffle; // Rollback
    }
}

// ============================================
// REPEAT MODE CYCLE
// ============================================

async function toggleRepeat() {
    const btn = document.getElementById('repeatBtn');
    if (!btn) return;
    
    // Cycle: off → context → track → off
    const modes = {
        'off': 'context',
        'context': 'track',
        'track': 'off'
    };
    
    const labels = {
        'off': 'Répéter: OFF',
        'context': 'Répéter: Playlist',
        'track': 'Répéter: Piste'
    };
    
    const nextMode = modes[currentRepeat];
    
    try {
        const response = await fetch(PLAYBACK_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'repeat',
                value: nextMode
            })
        });

        if (response.ok) {
            currentRepeat = nextMode;
            btn.classList.toggle('active', nextMode !== 'off');
            showToast(labels[nextMode], 'success');
        } else {
            showToast('❌ Erreur repeat', 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showToast('❌ Erreur de connexion', 'error');
    }
}

// ============================================
// INITIALISATION DES EVENT LISTENERS
// ============================================

function initAdvancedControls() {
    // Volume Slider
    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
        // Mise à jour du display en temps réel
        volumeSlider.addEventListener('input', (e) => {
            updateVolume(e.target.value);
        });
        
        // Envoi à Spotify au relâchement
        volumeSlider.addEventListener('change', (e) => {
            setVolume(e.target.value);
        });
        
        // Initialisation
        updateVolume(volumeSlider.value);
    }
    
    // Shuffle Button
    const shuffleBtn = document.getElementById('shuffleBtn');
    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', toggleShuffle);
    }
    
    // Repeat Button
    const repeatBtn = document.getElementById('repeatBtn');
    if (repeatBtn) {
        repeatBtn.addEventListener('click', toggleRepeat);
    }
}

// ============================================
// INITIALISATION AU CHARGEMENT
// ============================================

// Ajoute cette ligne à ton DOMContentLoaded existant ou crée-le s'il n'existe pas
document.addEventListener('DOMContentLoaded', () => {
    initAdvancedControls();
    
    // ... ton autre code d'initialisation existant
});
