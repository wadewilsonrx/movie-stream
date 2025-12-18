const DB_KEY = 'streamiz_db';
const _supabase = typeof supabase !== 'undefined' ? supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY) : null;

let _dbReadyResolve;
const DB = {
    ready: new Promise(resolve => _dbReadyResolve = resolve),
    // Initialize DB & Sync
    async init() {
        if (!_supabase) {
            console.error('Supabase client not loaded');
            return;
        }

        try {
            // Fetch both tables concurrently
            const [moviesRes, tvRes] = await Promise.all([
                _supabase.from('movies').select('*'),
                _supabase.from('tv_shows').select('*')
            ]);

            if (moviesRes.error || tvRes.error) throw new Error('Supabase fetch error');

            const data = {
                movies: moviesRes.data.map(r => r.data),
                tv: tvRes.data.map(r => r.data)
            };

            console.log('Synced with Supabase');
            this.saveToLocal(data);
        } catch (e) {
            console.warn('Using local cache (Offline or error)', e);
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
        return stored ? JSON.parse(stored) : { movies: [], tv: [] };
    },

    // Internal: Save to local storage cache
    saveToLocal(data) {
        localStorage.setItem(DB_KEY, JSON.stringify(data));
    },

    // Add/Update a movie
    async addMovie(movie) {
        const data = this.getData();

        // Ensure structure & types
        movie.tmdbId = movie.tmdbId.toString();
        if (!movie.sources && movie.url) {
            movie.sources = [{ quality: 'Default', url: movie.url }];
        }

        console.log('Adding/Updating movie:', movie.tmdbId);

        // 1. Update Supabase
        if (_supabase) {
            const { error } = await _supabase
                .from('movies')
                .upsert({ tmdb_id: movie.tmdbId, data: movie });

            if (error) {
                console.error('Supabase add error:', error);
                throw error;
            }
        }

        // 2. Update local cache
        const index = data.movies.findIndex(m => m.tmdbId.toString() === movie.tmdbId);
        if (index >= 0) {
            data.movies[index] = { ...data.movies[index], ...movie };
        } else {
            data.movies.push(movie);
        }
        console.log('Local cache updated for movie:', movie.tmdbId);
        this.saveToLocal(data);
    },

    // Add/Update a TV show
    async addTV(show) {
        const data = this.getData();

        // Ensure structure & types
        show.tmdbId = show.tmdbId.toString();
        show.seasons.forEach(s => {
            s.episodes = s.episodes.map(e => {
                if (!e.sources && e.url) e.sources = [{ quality: 'Default', url: e.url }];
                return e;
            });
        });

        console.log('Adding/Updating TV show:', show.tmdbId);

        // 1. Update Supabase
        if (_supabase) {
            const { error } = await _supabase
                .from('tv_shows')
                .upsert({ tmdb_id: show.tmdbId, data: show });

            if (error) {
                console.error('Supabase add error:', error);
                throw error;
            }
        }

        // 2. Update local cache
        const index = data.tv.findIndex(t => t.tmdbId === show.tmdbId);
        if (index >= 0) {
            data.tv[index] = show;
        } else {
            data.tv.push(show);
        }
        this.saveToLocal(data);
    },

    // Remove movie
    async removeMovie(tmdbId) {
        if (_supabase) {
            await _supabase.from('movies').delete().eq('tmdb_id', tmdbId.toString());
        }
        const data = this.getData();
        data.movies = data.movies.filter(m => m.tmdbId.toString() !== tmdbId.toString());
        this.saveToLocal(data);
    },

    // Remove TV show
    async removeTV(tmdbId) {
        if (_supabase) {
            await _supabase.from('tv_shows').delete().eq('tmdb_id', tmdbId.toString());
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
