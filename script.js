// Configuration
const CONFIG = {
    N8N_WEBHOOK_SEARCH: 'https://n8n-seb.sandbox-jerem.com/webhook/spotify-search',
    N8N_WEBHOOK_ADD: 'https://n8n-seb.sandbox-jerem.com/webhook/spotify-add',
    N8N_WEBHOOK_ADD_PLAYLIST: 'https://n8n-seb.sandbox-jerem.com/webhook/spotify-add-playlist',
    N8N_WEBHOOK_GET_PLAYLIST: 'https://n8n-seb.sandbox-jerem.com/webhook-test/spotify-get-playlist',
    N8N_WEBHOOK_NOW_PLAYING: 'https://n8n-seb.sandbox-jerem.com/webhook/spotify-now-playing',
    PLAYLIST_ID: '0TLNSXMwwnAPQQaPp5UPZS'
};

const DEBUG = false;

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
        const url = `${CONFIG.N8N_WEBHOOK_SEARCH}?q=${encodeURIComponent(query)}`;
        const response = await fetch(url, { 
            method: 'GET', 
            headers: { 'Accept': 'application/json' } 
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        displayTracks(data.tracks || []);
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
        const userId = tg.initDataUnsafe?.user?.id || 'demo';
        
        const response = await fetch(CONFIG.N8N_WEBHOOK_ADD, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Accept': 'application/json' 
            },
            body: JSON.stringify({ 
                user_id: userId, 
                track_uri: uri, 
                track_name: name, 
                track_artist: artist 
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const responseText = await response.text();
        if (responseText?.trim()) {
            try { JSON.parse(responseText); } catch (e) {}
        }
        
        showToast(`✓ "${name}" ajouté à la queue`);
        safeHaptic('notificationOccurred', 'success');
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
        const userId = tg.initDataUnsafe?.user?.id || 'demo';
        
        const response = await fetch(CONFIG.N8N_WEBHOOK_ADD_PLAYLIST, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Accept': 'application/json' 
            },
            body: JSON.stringify({ 
                user_id: userId, 
                track_uri: uri, 
                track_name: name, 
                track_artist: artist, 
                playlist_id: CONFIG.PLAYLIST_ID 
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const responseText = await response.text();
        if (responseText?.trim()) {
            try {
                const result = JSON.parse(responseText);
                if (result.error) throw new Error(result.error);
            } catch (e) {}
        }
        
        showToast(`✓ "${name}" ajouté à Otera`);
        safeHaptic('notificationOccurred', 'success');
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
        
        const url = `${CONFIG.N8N_WEBHOOK_GET_PLAYLIST}?playlist_id=${CONFIG.PLAYLIST_ID}`;
        const response = await fetch(url, { 
            method: 'GET', 
            headers: { 'Accept': 'application/json' } 
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        displayPlaylistTracks(data.tracks || [], data.total || 0);
    } catch (error) {
        console.error('Erreur:', error);
        playlistTracks.innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><p>Erreur: ${error.message}</p></div>`;
        showToast(`❌ ${error.message}`);
    }
}

// Afficher les tracks de la playlist
function displayPlaylistTracks(tracks, total) {
    document.getElementById('playlistCount').textContent = `${total} titre${total > 1 ? 's' : ''}`;
    
    if (!tracks || tracks.length === 0) {
        playlistTracks.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><p>La playlist est vide</p></div>';
        return;
    }
    
    playlistTracks.innerHTML = tracks.map((track, index) => `
        <div class="track-item">
            <div class="track-cover">
                ${track.image ? `<img src="${track.image}" alt="${escapeHtml(track.name)}">` : '🎵'}
            </div>
            <div class="track-info">
                <div class="track-name">${index + 1}. ${escapeHtml(track.name)}</div>
                <div class="track-artist">${escapeHtml(track.artist)}</div>
            </div>
            <div class="track-actions">
                <button class="track-btn track-btn-queue" onclick='addToQueue(${JSON.stringify(track.uri)}, ${JSON.stringify(track.name)}, ${JSON.stringify(track.artist)}, event)'>Queue</button>
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

// Charger la musique en cours
async function loadNowPlaying() {
    try {
        safeHaptic('impactOccurred', 'light');
        const content = document.getElementById('nowPlayingContent');
        content.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
        
        const response = await fetch(CONFIG.N8N_WEBHOOK_NOW_PLAYING, { 
            method: 'GET', 
            headers: { 'Accept': 'application/json' } 
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        if (data.playing && data.track) {
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
            showToast('Aucune lecture en cours');
        }
    } catch (error) {
        console.error('Erreur:', error);
        document.getElementById('nowPlayingContent').innerHTML = `<div class="now-playing-empty">❌ ${error.message}</div>`;
        showToast(`❌ ${error.message}`);
    }
}

// Afficher un toast
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
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
