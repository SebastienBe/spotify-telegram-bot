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
function showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
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
