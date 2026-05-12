"""
Display all available courses and countries
"""

from courses_data import FELLOWSHIP_COURSES, ALL_COUNTRIES, CATEGORIES

print("=" * 80)
print("🎓 MEDICAL FELLOWSHIP COURSES")
print("=" * 80)
print(f"\nTotal Courses: {len(FELLOWSHIP_COURSES)}")
print(f"Total Countries: {len(ALL_COUNTRIES)}\n")

print("📚 COURSES BY CATEGORY:")
print("-" * 80)

current_category = None
for course in FELLOWSHIP_COURSES:
    if course["category"] != current_category:
        current_category = course["category"]
        print(f"\n{current_category}:")
        print("-" * 80)
    
    print(f"  • {course['course_name']}")
    print(f"    Duration: {course['duration']} | Price: ₹{course['price']:,} | {course['description']}")

print("\n" + "=" * 80)
print("🌍 AVAILABLE COUNTRIES")
print("=" * 80)

# Display countries in columns
countries_per_row = 4
for i in range(0, len(ALL_COUNTRIES), countries_per_row):
    row = ALL_COUNTRIES[i:i+countries_per_row]
    print("  " + " | ".join(f"{country:20}" for country in row))

print("\n" + "=" * 80)
print(f"✅ System ready with {len(FELLOWSHIP_COURSES)} courses across {len(set(c['category'] for c in FELLOWSHIP_COURSES))} categories")
print(f"✅ Supports leads from {len(ALL_COUNTRIES)} countries worldwide")
print("=" * 80)
