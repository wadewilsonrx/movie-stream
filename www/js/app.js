// Streamiz Clone - Main Application Logic

// Global state
let heroMovies = [];
let currentHeroIndex = 0;
let heroInterval = null;
let genres = [];

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    await loadGenres();
    await loadHero();
    await loadAllSections();
    setupEventListeners();
});

// Load genres
async function loadGenres() {
    try {
        const data = await API.getGenres('movie');
        genres = data.genres;
    } catch (error) {
        console.error('Error loading genres:', error);
    }
}

// Load hero section with multiple movies for rotation
async function loadHero() {
    try {
        const data = await API.getTrending('movie', 'week');
        heroMovies = data.results.filter(m => m.backdrop_path && m.overview).slice(0, 5);

        if (heroMovies.length > 0) {
            updateHero(heroMovies[0]);
            startHeroSlider();
        }
    } catch (error) {
        console.error('Error loading hero:', error);
    }
}

// Start hero slider - rotates every 5 seconds
function startHeroSlider() {
    if (heroMovies.length <= 1) return;

    heroInterval = setInterval(() => {
        currentHeroIndex = (currentHeroIndex + 1) % heroMovies.length;
        slideToHero(heroMovies[currentHeroIndex]);
    }, 5000);
}

// Slide animation to new hero
function slideToHero(movie) {
    const heroContent = document.querySelector('.hero-content');
    const heroBackdrop = document.getElementById('heroBackdrop');

    // Slide out animation
    heroContent.style.opacity = '0';
    heroContent.style.transform = 'translateX(-30px)';
    heroBackdrop.style.opacity = '0';

    setTimeout(() => {
        updateHero(movie);

        // Slide in animation
        heroContent.style.transition = 'all 0.6s ease-out';
        heroContent.style.opacity = '1';
        heroContent.style.transform = 'translateX(0)';
        heroBackdrop.style.transition = 'opacity 1s ease-out';
        heroBackdrop.style.opacity = '1';
    }, 600);
}

// Update hero section
function updateHero(movie) {
    const heroImage = document.getElementById('heroImage');
    heroImage.src = API.getBackdropUrl(movie.backdrop_path);
    heroImage.alt = movie.title || movie.name;

    document.getElementById('heroTitle').textContent = movie.title || movie.name;
    document.getElementById('heroDescription').textContent = movie.overview;
    document.getElementById('heroRating').querySelector('span:last-child').textContent = movie.vote_average.toFixed(1);
    document.getElementById('heroYear').textContent = (movie.release_date || movie.first_air_date)?.split('-')[0] || '';

    // Genres
    // Genres
    let genreHtml = '';
    if (movie.genres && Array.isArray(movie.genres)) {
        // Detail object format (from manual DB -> getDetails)
        genreHtml = movie.genres.map(g => `<span class="genre-tag">${g.name}</span>`).join('');
    } else if (movie.genre_ids && Array.isArray(movie.genre_ids)) {
        // List object format (fallback)
        genreHtml = movie.genre_ids.map(id => {
            const genre = genres.find(g => g.id === id);
            return genre ? `<span class="genre-tag">${genre.name}</span>` : '';
        }).join('');
    }
    document.getElementById('heroGenres').innerHTML = genreHtml;

    // Buttons
    const mediaType = movie.title ? 'movie' : 'tv';
    document.getElementById('heroWatchBtn').onclick = () => {
        window.location.href = `${mediaType}.html?id=${movie.id}`;
    };
    document.getElementById('heroInfoBtn').onclick = () => {
        window.location.href = `${mediaType}.html?id=${movie.id}`;
    };

    // Update indicators
    updateHeroIndicators();
}

// Update hero slide indicators
function updateHeroIndicators() {
    const indicatorsContainer = document.getElementById('heroIndicators');
    if (!indicatorsContainer) return;

    indicatorsContainer.innerHTML = heroMovies.map((_, index) => `
        <button class="hero-indicator ${index === currentHeroIndex ? 'active' : ''}" 
                onclick="goToHero(${index})"></button>
    `).join('');
}

// Go to specific hero slide
function goToHero(index) {
    if (index === currentHeroIndex) return;

    // Reset interval
    if (heroInterval) {
        clearInterval(heroInterval);
    }

    currentHeroIndex = index;
    slideToHero(heroMovies[index]);
    startHeroSlider();
}

// Load all content sections
async function loadAllSections() {
    try {
        // Trending movies
        const trending = await API.getTrending('movie', 'week');
        displayCards('trendingGrid', trending.results.slice(0, 7), 'movie');

        // Popular movies
        const movies = await API.getPopular('movie');
        displayCards('moviesGrid', movies.results.slice(0, 7), 'movie');

        // Popular TV shows
        const tvShows = await API.getPopular('tv');
        displayCards('tvGrid', tvShows.results.slice(0, 7), 'tv');

        // Top rated movies
        const topRated = await API.getTopRated('movie');
        displayCards('topRatedGrid', topRated.results.slice(0, 7), 'movie');

        // Top rated TV shows
        const topRatedTV = await API.getTopRated('tv');
        displayCards('topRatedTVGrid', topRatedTV.results.slice(0, 7), 'tv');

    } catch (error) {
        console.error('Error loading sections:', error);
    }
}

// Display cards - Streamiz style
function displayCards(containerId, items, forceMediaType = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">No content available.</p>';
        return;
    }

    container.innerHTML = items.map((item, index) => {
        const mediaType = forceMediaType || item.media_type || 'movie';
        const title = item.title || item.name;
        const date = item.release_date || item.first_air_date;
        const link = `${mediaType}.html?id=${item.id}`;

        return `
            <a href="${link}" class="card" style="animation-delay: ${index * 0.05}s">
                <div class="card-poster">
                    <img src="${API.getImageUrl(item.poster_path)}" alt="${title}" loading="lazy">
                    <div class="card-play">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                    </div>
                    <div class="card-rating">
                        <svg viewBox="0 0 24 24">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                        ${item.vote_average?.toFixed(1) || 'N/A'}
                    </div>
                </div>
                <div class="card-info">
                    <h3 class="card-title">${title}</h3>
                    <p class="card-meta">${date?.split('-')[0] || 'N/A'}</p>
                </div>
            </a>
        `;
    }).join('');
}

// Setup event listeners
function setupEventListeners() {
    // Search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim();
                if (query) {
                    window.location.href = `search.html?q=${encodeURIComponent(query)}`;
                }
            }
        });
    }

    // Navbar scroll effect
    window.addEventListener('scroll', () => {
        const navbar = document.getElementById('navbar');
        if (navbar) {
            if (window.scrollY > 100) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }
    });

    // Pause slider on hover
    const hero = document.querySelector('.hero');
    if (hero) {
        hero.addEventListener('mouseenter', () => {
            if (heroInterval) clearInterval(heroInterval);
        });
        hero.addEventListener('mouseleave', () => {
            startHeroSlider();
        });
    }
}
