const DB_KEY = 'streamiz_db';

let _dbReadyResolve;
const DB = {
    ready: new Promise(resolve => _dbReadyResolve = resolve),
    _client: null,

    // Getter for Supabase Client
    getClient() {
        if (this._client) return this._client;
        if (typeof supabase !== 'undefined') {
            try {
                this._client = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
                return this._client;
            } catch (e) {
                console.error('Failed to create Supabase client:', e);
            }
        }
        return null;
    },

    // Initialize DB & Sync
    async init() {
        const client = this.getClient();
        if (!client) {
            console.warn('Supabase client not available yet, retrying in 1s...');
            setTimeout(() => this.init(), 1000);
            return;
        }

        try {
            console.log('Fetching data from Supabase...');
            const [moviesRes, tvRes] = await Promise.all([
                client.from('movies').select('*'),
                client.from('tv_shows').select('*')
            ]);

            if (moviesRes.error || tvRes.error) {
                console.error('Supabase fetch error:', moviesRes.error || tvRes.error);
                throw new Error(moviesRes.error?.message || tvRes.error?.message || 'Fetch error');
            }

            // ONLY overwrite if we actually got a successful response (even if empty)
            // But if we have local data and Supabase is empty, maybe it's a new project?
            const supData = {
                movies: (moviesRes.data || []).map(r => r.data).filter(Boolean),
                tv: (tvRes.data || []).map(r => r.data).filter(Boolean)
            };

            console.log('Synced with Supabase. Items found:', supData.movies.length + supData.tv.length);

            // Merge logic: If supabase is empty but local has data, we might want to UPLOAD local?
            // For now, let's just save Supabase data to local as source of truth.
            this.saveToLocal(supData);
            this.updateStatus('connected', `🟢 Connected (Movies: ${supData.movies.length}, TV: ${supData.tv.length})`);
        } catch (e) {
            console.warn('Using local cache (Offline or error)', e);
            this.updateStatus('error', '🔴 Sync Error: ' + e.message);
            if (!localStorage.getItem(DB_KEY)) {
                this.saveToLocal({ movies: [], tv: [] });
            }
        } finally {
            _dbReadyResolve();
        }
    },

    // Get all data from local cache (populated by init)
    getData() {
        const stored = localStorage.getItem(DB_KEY);
        try {
            return stored ? JSON.parse(stored) : { movies: [], tv: [] };
        } catch (e) {
            return { movies: [], tv: [] };
        }
    },

    // Internal: Save to local storage cache
    saveToLocal(data) {
        localStorage.setItem(DB_KEY, JSON.stringify(data));
    },

    // Add/Update a movie
    async addMovie(movie) {
        const data = this.getData();
        const client = this.getClient();

        // Ensure structure & types
        movie.tmdbId = movie.tmdbId.toString();
        if (!movie.sources && movie.url) {
            movie.sources = [{ quality: 'Default', url: movie.url }];
        }

        console.log('Saving movie to Supabase:', movie.tmdbId);

        // 1. Update Supabase
        if (client) {
            const payload = { tmdb_id: movie.tmdbId, data: movie };
            console.log('Upserting to Supabase table "movies":', payload);

            const { error, data: resData } = await client
                .from('movies')
                .upsert(payload);

            if (error) {
                console.error('Supabase save error (Movies):', error);
                alert('Supabase Save Error: ' + error.message + '\nCode: ' + error.code);
                throw error;
            }
            console.log('Supabase response:', resData);
        } else {
            console.warn('Supabase client missing during save');
        }

        // 2. Update local cache
        const index = data.movies.findIndex(m => m.tmdbId.toString() === movie.tmdbId);
        if (index >= 0) {
            data.movies[index] = { ...data.movies[index], ...movie };
        } else {
            data.movies.push(movie);
        }
        this.saveToLocal(data);
    },

    // Add/Update a TV show
    async addTV(show) {
        const data = this.getData();
        const client = this.getClient();

        // Ensure structure & types
        show.tmdbId = show.tmdbId.toString();
        show.seasons.forEach(s => {
            s.episodes = s.episodes.map(e => {
                if (!e.sources && e.url) e.sources = [{ quality: 'Default', url: e.url }];
                return e;
            });
        });

        console.log('Saving TV show to Supabase:', show.tmdbId);

        // 1. Update Supabase
        if (client) {
            const { error } = await client
                .from('tv_shows')
                .upsert({ tmdb_id: show.tmdbId, data: show });

            if (error) {
                console.error('Supabase save error:', error);
                alert('Supabase Error: ' + error.message);
                throw error;
            }
            console.log('Successfully saved to Supabase (TV)');
        } else {
            alert('Warning: Supabase not connected. Saving locally only.');
        }

        // 2. Update local cache
        const index = data.tv.findIndex(t => t.tmdbId.toString() === show.tmdbId);
        if (index >= 0) {
            data.tv[index] = show;
        } else {
            data.tv.push(show);
        }
        this.saveToLocal(data);
    },

    // Remove movie
    async removeMovie(tmdbId) {
        const client = this.getClient();
        if (client) {
            const { error } = await client.from('movies').delete().eq('tmdb_id', tmdbId.toString());
            if (error) throw error;
        }
        const data = this.getData();
        data.movies = data.movies.filter(m => m.tmdbId.toString() !== tmdbId.toString());
        this.saveToLocal(data);
    },

    // Remove TV show
    async removeTV(tmdbId) {
        const client = this.getClient();
        if (client) {
            const { error } = await client.from('tv_shows').delete().eq('tmdb_id', tmdbId.toString());
            if (error) throw error;
        }
        const data = this.getData();
        data.tv = data.tv.filter(t => t.tmdbId.toString() !== tmdbId.toString());
        this.saveToLocal(data);
    },

    // Helper display methods
    getAllContent() {
        return this.getData();
    },

    getMovie(tmdbId) {
        return this.getData().movies.find(m => m.tmdbId.toString() === tmdbId.toString());
    },

    getTV(tmdbId) {
        return this.getData().tv.find(t => t.tmdbId.toString() === tmdbId.toString());
    },

    updateStatus(type, message) {
        const el = document.getElementById('dbStatus');
        if (!el) return;
        el.textContent = message;
        el.style.color = type === 'connected' ? '#22c55e' : '#ef4444';
    },

    // legacy methods for UI compatibility
    async importData(file) {
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.movies && data.tv) {
                        // Batch upload would be better, but for simplicity we loop
                        for (const m of data.movies) await this.addMovie(m);
                        for (const t of data.tv) await this.addTV(t);
                        resolve(true);
                    } else reject('Invalid format');
                } catch (err) { reject(err); }
            };
            reader.readAsText(file);
        });
    }
};

// Automatic initialization
DB.init();
