Test Plan for Real Data Verification:

1. **Verify Forecast Data:**
   - Go to the Dashboard -> Forecast tab.
   - Select different cities (e.g., Chennai, Bangalore).
   - Confirm that the 7-day forecast cards and temperature chart update with realistic values (e.g., matching OpenMeteo or general weather expectations).
   - Check if "Day Temp" and "Night Temp" are distinct and reasonable.

2. **Verify Peak Season ETA:**
   - Check the "Peak Season ETA" card in the Analytics/Predictions section.
   - For Chennai, it should show approx 60-70 days (targeting April 20).
   - For Bangalore, it should show a different value (targeting April 1).
   - Ensure the countdown is logical based on the current date (Feb 12).

3. **Verify Year-over-Year (YoY) Chart:**
   - Go to Analytics tab -> "YoY Analysis".
   - Confirm the chart shows 3 lines (2024, 2025, 2026).
   - 2024 and 2025 should have full historical data (up to current date for 2025/26).
   - 2026 should populate data for Jan/Feb.
   - Verify the table below the chart reflects these values.

4. **Verify Temperature Trends:**
   - Go to "Temperature Trends" chart.
   - Select "Last 30 Days".
   - Confirm the data points are not a perfect sine wave (which was the simulation) but look like actual historical weather data (some fluctuations).
   - Switch between "All Cities" and a single city to ensure both views work.

5. **Verify Global KPIs:**
   - On the main dashboard header, check "Days to Peak".
   - It should match the default (Chennai) peak countdown (~67 days).
   - "Season Status" should reflect current temperatures (likely "Transitioning" or "Building").

6. **Error Handling:**
   - Disconnect internet briefly (if possible) or check console logs to ensure no "Uncaught Errors" appear if API fails (fallback or error messages should handle it).
