// Streamiz Database Layer - Supabase Integration
// This module handles all Supabase database operations

const DB = {
    _client: null,
    _cache: { movies: [], tv: [] },
    _initialized: false,
    _readyResolve: null,
    ready: null,

    // Initialize on load
    init: function () {
        const self = this;
        this.ready = new Promise(function (resolve) {
            self._readyResolve = resolve;
        });
        this._connectToSupabase();
    },

    // Update status display
    updateStatus: function (type, message) {
        const el = document.getElementById('dbStatus');
        if (!el) return;

        el.textContent = message;
        const colors = {
            connected: '#22c55e',
            checking: '#eab308',
            error: '#ef4444'
        };
        el.style.color = colors[type] || '#888';
    },

    // Connect to Supabase
    _connectToSupabase: function () {
        const self = this;
        let attempts = 0;
        const maxAttempts = 15;

        function tryConnect() {
            attempts++;
            self.updateStatus('checking', '🟡 Connecting to Supabase (' + attempts + '/' + maxAttempts + ')...');

            // Check if supabase library is loaded
            if (typeof supabase === 'undefined') {
                console.log('Supabase library not loaded yet, attempt ' + attempts);
                if (attempts >= maxAttempts) {
                    self.updateStatus('error', '🔴 Supabase library failed to load. Please refresh.');
                    self._readyResolve();
                    return;
                }
                setTimeout(tryConnect, 500);
                return;
            }

            console.log('Supabase library loaded, creating client...');

            try {
                self._client = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
                console.log('Supabase client created successfully');
                self._loadData();
            } catch (e) {
                console.error('Failed to create Supabase client:', e);
                self.updateStatus('error', '🔴 Connection error: ' + e.message);
                self._readyResolve();
            }
        }

        tryConnect();
    },

    // Load all data from Supabase
    _loadData: function () {
        const self = this;

        self.updateStatus('checking', '🟡 Fetching data from database...');

        Promise.all([
            self._client.from('movies').select('*'),
            self._client.from('tv_shows').select('*')
        ])
            .then(function (results) {
                const moviesRes = results[0];
                const tvRes = results[1];

                if (moviesRes.error) {
                    throw new Error('Movies: ' + moviesRes.error.message);
                }
                if (tvRes.error) {
                    throw new Error('TV Shows: ' + tvRes.error.message);
                }

                // Extract data from rows
                self._cache.movies = (moviesRes.data || []).map(function (row) {
                    return row.data;
                }).filter(Boolean);

                self._cache.tv = (tvRes.data || []).map(function (row) {
                    return row.data;
                }).filter(Boolean);

                const total = self._cache.movies.length + self._cache.tv.length;
                self.updateStatus('connected', '🟢 Connected (' + total + ' items)');
                self._initialized = true;

                console.log('DB loaded:', self._cache.movies.length, 'movies,', self._cache.tv.length, 'TV shows');
                self._readyResolve();
            })
            .catch(function (err) {
                console.error('Failed to load data:', err);
                self.updateStatus('error', '🔴 ' + (err.message || 'Failed to load data'));
                self._readyResolve();
            });
    },

    // Get all content
    getAll: function () {
        return { movies: this._cache.movies.slice(), tv: this._cache.tv.slice() };
    },

    // Get all movies
    getMovies: function () {
        return this._cache.movies.slice();
    },

    // Get all TV shows
    getTVShows: function () {
        return this._cache.tv.slice();
    },

    // Get a specific movie by TMDB ID
    getMovie: function (tmdbId) {
        const id = String(tmdbId);
        for (let i = 0; i < this._cache.movies.length; i++) {
            if (String(this._cache.movies[i].tmdbId) === id) {
                return this._cache.movies[i];
            }
        }
        return null;
    },

    // Get a specific TV show by TMDB ID
    getTVShow: function (tmdbId) {
        const id = String(tmdbId);
        for (let i = 0; i < this._cache.tv.length; i++) {
            if (String(this._cache.tv[i].tmdbId) === id) {
                return this._cache.tv[i];
            }
        }
        return null;
    },

    // Save a movie to Supabase
    saveMovie: function (movieData) {
        const self = this;

        if (!self._client) {
            return Promise.reject(new Error('Database not connected'));
        }

        const tmdbId = String(movieData.tmdbId);
        const payload = {
            tmdb_id: tmdbId,
            data: {
                tmdbId: tmdbId,
                sources: movieData.sources || []
            }
        };

        console.log('Saving movie:', payload);

        return self._client
            .from('movies')
            .upsert(payload, { onConflict: 'tmdb_id' })
            .then(function (result) {
                if (result.error) {
                    console.error('Save error:', result.error);
                    throw new Error(result.error.message);
                }

                // Update local cache
                let found = false;
                for (let i = 0; i < self._cache.movies.length; i++) {
                    if (String(self._cache.movies[i].tmdbId) === tmdbId) {
                        self._cache.movies[i] = payload.data;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    self._cache.movies.push(payload.data);
                }

                console.log('Movie saved successfully');
                return true;
            });
    },

    // Save a TV show to Supabase  
    saveTVShow: function (showData) {
        const self = this;

        if (!self._client) {
            return Promise.reject(new Error('Database not connected'));
        }

        const tmdbId = String(showData.tmdbId);
        const payload = {
            tmdb_id: tmdbId,
            data: {
                tmdbId: tmdbId,
                seasons: showData.seasons || []
            }
        };

        console.log('Saving TV show:', payload);

        return self._client
            .from('tv_shows')
            .upsert(payload, { onConflict: 'tmdb_id' })
            .then(function (result) {
                if (result.error) {
                    console.error('Save error:', result.error);
                    throw new Error(result.error.message);
                }

                // Update local cache
                let found = false;
                for (let i = 0; i < self._cache.tv.length; i++) {
                    if (String(self._cache.tv[i].tmdbId) === tmdbId) {
                        self._cache.tv[i] = payload.data;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    self._cache.tv.push(payload.data);
                }

                console.log('TV show saved successfully');
                return true;
            });
    },

    // Delete a movie
    deleteMovie: function (tmdbId) {
        const self = this;

        if (!self._client) {
            return Promise.reject(new Error('Database not connected'));
        }

        const id = String(tmdbId);

        return self._client
            .from('movies')
            .delete()
            .eq('tmdb_id', id)
            .then(function (result) {
                if (result.error) {
                    throw new Error(result.error.message);
                }

                self._cache.movies = self._cache.movies.filter(function (m) {
                    return String(m.tmdbId) !== id;
                });

                return true;
            });
    },

    // Delete a TV show
    deleteTVShow: function (tmdbId) {
        const self = this;

        if (!self._client) {
            return Promise.reject(new Error('Database not connected'));
        }

        const id = String(tmdbId);

        return self._client
            .from('tv_shows')
            .delete()
            .eq('tmdb_id', id)
            .then(function (result) {
                if (result.error) {
                    throw new Error(result.error.message);
                }

                self._cache.tv = self._cache.tv.filter(function (t) {
                    return String(t.tmdbId) !== id;
                });

                return true;
            });
    },

    // Refresh data from Supabase
    refresh: function () {
        if (!this._client) {
            return Promise.resolve(false);
        }
        const self = this;
        return new Promise(function (resolve) {
            self._loadData();
            self.ready.then(function () {
                resolve(true);
            });
        });
    }
};

// Auto-initialize when script loads
DB.init();

// Also try to initialize after DOM is ready (fallback)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
        if (!DB._client) {
            DB.init();
        }
    });
}
