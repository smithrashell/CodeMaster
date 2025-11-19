# Screenshot Text Overlay Guide

**Purpose:** Simple text overlays to help users quickly understand each screenshot's key feature.

**Philosophy:** Add overlays only where they enhance understanding. Keep it minimal and focused.

---

## Recommended Overlays (3 Screenshots)

**Add text overlays to these screenshots for maximum impact:**

### Screenshot 2: Learning Goals & Focus Areas ⭐
### Screenshot 5: Timer & Strategy Hints ⭐
### Screenshot 8: Learning Path Visualization ⭐

**Keep these clean (no overlays needed):**
- Screenshots 1, 3, 4, 6, 7 - UI is self-explanatory

---

## Screenshot 2: Learning Goals & Focus Areas

**Filename:** `2-learning-goals-focus-areas.png`

### Text to Add:

```
Adaptive Focus Areas
System-recommended patterns based on your performance
```

### Design Specs:

**Position:** Top-right corner (above "Focus Priorities" section)

**Background Box:**
- Color: `rgba(33, 150, 243, 0.90)` (brand blue)
- Padding: 20px top/bottom, 28px left/right
- Border Radius: 10px
- Box Shadow: `0 4px 12px rgba(0, 0, 0, 0.15)`

**Headline Text:**
- Content: "Adaptive Focus Areas"
- Font: Montserrat Bold (or Inter Bold)
- Size: 32px
- Color: `#FFFFFF` (white)
- Line Height: 1.2
- Letter Spacing: -0.3px

**Subtext:**
- Content: "System-recommended patterns based on your performance"
- Font: Montserrat Regular (or Inter Regular)
- Size: 16px
- Color: `#FFFFFF` (white)
- Line Height: 1.4
- Opacity: 0.95

**Layout:**
```
┌────────────────────────────────────┐
│  Adaptive Focus Areas              │
│  System-recommended patterns based │
│  on your performance               │
└────────────────────────────────────┘
```

---

## Screenshot 5: Timer & Strategy Hints

**Filename:** `5-timer-hints.png`

### Text to Add:

```
Built-In Timer + Pattern Hints
Practice efficiently with strategic guidance
```

### Design Specs:

**Position:** Bottom-center (below the code editor area)

**Background Box:**
- Color: `rgba(26, 35, 126, 0.88)` (dark blue)
- Padding: 20px top/bottom, 28px left/right
- Border Radius: 10px
- Box Shadow: `0 4px 12px rgba(0, 0, 0, 0.15)`

**Headline Text:**
- Content: "Built-In Timer + Pattern Hints"
- Font: Montserrat Bold
- Size: 34px
- Color: `#FFFFFF` (white)
- Line Height: 1.2
- Letter Spacing: -0.3px

**Subtext:**
- Content: "Practice efficiently with strategic guidance"
- Font: Montserrat Regular
- Size: 16px
- Color: `#FFFFFF` (white)
- Line Height: 1.4
- Opacity: 0.95

**Layout:**
```
┌────────────────────────────────────────────────┐
│  Built-In Timer + Pattern Hints                │
│  Practice efficiently with strategic guidance  │
└────────────────────────────────────────────────┘
```

---

## Screenshot 8: Learning Path Visualization

**Filename:** `8-learning-path-visualization.png`

### Text to Add:

```
Interactive Learning Path
Visualize how algorithm patterns connect
```

### Design Specs:

**Position:** Top-center (above the graph visualization)

**Background Box:**
- Color: `rgba(103, 58, 183, 0.90)` (purple - creative/unique)
- Padding: 20px top/bottom, 28px left/right
- Border Radius: 10px
- Box Shadow: `0 4px 12px rgba(0, 0, 0, 0.15)`

**Headline Text:**
- Content: "Interactive Learning Path"
- Font: Montserrat Bold
- Size: 34px
- Color: `#FFFFFF` (white)
- Line Height: 1.2
- Letter Spacing: -0.3px

**Subtext:**
- Content: "Visualize how algorithm patterns connect"
- Font: Montserrat Regular
- Size: 16px
- Color: `#FFFFFF` (white)
- Line Height: 1.4
- Opacity: 0.95

**Layout:**
```
┌─────────────────────────────────────────────┐
│  Interactive Learning Path                  │
│  Visualize how algorithm patterns connect   │
└─────────────────────────────────────────────┘
```

---

## Design System Reference

### Color Palette

```css
/* Brand Blue (Screenshot 2) */
Primary: rgba(33, 150, 243, 0.90)
Text: #FFFFFF

/* Dark Blue (Screenshot 5) */
Primary: rgba(26, 35, 126, 0.88)
Text: #FFFFFF

/* Purple (Screenshot 8) */
Primary: rgba(103, 58, 183, 0.90)
Text: #FFFFFF
```

### Typography

**Font Stack:**
1. Montserrat (primary) - [Google Fonts](https://fonts.google.com/specimen/Montserrat)
2. Inter (alternative) - [Google Fonts](https://fonts.google.com/specimen/Inter)
3. System UI fallback

**Headline:**
- Weight: Bold (700)
- Size: 32-34px
- Line Height: 1.2
- Letter Spacing: -0.3px

**Subtext:**
- Weight: Regular (400)
- Size: 16px
- Line Height: 1.4
- Letter Spacing: 0px
- Opacity: 0.95

### Box Styling

**Standard Overlay Box:**
- Padding: 20px 28px
- Border Radius: 10px
- Box Shadow: `0 4px 12px rgba(0, 0, 0, 0.15)`
- Background Opacity: 88-90%

---

## Implementation Guide

### Quick Implementation (Canva - Recommended)

**Time:** ~10 minutes per screenshot

1. **Upload Screenshot**
   - Go to [Canva.com](https://www.canva.com/)
   - Create custom size: 1280x800px
   - Upload screenshot as background

2. **Add Text Box**
   - Click "Text" → "Add a heading"
   - Type headline text
   - Set font to Montserrat Bold, size 32-34px
   - Add subtext below (Montserrat Regular, 16px)

3. **Add Background Box**
   - Click "Elements" → Search "rectangle"
   - Place behind text
   - Set color from palette above
   - Adjust transparency to 88-90%
   - Round corners to 10px

4. **Position & Export**
   - Position overlay box in specified location
   - Adjust padding around text
   - Download as PNG (1280x800)
   - Replace file in `chrome-store/` folder

### Advanced Implementation (Figma/Photoshop)

**For pixel-perfect control:**

**Figma:**
1. Import screenshot (1280x800)
2. Add frame for overlay box
3. Set background fill with opacity
4. Add text layers with exact specs
5. Add box shadow effect
6. Export as PNG

**Photoshop:**
1. Open screenshot
2. Create rounded rectangle shape
3. Set layer opacity
4. Add layer effects (drop shadow)
5. Add text layers
6. Save for Web (PNG)

---

## Screenshot Reference Table

| Screenshot | Overlay Needed? | Headline | Background Color | Position |
|-----------|----------------|----------|------------------|----------|
| 1-dashboard-analytics.png | ❌ No | - | - | - |
| 2-learning-goals-focus-areas.png | ✅ **Yes** | Adaptive Focus Areas | Blue (rgba(33,150,243,0.9)) | Top-right |
| 3-leetcode-integration.png | ❌ No | - | - | - |
| 4-problem-generator.png | ❌ No | - | - | - |
| 5-timer-hints.png | ✅ **Yes** | Built-In Timer + Pattern Hints | Dark Blue (rgba(26,35,126,0.88)) | Bottom-center |
| 6-problem-submission.png | ❌ No | - | - | - |
| 7-settings.png | ❌ No | - | - | - |
| 8-learning-path-visualization.png | ✅ **Yes** | Interactive Learning Path | Purple (rgba(103,58,183,0.9)) | Top-center |

---

## Why These 3 Screenshots?

### Screenshot 2 (Learning Goals & Focus Areas)
**Why overlay:** This shows a unique "adaptive learning" feature that needs emphasis. The overlay helps users immediately understand the system makes intelligent recommendations.

### Screenshot 5 (Timer & Strategy Hints)
**Why overlay:** Combines two features (timer + hints) that might not be obvious. The overlay clarifies these are built-in learning assistance tools.

### Screenshot 8 (Learning Path Visualization)
**Why overlay:** This interactive graph is visually complex. The overlay explains what users are looking at and highlights the unique visualization feature.

### Why Not Others?

- **Screenshot 1** - Charts are self-explanatory
- **Screenshot 3** - LeetCode integration is visually obvious
- **Screenshot 4** - Problem list is clear
- **Screenshot 6** - Form fields explain themselves
- **Screenshot 7** - Settings UI is standard

---

## Copy-Paste Text Content

**Screenshot 2:**
```
Adaptive Focus Areas
System-recommended patterns based on your performance
```

**Screenshot 5:**
```
Built-In Timer + Pattern Hints
Practice efficiently with strategic guidance
```

**Screenshot 8:**
```
Interactive Learning Path
Visualize how algorithm patterns connect
```

---

## Alignment with Captions

These overlays work **with** the Chrome Web Store captions (from FINAL_SCREENSHOT_LIST.md):

**Screenshot 2 Caption:**
> "Adaptive focus areas prioritize your weak spots - intelligent learning that adjusts based on your performance and goals"

**Overlay adds:** Quick visual headline to grab attention

**Screenshot 5 Caption:**
> "Practice with built-in timer and get pattern-based strategy hints to guide your problem-solving approach"

**Overlay adds:** Emphasizes dual functionality (timer + hints)

**Screenshot 8 Caption:**
> "Visualize your learning journey with interactive pattern connections - see how algorithm concepts relate and build on each other"

**Overlay adds:** Immediately clarifies what the graph represents

---

## Before & After Expectations

**Without Overlays:**
- User sees screenshots
- Reads captions below each
- Understands features sequentially

**With Overlays (3 screenshots):**
- User **immediately** sees key features highlighted
- Overlays grab attention to most important screenshots
- Captions provide additional context
- Creates visual hierarchy and emphasis

---

## Final Checklist

Before uploading overlaid screenshots:

- [ ] Text is centered in overlay box
- [ ] Box has proper padding (20px vertical, 28px horizontal)
- [ ] Background opacity is 88-90%
- [ ] Box shadow is visible but subtle
- [ ] Text is white (#FFFFFF) and readable
- [ ] Font sizes match specs (32-34px headline, 16px subtext)
- [ ] Border radius is 10px
- [ ] Screenshot is exactly 1280x800
- [ ] File is saved as PNG
- [ ] File replaces original in `chrome-store/` folder

---

## Estimated Time

**Total time for all 3 overlays:**
- Using Canva: ~30 minutes
- Using Figma: ~45 minutes
- Using Photoshop: ~30 minutes

**Recommendation:** Use Canva for quickest results with good quality.

---

## Questions?

**Q: Should I add overlays to other screenshots?**
A: No - keep it minimal. These 3 are strategically chosen to highlight unique features. Over-labeling reduces impact.

**Q: Can I use different colors?**
A: Stick to the specified brand colors for consistency with the promotional tile and overall branding.

**Q: What if I don't have Montserrat font?**
A: Use Inter Bold/Regular as alternative, or any clean sans-serif like Poppins or Roboto.

**Q: Can I skip overlays entirely?**
A: Yes! The captions alone work well. Overlays just add extra visual emphasis for competitive store listings.

---

**Ready to add overlays?** Follow the Canva quick implementation guide above for the fastest results!
