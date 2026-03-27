#!/usr/bin/env python3
"""
Create a sample Excel file for testing the ForecastWell Dashboard import functionality
"""
import pandas as pd
from datetime import datetime, timedelta
import random

def create_sample_excel():
    # Sample data for the 6 cities
    cities = ['Nairobi', 'Lagos', 'Cairo', 'Johannesburg', 'Accra', 'Dar es Salaam']
    
    # Generate data for the last 7 days
    dates = [(datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d') for i in range(7)]
    
    # Create a list to hold all rows
    data_rows = []
    
    for date in dates:
        for city in cities:
            # Generate realistic temperature data
            base_temp = random.uniform(28, 40)
            day_temp = base_temp + random.uniform(1, 4)  # Day is warmer
            night_temp = base_temp - random.uniform(3, 6)  # Night is cooler
            humidity = random.uniform(40, 90)
            
            data_rows.append({
                'City': city,
                'Date': date,
                'Day_Temp': round(day_temp, 1),
                'Night_Temp': round(night_temp, 1),
                'Humidity': round(humidity, 1)
            })
    
    # Create DataFrame
    df = pd.DataFrame(data_rows)
    
    # Save to Excel
    filename = 'sample_6_city_imd_data.xlsx'
    df.to_excel(filename, index=False)
    print(f"Sample Excel file created: {filename}")
    print(f"Shape: {df.shape}")
    print("\nFirst few rows:")
    print(df.head(10))

if __name__ == "__main__":
    create_sample_excel()