import requests

# Test uploading the Excel file
url = 'http://localhost:5000/api/import/excel'
files = {'file': open('sample_6_city_imd_data.xlsx', 'rb')}

response = requests.post(url, files=files)
print(f"Status Code: {response.status_code}")
print(f"Response: {response.json()}")
