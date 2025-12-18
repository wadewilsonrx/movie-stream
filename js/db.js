// Streamiz Database Layer - Supabase Integration
// This module handles all Supabase database operations

const DB = {
    _client: null,
    _cache: { movies: [], tv: [] },
    _initialized: false,

    // Promise that resolves when DB is ready
    ready: null,
    _readyResolve: null,

    init() {
        this.ready = new Promise(resolve => {
            this._readyResolve = resolve;
        });
        this._initSupabase();
    },

    // Initialize Supabase client
    _initSupabase() {
        this.updateStatus('checking', '🟡 Connecting to Supabase...');

        // Wait for Supabase library to load
        let attempts = 0;
        const maxAttempts = 10;

        const tryConnect = () => {
            attempts++;

            if (typeof supabase === 'undefined') {
                if (attempts >= maxAttempts) {
                    this.updateStatus('error', '🔴 Failed to load Supabase library');
                    this._readyResolve();
                    return;
                }
                this.updateStatus('checking', `🟡 Loading Supabase (${attempts}/${maxAttempts})...`);
                setTimeout(tryConnect, 500);
                return;
            }

            try {
                this._client = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
                this._loadData();
            } catch (e) {
                console.error('Supabase connection failed:', e);
                this.updateStatus('error', '🔴 Connection failed: ' + e.message);
                this._readyResolve();
            }
        };

        tryConnect();
    },

    // Load all data from Supabase
    async _loadData() {
        try {
            this.updateStatus('checking', '🟡 Fetching data...');

            const [moviesRes, tvRes] = await Promise.all([
                this._client.from('movies').select('*'),
                this._client.from('tv_shows').select('*')
            ]);

            if (moviesRes.error) throw moviesRes.error;
            if (tvRes.error) throw tvRes.error;

            // Extract data from Supabase rows
            this._cache.movies = (moviesRes.data || []).map(row => row.data).filter(Boolean);
            this._cache.tv = (tvRes.data || []).map(row => row.data).filter(Boolean);

            const total = this._cache.movies.length + this._cache.tv.length;
            this.updateStatus('connected', `🟢 Connected (${total} items)`);
            this._initialized = true;

            console.log('DB loaded:', this._cache.movies.length, 'movies,', this._cache.tv.length, 'TV shows');

        } catch (e) {
            console.error('Failed to load data:', e);
            this.updateStatus('error', '🔴 ' + (e.message || 'Failed to load data'));
        } finally {
            this._readyResolve();
        }
    },

    // Refresh data from Supabase
    async refresh() {
        if (!this._client) return false;
        await this._loadData();
        return true;
    },

    // Get all content
    getAll() {
        return { ...this._cache };
    },

    // Get all movies
    getMovies() {
        return [...this._cache.movies];
    },

    // Get all TV shows
    getTVShows() {
        return [...this._cache.tv];
    },

    // Get a specific movie by TMDB ID
    getMovie(tmdbId) {
        const id = String(tmdbId);
        return this._cache.movies.find(m => String(m.tmdbId) === id) || null;
    },

    // Get a specific TV show by TMDB ID
    getTVShow(tmdbId) {
        const id = String(tmdbId);
        return this._cache.tv.find(t => String(t.tmdbId) === id) || null;
    },

    // Save a movie to Supabase
    async saveMovie(movieData) {
        if (!this._client) throw new Error('Database not connected');

        const tmdbId = String(movieData.tmdbId);
        const payload = {
            tmdb_id: tmdbId,
            data: {
                tmdbId: tmdbId,
                sources: movieData.sources || []
            }
        };

        console.log('Saving movie:', payload);

        const { error } = await this._client
            .from('movies')
            .upsert(payload, { onConflict: 'tmdb_id' });

        if (error) {
            console.error('Save error:', error);
            throw new Error(error.message);
        }

        // Update local cache
        const idx = this._cache.movies.findIndex(m => String(m.tmdbId) === tmdbId);
        if (idx >= 0) {
            this._cache.movies[idx] = payload.data;
        } else {
            this._cache.movies.push(payload.data);
        }

        console.log('Movie saved successfully');
        return true;
    },

    // Save a TV show to Supabase  
    async saveTVShow(showData) {
        if (!this._client) throw new Error('Database not connected');

        const tmdbId = String(showData.tmdbId);
        const payload = {
            tmdb_id: tmdbId,
            data: {
                tmdbId: tmdbId,
                seasons: showData.seasons || []
            }
        };

        console.log('Saving TV show:', payload);

        const { error } = await this._client
            .from('tv_shows')
            .upsert(payload, { onConflict: 'tmdb_id' });

        if (error) {
            console.error('Save error:', error);
            throw new Error(error.message);
        }

        // Update local cache
        const idx = this._cache.tv.findIndex(t => String(t.tmdbId) === tmdbId);
        if (idx >= 0) {
            this._cache.tv[idx] = payload.data;
        } else {
            this._cache.tv.push(payload.data);
        }

        console.log('TV show saved successfully');
        return true;
    },

    // Delete a movie
    async deleteMovie(tmdbId) {
        if (!this._client) throw new Error('Database not connected');

        const id = String(tmdbId);
        const { error } = await this._client
            .from('movies')
            .delete()
            .eq('tmdb_id', id);

        if (error) throw new Error(error.message);

        this._cache.movies = this._cache.movies.filter(m => String(m.tmdbId) !== id);
        return true;
    },

    // Delete a TV show
    async deleteTVShow(tmdbId) {
        if (!this._client) throw new Error('Database not connected');

        const id = String(tmdbId);
        const { error } = await this._client
            .from('tv_shows')
            .delete()
            .eq('tmdb_id', id);

        if (error) throw new Error(error.message);

        this._cache.tv = this._cache.tv.filter(t => String(t.tmdbId) !== id);
        return true;
    },

    // Update status display
    updateStatus(type, message) {
        const el = document.getElementById('dbStatus');
        if (!el) return;

        el.textContent = message;
        el.style.color = {
            connected: '#22c55e',
            checking: '#eab308',
            error: '#ef4444'
        }[type] || '#888';
    }
};

// Auto-initialize
DB.init();
