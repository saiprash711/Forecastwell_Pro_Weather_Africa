# ForecastWell Dashboard - System Flow Diagrams

## Overall System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │   Map    │  │  Charts  │  │  Alerts  │  │  Cities  │       │
│  │ (Leaflet)│  │(Chart.js)│  │  Panel   │  │   Grid   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└────────────────────────────┬────────────────────────────────────┘
                              │ HTTP/AJAX
                              │
┌─────────────────────────────▼────────────────────────────────────┐
│                      FLASK APPLICATION                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    API ROUTES                             │   │
│  │  /api/dashboard/summary   /api/weather/current           │   │
│  │  /api/alerts              /api/weather/city/<id>         │   │
│  │  /api/forecast/analysis/<id>                             │   │
│  └────────────────────┬─────────────────────────────────────┘   │
└────────────────────────┼──────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Weather    │  │    Alert     │  │     Data     │
│   Service    │  │    Engine    │  │  Processor   │
├──────────────┤  ├──────────────┤  ├──────────────┤
│ IMD API Call │  │ Threshold    │  │ Excel Ops    │
│ Data Fetch   │  │ Check        │  │ Calculations │
│ Historical   │  │ Recommendations│  │ Statistics   │
│ Forecast     │  │ Alert Gen    │  │ Demand Index │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └────────────────┬┴─────────────────┘
                        │
                        ▼
              ┌───────────────────┐
              │   IMD DATA API    │
              │ (India Met Dept)  │
              └───────────────────┘
```

## Data Flow - Temperature Alert

```
1. TEMPERATURE DATA COLLECTION
   ┌─────────────┐
   │  IMD API    │
   └──────┬──────┘
          │ Temperature Data
          ▼
   ┌──────────────┐
   │Weather Service│
   │ Fetches Data  │
   └──────┬───────┘
          │
          ▼

2. ALERT PROCESSING
   ┌─────────────────┐
   │  Alert Engine   │
   │                 │
   │  Checks:        │
   │  • ≥40°C? → CRITICAL
   │  • ≥35°C? → HIGH
   │  • ≤28°C? → LOW
   │  • Else? → NORMAL
   └──────┬──────────┘
          │
          ▼

3. RECOMMENDATION GENERATION
   ┌────────────────────────┐
   │  Generate Steps        │
   │                        │
   │  CRITICAL:             │
   │  • Increase 50-60%     │
   │  • Emergency protocols │
   │                        │
   │  HIGH:                 │
   │  • Increase 30-40%     │
   │  • Alert network       │
   └────────┬───────────────┘
            │
            ▼

4. DASHBOARD DISPLAY
   ┌────────────────────┐
   │   Alert Panel      │
   │                    │
   │  🔴 Chennai: 41°C  │
   │     CRITICAL       │
   │     Actions: ...   │
   └────────────────────┘
```

## User Interaction Flow

```
USER OPENS DASHBOARD
       │
       ▼
┌─────────────────┐
│  Dashboard.js   │
│  Initializes    │
└────────┬────────┘
         │
         ├─────────────────────────────┐
         │                             │
         ▼                             ▼
┌─────────────────┐          ┌─────────────────┐
│  Initialize Map │          │  Load Data      │
│  (Leaflet)      │          │  (API Calls)    │
└────────┬────────┘          └────────┬────────┘
         │                            │
         │                            ▼
         │                   ┌──────────────────┐
         │                   │ Update Components│
         │                   │  • Summary       │
         │                   │  • Map Markers   │
         │                   │  • Alerts        │
         │                   │  • Charts        │
         │                   └────────┬─────────┘
         │                            │
         └────────────────┬───────────┘
                          │
                          ▼
                  ┌───────────────┐
                  │ Display Ready │
                  │ Dashboard     │
                  └───────┬───────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ User Can:             │
              │ • Click map markers   │
              │ • View alerts         │
              │ • Check charts        │
              │ • Click city cards    │
              │ • Refresh data        │
              └───────────────────────┘
```

## Demand Index Calculation Flow

```
INPUT: Temperature & Humidity
         │
         ▼
┌─────────────────────────┐
│  Temperature Ranges     │
├─────────────────────────┤
│  ≤25°C   → Base 10      │
│  26-30°C → Base 30      │
│  31-35°C → Base 60      │
│  36-40°C → Base 85      │
│  >40°C   → Base 95      │
└──────────┬──────────────┘
           │ Base Index
           ▼
┌─────────────────────────┐
│  Humidity Adjustment    │
├─────────────────────────┤
│  Humidity > 70%         │
│    → Multiply by 1.15   │
│  Humidity < 40%         │
│    → Multiply by 0.9    │
│  Else                   │
│    → No change          │
└──────────┬──────────────┘
           │ Adjusted Index
           ▼
┌─────────────────────────┐
│  Final Demand Index     │
│  (Capped at 100)        │
└──────────┬──────────────┘
           │
           ▼
    OUTPUT: 0-100 Value
```

## API Request/Response Flow

```
CLIENT REQUEST
     │
     │ GET /api/weather/current
     ▼
┌──────────────┐
│ Flask Route  │
│ @app.route   │
└──────┬───────┘
       │
       ▼
┌─────────────────┐
│ WeatherService  │
│.get_all_cities_ │
│  current()      │
└──────┬──────────┘
       │
       ├─────────────┐
       │             │
       ▼             ▼
┌───────────┐  ┌──────────────┐
│  IMD API  │  │DataProcessor │
│  Call     │  │Calculate     │
│           │  │DemandIndex   │
└─────┬─────┘  └──────┬───────┘
      │               │
      └───────┬───────┘
              │
              ▼
       ┌────────────┐
       │Format JSON │
       └──────┬─────┘
              │
              ▼
       ┌────────────┐
       │  Response  │
       │   {        │
       │  status:   │
       │  data: []  │
       │   }        │
       └──────┬─────┘
              │
              ▼
      RETURN TO CLIENT
```

## Alert Trigger Decision Tree

```
                    Temperature Input
                          │
                          ▼
                    [Check Value]
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
    [≥40°C?]          [≥35°C?]          [≤28°C?]
        │                 │                 │
      YES│              YES│              YES│
        │                 │                 │
        ▼                 ▼                 ▼
   ┌──────────┐     ┌──────────┐     ┌──────────┐
   │CRITICAL  │     │  HIGH    │     │   LOW    │
   │Alert     │     │  Alert   │     │  Alert   │
   └────┬─────┘     └────┬─────┘     └────┬─────┘
        │                │                 │
        ▼                ▼                 ▼
   ┌──────────┐     ┌──────────┐     ┌──────────┐
   │Increase  │     │Increase  │     │Decrease  │
   │50-60%    │     │30-40%    │     │Inventory │
   └──────────┘     └──────────┘     └──────────┘
        │                │                 │
        └────────────────┼─────────────────┘
                         │
                         ▼
                    [Generate]
                    [Recommendations]
                         │
                         ▼
                  Display to User
```

## Component Interaction Diagram

```
┌──────────────────────────────────────────────────────────┐
│                      FRONTEND                            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐    ┌──────────────┐                  │
│  │  index.html  │───▶│  style.css   │                  │
│  └──────┬───────┘    └──────────────┘                  │
│         │                                                │
│         │ includes                                       │
│         ▼                                                │
│  ┌────────────────────────────────┐                    │
│  │      dashboard.js              │                    │
│  ├────────────────────────────────┤                    │
│  │ • initializeDashboard()        │                    │
│  │ • initializeMap()              │◀──Leaflet.js      │
│  │ • loadDashboardData()          │                    │
│  │ • updateMapMarkers()           │                    │
│  │ • updateAlertsPanel()          │                    │
│  │ • updateTemperatureChart()     │◀──Chart.js        │
│  └────────────┬───────────────────┘                    │
└───────────────┼──────────────────────────────────────────┘
                │ AJAX/Fetch
                │
┌───────────────▼──────────────────────────────────────────┐
│                      BACKEND                             │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────┐     ┌─────────────────┐                │
│  │  app.py    │────▶│   config.py     │                │
│  └─────┬──────┘     └─────────────────┘                │
│        │                                                 │
│        │ uses                                            │
│        ▼                                                 │
│  ┌──────────────────────────────────┐                  │
│  │          Utils Modules           │                  │
│  ├──────────────────────────────────┤                  │
│  │ ┌────────────────────────────┐   │                  │
│  │ │  weather_service.py        │   │                  │
│  │ │  • get_current_weather()   │───┼──▶ IMD API     │
│  │ │  • get_forecast()          │   │                  │
│  │ │  • get_historical_data()   │   │                  │
│  │ └────────────────────────────┘   │                  │
│  │                                   │                  │
│  │ ┌────────────────────────────┐   │                  │
│  │ │  alert_engine.py           │   │                  │
│  │ │  • analyze_temperature()   │   │                  │
│  │ │  • analyze_forecast()      │   │                  │
│  │ │  • get_all_alerts()        │   │                  │
│  │ └────────────────────────────┘   │                  │
│  │                                   │                  │
│  │ ┌────────────────────────────┐   │                  │
│  │ │  data_processor.py         │   │                  │
│  │ │  • calculate_demand_index()│   │                  │
│  │ │  • process_temp_data()     │   │                  │
│  │ │  • export_to_excel()       │   │                  │
│  │ └────────────────────────────┘   │                  │
│  └──────────────────────────────────┘                  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   PRODUCTION SETUP                       │
└─────────────────────────────────────────────────────────┘

                    Internet
                       │
                       ▼
              ┌────────────────┐
              │   Load Balancer│
              │    (Optional)  │
              └────────┬───────┘
                       │
          ┌────────────┼────────────┐
          │                         │
          ▼                         ▼
┌──────────────────┐      ┌──────────────────┐
│  Web Server 1    │      │  Web Server 2    │
│  (Gunicorn)      │      │  (Gunicorn)      │
│  Port 5000       │      │  Port 5000       │
└────────┬─────────┘      └────────┬─────────┘
         │                         │
         └────────────┬────────────┘
                      │
                      ▼
            ┌───────────────────┐
            │   Flask App       │
            │   + Utils Modules │
            └─────────┬─────────┘
                      │
          ┌───────────┼───────────┐
          │                       │
          ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│   Redis Cache    │    │   IMD API        │
│   (Optional)     │    │   (External)     │
└──────────────────┘    └──────────────────┘
```

---

## Quick Reference Legend

```
┌──────┐
│ Box  │  = Component/Module
└──────┘

   │
   ▼     = Data/Control Flow

  ───▶   = API Call/Request

  ◀───   = Response/Return

  ├───   = Branch/Decision
```

---

*These diagrams help visualize the ForecastWell Dashboard architecture and data flow.*
