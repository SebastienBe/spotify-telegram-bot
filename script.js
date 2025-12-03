// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    N8N_WEBHOOK_BASE: 'https://n8n-seb.sandbox-jerem.com/webhook-test/spotify-bot',
    PLAYLIST_ID: '0TLNSXMwwnAPQQaPp5UPZS',
    DEMO_MODE: false
};

const DEBUG = true;

function debugLog(message, data) {
    if (DEBUG) console.log(`[DEBUG] ${message}`, data || '');
}

// ============================================
// TELEGRAM WEB APP
// ============================================
let tg;
try {
    tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();
    
    // Configuration du thème
    tg.setHeaderColor('#1a1a1a');
    tg.setBackgroundColor('#121212');
    
    debugLog('Telegram WebApp initialisé', {
        user: tg.initDataUnsafe?.user,
        platform: tg.platform,
        version: tg.version
    });
} catch (error) {
    console.error('Erreur init Telegram:', error);
    tg = {
        initDataUnsafe: { user: { id: 'demo', first_name: 'Demo' } },
        HapticFeedback: {
            impactOccurred: () => {},
            notificationOccurred: () => {},
            selectionChanged: () => {}
        },
        platform: 'unknown',
        ready: () => {},
        expand: () => {}
    };
}

// ============================================
// HAPTIC FEEDBACK
// ============================================
function safeHaptic(action, style) {
    try {
        if (!tg?.HapticFeedback || typeof tg.HapticFeedback[action] !== "function") return;
        
        if (action === 'impactOccurred' && style) {
            try {
                tg.HapticFeedback[action](style);
            } catch (e) {
                tg.HapticFeedback[action]();
            }
        } else if (action === 'notificationOccurred' && style) {
            try {
                tg.HapticFeedback[action](style);
            } catch (e) {
                tg.HapticFeedback[action]();
            }
        } else {
            tg.HapticFeedback[action]();
        }
    } catch (error) {
        debugLog('Haptic error', error.message);
    }
}

// ============================================
// API N8N - FONCTION GÉNÉRIQUE
// ============================================
async function callN8N(action, payload = {}) {
    debugLog(`Appel n8n - Action: ${action}`, payload);
    
    try {
        const body = {
            action,
            userId: tg.initDataUnsafe?.user?.id || 'demo',
            ...payload
        };
        
        debugLog('Request body', body);
        
        const response = await fetch(CONFIG.N8N_WEBHOOK_BASE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        debugLog('Response status', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            debugLog('Error response', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        debugLog('Response data', data);
        
        if (data.status === 'error') {
            throw new Error(data.message || 'Erreur inconnue');
        }
        
        return data;
    } catch (error) {
        console.error(`❌ Erreur ${action}:`, error);
        throw error;
    }
}

// ============================================
// SEARCH - RECHERCHE DE TRACKS
// ============================================
async function searchTracks(query) {
    const trackList = document.getElementById('trackList');
    
    if (!query || query.trim() === '') {
        trackList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <p>Tapez quelque chose pour rechercher</p>
            </div>
        `;
        return;
    }
    
    // Loader
    trackList.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Recherche en cours...</p>
        </div>
    `;
    
    try {
        safeHaptic('impactOccurred', 'light');
        const data = await callN8N('search', { q: query });
        
        if (!data.tracks || data.tracks.length === 0) {
            trackList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">😕</div>
                    <p>Aucun résultat pour "${query}"</p>
                </div>
            `;
            return;
        }
        
        displayTracks(data.tracks);
        safeHaptic('notificationOccurred', 'success');
    } catch (error) {
        trackList.innerHTML = `
            <div class="empty-state error">
                <div class="empty-state-icon">❌</div>
                <p>Erreur: ${error.message}</p>
                <button onclick="searchTracks('${escapeHtml(query)}')" class="retry-btn">Réessayer</button>
            </div>
        `;
        safeHaptic('notificationOccurred', 'error');
        showToast(`❌ ${error.message}`);
    }
}

// ============================================
// DISPLAY TRACKS - AFFICHAGE RÉSULTATS
// ============================================
function displayTracks(tracks) {
    const trackList = document.getElementById('trackList');
    
    trackList.innerHTML = tracks.map((track, index) => `
        <div class="track-item" data-index="${index}">
            <img src="${track.image || 'https://via.placeholder.com/60'}" 
                 alt="${escapeHtml(track.name)}"
                 onerror="this.src='https://via.placeholder.com/60'">
            <div class="track-info">
                <div class="track-name">${escapeHtml(track.name)}</div>
                <div class="track-artist">${escapeHtml(track.artist)}</div>
                <div class="track-duration">${formatDuration(track.duration)}</div>
            </div>
            <button class="add-btn" 
                    onclick="addToQueue('${escapeHtml(track.uri)}', \`${escapeHtml(track.name)}\`, \`${escapeHtml(track.artist)}\`, event)"
                    title="Ajouter à la queue">
                <span class="add-icon">+</span>
            </button>
        </div>
    `).join('');
}

// ============================================
// ADD TO QUEUE - AJOUTER UN TRACK
// ============================================
async function addToQueue(uri, name, artist, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    debugLog('Add to queue', { uri, name, artist });
    
    const button = event?.target.closest('.add-btn');
    if (button) {
        button.disabled = true;
        button.innerHTML = '<div class="spinner-small"></div>';
    }
    
    try {
        safeHaptic('impactOccurred', 'medium');
        
        await callN8N('add', { 
            uri, 
            name,
            artist 
        });
        
        showToast(`✓ "${name}" ajouté à la queue`);
        safeHaptic('notificationOccurred', 'success');
        
        if (button) {
            button.innerHTML = '✓';
            button.classList.add('success');
            setTimeout(() => {
                button.innerHTML = '<span class="add-icon">+</span>';
                button.classList.remove('success');
                button.disabled = false;
            }, 2000);
        }
    } catch (error) {
        showToast(`❌ Erreur: ${error.message}`);
        safeHaptic('notificationOccurred', 'error');
        
        if (button) {
            button.innerHTML = '<span class="add-icon">+</span>';
            button.disabled = false;
        }
    }
}

// ============================================
// NOW PLAYING - LECTURE EN COURS
// ============================================
async function updateNowPlaying() {
    const nowPlayingEl = document.getElementById('nowPlaying');
    
    try {
        const data = await callN8N('nowPlaying');
        
        if (!data.track || !data.track.name) {
            nowPlayingEl.innerHTML = `
                <div class="now-playing-empty">
                    <div class="empty-icon">🎵</div>
                    <p>Aucune lecture en cours</p>
                </div>
            `;
            return;
        }
        
        const track = data.track;
        const progress = (track.progress / track.duration) * 100;
        
        nowPlayingEl.innerHTML = `
            <div class="now-playing-container ${track.is_playing ? 'playing' : 'paused'}">
                <div class="now-playing-cover">
                    <img src="${track.image || 'https://via.placeholder.com/200'}" 
                         alt="${escapeHtml(track.name)}">
                    ${track.is_playing ? '<div class="playing-indicator"></div>' : ''}
                </div>
                <div class="now-playing-info">
                    <div class="now-playing-track">${escapeHtml(track.name)}</div>
                    <div class="now-playing-artist">${escapeHtml(track.artist)}</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="progress-time">
                        <span>${formatDuration(track.progress)}</span>
                        <span>${formatDuration(track.duration)}</span>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        debugLog('Erreur nowPlaying', error.message);
        nowPlayingEl.innerHTML = `
            <div class="now-playing-empty error">
                <div class="empty-icon">❌</div>
                <p>Erreur de connexion Spotify</p>
            </div>
        `;
    }
}

// ============================================
// PLAYLIST - AFFICHAGE PLAYLIST
// ============================================
async function loadPlaylist() {
    const playlistContainer = document.getElementById('playlistContainer');
    
    playlistContainer.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Chargement de la playlist...</p>
        </div>
    `;
    
    try {
        const data = await callN8N('getPlaylist', { 
            playlistId: CONFIG.PLAYLIST_ID 
        });
        
        if (!data.tracks || data.tracks.length === 0) {
            playlistContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <p>La playlist est vide</p>
                </div>
            `;
            return;
        }
        
        displayPlaylist(data.tracks);
    } catch (error) {
        playlistContainer.innerHTML = `
            <div class="empty-state error">
                <div class="empty-state-icon">❌</div>
                <p>Erreur: ${error.message}</p>
                <button onclick="loadPlaylist()" class="retry-btn">Réessayer</button>
            </div>
        `;
        showToast(`❌ ${error.message}`);
    }
}

function displayPlaylist(tracks) {
    const playlistContainer = document.getElementById('playlistContainer');
    
    playlistContainer.innerHTML = `
        <div class="playlist-header">
            <h3>Playlist (${tracks.length} tracks)</h3>
        </div>
        <div class="playlist-tracks">
            ${tracks.map((track, index) => `
                <div class="track-item playlist-track" data-position="${track.position || index}">
                    <div class="track-position">${index + 1}</div>
                    <img src="${track.image || 'https://via.placeholder.com/60'}" 
                         alt="${escapeHtml(track.name)}">
                    <div class="track-info">
                        <div class="track-name">${escapeHtml(track.name)}</div>
                        <div class="track-artist">${escapeHtml(track.artist)}</div>
                    </div>
                    <button class="delete-btn" 
                            onclick="deleteTrack('${escapeHtml(track.uri)}', ${track.position || index}, event)"
                            title="Supprimer">
                        🗑️
                    </button>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================================
// DELETE TRACK - SUPPRIMER UN TRACK
// ============================================
async function deleteTrack(uri, position, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    const confirmed = confirm('Supprimer ce track de la playlist ?');
    if (!confirmed) return;
    
    try {
        safeHaptic('impactOccurred', 'heavy');
        
        await callN8N('deleteTrack', { 
            uri,
            position,
            playlistId: CONFIG.PLAYLIST_ID 
        });
        
        showToast('✓ Track supprimé');
        safeHaptic('notificationOccurred', 'success');
        
        // Recharger la playlist
        setTimeout(loadPlaylist, 500);
    } catch (error) {
        showToast(`❌ ${error.message}`);
        safeHaptic('notificationOccurred', 'error');
    }
}

// ============================================
// UTILITAIRES
// ============================================
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/`/g, "&#96;");
}

function formatDuration(ms) {
    if (!ms) return '0:00';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ============================================
// TABS NAVIGATION
// ============================================
function switchTab(tabName) {
    safeHaptic('selectionChanged');
    
    // Cacher tous les contenus
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Désactiver tous les boutons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Activer le contenu et le bouton sélectionné
    const selectedContent = document.getElementById(`${tabName}-tab`);
    const selectedBtn = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
    
    if (selectedContent) selectedContent.classList.add('active');
    if (selectedBtn) selectedBtn.classList.add('active');
    
    // Charger les données si nécessaire
    if (tabName === 'playlist') {
        loadPlaylist();
    }
}

// ============================================
// INITIALISATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    debugLog('DOM loaded');
    
    // Input de recherche
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const query = searchInput?.value?.trim();
            if (query) searchTracks(query);
        });
    }
    
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) searchTracks(query);
            }
        });
        
        // Focus automatique
        searchInput.focus();
    }
    
    // Charger Now Playing
    updateNowPlaying();
    setInterval(updateNowPlaying, 5000);
    
    debugLog('App initialisée');
});
