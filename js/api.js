// Streamiz API Layer
// Handles TMDB API calls and video source retrieval

const API = {
    // Get trending content from your database
    getTrending: function (mediaType) {
        mediaType = mediaType || 'movie';
        const self = this;
        return DB.ready.then(function () {
            const items = mediaType === 'movie' ? DB.getMovies() : DB.getTVShows();
            return self._hydrateWithTMDB(items, mediaType);
        });
    },

    // Get popular content from your database
    getPopular: function (mediaType) {
        mediaType = mediaType || 'movie';
        const self = this;
        return DB.ready.then(function () {
            const items = mediaType === 'movie' ? DB.getMovies() : DB.getTVShows();
            return self._hydrateWithTMDB(items, mediaType);
        });
    },

    // Get top rated content from your database
    getTopRated: function (mediaType) {
        mediaType = mediaType || 'movie';
        const self = this;
        return DB.ready.then(function () {
            const items = mediaType === 'movie' ? DB.getMovies() : DB.getTVShows();
            return self._hydrateWithTMDB(items, mediaType);
        });
    },

    // Hydrate local items with TMDB details
    _hydrateWithTMDB: function (items, mediaType) {
        const self = this;

        if (!items || items.length === 0) {
            return Promise.resolve({
                page: 1,
                results: [],
                total_pages: 1,
                total_results: 0
            });
        }

        const promises = items.map(function (item) {
            return self.getDetails(item.tmdbId, mediaType).catch(function () {
                return null;
            });
        });

        return Promise.all(promises).then(function (results) {
            const filtered = results.filter(function (r) {
                return r && !r.status_message;
            });
            return {
                page: 1,
                results: filtered,
                total_pages: 1,
                total_results: filtered.length
            };
        });
    },

    // Search TMDB
    search: function (query, mediaType) {
        mediaType = mediaType || 'movie';
        const url = CONFIG.TMDB_BASE_URL + '/search/' + mediaType + '?api_key=' + CONFIG.TMDB_API_KEY + '&query=' + encodeURIComponent(query);
        return fetch(url).then(function (response) {
            return response.json();
        });
    },

    // Get movie/TV details from TMDB
    getDetails: function (id, mediaType) {
        mediaType = mediaType || 'movie';
        const url = CONFIG.TMDB_BASE_URL + '/' + mediaType + '/' + id + '?api_key=' + CONFIG.TMDB_API_KEY + '&append_to_response=credits,videos,similar';
        return fetch(url).then(function (response) {
            return response.json();
        });
    },

    // Get TV season details
    getSeasonDetails: function (tvId, seasonNumber) {
        const url = CONFIG.TMDB_BASE_URL + '/tv/' + tvId + '/season/' + seasonNumber + '?api_key=' + CONFIG.TMDB_API_KEY;
        return fetch(url).then(function (response) {
            return response.json();
        });
    },

    // Get genres
    getGenres: function (mediaType) {
        mediaType = mediaType || 'movie';
        const url = CONFIG.TMDB_BASE_URL + '/genre/' + mediaType + '/list?api_key=' + CONFIG.TMDB_API_KEY;
        return fetch(url).then(function (response) {
            return response.json();
        });
    },

    // Get image URL
    getImageUrl: function (path, size) {
        size = size || 'w500';
        if (!path) return 'https://via.placeholder.com/500x750?text=No+Image';
        return CONFIG.TMDB_IMAGE_BASE + '/' + size + path;
    },

    // Get backdrop URL
    getBackdropUrl: function (path, size) {
        size = size || 'original';
        if (!path) return '';
        return CONFIG.TMDB_IMAGE_BASE + '/' + size + path;
    },

    // Get video sources for a movie
    getMovieSources: function (tmdbId) {
        const movie = DB.getMovie(tmdbId);
        if (!movie || !movie.sources) {
            console.log('No sources found for movie:', tmdbId);
            return [];
        }
        console.log('Found sources for movie:', tmdbId, movie.sources);
        return movie.sources;
    },

    // Get video sources for a TV episode
    getTVSources: function (tmdbId, season, episode) {
        const show = DB.getTVShow(tmdbId);
        if (!show || !show.seasons) {
            console.log('No show found:', tmdbId);
            return [];
        }

        var foundSeason = null;
        for (var i = 0; i < show.seasons.length; i++) {
            if (show.seasons[i].season_number == season) {
                foundSeason = show.seasons[i];
                break;
            }
        }

        if (!foundSeason || !foundSeason.episodes) {
            console.log('No season found:', season);
            return [];
        }

        var foundEpisode = null;
        for (var j = 0; j < foundSeason.episodes.length; j++) {
            if (foundSeason.episodes[j].episode_number == episode) {
                foundEpisode = foundSeason.episodes[j];
                break;
            }
        }

        if (!foundEpisode || !foundEpisode.sources) {
            console.log('No episode found:', episode);
            return [];
        }

        console.log('Found sources for TV:', tmdbId, 'S' + season + 'E' + episode, foundEpisode.sources);
        return foundEpisode.sources;
    }
};
