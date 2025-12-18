// Streamiz Admin Dashboard
// Clean, simple admin interface for managing content

let currentItem = null;
let currentEpisodes = [];

// ============================================
// NAVIGATION & VIEW SWITCHING
// ============================================

function switchView(view) {
    document.getElementById('searchView').style.display = view === 'search' ? 'block' : 'none';
    document.getElementById('libraryView').style.display = view === 'library' ? 'block' : 'none';

    document.getElementById('btnSearch').className = `btn ${view === 'search' ? 'btn-primary' : 'btn-secondary'}`;
    document.getElementById('btnLibrary').className = `btn ${view === 'library' ? 'btn-primary' : 'btn-secondary'}`;

    if (view === 'library') {
        loadLibrary();
    }
}

// ============================================
// SEARCH TMDB
// ============================================

async function searchTMDB() {
    const query = document.getElementById('tmdbSearch').value.trim();
    const type = document.getElementById('mediaType').value;
    const container = document.getElementById('searchResults');

    if (!query) {
        alert('Please enter a search term');
        return;
    }

    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const data = await API.search(query, type);

        if (!data.results || data.results.length === 0) {
            container.innerHTML = '<p style="color: #888;">No results found.</p>';
            return;
        }

        container.innerHTML = data.results.map(item => `
            <div class="search-result-card" onclick='selectItem(${JSON.stringify(item).replace(/'/g, "&#39;")}, "${type}")'>
                <img src="${API.getImageUrl(item.poster_path)}" alt="${item.title || item.name}">
                <div class="search-result-info">
                    <h4>${item.title || item.name}</h4>
                    <p>${(item.release_date || item.first_air_date || '').split('-')[0] || 'N/A'}</p>
                </div>
            </div>
        `).join('');

    } catch (e) {
        console.error('Search error:', e);
        container.innerHTML = '<p style="color: #ef4444;">Search failed. Please try again.</p>';
    }
}

// Search on Enter key
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('tmdbSearch');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchTMDB();
        });
    }
});

// ============================================
// LIBRARY VIEW
// ============================================

async function loadLibrary() {
    const container = document.getElementById('libraryList');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    await DB.ready;

    const movies = DB.getMovies();
    const tvShows = DB.getTVShows();

    const allItems = [
        ...movies.map(m => ({ ...m, _type: 'movie' })),
        ...tvShows.map(t => ({ ...t, _type: 'tv' }))
    ];

    if (allItems.length === 0) {
        container.innerHTML = '<p style="color: #888; grid-column: 1/-1; text-align: center;">No content added yet. Use "Add New" to search and add content.</p>';
        return;
    }

    // Hydrate with TMDB data
    const hydrated = await Promise.all(
        allItems.map(async item => {
            try {
                const details = await API.getDetails(item.tmdbId, item._type);
                return { ...item, ...details };
            } catch {
                return { ...item, title: 'Unknown', name: 'Unknown', poster_path: null };
            }
        })
    );

    container.innerHTML = hydrated.map(item => `
        <div class="search-result-card" style="cursor: default;">
            <img src="${API.getImageUrl(item.poster_path)}" alt="${item.title || item.name}">
            <div class="search-result-info">
                <h4>${item.title || item.name}</h4>
                <p style="font-size: 0.8rem; color: #888;">${item._type === 'movie' ? '🎬 Movie' : '📺 TV Show'}</p>
                <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                    <button onclick="editItem('${item.tmdbId}', '${item._type}')" class="btn btn-primary" style="flex: 1; padding: 0.4rem; font-size: 0.8rem;">Edit</button>
                    <button onclick="deleteItem('${item.tmdbId}', '${item._type}')" class="btn btn-red" style="flex: 1; padding: 0.4rem; font-size: 0.8rem;">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

// ============================================
// EDITOR MODAL
// ============================================

function selectItem(item, type) {
    currentItem = { ...item, _type: type };
    currentEpisodes = [];
    openEditor();
}

async function editItem(tmdbId, type) {
    try {
        const details = await API.getDetails(tmdbId, type);
        currentItem = { ...details, _type: type };

        // Load existing data
        if (type === 'movie') {
            const existing = DB.getMovie(tmdbId);
            if (existing && existing.sources) {
                currentItem._existingSources = existing.sources;
            }
        } else {
            const existing = DB.getTVShow(tmdbId);
            if (existing && existing.seasons) {
                currentEpisodes = [];
                existing.seasons.forEach(s => {
                    s.episodes.forEach(e => {
                        currentEpisodes.push({
                            season: s.season_number,
                            episode: e.episode_number,
                            sources: e.sources || []
                        });
                    });
                });
            }
        }

        openEditor();
    } catch (e) {
        alert('Failed to load item details');
    }
}

function openEditor() {
    const modal = document.getElementById('editorModal');
    modal.style.display = 'flex';

    document.getElementById('modalTitle').textContent = `Edit: ${currentItem.title || currentItem.name}`;

    if (currentItem._type === 'movie') {
        document.getElementById('movieEditor').style.display = 'block';
        document.getElementById('tvEditor').style.display = 'none';

        // Load existing sources or add empty one
        const container = document.getElementById('movieSourcesList');
        container.innerHTML = '';

        if (currentItem._existingSources && currentItem._existingSources.length > 0) {
            currentItem._existingSources.forEach(s => addSourceRow('movieSourcesList', s.quality, s.url));
        } else {
            addSourceRow('movieSourcesList', '1080p', '');
        }
    } else {
        document.getElementById('movieEditor').style.display = 'none';
        document.getElementById('tvEditor').style.display = 'block';

        // Reset episode inputs
        document.getElementById('seasonNum').value = '1';
        document.getElementById('episodeNum').value = '1';
        document.getElementById('tvSourcesList').innerHTML = '';
        addSourceRow('tvSourcesList', '1080p', '');

        renderEpisodeList();
    }
}

function closeModal() {
    document.getElementById('editorModal').style.display = 'none';
    currentItem = null;
    currentEpisodes = [];
}

// ============================================
// SOURCE MANAGEMENT
// ============================================

function addSourceRow(containerId, quality = '', url = '') {
    const container = document.getElementById(containerId);
    const div = document.createElement('div');
    div.className = 'source-row';
    div.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 0.5rem;';
    div.innerHTML = `
        <input type="text" class="source-quality" placeholder="Quality (e.g. 1080p)" value="${quality}" style="width: 120px;">
        <input type="text" class="source-url" placeholder="Video URL (CDN link)" value="${url}" style="flex: 1;">
        <button onclick="this.parentElement.remove()" class="btn btn-red" style="padding: 0 0.8rem;">×</button>
    `;
    container.appendChild(div);
}

function getSourcesFromContainer(containerId) {
    const container = document.getElementById(containerId);
    const sources = [];

    container.querySelectorAll('.source-row').forEach(row => {
        const quality = row.querySelector('.source-quality').value.trim();
        const url = row.querySelector('.source-url').value.trim();
        if (quality && url) {
            sources.push({ quality, url });
        }
    });

    return sources;
}

// ============================================
// TV EPISODE MANAGEMENT
// ============================================

function addEpisode() {
    const season = parseInt(document.getElementById('seasonNum').value);
    const episode = parseInt(document.getElementById('episodeNum').value);
    const sources = getSourcesFromContainer('tvSourcesList');

    if (!season || !episode) {
        alert('Please enter season and episode numbers');
        return;
    }

    if (sources.length === 0) {
        alert('Please add at least one video source');
        return;
    }

    // Check if episode exists
    const existingIdx = currentEpisodes.findIndex(e => e.season === season && e.episode === episode);

    if (existingIdx >= 0) {
        currentEpisodes[existingIdx].sources = sources;
    } else {
        currentEpisodes.push({ season, episode, sources });
    }

    // Auto-increment episode number
    document.getElementById('episodeNum').value = episode + 1;

    // Reset sources
    document.getElementById('tvSourcesList').innerHTML = '';
    addSourceRow('tvSourcesList', '1080p', '');

    renderEpisodeList();
}

function removeEpisode(index) {
    currentEpisodes.splice(index, 1);
    renderEpisodeList();
}

function renderEpisodeList() {
    const container = document.getElementById('addedEpisodes');

    if (currentEpisodes.length === 0) {
        container.innerHTML = '<p style="color: #666; font-size: 0.9rem;">No episodes added yet.</p>';
        return;
    }

    // Sort by season then episode
    const sorted = [...currentEpisodes].sort((a, b) =>
        (a.season - b.season) || (a.episode - b.episode)
    );

    container.innerHTML = sorted.map((ep, idx) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: #222; border-radius: 4px; margin-bottom: 0.5rem;">
            <div>
                <span style="color: #eab308; font-weight: bold;">S${ep.season} E${ep.episode}</span>
                <span style="color: #666; font-size: 0.8rem; margin-left: 0.5rem;">
                    ${ep.sources.length} source(s)
                </span>
            </div>
            <button onclick="removeEpisode(${idx})" class="btn btn-red" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">Remove</button>
        </div>
    `).join('');
}

// ============================================
// SAVE & DELETE
// ============================================

async function saveContent() {
    if (!currentItem) return;

    const saveBtn = document.querySelector('#editorModal .btn-primary:last-child');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    try {
        if (currentItem._type === 'movie') {
            const sources = getSourcesFromContainer('movieSourcesList');

            if (sources.length === 0) {
                alert('Please add at least one video source');
                return;
            }

            await DB.saveMovie({
                tmdbId: currentItem.id,
                sources: sources
            });

        } else {
            if (currentEpisodes.length === 0) {
                alert('Please add at least one episode');
                return;
            }

            // Convert flat episode list to seasons structure
            const seasonsMap = {};
            currentEpisodes.forEach(ep => {
                if (!seasonsMap[ep.season]) {
                    seasonsMap[ep.season] = [];
                }
                seasonsMap[ep.season].push({
                    episode_number: ep.episode,
                    sources: ep.sources
                });
            });

            const seasons = Object.entries(seasonsMap).map(([num, episodes]) => ({
                season_number: parseInt(num),
                episodes: episodes
            }));

            await DB.saveTVShow({
                tmdbId: currentItem.id,
                seasons: seasons
            });
        }

        alert('✅ Saved successfully!');
        closeModal();

        // Refresh library if visible
        if (document.getElementById('libraryView').style.display !== 'none') {
            loadLibrary();
        }

    } catch (e) {
        console.error('Save error:', e);
        alert('❌ Failed to save: ' + e.message);
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

async function deleteItem(tmdbId, type) {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
        if (type === 'movie') {
            await DB.deleteMovie(tmdbId);
        } else {
            await DB.deleteTVShow(tmdbId);
        }

        alert('✅ Deleted successfully!');
        loadLibrary();

    } catch (e) {
        console.error('Delete error:', e);
        alert('❌ Failed to delete: ' + e.message);
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function publishChanges() {
    alert('✅ All changes are automatically saved to Supabase in real-time!');
}

async function handleImport(input) {
    if (input.files.length === 0) return;

    try {
        const text = await input.files[0].text();
        const data = JSON.parse(text);

        let count = 0;
        if (data.movies) {
            for (const movie of data.movies) {
                await DB.saveMovie(movie);
                count++;
            }
        }
        if (data.tv) {
            for (const show of data.tv) {
                await DB.saveTVShow(show);
                count++;
            }
        }

        alert(`✅ Imported ${count} items successfully!`);
        loadLibrary();

    } catch (e) {
        alert('❌ Import failed: ' + e.message);
    }
}

async function forceRefresh() {
    await DB.refresh();
    alert('✅ Data refreshed from Supabase!');
    if (document.getElementById('libraryView').style.display !== 'none') {
        loadLibrary();
    }
}
