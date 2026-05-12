# Course Pricing Update - December 2025

## Summary

All 55 fellowship course prices have been successfully updated in the CRM system according to the new pricing table. The database has been recreated and reseeded with the updated prices.

## Price Changes Overview

### Major Price Reductions (60-70% decrease)

| Course Name | Old Price | New Price | Reduction |
|------------|-----------|-----------|-----------|
| Fellowship in Pediatrics | ₹450,000 | ₹130,000 | 71% |
| Fellowship in Dermatology | ₹420,000 | ₹135,000 | 68% |
| Fellowship in Rheumatology | ₹420,000 | ₹130,000 | 69% |
| Fellowship in Radiology | ₹480,000 | ₹170,000 | 65% |
| Fellowship in Robotic Surgery | ₹700,000 | ₹220,000 | 69% |
| Fellowship in Spine Surgery | ₹580,000 | ₹220,000 | 62% |
| Fellowship in Obstetrics and Gynecology | ₹500,000 | ₹135,000 | 73% |

## Updated Price Ranges by Category

### Pediatrics (8 courses)
- Lowest: ₹99,000 (Pediatric Echocardiography)
- Highest: ₹190,000 (Pediatric Surgery)
- Average: ~₹145,000

### Orthopaedics (5 courses)
- Lowest: ₹130,000 (Rheumatology)
- Highest: ₹255,000 (Arthroscopy and Sports Medicine)
- Average: ~₹188,000

### Radiology (5 courses)
- Lowest: ₹135,000 (Vascular Ultrasound)
- Highest: ₹199,000 (Neuroradiology, Interventional Radiology)
- Average: ~₹175,000

### Dermatology (3 courses)
- Lowest: ₹110,000 (Trichology)
- Highest: ₹135,000 (Dermatology)
- Average: ~₹125,000

### Obs & Gynae (5 courses)
- Lowest: ₹130,000 (High Risk Pregnancy)
- Highest: ₹190,000 (Fetal Medicine, Laparoscopy)
- Average: ~₹163,000

### Cardiology (3 courses)
- Lowest: ₹110,000 (Echocardiography)
- Highest: ₹190,000 (Interventional Cardiology)
- Average: ~₹145,000

### Oncology (5 courses)
- Lowest: ₹130,000 (Medical Oncology, Head & Neck Oncology)
- Highest: ₹190,000 (Cardio Oncology)
- Average: ~₹158,000

### Endocrinology (3 courses)
- Lowest: ₹99,000 (Diabetology)
- Highest: ₹130,000 (Endocrinology)
- Average: ~₹113,000

### Surgery (4 courses)
- Lowest: ₹190,000 (Minimal Access Surgery)
- Highest: ₹220,000 (Robotic Surgery)
- Average: ~₹202,000

### Medicine (5 courses)
- Lowest: ₹99,000 (Emergency Medicine)
- Highest: ₹130,000 (Internal Medicine)
- Average: ~₹112,000

### Urology (2 courses)
- Lowest: ₹130,000 (Nephrology)
- Highest: ₹170,000 (Urology)
- Average: ₹150,000

### Gastroenterology (2 courses)
- Lowest: ₹135,000 (GI Endoscopy)
- Highest: ₹170,000 (Gastroenterology)
- Average: ₹152,500

### Dental (2 courses)
- Lowest: ₹110,000 (Maxillofacial Surgery)
- Highest: ₹130,000 (Oral Implantology)
- Average: ₹120,000

### Reproductive (3 courses)
- Lowest: ₹99,000 (Andrology)
- Highest: ₹135,000 (Reproductive Medicine)
- Average: ~₹115,000

## Most Affordable Courses (₹99,000)
1. Fellowship in Diabetology
2. Fellowship in Emergency Medicine
3. Fellowship in Andrology
4. Fellowship in Pediatric Echocardiography

## Premium Courses (₹199,000+)
1. Fellowship in Arthroscopy and Sports Medicine - ₹255,000
2. Fellowship in Spine Surgery - ₹220,000
3. Fellowship in Robotic Surgery - ₹220,000
4. Fellowship in Neuroradiology - ₹199,000
5. Fellowship in Interventional Radiology - ₹199,000
6. Fellowship in Cardiothoracic Surgery - ₹199,000
7. Fellowship in Neurosurgery - ₹199,000
8. Fellowship in Arthroscopy & Arthroplasty - ₹199,000

## Technical Implementation

### Files Updated
- `courses_data.py`: All 55 course prices updated with new values
- `crm_database.db`: Database recreated and reseeded

### Database Status
- ✅ 55 fellowship courses across 14 specializations
- ✅ 5 hospitals
- ✅ 4 counselors
- ✅ 50 sample leads
- ✅ 15 users in hierarchical structure

### Verification
```bash
# Sample verification query results:
Fellowship in Diabetology                          ₹99,000
Fellowship in Emergency Medicine                   ₹99,000
Fellowship in Pediatrics                           ₹130,000
Fellowship in Dermatology                          ₹135,000
Fellowship in Radiology                            ₹170,000
Fellowship in Robotic Surgery                      ₹220,000
Fellowship in Spine Surgery                        ₹220,000
```

## System Status
- ✅ Backend API: Running on http://localhost:8000
- ✅ Frontend: Running on http://localhost:3000
- ✅ API Documentation: http://localhost:8000/docs
- ✅ All prices updated and verified

## Next Steps
1. The frontend will automatically display the new prices
2. All existing leads will now show updated course prices
3. New lead creation will use the new pricing
4. No frontend changes required - prices are fetched dynamically from the API

---
*Updated: December 2025*
*All prices in Indian Rupees (INR)*
