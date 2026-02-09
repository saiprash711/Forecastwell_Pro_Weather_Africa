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
document.addEventListener('DOMContentLoaded', function() {
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
        
        // Initialize map
        initializeMap();
        
        // Load all data
        await loadDashboardData();
        
        hideLoading();
        showToast('Dashboard loaded successfully!', 'success');
        
        console.log('✅ Dashboard initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing dashboard:', error);
        hideLoading();
        showToast('Failed to initialize dashboard', 'error');
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
            sidebar.classList.toggle('open');
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

function loadPageData(pageId) {
    switch (pageId) {
        case 'analytics':
            initializeAnalyticsCharts();
            break;
        case 'forecast':
            loadForecastPage();
            break;
        case 'cities':
            loadCitiesDetailPage();
            break;
        case 'alerts':
            loadAlertsPage();
            break;
        case 'insights':
            loadInsightsPage();
            break;
    }
}

// ========== Data Loading ==========
async function loadDashboardData() {
    try {
        // Load critical data first (weather + alerts in parallel)
        const [weatherRes, alertsRes] = await Promise.all([
            fetch(`${API_BASE}/weather/current`),
            fetch(`${API_BASE}/alerts`)
        ]);

        const weather = await weatherRes.json();
        const alerts = await alertsRes.json();

        if (weather.status === 'success' && weather.data) {
            currentCityData = weather.data;
            // Update UI immediately
            updateHeaderStats(weather.data);
            updateMapMarkers(weather.data);
            updateCitiesGrid(weather.data);
            populateCitySelects(weather.data);
            
            // Update historical city select with loaded data
            populateHistoricalCitySelect();
            
            // Update heatmap city select with loaded data
            populateHeatmapCitySelect();
            
            // Update YoY city selects with loaded data
            populateYoYCitySelect();
            
            // Initialize charts (deferred slightly for smoother UX)
            requestAnimationFrame(() => {
                initializeDashboardCharts(weather.data);
                updateWaveSequence(weather.data);
            });
        }

        if (alerts.status === 'success' && alerts.data) {
            currentAlerts = alerts.data;
            updateAlertsPanel(alerts.data);
            updateAlertBadge(alerts.data.length);
        }

        updateLastUpdate();

        // Fetch server-side KPIs (use server-calculated days_to_peak to avoid heuristic mismatch)
        try {
            const kpisRes = await fetch(`${API_BASE}/kpis`);
            const kpisJson = await kpisRes.json();
            if (kpisJson.status === 'success' && kpisJson.data) {
                const days = kpisJson.data.days_to_peak;
                const daysEl = document.getElementById('daysToPeak');
                if (daysEl) daysEl.textContent = days === 0 ? '🎯 NOW!' : `~${days} days`;
                const seasonEl = document.getElementById('seasonStatus');
                if (seasonEl) seasonEl.textContent = kpisJson.data.season_status || seasonEl.textContent;
            }
        } catch (err) {
            console.warn('Failed to fetch KPIs:', err);
        }

        // Load additional sections in background (non-blocking)
        loadNewSections().catch(err => console.warn('Background sections error:', err));
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        throw error;
    }
}

async function refreshData() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.querySelector('i').classList.add('fa-spin');
    }
    
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
        
        switch(view) {
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
        switch(markerClass) {
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
    
    switch(view) {
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

    if (hottestDayEl) hottestDayEl.textContent = `${hottestDay.city_name} (${hottestDay.day_temp || hottestDay.temperature}°C)`;
    if (hottestNightEl) hottestNightEl.textContent = `${hottestNight.city_name} (${hottestNight.night_temp || hottestNight.temperature - 5}°C)`;
    if (seasonEl) seasonEl.textContent = seasonStatus;
    if (daysEl) daysEl.textContent = daysToPeak === 0 ? '🎯 NOW!' : `~${daysToPeak} days`;
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

        return `
            <div class="city-card glass-card ${tempClass}" onclick='showCityModal(${JSON.stringify(city)})'>
                <div class="city-card-header">
                    <div>
                        <div class="city-name">${city.city_name}</div>
                        <div class="city-state">${city.state || ''}</div>
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
                        <div class="city-stat-label">Wind</div>
                        <div class="city-stat-value">${city.wind_speed || '--'}</div>
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
                        <span>Demand Index</span>
                        <span>${city.demand_index || '--'}/100</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
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
                            label: function(context) {
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
        citySelect.addEventListener('change', function() {
            selectedForecastCity = this.value;
            generateForecastCards();
            initializeForecastChart();
            generatePredictions();
        });
    }

    // Range buttons click events
    const rangeButtons = document.querySelectorAll('.range-btn');
    rangeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
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
    const critical = currentAlerts.filter(a => a.alert_level === 'critical').length;
    const high = currentAlerts.filter(a => a.alert_level === 'high').length;
    const medium = currentAlerts.filter(a => a.alert_level === 'medium' || a.alert_level === 'low').length;
    const low = currentAlerts.filter(a => a.alert_level === 'normal').length;

    document.getElementById('criticalCount').textContent = critical;
    document.getElementById('highCount').textContent = high;
    document.getElementById('mediumCount').textContent = medium;
    document.getElementById('lowCount').textContent = low || currentCityData.length - critical - high - medium;
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
    const query = e.target.value.toLowerCase();
    const cityCards = document.querySelectorAll('.city-card');
    
    cityCards.forEach(card => {
        const cityName = card.querySelector('.city-name')?.textContent.toLowerCase() || '';
        card.style.display = cityName.includes(query) ? 'block' : 'none';
    });
}

// ========== Loading & Toast ==========
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('active');
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('active');
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
        showLoading();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(20);
        doc.setTextColor(102, 126, 234);
        doc.text('ForecastWell Pro Report', 20, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);

        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text('Key Metrics:', 20, 45);

        let y = 55;
        currentCityData.forEach(city => {
            doc.setFontSize(11);
            doc.text(`${city.city_name}: Day ${city.day_temp || city.temperature}°C | Night ${city.night_temp || city.temperature - 5}°C | Demand: ${city.demand_index || '--'}`, 25, y);
            y += 8;
        });

        doc.save('forecastwell-report.pdf');
        showToast('PDF exported successfully!', 'success');
    } catch (error) {
        showToast('Error exporting PDF', 'error');
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
    compareBtn.onclick = function(e) {
        e.preventDefault();
        fetchDateComparison();
    };

    // Quick date buttons - use closest() to handle clicks on child elements
    document.querySelectorAll('.quick-date-btn').forEach(btn => {
        btn.onclick = function(e) {
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
    // Load sections sequentially to reduce server load
    try {
        await loadDemandPredictions();
        await loadEnergyEstimates();
        // These are less critical, load last
        await loadHistoricalComparison();
        await loadWeeklySummary();
        // Load 2-year historical data
        await loadTwoYearHistoricalData();
        await generateMonthlyHeatmap();
        // Load Year-over-Year comparison
        await loadYoYComparison();
    } catch (error) {
        console.warn('Some sections failed to load:', error);
    }
    
    // Initialize date comparison (outside try-catch so it always runs)
    try { initDateCompare(); } catch(e) { console.warn('Date compare init error:', e); }
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
    
    switch(period) {
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
                        title: function(context) {
                            return `📅 ${context[0].label}`;
                        },
                        label: function(context) {
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
    select.addEventListener('change', function(e) {
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
                        label: function(context) {
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
                        label: function(context) {
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
document.addEventListener('DOMContentLoaded', function() {
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
                        label: function(context) {
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