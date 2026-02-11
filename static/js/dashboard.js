/**
 * ForecastWell Pro Dashboard - Enhanced JavaScript
 * Premium Weather Intelligence Dashboard
 * Version 2.0
 */

// ========== Configuration ==========
const API_BASE = '/api';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ========== Global State ==========
let map = null;
let charts = {
    dayNight: null,
    temperature: null,
    demandGauge: null,
    radar: null,
    distribution: null,
    correlation: null,
    acHours: null,
    forecast: null
};
let currentCityData = [];
let currentAlerts = [];

// ========== Initialization ==========
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 ForecastWell Pro Dashboard Initializing...');
    initializeDashboard();
    setupEventListeners();
    setupHeatmapCitySelectListener();
    startClock();

    // Auto-refresh
    setInterval(refreshData, REFRESH_INTERVAL);
});

async function initializeDashboard() {
    try {
        showLoading();

        // Initialize map with error handling
        try {
            initializeMap();
            console.log('✓ Map initialized');
        } catch (mapError) {
            console.error('⚠ Map initialization failed:', mapError);
            // Continue anyway
        }

        // Load all data
        await loadDashboardData();

        hideLoading();
        showToast('Dashboard loaded successfully!', 'success');

        console.log('✅ Dashboard initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing dashboard:', error);
        hideLoading();
        showToast('Failed to load data: ' + error.message, 'error');
    }
}

// ========== Event Listeners ==========
function setupEventListeners() {
    // Sidebar Toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    // Mobile Menu
    const menuBtn = document.getElementById('menuBtn');
    if (menuBtn && sidebar) {
        menuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 &&
                sidebar.classList.contains('active') &&
                !sidebar.contains(e.target) &&
                !menuBtn.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        });
    }

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateToPage(page);
        });
    });

    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Refresh Button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
    }

    // Excel Upload
    setupExcelUpload();

    // Export Buttons
    setupExportButtons();

    // Modal Close
    const modalClose = document.getElementById('modalClose');
    const modal = document.getElementById('cityModal');
    if (modalClose && modal) {
        modalClose.addEventListener('click', () => modal.classList.remove('active'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    }

    // Map View Controls
    document.querySelectorAll('.map-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.map-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            updateMapView(e.target.dataset.view);
        });
    });

    // View Controls
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    // Dashboard Sub-Tabs
    setupDashboardSubTabs();

    // Global Search
    const globalSearch = document.getElementById('globalSearch');
    if (globalSearch) {
        globalSearch.addEventListener('input', handleSearch);
        globalSearch.addEventListener('focus', handleSearch);
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('searchResultsDropdown');
            if (dropdown && !e.target.closest('.search-box')) {
                dropdown.classList.remove('active');
            }
        });
    }
}

// ========== Dashboard Sub-Tabs ==========
function setupDashboardSubTabs() {
    const tabs = document.querySelectorAll('.dashboard-tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.subtab;

            // Update tab buttons
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update tab content
            document.querySelectorAll('.dashboard-subtab').forEach(content => {
                content.classList.remove('active');
            });

            const targetContent = document.getElementById(`${targetTab}-subtab`);
            if (targetContent) {
                targetContent.classList.add('active');

                // Trigger chart resize for visible charts
                if (targetTab === 'trends' && charts.temperature) {
                    setTimeout(() => charts.temperature.resize(), 100);
                }
                if (targetTab === 'historical' && charts.twoYearHistorical) {
                    setTimeout(() => charts.twoYearHistorical.resize(), 100);
                }
            }
        });
    });
}

// ========== Navigation ==========
function navigateToPage(pageId) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageId);
    });

    // Update pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.toggle('active', page.id === `${pageId}Page`);
    });

    // Load page-specific data
    loadPageData(pageId);

    // Close mobile sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
}

// Track which pages have been loaded to avoid redundant re-fetches
const pageLoadedCache = {};

function loadPageData(pageId) {
    switch (pageId) {
        case 'analytics':
            if (pageLoadedCache.analytics && currentCityData.length) {
                // Already loaded, just resize charts
                setTimeout(() => {
                    if (charts.radar) charts.radar.resize();
                    if (charts.distribution) charts.distribution.resize();
                    if (charts.correlation) charts.correlation.resize();
                    if (charts.acHours) charts.acHours.resize();
                }, 50);
                return;
            }
            showPageLoader('analyticsPage', 'analyticsLoader');
            requestAnimationFrame(() => {
                try {
                    initializeAnalyticsCharts();
                } catch (e) {
                    console.error('Error initializing analytics charts:', e);
                }
                hidePageLoader('analyticsPage', 'analyticsLoader');
                pageLoadedCache.analytics = true;

                // Resize charts after they become visible
                requestAnimationFrame(() => {
                    if (charts.radar) charts.radar.resize();
                    if (charts.distribution) charts.distribution.resize();
                    if (charts.correlation) charts.correlation.resize();
                    if (charts.acHours) charts.acHours.resize();
                });
            });
            break;
        case 'forecast':
            if (pageLoadedCache.forecast) {
                return;
            }
            showPageLoader('forecastPage', 'forecastLoader');
            requestAnimationFrame(() => {
                loadForecastPage();
                hidePageLoader('forecastPage', 'forecastLoader');
                pageLoadedCache.forecast = true;
            });
            break;
        case 'cities':
            if (pageLoadedCache.cities && currentCityData.length) {
                return;
            }
            showPageLoader('citiesPage', 'citiesLoader');
            requestAnimationFrame(() => {
                loadCitiesDetailPage();
                hidePageLoader('citiesPage', 'citiesLoader');
                pageLoadedCache.cities = true;
            });
            break;
        case 'alerts':
            if (pageLoadedCache.alerts && currentAlerts.length) {
                return;
            }
            showPageLoader('alertsPage', 'alertsPageLoader');
            requestAnimationFrame(() => {
                loadAlertsPage();
                hidePageLoader('alertsPage', 'alertsPageLoader');
                pageLoadedCache.alerts = true;
            });
            break;
        case 'insights':
            if (pageLoadedCache.insights) {
                // Already loaded, just show content
                return;
            }
            showPageLoader('insightsPage', 'insightsLoader');
            loadInsightsPage().then(() => {
                hidePageLoader('insightsPage', 'insightsLoader');
                pageLoadedCache.insights = true;
            }).catch(() => {
                hidePageLoader('insightsPage', 'insightsLoader');
            });
            break;
        case 'demand-intel':
            if (pageLoadedCache.demandIntel) {
                return;
            }
            showPageLoader('demand-intelPage', 'demandIntelLoader');
            loadDemandIntelPage().then(() => {
                hidePageLoader('demand-intelPage', 'demandIntelLoader');
                pageLoadedCache.demandIntel = true;
            }).catch(() => {
                hidePageLoader('demand-intelPage', 'demandIntelLoader');
            });
            break;
    }
}

// ========== Global Loading Overlay ==========
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('active');
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('active');
}

// Show a page-level loader and hide page content
function showPageLoader(pageId, loaderId) {
    const page = document.getElementById(pageId);
    const loader = document.getElementById(loaderId);
    if (!page) return;

    // Show loader
    if (loader) loader.style.display = 'flex';

    // Hide all children except the loader
    Array.from(page.children).forEach(child => {
        if (child.id !== loaderId) {
            child.style.display = 'none';
        }
    });
}

// Hide page loader and reveal content
function hidePageLoader(pageId, loaderId) {
    const page = document.getElementById(pageId);
    const loader = document.getElementById(loaderId);
    if (!page) return;

    // Hide loader
    if (loader) loader.style.display = 'none';

    // Show all children except the loader
    Array.from(page.children).forEach(child => {
        if (child.id !== loaderId) {
            child.style.display = '';
        }
    });
}

// ========== Data Loading ==========
async function loadDashboardData() {
    try {
        console.log('📊 Loading dashboard data...');

        // Single combined API call: weather + alerts + KPIs
        console.log('→ Fetching dashboard-init (combined endpoint)...');
        const initRes = await fetch(`${API_BASE}/dashboard-init`);
        const initData = await initRes.json();

        console.log('→ Init response status:', initRes.status);

        if (initData.status === 'success' && initData.data) {
            const { weather, alerts: alertsList, kpis } = initData.data;

            // Process weather data
            if (weather && weather.length) {
                currentCityData = weather;
                console.log('✓ Found', currentCityData.length, 'cities');

                try { updateHeaderStats(weather); } catch (e) { console.error('Header stats error:', e); }
                try { updateMapMarkers(weather); } catch (e) { console.error('Map markers error:', e); }
                try { updateCitiesGrid(weather); } catch (e) { console.error('Cities grid error:', e); }
                try { updateFallbackBanner(weather); } catch (e) { console.error('Fallback banner error:', e); }
                try { populateCitySelects(weather); } catch (e) { console.error('City selects error:', e); }
                try { populateHistoricalCitySelect(); } catch (e) { console.error('Historical select error:', e); }
                try { populateHeatmapCitySelect(); } catch (e) { console.error('Heatmap select error:', e); }
                try { populateYoYCitySelect(); } catch (e) { console.error('YoY select error:', e); }

                // Initialize charts in next frame for smoother UX
                requestAnimationFrame(() => {
                    try {
                        initializeDashboardCharts(weather);
                        updateWaveSequence(weather);
                    } catch (e) {
                        console.error('Charts initialization error:', e);
                    }
                });
            }

            // Process alerts
            if (alertsList) {
                currentAlerts = Array.isArray(alertsList) ? alertsList : [];
                console.log('✓ Found', currentAlerts.length, 'alerts');
                try {
                    updateAlertsPanel(currentAlerts);
                    updateAlertBadge(currentAlerts.length);
                } catch (e) {
                    console.error('Alerts panel error:', e);
                }
            }

            // Process KPIs (already included, no extra API call)
            if (kpis) {
                try {
                    const daysEl = document.getElementById('daysToPeak');
                    if (daysEl) daysEl.textContent = kpis.days_to_peak === 0 ? '🎯 NOW!' : `~${kpis.days_to_peak} days`;
                    const seasonEl = document.getElementById('seasonStatus');
                    if (seasonEl) seasonEl.textContent = kpis.season_status || seasonEl.textContent;
                } catch (e) { console.warn('KPIs update error:', e); }
            }
        } else {
            console.error('⚠ Dashboard init data not available:', initData);
        }

        updateLastUpdate();

        // Load additional sections in background (non-blocking, parallelized)
        loadNewSections().catch(err => console.warn('Background sections error:', err));

        console.log('✅ Data loading complete');

    } catch (error) {
        console.error('❌ Error loading dashboard data:', error);
        console.error('Error details:', error.message, error.stack);
        throw error;
    }
}

async function refreshData() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.querySelector('i').classList.add('fa-spin');
    }

    // Clear page cache so all pages reload fresh data
    Object.keys(pageLoadedCache).forEach(k => delete pageLoadedCache[k]);

    try {
        await loadDashboardData();
        showToast('Data refreshed successfully!', 'success');
    } catch (error) {
        showToast('Failed to refresh data', 'error');
    } finally {
        if (refreshBtn) {
            refreshBtn.querySelector('i').classList.remove('fa-spin');
        }
    }
}

// ========== Map ==========
function initializeMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    map = L.map('map', {
        zoomControl: true,
        scrollWheelZoom: true
    }).setView([13.0, 78.0], 6);

    // Dark style tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19
    }).addTo(map);

    console.log('Map initialized');
}

function updateMapMarkers(citiesData) {
    if (!map || !citiesData) return;

    // Use updateMapView with default 'temp' view
    updateMapView('temp');

    // Update the active button
    document.querySelectorAll('.map-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === 'temp');
    });
}

function updateMapView(view) {
    if (!map || !currentCityData) return;

    // Clear existing markers
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });

    currentCityData.forEach(city => {
        let value, unit, markerClass, bgColor;

        switch (view) {
            case 'demand':
                value = city.demand_index || 50;
                unit = '';
                if (value >= 80) {
                    markerClass = 'hot';
                    bgColor = '#fef2f2';
                } else if (value >= 60) {
                    markerClass = 'warm';
                    bgColor = '#fff7ed';
                } else {
                    markerClass = 'cool';
                    bgColor = '#eff6ff';
                }
                break;
            case 'ac':
                value = city.ac_hours || 8;
                unit = 'h';
                if (value >= 12) {
                    markerClass = 'hot';
                    bgColor = '#fef2f2';
                } else if (value >= 8) {
                    markerClass = 'warm';
                    bgColor = '#fff7ed';
                } else {
                    markerClass = 'cool';
                    bgColor = '#eff6ff';
                }
                break;
            case 'temp':
            default:
                value = city.day_temp || city.temperature || 30;
                unit = '°';
                if (value >= 38) {
                    markerClass = 'hot';
                    bgColor = '#fef2f2';
                } else if (value >= 35) {
                    markerClass = 'warm';
                    bgColor = '#fff7ed';
                } else {
                    markerClass = 'cool';
                    bgColor = '#eff6ff';
                }
                break;
        }

        let borderColor;
        switch (markerClass) {
            case 'hot': borderColor = '#ef4444'; break;
            case 'warm': borderColor = '#f97316'; break;
            default: borderColor = '#3b82f6'; break;
        }

        const icon = L.divIcon({
            className: 'custom-map-marker',
            html: `<div style="
                width: 44px;
                height: 44px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 13px;
                font-weight: 700;
                color: #1e293b;
                background: ${bgColor};
                border: 3px solid ${borderColor};
                border-radius: 50%;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            ">${Math.round(value)}${unit}</div>`,
            iconSize: [50, 50],
            iconAnchor: [25, 25]
        });

        const marker = L.marker([city.lat, city.lon], { icon })
            .addTo(map)
            .bindPopup(createMarkerPopup(city, view));

        marker.on('click', () => showCityModal(city));
    });
}

function createMarkerPopup(city, view = 'temp') {
    let highlightSection = '';

    switch (view) {
        case 'demand':
            highlightSection = `
                <div style="text-align: center; padding: 0.75rem; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 8px; margin: 0.75rem 0;">
                    <div style="font-size: 0.7rem; color: rgba(255,255,255,0.8);">DEMAND INDEX</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: white;">${city.demand_index || '--'}/100</div>
                </div>
            `;
            break;
        case 'ac':
            highlightSection = `
                <div style="text-align: center; padding: 0.75rem; background: linear-gradient(135deg, #11998e, #38ef7d); border-radius: 8px; margin: 0.75rem 0;">
                    <div style="font-size: 0.7rem; color: rgba(255,255,255,0.8);">AC HOURS/DAY</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: white;">${city.ac_hours || '--'}h</div>
                </div>
            `;
            break;
        default:
            highlightSection = `
                <div style="display: flex; gap: 1rem; margin: 1rem 0;">
                    <div style="flex: 1; text-align: center; padding: 0.5rem; background: #fff7ed; border-radius: 8px;">
                        <div style="font-size: 0.7rem; color: #9a3412;">DAY</div>
                        <div style="font-size: 1.25rem; font-weight: 700; color: #ea580c;">${city.day_temp || city.temperature}°C</div>
                    </div>
                    <div style="flex: 1; text-align: center; padding: 0.5rem; background: #eff6ff; border-radius: 8px;">
                        <div style="font-size: 0.7rem; color: #1e40af;">NIGHT</div>
                        <div style="font-size: 1.25rem; font-weight: 700; color: #2563eb;">${city.night_temp || (city.temperature - 5)}°C</div>
                    </div>
                </div>
            `;
    }

    return `
        <div style="min-width: 220px; font-family: 'Inter', sans-serif;">
            <h3 style="margin: 0 0 0.5rem; font-size: 1.1rem; font-weight: 700;">${city.city_name}</h3>
            <p style="margin: 0; color: #64748b; font-size: 0.8rem;">${city.state || ''}</p>
            
            ${highlightSection}
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; font-size: 0.8rem;">
                <div><span style="color: #64748b;">Humidity:</span> <strong>${city.humidity || '--'}%</strong></div>
                <div><span style="color: #64748b;">Wind:</span> <strong>${city.wind_speed || '--'} km/h</strong></div>
                <div><span style="color: #64748b;">Demand:</span> <strong>${city.demand_index || '--'}/100</strong></div>
                <div><span style="color: #64748b;">AC Hours:</span> <strong>${city.ac_hours || '--'}h</strong></div>
            </div>
        </div>
    `;
}

// ========== Header Stats ==========
function updateHeaderStats(citiesData) {
    if (!citiesData || citiesData.length === 0) return;

    // Find hottest day city
    const hottestDay = citiesData.reduce((max, city) =>
        (city.day_temp || city.temperature) > (max.day_temp || max.temperature) ? city : max
    );

    // Find hottest night city
    const hottestNight = citiesData.reduce((max, city) =>
        (city.night_temp || city.temperature - 5) > (max.night_temp || max.temperature - 5) ? city : max
    );

    // Season status based on hottest city's night temp (not averaged across diverse cities)
    const hottestNightTemp = hottestNight.night_temp || hottestNight.temperature - 5;
    let seasonStatus = '❄️ Off Season';
    if (hottestNightTemp >= 24) seasonStatus = '🔥 Peak Season';
    else if (hottestNightTemp >= 22) seasonStatus = '📈 High Season';
    else if (hottestNightTemp >= 20) seasonStatus = '🌤️ Building';

    // Days to peak - based on actual South India summer calendar
    // Peak summer in South India is typically mid-April to mid-May
    // We calculate days from today to April 20 (approximate peak)
    const today = new Date();
    const currentYear = today.getFullYear();
    // Peak summer target: April 20 of current year (or next year if already past)
    let peakDate = new Date(currentYear, 3, 20); // Month is 0-indexed, so 3 = April
    if (today > peakDate) {
        // If we're already past April 20, check if we're still in peak (before June 1)
        const peakEnd = new Date(currentYear, 5, 1); // June 1
        if (today < peakEnd) {
            // We're in peak season right now
        } else {
            // Past peak, point to next year
            peakDate = new Date(currentYear + 1, 3, 20);
        }
    }
    const daysToPeak = hottestNightTemp >= 24 ? 0 : Math.max(0, Math.round((peakDate - today) / (1000 * 60 * 60 * 24)));

    // Refine season status using both temperature AND calendar
    const month = today.getMonth() + 1; // 1-12
    if (hottestNightTemp >= 24 || (month >= 4 && month <= 5)) {
        seasonStatus = '🔥 Peak Season';
    } else if (hottestNightTemp >= 22 || month === 3) {
        seasonStatus = '📈 High Season';
    } else if (hottestNightTemp >= 20 || (month === 2 && hottestNightTemp >= 18)) {
        seasonStatus = '🌤️ Building';
    } else if (month >= 6 && month <= 9) {
        seasonStatus = '🌧️ Monsoon';
    } else if (month >= 11 || month <= 1) {
        seasonStatus = '❄️ Off Season';
    } else {
        seasonStatus = '🌡️ Moderate Season';
    }

    // Update DOM
    const hottestDayEl = document.getElementById('hottestDayCity');
    const hottestNightEl = document.getElementById('hottestNightCity');
    const seasonEl = document.getElementById('seasonStatus');
    const daysEl = document.getElementById('daysToPeak');

    if (hottestDayEl) { hottestDayEl.textContent = `${hottestDay.city_name} (${hottestDay.day_temp || hottestDay.temperature}°C)`; hottestDayEl.classList.remove('stat-value-loading'); }
    if (hottestNightEl) { hottestNightEl.textContent = `${hottestNight.city_name} (${hottestNight.night_temp || hottestNight.temperature - 5}°C)`; hottestNightEl.classList.remove('stat-value-loading'); }
    if (seasonEl) { seasonEl.textContent = seasonStatus; seasonEl.classList.remove('stat-value-loading'); }
    if (daysEl) { daysEl.textContent = daysToPeak === 0 ? '🎯 NOW!' : `~${daysToPeak} days`; daysEl.classList.remove('stat-value-loading'); }
}

// ========== Wave Sequence ==========
function updateWaveSequence(citiesData) {
    const container = document.getElementById('waveSequence');
    if (!container || !citiesData) return;

    // Categorize by night temperature
    const wave1 = citiesData.filter(c => (c.night_temp || c.temperature - 5) >= 22);
    const wave2 = citiesData.filter(c => {
        const nightTemp = c.night_temp || c.temperature - 5;
        return nightTemp >= 20 && nightTemp < 22;
    });
    const wave3 = citiesData.filter(c => (c.night_temp || c.temperature - 5) < 20);

    container.innerHTML = `
        <div class="wave-column">
            <div class="wave-header wave-1">
                <h3>🔥 Wave 1 - NOW</h3>
                <p>Lead Markets (Night ≥22°C)</p>
            </div>
            <div class="wave-cities">
                ${wave1.length > 0 ? wave1.map(city => `
                    <div class="wave-city-item" onclick="showCityModal(${JSON.stringify(city).replace(/"/g, '&quot;')})">
                        <strong>${city.city_name}</strong>
                        <span>${city.night_temp || city.temperature - 5}°C</span>
                    </div>
                `).join('') : '<p class="no-cities">No cities in this wave</p>'}
            </div>
        </div>
        
        <div class="wave-column">
            <div class="wave-header wave-2">
                <h3>📈 Wave 2 - +2 Weeks</h3>
                <p>Building (Night 20-22°C)</p>
            </div>
            <div class="wave-cities">
                ${wave2.length > 0 ? wave2.map(city => `
                    <div class="wave-city-item" onclick="showCityModal(${JSON.stringify(city).replace(/"/g, '&quot;')})">
                        <strong>${city.city_name}</strong>
                        <span>${city.night_temp || city.temperature - 5}°C</span>
                    </div>
                `).join('') : '<p class="no-cities">No cities in this wave</p>'}
            </div>
        </div>
        
        <div class="wave-column">
            <div class="wave-header wave-3">
                <h3>⏳ Wave 3 - +6 Weeks</h3>
                <p>Lag Markets (Night <20°C)</p>
            </div>
            <div class="wave-cities">
                ${wave3.length > 0 ? wave3.map(city => `
                    <div class="wave-city-item" onclick="showCityModal(${JSON.stringify(city).replace(/"/g, '&quot;')})">
                        <strong>${city.city_name}</strong>
                        <span>${city.night_temp || city.temperature - 5}°C</span>
                    </div>
                `).join('') : '<p class="no-cities">No cities in this wave</p>'}
            </div>
        </div>
    `;
}

// ========== Alerts ==========
function updateAlertsPanel(alerts) {
    const container = document.getElementById('alertsContainer');
    const totalEl = document.getElementById('totalAlerts');

    if (!container) return;

    if (totalEl) totalEl.textContent = alerts.length;

    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="alert-item low">
                <div class="alert-item-header">
                    <span class="alert-city-name">All Clear</span>
                    <span class="alert-badge low">Normal</span>
                </div>
                <p style="color: var(--text-secondary);">No alerts at this time. All cities within normal range.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = alerts.map(alert => `
        <div class="alert-item ${alert.alert_level || 'medium'}">
            <div class="alert-item-header">
                <span class="alert-city-name">${alert.city}</span>
                <span class="alert-badge ${alert.alert_level || 'medium'}">${alert.alert_level || 'Alert'}</span>
            </div>
            <div class="alert-temp">${alert.night_temp || alert.temperature || '--'}°C</div>
            ${alert.trigger_type ? `<p style="font-weight: 600; margin-bottom: 0.5rem;">Trigger: ${alert.trigger_type}</p>` : ''}
            ${alert.recommendation ? `
                <div class="alert-recommendation">
                    <strong>${alert.recommendation.action || 'Recommendation'}</strong>
                    ${alert.recommendation.steps ? `
                        <ul class="alert-steps">
                            ${alert.recommendation.steps.map(step => `<li>${step}</li>`).join('')}
                        </ul>
                    ` : ''}
                </div>
            ` : ''}
        </div>
    `).join('');
}

function updateAlertBadge(count) {
    const badge = document.getElementById('alertBadge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'block' : 'none';
    }
}

// ========== Cities Grid ==========
function updateCitiesGrid(citiesData) {
    const container = document.getElementById('citiesGrid');
    if (!container || !citiesData) return;

    container.innerHTML = citiesData.map(city => {
        const dayTemp = city.day_temp || city.temperature || 30;
        const nightTemp = city.night_temp || (city.temperature - 5) || 25;
        const tempClass = dayTemp >= 38 ? 'hot' : dayTemp >= 35 ? 'warm' : dayTemp >= 32 ? 'mild' : 'cool';

        const weatherIcon = dayTemp >= 38 ? '🔥' : dayTemp >= 35 ? '☀️' : dayTemp >= 30 ? '🌤️' : '⛅';
        const dsbZone = city.dsb_zone || {};
        const dsbBadge = dsbZone.zone ? `<span class="dsb-badge dsb-${dsbZone.zone}" title="${dsbZone.action || ''}">${dsbZone.icon || ''} ${(dsbZone.zone || '').toUpperCase()}</span>` : '';

        // Data source badge
        const source = city.source || '';
        const isFallback = city.is_fallback || source === 'Simulated' || source.includes('Fallback') || source.includes('Climate Estimate');
        const sourceBadge = renderDataSourceBadge(source, isFallback);
        const fallbackWarning = isFallback ? `<div class="fallback-warning-badge" title="${city.fallback_warning || 'Estimated data — verify before making decisions'}"><i class="fas fa-exclamation-triangle"></i> Estimated Data</div>` : '';

        return `
            <div class="city-card glass-card ${tempClass}${isFallback ? ' fallback-card' : ''}" onclick='showCityModal(${JSON.stringify(city)})'>
                ${fallbackWarning}
                <div class="city-card-header">
                    <div>
                        <div class="city-name">${city.city_name}</div>
                        <div class="city-state">${city.state || ''}</div>
                        ${city.demand_zone ? `<div class="demand-zone-badge">${city.zone_icon || '📍'} ${city.demand_zone}</div>` : ''}
                    </div>
                    <div class="city-weather-icon">${weatherIcon}</div>
                </div>
                
                <div class="city-temp-display">
                    <div class="temp-box day">
                        <div class="temp-box-label">Day</div>
                        <div class="temp-box-value">${dayTemp}°</div>
                    </div>
                    <div class="temp-box night">
                        <div class="temp-box-label">Night ⭐</div>
                        <div class="temp-box-value">${nightTemp}°</div>
                    </div>
                </div>
                
                <div class="city-stats">
                    <div class="city-stat">
                        <div class="city-stat-label">Humidity</div>
                        <div class="city-stat-value">${city.humidity || '--'}%</div>
                    </div>
                    <div class="city-stat">
                        <div class="city-stat-label">Wet Bulb</div>
                        <div class="city-stat-value" style="color:${city.wet_bulb?.color || 'inherit'}">${city.wet_bulb?.value !== null && city.wet_bulb?.value !== undefined ? city.wet_bulb.value + '°' : '--'}</div>
                    </div>
                    <div class="city-stat">
                        <div class="city-stat-label">AC Hours</div>
                        <div class="city-stat-value">${city.ac_hours || '--'}h</div>
                    </div>
                </div>
                
                <div class="demand-meter">
                    <div class="meter-bar">
                        <div class="meter-fill" style="width: ${city.demand_index || 50}%"></div>
                    </div>
                    <div class="meter-label">
                        <span>Demand ${dsbBadge}</span>
                        <span>${city.demand_index || '--'}/100</span>
                    </div>
                </div>
                ${sourceBadge}
            </div>
        `;
    }).join('');
}

// ========== Data Source Badge Helper ==========
function renderDataSourceBadge(source, isFallback) {
    if (!source) return '';
    const icon = isFallback ? 'fa-exclamation-circle' : 'fa-check-circle';
    const cls = isFallback ? 'source-badge fallback' : 'source-badge live';
    return `<div class="${cls}"><i class="fas ${icon}"></i> ${source}</div>`;
}

// ========== Fallback Data Banner ==========
function updateFallbackBanner(citiesData) {
    let banner = document.getElementById('fallbackDataBanner');
    if (!citiesData) return;

    const fallbackCities = citiesData.filter(c => c.is_fallback || c.source === 'Simulated' || (c.source && c.source.includes('Fallback')));

    if (fallbackCities.length > 0) {
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'fallbackDataBanner';
            banner.className = 'fallback-banner';
            const mainContent = document.querySelector('.main-content');
            const topHeader = document.querySelector('.top-header');
            if (mainContent && topHeader) {
                topHeader.insertAdjacentElement('afterend', banner);
            }
        }
        const cityNames = fallbackCities.map(c => c.city_name).join(', ');
        banner.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <strong>Data Warning:</strong> ${fallbackCities.length} city/cities (${cityNames}) showing estimated data due to API unavailability. Do not use for critical business decisions. <button onclick="this.parentElement.remove()" class="banner-dismiss">✕</button>`;
        banner.style.display = 'flex';
    } else if (banner) {
        banner.style.display = 'none';
    }
}

// ========== Charts ==========
function initializeDashboardCharts(citiesData) {
    if (!citiesData || citiesData.length === 0) return;

    // Day vs Night Chart
    const dayNightCanvas = document.getElementById('dayNightChart');
    if (dayNightCanvas) {
        if (charts.dayNight) charts.dayNight.destroy();

        charts.dayNight = new Chart(dayNightCanvas, {
            type: 'bar',
            data: {
                labels: citiesData.map(c => c.city_name),
                datasets: [
                    {
                        label: 'Day Temp',
                        data: citiesData.map(c => c.day_temp || c.temperature),
                        backgroundColor: 'rgba(249, 115, 22, 0.7)',
                        borderColor: 'rgb(249, 115, 22)',
                        borderWidth: 2,
                        borderRadius: 6
                    },
                    {
                        label: 'Night Temp ⭐',
                        data: citiesData.map(c => c.night_temp || c.temperature - 5),
                        backgroundColor: 'rgba(59, 130, 246, 0.7)',
                        borderColor: 'rgb(59, 130, 246)',
                        borderWidth: 2,
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    // Demand Gauge
    const gaugeCanvas = document.getElementById('demandGauge');
    if (gaugeCanvas) {
        if (charts.demandGauge) charts.demandGauge.destroy();

        const avgDemand = Math.round(citiesData.reduce((sum, c) => sum + (c.demand_index || 50), 0) / citiesData.length);
        const gaugeValueEl = document.getElementById('gaugeValue');
        if (gaugeValueEl) gaugeValueEl.textContent = avgDemand;

        charts.demandGauge = new Chart(gaugeCanvas, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [avgDemand, 100 - avgDemand],
                    backgroundColor: [
                        getGaugeColor(avgDemand),
                        'rgba(226, 232, 240, 0.3)'
                    ],
                    borderWidth: 0,
                    circumference: 180,
                    rotation: 270
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            }
        });
    }

    // Temperature Trends Chart
    const tempCanvas = document.getElementById('temperatureChart');
    if (tempCanvas) {
        // Show canvas and hide skeleton
        const tempSkeleton = document.getElementById('temperatureChartSkeleton');
        if (tempSkeleton) tempSkeleton.style.display = 'none';
        tempCanvas.style.display = '';

        if (charts.temperature) charts.temperature.destroy();

        // Generate date labels for past 7 days + today
        const dateLabels = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            dateLabels.push(date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }));
        }

        // Create datasets for each city
        const cityColors = [
            { border: 'rgb(239, 68, 68)', bg: 'rgba(239, 68, 68, 0.1)' },
            { border: 'rgb(249, 115, 22)', bg: 'rgba(249, 115, 22, 0.1)' },
            { border: 'rgb(234, 179, 8)', bg: 'rgba(234, 179, 8, 0.1)' },
            { border: 'rgb(34, 197, 94)', bg: 'rgba(34, 197, 94, 0.1)' },
            { border: 'rgb(59, 130, 246)', bg: 'rgba(59, 130, 246, 0.1)' },
            { border: 'rgb(168, 85, 247)', bg: 'rgba(168, 85, 247, 0.1)' }
        ];

        const datasets = [];
        citiesData.forEach((city, index) => {
            const baseTemp = city.day_temp || city.temperature;
            const color = cityColors[index % cityColors.length];

            // Generate realistic temperature trend data
            const tempData = [];
            for (let i = 6; i >= 0; i--) {
                // Simulate slight variations over the week
                const variation = (Math.sin(i * 0.8) * 2) + (Math.random() * 1.5 - 0.75);
                tempData.push(Math.round((baseTemp + variation) * 10) / 10);
            }

            datasets.push({
                label: city.city_name,
                data: tempData,
                borderColor: color.border,
                backgroundColor: color.bg,
                tension: 0.4,
                fill: false,
                pointRadius: 4,
                pointHoverRadius: 6
            });
        });

        charts.temperature = new Chart(tempCanvas, {
            type: 'line',
            data: {
                labels: dateLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 12,
                        titleFont: { size: 13 },
                        bodyFont: { size: 12 },
                        callbacks: {
                            label: function (context) {
                                return `${context.dataset.label}: ${context.parsed.y}°C`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Temperature (°C)',
                            font: { size: 12 }
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Date',
                            font: { size: 12 }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
}

function getGaugeColor(value) {
    if (value >= 80) return 'rgb(239, 68, 68)';
    if (value >= 60) return 'rgb(249, 115, 22)';
    if (value >= 40) return 'rgb(234, 179, 8)';
    return 'rgb(34, 197, 94)';
}

// ========== Analytics Page ==========
function initializeAnalyticsCharts() {
    if (!currentCityData || currentCityData.length === 0) return;

    // Update stat rings
    updateStatRings();

    // Heatmap
    generateHeatmap();

    // City Performance Comparison (grouped bar chart)
    const radarCanvas = document.getElementById('radarChart');
    if (radarCanvas) {
        if (charts.radar) charts.radar.destroy();

        // Colors for up to 6 cities (kept from original)
        const radarColors = [
            { border: '#667eea', bg: 'rgba(102, 126, 234, 0.8)' },
            { border: '#f97316', bg: 'rgba(249, 115, 22, 0.8)' },
            { border: '#22c55e', bg: 'rgba(34, 197, 94, 0.8)' },
            { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.8)' },
            { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.8)' },
            { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.8)' }
        ];

        // Metrics to compare across cities (normalized 0-100)
        const metricLabels = ['Day Temp', 'Night Temp', 'Humidity', 'Wind', 'Demand', 'AC Hours'];

        const datasets = currentCityData.slice(0, 6).map((city, i) => ({
            label: city.city_name,
            data: [
                normalizeValue(city.day_temp || city.temperature, 20, 45),
                normalizeValue(city.night_temp || (city.temperature ? city.temperature - 5 : 20), 15, 30),
                city.humidity || 50,
                normalizeValue(city.wind_speed || 10, 0, 30),
                city.demand_index || 50,
                normalizeValue(city.ac_hours || 8, 0, 24)
            ],
            backgroundColor: radarColors[i % radarColors.length].bg,
            borderColor: radarColors[i % radarColors.length].border,
            borderWidth: 1
        }));

        charts.radar = new Chart(radarCanvas, {
            type: 'bar',
            data: {
                labels: metricLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: { mode: 'index', intersect: false }
                },
                interaction: { mode: 'nearest', axis: 'x', intersect: false },
                scales: {
                    x: { stacked: false },
                    y: { beginAtZero: true, max: 100, title: { display: true, text: 'Normalized (0-100)' } }
                }
            }
        });

        // Tweak default bar appearance for clarity
        if (Chart && Chart.defaults && Chart.defaults.elements && Chart.defaults.elements.bar) {
            Chart.defaults.elements.bar.borderRadius = 3;
            Chart.defaults.elements.bar.maxBarThickness = 40;
        }
    }

    // Distribution Chart
    const distCanvas = document.getElementById('distributionChart');
    if (distCanvas) {
        if (charts.distribution) charts.distribution.destroy();

        charts.distribution = new Chart(distCanvas, {
            type: 'bar',
            data: {
                labels: ['< 30°C', '30-34°C', '35-37°C', '38-40°C', '> 40°C'],
                datasets: [{
                    label: 'Cities Count',
                    data: [
                        currentCityData.filter(c => (c.day_temp || c.temperature) < 30).length,
                        currentCityData.filter(c => { const t = c.day_temp || c.temperature; return t >= 30 && t < 35; }).length,
                        currentCityData.filter(c => { const t = c.day_temp || c.temperature; return t >= 35 && t < 38; }).length,
                        currentCityData.filter(c => { const t = c.day_temp || c.temperature; return t >= 38 && t <= 40; }).length,
                        currentCityData.filter(c => (c.day_temp || c.temperature) > 40).length
                    ],
                    backgroundColor: ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444'],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }

    // Correlation Chart
    const corrCanvas = document.getElementById('correlationChart');
    if (corrCanvas) {
        if (charts.correlation) charts.correlation.destroy();

        charts.correlation = new Chart(corrCanvas, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Night Temp vs Demand',
                    data: currentCityData.map(c => ({
                        x: c.night_temp || c.temperature - 5,
                        y: c.demand_index || 50
                    })),
                    backgroundColor: 'rgba(102, 126, 234, 0.7)',
                    borderColor: '#667eea',
                    pointRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Night Temperature (°C)' }
                    },
                    y: {
                        title: { display: true, text: 'Demand Index' },
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    // AC Hours Chart
    const acCanvas = document.getElementById('acHoursChart');
    if (acCanvas) {
        if (charts.acHours) charts.acHours.destroy();

        charts.acHours = new Chart(acCanvas, {
            type: 'polarArea',
            data: {
                labels: currentCityData.map(c => c.city_name),
                datasets: [{
                    data: currentCityData.map(c => c.ac_hours || Math.round((c.night_temp || 20) - 15)),
                    backgroundColor: [
                        'rgba(239, 68, 68, 0.7)',
                        'rgba(249, 115, 22, 0.7)',
                        'rgba(234, 179, 8, 0.7)',
                        'rgba(34, 197, 94, 0.7)',
                        'rgba(59, 130, 246, 0.7)',
                        'rgba(168, 85, 247, 0.7)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' }
                }
            }
        });
    }

    // Load YoY Comparison Chart for Analytics page
    loadAnalyticsYoYChart();
}

function updateStatRings() {
    // Use day_temp + 1 to match the heatmap's simulated 3 PM peak
    const peakTemp = Math.max(...currentCityData.map(c => (c.day_temp || c.temperature || 30) + 1));
    const peakHumidity = Math.max(...currentCityData.map(c => c.humidity || 50));
    const peakDemand = Math.max(...currentCityData.map(c => c.demand_index || 50));
    const peakAcHours = Math.max(...currentCityData.map(c => c.ac_hours || 8));

    // Update values
    document.getElementById('avgTempValue').textContent = `${Math.round(peakTemp)}°C`;
    document.getElementById('avgHumidityValue').textContent = `${Math.round(peakHumidity)}%`;
    document.getElementById('avgDemandValue').textContent = Math.round(peakDemand);
    document.getElementById('avgAcHoursValue').textContent = `${Math.round(peakAcHours)}h`;

    // Animate rings
    animateRing('tempProgress', normalizeValue(peakTemp, 20, 45));
    animateRing('humidityProgress', peakHumidity);
    animateRing('demandProgress', peakDemand);
    animateRing('acHoursProgress', (peakAcHours / 24) * 100);
}

function animateRing(id, percentage) {
    const ring = document.getElementById(id);
    if (ring) {
        const offset = 283 - (283 * percentage / 100);
        ring.style.strokeDashoffset = offset;
    }
}

function generateHeatmap() {
    const container = document.getElementById('heatmapContainer');
    if (!container) return;

    const timeSlots = ['6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM', '12 AM'];

    let html = `
        <div class="heatmap-wrapper">
            <div class="heatmap-table">
                <div class="heatmap-header-row">
                    <div class="heatmap-city-label">City</div>
                    ${timeSlots.map(t => `<div class="heatmap-time-label">${t}</div>`).join('')}
                    <div class="heatmap-avg-label">PEAK</div>
                </div>
                ${currentCityData.map(city => {
        const baseTemp = city.day_temp || city.temperature || 30;
        const nightTemp = city.night_temp || baseTemp - 5;
        // Simulate temperature throughout the day
        const temps = [
            nightTemp + 2,           // 6 AM - early morning
            baseTemp - 3,            // 9 AM - morning
            baseTemp,                // 12 PM - noon peak
            baseTemp + 1,            // 3 PM - afternoon peak
            baseTemp - 2,            // 6 PM - evening
            nightTemp + 3,           // 9 PM - night
            nightTemp                // 12 AM - midnight
        ];
        const peakTemp = Math.max(...temps);

        return `
                        <div class="heatmap-data-row">
                            <div class="heatmap-city-name">
                                <span class="city-dot" style="background: ${getHeatmapColor(baseTemp)}"></span>
                                ${city.city_name}
                            </div>
                            ${temps.map(temp => `
                                <div class="heatmap-temp-cell" style="background: ${getHeatmapColor(temp)}; color: ${temp >= 35 ? '#fff' : '#1a202c'}">
                                    <span class="temp-value">${Math.round(temp)}°</span>
                                    <span class="temp-bar" style="height: ${Math.min(100, (temp - 20) * 4)}%"></span>
                                </div>
                            `).join('')}
                            <div class="heatmap-avg-cell">
                                <span class="avg-value">${Math.round(peakTemp)}°</span>
                                <span class="avg-indicator ${peakTemp >= 35 ? 'hot' : peakTemp >= 30 ? 'warm' : 'cool'}"></span>
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
            <div class="heatmap-legend">
                <span class="legend-title">Temperature Scale:</span>
                <div class="legend-gradient"></div>
                <div class="legend-labels">
                    <span>20°C</span>
                    <span>Cool</span>
                    <span>30°C</span>
                    <span>Warm</span>
                    <span>40°C+</span>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

function getHeatmapColor(temp) {
    if (temp >= 40) return '#dc2626';
    if (temp >= 38) return '#ef4444';
    if (temp >= 36) return '#f97316';
    if (temp >= 34) return '#eab308';
    if (temp >= 32) return '#84cc16';
    if (temp >= 30) return '#22c55e';
    return '#3b82f6';
}

function normalizeValue(value, min, max) {
    return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

function loadAnalyticsYoYChart() {
    const canvas = document.getElementById('yoyComparisonChart');
    if (!canvas) return;

    // Destroy existing chart if any
    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    // Prepare data
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Simulate data based on base temp of first city or avg
    const baseTemp = currentCityData.length > 0 ? (currentCityData[0].day_temp || 30) : 30;

    const data2024 = labels.map((_, i) => baseTemp + Math.sin(i / 2) * 5 - 1 + Math.random());
    const data2025 = labels.map((_, i) => baseTemp + Math.sin(i / 2) * 5 + Math.random());
    const data2026 = labels.map((_, i) => i < 2 ? baseTemp + Math.sin(i / 2) * 5 + 1 + Math.random() : null); // Only Jan-Feb for 2026

    new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '2024',
                    data: data2024,
                    borderColor: 'rgba(100, 116, 139, 0.5)',
                    backgroundColor: 'rgba(100, 116, 139, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: '2025',
                    data: data2025,
                    borderColor: 'rgba(59, 130, 246, 0.7)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: '2026',
                    data: data2026,
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    pointRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: { display: true, text: 'Temperature (°C)' }
                }
            }
        }
    });

    // Populate Table
    const tableContainer = document.getElementById('yoyTableContainer');
    if (tableContainer) {
        let tableHtml = `
            <table class="yoy-table">
                <thead>
                    <tr>
                        <th>Month</th>
                        <th>2024</th>
                        <th>2025</th>
                        <th>2026</th>
                        <th>Var (25-26)</th>
                    </tr>
                </thead>
                <tbody>
        `;

        labels.forEach((month, i) => {
            const val24 = data2024[i].toFixed(1);
            const val25 = data2025[i].toFixed(1);
            const val26 = data2026[i] !== null ? data2026[i].toFixed(1) : '-';
            const diff = data2026[i] !== null ? (data2026[i] - data2025[i]).toFixed(1) : '-';
            const diffClass = diff !== '-' ? (diff > 0 ? 'text-red' : 'text-green') : '';

            tableHtml += `
                <tr>
                    <td>${month}</td>
                    <td>${val24}°</td>
                    <td>${val25}°</td>
                    <td>${val26}°</td>
                    <td class="${diffClass}">${diff > 0 ? '+' : ''}${diff}</td>
                </tr>
            `;
        });

        tableHtml += '</tbody></table>';
        tableContainer.innerHTML = tableHtml;
    }
}

// ========== Forecast Page ==========
let selectedForecastCity = null;
let selectedForecastDays = 7;

function loadForecastPage() {
    populateForecastCitySelect();
    setupForecastEventListeners();
    generateForecastCards();
    initializeForecastChart();
    generatePredictions();
}

function setupForecastEventListeners() {
    // City dropdown change event
    const citySelect = document.getElementById('forecastCitySelect');
    if (citySelect) {
        citySelect.addEventListener('change', function () {
            selectedForecastCity = this.value;
            generateForecastCards();
            initializeForecastChart();
            generatePredictions();
        });
    }

    // Range buttons click events
    const rangeButtons = document.querySelectorAll('.range-btn');
    rangeButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            // Update active state
            rangeButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Update selected days and refresh
            selectedForecastDays = parseInt(this.dataset.days);
            generateForecastCards();
            initializeForecastChart();
        });
    });
}

function populateForecastCitySelect() {
    const select = document.getElementById('forecastCitySelect');
    if (!select || !currentCityData) return;

    select.innerHTML =
        currentCityData.map((city, i) =>
            `<option value="${city.city_id}" ${i === 0 ? 'selected' : ''}>${city.city_name}</option>`
        ).join('');

    selectedForecastCity = currentCityData.length > 0 ? currentCityData[0].city_id : '';
}

function getSelectedCityData() {
    if (!currentCityData || currentCityData.length === 0) return null;
    if (selectedForecastCity) {
        const found = currentCityData.find(c => c.city_id == selectedForecastCity);
        if (found) return found;
    }
    // Default to first city (no combined averages)
    return currentCityData[0];
}

function generateForecastCards() {
    const container = document.getElementById('forecastCarousel');
    if (!container) return;

    const cityData = getSelectedCityData();
    const baseTemp = cityData ? (cityData.day_temp || cityData.temperature || 35) : 35;
    const baseNightTemp = cityData ? (cityData.night_temp || baseTemp - 5) : 28;

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();

    // Show cards based on selected range (max 7 visible, but generate based on selection)
    const cardsToShow = Math.min(selectedForecastDays, 7);

    let html = '';
    for (let i = 0; i < cardsToShow; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dayName = i === 0 ? 'Today' : days[date.getDay()];

        // Generate realistic temperature variations based on city's base temp
        const tempVariation = Math.sin(i * 0.5) * 3 + (Math.random() - 0.5) * 2;
        const dayHigh = Math.round(baseTemp + tempVariation);
        const dayLow = Math.round(baseNightTemp + tempVariation * 0.7);

        // Determine icon based on temperature
        let icon = '☀️';
        if (dayHigh >= 40) icon = '🔥';
        else if (dayHigh >= 36) icon = '☀️';
        else if (dayHigh >= 32) icon = '🌤️';
        else if (dayHigh >= 28) icon = '⛅';
        else icon = '🌥️';

        // Add rain chance for variety
        const rainChance = Math.random();
        if (rainChance > 0.85) icon = '🌧️';
        else if (rainChance > 0.75) icon = '⛈️';

        html += `
            <div class="forecast-card glass-card" data-day="${i}">
                <div class="forecast-day">${dayName}</div>
                <div class="forecast-date">${date.getDate()}/${date.getMonth() + 1}</div>
                <div class="forecast-icon">${icon}</div>
                <div class="forecast-temps">
                    <span class="forecast-temp-high">${dayHigh}°</span>
                    <span class="forecast-temp-low">${dayLow}°</span>
                </div>
                <div class="forecast-demand" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">
                    Demand: ${Math.round((dayHigh - 20) * 2.5)}%
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function initializeForecastChart() {
    const canvas = document.getElementById('forecastChart');
    if (!canvas) return;

    if (charts.forecast) charts.forecast.destroy();

    const cityData = getSelectedCityData();
    const baseTemp = cityData ? (cityData.day_temp || cityData.temperature || 35) : 35;
    const baseNightTemp = cityData ? (cityData.night_temp || baseTemp - 5) : 28;

    const labels = [];
    const dayData = [];
    const nightData = [];
    const demandData = [];
    const today = new Date();

    // Generate data based on selected forecast range
    for (let i = 0; i < selectedForecastDays; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        labels.push(`${date.getDate()}/${date.getMonth() + 1}`);

        // More realistic temperature variations
        const tempVariation = Math.sin(i * 0.3) * 3 + (Math.random() - 0.5) * 2;
        const dayTemp = Math.round(baseTemp + tempVariation);
        const nightTemp = Math.round(baseNightTemp + tempVariation * 0.7);

        dayData.push(dayTemp);
        nightData.push(nightTemp);
        demandData.push(Math.round((dayTemp - 20) * 2.5)); // Demand index based on temp
    }

    charts.forecast = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Day Temp (°C)',
                    data: dayData,
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249, 115, 22, 0.1)',
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: 'Night Temp (°C)',
                    data: nightData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: 'Demand Index (%)',
                    data: demandData,
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.4,
                    fill: false,
                    borderDash: [5, 5],
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: { position: 'top' },
                title: {
                    display: true,
                    text: cityData ? `${selectedForecastDays}-Day Forecast for ${cityData.city_name}` : `${selectedForecastDays}-Day Average Forecast`
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Demand Index (%)'
                    },
                    grid: {
                        drawOnChartArea: false
                    },
                    min: 0,
                    max: 100
                }
            }
        }
    });
}

function generatePredictions() {
    const container = document.getElementById('predictionGrid');
    if (!container) return;

    const cityData = getSelectedCityData();
    const cityName = cityData ? cityData.city_name : 'Chennai';

    // Calculate predictions based on selected city
    const avgTemp = cityData ? (cityData.day_temp || cityData.temperature || 35) : 35;

    const avgDemand = cityData ? (cityData.demand_index || 50) : 50;

    const humidity = cityData ? (cityData.humidity || 50) : 50;

    // Calculate predictions
    const peakDays = avgTemp >= 38 ? Math.round(Math.random() * 5 + 2) : Math.round(30 - avgDemand / 3);
    const estimatedSales = Math.round(avgDemand * 150);
    const heatWaveRisk = avgTemp >= 40 ? 'Very High' : avgTemp >= 38 ? 'High' : avgTemp >= 35 ? 'Moderate' : 'Low';
    const riskColor = avgTemp >= 40 ? '#ef4444' : avgTemp >= 38 ? '#f97316' : avgTemp >= 35 ? '#eab308' : '#22c55e';

    container.innerHTML = `
        <div class="prediction-card">
            <h4>📈 Peak Season ETA</h4>
            <p>Based on ${cityName} temperature trends</p>
            <div class="prediction-value">${peakDays} days</div>
            <small style="color: var(--text-muted)">Forecasted peak demand period</small>
        </div>
        <div class="prediction-card">
            <h4>💹 Demand Forecast</h4>
            <p>Expected demand index (${selectedForecastDays} days)</p>
            <div class="prediction-value">${Math.round(avgDemand * (1 + 0.05 * Math.sin(Date.now())))}/100</div>
            <div style="margin-top: 0.5rem;">
                <div style="background: var(--bg-tertiary); height: 8px; border-radius: 4px; overflow: hidden;">
                    <div style="background: var(--accent-gradient); height: 100%; width: ${avgDemand}%; transition: width 0.5s;"></div>
                </div>
            </div>
        </div>
        <div class="prediction-card">
            <h4>🎯 Sales Potential</h4>
            <p>Estimated unit potential (${selectedForecastDays} days)</p>
            <div class="prediction-value">${estimatedSales}+</div>
            <small style="color: var(--text-muted)">Based on demand × market factor</small>
        </div>
        <div class="prediction-card">
            <h4>🌡️ Heat Wave Risk</h4>
            <p>Risk assessment for ${cityName}</p>
            <div class="prediction-value" style="color: ${riskColor}">${heatWaveRisk}</div>
            <small style="color: var(--text-muted)">Avg Temp: ${Math.round(avgTemp)}°C | Humidity: ${Math.round(humidity)}%</small>
        </div>
        <div class="prediction-card">
            <h4>⚡ Power Demand</h4>
            <p>Expected load increase</p>
            <div class="prediction-value">+${Math.round((avgTemp - 25) * 3)}%</div>
            <small style="color: var(--text-muted)">Compared to baseline</small>
        </div>
        <div class="prediction-card">
            <h4>🏷️ Price Recommendation</h4>
            <p>Optimal pricing strategy</p>
            <div class="prediction-value">${avgDemand >= 70 ? 'Premium' : avgDemand >= 50 ? 'Standard' : 'Competitive'}</div>
            <small style="color: var(--text-muted)">Based on demand elasticity</small>
        </div>
    `;
}

// ========== Cities Detail Page ==========
function loadCitiesDetailPage() {
    const container = document.getElementById('citiesDetailGrid');
    if (!container || !currentCityData) return;

    container.innerHTML = currentCityData.map(city => `
        <div class="city-detail-card glass-card">
            <div class="city-detail-header">
                <div>
                    <div class="city-detail-name">${city.city_name}</div>
                    <div class="city-detail-state">${city.state || ''}</div>
                </div>
                <div class="city-detail-temp">
                    <div class="city-detail-temp-value">${city.day_temp || city.temperature}°C</div>
                    <div class="city-detail-temp-label">Current Temp</div>
                </div>
            </div>
            <div class="city-detail-body">
                <div class="city-detail-stat">
                    <i class="fas fa-sun"></i>
                    <div class="city-detail-stat-value">${city.day_temp || city.temperature}°C</div>
                    <div class="city-detail-stat-label">Day Temp</div>
                </div>
                <div class="city-detail-stat">
                    <i class="fas fa-moon"></i>
                    <div class="city-detail-stat-value">${city.night_temp || city.temperature - 5}°C</div>
                    <div class="city-detail-stat-label">Night Temp</div>
                </div>
                <div class="city-detail-stat">
                    <i class="fas fa-tint"></i>
                    <div class="city-detail-stat-value">${city.humidity || '--'}%</div>
                    <div class="city-detail-stat-label">Humidity</div>
                </div>
                <div class="city-detail-stat">
                    <i class="fas fa-wind"></i>
                    <div class="city-detail-stat-value">${city.wind_speed || '--'}</div>
                    <div class="city-detail-stat-label">Wind Speed</div>
                </div>
                <div class="city-detail-stat">
                    <i class="fas fa-chart-line"></i>
                    <div class="city-detail-stat-value">${city.demand_index || '--'}</div>
                    <div class="city-detail-stat-label">Demand Index</div>
                </div>
                <div class="city-detail-stat">
                    <i class="fas fa-snowflake"></i>
                    <div class="city-detail-stat-value">${city.ac_hours || '--'}h</div>
                    <div class="city-detail-stat-label">AC Hours</div>
                </div>
            </div>
        </div>
    `).join('');
}

// ========== Alerts Page ==========
function loadAlertsPage() {
    updateAlertCounts();
    generateAlertTimeline();
}

function updateAlertCounts() {
    // Map alert_engine levels to dashboard categories
    const critical = currentAlerts.filter(a => a.alert_level === 'red' || a.alert_level === 'kerala_special' || a.alert_level === 'critical').length;
    const high = currentAlerts.filter(a => a.alert_level === 'orange' || a.alert_level === 'high').length;
    const medium = currentAlerts.filter(a => a.alert_level === 'yellow' || a.alert_level === 'medium' || a.alert_level === 'low').length;
    const low = currentAlerts.filter(a => a.alert_level === 'green' || a.alert_level === 'blue' || a.alert_level === 'normal').length;

    const critEl = document.getElementById('criticalCount');
    const highEl = document.getElementById('highCount');
    const medEl = document.getElementById('mediumCount');
    const lowEl = document.getElementById('lowCount');
    if (critEl) critEl.textContent = critical;
    if (highEl) highEl.textContent = high;
    if (medEl) medEl.textContent = medium;
    if (lowEl) lowEl.textContent = low || Math.max(0, currentCityData.length - critical - high - medium);
}

function generateAlertTimeline() {
    const container = document.getElementById('alertTimeline');
    if (!container) return;

    if (currentAlerts.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No alerts to display</p>';
        return;
    }

    container.innerHTML = currentAlerts.map(alert => `
        <div class="timeline-item">
            <div class="timeline-indicator ${alert.alert_level || 'medium'}"></div>
            <div class="timeline-content">
                <div class="timeline-header">
                    <span class="timeline-city">${alert.city}</span>
                    <span class="timeline-time">Just now</span>
                </div>
                <div class="timeline-message">
                    ${alert.trigger_type || 'Temperature'} alert: ${alert.night_temp || alert.temperature}°C
                    ${alert.recommendation ? ` - ${alert.recommendation.action}` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// ========== City Modal ==========
function showCityModal(city) {
    const modal = document.getElementById('cityModal');
    const modalName = document.getElementById('modalCityName');
    const modalBody = document.getElementById('modalBody');

    if (!modal || !city) return;

    modalName.textContent = city.city_name;
    modalBody.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem;">
            <div style="padding: 1.5rem; background: var(--bg-primary); border-radius: var(--border-radius-sm);">
                <h4 style="margin-bottom: 1rem; color: var(--text-secondary);">Temperature</h4>
                <div style="display: flex; gap: 1rem;">
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 2rem; font-weight: 700; color: #f97316;">${city.day_temp || city.temperature}°C</div>
                        <div style="color: var(--text-muted); font-size: 0.8rem;">Day</div>
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 2rem; font-weight: 700; color: #3b82f6;">${city.night_temp || city.temperature - 5}°C</div>
                        <div style="color: var(--text-muted); font-size: 0.8rem;">Night ⭐</div>
                    </div>
                </div>
            </div>
            
            <div style="padding: 1.5rem; background: var(--bg-primary); border-radius: var(--border-radius-sm);">
                <h4 style="margin-bottom: 1rem; color: var(--text-secondary);">Conditions</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div><span style="color: var(--text-muted);">Humidity:</span> <strong>${city.humidity || '--'}%</strong></div>
                    <div><span style="color: var(--text-muted);">Wind:</span> <strong>${city.wind_speed || '--'} km/h</strong></div>
                    <div><span style="color: var(--text-muted);">Feels Like:</span> <strong>${city.feels_like || city.temperature}°C</strong></div>
                    <div><span style="color: var(--text-muted);">State:</span> <strong>${city.state || '--'}</strong></div>
                </div>
            </div>
            
            <div style="grid-column: span 2; padding: 1.5rem; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.05) 100%); border-radius: var(--border-radius-sm); border-left: 4px solid var(--accent-primary);">
                <h4 style="margin-bottom: 1rem; color: var(--accent-primary);">Demand Analysis</h4>
                <div style="display: flex; gap: 2rem; align-items: center;">
                    <div style="text-align: center;">
                        <div style="font-size: 3rem; font-weight: 700; color: var(--accent-primary);">${city.demand_index || '--'}</div>
                        <div style="color: var(--text-muted);">Demand Index</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 3rem; font-weight: 700; color: #a855f7;">${city.ac_hours || '--'}h</div>
                        <div style="color: var(--text-muted);">Est. AC Hours</div>
                    </div>
                    <div style="flex: 1;">
                        <div style="height: 12px; background: var(--bg-primary); border-radius: 6px; overflow: hidden;">
                            <div style="height: 100%; width: ${city.demand_index || 50}%; background: linear-gradient(90deg, #22c55e 0%, #eab308 50%, #ef4444 100%);"></div>
                        </div>
                        <div style="text-align: right; font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">${city.demand_index || 50}/100</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    modal.classList.add('active');
}

// ========== Utilities ==========
let trendEventListenersSet = false;

function populateCitySelects(citiesData) {
    const trendCity = document.getElementById('trendCity');
    if (trendCity) {
        trendCity.innerHTML =
            citiesData.map((c, i) => `<option value="${c.city_id}" ${i === 0 ? 'selected' : ''}>${c.city_name}</option>`).join('');

        // Add event listener only once
        if (!trendEventListenersSet) {
            trendCity.addEventListener('change', () => updateTemperatureTrends());
        }
    }

    const trendPeriod = document.getElementById('trendPeriod');
    if (trendPeriod && !trendEventListenersSet) {
        // Add event listener only once
        trendPeriod.addEventListener('change', () => updateTemperatureTrends());
    }

    trendEventListenersSet = true;
}

async function updateTemperatureTrends() {
    const citySelect = document.getElementById('trendCity');
    const periodSelect = document.getElementById('trendPeriod');
    const tempCanvas = document.getElementById('temperatureChart');

    if (!tempCanvas || !citySelect || !periodSelect) return;

    const selectedCity = citySelect.value;
    const days = parseInt(periodSelect.value);

    try {
        // Generate date labels
        const dateLabels = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            dateLabels.push(date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }));
        }

        const cityColors = [
            { border: 'rgb(239, 68, 68)', bg: 'rgba(239, 68, 68, 0.1)' },
            { border: 'rgb(249, 115, 22)', bg: 'rgba(249, 115, 22, 0.1)' },
            { border: 'rgb(234, 179, 8)', bg: 'rgba(234, 179, 8, 0.1)' },
            { border: 'rgb(34, 197, 94)', bg: 'rgba(34, 197, 94, 0.1)' },
            { border: 'rgb(59, 130, 246)', bg: 'rgba(59, 130, 246, 0.1)' },
            { border: 'rgb(168, 85, 247)', bg: 'rgba(168, 85, 247, 0.1)' }
        ];

        let datasets = [];

        if (selectedCity === 'all') {
            // Show all cities
            currentCityData.forEach((city, index) => {
                const baseTemp = city.day_temp || city.temperature;
                const color = cityColors[index % cityColors.length];

                const tempData = [];
                for (let i = days - 1; i >= 0; i--) {
                    const variation = (Math.sin(i * 0.5) * 2) + (Math.random() * 1.5 - 0.75);
                    tempData.push(Math.round((baseTemp + variation) * 10) / 10);
                }

                datasets.push({
                    label: city.city_name,
                    data: tempData,
                    borderColor: color.border,
                    backgroundColor: color.bg,
                    tension: 0.4,
                    fill: false,
                    pointRadius: 3,
                    pointHoverRadius: 5
                });
            });
        } else {
            // Show single city with Day and Night temperatures
            const cityData = currentCityData.find(c => c.city_id === selectedCity);
            if (cityData) {
                const baseDay = cityData.day_temp || cityData.temperature;
                const baseNight = cityData.night_temp || cityData.temperature - 5;

                const dayTempData = [];
                const nightTempData = [];

                for (let i = days - 1; i >= 0; i--) {
                    const dayVariation = (Math.sin(i * 0.6) * 2) + (Math.random() * 1.5 - 0.75);
                    const nightVariation = (Math.sin(i * 0.6) * 1.5) + (Math.random() * 1 - 0.5);
                    dayTempData.push(Math.round((baseDay + dayVariation) * 10) / 10);
                    nightTempData.push(Math.round((baseNight + nightVariation) * 10) / 10);
                }

                datasets = [
                    {
                        label: `${cityData.city_name} - Day Temp`,
                        data: dayTempData,
                        borderColor: 'rgb(249, 115, 22)',
                        backgroundColor: 'rgba(249, 115, 22, 0.2)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: `${cityData.city_name} - Night Temp`,
                        data: nightTempData,
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }
                ];
            }
        }

        // Update chart
        if (charts.temperature && datasets.length > 0) {
            charts.temperature.data.labels = dateLabels;
            charts.temperature.data.datasets = datasets;
            charts.temperature.update('active');
        }
    } catch (error) {
        console.error('Error updating temperature trends:', error);
    }
}

function startClock() {
    function updateClock() {
        const now = new Date();
        const timeEl = document.getElementById('currentTime');
        if (timeEl) {
            timeEl.textContent = now.toLocaleString('en-IN', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }
    updateClock();
    setInterval(updateClock, 1000);
}

function updateLastUpdate() {
    const el = document.getElementById('lastUpdate');
    if (el) {
        el.textContent = new Date().toLocaleTimeString('en-IN');
    }
}

// ========== Theme ==========
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const btn = document.getElementById('themeToggle');
    const isDark = document.body.classList.contains('dark-mode');

    if (btn) {
        btn.innerHTML = isDark
            ? '<i class="fas fa-sun"></i><span>Light Mode</span>'
            : '<i class="fas fa-moon"></i><span>Dark Mode</span>';
    }

    // Re-render charts for theme
    if (currentCityData.length > 0) {
        initializeDashboardCharts(currentCityData);
    }
}

// ========== Search ==========
function handleSearch(e) {
    const query = (e.target.value || '').toLowerCase().trim();
    const dropdown = document.getElementById('searchResultsDropdown');
    if (!dropdown) return;

    if (!query || query.length < 1) {
        dropdown.classList.remove('active');
        dropdown.innerHTML = '';
        return;
    }

    const results = [];
    const metricKeywords = {
        'temperature': { icon: 'fa-thermometer-half', label: 'Temperature' },
        'temp': { icon: 'fa-thermometer-half', label: 'Temperature' },
        'day temp': { icon: 'fa-sun', label: 'Day Temperature' },
        'night temp': { icon: 'fa-moon', label: 'Night Temperature' },
        'humidity': { icon: 'fa-tint', label: 'Humidity' },
        'wind': { icon: 'fa-wind', label: 'Wind Speed' },
        'wind speed': { icon: 'fa-wind', label: 'Wind Speed' },
        'demand': { icon: 'fa-chart-line', label: 'Demand Index' },
        'demand index': { icon: 'fa-chart-line', label: 'Demand Index' },
        'ac hours': { icon: 'fa-snowflake', label: 'AC Hours' },
        'ac': { icon: 'fa-snowflake', label: 'AC Hours' },
        'cooling': { icon: 'fa-snowflake', label: 'AC Hours' }
    };

    // Search cities
    if (currentCityData && currentCityData.length > 0) {
        currentCityData.forEach(city => {
            const name = (city.city_name || '').toLowerCase();
            const state = (city.state || '').toLowerCase();
            if (name.includes(query) || state.includes(query)) {
                results.push({
                    type: 'city',
                    icon: 'fa-city',
                    title: city.city_name,
                    subtitle: `${city.day_temp || city.temperature}°C Day · ${city.night_temp || '--'}°C Night · ${city.humidity || '--'}% Humidity`,
                    data: city
                });
            }
        });
    }

    // Search metrics — match when query is a prefix of the keyword or label
    Object.keys(metricKeywords).forEach(key => {
        const metric = metricKeywords[key];
        const labelLower = metric.label.toLowerCase();
        if (key.startsWith(query) || labelLower.startsWith(query) || labelLower.includes(query)) {
            // Avoid duplicate metric results
            if (!results.find(r => r.type === 'metric' && r.title === metric.label)) {
                let metricSummary = '';
                if (currentCityData && currentCityData.length > 0) {
                    const metricExtractor = getMetricExtractor(metric.label);
                    const vals = currentCityData.map(c => metricExtractor(c)).filter(v => v !== null && v !== undefined && !isNaN(v));
                    if (vals.length) {
                        const unit = getMetricUnit(metric.label);
                        metricSummary = `Range: ${Math.min(...vals)}${unit} – ${Math.max(...vals)}${unit} across ${vals.length} cities`;
                    }
                }
                results.push({
                    type: 'metric',
                    icon: metric.icon,
                    title: metric.label,
                    subtitle: metricSummary || 'View across all cities',
                    metricLabel: metric.label
                });
            }
        }
    });

    // Also search city+metric combos (e.g., "Chennai humidity")
    if (currentCityData && currentCityData.length > 0 && query.includes(' ')) {
        const queryParts = query.split(/\s+/);
        currentCityData.forEach(city => {
            const name = (city.city_name || '').toLowerCase();
            // Check if any part of the query matches a city name
            const cityMatch = queryParts.some(p => name.includes(p));
            if (!cityMatch) return;

            Object.keys(metricKeywords).forEach(key => {
                const metric = metricKeywords[key];
                const labelLower = metric.label.toLowerCase();
                // Check if any part of the query matches a metric
                const metricMatch = queryParts.some(p => key.startsWith(p) || labelLower.startsWith(p));
                if (!metricMatch) return;
                if (results.find(r => r.type === 'city-metric' && r.title === city.city_name + ' – ' + metric.label)) return;

                const extractor = getMetricExtractor(metric.label);
                const val = extractor(city);
                const unit = getMetricUnit(metric.label);

                results.push({
                    type: 'city-metric',
                    icon: metric.icon,
                    title: city.city_name + ' – ' + metric.label,
                    subtitle: val !== null && val !== undefined ? val + unit : '--',
                    data: city
                });
            });
        });
    }

    // Render dropdown
    if (results.length === 0) {
        dropdown.innerHTML = `<div class="search-no-results"><i class="fas fa-search"></i> No results for "${e.target.value}"</div>`;
    } else {
        dropdown.innerHTML = results.slice(0, 8).map((r, i) => `
            <div class="search-result-item" data-index="${i}" data-type="${r.type}">
                <div class="search-result-icon"><i class="fas ${r.icon}"></i></div>
                <div class="search-result-text">
                    <div class="search-result-title">${r.title}</div>
                    <div class="search-result-subtitle">${r.subtitle}</div>
                </div>
                <div class="search-result-badge">${r.type === 'city' ? 'City' : r.type === 'metric' ? 'Metric' : 'Detail'}</div>
            </div>
        `).join('');

        // Attach click handlers
        dropdown.querySelectorAll('.search-result-item').forEach((item, idx) => {
            item.addEventListener('click', () => {
                const result = results[idx];
                dropdown.classList.remove('active');
                document.getElementById('globalSearch').value = '';

                if (result.type === 'city' || result.type === 'city-metric') {
                    // Navigate to cities page and show modal
                    navigateToPage('dashboard');
                    // Switch to trends sub-tab where city cards are
                    const trendsTab = document.querySelector('.dashboard-tab[data-subtab="trends"]');
                    if (trendsTab) trendsTab.click();
                    // Scroll to city and highlight
                    setTimeout(() => {
                        const cards = document.querySelectorAll('.city-card');
                        cards.forEach(card => {
                            const cardName = card.querySelector('.city-name')?.textContent || '';
                            if (cardName === result.data.city_name) {
                                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                card.classList.add('search-highlight');
                                setTimeout(() => card.classList.remove('search-highlight'), 2000);
                            }
                        });
                        // Also open the city modal
                        if (result.data) showCityModal(result.data);
                    }, 300);
                } else if (result.type === 'metric') {
                    // Show metric comparison modal across all cities
                    showMetricComparison(result.metricLabel || result.title);
                }
            });
        });
    }

    dropdown.classList.add('active');
}

// ========== Metric Helpers ==========
function getMetricExtractor(label) {
    switch (label) {
        case 'Temperature':
        case 'Day Temperature': return c => c.day_temp || c.temperature || null;
        case 'Night Temperature': return c => c.night_temp || null;
        case 'Humidity': return c => c.humidity || null;
        case 'Wind Speed': return c => { const v = parseFloat(c.wind_speed); return isNaN(v) ? null : v; };
        case 'Demand Index': return c => c.demand_index || null;
        case 'AC Hours': return c => c.ac_hours || null;
        default: return () => null;
    }
}

function getMetricUnit(label) {
    switch (label) {
        case 'Temperature':
        case 'Day Temperature':
        case 'Night Temperature': return '°C';
        case 'Humidity': return '%';
        case 'Wind Speed': return ' km/h';
        case 'AC Hours': return 'h';
        default: return '';
    }
}

function showMetricComparison(metricLabel) {
    if (!currentCityData || currentCityData.length === 0) {
        showToast('No city data loaded yet', 'warning');
        return;
    }

    const extractor = getMetricExtractor(metricLabel);
    const unit = getMetricUnit(metricLabel);

    // Build sorted city list for this metric
    const cityMetrics = currentCityData
        .map(c => ({ name: c.city_name, state: c.state || '', value: extractor(c), data: c }))
        .filter(c => c.value !== null && c.value !== undefined && !isNaN(c.value))
        .sort((a, b) => b.value - a.value);

    if (cityMetrics.length === 0) {
        showToast(`No ${metricLabel} data available`, 'warning');
        return;
    }

    const maxVal = Math.max(...cityMetrics.map(c => c.value));

    // Color scheme based on metric type
    const colors = {
        'Temperature': ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'],
        'Day Temperature': ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'],
        'Night Temperature': ['#7c3aed', '#6366f1', '#3b82f6', '#06b6d4', '#14b8a6'],
        'Humidity': ['#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7'],
        'Wind Speed': ['#10b981', '#22c55e', '#84cc16', '#eab308', '#f97316'],
        'Demand Index': ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'],
        'AC Hours': ['#f97316', '#eab308', '#84cc16', '#22c55e', '#06b6d4']
    };
    const palette = colors[metricLabel] || ['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe'];

    const modal = document.getElementById('cityModal');
    const modalName = document.getElementById('modalCityName');
    const modalBody = document.getElementById('modalBody');
    if (!modal) return;

    modalName.textContent = `${metricLabel} – All Cities`;
    modalBody.innerHTML = `
        <div class="metric-comparison">
            <div class="metric-summary-bar">
                <div class="metric-summary-item">
                    <span class="metric-summary-label">Highest</span>
                    <span class="metric-summary-value" style="color:${palette[0]}">${cityMetrics[0].name}: ${cityMetrics[0].value}${unit}</span>
                </div>
                <div class="metric-summary-item">
                    <span class="metric-summary-label">Lowest</span>
                    <span class="metric-summary-value" style="color:${palette[palette.length - 1]}">${cityMetrics[cityMetrics.length - 1].name}: ${cityMetrics[cityMetrics.length - 1].value}${unit}</span>
                </div>
                <div class="metric-summary-item">
                    <span class="metric-summary-label">Avg</span>
                    <span class="metric-summary-value">${(cityMetrics.reduce((s, c) => s + c.value, 0) / cityMetrics.length).toFixed(1)}${unit}</span>
                </div>
            </div>
            <div class="metric-ranking-list">
                ${cityMetrics.map((c, i) => {
        const pct = maxVal > 0 ? (c.value / maxVal * 100) : 0;
        const barColor = palette[Math.min(Math.floor(i / Math.max(1, cityMetrics.length / palette.length)), palette.length - 1)];
        return `
                    <div class="metric-rank-row" onclick='showCityModal(${JSON.stringify(c.data).replace(/'/g, "&#39;")})'>
                        <div class="metric-rank-pos">#${i + 1}</div>
                        <div class="metric-rank-info">
                            <div class="metric-rank-name">${c.name}</div>
                            <div class="metric-rank-state">${c.state}</div>
                        </div>
                        <div class="metric-rank-bar-wrap">
                            <div class="metric-rank-bar" style="width:${pct}%;background:${barColor}"></div>
                        </div>
                        <div class="metric-rank-value" style="color:${barColor}">${c.value}${unit}</div>
                    </div>`;
    }).join('')}
            </div>
        </div>
    `;

    modal.classList.add('active');
}

// ========== Loading & Toast ==========
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('active');
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.transition = 'opacity 0.4s ease';
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.classList.remove('active');
            overlay.style.opacity = '';
            overlay.style.transition = '';
        }, 400);
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ========== Excel Upload ==========
function setupExcelUpload() {
    const uploadBtn = document.getElementById('uploadExcelBtn');
    const fileInput = document.getElementById('excelFileInput');

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) await uploadExcelFile(file);
        });
    }
}

async function uploadExcelFile(file) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
        showToast('Please select a valid Excel file', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        showLoading();
        const response = await fetch('/api/import/excel', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (result.status === 'success') {
            showToast('Excel file uploaded successfully!', 'success');
            await loadDashboardData();
        } else {
            showToast(result.message || 'Upload failed', 'error');
        }
    } catch (error) {
        showToast('Error uploading file', 'error');
    } finally {
        hideLoading();
    }
}

// ========== Export ==========
function setupExportButtons() {
    document.getElementById('exportExcelBtn')?.addEventListener('click', exportExcel);
    document.getElementById('exportPDFBtn')?.addEventListener('click', exportPDF);
    document.getElementById('exportDashboardPDF')?.addEventListener('click', exportPDF);
    document.getElementById('exportDataExcel')?.addEventListener('click', exportExcel);
    document.getElementById('exportAlertReport')?.addEventListener('click', exportAlertReport);
    document.getElementById('exportForecastReport')?.addEventListener('click', exportForecastReport);
}

async function exportAlertReport() {
    try {
        showLoading();
        const response = await fetch('/api/export/alert-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();

        if (result.status === 'success') {
            window.location.href = `/api/download/${result.filename}`;
            showToast(`Alert report exported (${result.alerts_count} alerts)`, 'success');
        } else {
            showToast(result.message || 'Export failed', 'error');
        }
    } catch (error) {
        showToast('Error exporting alert report', 'error');
    } finally {
        hideLoading();
    }
}

async function exportForecastReport() {
    try {
        showLoading();
        const response = await fetch('/api/export/forecast-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();

        if (result.status === 'success') {
            window.location.href = `/api/download/${result.filename}`;
            showToast(`Forecast report exported (${result.cities_count} cities)`, 'success');
        } else {
            showToast(result.message || 'Export failed', 'error');
        }
    } catch (error) {
        showToast('Error exporting forecast report', 'error');
    } finally {
        hideLoading();
    }
}
async function exportExcel() {
    try {
        showLoading();
        const response = await fetch('/api/export/excel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();

        if (result.status === 'success') {
            window.location.href = `/api/download/${result.filename}`;
            showToast('Export successful!', 'success');
        } else {
            showToast(result.message || 'Export failed', 'error');
        }
    } catch (error) {
        showToast('Error exporting data', 'error');
    } finally {
        hideLoading();
    }
}

async function exportPDF() {
    try {
        if (!currentCityData || currentCityData.length === 0) {
            showToast('No data available to export', 'warning');
            return;
        }

        showLoading();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const centerX = doc.internal.pageSize.width / 2;

        // Title Page
        doc.setFillColor(240, 244, 248);
        doc.rect(0, 0, 210, 297, 'F');

        doc.setFontSize(26);
        doc.setTextColor(59, 130, 246);
        doc.text('ForecastWell Pro', centerX, 60, { align: 'center' });

        doc.setFontSize(16);
        doc.setTextColor(100, 116, 139);
        doc.text('Executive Weather Intelligence Report', centerX, 75, { align: 'center' });

        doc.setFontSize(12);
        doc.setTextColor(148, 163, 184);
        doc.text(`Generated: ${new Date().toLocaleString()}`, centerX, 90, { align: 'center' });

        // Add footer
        doc.setFontSize(10);
        doc.text('© 2026 Hansei Consultancy | Confidential', centerX, 280, { align: 'center' });

        // City Data Page
        doc.addPage();
        doc.setFontSize(18);
        doc.setTextColor(30, 41, 59);
        doc.text('City-wise Status Summary', 14, 20);

        const tableData = currentCityData.map(city => [
            city.city_name,
            `${city.day_temp || '--'}°C`,
            `${city.night_temp || '--'}°C`,
            `${city.humidity || '--'}%`,
            `${city.ac_hours || '--'}h`,
            `${city.demand_index || '--'}/100`,
            city.dsb_zone?.zone?.toUpperCase() || '--'
        ]);

        doc.autoTable({
            head: [['City', 'Day Temp', 'Night Temp', 'Humidity', 'AC Hours', 'Demand Index', 'Alert Zone']],
            body: tableData,
            startY: 30,
            headStyles: { fillColor: [59, 130, 246], textColor: 255 },
            alternateRowStyles: { fillColor: [241, 245, 249] },
            styles: { fontSize: 10, cellPadding: 4 }
        });

        // Add Fallback Warning if needed
        if (currentCityData.some(c => c.is_fallback)) {
            doc.setFontSize(10);
            doc.setTextColor(239, 68, 68);
            doc.text('⚠️ Note: Some data in this report is estimated due to API unavailability.', 14, doc.lastAutoTable.finalY + 10);
        }

        doc.save('ForecastWell_Executive_Report.pdf');
        showToast('Executive Report PDF exported!', 'success');
    } catch (error) {
        console.error(error);
        showToast('Error exporting PDF: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function exportAlertReport() {
    try {
        if (!currentAlerts || currentAlerts.length === 0) {
            showToast('No active alerts to export', 'info');
            return;
        }

        showLoading();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(22);
        doc.setTextColor(220, 38, 38);
        doc.text('Active Alerts Report', 14, 20);

        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

        const alertData = currentAlerts.map(alert => [
            alert.city,
            alert.alert_level?.toUpperCase(),
            alert.recommendation || 'Check Dashboard',
            alert.timestamp || new Date().toLocaleTimeString()
        ]);

        doc.autoTable({
            head: [['City', 'Level', 'Action Required', 'Time']],
            body: alertData,
            startY: 40,
            headStyles: { fillColor: [220, 38, 38], textColor: 255 },
            styles: { fontSize: 10, cellPadding: 3 }
        });

        doc.save('ForecastWell_Alerts_Report.pdf');
        showToast('Alerts Report exported!', 'success');
    } catch (error) {
        console.error(error);
        showToast('Error exporting Alerts Report', 'error');
    } finally {
        hideLoading();
    }
}

async function exportForecastReport() {
    try {
        showLoading();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l'); // Landscape for more columns

        doc.setFontSize(22);
        doc.setTextColor(16, 185, 129);
        doc.text('7-Day Forecast & Inventory Planning', 14, 20);

        // Fetch forecast data for all cities (simulate logic for now as we don't have full forecast data loaded in memory for all cities)
        // In a real app, we'd fetch precise forecast data here. We'll use current city high-level data as a proxy summary for now
        // or trigger a backend generation endpoint. For this fix, we'll generate a summary based on visible data.

        const forecastSummary = currentCityData.map(c => [
            c.city_name,
            c.state,
            'Next 7 Days',
            `${c.day_temp}°C (Avg)`,
            `${c.night_temp}°C (Avg)`,
            c.demand_zone,
            'See Dashboard'
        ]);

        doc.autoTable({
            head: [['City', 'Region', 'Period', 'Day High', 'Night Low', 'Demand Zone', 'Detailed Trend']],
            body: forecastSummary,
            startY: 30,
            headStyles: { fillColor: [16, 185, 129], textColor: 255 },
            styles: { fontSize: 11 }
        });

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('Note: For detailed daily breakdown, please use the main dashboard view.', 14, doc.lastAutoTable.finalY + 10);

        doc.save('ForecastWell_Forecast_Report.pdf');
        showToast('Forecast Report exported!', 'success');
    } catch (error) {
        console.error(error);
        showToast('Error exporting Forecast Report', 'error');
    } finally {
        hideLoading();
    }
}


// ========== Global Exports ==========
window.showCityModal = showCityModal;
window.refreshData = refreshData;
// ========== NEW SECTIONS: Insights, Predictions, Energy, Historical, Weekly ==========

async function loadInsights() {
    const container = document.getElementById('insightsContainer');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE}/insights`);
        const result = await response.json();

        if (result.status === 'success' && result.data.insights) {
            container.innerHTML = result.data.insights.map(insight => `
                <div class="insight-card ${insight.type}">
                    <div class="insight-header">
                        <span class="insight-icon">${insight.icon}</span>
                        <span class="insight-title">${insight.title}</span>
                    </div>
                    <p class="insight-description">${insight.description}</p>
                    <div class="insight-action">
                        <i class="fas fa-arrow-right"></i>
                        ${insight.action}
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        container.innerHTML = '<p style="color: var(--text-muted);">Unable to load insights</p>';
    }
}

async function loadDemandPredictions() {
    const container = document.getElementById('demandPredictionContainer');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE}/demand-prediction`);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            container.innerHTML = result.data.map(pred => {
                const levelClass = pred.demand_level.toLowerCase();
                const scoreColor = pred.demand_score >= 80 ? '#ef4444' :
                    pred.demand_score >= 60 ? '#f97316' :
                        pred.demand_score >= 40 ? '#eab308' : '#22c55e';
                return `
                    <div class="demand-card ${levelClass}">
                        <div class="demand-header">
                            <span class="demand-city">${pred.city}</span>
                            <span class="demand-badge ${levelClass}">${pred.demand_level}</span>
                        </div>
                        <div class="demand-score">
                            <div class="score-bar">
                                <div class="score-fill" style="width: ${pred.demand_score}%; background: ${scoreColor};"></div>
                            </div>
                            <span class="score-value" style="color: ${scoreColor};">${pred.demand_score}</span>
                        </div>
                        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                            <i class="fas fa-lightbulb" style="color: var(--color-medium);"></i>
                            ${pred.recommendation}
                        </p>
                        <div class="demand-factors">
                            <div class="factor-item">
                                <span class="factor-label">Night Temp</span>
                                <span class="factor-value">${pred.factors.night_temp_contribution.toFixed(0)}%</span>
                            </div>
                            <div class="factor-item">
                                <span class="factor-label">Day Temp</span>
                                <span class="factor-value">${pred.factors.day_temp_contribution.toFixed(0)}%</span>
                            </div>
                            <div class="factor-item">
                                <span class="factor-label">Humidity</span>
                                <span class="factor-value">${pred.factors.humidity_contribution.toFixed(0)}%</span>
                            </div>
                        </div>
                        <div class="confidence-badge">
                            <i class="fas fa-check-circle"></i>
                            Confidence: ${pred.confidence}
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        container.innerHTML = '<p style="color: var(--text-muted);">Unable to load predictions</p>';
    }
}

async function loadEnergyEstimates() {
    const container = document.getElementById('energyContainer');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE}/energy-estimates`);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            container.innerHTML = result.data.map(energy => `
                <div class="energy-card">
                    <div class="energy-header">
                        <span class="energy-city">${energy.city}</span>
                        <span class="energy-cost">${energy.estimated_monthly_cost}</span>
                    </div>
                    <div class="energy-stats">
                        <div class="energy-stat">
                            <div class="energy-stat-icon">⏱️</div>
                            <span class="energy-stat-value">${energy.total_ac_hours}h</span>
                            <span class="energy-stat-label">Daily AC</span>
                        </div>
                        <div class="energy-stat">
                            <div class="energy-stat-icon">⚡</div>
                            <span class="energy-stat-value">${energy.daily_kwh}</span>
                            <span class="energy-stat-label">kWh/Day</span>
                        </div>
                        <div class="energy-stat">
                            <div class="energy-stat-icon">📊</div>
                            <span class="energy-stat-value">${energy.monthly_kwh}</span>
                            <span class="energy-stat-label">kWh/Month</span>
                        </div>
                    </div>
                    <div class="energy-breakdown">
                        <div class="breakdown-item">
                            <div class="breakdown-icon day"><i class="fas fa-sun"></i></div>
                            <div class="breakdown-text">
                                <span class="breakdown-value">${energy.ac_hours_day}h</span>
                                Day Usage
                            </div>
                        </div>
                        <div class="breakdown-item">
                            <div class="breakdown-icon night"><i class="fas fa-moon"></i></div>
                            <div class="breakdown-text">
                                <span class="breakdown-value">${energy.ac_hours_night}h</span>
                                Night Usage
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        container.innerHTML = '<p style="color: var(--text-muted);">Unable to load energy estimates</p>';
    }
}

async function loadHistoricalComparison() {
    const container = document.getElementById('historicalContainer');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE}/comparison/historical`);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            container.innerHTML = result.data.map(comp => `
                <div class="historical-card">
                    <div class="historical-header">
                        <span class="historical-city">${comp.city}</span>
                        <span class="trend-badge ${comp.trend}">
                            <i class="fas fa-arrow-${comp.trend === 'warmer' ? 'up' : 'down'}"></i>
                            ${comp.trend}
                        </span>
                    </div>
                    <div class="historical-comparison">
                        <div class="comparison-item">
                            <span class="comparison-label">Day Temp</span>
                            <span class="comparison-current">${comp.current_day_temp}°C</span>
                            <span class="comparison-historical">vs ${comp.historical_day_avg}°C avg</span>
                            <span class="comparison-change ${comp.day_temp_change.startsWith('+') ? 'up' : 'down'}">
                                ${comp.day_temp_change}
                            </span>
                        </div>
                        <div class="comparison-item">
                            <span class="comparison-label">Night Temp</span>
                            <span class="comparison-current">${comp.current_night_temp}°C</span>
                            <span class="comparison-historical">vs ${comp.historical_night_avg}°C avg</span>
                            <span class="comparison-change ${comp.night_temp_change.startsWith('+') ? 'up' : 'down'}">
                                ${comp.night_temp_change}
                            </span>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        container.innerHTML = '<p style="color: var(--text-muted);">Unable to load historical data</p>';
    }
}

// ========== DATE COMPARISON FEATURE ==========
function initDateCompare() {
    const datePicker = document.getElementById('compareDatePicker');
    const citySelect = document.getElementById('compareCitySelect');
    const compareBtn = document.getElementById('dateCompareBtn');

    if (!datePicker || !compareBtn) {
        console.warn('Date compare elements not found, retrying in 500ms...');
        setTimeout(initDateCompare, 500);
        return;
    }

    // Set max date to today and default to today
    const today = new Date();
    const todayStr = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');
    datePicker.setAttribute('max', todayStr);
    datePicker.value = todayStr;

    // Populate city select
    if (citySelect) {
        const cities = currentCityData && currentCityData.length > 0
            ? currentCityData.map(c => ({ id: c.city_id, name: c.city_name }))
            : DEFAULT_CITIES;
        citySelect.innerHTML =
            cities.map((c, i) => `<option value="${c.id}" ${i === 0 ? 'selected' : ''}>${c.name}</option>`).join('');
    }

    // Compare button click
    compareBtn.onclick = function (e) {
        e.preventDefault();
        fetchDateComparison();
    };

    // Quick date buttons - use closest() to handle clicks on child elements
    document.querySelectorAll('.quick-date-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.preventDefault();
            const button = e.target.closest('.quick-date-btn');
            if (!button) return;

            const offset = parseInt(button.getAttribute('data-offset'));
            const d = new Date();
            d.setDate(d.getDate() - offset);
            const dateStr = d.getFullYear() + '-' +
                String(d.getMonth() + 1).padStart(2, '0') + '-' +
                String(d.getDate()).padStart(2, '0');
            datePicker.value = dateStr;

            document.querySelectorAll('.quick-date-btn').forEach(b => b.classList.remove('active'));
            button.classList.add('active');

            fetchDateComparison();
        };
    });

    console.log('Date compare initialized successfully');
}

async function fetchDateComparison() {
    const datePicker = document.getElementById('compareDatePicker');
    const citySelect = document.getElementById('compareCitySelect');
    const resultsDiv = document.getElementById('dateCompareResults');
    const compareBtn = document.getElementById('dateCompareBtn');

    if (!datePicker || !resultsDiv) return;

    const dateVal = datePicker.value;
    const cityVal = citySelect ? citySelect.value : 'all';

    if (!dateVal) {
        resultsDiv.innerHTML = '<div class="date-compare-placeholder"><i class="fas fa-exclamation-circle"></i><p>Please select a date first</p></div>';
        return;
    }

    // Show loading
    compareBtn.classList.add('loading');
    compareBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    resultsDiv.innerHTML = `
        <div class="dc-loading">
            <div class="dc-spinner"></div>
            <p>Fetching real weather data from Open-Meteo Archive...</p>
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE}/historical/date-compare?date=${dateVal}&city=${cityVal}`);
        const result = await response.json();

        if (result.status === 'success' && result.data && result.data.length > 0) {
            const targetDate = new Date(dateVal);
            const dateDisplay = targetDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });

            resultsDiv.innerHTML = result.data.map((city, idx) => {
                const yearsHtml = city.years.map((yr, yi) => {
                    const isTarget = yi === 0;
                    const dayTemp = yr.day_temp !== null ? `${yr.day_temp}°C` : 'N/A';
                    const nightTemp = yr.night_temp !== null ? `${yr.night_temp}°C` : 'N/A';
                    const humidity = yr.humidity !== null ? `${yr.humidity}%` : 'N/A';
                    const dateLabel = yr.date ? new Date(yr.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

                    return `
                        <div class="dc-year-col ${isTarget ? 'current-year' : ''}" style="animation-delay: ${yi * 0.1}s">
                            <div class="dc-year-label">
                                <h4>📅 ${yr.year}</h4>
                                <span class="dc-year-date">${dateLabel}</span>
                            </div>
                            <div class="dc-temp-row">
                                <span class="dc-temp-label"><i class="fas fa-sun" style="color:#f59e0b"></i> Day</span>
                                <span class="dc-temp-value ${yr.day_temp !== null ? 'day' : 'na'}">${dayTemp}</span>
                            </div>
                            <div class="dc-temp-row">
                                <span class="dc-temp-label"><i class="fas fa-moon" style="color:#6366f1"></i> Night</span>
                                <span class="dc-temp-value ${yr.night_temp !== null ? 'night' : 'na'}">${nightTemp}</span>
                            </div>
                            <div class="dc-temp-row">
                                <span class="dc-temp-label"><i class="fas fa-tint" style="color:#06b6d4"></i> Humidity</span>
                                <span class="dc-temp-value ${yr.humidity !== null ? 'humidity' : 'na'}">${humidity}</span>
                            </div>
                            ${yr.is_current ? '<div style="margin-top:0.5rem;font-size:0.7rem;color:var(--text-muted);text-align:center;">Live / Forecast</div>' : ''}
                        </div>
                    `;
                }).join('');

                // Verdict badge
                let verdictHtml = '';
                if (city.comparison) {
                    const c = city.comparison;
                    const trendIcon = c.trend === 'warmer' ? 'fa-temperature-high' : (c.trend === 'cooler' ? 'fa-temperature-low' : 'fa-equals');
                    const trendText = c.trend === 'warmer' ? 'Warmer than last year' : (c.trend === 'cooler' ? 'Cooler than last year' : 'Similar to last year');
                    verdictHtml = `<span class="dc-verdict ${c.trend}"><i class="fas ${trendIcon}"></i> ${trendText}</span>`;
                }

                // Diff strip
                let diffHtml = '';
                if (city.comparison) {
                    const c = city.comparison;
                    const dayClass = c.day_diff > 0 ? 'up' : (c.day_diff < 0 ? 'down' : 'neutral');
                    const nightClass = c.night_diff > 0 ? 'up' : (c.night_diff < 0 ? 'down' : 'neutral');
                    const dayIcon = c.day_diff > 0 ? 'fa-arrow-up' : (c.day_diff < 0 ? 'fa-arrow-down' : 'fa-minus');
                    const nightIcon = c.night_diff > 0 ? 'fa-arrow-up' : (c.night_diff < 0 ? 'fa-arrow-down' : 'fa-minus');
                    diffHtml = `
                        <div class="dc-diff-strip">
                            <div class="dc-diff-badge ${dayClass}">
                                <i class="fas ${dayIcon}"></i> ${c.day_label} <span class="dc-diff-label">Day vs Last Year</span>
                            </div>
                            <div class="dc-diff-badge ${nightClass}">
                                <i class="fas ${nightIcon}"></i> ${c.night_label} <span class="dc-diff-label">Night vs Last Year</span>
                            </div>
                        </div>
                    `;
                }

                return `
                    <div class="dc-city-card" style="animation-delay: ${idx * 0.15}s">
                        <div class="dc-city-header">
                            <div>
                                <span class="dc-city-name"><i class="fas fa-map-marker-alt" style="color:var(--primary)"></i> ${city.city_name}</span>
                                <span class="dc-city-state">${city.state} — ${dateDisplay}</span>
                            </div>
                            ${verdictHtml}
                        </div>
                        <div class="dc-years-grid">${yearsHtml}</div>
                        ${diffHtml}
                        <div style="margin-top:0.75rem;padding:0.5rem 0.75rem;background:rgba(99,102,241,0.04);border-radius:8px;font-size:0.7rem;color:var(--text-muted);display:flex;align-items:center;gap:0.4rem;">
                            <i class="fas fa-info-circle" style="color:var(--primary);opacity:0.5"></i>
                            Data from Open-Meteo ECMWF reanalysis (~11km grid). Values may differ ±2-3°C from actual station readings (IMD/Google).
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            resultsDiv.innerHTML = '<div class="date-compare-placeholder"><i class="fas fa-exclamation-triangle"></i><p>No data found for the selected date and city</p></div>';
        }
    } catch (error) {
        console.error('Date comparison error:', error);
        resultsDiv.innerHTML = '<div class="date-compare-placeholder"><i class="fas fa-exclamation-triangle"></i><p>Failed to fetch comparison data. Please try again.</p></div>';
    } finally {
        compareBtn.classList.remove('loading');
        compareBtn.innerHTML = '<i class="fas fa-balance-scale"></i> Compare';
    }
}

async function loadWeeklySummary() {
    const container = document.getElementById('weeklyContainer');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE}/weekly-summary`);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            container.innerHTML = result.data.map(week => {
                const outlookClass = week.demand_outlook.toLowerCase().replace(' ', '-');
                const trendIcon = week.trend === 'rising' ? 'fa-arrow-up' :
                    week.trend === 'falling' ? 'fa-arrow-down' : 'fa-minus';
                return `
                    <div class="weekly-card">
                        <div class="weekly-header">
                            <span class="weekly-city">${week.city}</span>
                            <span class="outlook-badge ${outlookClass}">${week.demand_outlook} Demand</span>
                        </div>
                        <div class="weekly-temps">
                            <div class="weekly-temp-box day">
                                <span class="weekly-temp-label">Avg Day Temp</span>
                                <span class="weekly-temp-avg">${week.avg_day_temp}°C</span>
                                <span class="weekly-temp-range">Peak: ${week.max_temp}°C</span>
                            </div>
                            <div class="weekly-temp-box night">
                                <span class="weekly-temp-label">Avg Night Temp</span>
                                <span class="weekly-temp-avg">${week.avg_night_temp}°C</span>
                                <span class="weekly-temp-range">Min: ${week.min_night_temp}°C</span>
                            </div>
                        </div>
                        <div class="weekly-trend">
                            <i class="fas ${trendIcon} trend-icon ${week.trend}"></i>
                            <span class="trend-text">${week.trend} Trend</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        container.innerHTML = '<p style="color: var(--text-muted);">Unable to load weekly summary</p>';
    }
}

// Load all new sections (in background, non-blocking)
async function loadNewSections() {
    // Load ALL sections in parallel for maximum speed
    const results = await Promise.allSettled([
        loadDemandPredictions(),
        loadEnergyEstimates(),
        loadHistoricalComparison(),
        loadWeeklySummary(),
        loadTwoYearHistoricalData(),
        generateMonthlyHeatmap(),
        loadYoYComparison()
    ]);

    // Log any failures
    results.forEach((result, i) => {
        if (result.status === 'rejected') {
            console.warn(`Section ${i} failed:`, result.reason);
        }
    });

    // Initialize date comparison (always runs)
    try { initDateCompare(); } catch (e) { console.warn('Date compare init error:', e); }
}

// ========== 2-Year Historical Data Functions ==========
let twoYearHistoricalChart = null;

function setupHistoricalEventListeners() {
    // Load Historical Data Button
    const loadBtn = document.getElementById('loadHistoricalBtn');
    if (loadBtn) {
        loadBtn.addEventListener('click', loadTwoYearHistoricalData);
    }

    // Quick Period Buttons
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            handleQuickPeriodSelect(e.target.dataset.period);
        });
    });

    // Populate historical city select
    populateHistoricalCitySelect();
}

// Default cities list (fallback when API data not loaded yet)
const DEFAULT_CITIES = [
    { id: 'chennai', name: 'Chennai' },
    { id: 'bangalore', name: 'Bangalore' },
    { id: 'hyderabad', name: 'Hyderabad' },
    { id: 'kochi', name: 'Kochi' },
    { id: 'coimbatore', name: 'Coimbatore' },
    { id: 'visakhapatnam', name: 'Visakhapatnam' },
    { id: 'madurai', name: 'Madurai' },
    { id: 'vijayawada', name: 'Vijayawada' }
];

function populateHistoricalCitySelect() {
    const select = document.getElementById('historicalCitySelect');
    if (!select) return;

    // Use currentCityData if available, otherwise use default cities
    let cities = [];
    if (currentCityData && currentCityData.length > 0) {
        cities = currentCityData.map(city => ({
            id: city.city_id,
            name: city.city_name
        }));
    } else {
        cities = DEFAULT_CITIES;
    }

    select.innerHTML =
        cities.map((city, i) =>
            `<option value="${city.id}" ${i === 0 ? 'selected' : ''}>${city.name}</option>`
        ).join('');
}

function handleQuickPeriodSelect(period) {
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');

    if (!startDateInput || !endDateInput) return;

    const today = new Date();
    let startDate = new Date('2024-01-01');
    let endDate = today;

    switch (period) {
        case 'last30':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 30);
            break;
        case 'last90':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 90);
            break;
        case 'last6m':
            startDate = new Date(today);
            startDate.setMonth(today.getMonth() - 6);
            break;
        case '2024':
            startDate = new Date('2024-01-01');
            endDate = new Date('2024-12-31');
            break;
        case '2025':
            startDate = new Date('2025-01-01');
            endDate = new Date('2025-12-31');
            break;
        case 'all':
        default:
            startDate = new Date('2024-01-01');
            endDate = today;
            break;
    }

    startDateInput.value = startDate.toISOString().split('T')[0];
    endDateInput.value = endDate.toISOString().split('T')[0];

    loadTwoYearHistoricalData();
}

async function loadTwoYearHistoricalData() {
    const startDate = document.getElementById('startDate')?.value || '2024-01-01';
    const endDate = document.getElementById('endDate')?.value || '2026-02-04';
    const city = document.getElementById('historicalCitySelect')?.value || 'all';
    const granularity = document.getElementById('granularitySelect')?.value || 'weekly';

    try {
        const response = await fetch(
            `${API_BASE}/historical/two-years?start_date=${startDate}&end_date=${endDate}&city=${city}&granularity=${granularity}`
        );
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            updateHistoricalStats(result.data, result.meta);
            renderTwoYearHistoricalChart(result.data);
            updateYearComparisonCards(result.data.yearly_stats);
        }
    } catch (error) {
        console.error('Error loading 2-year historical data:', error);
    }
}

function updateHistoricalStats(data, meta) {
    // Update stat cards
    const totalPointsEl = document.getElementById('totalDataPoints');
    if (totalPointsEl) totalPointsEl.textContent = meta.total_records || '766';

    // Calculate peak and min temperatures
    let peakTemp = 0;
    let minNightTemp = 100;

    data.timeline.forEach(entry => {
        Object.values(entry.cities).forEach(cityData => {
            if (cityData.day_temp > peakTemp) peakTemp = cityData.day_temp;
            if (cityData.night_temp < minNightTemp) minNightTemp = cityData.night_temp;
        });
    });

    const peakTempEl = document.getElementById('peakTemp2yr');
    if (peakTempEl) peakTempEl.textContent = `${peakTemp.toFixed(1)}°C`;

    const minTempEl = document.getElementById('minTemp2yr');
    if (minTempEl) minTempEl.textContent = `${minNightTemp.toFixed(1)}°C`;

    // Calculate YoY change using peak temps (per-city), not averages
    const yearlyStats = data.yearly_stats;
    if (yearlyStats && yearlyStats[2024] && yearlyStats[2025]) {
        const peak2025 = yearlyStats[2025].peak_day_temp || 0;
        const peak2024 = yearlyStats[2024].peak_day_temp || 0;
        const yoyChange = (peak2025 - peak2024).toFixed(1);
        const yoyEl = document.getElementById('yoyChange');
        if (yoyEl) yoyEl.textContent = `${yoyChange >= 0 ? '+' : ''}${yoyChange}°C`;
    }
}

function renderTwoYearHistoricalChart(data) {
    const canvas = document.getElementById('twoYearHistoricalChart');
    if (!canvas) return;

    if (twoYearHistoricalChart) {
        twoYearHistoricalChart.destroy();
    }

    const labels = data.timeline.map(entry => {
        const date = new Date(entry.date);
        return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    });

    // Per-city night temperature lines (no combined averages)
    const cityIds = data.cities ? data.cities.map(c => c.id) : Object.keys(data.timeline[0]?.cities || {});
    const cityNames = {};
    if (data.cities) {
        data.cities.forEach(c => { cityNames[c.id] = c.name; });
    }

    const cityColors = [
        '#f97316', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6',
        '#ec4899', '#14b8a6', '#f59e0b'
    ];

    const datasets = [];
    cityIds.forEach((cityId, i) => {
        const color = cityColors[i % cityColors.length];
        const nightTemps = data.timeline.map(entry => {
            return entry.cities[cityId]?.night_temp || null;
        });
        datasets.push({
            label: `${cityNames[cityId] || cityId} Night \u00b0C`,
            data: nightTemps,
            borderColor: color,
            backgroundColor: `${color}1a`,
            fill: false,
            tension: 0.4,
            pointRadius: 1,
            pointHoverRadius: 5,
            borderWidth: 2,
            yAxisID: 'y'
        });
    });

    twoYearHistoricalChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    padding: 15,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 12 },
                    callbacks: {
                        title: function (context) {
                            return `📅 ${context[0].label}`;
                        },
                        label: function (context) {
                            const value = context.parsed.y.toFixed(1);
                            if (context.dataset.label.includes('Demand')) {
                                return `${context.dataset.label}: ${value}`;
                            }
                            return `${context.dataset.label}: ${value}°C`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Time Period (Jan 2024 - Feb 2026)',
                        font: { size: 12, weight: 'bold' }
                    },
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 24,
                        font: { size: 10 }
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Night Temperature (°C)',
                        font: { size: 12 }
                    },
                    min: 15,
                    max: 40,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            }
        }
    });
}

function updateYearComparisonCards(yearlyStats) {
    if (!yearlyStats) return;

    // Update year cards with per-city hottest data (no combined averages)
    [2024, 2025, 2026].forEach(year => {
        if (!yearlyStats[year]) return;
        const ys = yearlyStats[year];

        const elDay = document.getElementById(`avg${year}Day`);
        const elNight = document.getElementById(`avg${year}Night`);
        const elDemand = document.getElementById(`avg${year}Demand`);

        if (elDay) {
            const hotCity = ys.hottest_city;
            elDay.textContent = hotCity ? `${hotCity.max_day_temp}°C` : '--';
            elDay.title = hotCity ? `Hottest: ${hotCity.name}` : '';
        }
        if (elNight) {
            const hotCity = ys.hottest_city;
            elNight.textContent = hotCity ? `${hotCity.max_night_temp}°C` : '--';
            elNight.title = hotCity ? `Hottest: ${hotCity.name}` : '';
        }
        if (elDemand) {
            const hotCity = ys.hottest_city;
            elDemand.textContent = hotCity ? Math.round(hotCity.avg_demand) : '--';
        }
    });
}

async function generateMonthlyHeatmap(cityId = 'all') {
    const container = document.getElementById('monthlyHeatmapContainer');
    if (!container) return;

    // Show loading state
    container.innerHTML = '<div class="loading-shimmer" style="height: 200px;"></div>';

    try {
        // Fetch real data from Open-Meteo API
        const apiCityId = cityId === 'all' ? 'chennai' : cityId;  // Default to Chennai for "all"
        const response = await fetch(`/api/heatmap/monthly?city=${apiCityId}`);
        const result = await response.json();

        if (result.status !== 'success') {
            throw new Error(result.message || 'Failed to fetch heatmap data');
        }

        const apiData = result.data;
        const monthlyData = {};

        // Process API data for each year
        [2024, 2025, 2026].forEach(year => {
            monthlyData[year] = apiData.years[year].map(data => ({
                month: data.month,
                temp: data.temp !== null ? Math.round(data.temp * 10) / 10 : null,
                forecast: data.is_forecast || false,
                source: data.source
            }));
        });

        // Get city name for display
        let cityName = apiData.city_name || 'Chennai';

        // Generate heatmap HTML
        let html = `
            <div class="heatmap-row">
                <div class="heatmap-header"></div>
                ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                .map(m => `<div class="heatmap-header">${m}</div>`).join('')}
            </div>
        `;

        [2024, 2025, 2026].forEach(year => {
            html += `<div class="heatmap-row">
                <div class="heatmap-year-label">${year}</div>
                ${monthlyData[year].map(data => {
                if (data.temp === null) {
                    return `<div class="heatmap-cell" style="background: #e2e8f0; color: #64748b;">
                            <span class="month-name">${data.month}</span>
                            <span class="temp-value">--</span>
                        </div>`;
                }
                const color = getHeatmapColor(data.temp);
                // Add forecast indicator with dashed border
                const forecastStyle = data.forecast ? 'border: 2px dashed rgba(255,255,255,0.5);' : '';
                const forecastLabel = data.forecast ? '<span class="forecast-badge">📊</span>' : '';
                const sourceInfo = data.source ? ` (${data.source})` : '';
                return `<div class="heatmap-cell" style="background: ${color}; ${forecastStyle}" title="${data.forecast ? 'Forecasted' : 'Actual'}${sourceInfo}">
                        ${forecastLabel}
                        <span class="month-name">${data.month}</span>
                        <span class="temp-value">${data.temp}°C</span>
                    </div>`;
            }).join('')}
            </div>`;
        });

        // Add data source indicator
        html += `
            <div class="heatmap-source-info" style="text-align: center; margin-top: 0.75rem; font-size: 0.7rem; color: var(--text-muted);">
                📡 Data source: Open-Meteo API | 📊 = Forecast
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {
        console.error('Error fetching heatmap data:', error);
        container.innerHTML = `
            <div class="error-state" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <p>⚠️ Failed to load heatmap data</p>
                <p style="font-size: 0.8rem;">${error.message}</p>
            </div>
        `;
    }
}

// Populate the heatmap city dropdown
function populateHeatmapCitySelect() {
    const select = document.getElementById('heatmapCitySelect');
    if (!select) return;

    // Use currentCityData if available, otherwise use default cities
    let cities = [];
    if (currentCityData && currentCityData.length > 0) {
        cities = currentCityData.map(city => ({
            id: city.city_id,
            name: city.city_name
        }));
    } else {
        cities = DEFAULT_CITIES;
    }

    // Preserve current selection
    const currentValue = select.value;

    select.innerHTML =
        cities.map((city, i) =>
            `<option value="${city.id}" ${city.id === currentValue ? 'selected' : (i === 0 && !currentValue ? 'selected' : '')}>${city.name}</option>`
        ).join('');
}

// Setup heatmap city select event listener (called once on init)
function setupHeatmapCitySelectListener() {
    const select = document.getElementById('heatmapCitySelect');
    if (!select) return;

    // Remove any existing listener by replacing the element
    select.addEventListener('change', function (e) {
        console.log('Heatmap city changed to:', e.target.value);
        generateMonthlyHeatmap(e.target.value);
    });
}

function getHeatmapColor(temp) {
    if (temp < 25) return '#3b82f6';
    if (temp < 30) return '#22c55e';
    if (temp < 35) return '#eab308';
    if (temp < 40) return '#f97316';
    return '#ef4444';
}

// ========== Year-over-Year Comparison Functions ==========
let yoyComparisonChart = null;
let analyticsYoyChart = null;

// Load YoY comparison data and render
async function loadYoYComparison(cityId = 'all', monthNum = 'all') {
    try {
        const params = new URLSearchParams();
        if (cityId !== 'all') params.append('city', cityId);
        if (monthNum !== 'all') params.append('month', monthNum);

        const response = await fetch(`${API_BASE}/comparison/monthly-yoy?${params}`);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            renderYoYChart(result.data, monthNum);
            renderYoYTable(result.data, monthNum);
        }
    } catch (error) {
        console.error('Error loading YoY comparison:', error);
    }
}

// Render YoY comparison chart
function renderYoYChart(data, selectedMonth) {
    const ctx = document.getElementById('yoyComparisonChart');
    if (!ctx) return;

    // Destroy existing chart
    if (yoyComparisonChart) {
        yoyComparisonChart.destroy();
    }

    const months = data.map(d => d.month.substring(0, 3));
    const data2024 = data.map(d => d.years[2024]?.avg_day_temp || null);
    const data2025 = data.map(d => d.years[2025]?.avg_day_temp || null);
    const data2026 = data.map(d => d.years[2026]?.avg_day_temp || null);

    const night2024 = data.map(d => d.years[2024]?.avg_night_temp || null);
    const night2025 = data.map(d => d.years[2025]?.avg_night_temp || null);
    const night2026 = data.map(d => d.years[2026]?.avg_night_temp || null);

    yoyComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                {
                    label: '2024 Day',
                    data: data2024,
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                    borderColor: '#3b82f6',
                    borderWidth: 1
                },
                {
                    label: '2025 Day',
                    data: data2025,
                    backgroundColor: 'rgba(34, 197, 94, 0.7)',
                    borderColor: '#22c55e',
                    borderWidth: 1
                },
                {
                    label: '2026 Day',
                    data: data2026,
                    backgroundColor: 'rgba(249, 115, 22, 0.7)',
                    borderColor: '#f97316',
                    borderWidth: 1
                },
                {
                    label: '2024 Night',
                    data: night2024,
                    type: 'line',
                    borderColor: '#3b82f6',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 3,
                    tension: 0.3
                },
                {
                    label: '2025 Night',
                    data: night2025,
                    type: 'line',
                    borderColor: '#22c55e',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 3,
                    tension: 0.3
                },
                {
                    label: '2026 Night',
                    data: night2026,
                    type: 'line',
                    borderColor: '#f97316',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 3,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function (context) {
                            return `${context.dataset.label}: ${context.raw}°C`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: 15,
                    max: 50,
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                }
            }
        }
    });
}

// Render YoY comparison table
function renderYoYTable(data, selectedMonth) {
    const container = document.getElementById('yoyTableContainer');
    if (!container) return;

    let html = `
        <table class="yoy-table">
            <thead>
                <tr>
                    <th>Month</th>
                    <th>2024 Day/Night</th>
                    <th>2025 Day/Night</th>
                    <th>2026 Day/Night</th>
                    <th>YoY Change (24→25)</th>
                    <th>YoY Change (25→26)</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach(month => {
        const y2024 = month.years[2024];
        const y2025 = month.years[2025];
        const y2026 = month.years[2026];

        const change2425 = month.yoy_2024_2025;
        const change2526 = month.yoy_2025_2026;

        // Check if this month is forecasted
        const isForecast = month.is_forecast || false;
        const forecastBadge = isForecast ? '<span class="forecast-indicator" title="Forecasted">📊</span>' : '';

        html += `
            <tr class="${isForecast ? 'forecast-row' : ''}">
                <td><strong>${month.month}</strong>${forecastBadge}</td>
                <td class="year-2024">
                    ${y2024 ? `${y2024.avg_day_temp}°C / ${y2024.avg_night_temp}°C` : '<span class="yoy-no-data">--</span>'}
                </td>
                <td class="year-2025">
                    ${y2025 ? `${y2025.avg_day_temp}°C / ${y2025.avg_night_temp}°C` : '<span class="yoy-no-data">--</span>'}
                </td>
                <td class="year-2026 ${isForecast ? 'forecast-data' : ''}">
                    ${y2026 ? `${y2026.avg_day_temp}°C / ${y2026.avg_night_temp}°C` : '<span class="yoy-no-data">--</span>'}
                </td>
                <td>
                    ${change2425 ? `
                        <span class="yoy-change ${change2425.day_temp_change > 0 ? 'positive' : change2425.day_temp_change < 0 ? 'negative' : 'neutral'}">
                            ${change2425.day_temp_change > 0 ? '+' : ''}${change2425.day_temp_change}°C
                        </span>
                    ` : '--'}
                </td>
                <td>
                    ${change2526 ? `
                        <span class="yoy-change ${change2526.day_temp_change > 0 ? 'positive' : change2526.day_temp_change < 0 ? 'negative' : 'neutral'}">
                            ${change2526.day_temp_change > 0 ? '+' : ''}${change2526.day_temp_change}°C
                        </span>
                    ` : '<span class="yoy-no-data">Future</span>'}
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';

    // Add legend for forecast data
    html += `
        <div class="forecast-legend">
            <span class="legend-item"><span class="forecast-indicator">📊</span> = Forecasted Data (+4 months from current month)</span>
        </div>
    `;

    container.innerHTML = html;
}

// Populate YoY city select dropdown
function populateYoYCitySelect() {
    const selects = [
        document.getElementById('yoyCitySelect'),
        document.getElementById('analyticsYoyCitySelect')
    ];

    selects.forEach(select => {
        if (!select) return;

        let cities = [];
        if (currentCityData && currentCityData.length > 0) {
            cities = currentCityData.map(city => ({
                id: city.city_id,
                name: city.city_name
            }));
        } else {
            cities = DEFAULT_CITIES;
        }

        const currentValue = select.value;
        select.innerHTML =
            cities.map((city, i) =>
                `<option value="${city.id}" ${city.id === currentValue ? 'selected' : (i === 0 && !currentValue ? 'selected' : '')}>${city.name}</option>`
            ).join('');
    });
}

// Setup YoY event listeners
function setupYoYEventListeners() {
    // Dashboard YoY controls
    const yoyCitySelect = document.getElementById('yoyCitySelect');
    const yoyMonthSelect = document.getElementById('yoyMonthSelect');

    if (yoyCitySelect) {
        yoyCitySelect.addEventListener('change', () => {
            loadYoYComparison(yoyCitySelect.value, yoyMonthSelect?.value || 'all');
        });
    }

    if (yoyMonthSelect) {
        yoyMonthSelect.addEventListener('change', () => {
            loadYoYComparison(yoyCitySelect?.value || 'all', yoyMonthSelect.value);
        });
    }

    // Analytics YoY controls
    const analyticsYoyCitySelect = document.getElementById('analyticsYoyCitySelect');
    const analyticsYoyMetricSelect = document.getElementById('analyticsYoyMetricSelect');

    if (analyticsYoyCitySelect) {
        analyticsYoyCitySelect.addEventListener('change', () => {
            loadAnalyticsYoYChart(analyticsYoyCitySelect.value, analyticsYoyMetricSelect?.value || 'day_temp');
        });
    }

    if (analyticsYoyMetricSelect) {
        analyticsYoyMetricSelect.addEventListener('change', () => {
            loadAnalyticsYoYChart(analyticsYoyCitySelect?.value || 'all', analyticsYoyMetricSelect.value);
        });
    }
}

// Load and render Analytics page YoY chart
async function loadAnalyticsYoYChart(cityId = 'all', metric = 'day_temp') {
    try {
        const params = new URLSearchParams();
        if (cityId !== 'all') params.append('city', cityId);

        const response = await fetch(`${API_BASE}/comparison/monthly-yoy?${params}`);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            renderAnalyticsYoYChart(result.data, metric);
        }
    } catch (error) {
        console.error('Error loading Analytics YoY chart:', error);
    }
}

// Render Analytics YoY chart with selected metric
function renderAnalyticsYoYChart(data, metric) {
    const ctx = document.getElementById('analyticsYoyChart');
    if (!ctx) return;

    if (analyticsYoyChart) {
        analyticsYoyChart.destroy();
    }

    const months = data.map(d => d.month.substring(0, 3));

    // Get data based on selected metric
    const metricMap = {
        'day_temp': { key: 'avg_day_temp', label: 'Day Temperature (°C)' },
        'night_temp': { key: 'avg_night_temp', label: 'Night Temperature (°C)' },
        'demand': { key: 'avg_demand', label: 'Demand Index' },
        'ac_hours': { key: 'avg_ac_hours', label: 'AC Hours' }
    };

    const selectedMetric = metricMap[metric] || metricMap['day_temp'];

    const data2024 = data.map(d => d.years[2024]?.[selectedMetric.key] || null);
    const data2025 = data.map(d => d.years[2025]?.[selectedMetric.key] || null);
    const data2026 = data.map(d => d.years[2026]?.[selectedMetric.key] || null);

    analyticsYoyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: '2024',
                    data: data2024,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointHoverRadius: 8
                },
                {
                    label: '2025',
                    data: data2025,
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointHoverRadius: 8
                },
                {
                    label: '2026',
                    data: data2026,
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249, 115, 22, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointHoverRadius: 8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { size: 12, weight: 'bold' }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: 12,
                    callbacks: {
                        label: function (context) {
                            const suffix = metric.includes('temp') ? '°C' : (metric === 'ac_hours' ? 'h' : '');
                            return `${context.dataset.label}: ${context.raw}${suffix}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: metric === 'demand' || metric === 'ac_hours',
                    title: {
                        display: true,
                        text: selectedMetric.label
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// Initialize historical listeners when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    // Give a slight delay to ensure all elements are loaded
    setTimeout(setupHistoricalEventListeners, 500);
    setTimeout(setupYoYEventListeners, 600);
});


// ========== INSIGHTS PAGE FUNCTIONALITY ==========

let insightsCharts = {
    marketMatrix: null,
    comparison: null
};

async function loadInsightsPage() {
    console.log('📊 Loading Insights Page...');
    showInsightsLoading();

    try {
        const response = await fetch(`${API_BASE}/insights`);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            renderInsightsPage(result.data);
            hideInsightsLoading();
            console.log('✅ Insights page loaded successfully');
        } else {
            throw new Error(result.message || 'Failed to load insights');
        }
    } catch (error) {
        console.error('❌ Error loading insights:', error);
        hideInsightsLoading();
        showToast('Failed to load insights data', 'error');
    }
}

function showInsightsLoading() {
    const containers = document.querySelectorAll('#insightsPage .recommendations-grid, #insightsPage .city-insights-grid, #insightsPage .action-checklist');
    containers.forEach(container => {
        if (container) {
            container.innerHTML = '<div class="loading-placeholder" style="text-align:center; padding:40px;"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Loading insights...</p></div>';
        }
    });
}

function hideInsightsLoading() {
    // Loading placeholders will be replaced by actual content
}

function renderInsightsPage(data) {
    // 1. Update Hero Cards
    updateInsightsHeroCards(data.hero_metrics);

    // 2. Render Recommendations
    renderRecommendations(data.recommendations);

    // 3. Render Market Matrix Chart
    renderMarketMatrixChart(data.market_matrix);

    // 4. Render Monthly Forecast Timeline
    renderForecastTimeline(data.monthly_forecast);

    // 5. Render Action Checklist
    renderActionChecklist(data.action_checklist);

    // 6. Render Comparison Chart
    renderInsightsComparisonChart(data.monthly_forecast);

    // 7. Render City Insights
    renderCityInsights(data.city_insights);
}

function updateInsightsHeroCards(metrics) {
    // Days to Peak
    const daysToPeak = document.getElementById('daysToPeakValue');
    const peakTrend = document.getElementById('peakTrendBadge');
    if (daysToPeak) daysToPeak.textContent = metrics.days_to_peak;
    if (peakTrend) {
        peakTrend.textContent = metrics.peak_trend === 'heating' ? 'Heating Fast' : 'Building Up';
        peakTrend.className = `trend-badge ${metrics.peak_trend === 'heating' ? 'up' : 'neutral'}`;
    }

    // YoY Change
    const yoyChange = document.getElementById('yoyChangeValue');
    const yoyTrend = document.getElementById('yoyTrendBadge');
    if (yoyChange) {
        const prefix = metrics.yoy_temp_change > 0 ? '+' : '';
        yoyChange.textContent = `${prefix}${metrics.yoy_temp_change}°C`;
    }
    if (yoyTrend) {
        const trendText = metrics.yoy_trend === 'up' ? 'Hotter Year' : (metrics.yoy_trend === 'down' ? 'Cooler Year' : 'Similar');
        yoyTrend.textContent = trendText;
        yoyTrend.className = `trend-badge ${metrics.yoy_trend}`;
    }

    // Demand Potential
    const demandPotential = document.getElementById('demandPotentialValue');
    const demandTrend = document.getElementById('demandTrendBadge');
    if (demandPotential) demandPotential.textContent = `${metrics.demand_potential}%`;
    if (demandTrend) {
        const level = metrics.demand_potential >= 70 ? 'High' : (metrics.demand_potential >= 50 ? 'Moderate' : 'Building');
        demandTrend.textContent = level;
        demandTrend.className = `trend-badge ${metrics.demand_potential >= 70 ? 'up' : 'neutral'}`;
    }

    // Top Market
    const topMarket = document.getElementById('topMarketValue');
    const topMarketReason = document.getElementById('topMarketReason');
    if (topMarket) topMarket.textContent = metrics.top_market;
    if (topMarketReason) topMarketReason.textContent = metrics.top_market_reason;
}

function renderRecommendations(recommendations) {
    const container = document.querySelector('#insightsPage .recommendations-grid');
    if (!container || !recommendations) return;

    const iconMap = {
        'fire': 'fa-fire',
        'chart-line': 'fa-chart-line',
        'moon': 'fa-moon',
        'map-marker-alt': 'fa-map-marker-alt',
        'warehouse': 'fa-warehouse',
        'bullhorn': 'fa-bullhorn'
    };

    container.innerHTML = recommendations.map(rec => `
        <div class="recommendation-card ${rec.priority}">
            <div class="rec-header">
                <div class="rec-icon">
                    <i class="fas ${iconMap[rec.icon] || 'fa-lightbulb'}"></i>
                </div>
                <span class="rec-priority ${rec.priority}">${rec.priority.toUpperCase()}</span>
            </div>
            <h4 class="rec-title">${rec.title}</h4>
            <p class="rec-description">${rec.description}</p>
            <div class="rec-metrics">
                ${rec.metrics.map(m => `
                    <div class="rec-metric">
                        <span class="metric-value">${m.value}</span>
                        <span class="metric-label">${m.label}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function renderMarketMatrixChart(matrixData) {
    const canvas = document.getElementById('marketMatrixChart');
    if (!canvas || !matrixData) return;

    if (insightsCharts.marketMatrix) {
        insightsCharts.marketMatrix.destroy();
    }

    const colors = [
        '#ef4444', '#f97316', '#eab308', '#22c55e',
        '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
    ];

    const datasets = matrixData.cities.map((city, idx) => ({
        label: city.city,
        data: city.demands,
        backgroundColor: colors[idx % colors.length],
        borderColor: colors[idx % colors.length],
        borderWidth: 2,
        borderRadius: 4,
        barPercentage: 0.8
    }));

    insightsCharts.marketMatrix = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: matrixData.months,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 15,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: 12,
                    callbacks: {
                        label: function (context) {
                            return `${context.dataset.label}: ${context.raw}% demand`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Demand Index (%)'
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function renderForecastTimeline(monthlyForecast) {
    const container = document.querySelector('#insightsPage .forecast-timeline');
    if (!container || !monthlyForecast) return;

    container.innerHTML = monthlyForecast.map(month => `
        <div class="timeline-month ${month.level}">
            <div class="month-header">
                <span class="month-name">${month.month}</span>
                <span class="demand-badge ${month.level}">${month.level.toUpperCase()}</span>
            </div>
            <div class="temp-display">
                <div class="temp-item">
                    <i class="fas fa-sun"></i>
                    <span>${month.avg_day}°C</span>
                </div>
                <div class="temp-item">
                    <i class="fas fa-moon"></i>
                    <span>${month.avg_night}°C</span>
                </div>
            </div>
            <div class="demand-bar-container">
                <div class="demand-bar ${month.level}" style="width: ${month.demand}%"></div>
                <span class="demand-value">${month.demand}%</span>
            </div>
        </div>
    `).join('');
}

function renderActionChecklist(actions) {
    const container = document.querySelector('#insightsPage .action-checklist');
    if (!container || !actions) return;

    const urgencyIcons = {
        'urgent': 'fa-exclamation-circle',
        'important': 'fa-flag',
        'normal': 'fa-check-circle'
    };

    container.innerHTML = actions.map((action, idx) => `
        <div class="action-item ${action.urgency}">
            <div class="action-checkbox">
                <input type="checkbox" id="action${idx}">
                <label for="action${idx}"></label>
            </div>
            <div class="action-content">
                <div class="action-header">
                    <i class="fas ${urgencyIcons[action.urgency] || 'fa-tasks'}"></i>
                    <span class="action-title">${action.title}</span>
                    <span class="action-urgency ${action.urgency}">${action.urgency}</span>
                </div>
                <p class="action-detail">${action.detail}</p>
                <span class="action-timeline"><i class="far fa-clock"></i> ${action.timeline}</span>
            </div>
        </div>
    `).join('');
}

function renderInsightsComparisonChart(monthlyForecast) {
    const canvas = document.getElementById('insightsComparisonChart');
    if (!canvas || !monthlyForecast) return;

    if (insightsCharts.comparison) {
        insightsCharts.comparison.destroy();
    }

    const labels = monthlyForecast.map(m => m.month);
    const dayTemps = monthlyForecast.map(m => m.avg_day);
    const nightTemps = monthlyForecast.map(m => m.avg_night);
    const demands = monthlyForecast.map(m => m.demand);

    insightsCharts.comparison = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Day Temp (°C)',
                    data: dayTemps,
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249, 115, 22, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Night Temp (°C)',
                    data: nightTemps,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Demand Index (%)',
                    data: demands,
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    borderWidth: 3,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: 12
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Demand Index (%)'
                    },
                    min: 0,
                    max: 100,
                    grid: {
                        drawOnChartArea: false
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function renderCityInsights(cityInsights) {
    const container = document.querySelector('#insightsPage .city-insights-grid');
    if (!container || !cityInsights) return;

    container.innerHTML = cityInsights.slice(0, 8).map(city => `
        <div class="city-insight-card ${city.priority}">
            <div class="city-insight-header">
                <h4 class="city-name">${city.city}</h4>
                <span class="priority-badge ${city.priority}">${city.badge}</span>
            </div>
            <div class="city-temps">
                <div class="temp-block">
                    <span class="temp-label">Current Day</span>
                    <span class="temp-value">${city.current_day}°C</span>
                </div>
                <div class="temp-block">
                    <span class="temp-label">Current Night</span>
                    <span class="temp-value highlight">${city.current_night}°C</span>
                </div>
                <div class="temp-block forecast">
                    <span class="temp-label">60-Day Forecast</span>
                    <span class="temp-value">${city.forecast_night}°C</span>
                </div>
            </div>
            <div class="demand-meter">
                <div class="demand-fill ${city.priority}" style="width: ${city.demand_score}%"></div>
                <span class="demand-score">${city.demand_score}%</span>
            </div>
            <p class="city-recommendation">${city.recommendation}</p>
        </div>
    `).join('');
}

// Ensure date comparison is initialized even if loadNewSections fails
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (!document.getElementById('compareDatePicker')?.value) {
            initDateCompare();
        }
    }, 3000);
});


// ═══════════════════════════════════════════════════════════════════════════
// DEMAND INTELLIGENCE PAGE (Boss's 6-Point Directive)
// ═══════════════════════════════════════════════════════════════════════════

let correlationChartInstance = null;

async function loadDemandIntelPage() {
    console.log('📊 Loading Demand Intelligence page...');
    try {
        // Load all data in parallel
        const [dsbRes, advRes, serviceRes, refreshRes] = await Promise.all([
            fetch('/api/dsb-overview').then(r => r.json()),
            fetch('/api/advanced-weather').then(r => r.json()),
            fetch('/api/service-predictions').then(r => r.json()),
            fetch('/api/refresh-status').then(r => r.json())
        ]);

        if (dsbRes.status === 'success') renderDSBOverview(dsbRes.data);
        if (advRes.status === 'success') renderAdvancedWeather(advRes.data);
        if (serviceRes.status === 'success') renderServicePredictions(serviceRes.data);
        if (refreshRes.status === 'success') renderRefreshCadence(refreshRes.data);

        // Load demand correlation for default city
        populateCorrelationCitySelect();
        loadCorrelationData('chennai');

        console.log('✅ Demand Intelligence page loaded');
    } catch (err) {
        console.error('Error loading Demand Intel page:', err);
    }
}

function renderDSBOverview(data) {
    const { zones, summary } = data;

    // Update counts
    const gc = document.getElementById('dsbGreenCount');
    const ac = document.getElementById('dsbAmberCount');
    const rc = document.getElementById('dsbRedCount');
    if (gc) gc.textContent = `${summary.green_count} cities`;
    if (ac) ac.textContent = `${summary.amber_count} cities`;
    if (rc) rc.textContent = `${summary.red_count} cities`;

    // City list
    const list = document.getElementById('dsbCityList');
    if (!list) return;

    let html = '';
    const allCities = [...(zones.red || []), ...(zones.amber || []), ...(zones.green || [])];
    allCities.forEach(city => {
        html += `
        <div class="dsb-city-row ${city.dsb.zone}">
            <span class="dsb-city-icon">${city.zone_icon}</span>
            <span class="dsb-city-name">${city.city_name}</span>
            <span class="dsb-city-zone-label">${city.demand_zone}</span>
            <span class="dsb-city-demand">${city.demand_index}%</span>
            <span class="dsb-city-badge" style="background:${city.dsb.color};color:#fff">${city.dsb.label}</span>
            <span class="dsb-city-action">${city.dsb.action}</span>
        </div>`;
    });
    list.innerHTML = html;
}

function renderAdvancedWeather(data) {
    const grid = document.getElementById('advancedWeatherGrid');
    if (!grid) return;

    const { cities, monsoon } = data;

    grid.innerHTML = cities.map(c => `
        <div class="adv-weather-card">
            <div class="adv-header">
                <span class="adv-zone-icon">${c.zone_icon}</span>
                <strong>${c.city_name}</strong>
                <span class="adv-zone-tag">${c.demand_zone}</span>
            </div>
            <div class="adv-metrics">
                <div class="adv-metric">
                    <span class="adv-label">Wet Bulb</span>
                    <span class="adv-value" style="color:${c.wet_bulb.color}">${c.wet_bulb.value !== null ? c.wet_bulb.value + '°C' : 'N/A'}</span>
                    <span class="adv-sub">${c.wet_bulb.label}</span>
                </div>
                <div class="adv-metric">
                    <span class="adv-label">Heat Wave</span>
                    <span class="adv-value ${c.heatwave.is_heatwave ? 'danger' : ''}">${c.heatwave.is_heatwave ? '⚠️ YES' : '✅ No'}</span>
                    <span class="adv-sub">${c.heatwave.consecutive_days} consecutive hot days</span>
                </div>
                <div class="adv-metric">
                    <span class="adv-label">DSB Zone</span>
                    <span class="adv-value">${c.dsb_zone.icon} ${c.dsb_zone.zone.toUpperCase()}</span>
                    <span class="adv-sub">Demand: ${c.demand_index}%</span>
                </div>
            </div>
        </div>
    `).join('');

    // Monsoon status
    const monsoonEl = document.getElementById('monsoonStatus');
    if (monsoonEl && monsoon) {
        const phase = monsoon.phase;
        let progressPct = 0;
        if (phase === 'pre_monsoon') progressPct = Math.max(5, 100 - (monsoon.days_to_onset / 180 * 100));
        else if (phase === 'active') progressPct = 50 + (monsoon.days_active / (monsoon.days_active + monsoon.days_remaining) * 50);
        else progressPct = 100;

        monsoonEl.innerHTML = `
            <div class="monsoon-card">
                <div class="monsoon-icon">${monsoon.icon}</div>
                <h3>${monsoon.label}</h3>
                <div class="monsoon-progress">
                    <div class="monsoon-bar">
                        <div class="monsoon-fill" style="width:${progressPct}%"></div>
                    </div>
                    <div class="monsoon-labels">
                        <span>Jun 1 (Onset)</span>
                        <span>Oct 15 (Withdrawal)</span>
                    </div>
                </div>
                <div class="monsoon-phases">
                    <span class="${phase === 'pre_monsoon' ? 'active-phase' : ''}">☀️ Pre-Monsoon</span>
                    <span class="${phase === 'active' ? 'active-phase' : ''}">🌧️ Active</span>
                    <span class="${phase === 'post_monsoon' ? 'active-phase' : ''}">🌤️ Post-Monsoon</span>
                </div>
            </div>
        `;
    }
}

function renderServicePredictions(predictions) {
    const grid = document.getElementById('servicePredictionsGrid');
    if (!grid) return;

    grid.innerHTML = predictions.map(pred => `
        <div class="service-pred-card">
            <div class="service-pred-header">
                <span>${pred.zone_icon}</span>
                <strong>${pred.city_name}</strong>
                <span class="service-load-badge" style="background: ${pred.overall_service_load >= 60 ? '#dc3545' : pred.overall_service_load >= 35 ? '#fd7e14' : '#28a745'}">${Math.round(pred.overall_service_load)}% load</span>
            </div>
            <div class="service-metrics">
                ${['compressor_failure', 'gas_refill', 'warranty_claims', 'installation'].map(key => {
        const item = pred[key];
        return `
                    <div class="service-metric">
                        <span class="sm-icon">${item.icon}</span>
                        <span class="sm-label">${item.label}</span>
                        <div class="sm-bar-wrap"><div class="sm-bar ${item.level.toLowerCase()}" style="width:${item.risk}%"></div></div>
                        <span class="sm-level ${item.level.toLowerCase()}">${item.level}</span>
                    </div>`;
    }).join('')}
            </div>
            <p class="service-detail">${pred.compressor_failure.detail}</p>
        </div>
    `).join('');
}

function renderRefreshCadence(data) {
    const items = [
        { el: 'cadenceWeather', d: data.weather },
        { el: 'cadenceDemand', d: data.demand },
        { el: 'cadenceAccuracy', d: data.accuracy }
    ];
    items.forEach(({ el, d }) => {
        const e = document.getElementById(el);
        if (!e) return;
        const val = e.querySelector('.cadence-value');
        if (val) {
            if (d.validated_accuracy) {
                val.textContent = `${d.cadence} (${d.validated_accuracy})`;
            } else {
                val.textContent = d.cadence;
            }
        }
    });
}

/* Alerts & Checklist UI */
// currentAlerts already declared at top of file

async function loadAlerts() {
    try {
        const res = await fetch('/api/alerts');
        const json = await res.json();
        if (json.status !== 'success') return;
        currentAlerts = json.data.alerts || [];
        const count = currentAlerts.length;
        const badge = document.getElementById('alertsCount');
        if (badge) badge.textContent = count;
    } catch (err) {
        console.error('Error loading alerts:', err);
    }
}

function renderAlertsModal(alerts) {
    const container = document.getElementById('alertsList');
    if (!container) return;
    if (!alerts || alerts.length === 0) {
        container.innerHTML = '<p>No active alerts</p>';
        showModal('alertsModal');
        return;
    }

    const html = alerts.map(a => {
        const zone = a.dsb_zone || {};
        const rec = a.recommendation || {};
        const steps = (rec.steps || []).slice(0, 3).map(s => '<div>• ' + s + '</div>').join('');
        return `
        <div class="alert-row" data-id="${a.id || ''}">
            <label style="display:flex; align-items:center; gap:10px; width:100%">
                <input type="checkbox" class="alert-checkbox" value="${a.id || ''}" />
                <div style="flex:1">
                    <div style="font-weight:700">${a.city || '--'} — ${zone.label || a.alert_level || '--'} — ${a.demand_index || '--'}%</div>
                    <div style="font-size:0.85rem; color:var(--text-muted)">${rec.action || 'No action'} — ${rec.priority || ''}</div>
                    <div style="margin-top:6px; font-size:0.85rem">${steps}</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    <button class="btn btn-sm" onclick="generateChecklist('${a.city_id || ''}')">Checklist</button>
                    <button class="btn btn-sm" onclick="ackSingleAlert('${a.id || ''}')">Acknowledge</button>
                </div>
            </label>
        </div>`;
    }).join('');

    container.innerHTML = html;
    showModal('alertsModal');
}

async function acknowledgeSelectedAlerts() {
    try {
        const checked = Array.from(document.querySelectorAll('.alert-checkbox:checked')).map(i => i.value);
        if (!checked.length) return alert('Select at least one alert to acknowledge');
        const res = await fetch('/api/alerts/ack', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: checked })
        });
        const json = await res.json();
        if (json.status === 'success') {
            // refresh
            await loadAlerts();
            renderAlertsModal(currentAlerts);
            const badge = document.getElementById('alertsCount');
            if (badge) badge.textContent = currentAlerts.length;
        }
    } catch (err) {
        console.error('Error acknowledging alerts', err);
    }
}

async function ackSingleAlert(id) {
    try {
        const res = await fetch('/api/alerts/ack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id] }) });
        const json = await res.json();
        if (json.status === 'success') {
            await loadAlerts();
            renderAlertsModal(currentAlerts);
            const badge = document.getElementById('alertsCount');
            if (badge) badge.textContent = currentAlerts.length;
        }
    } catch (err) { console.error(err); }
}

async function generateChecklist(cityId) {
    try {
        const res = await fetch(`/api/generate-checklist?city=${cityId}`);
        const json = await res.json();
        if (json.status !== 'success') return alert('Failed to generate checklist');
        const checklist = json.data.checklist;
        renderChecklistModal(checklist);
    } catch (err) {
        console.error('Error generating checklist', err);
    }
}

function renderChecklistModal(checklist) {
    const body = document.getElementById('checklistBody');
    if (!body) return;
    let html = `<h4>${checklist.city} — ${checklist.action} (${checklist.priority})</h4>`;
    html += `<div style="margin:8px 0; font-weight:700">Demand Index: ${checklist.demand_index}%</div>`;
    html += checklist.steps.map(s => `<div style="margin:6px 0">• ${s}</div>`).join('');
    html += `<div style="margin-top:12px"><button class="btn btn-primary" onclick="ackSingleAlert('${checklist.city_id}_now')">Acknowledge Alert</button></div>`;
    body.innerHTML = html;
    showModal('checklistModal');
}

/* Modal helpers — support both .hidden and .active modal systems */
function showModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('hidden');
    m.classList.add('active');
    m.style.display = 'flex';
}
function hideModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add('hidden');
    m.classList.remove('active');
    m.style.display = '';
}

// Wire alert button events
const alertsBtn = document.getElementById('alertsButton');
if (alertsBtn) {
    alertsBtn.addEventListener('click', async () => {
        await loadAlerts();
        renderAlertsModal(currentAlerts);
    });
}

const ackBtn = document.getElementById('ackAlertsBtn');
if (ackBtn) {
    ackBtn.addEventListener('click', acknowledgeSelectedAlerts);
}

// Modal close buttons (support both .hidden and .active modal systems)
document.addEventListener('click', (e) => {
    if (e.target.matches('.modal-close') || (e.target.matches('[data-modal]') && e.target.dataset.modal)) {
        const id = e.target.dataset.modal || e.target.closest('.modal')?.id;
        if (id) hideModal(id);
    }
    // Also handle clicking on the .btn with data-modal
    const btn = e.target.closest('[data-modal]');
    if (btn && btn.dataset.modal) {
        hideModal(btn.dataset.modal);
    }
});

// Ensure alerts load when page opens
loadAlerts();

function populateCorrelationCitySelect() {
    const select = document.getElementById('correlationCitySelect');
    if (!select) return;
    const cities = [
        { id: 'chennai', name: 'Chennai' },
        { id: 'bangalore', name: 'Bangalore' },
        { id: 'hyderabad', name: 'Hyderabad' },
        { id: 'kochi', name: 'Kochi' },
        { id: 'coimbatore', name: 'Coimbatore' },
        { id: 'visakhapatnam', name: 'Visakhapatnam' }
    ];
    select.innerHTML = cities.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    select.addEventListener('change', () => loadCorrelationData(select.value));
}

async function loadCorrelationData(cityId) {
    try {
        const res = await fetch(`/api/demand-correlation?city=${cityId}&days=60`);
        const json = await res.json();
        if (json.status !== 'success') return;

        const { correlation } = json.data;

        // Update metrics
        const scoreEl = document.getElementById('corrScore');
        const insightEl = document.getElementById('corrInsight');
        if (scoreEl) scoreEl.textContent = correlation.correlation_label;
        if (insightEl) insightEl.textContent = correlation.insight;

        // Render chart
        renderCorrelationChart(correlation.chart_data);
    } catch (err) {
        console.error('Error loading correlation data:', err);
    }
}

function renderCorrelationChart(chartData) {
    const ctx = document.getElementById('correlationChart');
    if (!ctx) return;

    if (correlationChartInstance) {
        correlationChartInstance.destroy();
    }

    const labels = chartData.map(d => d.date);
    correlationChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Demand Index',
                    data: chartData.map(d => d.demand_index),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    borderWidth: 2,
                    yAxisID: 'y'
                },
                {
                    label: 'Sales Index',
                    data: chartData.map(d => d.sales_index),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16,185,129,0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    borderWidth: 2,
                    yAxisID: 'y'
                },
                {
                    label: 'Night Temp (°C)',
                    data: chartData.map(d => d.night_temp),
                    borderColor: '#f59e0b',
                    borderDash: [4, 4],
                    tension: 0.4,
                    pointRadius: 0,
                    borderWidth: 1.5,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, padding: 15 } },
                datalabels: { display: false }
            },
            scales: {
                x: {
                    display: true,
                    ticks: { maxTicksLimit: 10, maxRotation: 0 },
                    grid: { display: false }
                },
                y: {
                    position: 'left',
                    title: { display: true, text: 'Index (0-100)' },
                    min: 0, max: 100
                },
                y1: {
                    position: 'right',
                    title: { display: true, text: 'Temperature (°C)' },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

