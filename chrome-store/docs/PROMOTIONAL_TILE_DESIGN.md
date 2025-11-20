# Promotional Tile Design Specification

**Dimensions:** 1400x560 pixels (PNG format)
**Purpose:** Chrome Web Store listing promotional image

---

## Design Layout

### Canvas: 1400 x 560 pixels

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                    │
│  [60x60]     CODEMASTER                                          100% Open Source │
│   LOGO       Algorithm Learning Assistant                                         │
│                                                                                    │
│  ┌─────────────────────────────┐    Master Algorithms with                        │
│  │                             │    Spaced Repetition                             │
│  │   Dashboard Screenshot      │                                                  │
│  │   (Session Analytics)       │    ✓ Adaptive Learning Sessions                  │
│  │   - Colorful charts         │    ✓ Smart Analytics & Insights                  │
│  │   - Performance graphs      │    ✓ Pattern-Based Progression                   │
│  │   - Session data            │    ✓ Seamless LeetCode Integration               │
│  │                             │                                                  │
│  │   [Screenshot with slight   │    Your Personalized LeetCode Companion          │
│  │    shadow and rounded       │                                                  │
│  │    corners]                 │    github.com/smithrashell/CodeMaster            │
│  └─────────────────────────────┘                                                  │
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Specifications

### Background
- **Color:** Linear gradient from `#E3F2FD` (light blue) to `#FFFFFF` (white)
- **Direction:** Top-left to bottom-right diagonal
- **Alternative:** Solid white `#FFFFFF` with subtle texture

### Logo Section (Top-Left)
- **Position:** 40px from left, 40px from top
- **Logo:** CodeMaster hexagon logo (CM mark)
- **Size:** 60x60 pixels
- **Logo Text:** "CODEMASTER" in Montserrat Bold or similar
- **Font Size:** 32px
- **Color:** `#1A237E` (dark blue)
- **Subtitle:** "Algorithm Learning Assistant"
- **Subtitle Font:** Montserrat Regular, 16px
- **Subtitle Color:** `#546E7A` (gray-blue)

### Open Source Badge (Top-Right)
- **Position:** 40px from right, 40px from top
- **Text:** "100% Open Source"
- **Style:** Small pill badge
- **Background:** `#4CAF50` (green)
- **Text Color:** White
- **Font:** Montserrat Medium, 14px
- **Padding:** 8px 16px
- **Border Radius:** 20px

### Screenshot Section (Left Side)
- **Position:** 60px from left, 140px from top
- **Screenshot:** `chrome-store/1-dashboard-analytics.png`
- **Dimensions:** 640x400 pixels (scaled down 2:1 from 1280x800)
- **Border Radius:** 12px
- **Box Shadow:** `0 8px 24px rgba(0, 0, 0, 0.12)`
- **Border:** 1px solid `#E0E0E0` (optional)

### Headline Section (Right Side)
- **Position:** 740px from left, 160px from top

#### Main Headline
- **Text:** "Master Algorithms with Spaced Repetition"
- **Font:** Montserrat Bold
- **Size:** 36px
- **Line Height:** 44px
- **Color:** `#1A237E` (dark blue)
- **Max Width:** 600px

### Feature List (Right Side)
- **Position:** 740px from left, 260px from top
- **Spacing:** 24px between items

#### Each Feature
- **Checkmark Icon:** ✓ or use Material Icons checkmark
- **Icon Color:** `#4CAF50` (green)
- **Icon Size:** 24x24 pixels
- **Text Font:** Montserrat Medium
- **Text Size:** 18px
- **Text Color:** `#37474F` (dark gray)
- **Alignment:** Icon 8px left of text

**Features:**
1. "Adaptive Learning Sessions"
2. "Smart Analytics & Insights"
3. "Pattern-Based Progression"
4. "Seamless LeetCode Integration"

### Tagline (Right Side, Bottom)
- **Position:** 740px from left, 440px from top
- **Text:** "Your Personalized LeetCode Companion"
- **Font:** Montserrat Regular
- **Size:** 20px
- **Color:** `#546E7A` (gray-blue)

### Footer Link (Right Side, Very Bottom)
- **Position:** 740px from left, 490px from top
- **Text:** "github.com/smithrashell/CodeMaster"
- **Font:** Montserrat Regular
- **Size:** 14px
- **Color:** `#2196F3` (blue link color)

---

## Color Palette

```css
Primary Blue:     #2196F3
Dark Blue:        #1A237E
Success Green:    #4CAF50
Text Dark:        #1A1A1A
Text Medium:      #37474F
Text Light:       #546E7A
Border:           #E0E0E0
Background Light: #E3F2FD
Background White: #FFFFFF
```

---

## Typography

**Font Family:** Montserrat (Google Fonts)
- Download: https://fonts.google.com/specimen/Montserrat

**Font Weights Used:**
- Regular (400) - Body text, taglines
- Medium (500) - Features
- Bold (700) - Headlines, logo

**Alternative Fonts:**
- Inter
- Poppins
- Roboto

---

## Screenshot Processing

### Source Screenshot
**Use:** `1-dashboard-session-analytics.png` (Session History Dashboard)

**Why this screenshot:**
- Shows colorful, data-rich analytics
- Demonstrates value proposition immediately
- Professional appearance with charts and graphs
- Includes session data table

### Preparation
1. Resize to 640x400 (scale down 50%)
2. Add subtle drop shadow
3. Round corners to 12px
4. Optional: Add thin border

---

## Design Tools & Templates

### Option 1: Figma (Recommended)
**Free template structure:**

1. Create 1400x560 canvas
2. Add gradient background
3. Import screenshot (drag & drop)
4. Add text layers with specifications above
5. Export as PNG

**Figma Template Link:** (You can create reusable template)

### Option 2: Canva
**Search for:** "YouTube Channel Art" (2560x1440) then resize
**Or:** "Twitter Header" and customize

**Steps:**
1. Create custom dimensions: 1400x560
2. Use light blue background
3. Add screenshot image
4. Add text elements
5. Download as PNG

### Option 3: Photoshop/GIMP
**Layer Structure:**
```
Background (gradient)
  └─ Screenshot (with effects)
  └─ Logo
  └─ Text: Headline
  └─ Text: Features (x4)
  └─ Text: Tagline
  └─ Text: GitHub link
  └─ Badge: Open Source
```

---

## Export Settings

**Format:** PNG
**Dimensions:** Exactly 1400 x 560 pixels
**Quality:** Maximum (no compression)
**Color Mode:** RGB
**File Size:** Must be under 5 MB (should be ~300-800 KB)

---

## Alternative Design Variations

### Variation A: Screenshot-Focused
- Larger screenshot (800x500)
- Smaller text on the right
- More visual, less text

### Variation B: Feature-Focused
- No screenshot
- Larger feature list with icons
- More emphasis on benefits

### Variation C: Dark Theme
- Dark blue/purple gradient background
- White text
- Glowing effects on screenshot
- Modern, developer-focused aesthetic

---

## Quality Checklist

Before exporting, verify:

- [ ] Dimensions are exactly 1400x560 pixels
- [ ] All text is readable at 100% zoom
- [ ] Screenshot is high quality (not blurry)
- [ ] Colors match brand (blues and greens)
- [ ] Logo is crisp and clear
- [ ] No spelling errors
- [ ] File size under 5 MB
- [ ] PNG format with transparency if needed
- [ ] Looks good on both light and dark backgrounds

---

## Implementation Priority

**Quick Version (30 minutes):**
1. Use Canva template
2. Add gradient background (#E3F2FD to #FFFFFF)
3. Insert screenshot
4. Add headline and 4 features
5. Export as PNG

**Polished Version (2 hours):**
1. Use Figma for precision
2. Custom gradient and shadows
3. Carefully positioned elements
4. Icon set for checkmarks
5. Multiple export sizes for testing

**Recommended:** Start with quick version, iterate based on feedback

---

## Example Text Content (Copy-Paste Ready)

```
CODEMASTER
Algorithm Learning Assistant

Master Algorithms with Spaced Repetition

✓ Adaptive Learning Sessions
✓ Smart Analytics & Insights
✓ Pattern-Based Progression
✓ Seamless LeetCode Integration

Your Personalized LeetCode Companion

github.com/smithrashell/CodeMaster
```

---

## Next Steps

1. Choose design tool (Figma/Canva/Photoshop)
2. Create 1400x560 canvas
3. Follow layout specifications above
4. Use `chrome-store/1-dashboard-analytics.png` as screenshot
5. Export as PNG
6. Preview in Chrome Web Store developer dashboard
7. Iterate if needed

**Estimated Time:** 1-2 hours for first version

Good luck! 🎨
