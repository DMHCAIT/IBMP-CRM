"""
Medical Fellowship Programs - Updated
Latest courses as of March 2026
"""

FELLOWSHIP_COURSES = [
    {
        "course_name": "Fellowship in Emergency Medicine",
        "category": "Medicine",
        "duration": "12 Months",
        "eligibility": "MBBS/ MD/MS or Equivalent",
        "price": 99000,
        "currency": "INR",
        "description": "Emergency and trauma care management"
    },
    {
        "course_name": "Fellowship in Diabetes Mellitus",
        "category": "Endocrinology",
        "duration": "12 Months",
        "eligibility": "MBBS/ MD/MS or Equivalent",
        "price": 99000,
        "currency": "INR",
        "description": "Comprehensive diabetes management and treatment"
    },
    {
        "course_name": "Fellowship in Gynecology & Obstetrics",
        "category": "Obs & Gynae",
        "duration": "12 Months",
        "eligibility": "MBBS/ MD/MS or Equivalent",
        "price": 135000,
        "currency": "INR",
        "description": "Women's reproductive health and childbirth"
    },
    {
        "course_name": "Fellowship in Pediatrics",
        "category": "Pediatrics",
        "duration": "12 Months",
        "eligibility": "MBBS, MD/MS or Equivalent",
        "price": 130000,
        "currency": "INR",
        "description": "Comprehensive pediatric medicine training"
    },
    {
        "course_name": "Fellowship in Dermatology",
        "category": "Dermatology",
        "duration": "12 Months",
        "eligibility": "MBBS/ MD/MS or Equivalent",
        "price": 135000,
        "currency": "INR",
        "description": "Comprehensive skin disease management"
    },
    {
        "course_name": "Fellowship in Internal Medicine",
        "category": "Medicine",
        "duration": "12 Months",
        "eligibility": "MBBS/ MD/MS or Equivalent",
        "price": 130000,
        "currency": "INR",
        "description": "Adult disease diagnosis and treatment"
    },
    {
        "course_name": "Fellowship in Clinical Cardiology",
        "category": "Cardiology",
        "duration": "12 Months",
        "eligibility": "MBBS/ MD/MS or Equivalent",
        "price": 135000,
        "currency": "INR",
        "description": "Comprehensive cardiovascular disease management"
    },
    {
        "course_name": "Fellowship in Critical Care Medicine",
        "category": "Medicine",
        "duration": "12 Months",
        "eligibility": "MBBS/ MD/MS or Equivalent",
        "price": 110000,
        "currency": "INR",
        "description": "Intensive care unit management"
    },
    {
        "course_name": "Fellowship in Family Medicine",
        "category": "Medicine",
        "duration": "12 Months",
        "eligibility": "MBBS/ MD/MS or Equivalent",
        "price": 110000,
        "currency": "INR",
        "description": "Comprehensive primary care practice"
    },
    {
        "course_name": "Fellowship in Endocrinology",
        "category": "Endocrinology",
        "duration": "12 Months",
        "eligibility": "MBBS, MD/MS or Equivalent",
        "price": 130000,
        "currency": "INR",
        "description": "Hormone and gland disorders"
    },
    {
        "course_name": "Fellowship in Orthopedics",
        "category": "Orthopaedics",
        "duration": "12 Months",
        "eligibility": "MBBS/ MD/MS or Equivalent",
        "price": 135000,
        "currency": "INR",
        "description": "Comprehensive orthopedic surgery training"
    },
    {
        "course_name": "Fellowship in Nephrology",
        "category": "Urology",
        "duration": "12 Months",
        "eligibility": "MBBS, MD/MS or Equivalent",
        "price": 130000,
        "currency": "INR",
        "description": "Kidney disease management"
    },
    {
        "course_name": "Fellowship in Gastroenterology",
        "category": "Gastroenterology",
        "duration": "12 Months",
        "eligibility": "MBBS, MD/MS or Equivalent",
        "price": 170000,
        "currency": "INR",
        "description": "Digestive system disorders"
    },
    {
        "course_name": "Fellowship in Reproductive Medicine",
        "category": "Reproductive",
        "duration": "12 Months",
        "eligibility": "MBBS/ MD/MS or Equivalent",
        "price": 135000,
        "currency": "INR",
        "description": "Fertility treatment and assisted reproduction"
    },
    {
        "course_name": "Fellowship in Neonatology",
        "category": "Pediatrics",
        "duration": "12 Months",
        "eligibility": "MBBS, MD/MS or Equivalent",
        "price": 130000,
        "currency": "INR",
        "description": "Specialized newborn care and neonatal intensive care"
    },
    {
        "course_name": "Fellowship in Interventional Cardiology",
        "category": "Cardiology",
        "duration": "12 Months",
        "eligibility": "MBBS, MD/MS or Equivalent",
        "price": 190000,
        "currency": "INR",
        "description": "Catheter-based cardiac procedures"
    },
    {
        "course_name": "Fellowship in Arthroscopy and Arthroplasty",
        "category": "Orthopaedics",
        "duration": "12 Months",
        "eligibility": "MBBS, MD/MS or Equivalent",
        "price": 199000,
        "currency": "INR",
        "description": "Joint surgery and replacement procedures"
    }
]

# Comprehensive list of all countries
ALL_COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda",
    "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain",
    "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
    "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
    "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada",
    "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros",
    "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark",
    "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador",
    "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji",
    "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece",
    "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras",
    "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel",
    "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati",
    "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia",
    "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi",
    "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania",
    "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro",
    "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands",
    "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia",
    "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea",
    "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania",
    "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
    "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe",
    "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore",
    "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea",
    "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland",
    "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo",
    "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
    "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States",
    "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam",
    "Yemen", "Zambia", "Zimbabwe"
]

# Category summary
CATEGORIES = {
    "Medicine": 4,
    "Endocrinology": 2,
    "Obs & Gynae": 1,
    "Pediatrics": 2,
    "Dermatology": 1,
    "Cardiology": 2,
    "Orthopaedics": 2,
    "Urology": 1,
    "Gastroenterology": 1,
    "Reproductive": 1
}
