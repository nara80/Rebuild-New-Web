# MildMate Website Performance Audit - Knowledge Base

## Overview
- **Audit Date:** May 18, 2026
- **Target URL:** `https://mildmate-new.pages.dev/`
- **Device:** Mobile
- **Overall Performance Score:** 54 / 100
- **Accessibility:** 93 | **Best Practices:** 100 | **SEO:** 100

## Core Web Vitals & Metrics
- **Largest Contentful Paint (LCP):** 4.1 s (Needs Improvement)
- **First Contentful Paint (FCP):** 2.5 s
- **Total Blocking Time (TBT):** 1,270 ms (High)
- **Speed Index:** 6.2 s
- **Cumulative Layout Shift (CLS):** 0 (Excellent)

## Key Performance Bottlenecks & Recommendations

### 1. Image Optimization & Delivery
Images are currently the largest drag on performance, specifically regarding the LCP and overall payload size.
- **Hero Image LCP Delay:** The LCP element is `Hero01.jpg`. It suffers from a massive "Element render delay" of 2,870 ms. 
  - *Action:* Ensure the hero image is preloaded (`<link rel="preload" as="image">`) and strictly **not** lazy-loaded. 
- **Oversized Images:** Multiple images (e.g., `logo.png`, `category-family.jpg`, `category-sheets.jpg`, `category-pets.jpg`) are served much larger than their displayed dimensions (e.g., serving 800x600 for a 665x499 display).
  - *Action:* Implement responsive images using `srcset` and `sizes` attributes to serve appropriately sized images based on the user's screen size.
- **Modern Formats:** - *Action:* Convert standard JPG/PNG assets to WebP or AVIF formats for an estimated savings of nearly 200 KiB.

### 2. Main-Thread Work & JavaScript Execution
The browser is spending too much time parsing and executing scripts, blocking the main thread and causing a severely high TBT (1,270 ms).
- **Excessive Style & Layout Time:** Main-thread work takes ~3.2 seconds total, with a staggering 2,731 ms dedicated purely to "Style & Layout".
- **Forced Reflows:** JavaScript is querying geometric properties after styles have been invalidated, causing costly forced reflows. 
  - *Action:* Review `js/nav.js` (specifically around line 14) which is contributing heavily (2,183 ms) to forced reflows. Batch your DOM reads and writes to avoid layout thrashing. Also review `js/reviews-carousel.js`.

### 3. Render-Blocking Resources
Initial rendering is delayed by resources sitting in the critical path (Estimated savings: 330 ms).
- **CSS & Fonts:** `/css/main.css` and Google Fonts are blocking the page's initial render.
  - *Action:* Defer non-critical CSS or inline critical CSS styles directly into the `<head>`. 
- **Minification:** - *Action:* Minify CSS (e.g., `main.css`) to reduce network payload sizes.

## Summary Action Plan for the Dev Team
1. **Immediate:** Fix `nav.js` to stop forced DOM reflows (this will drastically reduce the massive 2.7s layout time).
2. **High Priority:** Preload the main `Hero01.jpg` banner and resize all category thumbnails to strictly match their actual DOM container dimensions.
3. **Medium Priority:** Inline critical CSS, defer the rest, and set up an automated pipeline to serve images in next-gen formats (WebP/AVIF).
