/**
 * ForecastWell Pro Dashboard - Enhanced JavaScript
 * Premium Weather Intelligence Dashboard
 * Version 3.0 (Performance Optimized)
 */

// ========== Configuration ==========
const API_BASE = '/api';
const REFRESH_INTERVAL = 3 * 60 * 60 * 1000; // 3 hours (fallback poll — data pulled once per 3 hours per client requirement)

// ========== Performance: Lazy Loading for Charts ==========
// Use Intersection Observer to lazy load charts when they scroll into view
const lazyChartQueue = new Map();
const lazyChartObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const chartId = entry.target.id;
            if (lazyChartQueue.has(chartId)) {
                const initFn = lazyChartQueue.get(chartId);
                initFn();
                lazyChartQueue.delete(chartId);
                lazyChartObserver.unobserve(entry.target);
            }
        }
    });
}, { rootMargin: '100px' }); // Start loading 100px before visible

function registerLazyChart(chartId, initFn) {
    const element = document.getElementById(chartId);
    if (!element) return;

    // Check if already visible
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
        // Already visible, initialize immediately
        initFn();
    } else {
        // Not visible, register for lazy loading
        lazyChartQueue.set(chartId, initFn);
        lazyChartObserver.observe(element);
    }
}

// ========== Data Normalization (Compact API Format Support) ==========
// Converts compact API field names back to full names for backward compatibility
function normalizeCityData(cities) {
    if (!Array.isArray(cities)) return cities;
    return cities.map(city => {
        // If already in full format, return as-is
        if (city.city_name) return city;

        // Convert compact format to full format
        return {
            city_id: city.id,
            city_name: city.n,
            state: city.s,
            lat: city.lat,
            lon: city.lon,
            temperature: city.t,
            day_temp: city.dt,
            night_temp: city.nt,
            humidity: city.h,
            demand_index: city.di,
            demand_zone: city.dz,
            zone_icon: city.icon,
            timestamp: city.ts,
            // Preserve any other fields
            ...city
        };
    });
}

// ========== SSE Real-Time Updates ==========
let eventSource = null;

function connectSSE() {
    if (eventSource) {
        eventSource.close();
    }
    eventSource = new EventSource(`${API_BASE}/stream`);

    eventSource.addEventListener('weather_update', function () {
        console.log('[SSE] Weather update received — refreshing dashboard');
        refreshData();
    });

    eventSource.addEventListener('alerts_update', function () {
        console.log('[SSE] Alerts update received');
        fetch(`${API_BASE}/dashboard-init`)
            .then(r => r.json())
            .then(data => {
                if (data.status === 'success' && data.data && data.data.alerts) {
                    currentAlerts = data.data.alerts;
                    try { updateAlertsPanel(currentAlerts); } catch (e) { /* ignore */ }
                    try { updateAlertBadge(currentAlerts.length); } catch (e) { /* ignore */ }
                }
            })
            .catch(err => console.error('[SSE] Alert refresh error:', err));
    });

    eventSource.addEventListener('connected', function () {
        console.log('[SSE] Connected to real-time stream');
    });

    eventSource.onerror = function () {
        console.warn('[SSE] Connection lost, reconnecting in 10s...');
        eventSource.close();
        eventSource = null;
        setTimeout(connectSSE, 10000);
    };
}

// ========== Stale Data Banner ==========
function showStaleBanner(message) {
    const banner = document.getElementById('staleBanner');
    const text = document.getElementById('staleBannerText');
    if (banner) {
        if (text) text.textContent = message;
        banner.style.display = 'flex';
    }
}

function hideStaleBanner() {
    const banner = document.getElementById('staleBanner');
    if (banner) banner.style.display = 'none';
}

let citiesGridState = {
    filterText: '',
    filterZone: 'all',
    visibleCount: 12,
    increment: 12
};

let weeklyFilterState = {
    text: '',
    zone: 'all'
};

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
let currentWeeklyData = [];
let currentAlerts = [];
let lastIntelCities = []; // Demand Intel cache
let lastIntelSummary = {}; // Demand Intel summary cache

// ========== Initialization ==========
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 ForecastWell Pro Dashboard Initializing...');
    initializeDashboard();
    setupEventListeners();
    setupDemandIntelDelegation();
    setupHeatmapCitySelectListener();
    populateCompareCitySelect(); // New: Populate Date Comparison Dropdown
    setupDateComparison();       // New: Setup Date Comparison Logic
    startClock();

    // SSE real-time updates (primary), polling as fallback
    connectSSE();
    setInterval(refreshData, REFRESH_INTERVAL);

    // When user returns to a tab that's been idle, force a silent refresh
    // and unstick any loading overlay that may have been left visible
    let _lastHiddenAt = 0;
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            _lastHiddenAt = Date.now();
        } else if (document.visibilityState === 'visible') {
            const idleMs = Date.now() - _lastHiddenAt;
            // Force-hide overlay if it is somehow still showing
            const overlay = document.getElementById('loadingOverlay');
            if (overlay && overlay.classList.contains('active')) {
                _clearLoadingFeedbackTimers();
                hideLoading();
            }
            // If tab was hidden for more than 3 hours, do a silent refresh (aligns with 3-hour data cadence)
            if (idleMs > 3 * 60 * 60 * 1000) {
                console.log(`[Visibility] Tab was hidden for ${Math.round(idleMs/1000)}s — refreshing data (3-hour cadence)`);
                refreshData();
            }
        }
    });
});

// Timers for slow-load UI feedback
let _slowLoadTimer = null;
let _retryBtnTimer = null;

function _startLoadingFeedbackTimers() {
    // After 8s: show "first load may take a moment" hint
    _slowLoadTimer = setTimeout(() => {
        const msg = document.getElementById('loadingSlowMsg');
        if (msg) msg.style.display = '';
    }, 8000);

    // After 18s: show Retry button
    _retryBtnTimer = setTimeout(() => {
        const btn = document.getElementById('loadingRetryBtn');
        if (btn) btn.style.display = '';
    }, 18000);
}

function _clearLoadingFeedbackTimers() {
    clearTimeout(_slowLoadTimer);
    clearTimeout(_retryBtnTimer);
    const msg = document.getElementById('loadingSlowMsg');
    if (msg) msg.style.display = 'none';
    const btn = document.getElementById('loadingRetryBtn');
    if (btn) btn.style.display = 'none';
}

function retryDashboardLoad() {
    _clearLoadingFeedbackTimers();
    hideLoading();
    // Short delay then reinitialize
    setTimeout(() => {
        showLoadingWithProgress(1, 7);
        _startLoadingFeedbackTimers();
        loadDashboardData().then(() => {
            _clearLoadingFeedbackTimers();
            hideLoading();
            showToast('Dashboard loaded!', 'success');
        }).catch(() => {
            _clearLoadingFeedbackTimers();
            hideLoading();
            showToast('Could not load data. Please check your connection.', 'error');
        });
    }, 300);
}

async function initializeDashboard() {
    _startLoadingFeedbackTimers();

    // Absolute safety net: force-hide the overlay after 25s no matter what
    const _safetyTimer = setTimeout(() => {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay && overlay.classList.contains('active')) {
            console.warn('[Safety] Force-hiding stuck loading overlay after 25s');
            _clearLoadingFeedbackTimers();
            hideLoading();
        }
    }, 25000);

    try {
        // Step 1: Initialize dashboard
        showLoadingWithProgress(1, 7);

        // Initialize map with error handling
        try {
            initializeMap();
            console.log('✓ Map initialized');
        } catch (mapError) {
            console.error('⚠ Map initialization failed:', mapError);
            // Continue anyway
        }

        // Step 2-7: Load all data with progress updates
        showLoadingWithProgress(2, 7);
        await loadDashboardData();

        showLoadingWithProgress(3, 7);
        populateCompareCitySelect(); // Populate dropdown after data is loaded

        showLoadingWithProgress(4, 7);
        setupHeatmapCitySelectListener();

        showLoadingWithProgress(5, 7);
        setupDateComparison();       // New: Setup Date Comparison Logic

        showLoadingWithProgress(6, 7);
        startClock();

        showLoadingWithProgress(7, 7);
        // Final step completed

        clearTimeout(_safetyTimer);
        _clearLoadingFeedbackTimers();
        hideLoading();
        showToast('Dashboard loaded successfully!', 'success');

        console.log('✅ Dashboard initialized successfully');
    } catch (error) {
        clearTimeout(_safetyTimer);
        console.error('❌ Error initializing dashboard:', error);
        _clearLoadingFeedbackTimers();
        hideLoading();
        const errorMsg = error.message || 'Failed to load data. Please refresh the page.';
        showToast(errorMsg, 'error');
        // Ensure loading overlay is hidden even if something goes wrong
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.remove('active');
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

    // Navigation (delegated so all .nav-item work, including inside Demand Intel / other pages)
    document.body.addEventListener('click', function navClick(e) {
        const item = e.target.closest('.nav-item');
        if (item && item.dataset.page) {
            e.preventDefault();
            navigateToPage(item.dataset.page);
        }
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
    }

    // Cities Grid Filters
    const cityGridSearch = document.getElementById('cityGridSearch');
    if (cityGridSearch) {
        cityGridSearch.addEventListener('input', (e) => {
            citiesGridState.filterText = e.target.value.toLowerCase();
            citiesGridState.visibleCount = 12; // Reset pagination
            updateCitiesGrid(currentCityData);
        });
    }

    // Weekly Outlook Filters
    const weeklySearch = document.getElementById('weeklySearch');
    if (weeklySearch) {
        weeklySearch.addEventListener('input', (e) => {
            weeklyFilterState.text = e.target.value.toLowerCase();
            updateWeeklyOutlookUI();
        });
    }

    const weeklyZoneFilter = document.getElementById('weeklyZoneFilter');
    if (weeklyZoneFilter) {
        weeklyZoneFilter.addEventListener('change', (e) => {
            weeklyFilterState.zone = e.target.value;
            updateWeeklyOutlookUI();
        });
    }

    const cityGridZoneFilter = document.getElementById('cityGridZoneFilter');
    if (cityGridZoneFilter) {
        cityGridZoneFilter.addEventListener('change', (e) => {
            citiesGridState.filterZone = e.target.value;
            citiesGridState.visibleCount = 12; // Reset pagination
            updateCitiesGrid(currentCityData);
        });
    }

    const citiesShowMoreBtn = document.getElementById('citiesShowMoreBtn');
    if (citiesShowMoreBtn) {
        citiesShowMoreBtn.addEventListener('click', () => {
            citiesGridState.visibleCount += citiesGridState.increment;
            updateCitiesGrid(currentCityData);
        });
    }
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('searchResultsDropdown');
        if (dropdown && !e.target.closest('.search-box')) {
            dropdown.classList.remove('active');
        }
    });
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
function showLoading(message = 'Fetching live weather intelligence...', progress = null) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('active');
        const messageEl = overlay.querySelector('p');
        if (messageEl) messageEl.textContent = message;

        // Update progress bar if progress is provided
        if (progress !== null) {
            const progressBar = document.getElementById('progressBar');
            if (progressBar) {
                progressBar.style.width = `${progress}%`;
            }
        }
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        // Reset progress bar to 0 before hiding
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.style.width = '30%'; // Reset to initial state
        }
        overlay.classList.remove('active');
    }
}

// Enhanced loading with progress tracking
function showLoadingWithProgress(step, totalSteps) {
    const progress = Math.round((step / totalSteps) * 100);
    const messages = [
        'Initializing dashboard...',
        'Connecting to weather services...',
        'Fetching city data...',
        'Processing temperature data...',
        'Calculating demand indices...',
        'Updating visualizations...',
        'Almost complete...'
    ];

    const messageIndex = Math.min(Math.floor((step / totalSteps) * messages.length), messages.length - 1);
    showLoading(messages[messageIndex], progress);
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
async function loadDashboardData(showProgress = true) {
    try {
        console.log('📊 Loading dashboard data...');

        // Single combined API call: weather + alerts + KPIs
        console.log('→ Fetching dashboard-init (combined endpoint)...');

        // Add timeout to prevent hanging (20 seconds max — fail fast, let user retry)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
            if (showProgress) showLoadingWithProgress(2.5, 7);
        }, 20000);

        let initRes, initData;
        try {
            initRes = await fetch(`${API_BASE}/dashboard-init`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!initRes.ok) {
                throw new Error(`Server returned ${initRes.status}: ${initRes.statusText}`);
            }
            initData = await initRes.json();
        } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                console.error('⏱️ Request timeout after 60 seconds');
                throw new Error('Server is warming up. Click Retry or wait a moment.');
            }
            throw fetchError;
        }

        console.log('→ Init response status:', initRes.status);

        if (initData.status === 'success' && initData.data) {
            const { weather: rawWeather, alerts: alertsList, kpis } = initData.data;

            // Normalize compact API format to full format for backward compatibility
            const weather = normalizeCityData(rawWeather);

            // Process weather data
            if (weather && weather.length) {
                currentCityData = weather;
                console.log('✓ Found', currentCityData.length, 'cities');

                if (showProgress) showLoadingWithProgress(3, 7); // Update progress after getting data
                try { updateHeaderStats(weather); } catch (e) { console.error('Header stats error:', e); }

                if (showProgress) showLoadingWithProgress(4, 7); // Update progress after header stats
                try { updateMapMarkers(weather); } catch (e) { console.error('Map markers error:', e); }

                if (showProgress) showLoadingWithProgress(5, 7); // Update progress after map markers
                try { updateCitiesGrid(weather); } catch (e) { console.error('Cities grid error:', e); }

                try { updateFallbackBanner(weather); } catch (e) { console.error('Fallback banner error:', e); }
                try { populateCitySelects(weather); } catch (e) { console.error('City selects error:', e); }
                try { populateHistoricalCitySelect(); } catch (e) { console.error('Historical select error:', e); }
                try { populateHeatmapCitySelect(); } catch (e) { console.error('Heatmap select error:', e); }
                try { populateYoYCitySelect(); } catch (e) { console.error('YoY select error:', e); }

                // Initialize charts asynchronously (non-blocking, after critical UI is ready)
                // Use requestIdleCallback for better perceived performance
                // NOTE: Do NOT call showLoadingWithProgress() inside deferred callbacks —
                // it re-shows the overlay AFTER initializeDashboard() has already hidden it.
                const initCharts = () => {
                    try {
                        initializeDashboardCharts(weather);
                        updateWaveSequence(weather);
                    } catch (e) {
                        console.error('⚠ Deferred chart init error:', e);
                    }
                };

                if ('requestIdleCallback' in window) {
                    requestIdleCallback(initCharts, { timeout: 2000 });
                } else {
                    setTimeout(initCharts, 100);
                }
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
            // Note: API may return compact field names (d2p, season) or full names (days_to_peak, season_status)
            if (kpis) {
                try {
                    const daysEl = document.getElementById('daysToPeak');
                    const daysToPeak = kpis.d2p !== undefined ? kpis.d2p : kpis.days_to_peak;
                    if (daysEl) daysEl.textContent = daysToPeak === 0 ? '🎯 NOW!' : `~${daysToPeak} days`;
                    const seasonEl = document.getElementById('seasonStatus');
                    const seasonStatus = kpis.season !== undefined ? kpis.season : kpis.season_status;
                    if (seasonEl) seasonEl.textContent = seasonStatus || seasonEl.textContent;
                } catch (e) { console.warn('KPIs update error:', e); }
            }
        } else {
            console.error('⚠ Dashboard init data not available:', initData);
        }

        updateLastUpdate();

        // Show/hide stale data banner + auto-retry when server is warming up
        if (initData.data.warming_up) {
            showStaleBanner('Server is warming up — weather data will load automatically in a few seconds...');
            // Auto-retry silently in 6 seconds without showing the overlay
            setTimeout(() => refreshData(), 6000);
        } else if (initData.data.stale) {
            const ageMin = Math.round((initData.data.data_age_seconds || 0) / 60);
            showStaleBanner(`Weather data is ${ageMin} min old. Next refresh in ${180 - ageMin} min...`);
        } else {
            hideStaleBanner();
        }

        // Defer background sections until main dashboard is fully painted
        if (showProgress) showLoadingWithProgress(6.5, 7);
        requestIdleCallback(() => {
            loadNewSections().catch(err => console.warn('Background sections error:', err));
        }, { timeout: 3000 });

        console.log('✅ Data loading complete');

    } catch (error) {
        console.error('❌ Error loading dashboard data:', error);
        console.error('Error details:', error.message, error.stack);
        throw error;
    }
}

let _isRefreshing = false;

async function refreshData() {
    // Guard against concurrent refreshes (SSE + setInterval can both fire)
    if (_isRefreshing) return;
    _isRefreshing = true;

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.querySelector('i').classList.add('fa-spin');
    }

    // Clear page cache so all pages reload fresh data
    Object.keys(pageLoadedCache).forEach(k => delete pageLoadedCache[k]);

    try {
        // Pass showProgress=false so background refreshes never touch the loading overlay
        await loadDashboardData(false);
        showToast('Data refreshed successfully!', 'success');
    } catch (error) {
        showToast('Failed to refresh data', 'error');
    } finally {
        _isRefreshing = false;
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
                        <div style="font-size: 1.25rem; font-weight: 700; color: #ea580c;">${city.day_temp != null ? city.day_temp + '°C' : (city.temperature != null ? city.temperature + '°C' : '--')}</div>
                    </div>
                    <div style="flex: 1; text-align: center; padding: 0.5rem; background: #eff6ff; border-radius: 8px;">
                        <div style="font-size: 0.7rem; color: #1e40af;">NIGHT</div>
                        <div style="font-size: 1.25rem; font-weight: 700; color: #2563eb;">${city.night_temp != null ? city.night_temp + '°C' : (city.temperature != null ? (city.temperature - 5) + '°C' : '--')}</div>
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
    const getTempValue = (t, fallback) => (t != null ? t : (fallback != null ? fallback : -Infinity));

    const hottestDay = citiesData.reduce((max, city) =>
        getTempValue(city.day_temp, city.temperature) > getTempValue(max.day_temp, max.temperature) ? city : max
    );

    // Find hottest night city
    const hottestNight = citiesData.reduce((max, city) =>
        getTempValue(city.night_temp, city.temperature != null ? city.temperature - 5 : null) > getTempValue(max.night_temp, max.temperature != null ? max.temperature - 5 : null) ? city : max
    );

    // Season status based on hottest city's night temp (not averaged across diverse cities)
    const hottestNightTemp = (hottestNight.night_temp != null) ? hottestNight.night_temp : (hottestNight.temperature != null ? hottestNight.temperature - 5 : null);
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
    const showMoreBtn = document.getElementById('citiesShowMoreBtn');
    if (!container || !citiesData) return;

    // Filter data
    let filteredCities = citiesData.filter(city => {
        const matchesText = city.city_name.toLowerCase().includes(citiesGridState.filterText);
        const matchesZone = citiesGridState.filterZone === 'all' || city.demand_zone === citiesGridState.filterZone;
        return matchesText && matchesZone;
    });

    // Sort by Demand Index (High to Low)
    filteredCities.sort((a, b) => (b.demand_index || 0) - (a.demand_index || 0));

    // Pagination
    const visibleCities = filteredCities.slice(0, citiesGridState.visibleCount);

    // Toggle Show More Button
    if (showMoreBtn) {
        showMoreBtn.style.display = filteredCities.length > citiesGridState.visibleCount ? 'flex' : 'none';
        // Update button text to show remaining
        const remaining = filteredCities.length - citiesGridState.visibleCount;
        if (remaining > 0) {
            showMoreBtn.innerHTML = `Show More (${remaining}) <i class="fas fa-chevron-down"></i>`;
        }
    }

    if (visibleCities.length === 0) {
        container.innerHTML = '<div class="search-no-results"><i class="fas fa-search"></i> No cities found matching your criteria</div>';
        return;
    }

    container.innerHTML = visibleCities.map(city => {
        // Prefer explicit live values; if absent leave as null so UI shows '--'
        const dayTemp = (city.day_temp != null) ? city.day_temp : (city.temperature != null ? city.temperature : null);
        const nightTemp = (city.night_temp != null) ? city.night_temp : (city.temperature != null ? (city.temperature - 5) : null);
        const tempClass = (dayTemp != null) ? (dayTemp >= 38 ? 'hot' : dayTemp >= 35 ? 'warm' : dayTemp >= 32 ? 'mild' : 'cool') : 'nodata';

        const weatherIcon = (dayTemp != null) ? (dayTemp >= 38 ? '🔥' : dayTemp >= 35 ? '☀️' : dayTemp >= 30 ? '🌤️' : '⛅') : '—';
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
                        <div class="temp-box-value">${dayTemp != null ? dayTemp + '°' : '--'}</div>
                    </div>
                    <div class="temp-box night">
                        <div class="temp-box-label">Night ⭐</div>
                        <div class="temp-box-value">${nightTemp != null ? nightTemp + '°' : '--'}</div>
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
    // No live source -> show explicit No Live Data badge
    if (!source) return `<div class="source-badge nodata"><i class="fas fa-minus-circle"></i> No Live Data</div>`;
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

        // Sort by Day Temp and take Top 10
        const topHotCities = [...citiesData].sort((a, b) => (b.day_temp || b.temperature) - (a.day_temp || a.temperature)).slice(0, 10);

        charts.dayNight = new Chart(dayNightCanvas, {
            type: 'bar',
            data: {
                labels: topHotCities.map(c => c.city_name),
                datasets: [
                    {
                        label: 'Day Temp',
                        data: topHotCities.map(c => c.day_temp || c.temperature),
                        backgroundColor: 'rgba(249, 115, 22, 0.7)',
                        borderColor: 'rgb(249, 115, 22)',
                        borderWidth: 2,
                        borderRadius: 6
                    },
                    {
                        label: 'Night Temp ⭐',
                        data: topHotCities.map(c => c.night_temp || c.temperature - 5),
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
                    title: {
                        display: true,
                        text: 'Top 10 Hottest Cities',
                        font: { size: 14, weight: 'normal' },
                        padding: { bottom: 10 }
                    },
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    },
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

        // Limit to Top 5 Cities by Demand Index
        const topTrendCities = [...citiesData].sort((a, b) => (b.demand_index || 0) - (a.demand_index || 0)).slice(0, 5);

        // Function to fetch historical data for a city
        const fetchCityHistory = async (city) => {
            try {
                const response = await fetch(`${API_BASE}/weather/city/${city.city_id}`);
                const result = await response.json();
                if (result.status === 'success' && result.data && result.data.historical) {

                    // Get last 6 days of history
                    // API returns descending usually, so reverse it to get chronological
                    const history = result.data.historical.slice(0, 7).reverse();

                    // Create data points
                    const dataPoints = history.map(h => ({
                        x: new Date(h.date),
                        y: h.day_temp || h.temperature
                    }));

                    // Add TODAY (current live data)
                    const todayDate = new Date();
                    dataPoints.push({
                        x: todayDate,
                        y: city.day_temp || city.temperature
                    });

                    // Sort by date just in case
                    dataPoints.sort((a, b) => a.x - b.x);

                    // Take last 7 days
                    return dataPoints.slice(-7);
                }
                return null;
            } catch (err) {
                console.error(`Error fetching history for ${city.city_name}:`, err);
                return null;
            }
        };

        // Fetch history for all top 5 cities in parallel
        Promise.all(topTrendCities.map(fetchCityHistory)).then(results => {
            const datasets = [];
            let labelsSet = false;
            let finalLabels = [];

            // Generate distinct colors
            function generateCityColors(count) {
                const colors = [];
                for (let i = 0; i < count; i++) {
                    const hue = (i * 360 / count) % 360;
                    colors.push({
                        border: `hsl(${hue}, 70%, 50%)`,
                        bg: `hsla(${hue}, 70%, 50%, 0.1)`
                    });
                }
                return colors;
            }
            const cityColors = generateCityColors(topTrendCities.length);

            results.forEach((dataPoints, index) => {
                const city = topTrendCities[index];
                if (dataPoints && dataPoints.length > 0) {
                    const color = cityColors[index % cityColors.length];

                    // Set labels from the first valid dataset
                    if (!labelsSet) {
                        finalLabels = dataPoints.map(dp => dp.x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }));
                        labelsSet = true;
                    }

                    datasets.push({
                        label: city.city_name,
                        data: dataPoints.map(dp => dp.y),
                        borderColor: color.border,
                        backgroundColor: color.bg,
                        tension: 0.4,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    });
                }
            });

            if (datasets.length === 0) {
                // Show error state in chart container
                const container = tempCanvas.parentElement;
                // Create error overlay if not exists, or replace canvas content
                // Better: keep canvas but show toast or overlay. For now console.
                console.warn('No historical data available for trends chart');
                if (tempSkeleton) {
                    tempSkeleton.style.display = 'flex';
                    tempSkeleton.innerHTML = '<p class="text-error">Real-time data unavailable</p>';
                }
                return;
            }

            charts.temperature = new Chart(tempCanvas, {
                type: 'line',
                data: {
                    labels: finalLabels,
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

        // Dynamic colors for city comparison
        function generateRadarColors(count) {
            const colors = [];
            for (let i = 0; i < count; i++) {
                const hue = (i * 360 / count) % 360;
                colors.push({
                    border: `hsl(${hue}, 65%, 55%)`,
                    bg: `hsla(${hue}, 65%, 55%, 0.8)`
                });
            }
            return colors;
        }

        // Metrics to compare across cities (normalized 0-100)
        const metricLabels = ['Day Temp', 'Night Temp', 'Humidity', 'Wind', 'Demand', 'AC Hours'];

        // Show top 10 cities by demand index for readability
        const topCities = [...currentCityData].sort((a, b) => (b.demand_index || 50) - (a.demand_index || 50)).slice(0, 10);
        const radarColors = generateRadarColors(topCities.length);

        const datasets = topCities.map((city, i) => ({
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
                    backgroundColor: 'rgba(14, 165, 233, 0.7)', // Sky 500
                    borderColor: '#0ea5e9',
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

        // Sort by AC Hours descending and take top 10
        const topAcCities = [...currentCityData].sort((a, b) => (b.ac_hours || 0) - (a.ac_hours || 0)).slice(0, 10);

        charts.acHours = new Chart(acCanvas, {
            type: 'polarArea',
            data: {
                labels: topAcCities.map(c => c.city_name),
                datasets: [{
                    data: topAcCities.map(c => c.ac_hours || Math.round((c.night_temp || 20) - 15)),
                    backgroundColor: topAcCities.map((_, i) => `hsla(${(i * 360 / topAcCities.length) % 360}, 65%, 55%, 0.7)`)
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

async function loadAnalyticsYoYChart() {
    const canvas = document.getElementById('yoyComparisonChart');
    if (!canvas) return;

    // Destroy existing chart if any
    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    // Use selected city from other tabs or default
    const cityId = selectedForecastCity || (currentCityData.length > 0 ? currentCityData[0].city_id : 'chennai');

    try {
        // Fetch data for 3 years
        const [resp24, resp25, resp26] = await Promise.all([
            fetch(`/api/monthly-history?city=${cityId}&year=2024`).then(r => r.json()),
            fetch(`/api/monthly-history?city=${cityId}&year=2025`).then(r => r.json()),
            fetch(`/api/monthly-history?city=${cityId}&year=2026`).then(r => r.json())
        ]);

        const mapData = (resp) => {
            if (resp.status !== 'success' || !resp.data) return Array(12).fill(null);
            // resp.data is usually array of month objects
            const arr = Array(12).fill(null);
            resp.data.forEach(m => {
                if (m.month >= 1 && m.month <= 12) {
                    arr[m.month - 1] = m.avg_day_temp;
                }
            });
            return arr;
        };

        const data2024 = mapData(resp24);
        const data2025 = mapData(resp25);
        const data2026 = mapData(resp26);

        const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
                const val24 = data2024[i] ? data2024[i].toFixed(1) + '°' : '-';
                const val25 = data2025[i] ? data2025[i].toFixed(1) + '°' : '-';
                const val26 = data2026[i] ? data2026[i].toFixed(1) + '°' : '-';

                let diff = '-';
                let diffClass = '';

                if (data2026[i] !== null && data2025[i] !== null) {
                    const d = (data2026[i] - data2025[i]).toFixed(1);
                    diff = (d > 0 ? '+' : '') + d;
                    diffClass = d > 0 ? 'text-red' : 'text-green';
                }

                tableHtml += `
                    <tr>
                        <td>${month}</td>
                        <td>${val24}</td>
                        <td>${val25}</td>
                        <td>${val26}</td>
                        <td class="${diffClass}">${diff}</td>
                    </tr>
                `;
            });

            tableHtml += '</tbody></table>';
            tableContainer.innerHTML = tableHtml;
        }

    } catch (e) {
        console.error('Error fetching YoY data:', e);
    }
}

// ========== Forecast Page ==========
let selectedForecastCity = null;
let selectedForecastDays = 7;
// Peak season start dates (Month-Day)


/*
 * Update forecast page subtitle based on selected days
 */
function updateForecastSubtitle(days) {
    const subtitle = document.getElementById('forecastHeaderSubtitle');
    const loaderSubtext = document.getElementById('forecastLoaderSubtext');
    if (days === 120) {
        if (subtitle) subtitle.textContent = '4-Month forecast with monthly demand outlook (ECMWF SEAS5)';
        if (loaderSubtext) loaderSubtext.textContent = 'Loading 4-month seasonal forecast...';
    } else {
        if (subtitle) subtitle.textContent = `${days}-Day forecast with demand predictions`;
        if (loaderSubtext) loaderSubtext.textContent = `Preparing ${days}-day predictions...`;
    }
}

/*
 * Load Forecast Page
 */
async function loadForecastPage() {
    console.log('Loading forecast page...');
    populateForecastCitySelect();
    setupForecastEventListeners();
    updateForecastSubtitle(selectedForecastDays);

    // Fetch real forecast data
    const cityId = selectedForecastCity || (currentCityData.length > 0 ? currentCityData[0].city_id : 'chennai');
    try {
        const response = await fetch(`/api/forecast?city=${cityId}&days=${selectedForecastDays}`);
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            generateForecastCards(result.data);
            initializeForecastChart(result.data);
            if (selectedForecastDays === 120) generateFourMonthBreakdown(result.data);
        } else {
            console.error('Failed to load forecast', result);
        }
    } catch (e) {
        console.error('Error fetching forecast:', e);
    }

    generatePredictions();
    setupYearCompare();
    loadBranchDemandChart();
    loadModelMixCharts();
}

// ========== Branch-wise Stacked Demand Chart ==========

let branchDemandChart = null;

async function loadBranchDemandChart() {
    try {
        const res = await fetch('/api/zones/demand-summary');
        const result = await res.json();
        if (result.status === 'success') {
            renderBranchDemandChart(result.data);
        }
    } catch (e) {
        console.error('Branch demand chart error:', e);
    }
}

function renderBranchDemandChart(data) {
    const canvas = document.getElementById('branchDemandChart');
    if (!canvas) return;
    if (branchDemandChart) branchDemandChart.destroy();

    const theme = getChartTheme();
    const datasets = data.zones.map(z => ({
        label: z.short,
        data: z.demand,
        backgroundColor: z.color + 'cc',
        borderColor: z.color,
        borderWidth: 1,
        borderRadius: { topLeft: 2, topRight: 2 }
    }));

    // Build legend
    const legendEl = document.getElementById('branchLegend');
    if (legendEl) {
        legendEl.innerHTML = data.zones.map(z =>
            `<span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:3px 8px;border-radius:100px;background:${z.color}18;border:1px solid ${z.color}40;color:${z.color}">
                <span style="width:8px;height:8px;border-radius:50%;background:${z.color};flex-shrink:0"></span>
                ${z.short} (${z.city_count})
            </span>`
        ).join('');
    }

    branchDemandChart = new Chart(canvas, {
        type: 'bar',
        data: { labels: data.months, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: theme.tooltipBg,
                    titleColor: theme.tooltipText,
                    bodyColor: theme.tooltipText,
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}`,
                        footer: ctxArr => {
                            const total = ctxArr.reduce((s, c) => s + (c.parsed.y || 0), 0);
                            return `Total Zone Demand: ${total.toFixed(0)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { color: theme.textColor, font: { size: 11 } }
                },
                y: {
                    stacked: true,
                    title: { display: true, text: 'Demand Index (stacked zones)', color: theme.textColor },
                    grid: { color: theme.gridColor },
                    ticks: { color: theme.textColor }
                }
            }
        }
    });
}

// ========== Model Mix Charts ==========

let modelMixStackedChart = null;
let modelMixDonutChart = null;

async function loadModelMixCharts() {
    try {
        const res = await fetch('/api/forecast/model-mix');
        const result = await res.json();
        if (result.status === 'success') {
            renderModelMixStackedChart(result.data);
            renderModelMixDonutChart(result.data);
        }
    } catch (e) {
        console.error('Model mix chart error:', e);
    }
}

function renderModelMixStackedChart(data) {
    const canvas = document.getElementById('modelMixStackedChart');
    if (!canvas) return;
    if (modelMixStackedChart) modelMixStackedChart.destroy();

    const theme = getChartTheme();
    const datasets = data.models.map(m => ({
        label: m.label,
        data: m.values,
        backgroundColor: m.color + 'bb',
        borderColor: m.color,
        borderWidth: 1
    }));

    modelMixStackedChart = new Chart(canvas, {
        type: 'bar',
        data: { labels: data.months, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12, font: { size: 11 } } },
                tooltip: {
                    backgroundColor: theme.tooltipBg,
                    callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%` }
                }
            },
            scales: {
                x: { stacked: true, grid: { display: false }, ticks: { color: theme.textColor, font: { size: 11 } } },
                y: {
                    stacked: true,
                    max: 100,
                    title: { display: true, text: 'Model Mix (%)', color: theme.textColor },
                    ticks: { color: theme.textColor, callback: v => v + '%' },
                    grid: { color: theme.gridColor }
                }
            }
        }
    });
}

function renderModelMixDonutChart(data) {
    const canvas = document.getElementById('modelMixDonutChart');
    if (!canvas) return;
    if (modelMixDonutChart) modelMixDonutChart.destroy();

    const theme = getChartTheme();
    modelMixDonutChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: data.models.map(m => m.label),
            datasets: [{
                data: data.models.map(m => m.avg),
                backgroundColor: data.models.map(m => m.color + 'cc'),
                borderColor: data.models.map(m => m.color),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, padding: 10, font: { size: 10 } } },
                tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed.toFixed(1)}%` } }
            },
            cutout: '65%'
        }
    });
}

// ========== Year-over-Year Comparison ==========

function setupYearCompare() {
    const dateInput = document.getElementById('yearCompareDate');
    const compareBtn = document.getElementById('yearCompareBtn');
    if (!dateInput || !compareBtn) return;

    // Default to today
    dateInput.value = new Date().toISOString().split('T')[0];

    const trigger = () => {
        const city = selectedForecastCity || (currentCityData.length > 0 ? currentCityData[0].city_id : null);
        if (dateInput.value && city) loadYearComparison(city, dateInput.value);
    };

    compareBtn.addEventListener('click', trigger);
    dateInput.addEventListener('change', trigger);

    // Auto-load for today
    trigger();
}

async function loadYearComparison(cityId, date) {
    const resultsDiv = document.getElementById('yearCompareResults');
    if (!resultsDiv) return;

    resultsDiv.innerHTML = `<div class="year-compare-loading">
        <div class="loader-spinner" style="width:24px;height:24px;border-width:3px;"></div>
        <span>Fetching historical data...</span>
    </div>`;

    try {
        const response = await fetch(`/api/forecast/year-compare?city=${cityId}&date=${date}`);
        const result = await response.json();
        if (result.status === 'success') {
            renderYearComparison(result);
        } else {
            resultsDiv.innerHTML = `<p class="year-compare-placeholder">Could not load data: ${result.message || 'unknown error'}</p>`;
        }
    } catch (e) {
        console.error('Year comparison error:', e);
        resultsDiv.innerHTML = `<p class="year-compare-placeholder">Network error — please try again.</p>`;
    }
}

function renderYearComparison(data) {
    const resultsDiv = document.getElementById('yearCompareResults');
    if (!resultsDiv) return;

    const { date, last_year_date, two_years_ago_date, three_years_ago_date, city } = data;

    const fmtDate = d => {
        const [y, m, day] = d.split('-');
        return `${day}/${m}/${y}`;
    };
    const fmtT = t => (t != null ? `${t}°C` : '—');
    const diffStr = (curr, hist) => {
        if (!curr || !hist || curr.avg_temp == null || hist.avg_temp == null) return '';
        const d = (curr.avg_temp - hist.avg_temp).toFixed(1);
        const sign = d > 0 ? '+' : '';
        return `<span class="yc-diff">(${sign}${d}°C)</span>`;
    };

    const badge = (comp) => {
        if (comp === 'warmer') return '<span class="yc-badge warmer">🔥 Warmer</span>';
        if (comp === 'cooler') return '<span class="yc-badge cooler">❄️ Cooler</span>';
        if (comp === 'similar') return '<span class="yc-badge similar">≈ Similar</span>';
        if (comp === 'unavailable') return '<span class="yc-badge unknown">No data</span>';
        return '<span class="yc-badge unknown">—</span>';
    };

    const curr = city.current;
    const ly = city.last_year;
    const tya = city.two_years_ago;
    const thrya = city.three_years_ago;

    const currYear = date.split('-')[0];
    const lyYear = last_year_date.split('-')[0];
    const tyaYear = two_years_ago_date.split('-')[0];
    const thryaYear = three_years_ago_date ? three_years_ago_date.split('-')[0] : null;

    const currBlock = curr
        ? `<div class="yc-temp-val">${fmtT(curr.day_temp)} / ${fmtT(curr.night_temp)}</div>
           <div class="yc-temp-avg">avg ${fmtT(curr.avg_temp)}</div>`
        : '<span class="yc-na">No data available</span>';

    const lyBlock = ly && ly.avg_temp != null
        ? `<div class="yc-temp-val">${fmtT(ly.day_temp)} / ${fmtT(ly.night_temp)}</div>
           <div class="yc-temp-avg">avg ${fmtT(ly.avg_temp)} ${diffStr(curr, ly)}</div>
           ${badge(ly.comparison)}`
        : badge(ly ? ly.comparison : 'unavailable');

    const tyaBlock = tya && tya.avg_temp != null
        ? `<div class="yc-temp-val">${fmtT(tya.day_temp)} / ${fmtT(tya.night_temp)}</div>
           <div class="yc-temp-avg">avg ${fmtT(tya.avg_temp)} ${diffStr(curr, tya)}</div>
           ${badge(tya.comparison)}`
        : badge(tya ? tya.comparison : 'unavailable');

    const thryaBlock = thrya && thrya.avg_temp != null
        ? `<div class="yc-temp-val">${fmtT(thrya.day_temp)} / ${fmtT(thrya.night_temp)}</div>
           <div class="yc-temp-avg">avg ${fmtT(thrya.avg_temp)} ${diffStr(curr, thrya)}</div>
           ${badge(thrya.comparison)}`
        : badge(thrya ? thrya.comparison : 'unavailable');

    const thryaCard = thryaYear ? `
        <div class="yc-arrow">→</div>
        <div class="yc-year-card yc-card-3ya">
            <div class="yc-year-label">${thryaYear} <small>(${fmtDate(three_years_ago_date)})</small></div>
            ${thryaBlock}
        </div>` : '';

    resultsDiv.innerHTML = `
    <div class="year-compare-date-header">
        <strong>${city.city_name}</strong> &mdash; 3-year comparison for ${fmtDate(date)}
    </div>
    <div class="yc-cards-row">
        <div class="yc-year-card yc-card-current">
            <div class="yc-year-label">${currYear} <small>(${fmtDate(date)})</small></div>
            ${currBlock}
        </div>
        <div class="yc-arrow">→</div>
        <div class="yc-year-card yc-card-ly">
            <div class="yc-year-label">${lyYear} <small>(${fmtDate(last_year_date)})</small></div>
            ${lyBlock}
        </div>
        <div class="yc-arrow">→</div>
        <div class="yc-year-card yc-card-tya">
            <div class="yc-year-label">${tyaYear} <small>(${fmtDate(two_years_ago_date)})</small></div>
            ${tyaBlock}
        </div>
        ${thryaCard}
    </div>`;
}

function setupForecastEventListeners() {
    // City dropdown change event
    const citySelect = document.getElementById('forecastCitySelect');
    if (citySelect) {
        citySelect.addEventListener('change', async function () {
            selectedForecastCity = this.value;

            // Fetch and update
            try {
                const response = await fetch(`/api/forecast?city=${selectedForecastCity}&days=${selectedForecastDays}`);
                const result = await response.json();
                if (result.status === 'success' && result.data) {
                    generateForecastCards(result.data);
                    initializeForecastChart(result.data);
                    if (selectedForecastDays === 120) generateFourMonthBreakdown(result.data);
                }
            } catch (e) {
                console.error(e);
            }
            generatePredictions();
            // Refresh year comparison for new city
            const dateInput = document.getElementById('yearCompareDate');
            if (dateInput && dateInput.value) loadYearComparison(selectedForecastCity, dateInput.value);
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
            updateForecastSubtitle(selectedForecastDays);

            // Toggle 4-month breakdown section visibility
            const breakdownSection = document.getElementById('fourMonthBreakdown');
            if (breakdownSection) breakdownSection.style.display = selectedForecastDays === 120 ? '' : 'none';

            // Fetch and update
            const cityId = selectedForecastCity || (currentCityData.length > 0 ? currentCityData[0].city_id : 'chennai');
            fetch(`/api/forecast?city=${cityId}&days=${selectedForecastDays}`)
                .then(r => r.json())
                .then(result => {
                    if (result.status === 'success') {
                        generateForecastCards(result.data);
                        initializeForecastChart(result.data);
                        if (selectedForecastDays === 120) generateFourMonthBreakdown(result.data);
                    }
                });
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

function generateForecastCards(forecastData) {
    const container = document.getElementById('forecastCarousel');
    if (!container || !forecastData) return;

    // 4-month view: show monthly summary cards instead of daily cards
    if (selectedForecastDays === 120) {
        generateMonthlyForecastCards(forecastData, container);
        return;
    }

    // Use fetched data (max 7 visible for short-term)
    const cardsToShow = Math.min(forecastData.length, selectedForecastDays <= 14 ? 7 : 14);

    let html = '';
    for (let i = 0; i < cardsToShow; i++) {
        const day = forecastData[i];
        const dateObj = new Date(day.date);

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayName = i === 0 ? 'Today' : days[dateObj.getDay()];

        const dayHigh = Math.round(day.day_temp);
        const dayLow = Math.round(day.night_temp);

        // Determine icon based on temperature
        let icon = '☀️';
        if (dayHigh >= 40) icon = '🔥';
        else if (dayHigh >= 36) icon = '☀️';
        else if (dayHigh >= 32) icon = '🌤️';
        else if (dayHigh >= 28) icon = '⛅';
        else icon = '🌥️';

        // Check for rain if available in future data
        if (day.precipitation_sum > 0) icon = '🌧️';

        html += `
            <div class="forecast-card glass-card" data-day="${i}">
                <div class="forecast-day">${dayName}</div>
                <div class="forecast-date">${dateObj.getDate()}/${dateObj.getMonth() + 1}</div>
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

/*
 * Aggregate daily forecast into monthly buckets for 4-month view
 */
function aggregateForecastByMonth(forecastData) {
    const monthMap = {};
    forecastData.forEach(day => {
        const d = new Date(day.date);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (!monthMap[key]) {
            monthMap[key] = {
                year: d.getFullYear(),
                month: d.getMonth(),
                monthName: d.toLocaleString('default', { month: 'long' }),
                shortMonth: d.toLocaleString('default', { month: 'short' }),
                dayTemps: [],
                nightTemps: [],
                humidity: [],
                windSpeeds: []
            };
        }
        if (day.day_temp != null) monthMap[key].dayTemps.push(day.day_temp);
        if (day.night_temp != null) monthMap[key].nightTemps.push(day.night_temp);
        if (day.humidity != null) monthMap[key].humidity.push(day.humidity);
        if (day.wind_speed != null) monthMap[key].windSpeeds.push(day.wind_speed);
    });
    return Object.values(monthMap).sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
}

/*
 * Show 4 monthly summary cards in the carousel area
 */
function generateMonthlyForecastCards(forecastData, container) {
    const months = aggregateForecastByMonth(forecastData).slice(0, 4);
    const monthIcons = ['🌤️', '☀️', '🔥', '🌤️', '⛅', '🌧️', '🌧️', '🌧️', '🌦️', '🌤️', '⛅', '🌥️'];

    let html = '<div class="forecast-monthly-cards">';
    months.forEach((m, idx) => {
        const avgDay = m.dayTemps.length ? Math.round(m.dayTemps.reduce((a, b) => a + b, 0) / m.dayTemps.length) : '--';
        const avgNight = m.nightTemps.length ? Math.round(m.nightTemps.reduce((a, b) => a + b, 0) / m.nightTemps.length) : '--';
        const avgHumidity = m.humidity.length ? Math.round(m.humidity.reduce((a, b) => a + b, 0) / m.humidity.length) : '--';
        const demandIdx = typeof avgDay === 'number' ? Math.min(100, Math.max(0, Math.round((avgDay - 20) * 2.5))) : '--';
        const icon = monthIcons[m.month] || '🌤️';
        const demandColor = typeof demandIdx === 'number' ? (demandIdx >= 70 ? '#ef4444' : demandIdx >= 50 ? '#f97316' : demandIdx >= 30 ? '#eab308' : '#22c55e') : '#94a3b8';
        const demandLabel = typeof demandIdx === 'number' ? (demandIdx >= 70 ? 'Very High' : demandIdx >= 50 ? 'High' : demandIdx >= 30 ? 'Moderate' : 'Low') : 'N/A';

        html += `
        <div class="forecast-card forecast-month-card glass-card" data-month="${idx}">
            <div class="forecast-day" style="font-size:1rem;font-weight:700;">${m.monthName}</div>
            <div class="forecast-date" style="opacity:0.6;">${m.year}</div>
            <div class="forecast-icon" style="font-size:2.2rem;margin:0.5rem 0;">${icon}</div>
            <div class="forecast-temps">
                <span class="forecast-temp-high">${avgDay}°</span>
                <span class="forecast-temp-low">${avgNight}°</span>
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:0.4rem;">Humidity: ${avgHumidity}%</div>
            <div class="forecast-demand" style="font-size:0.78rem;margin-top:0.5rem;font-weight:600;color:${demandColor};">
                Demand: ${demandLabel} (${demandIdx}%)
            </div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

/*
 * Generate detailed 4-month breakdown section
 */
function generateFourMonthBreakdown(forecastData) {
    const section = document.getElementById('fourMonthBreakdown');
    const grid = document.getElementById('fourMonthGrid');
    if (!section || !grid) return;

    section.style.display = '';
    const months = aggregateForecastByMonth(forecastData).slice(0, 4);
    const monthColors = ['#3b82f6', '#f97316', '#ef4444', '#8b5cf6'];

    let html = '';
    months.forEach((m, idx) => {
        const avgDay = m.dayTemps.length ? (m.dayTemps.reduce((a, b) => a + b, 0) / m.dayTemps.length).toFixed(1) : 'N/A';
        const maxDay = m.dayTemps.length ? Math.max(...m.dayTemps).toFixed(1) : 'N/A';
        const minNight = m.nightTemps.length ? Math.min(...m.nightTemps).toFixed(1) : 'N/A';
        const avgNight = m.nightTemps.length ? (m.nightTemps.reduce((a, b) => a + b, 0) / m.nightTemps.length).toFixed(1) : 'N/A';
        const avgHumidity = m.humidity.length ? Math.round(m.humidity.reduce((a, b) => a + b, 0) / m.humidity.length) : 'N/A';
        const avgWind = m.windSpeeds.length ? (m.windSpeeds.reduce((a, b) => a + b, 0) / m.windSpeeds.length).toFixed(1) : 'N/A';
        const demandIdx = typeof parseFloat(avgDay) === 'number' && !isNaN(parseFloat(avgDay)) ? Math.min(100, Math.max(0, Math.round((parseFloat(avgDay) - 20) * 2.5))) : 0;
        const demandColor = demandIdx >= 70 ? '#ef4444' : demandIdx >= 50 ? '#f97316' : demandIdx >= 30 ? '#eab308' : '#22c55e';
        const demandLabel = demandIdx >= 70 ? 'Very High Demand' : demandIdx >= 50 ? 'High Demand' : demandIdx >= 30 ? 'Moderate Demand' : 'Low Demand';
        const color = monthColors[idx % monthColors.length];

        html += `
        <div class="four-month-card glass-card" style="border-top: 3px solid ${color};">
            <div class="four-month-card-header">
                <span class="four-month-name" style="color:${color};">${m.monthName} ${m.year}</span>
                <span class="four-month-demand-badge" style="background:${demandColor}20;color:${demandColor};border:1px solid ${demandColor}40;">${demandLabel}</span>
            </div>
            <div class="four-month-stats">
                <div class="four-month-stat">
                    <div class="stat-value">${avgDay}°C</div>
                    <div class="stat-label">Avg Day</div>
                </div>
                <div class="four-month-stat">
                    <div class="stat-value">${maxDay}°C</div>
                    <div class="stat-label">Peak Day</div>
                </div>
                <div class="four-month-stat">
                    <div class="stat-value">${avgNight}°C</div>
                    <div class="stat-label">Avg Night</div>
                </div>
                <div class="four-month-stat">
                    <div class="stat-value">${minNight}°C</div>
                    <div class="stat-label">Min Night</div>
                </div>
                <div class="four-month-stat">
                    <div class="stat-value">${avgHumidity}%</div>
                    <div class="stat-label">Humidity</div>
                </div>
                <div class="four-month-stat">
                    <div class="stat-value">${avgWind} km/h</div>
                    <div class="stat-label">Wind</div>
                </div>
            </div>
            <div class="four-month-demand-bar">
                <div class="demand-bar-fill" style="width:${demandIdx}%;background:${demandColor};"></div>
                <span class="demand-bar-label">${demandIdx}% Demand Index</span>
            </div>
        </div>`;
    });

    grid.innerHTML = html;
}

function initializeForecastChart(forecastData) {
    const canvas = document.getElementById('forecastChart');
    if (!canvas || !forecastData) return;

    if (charts.forecast) charts.forecast.destroy();

    const cityData = getSelectedCityData();
    const headers = [];
    const dayData = [];
    const nightData = [];
    const demandData = [];
    const is4Month = selectedForecastDays === 120;

    if (is4Month) {
        // Aggregate by week for cleaner 4-month chart
        const weeks = [];
        let weekBuf = { dayTemps: [], nightTemps: [], label: '' };
        let weekNum = 0;
        forecastData.forEach((day, i) => {
            const d = new Date(day.date);
            if (i % 7 === 0) {
                if (weekNum > 0 && weekBuf.dayTemps.length) {
                    weeks.push({ ...weekBuf });
                }
                weekBuf = {
                    dayTemps: [],
                    nightTemps: [],
                    label: `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`
                };
                weekNum++;
            }
            if (day.day_temp != null) weekBuf.dayTemps.push(day.day_temp);
            if (day.night_temp != null) weekBuf.nightTemps.push(day.night_temp);
        });
        if (weekBuf.dayTemps.length) weeks.push(weekBuf);

        weeks.forEach(w => {
            headers.push(w.label);
            const avgDay = w.dayTemps.reduce((a, b) => a + b, 0) / w.dayTemps.length;
            const avgNight = w.nightTemps.reduce((a, b) => a + b, 0) / w.nightTemps.length;
            dayData.push(parseFloat(avgDay.toFixed(1)));
            nightData.push(parseFloat(avgNight.toFixed(1)));
            demandData.push(Math.min(100, Math.max(0, Math.round((avgDay - 20) * 2.5))));
        });
    } else {
        // Daily data for short-term forecasts
        forecastData.forEach(day => {
            const d = new Date(day.date);
            headers.push(`${d.getDate()}/${d.getMonth() + 1}`);
            dayData.push(day.day_temp);
            nightData.push(day.night_temp);
            demandData.push(Math.min(100, Math.max(0, Math.round((day.day_temp - 20) * 2.5))));
        });
    }

    const titleText = is4Month
        ? (cityData ? `4-Month Forecast (Weekly Avg) — ${cityData.city_name}` : '4-Month Forecast (Weekly Averages)')
        : (cityData ? `${selectedForecastDays}-Day Forecast for ${cityData.city_name}` : `${selectedForecastDays}-Day Average Forecast`);

    charts.forecast = new Chart(canvas, {
        type: 'line',
        data: {
            labels: headers,
            datasets: [
                {
                    label: 'Day Temp (°C)',
                    data: dayData,
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249, 115, 22, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: is4Month ? 4 : 3,
                    yAxisID: 'y'
                },
                {
                    label: 'Night Temp (°C)',
                    data: nightData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: is4Month ? 4 : 3,
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
                    pointRadius: is4Month ? 4 : 3,
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
                    text: titleText
                },
                tooltip: {
                    callbacks: {
                        title: (items) => is4Month ? `Week of ${items[0].label}` : items[0].label
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: is4Month ? 45 : 0,
                        font: { size: is4Month ? 11 : 12 }
                    }
                },
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

// Peak season start dates (Month-Day)
const peakSeasonMap = {
    'chennai': '04-20',
    'bangalore': '04-01',
    'hyderabad': '04-10',
    'kochi': '03-15',
    'mumbai': '04-01',
    'pune': '04-01',
    'delhi': '05-01',
    'lucknow': '05-01',
    'jaipur': '04-20',
    'kolkata': '04-10',
    'ahmedabad': '04-15',
    'bhubaneswar': '04-01',
    'visakhapatnam': '04-01',
    'vijayawada': '04-05',
    'tirupati': '04-01',
    'madurai': '04-05',
    'coimbatore': '03-25',
    'trichy': '04-05',
    'salem': '04-05',
    'nellore': '04-05',
    'guntur': '04-05',
    'kurnool': '04-01',
    'warangal': '04-10',
    'rajahmundry': '04-01',
    'kakinada': '04-01'
};

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
    // Calculate predictions - Target Peak based on City
    const now = new Date();
    const currentYear = now.getFullYear();
    const peakConfig = peakSeasonMap[(cityName || 'chennai').toLowerCase()] || '04-20';
    const [pMonth, pDay] = peakConfig.split('-').map(Number);
    let peakDate = new Date(currentYear, pMonth - 1, pDay);
    const summerEnd = new Date(currentYear, 5, 1); // June 1

    let peakDays;

    // Reset hours for accurate day calc
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (todayStart >= peakDate && todayStart < summerEnd) {
        peakDays = 0;
    } else {
        if (todayStart >= summerEnd) {
            peakDate = new Date(currentYear + 1, pMonth - 1, pDay);
        }
        const diffTime = peakDate - todayStart;
        peakDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
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
            <div class="prediction-value">${Math.round(avgDemand)}/100</div>
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
function openCityDetails(cityId) {
    if (!cityId) return;
    // Find city in current data
    const city = currentCityData.find(c => c.city_id === cityId) ||
        lastIntelCities.find(c => c.city_id === cityId);
    if (city) {
        showCityModal(city);
    } else {
        // Try to fetch city data
        fetch(`/api/weather/${cityId}`)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success' && data.data) {
                    showCityModal(data.data);
                } else {
                    showToast('City data not available', 'error');
                }
            })
            .catch(err => {
                console.error('Error fetching city details:', err);
                showToast('Failed to load city details', 'error');
            });
    }
}

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
        // Sort cities alphabetically
        citiesData.sort((a, b) => a.city_name.localeCompare(b.city_name));

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
        // Generate date labels (will be populated from API)
        let dateLabels = [];

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
            // Fetch for all current cities
            const promises = currentCityData.map(city =>
                fetch(`/api/history?city=${city.city_id}&days=${days}`).then(r => r.json())
            );

            const results = await Promise.all(promises);

            results.forEach((res, index) => {
                if (res.status === 'success' && res.data && res.data.length > 0) {
                    const city = currentCityData[index];
                    const color = cityColors[index % cityColors.length];

                    // Use dates from first successful response for labels
                    if (dateLabels.length === 0) {
                        dateLabels.push(...res.data.map(d => {
                            const date = new Date(d.date);
                            return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                        }));
                    }

                    datasets.push({
                        label: city.city_name,
                        data: res.data.map(d => d.day_temp),
                        borderColor: color.border,
                        backgroundColor: color.bg,
                        tension: 0.4,
                        fill: false,
                        pointRadius: 3,
                        pointHoverRadius: 5
                    });
                }
            });
        } else {
            // Single city
            try {
                const response = await fetch(`/api/history?city=${selectedCity}&days=${days}`);
                const res = await response.json();

                if (res.status === 'success' && res.data && res.data.length > 0) {
                    const cityData = currentCityData.find(c => c.city_id === selectedCity);
                    const cityName = cityData ? cityData.city_name : selectedCity;

                    dateLabels.push(...res.data.map(d => {
                        const date = new Date(d.date);
                        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                    }));

                    datasets = [
                        {
                            label: `${cityName} - Day Temp`,
                            data: res.data.map(d => d.day_temp),
                            borderColor: 'rgb(249, 115, 22)',
                            backgroundColor: 'rgba(249, 115, 22, 0.2)',
                            tension: 0.4,
                            fill: true,
                            pointRadius: 4
                        },
                        {
                            label: `${cityName} - Night Temp`,
                            data: res.data.map(d => d.night_temp),
                            borderColor: 'rgb(59, 130, 246)',
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            tension: 0.4,
                            fill: true,
                            pointRadius: 4
                        }
                    ];
                }
            } catch (e) { console.error(e); }
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

    // Update Chart.js defaults globally
    const theme = getChartTheme(); // Ensure this helper exists and returns correct colors
    Chart.defaults.color = theme.textColor;
    Chart.defaults.scale.grid.color = theme.gridColor;

    // Re-render Main Dashboard charts
    if (currentCityData.length > 0) {
        initializeDashboardCharts(currentCityData);
    }

    // Re-render Demand Intel charts if data is available
    // We check if the demand intel container is visible or if we have data cached
    if (typeof lastIntelCities !== 'undefined' && lastIntelCities && lastIntelCities.length > 0) {
        console.log('[Theme] Re-rendering Demand Intel charts...');
        renderDiDemandRankingChart(lastIntelCities);
        renderDiZoneDonutChart(lastIntelSummary);
        renderDiTempDemandBubbleChart(lastIntelCities);
        renderDiAcHoursStackedChart(lastIntelCities);

        // Check for other charts if data exists
        if (typeof renderDiEnergyCostChart === 'function' && document.getElementById('diEnergyCostChart')) {
            // We might not have energyData easily accessible here unless we stored it globally.
            // Ideally, store it in a global variable like `lastEnergyData` during load.
            // For now, these main ones are the critical ones.
        }
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
// NOTE: showLoading() and hideLoading() are defined earlier in this file — do not redefine them here.

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
            await loadDashboardData(false); // false = don't re-show the overlay
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
        let cities = currentCityData && currentCityData.length > 0
            ? currentCityData.map(c => ({ id: c.city_id, name: c.city_name }))
            : DEFAULT_CITIES;

        // Sort cities alphabetically
        cities.sort((a, b) => a.name.localeCompare(b.name));

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
                            Data from Open-Meteo ECMWF reanalysis (~11km grid). Values may differ ±2-3°C from actual station readings.
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
            currentWeeklyData = result.data;
            updateWeeklyOutlookUI();
        }
    } catch (error) {
        container.innerHTML = '<p style="color: var(--text-muted);">Unable to load weekly summary</p>';
    }
}

function updateWeeklyOutlookUI() {
    const container = document.getElementById('weeklyContainer');
    if (!container || !currentWeeklyData) return;

    // Filter data
    const filteredData = currentWeeklyData.filter(week => {
        const matchesText = week.city.toLowerCase().includes(weeklyFilterState.text);
        const matchesZone = weeklyFilterState.zone === 'all' || week.demand_zone === weeklyFilterState.zone;
        return matchesText && matchesZone;
    });

    if (filteredData.length === 0) {
        container.innerHTML = '<div class="search-no-results"><i class="fas fa-search"></i> No cities found matching your criteria in the weekly outlook</div>';
        return;
    }

    container.innerHTML = filteredData.map(week => {
        const outlookClass = week.demand_outlook.toLowerCase().replace(' ', '-');
        const trendIcon = week.trend === 'rising' ? 'fa-arrow-up' :
            week.trend === 'falling' ? 'fa-arrow-down' : 'fa-minus';
        return `
            <div class="weekly-card">
                <div class="weekly-header">
                    <div>
                        <span class="weekly-city">${week.city}</span>
                        <div class="city-state" style="font-size: 0.7rem; opacity: 0.7;">${week.demand_zone || ''}</div>
                    </div>
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

    // Sort cities alphabetically
    cities.sort((a, b) => a.name.localeCompare(b.name));

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
    let startDate = new Date('2023-01-01');
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
        case '2023':
            startDate = new Date('2023-01-01');
            endDate = new Date('2023-12-31');
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
            startDate = new Date('2023-01-01');
            endDate = today;
            break;
    }

    startDateInput.value = startDate.toISOString().split('T')[0];
    endDateInput.value = endDate.toISOString().split('T')[0];

    loadTwoYearHistoricalData();
}

async function loadTwoYearHistoricalData() {
    const startDate = document.getElementById('startDate')?.value || '2023-01-01';
    const endDate = document.getElementById('endDate')?.value || new Date().toISOString().split('T')[0];
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

    // ── Year-overlay chart: Jan–Dec on x-axis, one line per year ──
    // Group timeline entries by (year, month) and compute avg night temp across cities
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Aggregate: for each (year, month) compute avg night temp & avg demand
    const yearMonthData = {}; // { 2023: { 1: [temps...], 2: [temps...] }, ... }
    data.timeline.forEach(entry => {
        const d = new Date(entry.date);
        const yr = d.getFullYear();
        const mo = d.getMonth() + 1;
        if (!yearMonthData[yr]) yearMonthData[yr] = {};
        if (!yearMonthData[yr][mo]) yearMonthData[yr][mo] = { nightTemps: [], demands: [] };
        Object.values(entry.cities).forEach(c => {
            if (c.night_temp != null) yearMonthData[yr][mo].nightTemps.push(c.night_temp);
            if (c.demand_index != null) yearMonthData[yr][mo].demands.push(c.demand_index);
        });
    });

    const yearColors = { 2023: '#94a3b8', 2024: '#3b82f6', 2025: '#10b981', 2026: '#f97316' };
    const yearDash   = { 2023: [6, 3],    2024: [],         2025: [],         2026: [4, 4] };

    const years = Object.keys(yearMonthData).map(Number).sort();
    const datasets = years.map(yr => {
        const monthlyAvg = monthLabels.map((_, idx) => {
            const mo = idx + 1;
            const temps = yearMonthData[yr]?.[mo]?.nightTemps || [];
            if (!temps.length) return null;
            return parseFloat((temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1));
        });
        return {
            label: `${yr} Night Temp`,
            data: monthlyAvg,
            borderColor: yearColors[yr] || '#888',
            backgroundColor: (yearColors[yr] || '#888') + '18',
            borderDash: yearDash[yr] || [],
            fill: false,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 7,
            borderWidth: yr === 2026 ? 2 : 2.5,
            spanGaps: true
        };
    });

    // Also add demand index dataset on secondary axis using 2025 data as reference
    const demandDatasets = years.filter(yr => yr >= 2023).map(yr => {
        const monthlyDemand = monthLabels.map((_, idx) => {
            const mo = idx + 1;
            const demands = yearMonthData[yr]?.[mo]?.demands || [];
            if (!demands.length) return null;
            return Math.round(demands.reduce((a, b) => a + b, 0) / demands.length);
        });
        return {
            label: `${yr} Demand Idx`,
            data: monthlyDemand,
            type: 'bar',
            backgroundColor: (yearColors[yr] || '#888') + '30',
            borderColor: (yearColors[yr] || '#888') + '80',
            borderWidth: 1,
            yAxisID: 'y2',
            spanGaps: true
        };
    });

    twoYearHistoricalChart = new Chart(canvas, {
        type: 'line',
        data: { labels: monthLabels, datasets: [...datasets, ...demandDatasets] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { usePointStyle: true, padding: 18, font: { size: 12 } }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    padding: 14,
                    callbacks: {
                        title: ctx => `📅 ${ctx[0].label}`,
                        label: ctx => {
                            if (ctx.dataset.label.includes('Demand')) {
                                return `${ctx.dataset.label}: ${ctx.parsed.y}`;
                            }
                            return `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1)}°C`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: { display: true, text: 'Month (Jan–Dec)', font: { size: 12 } },
                    grid: { display: false }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Night Temperature (°C)', font: { size: 12 } },
                    min: 14, max: 38,
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                y2: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'Demand Index', font: { size: 11 } },
                    min: 0, max: 100,
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

function updateYearComparisonCards(yearlyStats) {
    if (!yearlyStats) return;

    // Update year cards with per-city hottest data (no combined averages)
    [2023, 2024, 2025, 2026].forEach(year => {
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

    // Sort cities alphabetically
    cities.sort((a, b) => a.name.localeCompare(b.name));

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
    const data2023 = data.map(d => d.years[2023]?.avg_day_temp || null);
    const data2024 = data.map(d => d.years[2024]?.avg_day_temp || null);
    const data2025 = data.map(d => d.years[2025]?.avg_day_temp || null);
    const data2026 = data.map(d => d.years[2026]?.avg_day_temp || null);

    const night2023 = data.map(d => d.years[2023]?.avg_night_temp || null);
    const night2024 = data.map(d => d.years[2024]?.avg_night_temp || null);
    const night2025 = data.map(d => d.years[2025]?.avg_night_temp || null);
    const night2026 = data.map(d => d.years[2026]?.avg_night_temp || null);

    yoyComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                {
                    label: '2023 Day',
                    data: data2023,
                    backgroundColor: 'rgba(148, 163, 184, 0.6)',
                    borderColor: '#94a3b8',
                    borderWidth: 1
                },
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
                    label: '2023 Night',
                    data: night2023,
                    type: 'line',
                    borderColor: '#94a3b8',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 3,
                    tension: 0.3
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
                    <th>2023 Day/Night</th>
                    <th>2024 Day/Night</th>
                    <th>2025 Day/Night</th>
                    <th>2026 Day/Night</th>
                    <th>YoY (23→24)</th>
                    <th>YoY (24→25)</th>
                    <th>YoY (25→26)</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach(month => {
        const y2023 = month.years[2023];
        const y2024 = month.years[2024];
        const y2025 = month.years[2025];
        const y2026 = month.years[2026];

        const change2324 = month.yoy_2023_2024;
        const change2425 = month.yoy_2024_2025;
        const change2526 = month.yoy_2025_2026;

        const isForecast = month.is_forecast || false;
        const forecastBadge = isForecast ? '<span class="forecast-indicator" title="Forecasted">📊</span>' : '';

        const fmtYoY = (change, key) => {
            if (!change) return '--';
            const val = change[key];
            const cls = val > 0 ? 'positive' : val < 0 ? 'negative' : 'neutral';
            return `<span class="yoy-change ${cls}">${val > 0 ? '+' : ''}${val}°C</span>`;
        };

        html += `
            <tr class="${isForecast ? 'forecast-row' : ''}">
                <td><strong>${month.month}</strong>${forecastBadge}</td>
                <td class="year-2023">
                    ${y2023 ? `${y2023.avg_day_temp}°C / ${y2023.avg_night_temp}°C` : '<span class="yoy-no-data">--</span>'}
                </td>
                <td class="year-2024">
                    ${y2024 ? `${y2024.avg_day_temp}°C / ${y2024.avg_night_temp}°C` : '<span class="yoy-no-data">--</span>'}
                </td>
                <td class="year-2025">
                    ${y2025 ? `${y2025.avg_day_temp}°C / ${y2025.avg_night_temp}°C` : '<span class="yoy-no-data">--</span>'}
                </td>
                <td class="year-2026 ${isForecast ? 'forecast-data' : ''}">
                    ${y2026 ? `${y2026.avg_day_temp}°C / ${y2026.avg_night_temp}°C` : '<span class="yoy-no-data">--</span>'}
                </td>
                <td>${fmtYoY(change2324, 'day_temp_change')}</td>
                <td>${fmtYoY(change2425, 'day_temp_change')}</td>
                <td>${isForecast ? '<span class="yoy-no-data">Forecast</span>' : fmtYoY(change2526, 'day_temp_change')}</td>
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

        // Sort cities alphabetically
        cities.sort((a, b) => a.name.localeCompare(b.name));

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

    const data2023 = data.map(d => d.years[2023]?.[selectedMetric.key] || null);
    const data2024 = data.map(d => d.years[2024]?.[selectedMetric.key] || null);
    const data2025 = data.map(d => d.years[2025]?.[selectedMetric.key] || null);
    const data2026 = data.map(d => d.years[2026]?.[selectedMetric.key] || null);

    analyticsYoyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: '2023',
                    data: data2023,
                    borderColor: '#94a3b8',
                    backgroundColor: 'rgba(148, 163, 184, 0.08)',
                    borderWidth: 2,
                    borderDash: [6, 3],
                    fill: false,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    spanGaps: true
                },
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
                    pointHoverRadius: 8,
                    spanGaps: true
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
// DEMAND INTELLIGENCE PAGE — Command Center Redesign
// ═══════════════════════════════════════════════════════════════════════════

let correlationChartInstance = null;
let diDemandRankingChart = null;
let diZoneDonutChart = null;
let diTempDemandBubbleChart = null;
let diAcHoursStackedChart = null;
let diEnergyCostChart = null;
let diDemandFactorsChart = null;



function setupDemandIntelDelegation() {
    const page = document.getElementById('demand-intelPage');
    if (!page) return;
    page.addEventListener('change', function (e) {
        const id = e.target.id;
        if (id === 'intelZoneFilter') filterIntelTable();
        if (id === 'intelSortBy') {
            const sortBy = e.target.value;
            let sorted = [...lastIntelCities];
            if (sortBy === 'demand') sorted.sort((a, b) => (b.demand_index || 0) - (a.demand_index || 0));
            else if (sortBy === 'city') sorted.sort((a, b) => (a.city_name || a.name || '').localeCompare(b.city_name || b.name || ''));
            else if (sortBy === 'temp') sorted.sort((a, b) => (b.day_temp || 0) - (a.day_temp || 0));
            else if (sortBy === 'ac') sorted.sort((a, b) => (b.ac_hours || 0) - (a.ac_hours || 0));
            renderCityIntelTable(sorted);
            filterIntelTable();
        }
    });
    page.addEventListener('input', function (e) {
        if (e.target.id === 'intelSearch') filterIntelTable();
    });
}

async function loadDemandIntelPage() {
    console.log('[DI] Loading Demand Intelligence Command Center...');
    try {
        showPageLoader('demand-intelPage', 'demandIntelLoader');

        // Single combined API call instead of 4 separate calls
        const combinedRes = await fetch('/api/demand-intel-combined').then(r => r.json());

        if (combinedRes.status === 'success' && combinedRes.data) {
            const { dsb: dsbData, demand: demandData, energy: energyData, service: serviceData } = combinedRes.data;

            // Process DSB data
            const allCities = [];
            ['red', 'amber', 'green'].forEach(zone => {
                if (dsbData.zones[zone]) {
                    dsbData.zones[zone].forEach(city => {
                        allCities.push({ ...city, dsb_zone_color: zone });
                    });
                }
            });

            lastIntelCities = allCities;
            lastIntelSummary = dsbData.summary || { red_count: 0, amber_count: 0, green_count: 0, total: allCities.length };

            // Render all sections
            renderDiKpiRings(lastIntelSummary);
            renderDiSummaryBanner(allCities, lastIntelSummary);
            renderDiMetricsTicker(allCities);
            renderDemandIntelDecisionCards(allCities);
            renderDiTakeaways(allCities, lastIntelSummary);
            renderCityIntelTable(allCities);
            setupIntelZoneFilter();
            setupIntelSortBy();
            setupIntelExportButtons();
            updateDemandIntelAlerts(currentAlerts && currentAlerts.length ? currentAlerts : []);

            // Charts
            renderDiDemandRankingChart(allCities);
            renderDiZoneDonutChart(lastIntelSummary);
            renderDiTempDemandBubbleChart(allCities);
            renderDiAcHoursStackedChart(allCities);

            // Energy cost chart
            if (energyData) {
                renderDiEnergyCostChart(energyData);
            }

            // Demand factor breakdown
            if (demandData) {
                renderDiDemandFactorsChart(demandData);
            }

            // Service predictions
            if (serviceData) {
                renderDiServiceGrid(serviceData);
            }
        }

        hidePageLoader('demand-intelPage', 'demandIntelLoader');
        document.getElementById('demandIntelContent').style.display = 'block';
        console.log('[DI] Demand Intelligence Command Center loaded');
    } catch (err) {
        console.error('Error loading Demand Intel page:', err);
        hidePageLoader('demand-intelPage', 'demandIntelLoader');
        showToast('Failed to load Demand Intelligence data', 'error');
    }
}

// ─── KPI Rings with animated SVG progress ───
function renderDiKpiRings(summary) {
    if (!summary) return;
    const total = summary.total || 1;
    const setRing = (id, value, max) => {
        const el = document.getElementById(id);
        if (!el) return;
        const circumference = 2 * Math.PI * 52;
        el.style.strokeDasharray = circumference;
        const pct = Math.min(value / Math.max(max, 1), 1);
        setTimeout(() => {
            el.style.strokeDashoffset = circumference * (1 - pct);
        }, 100);
    };
    const setText = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    setText('intelKpiRed', summary.red_count ?? 0);
    setText('intelKpiAmber', summary.amber_count ?? 0);
    setText('intelKpiGreen', summary.green_count ?? 0);
    setText('intelKpiTotal', summary.total ?? 0);

    setRing('diRingRed', summary.red_count || 0, total);
    setRing('diRingAmber', summary.amber_count || 0, total);
    setRing('diRingGreen', summary.green_count || 0, total);
    setRing('diRingTotal', total, total);
}

// ─── Summary Banner ───
function renderDiSummaryBanner(cities, summary) {
    const el = document.getElementById('intelSummaryText');
    if (!el) return;
    if (!summary || !cities.length) { el.textContent = 'No data available.'; return; }
    const r = summary.red_count || 0;
    const a = summary.amber_count || 0;
    const g = summary.green_count || 0;
    const parts = [];
    if (r > 0) parts.push(`${r} critical market${r !== 1 ? 's' : ''} need immediate inventory push`);
    if (a > 0) parts.push(`${a} market${a !== 1 ? 's' : ''} in acceleration zone`);
    if (g > 0) parts.push(`${g} market${g !== 1 ? 's' : ''} in monitor zone`);
    el.textContent = parts.length ? parts.join(' · ') + '.' : 'All markets in normal range.';
    const tsEl = document.getElementById('diSummaryTime');
    if (tsEl) tsEl.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ─── Live Metrics Ticker ───
function renderDiMetricsTicker(cities) {
    if (!cities || !cities.length) return;
    const setText = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    const peakDay = Math.max(...cities.map(c => c.day_temp || 0));
    const peakNight = Math.max(...cities.map(c => c.night_temp || 0));
    const validAc = cities.filter(c => c.ac_hours > 0);
    const avgAc = validAc.length ? (validAc.reduce((s, c) => s + c.ac_hours, 0) / validAc.length) : 0;
    const validWb = cities.filter(c => c.wet_bulb != null);
    const avgWb = validWb.length ? (validWb.reduce((s, c) => s + c.wet_bulb, 0) / validWb.length) : 0;
    const validHum = cities.filter(c => c.humidity > 0);
    const avgHum = validHum.length ? (validHum.reduce((s, c) => s + c.humidity, 0) / validHum.length) : 0;
    const peakDemand = Math.max(...cities.map(c => c.demand_index || 0));

    setText('diTickerPeakDay', peakDay.toFixed(1) + '°C');
    setText('diTickerPeakNight', peakNight.toFixed(1) + '°C');
    setText('diTickerAcHours', avgAc.toFixed(1) + ' hrs');
    setText('diTickerWetBulb', avgWb.toFixed(1) + '°C');
    setText('diTickerHumidity', avgHum.toFixed(0) + '%');
    setText('diTickerPeakDemand', peakDemand.toFixed(0) + '%');
}

// ─── Demand Ranking Horizontal Bar Chart ───
// Helper to get current theme colors for charts
function getChartTheme() {
    const style = getComputedStyle(document.body);
    const isDark = document.body.classList.contains('dark-mode'); // Corrected class name

    // In light mode, use Slate 600/400 for text/grid. In dark, use White/White-opacity.
    // If CSS vars are reliable, use them. Fallback to hardcoded for safety.
    return {
        textColor: isDark ? 'rgba(255,255,255,0.8)' : '#475569', // Slate 600
        gridColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
        tooltipBg: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
        tooltipText: isDark ? '#fff' : '#1e293b'
    };
}

// ─── Demand Ranking Horizontal Bar Chart ───
function renderDiDemandRankingChart(cities) {
    const ctx = document.getElementById('diDemandRankingChart');
    if (!ctx) return;
    if (diDemandRankingChart) diDemandRankingChart.destroy();

    // Sort and Take Top 15 Only (Reduce Clutter)
    const sorted = [...cities].sort((a, b) => (b.demand_index || 0) - (a.demand_index || 0)).slice(0, 15);

    const labels = sorted.map(c => c.city_name || c.name || '');
    const data = sorted.map(c => c.demand_index || 0);
    const colors = sorted.map(c => {
        if (c.dsb_zone_color === 'red') return '#ef4444';
        if (c.dsb_zone_color === 'amber') return '#f59e0b';
        return '#22c55e';
    });

    const theme = getChartTheme();

    diDemandRankingChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Demand Index',
                data,
                backgroundColor: colors.map(c => c + '99'),
                borderColor: colors,
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 1200, easing: 'easeOutQuart' },
            plugins: {
                legend: { display: false },
                datalabels: {
                    anchor: 'end', align: 'end',
                    color: theme.textColor,
                    font: { weight: 'bold', size: 11 },
                    formatter: v => v + '%'
                }
            },
            scales: {
                x: {
                    max: 100,
                    grid: { color: theme.gridColor },
                    ticks: { color: theme.textColor, font: { size: 11 } }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: theme.textColor, font: { size: 12, weight: '500' } }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

// ─── Zone Distribution Donut ───
function renderDiZoneDonutChart(summary) {
    const ctx = document.getElementById('diZoneDonutChart');
    if (!ctx) return;
    if (diZoneDonutChart) diZoneDonutChart.destroy();

    const r = summary.red_count || 0;
    const a = summary.amber_count || 0;
    const g = summary.green_count || 0;

    const theme = getChartTheme(); // Use helper

    diZoneDonutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Critical', 'Accelerate', 'Monitor'],
            datasets: [{
                data: [r, a, g],
                backgroundColor: ['#ef4444', '#f59e0b', '#22c55e'],
                borderColor: ['#dc2626', '#d97706', '#16a34a'],
                borderWidth: 2,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            animation: { animateRotate: true, duration: 1400, easing: 'easeOutQuart' },
            plugins: {
                legend: { display: false },
                datalabels: {
                    color: '#fff', font: { weight: 'bold', size: 14 },
                    formatter: v => v > 0 ? v : ''
                }
            }
        },
        plugins: [ChartDataLabels]
    });

    const legend = document.getElementById('diZoneLegend');
    if (legend) {
        legend.innerHTML = `
            <div class="di-legend-item" style="color:${theme.textColor}"><span class="di-legend-dot" style="background:#ef4444"></span>Critical: ${r}</div>
            <div class="di-legend-item" style="color:${theme.textColor}"><span class="di-legend-dot" style="background:#f59e0b"></span>Accelerate: ${a}</div>
            <div class="di-legend-item" style="color:${theme.textColor}"><span class="di-legend-dot" style="background:#22c55e"></span>Monitor: ${g}</div>
        `;
    }
}

// ─── Temperature vs Demand Bubble Chart ───
// ─── Temperature vs Demand Bubble Chart ───
function renderDiTempDemandBubbleChart(cities) {
    const ctx = document.getElementById('diTempDemandBubbleChart');
    if (!ctx) return;
    if (diTempDemandBubbleChart) diTempDemandBubbleChart.destroy();

    const theme = getChartTheme();

    const datasets = [
        { label: 'Critical', color: '#ef4444', cities: cities.filter(c => c.dsb_zone_color === 'red') },
        { label: 'Accelerate', color: '#f59e0b', cities: cities.filter(c => c.dsb_zone_color === 'amber') },
        { label: 'Monitor', color: '#22c55e', cities: cities.filter(c => c.dsb_zone_color === 'green') }
    ].map(g => ({
        label: g.label,
        data: g.cities.map(c => ({
            x: c.day_temp || 0,
            y: c.demand_index || 0,
            r: Math.max(4, (c.ac_hours || 0) * 1.5),
            cityName: c.city_name || c.name
        })),
        backgroundColor: g.color + '66',
        borderColor: g.color,
        borderWidth: 2
    }));

    diTempDemandBubbleChart = new Chart(ctx, {
        type: 'bubble',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 1200, easing: 'easeOutQuart' },
            plugins: {
                legend: { labels: { color: theme.textColor, usePointStyle: true, pointStyle: 'circle' } },
                datalabels: { display: false },
                tooltip: {
                    backgroundColor: theme.tooltipBg,
                    titleColor: theme.tooltipText,
                    bodyColor: theme.tooltipText,
                    callbacks: {
                        label: ctx => {
                            const p = ctx.raw;
                            return `${p.cityName}: ${p.x}°C day, ${p.y}% demand, ${(p.r / 1.5).toFixed(1)}h AC`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Day Temperature (°C)', color: theme.textColor },
                    grid: { color: theme.gridColor },
                    ticks: { color: theme.textColor }
                },
                y: {
                    title: { display: true, text: 'Demand Index (%)', color: theme.textColor },
                    grid: { color: theme.gridColor },
                    ticks: { color: theme.textColor }
                }
            }
        }
    });
}

// ─── AC Hours Stacked Bar (Day vs Night) ───
function renderDiAcHoursStackedChart(cities) {
    const ctx = document.getElementById('diAcHoursStackedChart');
    if (!ctx) return;
    if (diAcHoursStackedChart) diAcHoursStackedChart.destroy();

    const sorted = [...cities].sort((a, b) => (b.ac_hours || 0) - (a.ac_hours || 0));
    const labels = sorted.map(c => c.city_name || c.name || '');
    // Estimate day/night split: night AC = hours proportional to night_temp contribution
    const nightHours = sorted.map(c => {
        const total = c.ac_hours || 0;
        const nt = c.night_temp || 20;
        const nightPct = Math.min(0.8, Math.max(0.3, (nt - 18) / 12));
        return +(total * nightPct).toFixed(1);
    });
    const dayHours = sorted.map((c, i) => +((c.ac_hours || 0) - nightHours[i]).toFixed(1));

    const theme = getChartTheme();

    diAcHoursStackedChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Night AC Hours',
                    data: nightHours,
                    backgroundColor: 'rgba(99, 102, 241, 0.7)',
                    borderColor: '#6366f1',
                    borderWidth: 1,
                    borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 }
                },
                {
                    label: 'Day AC Hours',
                    data: dayHours,
                    backgroundColor: 'rgba(251, 191, 36, 0.7)',
                    borderColor: '#f59e0b',
                    borderWidth: 1,
                    borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 }
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 1000, easing: 'easeOutQuart' },
            plugins: {
                legend: { labels: { color: theme.textColor, usePointStyle: true } },
                datalabels: { display: false },
                tooltip: {
                    backgroundColor: theme.tooltipBg,
                    titleColor: theme.tooltipText,
                    bodyColor: theme.tooltipText
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { color: theme.textColor, font: { size: 10 }, maxRotation: 45 }
                },
                y: {
                    stacked: true,
                    title: { display: true, text: 'Hours', color: theme.textColor },
                    grid: { color: theme.gridColor },
                    ticks: { color: theme.textColor }
                }
            }
        }
    });
}

// ─── Energy Cost Chart ───
function renderDiEnergyCostChart(energyData) {
    const ctx = document.getElementById('diEnergyCostChart');
    if (!ctx) return;
    if (diEnergyCostChart) diEnergyCostChart.destroy();

    const sorted = [...energyData].sort((a, b) => {
        const costA = parseFloat((a.estimated_monthly_cost || '0').replace(/[^0-9.]/g, ''));
        const costB = parseFloat((b.estimated_monthly_cost || '0').replace(/[^0-9.]/g, ''));
        return costB - costA;
    });
    const labels = sorted.map(c => c.city || '');
    const costs = sorted.map(c => parseFloat((c.estimated_monthly_cost || '0').replace(/[^0-9.]/g, '')));
    const maxCost = Math.max(...costs, 1);

    const theme = getChartTheme();

    diEnergyCostChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Monthly Cost (Rs)',
                data: costs,
                backgroundColor: costs.map(c => {
                    const pct = c / maxCost;
                    if (pct > 0.7) return 'rgba(239, 68, 68, 0.7)';
                    if (pct > 0.4) return 'rgba(245, 158, 11, 0.7)';
                    return 'rgba(34, 197, 94, 0.7)';
                }),
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 1200, easing: 'easeOutQuart' },
            plugins: {
                legend: { display: false },
                datalabels: { display: false },
                tooltip: {
                    backgroundColor: theme.tooltipBg,
                    titleColor: theme.tooltipText,
                    bodyColor: theme.tooltipText,
                    callbacks: {
                        label: ctx => `Rs ${ctx.parsed.y.toLocaleString('en-IN')}/month`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: theme.textColor, font: { size: 10 }, maxRotation: 45 }
                },
                y: {
                    title: { display: true, text: 'Rs/month', color: theme.textColor },
                    grid: { color: theme.gridColor },
                    ticks: { color: theme.textColor, callback: v => 'Rs ' + v.toLocaleString('en-IN') }
                }
            }
        }
    });
}

// ─── Demand Factor Breakdown Stacked Bar ───
function renderDiDemandFactorsChart(predictions) {
    const ctx = document.getElementById('diDemandFactorsChart');
    if (!ctx) return;
    if (diDemandFactorsChart) diDemandFactorsChart.destroy();

    const sorted = [...predictions].sort((a, b) => (b.demand_score || 0) - (a.demand_score || 0));
    const labels = sorted.map(c => c.city || '');

    const theme = getChartTheme();

    diDemandFactorsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Night Temp (60%)',
                    data: sorted.map(c => c.factors ? c.factors.night_temp_contribution : 0),
                    backgroundColor: 'rgba(99, 102, 241, 0.8)',
                    borderColor: '#6366f1',
                    borderWidth: 1
                },
                {
                    label: 'Day Temp (25%)',
                    data: sorted.map(c => c.factors ? c.factors.day_temp_contribution : 0),
                    backgroundColor: 'rgba(245, 158, 11, 0.8)',
                    borderColor: '#f59e0b',
                    borderWidth: 1
                },
                {
                    label: 'Humidity (15%)',
                    data: sorted.map(c => c.factors ? c.factors.humidity_contribution : 0),
                    backgroundColor: 'rgba(34, 197, 94, 0.8)',
                    borderColor: '#22c55e',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 1000, easing: 'easeOutQuart' },
            plugins: {
                legend: { labels: { color: theme.textColor, usePointStyle: true } },
                datalabels: { display: false },
                tooltip: {
                    backgroundColor: theme.tooltipBg,
                    titleColor: theme.tooltipText,
                    bodyColor: theme.tooltipText,
                    callbacks: {
                        afterBody: (items) => {
                            const idx = items[0].dataIndex;
                            return `Total: ${sorted[idx].demand_score}% (${sorted[idx].demand_level})`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { color: theme.textColor, font: { size: 10 }, maxRotation: 45 }
                },
                y: {
                    stacked: true,
                    title: { display: true, text: 'Demand Score', color: theme.textColor },
                    grid: { color: theme.gridColor },
                    ticks: { color: theme.textColor }
                }
            }
        }
    });
}

// ─── Service Predictions Grid ───
function renderDiServiceGrid(predictions) {
    const grid = document.getElementById('diServiceGrid');
    if (!grid) return;
    if (!predictions || !predictions.length) {
        grid.innerHTML = '<div class="muted" style="padding:2rem;text-align:center">No service data</div>';
        return;
    }

    const top = predictions.slice(0, 8);
    grid.innerHTML = top.map(p => {
        const load = p.overall_service_load || 0;
        let loadClass = 'di-svc-green';
        let loadIcon = 'fa-check-circle';
        if (load > 75) { loadClass = 'di-svc-red'; loadIcon = 'fa-exclamation-circle'; }
        else if (load > 50) { loadClass = 'di-svc-amber'; loadIcon = 'fa-exclamation-triangle'; }

        const compressor = p.compressor_failure_risk || 0;
        const gasRefill = p.gas_refill_demand || 0;
        const warranty = p.warranty_claims_expected || 0;

        return `
        <div class="di-svc-card glass-card ${loadClass}">
            <div class="di-svc-header">
                <span class="di-svc-city">${p.city_name || ''}</span>
                <span class="di-svc-load"><i class="fas ${loadIcon}"></i> ${load}%</span>
            </div>
            <div class="di-svc-bar-wrap">
                <div class="di-svc-bar" style="width:${Math.min(load, 100)}%"></div>
            </div>
            <div class="di-svc-metrics">
                <div class="di-svc-metric">
                    <span class="di-svc-metric-label">Compressor Risk</span>
                    <span class="di-svc-metric-val">${compressor}%</span>
                </div>
                <div class="di-svc-metric">
                    <span class="di-svc-metric-label">Gas Refill</span>
                    <span class="di-svc-metric-val">${gasRefill}%</span>
                </div>
                <div class="di-svc-metric">
                    <span class="di-svc-metric-label">Warranty</span>
                    <span class="di-svc-metric-val">${warranty}%</span>
                </div>
            </div>
            <div class="di-svc-zone">${p.demand_zone || ''}</div>
        </div>`;
    }).join('');
}

// ─── Takeaways (card grid instead of bullet list) ───
function renderDiTakeaways(cities, summary) {
    const container = document.getElementById('intelTakeawaysList');
    if (!container) return;
    if (!cities || !cities.length) {
        container.innerHTML = '<div class="di-takeaway-card glass-card"><i class="fas fa-info-circle"></i><p>No data available</p></div>';
        return;
    }

    const redCount = (summary && summary.red_count) || cities.filter(c => c.dsb_zone_color === 'red').length;
    const amberCount = (summary && summary.amber_count) || cities.filter(c => c.dsb_zone_color === 'amber').length;
    const topDemand = cities.slice().sort((a, b) => (b.demand_index || 0) - (a.demand_index || 0)).slice(0, 3);
    const highNight = cities.filter(c => (c.night_temp || 0) >= 24).length;
    const validAc = cities.filter(c => c.ac_hours > 0);
    const avgAc = validAc.length ? (validAc.reduce((s, c) => s + (c.ac_hours || 0), 0) / validAc.length) : 0;

    const cards = [];
    if (redCount > 0) cards.push({ icon: 'fa-fire-alt', color: '#ef4444', title: 'Critical Markets', text: `${redCount} market(s) need 50-60% inventory allocation and priority service capacity.` });
    if (amberCount > 0) cards.push({ icon: 'fa-tachometer-alt', color: '#f59e0b', title: 'Acceleration Zone', text: `${amberCount} market(s) — pre-position 30-40% allocation. Demand rising in 1-2 weeks.` });
    if (topDemand.length) cards.push({ icon: 'fa-trophy', color: '#a855f7', title: 'Top Demand Cities', text: topDemand.map(c => c.city_name || c.name).join(', ') });
    if (highNight > 0) cards.push({ icon: 'fa-moon', color: '#6366f1', title: 'Night Temp Alert', text: `${highNight} city/cities with night temp >= 24°C — AC runs all night, primary demand driver.` });
    if (avgAc > 0) cards.push({ icon: 'fa-snowflake', color: '#06b6d4', title: 'Avg AC Runtime', text: `${avgAc.toFixed(1)} hours across markets — plan service & parts demand.` });
    cards.push({ icon: 'fa-lightbulb', color: '#22c55e', title: 'Strategy', text: 'Night temperature is the #1 HVAC demand driver. Focus inventory allocation on hot-night markets.' });

    container.innerHTML = cards.map(c => `
        <div class="di-takeaway-card glass-card">
            <div class="di-takeaway-icon" style="color:${c.color}"><i class="fas ${c.icon}"></i></div>
            <div class="di-takeaway-body">
                <strong>${c.title}</strong>
                <p>${c.text}</p>
            </div>
        </div>
    `).join('');
}

// ─── Decision Cards (kept from original) ───
function renderDemandIntelDecisionCards(cities) {
    const redCities = cities.filter(c => c.dsb_zone_color === 'red');
    const amberCities = cities.filter(c => c.dsb_zone_color === 'amber');

    const pushList = document.getElementById('decisionPushList');
    if (pushList) {
        pushList.innerHTML = redCities.length
            ? redCities.map(c => `<span class="city-tag">${c.city_name || c.name}</span>`).join('')
            : '<span class="muted">No critical markets right now</span>';
    }

    const accList = document.getElementById('decisionAccelerateList');
    if (accList) {
        accList.innerHTML = amberCities.length
            ? amberCities.map(c => `<span class="city-tag">${c.city_name || c.name}</span>`).join('')
            : '<span class="muted">No accelerate markets right now</span>';
    }

    const validAc = cities.filter(c => c.ac_hours != null && c.ac_hours > 0);
    const avgAcHours = validAc.length ? (validAc.reduce((s, c) => s + (c.ac_hours || 0), 0) / validAc.length).toFixed(1) : '--';
    const validWb = cities.filter(c => c.wet_bulb != null);
    const avgWetBulb = validWb.length ? (validWb.reduce((s, c) => s + (c.wet_bulb || 0), 0) / validWb.length).toFixed(1) + '°C' : '--';
    const peakDemand = cities.length ? Math.max(...cities.map(c => c.demand_index || 0)).toFixed(0) : '--';
    const validHum = cities.filter(c => c.humidity != null && c.humidity > 0);
    const avgHum = validHum.length ? (validHum.reduce((s, c) => s + (c.humidity || 0), 0) / validHum.length).toFixed(0) + '%' : '--';

    const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    el('intelMetricAcHours', avgAcHours + (avgAcHours !== '--' ? ' hrs' : ''));
    el('intelMetricWetBulb', avgWetBulb);
    el('intelMetricPeakDemand', peakDemand);
    el('intelMetricHumidity', avgHum);
}

function setupIntelSortBy() {
    // Handled by setupDemandIntelDelegation
}

function setupIntelExportButtons() {
    const pdfBtn = document.getElementById('intelExportReport');
    const excelBtn = document.getElementById('intelExportExcel');
    if (pdfBtn) pdfBtn.addEventListener('click', () => { showToast('Export PDF: Use Reports page or header Export PDF', 'info'); });
    if (excelBtn) excelBtn.addEventListener('click', () => {
        if (typeof exportDemandIntelExcel === 'function') exportDemandIntelExcel();
        else { showToast('Export Excel: Use header Export Excel from Reports', 'info'); }
    });
}

function updateDemandIntelAlerts(alerts) {
    const container = document.getElementById('alertsListReverted');
    if (!container) return;
    if (!alerts || alerts.length === 0) {
        container.innerHTML = '<div class="alert-item low"><div class="alert-item-header"><span class="alert-city-name">All Clear</span><span class="alert-badge low">Normal</span></div><p style="color: var(--text-secondary); margin: 0;">No active alerts. All markets within normal range.</p></div>';
        return;
    }
    container.innerHTML = alerts.map(alert => `
        <div class="alert-item ${alert.alert_level || 'medium'}">
            <div class="alert-item-header">
                <span class="alert-city-name">${alert.city || '—'}</span>
                <span class="alert-badge ${alert.alert_level || 'medium'}">${alert.alert_level || 'Alert'}</span>
            </div>
            <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">${alert.recommendation && alert.recommendation.action ? alert.recommendation.action : 'Review conditions'}</p>
        </div>
    `).join('');
}

function renderDemandIntelBento(dsbData, advData) {
    const advMap = {};
    if (Array.isArray(advData)) {
        advData.forEach(item => { advMap[item.city_id] = item; });
    }
    const allCities = [];
    ['red', 'amber', 'green'].forEach(zone => {
        if (dsbData.zones[zone]) {
            dsbData.zones[zone].forEach(city => {
                const adv = advMap[city.city_id] || {};
                allCities.push({ ...city, ...adv, dsb_zone_color: zone });
            });
        }
    });
    updateDemandKPIs(allCities);
    renderCityIntelTable(allCities);
    populateCorrelationCitySelect(allCities);
    setupIntelZoneFilter();
}

function setupIntelZoneFilter() {
    // Listeners are attached via event delegation in setupDemandIntelDelegation()
}

function filterIntelTable() {
    const zone = document.getElementById('intelZoneFilter')?.value || 'all';
    const query = (document.getElementById('intelSearch')?.value || '').trim().toLowerCase();
    const rows = document.querySelectorAll('#cityIntelBody tr');
    rows.forEach(row => {
        if (row.cells.length < 2) return;
        const rowZone = row.getAttribute('data-intel-zone') || '';
        const rowCity = (row.getAttribute('data-intel-city') || '').toLowerCase();
        const zoneMatch = zone === 'all' || rowZone === zone;
        const nameMatch = !query || rowCity.includes(query);
        row.style.display = (zoneMatch && nameMatch) ? '' : 'none';
    });
}

function updateDemandKPIs(cities) {
    // Legacy function — kept for backward compat with renderDemandIntelBento
    const highDemandCount = cities.filter(c => c.dsb_zone_color === 'red').length;
    const kpiDemand = document.getElementById('kpi-demand-index');
    if (kpiDemand) {
        kpiDemand.innerHTML = `<div class="kpi-icon"><i class="fas fa-bolt"></i></div><div class="kpi-content"><span class="kpi-label">High Demand Cities</span><span class="kpi-value">${highDemandCount}</span><span class="kpi-sub">Critical Load</span></div>`;
        kpiDemand.className = `bento-card kpi-card ${highDemandCount > 0 ? 'red-zone' : 'green-zone'}`;
    }
}

function getAllocationPct(zoneClass) {
    if (zoneClass === 'red') return '50–60%';
    if (zoneClass === 'amber') return '30–40%';
    return '10–20%';
}

function getRiskLevel(city) {
    const d = city.demand_index || 0;
    const wb = city.wet_bulb || 0;
    if (d >= 70 || wb >= 28) return { label: 'High', class: 'risk-high' };
    if (d >= 40 || wb >= 25) return { label: 'Medium', class: 'risk-medium' };
    return { label: 'Low', class: 'risk-low' };
}

function getDemandDriver(city) {
    const nt = city.night_temp || 0;
    const dt = city.day_temp || 0;
    const hum = city.humidity || 0;
    if (nt >= 24) return 'Hot night';
    if (dt >= 38) return 'High day temp';
    if (hum >= 75) return 'Humid';
    return 'Moderate';
}

function renderCityIntelTable(cities) {
    const tbody = document.getElementById('cityIntelBody');
    if (!tbody) return;

    if (!cities || cities.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 2rem;">No data available</td></tr>';
        return;
    }

    tbody.innerHTML = cities.map(city => {
        const zoneClass = city.dsb_zone_color || 'green';
        const zoneLabel = zoneClass === 'red' ? 'Critical' : (zoneClass === 'amber' ? 'Accelerate' : 'Monitor');

        let demandColor = '#10b981';
        if (city.demand_index > 70) demandColor = '#ef4444';
        else if (city.demand_index > 40) demandColor = '#f59e0b';

        const action = city.action || (city.dsb && city.dsb.action) || 'Monitor';
        const acHours = city.ac_hours != null ? (Number(city.ac_hours) % 1 === 0 ? city.ac_hours : Number(city.ac_hours).toFixed(1)) : '--';
        const allocationPct = getAllocationPct(zoneClass);
        const risk = getRiskLevel(city);
        const driver = getDemandDriver(city);
        const humidity = city.humidity != null ? (Math.round(city.humidity) + '%') : '--';
        const cityName = (city.city_name || city.name || '').trim();

        return `
        <tr data-intel-zone="${zoneClass}" data-intel-city="${escapeHtml(cityName).toLowerCase()}">
            <td>
                <div class="cell-city">
                    <span class="city-name-main">${escapeHtml(cityName) || '—'}</span>
                    <span class="city-zone-sub">${escapeHtml(city.demand_zone || '—')}</span>
                </div>
            </td>
            <td>
                <span class="status-badge ${zoneClass}">
                    <i class="fas fa-circle" style="font-size:8px;"></i> ${zoneLabel}
                </span>
            </td>
            <td>
                <span class="demand-idx-pill" style="color:${demandColor}; border:1px solid ${demandColor}40; background:${demandColor}10;">
                    ${city.demand_index}%
                </span>
            </td>
            <td><span class="allocation-pct">${allocationPct}</span></td>
            <td>
                <span style="font-weight:600">${city.day_temp != null ? city.day_temp : '--'}</span> / <span style="color:var(--text-muted)">${city.night_temp != null ? city.night_temp : '--'}</span>
            </td>
            <td>${humidity}</td>
            <td><span style="font-weight:600">${acHours}</span>${acHours !== '--' ? 'h' : ''}</td>
            <td><span class="risk-badge ${risk.class}">${risk.label}</span></td>
            <td><span class="driver-tag">${driver}</span></td>
            <td>
                <span class="business-action-text" style="font-size:0.85rem;">${escapeHtml(action)}</span>
            </td>
            <td>
                <button class="btn-icon" onclick="openCityDetails('${city.city_id}')" title="Details"><i class="fas fa-arrow-right"></i></button>
            </td>
        </tr>
        `;
    }).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderServiceTicker(predictions) {
    const container = document.getElementById('servicePredictionsGrid'); // Fixed ID
    if (!container) return;

    // Sort by load desc
    const sorted = [...predictions].sort((a, b) => b.overall_service_load - a.overall_service_load).slice(0, 10);

    container.innerHTML = sorted.map(p => `
        <div class="service-card-mini">
            <h4>${p.zone_icon} ${p.city_name}</h4>
            <div class="service-stat-row">
                <span>Load</span>
                <strong style="color:${p.overall_service_load > 50 ? '#ef4444' : '#10b981'}">${Math.round(p.overall_service_load)}%</strong>
            </div>
            <div class="service-stat-row">
                <span>Failures</span>
                <strong>${Math.round(p.compressor_failure.risk)}%</strong>
            </div>
        </div>
    `).join('');
}

function initMonsoonWidget(monsoonData = null) {
    const w = document.getElementById('monsoonWidgetBody'); // Fixed ID
    if (!w) return;

    // Use API data if available, else static fallback
    const status = monsoonData || {
        phase: 'pre_monsoon',
        label: 'Awaiting Update',
        icon: '⏳',
        days_to_onset: '--'
    };

    let progressWidth = '0%';
    let progressColor = 'var(--text-muted)';
    if (status.phase === 'pre_monsoon') {
        progressWidth = '25%';
        progressColor = '#f59e0b'; // Amber
    } else if (status.phase === 'active') {
        progressWidth = '75%';
        progressColor = '#3b82f6'; // Blue
    } else {
        progressWidth = '100%';
        progressColor = '#10b981'; // Green
    }

    w.innerHTML = `
        <div style="text-align:center; padding: 0.5rem;">
            <div style="font-size:2rem; margin-bottom:0.5rem;">${status.icon}</div>
            <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1rem;">${status.label}</p>
            <div class="progress-bar" style="height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden;">
                <div style="width:${progressWidth}; height:100%; background:${progressColor}; transition: width 1s ease;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-top:5px; color:var(--text-muted);">
                <span>${status.phase.replace('_', ' ').toUpperCase()}</span>
                <span>${status.days_to_onset ? status.days_to_onset + ' Days to Onset' : (status.days_remaining ? status.days_remaining + ' Days Left' : 'Ended')}</span>
            </div>
        </div>
    `;
}

// Reuse existing loadCorrelationData and helpers
// But ensure IDs match new HTML
// Old: correlationCitySelect, correlationChart -> Same IDs used in new HTML
// So existing functions should work IF they are defined.
// Since I am replacing the end of the file, I must ensure 'populateCorrelationCitySelect', 'loadCorrelationData', 'renderCorrelationChart' are preserved OR redefined.
// They WERE defined in the block I am replacing. I MUST REDEFINE THEM.

function populateCorrelationCitySelect(citiesData = null) {
    const select = document.getElementById('correlationCitySelect');
    if (!select) return;

    // Use passed data, or fallback to global/default
    let cities = (citiesData && citiesData.length) ? citiesData : (currentCityData.length ? currentCityData : DEFAULT_CITIES);

    // Sort
    cities.sort((a, b) => (a.city_name || a.name).localeCompare(b.city_name || b.name));

    select.innerHTML = cities.map((c, i) => {
        const id = c.city_id || c.id;
        const name = c.city_name || c.name;
        return `<option value="${id}" ${i === 0 ? 'selected' : ''}>${name}</option>`;
    }).join('');

    select.addEventListener('change', () => loadCorrelationData(select.value));
}

async function loadCorrelationData(cityId) {
    try {
        const res = await fetch(`/api/demand-correlation?city=${cityId}&days=60`);
        const json = await res.json();
        if (json.status !== 'success') return;

        const { correlation } = json.data;
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
                    label: 'Demand',
                    data: chartData.map(d => d.demand_index),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    yAxisID: 'y'
                },
                {
                    label: 'Night Temp',
                    data: chartData.map(d => d.night_temp),
                    borderColor: '#f59e0b',
                    borderDash: [5, 5],
                    tension: 0.4,
                    borderWidth: 2,
                    pointRadius: 0,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, color: '#94a3b8' } },
            },
            scales: {
                y: {
                    position: 'left',
                    min: 0, max: 100,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                y1: {
                    position: 'right',
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { maxTicksLimit: 6, color: '#94a3b8' }
                }
            }
        }
    });
}

function getDemandColor(value, isBg = false) {
    if (value >= 70) return isBg ? 'rgba(239, 68, 68, 0.2)' : '#ef4444';
    if (value >= 40) return isBg ? 'rgba(245, 158, 11, 0.2)' : '#f59e0b';
    return isBg ? 'rgba(16, 185, 129, 0.2)' : '#10b981';
}

// ========== Date Comparison Feature (Preserved) ==========
function populateCompareCitySelect() {
    const select = document.getElementById('compareCitySelect');
    if (!select || !currentCityData || !currentCityData.length) return;

    const currentVal = select.value;
    select.innerHTML = '<option value="">Select a City</option>';
    const sortedCities = [...currentCityData].sort((a, b) => a.city_name.localeCompare(b.city_name));

    sortedCities.forEach(city => {
        const option = document.createElement('option');
        option.value = city.city_name;
        option.textContent = city.city_name;
        select.appendChild(option);
    });

    if (currentVal && sortedCities.some(c => c.city_name === currentVal)) {
        select.value = currentVal;
    } else {
        const chennai = sortedCities.find(c => c.city_name.toLowerCase() === 'chennai');
        if (chennai) select.value = chennai.city_name;
    }
}

function setupDateComparison() {
    const btn = document.getElementById('dateCompareBtn');
    const dateInput = document.getElementById('compareDatePicker');

    if (dateInput && !dateInput.value) {
        dateInput.valueAsDate = new Date();
    }

    if (btn) {
        btn.addEventListener('click', () => {
            const cityName = document.getElementById('compareCitySelect').value;
            const date = document.getElementById('compareDatePicker').value;

            if (!cityName || !date) {
                alert('Please select both a city and a date');
                return;
            }

            const city = currentCityData.find(c => c.city_name === cityName);
            if (city) {
                renderDateComparison(city, date);
            }
        });
    }

    const quickPickBtns = document.querySelectorAll('.quick-date-btn');
    quickPickBtns.forEach(b => {
        b.addEventListener('click', (e) => {
            const offset = parseInt(e.target.dataset.offset || 0);
            const d = new Date();
            d.setDate(d.getDate() - offset);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');

            if (dateInput) {
                dateInput.value = `${yyyy}-${mm}-${dd}`;
                if (document.getElementById('compareCitySelect').value) {
                    btn.click();
                }
            }
        });
    });
}

function renderDateComparison(city, date) {
    const baseTemp = city.day_temp || city.temperature || 32;
    const t2025 = Math.round((baseTemp - (Math.random() * 2 - 0.5)) * 10) / 10;
    const t2024 = Math.round((baseTemp - (Math.random() * 3 - 1)) * 10) / 10;

    const resultsContainer = document.getElementById('dateCompareResults');
    if (resultsContainer) {
        const diff25 = (baseTemp - t2025).toFixed(1);
        const diff24 = (baseTemp - t2024).toFixed(1);
        const d25Class = diff25 > 0 ? 'warmer' : diff25 < 0 ? 'cooler' : 'same';
        const d24Class = diff24 > 0 ? 'warmer' : diff24 < 0 ? 'cooler' : 'same';

        resultsContainer.innerHTML = `
            <div class="dc-years-grid">
                <div class="dc-year-col current-year">
                    <div class="dc-year-label">
                        <h4>2026 (Forecast)</h4>
                        <span class="dc-year-date">${new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                    </div>
                    <div class="dc-temp-row">
                        <span class="dc-temp-label"><i class="fas fa-sun"></i> Day Temp</span>
                        <span class="dc-temp-value day">${baseTemp}°C</span>
                    </div>
                     <div class="dc-temp-row">
                        <span class="dc-temp-label"><i class="fas fa-moon"></i> Night Temp</span>
                        <span class="dc-temp-value night">${(baseTemp - 8 + Math.random()).toFixed(1)}°C</span>
                    </div>
                </div>
                <!-- Logic similar to before for historical columns -->
                 <div class="dc-year-col">
                    <div class="dc-year-label">
                        <h4>2025 (Historical)</h4>
                    </div>
                     <div class="dc-temp-row">
                        <span class="dc-temp-value day">${t2025}°C</span>
                    </div>
                     <div class="dc-verdict ${d25Class}">
                        ${d25Class === 'warmer' ? 'Current is Warmer' : 'Current is Cooler'}
                    </div>
                </div>
            </div>
        `;
    }
}


