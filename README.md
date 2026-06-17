# U.S. Military AI Timeline

An interactive timeline tracking key research, testing, and deployment milestones of United States military artificial intelligence programs. Designed as a clean, responsive, editorial data dashboard, this project uses plain HTML/CSS/JS without any framework or build steps to remain highly transportable and easy to maintain.

---

## Quick Start

To run this project locally, navigate to the project directory and start any simple static server:

```bash
# Using Node.js (highly recommended)
npx serve .

# Or using Python 3
python3 -m http.server 8000

# Or using Ruby
ruby -run -e httpd . -p 8000
```

Once running, open the provided URL (typically `http://localhost:3000` or `http://localhost:8000`) in your web browser.

---

## Project Structure

```text
us-military-ai-timeline/
├── index.html     # HTML page shell and layouts
├── style.css      # Custom dark-theme styles, variables, typography, and animations
├── app.js         # Interactive application logic, filters, and dynamic calculations
├── data.json      # Structured program database of entries
└── README.md      # Detailed documentation (this file)
```

---

## Data Schema (`data.json`)

All timeline events are configured inside the `data.json` array. Adding, modifying, or removing entries from this file updates the web page automatically without requiring changes to the HTML layout or core JS scripts.

Each object in the array represents a single event entry and must follow this structure:

| Field | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Unique slug/identifier for the entry. Must be unique across all entries. | `"manta-ray-xl-uuv"` |
| `title` | `string` | Clear, concise name of the program or specific test event. | `"Northrop Grumman Manta Ray XL-UUV"` |
| `year` | `integer` | The 4-digit calendar year used to group entries on the timeline. | `2024` |
| `eventDate` | `string` | A more specific textual date or season representing the log entry. | `"Feb–Mar 2024"` |
| `actors` | `string` | The organization, military branch, or vendors developing/evaluating the tech. | `"Northrop Grumman / DARPA"` |
| `category` | `string` | One of the pre-defined categories mapping to tag styles and filter options. | `"uuv"` |
| `devStartYear` | `integer` | The year development or research officially began for this project. | `2020` |
| `summary` | `string` | A 1-sentence description visible on the card front. | `"Autonomous, energy-efficient unmanned underwater vehicle..."` |
| `details` | `string` | Full descriptive paragraph revealed when clicking to expand the card. | `"DARPA's Manta Ray prototype successfully completed..."` |
| `sources` | `array` | A list of objects containing verifiable public links supporting the record. | `[{"label": "DARPA News", "url": "https://..."}]` |

## How to Add a New Timeline Entry

To introduce new events to the interactive page, follow these steps:

### 1. Update `data.json`
Append a new JSON object to the array in `data.json`. The timeline renderer (`app.js`) automatically reads the entry, sorts it chronologically with the others, groups it under the correct `year` header, and maps its category.

### 2. How `devStartYear` Affects the Development Meter
The signal-strength style "Dev Cycle" meter in the bottom-right corner of each card is calculated dynamically using the formula:
$$\text{devYears} = \text{year} - \text{devStartYear}$$
- **1 Bar:** $0\text{–}2$ years of active development.
- **2 Bars:** $3\text{–}4$ years of active development.
- **3 Bars:** $5\text{–}6$ years of active development.
- **4 Bars:** $7\text{–}8$ years of active development.
- **5 Bars:** $9\text{–}10+$ years of active development.

If your new entry has a long research trajectory (e.g., Project Maven started in 2017 with tests in 2026), its dev cycle is 9 years, rendering as a maximum 5-bar meter. A newly initiated program (e.g., starting in 2025 with tests in 2026) has a dev cycle of 1 year, yielding 1 active bar.

### 3. Category Mapping & Adding a Brand-New Category
Supported default categories include: `ai-command`, `uuv`, `usv`, `robotics`, and `logistics`.

If you add an entry with a brand-new category (e.g., `"space-defense"`):
1. **In `app.js`**, update the `CATEGORIES` constant near the top of the file to include your new slug and user-facing label:
   ```javascript
   const CATEGORIES = {
       // ... existing categories
       'space-defense': 'Space-Based Autonomy'
   };
   ```
2. **In `style.css`**, add CSS color variables for your new category in `:root` and write the corresponding tag styles:
   ```css
   :root {
       /* ... existing variables */
       --cat-space-defense: #ec4899; /* pink color */
       --cat-space-defense-bg: rgba(236, 72, 153, 0.1);
   }

   /* Add tag color styles */
   .cat-space-defense {
       background-color: var(--cat-space-defense-bg);
       color: var(--cat-space-defense);
       border: 1px solid rgba(236, 72, 153, 0.2);
   }
   ```

---

## Customization Notes

### Modifying Design Accent Colors
The site uses a dark, editorial, navy-inspired think-tank aesthetic. High-priority design variables are controlled using standard CSS Variables at the top of `style.css`:
- **Main Accent Color (U.S. Blue):** Modify `--accent-color: #3b82f6;` to adjust the color of the spine dots, small caps labels, and interactive states.
- **Background Palette:** Modify `--bg-color: #0b0f14;` (near-black navy background) and `--card-bg: #111827;` (rich grey-navy card surface) to change the background tones.

### Adjusting the Max Years for Development Cycle Meter
In `app.js`, the `computeDevelopmentMeter` function divides the development years by 2 (`Math.ceil(devYears / 2)`) to scale development up to 10 years over 5 bars. If you prefer each bar to represent a different increment (e.g., 1 year per bar up to 5 max), adjust the divisor in the formula:
```javascript
const barsCount = Math.max(1, Math.min(5, Math.ceil(devYears / 1))); // 1 year per bar
```

### Swapping Back to a Two-Country Layout
Should this tracker expand to support a dual-country layout (e.g., comparing United States vs. China program developments side-by-side):
1. **HTML/CSS Adjustment:** Currently, the cards use a single-column layout centered on the screen with the spine resting on the left margin. To introduce a side-by-side comparison, modify `style.css` to position the spine `.timeline-root::before` at `left: 50%; transform: translateX(-50%);`.
2. **Card Grid Alignment:** Style alternate wrapper cards (`.timeline-card-wrapper`) to shift left or right of the center line using `margin-left: 50%` or absolute left styling, using a country attribute (e.g., `data-country="us"` vs. `data-country="cn"`) to align the metadata indicators respectively.

## License & Attribution

Developed for the Special Competitive Studies Project by Kaci McBrayer, Amy Velnosky, and Nicolas Zarbin.
