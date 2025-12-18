// TMDB API & Manual Content Logic
const API = {
    // Get trending (Now returns Manual Movies)
    async getTrending(mediaType = 'movie', timeWindow = 'week') {
        return this.getManualContent(mediaType);
    },

    // Get popular (Now returns Manual Movies)
    async getPopular(mediaType = 'movie', page = 1) {
        return this.getManualContent(mediaType);
    },

    // Get top rated (Now returns Manual Movies)
    async getTopRated(mediaType = 'movie', page = 1) {
        return this.getManualContent(mediaType);
    },

    // Helper: Get manual content and hydrate with TMDB data
    async getManualContent(mediaType) {
        const dbData = DB.getAllContent();
        const items = mediaType === 'movie' ? dbData.movies : dbData.tv;

        if (!items || items.length === 0) {
            return { page: 1, results: [], total_pages: 1, total_results: 0 };
        }

        // Fetch details for each item from TMDB
        const promises = items.map(item => this.getDetails(item.tmdbId, mediaType));
        const results = await Promise.all(promises);

        return {
            page: 1,
            results: results.filter(r => r && !r.status_message), // Filter errors
            total_pages: 1,
            total_results: results.length
        };
    },

    // Search TMDB (Used for Admin & Site)
    async search(query, mediaType = 'movie', page = 1) {
        const url = `${CONFIG.TMDB_BASE_URL}/search/${mediaType}?api_key=${CONFIG.TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`;
        const response = await fetch(url);
        return response.json();
    },

    // Get movie/TV details
    async getDetails(id, mediaType = 'movie') {
        const url = `${CONFIG.TMDB_BASE_URL}/${mediaType}/${id}?api_key=${CONFIG.TMDB_API_KEY}&append_to_response=credits,videos,similar`;
        const response = await fetch(url);
        return response.json();
    },

    // Get TV show seasons
    async getSeasonDetails(tvId, seasonNumber) {
        const url = `${CONFIG.TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${CONFIG.TMDB_API_KEY}`;
        const response = await fetch(url);
        return response.json();
    },

    // Get genres list
    async getGenres(mediaType = 'movie') {
        const url = `${CONFIG.TMDB_BASE_URL}/genre/${mediaType}/list?api_key=${CONFIG.TMDB_API_KEY}`;
        const response = await fetch(url);
        return response.json();
    },

    // Discover by genre (Manual Filter)
    async discoverByGenre(genreId, mediaType = 'movie', page = 1) {
        const fullList = await this.getManualContent(mediaType);
        const filtered = fullList.results.filter(item =>
            item.genres && item.genres.some(g => g.id.toString() === genreId.toString())
        );

        return {
            page: 1,
            results: filtered,
            total_pages: 1,
            total_results: filtered.length
        };
    },

    // Get image URL
    getImageUrl(path, size = 'w500') {
        if (!path) return 'https://via.placeholder.com/500x750?text=No+Image';
        return `${CONFIG.TMDB_IMAGE_BASE}/${size}${path}`;
    },

    // Get backdrop URL
    getBackdropUrl(path, size = 'original') {
        if (!path) return '';
        return `${CONFIG.TMDB_IMAGE_BASE}/${size}${path}`;
    },

    // Get Manual Sources for movies
    getMovieEmbedUrl(tmdbId) {
        const allData = DB.getData();
        console.log('Looking for movie ID:', tmdbId, 'Type:', typeof tmdbId);
        console.log('Available movies in DB:', allData.movies.map(m => ({ id: m.tmdbId, type: typeof m.tmdbId, hasSources: !!m.sources })));

        const movie = DB.getMovie(tmdbId);
        console.log('Found movie:', movie);

        if (!movie) {
            console.warn('Movie not found in database for ID:', tmdbId);
            return [];
        }

        const sources = movie.sources || (movie.url ? [{ quality: 'Default', url: movie.url }] : []);
        console.log('Returning sources:', sources);
        return sources;
    },

    // Get Manual Sources for TV shows
    getTVEmbedUrl(tmdbId, season = 1, episode = 1) {
        const show = DB.getTV(tmdbId);
        if (!show || !show.seasons) return [];

        const s = show.seasons.find(s => s.season_number == season);
        if (!s || !s.episodes) return [];

        const e = s.episodes.find(e => e.episode_number == episode);
        if (!e) return [];

        return e.sources || (e.url ? [{ quality: 'Default', url: e.url }] : []);
    }
};
