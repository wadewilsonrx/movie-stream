// Streamiz Admin Dashboard
// Clean, simple admin interface for managing content

var currentItem = null;
var currentEpisodes = [];

// ============================================
// NAVIGATION & VIEW SWITCHING
// ============================================

function switchView(view) {
    document.getElementById('searchView').style.display = view === 'search' ? 'block' : 'none';
    document.getElementById('libraryView').style.display = view === 'library' ? 'block' : 'none';

    document.getElementById('btnSearch').className = 'btn ' + (view === 'search' ? 'btn-primary' : 'btn-secondary');
    document.getElementById('btnLibrary').className = 'btn ' + (view === 'library' ? 'btn-primary' : 'btn-secondary');

    if (view === 'library') {
        loadLibrary();
    }
}

// ============================================
// SEARCH TMDB
// ============================================

function searchTMDB() {
    var query = document.getElementById('tmdbSearch').value.trim();
    var type = document.getElementById('mediaType').value;
    var container = document.getElementById('searchResults');

    if (!query) {
        alert('Please enter a search term');
        return;
    }

    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    API.search(query, type)
        .then(function (data) {
            if (!data.results || data.results.length === 0) {
                container.innerHTML = '<p style="color: #888;">No results found.</p>';
                return;
            }

            var html = '';
            for (var i = 0; i < data.results.length; i++) {
                var item = data.results[i];
                var title = item.title || item.name;
                var year = (item.release_date || item.first_air_date || '').split('-')[0] || 'N/A';
                var poster = API.getImageUrl(item.poster_path);
                var itemJson = JSON.stringify(item).replace(/'/g, "\\'").replace(/"/g, '&quot;');

                html += '<div class="search-result-card" onclick=\'selectItem(' + itemJson + ', "' + type + '")\'>';
                html += '<img src="' + poster + '" alt="' + title + '">';
                html += '<div class="search-result-info">';
                html += '<h4>' + title + '</h4>';
                html += '<p>' + year + '</p>';
                html += '</div></div>';
            }
            container.innerHTML = html;
        })
        .catch(function (e) {
            console.error('Search error:', e);
            container.innerHTML = '<p style="color: #ef4444;">Search failed. Please try again.</p>';
        });
}

// Search on Enter key
document.addEventListener('DOMContentLoaded', function () {
    var searchInput = document.getElementById('tmdbSearch');
    if (searchInput) {
        searchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') searchTMDB();
        });
    }
});

// ============================================
// LIBRARY VIEW
// ============================================

function loadLibrary() {
    var container = document.getElementById('libraryList');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    DB.ready.then(function () {
        var movies = DB.getMovies();
        var tvShows = DB.getTVShows();

        var allItems = [];
        for (var i = 0; i < movies.length; i++) {
            var movie = Object.assign({}, movies[i]);
            movie._type = 'movie';
            allItems.push(movie);
        }
        for (var j = 0; j < tvShows.length; j++) {
            var show = Object.assign({}, tvShows[j]);
            show._type = 'tv';
            allItems.push(show);
        }

        if (allItems.length === 0) {
            container.innerHTML = '<p style="color: #888; grid-column: 1/-1; text-align: center;">No content added yet. Use "Add New" to search and add content.</p>';
            return;
        }

        // Hydrate with TMDB data
        var promises = allItems.map(function (item) {
            return API.getDetails(item.tmdbId, item._type)
                .then(function (details) {
                    return Object.assign({}, item, details);
                })
                .catch(function () {
                    item.title = 'Unknown';
                    item.name = 'Unknown';
                    item.poster_path = null;
                    return item;
                });
        });

        Promise.all(promises).then(function (hydrated) {
            var html = '';
            for (var i = 0; i < hydrated.length; i++) {
                var item = hydrated[i];
                var title = item.title || item.name;
                var poster = API.getImageUrl(item.poster_path);
                var typeLabel = item._type === 'movie' ? '🎬 Movie' : '📺 TV Show';

                html += '<div class="search-result-card" style="cursor: default;">';
                html += '<img src="' + poster + '" alt="' + title + '">';
                html += '<div class="search-result-info">';
                html += '<h4>' + title + '</h4>';
                html += '<p style="font-size: 0.8rem; color: #888;">' + typeLabel + '</p>';
                html += '<div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">';
                html += '<button onclick="editItem(\'' + item.tmdbId + '\', \'' + item._type + '\')" class="btn btn-primary" style="flex: 1; padding: 0.4rem; font-size: 0.8rem;">Edit</button>';
                html += '<button onclick="deleteItem(\'' + item.tmdbId + '\', \'' + item._type + '\')" class="btn btn-red" style="flex: 1; padding: 0.4rem; font-size: 0.8rem;">Delete</button>';
                html += '</div></div></div>';
            }
            container.innerHTML = html;
        });
    });
}

// ============================================
// EDITOR MODAL
// ============================================

function selectItem(item, type) {
    currentItem = Object.assign({}, item);
    currentItem._type = type;
    currentEpisodes = [];
    openEditor();
}

function editItem(tmdbId, type) {
    API.getDetails(tmdbId, type)
        .then(function (details) {
            currentItem = Object.assign({}, details);
            currentItem._type = type;

            // Load existing data
            if (type === 'movie') {
                var existing = DB.getMovie(tmdbId);
                if (existing && existing.sources) {
                    currentItem._existingSources = existing.sources;
                }
            } else {
                var existingTV = DB.getTVShow(tmdbId);
                if (existingTV && existingTV.seasons) {
                    currentEpisodes = [];
                    for (var i = 0; i < existingTV.seasons.length; i++) {
                        var season = existingTV.seasons[i];
                        for (var j = 0; j < season.episodes.length; j++) {
                            var ep = season.episodes[j];
                            currentEpisodes.push({
                                season: season.season_number,
                                episode: ep.episode_number,
                                sources: ep.sources || []
                            });
                        }
                    }
                }
            }

            openEditor();
        })
        .catch(function (e) {
            alert('Failed to load item details');
        });
}

function openEditor() {
    var modal = document.getElementById('editorModal');
    modal.style.display = 'flex';

    document.getElementById('modalTitle').textContent = 'Edit: ' + (currentItem.title || currentItem.name);

    if (currentItem._type === 'movie') {
        document.getElementById('movieEditor').style.display = 'block';
        document.getElementById('tvEditor').style.display = 'none';

        // Load existing sources or add empty one
        var container = document.getElementById('movieSourcesList');
        container.innerHTML = '';

        if (currentItem._existingSources && currentItem._existingSources.length > 0) {
            for (var i = 0; i < currentItem._existingSources.length; i++) {
                var s = currentItem._existingSources[i];
                addSourceRow('movieSourcesList', s.quality, s.url);
            }
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

function addSourceRow(containerId, quality, url) {
    quality = quality || '';
    url = url || '';

    var container = document.getElementById(containerId);
    var div = document.createElement('div');
    div.className = 'source-row';
    div.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 0.5rem;';
    div.innerHTML = '<input type="text" class="source-quality" placeholder="Quality (e.g. 1080p)" value="' + quality + '" style="width: 120px;">' +
        '<input type="text" class="source-url" placeholder="Video URL (CDN link)" value="' + url + '" style="flex: 1;">' +
        '<button onclick="this.parentElement.remove()" class="btn btn-red" style="padding: 0 0.8rem;">×</button>';
    container.appendChild(div);
}

function getSourcesFromContainer(containerId) {
    var container = document.getElementById(containerId);
    var rows = container.querySelectorAll('.source-row');
    var sources = [];

    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var quality = row.querySelector('.source-quality').value.trim();
        var url = row.querySelector('.source-url').value.trim();
        if (quality && url) {
            sources.push({ quality: quality, url: url });
        }
    }

    return sources;
}

// ============================================
// TV EPISODE MANAGEMENT
// ============================================

function addEpisode() {
    var season = parseInt(document.getElementById('seasonNum').value);
    var episode = parseInt(document.getElementById('episodeNum').value);
    var sources = getSourcesFromContainer('tvSourcesList');

    if (!season || !episode) {
        alert('Please enter season and episode numbers');
        return;
    }

    if (sources.length === 0) {
        alert('Please add at least one video source');
        return;
    }

    // Check if episode exists
    var existingIdx = -1;
    for (var i = 0; i < currentEpisodes.length; i++) {
        if (currentEpisodes[i].season === season && currentEpisodes[i].episode === episode) {
            existingIdx = i;
            break;
        }
    }

    if (existingIdx >= 0) {
        currentEpisodes[existingIdx].sources = sources;
    } else {
        currentEpisodes.push({ season: season, episode: episode, sources: sources });
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
    var container = document.getElementById('addedEpisodes');

    if (currentEpisodes.length === 0) {
        container.innerHTML = '<p style="color: #666; font-size: 0.9rem;">No episodes added yet.</p>';
        return;
    }

    // Sort by season then episode
    var sorted = currentEpisodes.slice().sort(function (a, b) {
        return (a.season - b.season) || (a.episode - b.episode);
    });

    var html = '';
    for (var i = 0; i < sorted.length; i++) {
        var ep = sorted[i];
        html += '<div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: #222; border-radius: 4px; margin-bottom: 0.5rem;">';
        html += '<div><span style="color: #eab308; font-weight: bold;">S' + ep.season + ' E' + ep.episode + '</span>';
        html += '<span style="color: #666; font-size: 0.8rem; margin-left: 0.5rem;">' + ep.sources.length + ' source(s)</span></div>';
        html += '<button onclick="removeEpisode(' + i + ')" class="btn btn-red" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">Remove</button>';
        html += '</div>';
    }
    container.innerHTML = html;
}

// ============================================
// SAVE & DELETE
// ============================================

function saveContent() {
    if (!currentItem) return;

    var saveBtn = document.querySelector('#editorModal .btn-primary:last-child');
    var originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    var promise;

    if (currentItem._type === 'movie') {
        var sources = getSourcesFromContainer('movieSourcesList');

        if (sources.length === 0) {
            alert('Please add at least one video source');
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
            return;
        }

        promise = DB.saveMovie({
            tmdbId: currentItem.id,
            sources: sources
        });

    } else {
        if (currentEpisodes.length === 0) {
            alert('Please add at least one episode');
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
            return;
        }

        // Convert flat episode list to seasons structure
        var seasonsMap = {};
        for (var i = 0; i < currentEpisodes.length; i++) {
            var ep = currentEpisodes[i];
            if (!seasonsMap[ep.season]) {
                seasonsMap[ep.season] = [];
            }
            seasonsMap[ep.season].push({
                episode_number: ep.episode,
                sources: ep.sources
            });
        }

        var seasons = [];
        for (var seasonNum in seasonsMap) {
            seasons.push({
                season_number: parseInt(seasonNum),
                episodes: seasonsMap[seasonNum]
            });
        }

        promise = DB.saveTVShow({
            tmdbId: currentItem.id,
            seasons: seasons
        });
    }

    promise
        .then(function () {
            alert('✅ Saved successfully!');
            closeModal();

            // Refresh library if visible
            if (document.getElementById('libraryView').style.display !== 'none') {
                loadLibrary();
            }
        })
        .catch(function (e) {
            console.error('Save error:', e);
            alert('❌ Failed to save: ' + e.message);
        })
        .finally(function () {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        });
}

function deleteItem(tmdbId, type) {
    if (!confirm('Are you sure you want to delete this item?')) return;

    var promise;
    if (type === 'movie') {
        promise = DB.deleteMovie(tmdbId);
    } else {
        promise = DB.deleteTVShow(tmdbId);
    }

    promise
        .then(function () {
            alert('✅ Deleted successfully!');
            loadLibrary();
        })
        .catch(function (e) {
            console.error('Delete error:', e);
            alert('❌ Failed to delete: ' + e.message);
        });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function publishChanges() {
    alert('✅ All changes are automatically saved to Supabase in real-time!');
}

function handleImport(input) {
    if (input.files.length === 0) return;

    var file = input.files[0];
    var reader = new FileReader();

    reader.onload = function (e) {
        try {
            var data = JSON.parse(e.target.result);
            var count = 0;
            var promises = [];

            if (data.movies) {
                for (var i = 0; i < data.movies.length; i++) {
                    promises.push(DB.saveMovie(data.movies[i]));
                    count++;
                }
            }
            if (data.tv) {
                for (var j = 0; j < data.tv.length; j++) {
                    promises.push(DB.saveTVShow(data.tv[j]));
                    count++;
                }
            }

            Promise.all(promises).then(function () {
                alert('✅ Imported ' + count + ' items successfully!');
                loadLibrary();
            });

        } catch (err) {
            alert('❌ Import failed: ' + err.message);
        }
    };

    reader.readAsText(file);
}

function forceRefresh() {
    DB.ready.then(function () {
        location.reload();
    });
}
