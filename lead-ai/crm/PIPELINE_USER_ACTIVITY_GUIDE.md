# Pipeline & User Activity Features - Quick Guide

## 🔄 Pipeline View

### Overview
Visual kanban-style pipeline showing leads across different stages with drag-and-drop flow representation.

### Features

#### Pipeline Stages (Left to Right)
1. **Follow Up** (Blue) - Initial contact stage
2. **Warm** (Orange) - Engaged prospects
3. **Hot** (Red) - Ready to enroll
4. **Enrolled** (Green) - Converted customers

#### Lost/Inactive Section
- Not Interested
- Not Answering
- Junk

### Key Metrics Displayed
- **Count**: Number of leads in each stage
- **Revenue**: Total revenue (actual for enrolled, expected for others)
- **Total Pipeline Value**: Sum of all expected revenue
- **Conversion Rate**: Percentage of enrolled vs total leads

### Filters
- **Date Range**: Filter leads by creation/update date
- **Assigned To**: View pipeline for specific user or all users
- **Quick Ranges**: Today, Last 7 Days, Last 30 Days, This Month, Last Month

### Lead Cards Show
- Full name with avatar
- AI Score (color-coded: green >70, orange >40, default <40)
- Course interested
- Contact methods (Phone, Email, WhatsApp icons)
- Expected/Actual revenue
- Assigned user avatar

### Usage
1. Navigate to **Pipeline** from the sidebar
2. Use date range picker to select period
3. Filter by specific user or view all
4. Click Refresh to reload data
5. Each card shows lead details at a glance

---

## 📊 User Activity Dashboard

### Overview
Comprehensive analytics showing user performance metrics, activity trends, and team leaderboard.

### Main Sections

#### 1. Overview Tab

**Top Metrics (4 Cards)**
- **Total Leads**: All leads in selected period
- **Updated Leads**: Leads modified in date range
- **Potential Leads**: Hot + Warm leads
- **Enrolled**: Successfully converted with conversion %

**Revenue Metrics (2 Cards)**
- **Total Revenue**: Actual revenue from enrolled leads
- **Expected Revenue**: Potential revenue from hot/warm leads

**Daily Activity Trend (Line Chart)**
- Updated leads per day
- Potential leads per day
- Enrolled leads per day
- Interactive tooltips on hover

**Status Distribution (Pie Chart)**
- Visual breakdown of leads by status
- Color-coded segments
- Percentage labels

**Performance Breakdown**
- Enrolled: Count, percentage, progress bar (Green)
- Hot: Count, percentage, progress bar (Red)
- Warm: Count, percentage, progress bar (Orange)
- Lost: Count, percentage, progress bar (Grey)

#### 2. Leaderboard Tab

**User Performance Table** with columns:
1. **Rank**: Position with medal icons (1st gold, 2nd silver, 3rd bronze)
2. **User**: Avatar, name, and role
3. **Total Leads**: Badge with count
4. **Updated**: Blue tag showing updates
5. **Potential**: Orange tag for hot/warm leads
6. **Enrolled**: Green tag for conversions
7. **Revenue**: Total actual revenue earned
8. **Conversion**: Progress bar with percentage
9. **Avg Score**: AI score average (color-coded)

**Sorting**
- Click any column header to sort
- Default sort: Revenue (highest first)

### Filters

**Date Range Picker**
Pre-defined ranges:
- Today
- Yesterday
- Last 7 Days
- Last 30 Days
- This Month
- Last Month
- Custom range selection

**User Filter**
- All Users (combined metrics)
- Individual user selection with avatar

### Metrics Calculation

**For Each User:**
```
Total Leads = All assigned leads in date range
Updated Leads = Leads modified in period
Potential Leads = Hot + Warm status
Enrolled = Enrolled status
Total Revenue = Sum of actual_revenue (enrolled)
Expected Revenue = Sum of expected_revenue (hot/warm)
Conversion Rate = (Enrolled / Total Leads) × 100
Avg Score = Average AI score of all leads
```

### Color Coding

**Status Colors:**
- Enrolled: Green (#52c41a)
- Hot: Red (#ff4d4f)
- Warm: Orange (#faad14)
- Follow Up: Blue (#1890ff)
- Lost: Grey (#8c8c8c)

**Score Colors:**
- Green: Score > 70
- Orange: Score > 40
- Default: Score ≤ 40

### Usage Scenarios

#### Scenario 1: Daily Standup
1. Set date range to "Today"
2. View "All Users"
3. Check total updated leads
4. Review potential leads for follow-up

#### Scenario 2: Weekly Review
1. Set date range to "Last 7 Days"
2. Switch to Leaderboard tab
3. Identify top performers
4. Review conversion rates

#### Scenario 3: Individual Performance
1. Select specific user from dropdown
2. View Overview tab for detailed metrics
3. Check daily activity trend
4. Analyze status distribution

#### Scenario 4: Monthly Report
1. Set date range to "This Month" or "Last Month"
2. View all users combined metrics
3. Export leaderboard data
4. Present revenue achievements

### Navigation
- **Menu**: Sidebar → User Activity (Line Chart icon)
- **Route**: `/user-activity`

---

## 🎯 Combined Usage Tips

### Best Practices

1. **Start with User Activity**
   - Identify top performers
   - See who needs support
   - Track daily progress

2. **Move to Pipeline**
   - Visual overview of stages
   - Quick stage-by-stage analysis
   - Spot bottlenecks

3. **Regular Monitoring**
   - Check User Activity daily
   - Review Pipeline weekly
   - Run monthly reports

### Quick Actions

**Morning Routine:**
1. Open User Activity
2. Set to "Today"
3. Check updated leads count
4. Review potential leads

**Weekly Review:**
1. Open Pipeline
2. Set to "Last 7 Days"
3. Check conversion flow
4. Identify stuck leads

**Month-End:**
1. User Activity → Last Month
2. Leaderboard → Export/Review
3. Pipeline → Total revenue check

### Key Differences

| Feature | Pipeline | User Activity |
|---------|----------|---------------|
| View | Kanban stages | Metrics & charts |
| Focus | Lead flow | User performance |
| Best for | Stage analysis | Team analytics |
| Updates | Real-time cards | Aggregated data |
| Comparison | Stage vs stage | User vs user |

---

## 📱 Responsive Design

Both pages are fully responsive:
- Desktop: Full width charts and cards
- Tablet: Stacked columns
- Mobile: Single column layout

---

## 🔄 Data Refresh

- **Auto-refresh**: Navigate away and back
- **Manual refresh**: Click Refresh button
- **Real-time**: Changes reflect immediately

---

## 🎨 Visual Indicators

### Icons
- 👤 User/Team
- 📞 Phone contact
- ✉️ Email available
- 💬 WhatsApp available
- 💰 Revenue
- 📅 Calendar/Date
- 🔥 Hot lead
- 🏆 Top performer
- 📊 Analytics

### Badges & Tags
- Blue: Information, updates
- Green: Success, enrolled
- Orange: Warning, warm
- Red: Urgent, hot
- Grey: Inactive, lost

---

## 💡 Advanced Features

### Pipeline
- Click on lead card to view details
- Visual revenue comparison per stage
- Lost leads separate section
- Stage-wise conversion tracking

### User Activity
- Interactive line charts (hover for details)
- Sortable leaderboard
- Progress bars for visual comparison
- Dual-tab interface (Overview/Leaderboard)

---

## 🚀 Quick Start

1. **Pipeline View**
   ```
   Sidebar → Pipeline → Select dates → Review stages
   ```

2. **User Activity**
   ```
   Sidebar → User Activity → Set period → Check metrics
   ```

---

## 📊 Metrics Glossary

- **Total Leads**: Count of all leads
- **Updated Leads**: Leads modified in period
- **Potential Leads**: Hot + Warm combined
- **Enrolled**: Successfully converted
- **Total Revenue**: Actual money received
- **Expected Revenue**: Projected from pipeline
- **Conversion Rate**: Enrollment percentage
- **Avg Score**: Mean AI score

---

## 🎓 Training Notes

For new users:
1. Start with User Activity to understand metrics
2. Learn to read the Pipeline stages
3. Practice with different date ranges
4. Experiment with user filters
5. Compare individual vs team performance

---

**Created**: December 2025
**Version**: 1.0
**Status**: Production Ready ✅
