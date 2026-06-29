document.addEventListener('DOMContentLoaded', () => {
    // Application State
    let timelineData = [];
    let activeCategory = 'all';

    // DOM Elements
    const filterBar = document.getElementById('filter-bar');
    const timelineRoot = document.getElementById('timeline-root');

    // Category display name mapping
    const CATEGORIES = {
        'all': 'All Programs',
        'ai-command': 'AI Command & Control',
        'uuv': 'Unmanned Underwater (UUV)',
        'usv': 'Unmanned Surface (USV)',
        'robotics': 'Robotics & Land',
        'logistics': 'Tactical Logistics'
    };

    /**
     * Initialize the application: fetch data and render filters/timeline
     */
    async function init() {
        try {
            const response = await fetch('data.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            timelineData = await response.json();
            
            // Sort data chronologically (oldest event to newest)
            timelineData.sort((a, b) => {
                if (a.year !== b.year) {
                    return a.year - b.year;
                }
                // If years are identical, sort by ID to maintain deterministic order
                return a.id.localeCompare(b.id);
            });

            renderFilters();
            renderTimeline();
        } catch (error) {
            console.error('Failed to load timeline data:', error);
            timelineRoot.innerHTML = `
                <div class="error-state" style="padding: 3rem; text-align: center; border: 1px dashed #1e2733; border-radius: 8px;">
                    <p style="color: #64748b; margin-bottom: 1rem;">Failed to load timeline data. Please run this page through a local web server (such as 'npx serve .') due to browser security restrictions on local JSON fetching.</p>
                </div>
            `;
        }
    }

    /**
     * Render the filter bar pills
     */
    function renderFilters() {
        filterBar.innerHTML = '';

        // Generate dynamically based on categories in CATEGORIES mapping
        Object.entries(CATEGORIES).forEach(([key, label]) => {
            // Only show category if there are items of that category, or if it is 'all'
            const hasItems = key === 'all' || timelineData.some(item => item.category === key);
            if (!hasItems) return;

            const button = document.createElement('button');
            button.className = `filter-pill ${activeCategory === key ? 'active' : ''}`;
            button.dataset.category = key;
            button.textContent = label;

            button.addEventListener('click', () => {
                if (activeCategory === key) {
                    // Toggle off if already active (reverts to 'all')
                    activeCategory = 'all';
                } else {
                    activeCategory = key;
                }
                
                // Update active classes and re-render the timeline
                document.querySelectorAll('.filter-pill').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.category === activeCategory);
                });
                renderTimeline();
            });

            filterBar.appendChild(button);
        });
    }

    /**
     * Compute "Years in Development" meter (1 to 5 bars)
     * Rule: devYears = eventYear - devStartYear
     * We scale 10 years of development to the maximum 5-bar signal strength indicator.
     */
    function computeDevelopmentMeter(eventYear, devStartYear) {
        if (!devStartYear) return 1;
        const devYears = eventYear - devStartYear;
        // At least 1 bar if started. Max 5 bars (where 10+ years = 5 bars).
        // Scale is 2 years per bar.
        const barsCount = Math.max(1, Math.min(5, Math.ceil(devYears / 2)));
        return {
            years: devYears,
            bars: barsCount
        };
    }

    /**
     * Render the timeline grouped by year
     */
    function renderTimeline() {
        timelineRoot.innerHTML = '';

        // Filter the data
        const filteredData = activeCategory === 'all' 
            ? timelineData 
            : timelineData.filter(item => item.category === activeCategory);

        if (filteredData.length === 0) {
            timelineRoot.innerHTML = `
                <div style="text-align: center; padding: 4rem 2rem; color: #64748b; font-family: 'JetBrains Mono', monospace; font-size: 0.9rem;">
                    No entries matching selected filter criteria.
                </div>
            `;
            return;
        }

        // Group by year
        const groupedByYear = {};
        filteredData.forEach(item => {
            if (!groupedByYear[item.year]) {
                groupedByYear[item.year] = [];
            }
            groupedByYear[item.year].push(item);
        });

        // Year headers are sorted chronologically
        const sortedYears = Object.keys(groupedByYear).sort((a, b) => Number(a) - Number(b));

        sortedYears.forEach(year => {
            const yearGroupDiv = document.createElement('div');
            yearGroupDiv.className = 'year-group';

            // Year header pill
            const yearHeader = document.createElement('div');
            yearHeader.className = 'year-header';
            yearHeader.textContent = year;
            yearGroupDiv.appendChild(yearHeader);

            // Container for cards in this year
            const cardsList = document.createElement('div');
            cardsList.className = 'cards-list';

            groupedByYear[year].forEach(item => {
                const cardWrapper = document.createElement('div');
                cardWrapper.className = 'timeline-card-wrapper';

                const card = document.createElement('div');
                card.className = 'timeline-card';
                card.id = `card-${item.id}`;

                // Calculate development meter
                const meter = computeDevelopmentMeter(item.year, item.devStartYear);
                
                // Build dynamic meter bars HTML
                let meterBarsHTML = '';
                for (let i = 1; i <= 5; i++) {
                    const activeClass = i <= meter.bars ? 'active' : '';
                    meterBarsHTML += `<div class="meter-bar ${activeClass}"></div>`;
                }

                // Build Sources List HTML
                const sourcesHTML = item.sources && item.sources.length > 0
                    ? `
                    <div class="sources-container">
                        <div class="sources-title">Verified Public Sources</div>
                        <ul class="sources-list">
                            ${item.sources.map(src => `
                                <li class="source-item">
                                    <a href="${src.url}" target="_blank" rel="noopener noreferrer">
                                        <span>${src.label}</span>
                                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block; margin-left:2px; vertical-align:middle;">
                                            <path d="M3.5 1.5H10.5M10.5 1.5V8.5M10.5 1.5L1.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                    </a>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                    ` : '';

                // Set card content
                card.innerHTML = `
                    <div class="card-pre-header">
                        <span class="label-caps">United States &middot; ${CATEGORIES[item.category] || item.category}</span>
                        <div class="expand-indicator">
                            <span>Details</span>
                            <svg class="expand-icon" width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                    </div>
                    
                    <h3 class="card-title">${item.title}</h3>
                    
                    <div class="card-meta">
                        <span class="meta-actors">${item.actors}</span>
                        <span class="meta-separator">&middot;</span>
                        <span class="meta-date">${item.eventDate}</span>
                    </div>
                    
                    <p class="card-summary">${item.summary}</p>
                    
                    <div class="card-footer">
                        <span class="category-pill cat-${item.category}">${item.category.replace('-', ' ')}</span>
                        
                        <div class="meter-container" title="Development span: ${meter.years} year${meter.years !== 1 ? 's' : ''} (scale: 10 max)">
                            <span class="meter-label">Dev Cycle</span>
                            <div class="meter-bars">
                                ${meterBarsHTML}
                            </div>
                        </div>
                    </div>

                    <!-- Accordion expandable card details -->
                    <div class="card-details-panel">
                        <div class="panel-content">
                            <p class="details-text">${item.details}</p>
                            ${sourcesHTML}
                        </div>
                    </div>
                `;

                // Handle click for expanding/collapsing card details
                card.addEventListener('click', (e) => {
                    // Prevent click trigger if user clicked on an external link
                    if (e.target.closest('.sources-container a')) {
                        return;
                    }

                    const detailsPanel = card.querySelector('.card-details-panel');
                    const isExpanded = card.classList.contains('is-expanded');

                    if (isExpanded) {
                        card.classList.remove('is-expanded');
                        detailsPanel.classList.remove('expanded');
                    } else {
                        card.classList.add('is-expanded');
                        detailsPanel.classList.add('expanded');
                    }
                });

                cardWrapper.appendChild(card);
                cardsList.appendChild(cardWrapper);
            });

            yearGroupDiv.appendChild(cardsList);
            timelineRoot.appendChild(yearGroupDiv);
        });
    }

    // Run the application
    init();
});