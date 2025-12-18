// Streamiz API Layer
// Handles TMDB API calls and video source retrieval

const API = {
    // Get trending content from your database
    async getTrending(mediaType = 'movie') {
        await DB.ready;
        const items = mediaType === 'movie' ? DB.getMovies() : DB.getTVShows();
        return this._hydrateWithTMDB(items, mediaType);
    },

    // Get popular content from your database
    async getPopular(mediaType = 'movie') {
        await DB.ready;
        const items = mediaType === 'movie' ? DB.getMovies() : DB.getTVShows();
        return this._hydrateWithTMDB(items, mediaType);
    },

    // Get top rated content from your database
    async getTopRated(mediaType = 'movie') {
        await DB.ready;
        const items = mediaType === 'movie' ? DB.getMovies() : DB.getTVShows();
        return this._hydrateWithTMDB(items, mediaType);
    },

    // Hydrate local items with TMDB details
    async _hydrateWithTMDB(items, mediaType) {
        if (!items || items.length === 0) {
            return { page: 1, results: [], total_pages: 1, total_results: 0 };
        }

        const results = await Promise.all(
            items.map(item =>
                this.getDetails(item.tmdbId, mediaType)
                    .catch(() => null)
            )
        );

        return {
            page: 1,
            results: results.filter(r => r && !r.status_message),
            total_pages: 1,
            total_results: results.length
        };
    },

    // Search TMDB
    async search(query, mediaType = 'movie') {
        const url = `${CONFIG.TMDB_BASE_URL}/search/${mediaType}?api_key=${CONFIG.TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        return response.json();
    },

    // Get movie/TV details from TMDB
    async getDetails(id, mediaType = 'movie') {
        const url = `${CONFIG.TMDB_BASE_URL}/${mediaType}/${id}?api_key=${CONFIG.TMDB_API_KEY}&append_to_response=credits,videos,similar`;
        const response = await fetch(url);
        return response.json();
    },

    // Get TV season details
    async getSeasonDetails(tvId, seasonNumber) {
        const url = `${CONFIG.TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${CONFIG.TMDB_API_KEY}`;
        const response = await fetch(url);
        return response.json();
    },

    // Get genres
    async getGenres(mediaType = 'movie') {
        const url = `${CONFIG.TMDB_BASE_URL}/genre/${mediaType}/list?api_key=${CONFIG.TMDB_API_KEY}`;
        const response = await fetch(url);
        return response.json();
    },

    // Discover by genre
    async discoverByGenre(genreId, mediaType = 'movie') {
        const all = await this.getPopular(mediaType);
        const filtered = all.results.filter(item =>
            item.genres && item.genres.some(g => String(g.id) === String(genreId))
        );
        return { ...all, results: filtered, total_results: filtered.length };
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

    // Get video sources for a movie
    getMovieSources(tmdbId) {
        const movie = DB.getMovie(tmdbId);
        if (!movie || !movie.sources) {
            console.log('No sources found for movie:', tmdbId);
            return [];
        }
        console.log('Found sources for movie:', tmdbId, movie.sources);
        return movie.sources;
    },

    // Get video sources for a TV episode
    getTVSources(tmdbId, season, episode) {
        const show = DB.getTVShow(tmdbId);
        if (!show || !show.seasons) {
            console.log('No show found:', tmdbId);
            return [];
        }

        const s = show.seasons.find(s => s.season_number == season);
        if (!s || !s.episodes) {
            console.log('No season found:', season);
            return [];
        }

        const ep = s.episodes.find(e => e.episode_number == episode);
        if (!ep || !ep.sources) {
            console.log('No episode found:', episode);
            return [];
        }

        console.log('Found sources for TV:', tmdbId, 'S' + season + 'E' + episode, ep.sources);
        return ep.sources;
    }
};
