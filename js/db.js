const DB_KEY = 'streamiz_db';

const DB = {
    // Initialize DB if empty
    init() {
        if (!localStorage.getItem(DB_KEY)) {
            const initialData = {
                movies: [],
                tv: []
            };
            localStorage.setItem(DB_KEY, JSON.stringify(initialData));
        }
    },

    // Get all data
    getData() {
        this.init();
        return JSON.parse(localStorage.getItem(DB_KEY));
    },

    // Save all data
    saveData(data) {
        localStorage.setItem(DB_KEY, JSON.stringify(data));
    },

    // Add a movie
    addMovie(movie) {
        const data = this.getData();
        const index = data.movies.findIndex(m => m.tmdbId === movie.tmdbId);

        // Ensure structure
        if (!movie.sources && movie.url) {
            movie.sources = [{ quality: 'Default', url: movie.url }];
        }

        if (index >= 0) {
            data.movies[index] = { ...data.movies[index], ...movie };
        } else {
            data.movies.push(movie);
        }
        this.saveData(data);
    },

    // Add a TV show (or update episodes)
    addTV(show) {
        const data = this.getData();
        const index = data.tv.findIndex(t => t.tmdbId === show.tmdbId);

        if (index >= 0) {
            const existing = data.tv[index];
            show.seasons.forEach(season => {
                let existingSeason = existing.seasons.find(s => s.season_number === season.season_number);
                if (existingSeason) {
                    season.episodes.forEach(episode => {
                        // Ensure sources structure
                        if (!episode.sources && episode.url) {
                            episode.sources = [{ quality: 'Default', url: episode.url }];
                        }

                        const existingEpIndex = existingSeason.episodes.findIndex(e => e.episode_number === episode.episode_number);
                        if (existingEpIndex >= 0) {
                            existingSeason.episodes[existingEpIndex] = { ...existingSeason.episodes[existingEpIndex], ...episode };
                        } else {
                            existingSeason.episodes.push(episode);
                        }
                    });
                } else {
                    // New season, ensure episodes have sources
                    season.episodes = season.episodes.map(e => {
                        if (!e.sources && e.url) e.sources = [{ quality: 'Default', url: e.url }];
                        return e;
                    });
                    existing.seasons.push(season);
                }
            });
            data.tv[index] = existing;
        } else {
            // New Show, ensure sources
            show.seasons.forEach(s => {
                s.episodes = s.episodes.map(e => {
                    if (!e.sources && e.url) e.sources = [{ quality: 'Default', url: e.url }];
                    return e;
                });
            });
            data.tv.push(show);
        }
        this.saveData(data);
    },

    // Remove movie
    removeMovie(tmdbId) {
        const data = this.getData();
        data.movies = data.movies.filter(m => m.tmdbId.toString() !== tmdbId.toString());
        this.saveData(data);
    },

    // Remove TV show
    removeTV(tmdbId) {
        const data = this.getData();
        data.tv = data.tv.filter(t => t.tmdbId.toString() !== tmdbId.toString());
        this.saveData(data);
    },

    // Get all content for list display
    getAllContent() {
        const data = this.getData();
        return {
            movies: data.movies,
            tv: data.tv
        };
    },

    // Get specific movie
    getMovie(tmdbId) {
        const data = this.getData();
        return data.movies.find(m => m.tmdbId.toString() === tmdbId.toString());
    },

    // Get specific TV show
    getTV(tmdbId) {
        const data = this.getData();
        return data.tv.find(t => t.tmdbId.toString() === tmdbId.toString());
    },

    // Export data as JSON file
    exportData() {
        const data = JSON.stringify(this.getData(), null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'streamiz_db.json';
        a.click();
        URL.revokeObjectURL(url);
    },

    // Import data
    async importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.movies && data.tv) {
                        this.saveData(data);
                        resolve(true);
                    } else {
                        reject('Invalid data format');
                    }
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsText(file);
        });
    }
};

// Autoinit
DB.init();
