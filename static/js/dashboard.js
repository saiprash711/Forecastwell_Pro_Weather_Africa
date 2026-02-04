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
    
    // Global Search
    const globalSearch = document.getElementById('globalSearch');
    if (globalSearch) {
        globalSearch.addEventListener('input', handleSearch);
    }
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
    }
}

// ========== Data Loading ==========
async function loadDashboardData() {
    try {
        const [summaryRes, weatherRes, alertsRes] = await Promise.all([
            fetch(`${API_BASE}/dashboard/summary`),
            fetch(`${API_BASE}/weather/current`),
            fetch(`${API_BASE}/alerts`)
        ]);

        const summary = await summaryRes.json();
        const weather = await weatherRes.json();
        const alerts = await alertsRes.json();

        if (weather.status === 'success' && weather.data) {
            currentCityData = weather.data;
            updateHeaderStats(weather.data);
            updateMapMarkers(weather.data);
            updateWaveSequence(weather.data);
            updateCitiesGrid(weather.data);
            initializeDashboardCharts(weather.data);
            populateCitySelects(weather.data);
        }

        if (alerts.status === 'success' && alerts.data) {
            currentAlerts = alerts.data;
            updateAlertsPanel(alerts.data);
            updateAlertBadge(alerts.data.length);
        }

        // Load new sections
        await loadNewSections();

        updateLastUpdate();
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

    // Calculate season status
    const avgNightTemp = citiesData.reduce((sum, c) => sum + (c.night_temp || c.temperature - 5), 0) / citiesData.length;
    let seasonStatus = '❄️ Off Season';
    if (avgNightTemp >= 24) seasonStatus = '🔥 Peak Season';
    else if (avgNightTemp >= 22) seasonStatus = '📈 High Season';
    else if (avgNightTemp >= 20) seasonStatus = '🌤️ Building';

    // Days to peak
    const daysToPeak = avgNightTemp >= 24 ? 0 : Math.round((24 - avgNightTemp) * 10);

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

    // Radar Chart
    const radarCanvas = document.getElementById('radarChart');
    if (radarCanvas) {
        if (charts.radar) charts.radar.destroy();
        
        // Colors for up to 6 cities
        const radarColors = [
            { border: '#667eea', bg: 'rgba(102, 126, 234, 0.2)' },
            { border: '#f97316', bg: 'rgba(249, 115, 22, 0.2)' },
            { border: '#22c55e', bg: 'rgba(34, 197, 94, 0.2)' },
            { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.2)' },
            { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.2)' },
            { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.2)' }
        ];
        
        charts.radar = new Chart(radarCanvas, {
            type: 'radar',
            data: {
                labels: ['Day Temp', 'Night Temp', 'Humidity', 'Wind', 'Demand', 'AC Hours'],
                datasets: currentCityData.slice(0, 6).map((city, i) => ({
                    label: city.city_name,
                    data: [
                        normalizeValue(city.day_temp || city.temperature, 20, 45),
                        normalizeValue(city.night_temp || city.temperature - 5, 15, 30),
                        city.humidity || 50,
                        normalizeValue(city.wind_speed || 10, 0, 30),
                        city.demand_index || 50,
                        normalizeValue(city.ac_hours || 8, 0, 24) * 100 / 24
                    ],
                    borderColor: radarColors[i % radarColors.length].border,
                    backgroundColor: radarColors[i % radarColors.length].bg,
                    borderWidth: 2
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
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
}

function updateStatRings() {
    const avgTemp = currentCityData.reduce((sum, c) => sum + (c.day_temp || c.temperature || 30), 0) / currentCityData.length;
    const avgHumidity = currentCityData.reduce((sum, c) => sum + (c.humidity || 50), 0) / currentCityData.length;
    const avgDemand = currentCityData.reduce((sum, c) => sum + (c.demand_index || 50), 0) / currentCityData.length;
    const avgAcHours = currentCityData.reduce((sum, c) => sum + (c.ac_hours || 8), 0) / currentCityData.length;

    // Update values
    document.getElementById('avgTempValue').textContent = `${Math.round(avgTemp)}°C`;
    document.getElementById('avgHumidityValue').textContent = `${Math.round(avgHumidity)}%`;
    document.getElementById('avgDemandValue').textContent = Math.round(avgDemand);
    document.getElementById('avgAcHoursValue').textContent = `${Math.round(avgAcHours)}h`;

    // Animate rings
    animateRing('tempProgress', normalizeValue(avgTemp, 20, 45));
    animateRing('humidityProgress', avgHumidity);
    animateRing('demandProgress', avgDemand);
    animateRing('acHoursProgress', (avgAcHours / 24) * 100);
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
                    <div class="heatmap-avg-label">Avg</div>
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
                    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
                    
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
                                <span class="avg-value">${Math.round(avgTemp)}°</span>
                                <span class="avg-indicator ${avgTemp >= 35 ? 'hot' : avgTemp >= 30 ? 'warm' : 'cool'}"></span>
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

    select.innerHTML = '<option value="">All Cities (Average)</option>' + 
        currentCityData.map(city => 
            `<option value="${city.city_id}">${city.city_name}</option>`
        ).join('');
    
    selectedForecastCity = '';
}

function getSelectedCityData() {
    if (!selectedForecastCity || !currentCityData) {
        // Return average of all cities
        if (!currentCityData || currentCityData.length === 0) return null;
        return {
            city_name: 'All Cities',
            day_temp: currentCityData.reduce((sum, c) => sum + (c.day_temp || c.temperature), 0) / currentCityData.length,
            night_temp: currentCityData.reduce((sum, c) => sum + (c.night_temp || c.temperature - 5), 0) / currentCityData.length,
            humidity: currentCityData.reduce((sum, c) => sum + (c.humidity || 50), 0) / currentCityData.length,
            demand_index: currentCityData.reduce((sum, c) => sum + (c.demand_index || 50), 0) / currentCityData.length
        };
    }
    return currentCityData.find(c => c.city_id == selectedForecastCity);
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
    const cityName = cityData ? cityData.city_name : 'All Cities';
    
    // Calculate predictions based on selected city or average
    const avgTemp = cityData ? (cityData.day_temp || cityData.temperature || 35) : 
        currentCityData.reduce((sum, c) => sum + (c.day_temp || c.temperature), 0) / currentCityData.length;
    
    const avgDemand = cityData ? (cityData.demand_index || 50) :
        currentCityData.reduce((sum, c) => sum + (c.demand_index || 50), 0) / currentCityData.length;
    
    const humidity = cityData ? (cityData.humidity || 50) :
        currentCityData.reduce((sum, c) => sum + (c.humidity || 50), 0) / currentCityData.length;

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
        trendCity.innerHTML = '<option value="all">All Cities</option>' + 
            citiesData.map(c => `<option value="${c.city_id}">${c.city_name}</option>`).join('');
        
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

// Load all new sections
async function loadNewSections() {
    await Promise.all([
        loadInsights(),
        loadDemandPredictions(),
        loadEnergyEstimates(),
        loadHistoricalComparison(),
        loadWeeklySummary()
    ]);
}