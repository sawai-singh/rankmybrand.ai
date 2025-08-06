// API Configuration
const API_BASE = 'http://localhost:8000/api/v1';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    setupFormHandlers();
    setupTabHandlers();
});

// Form handling
function setupFormHandlers() {
    const form = document.getElementById('geoForm');
    const content = document.getElementById('content');
    const charCount = document.getElementById('charCount');

    // Character counter
    content.addEventListener('input', () => {
        charCount.textContent = content.value.length;
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await analyzeContent();
    });
}

// Tab handling
function setupTabHandlers() {
    const tabButtons = document.querySelectorAll('.tab-button');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Update active states
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show corresponding panel
            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            document.getElementById(`${targetTab}-tab`).classList.add('active');
        });
    });
}

// Analyze content
async function analyzeContent() {
    const submitBtn = document.querySelector('button[type="submit"]');
    const submitText = document.getElementById('submitText');
    const spinner = document.getElementById('loadingSpinner');
    
    // Show loading state
    submitBtn.disabled = true;
    submitText.style.display = 'none';
    spinner.style.display = 'inline-block';
    
    try {
        // Gather form data
        const formData = {
            url: document.getElementById('url').value,
            content: document.getElementById('content').value,
            brand_terms: document.getElementById('brandTerms').value
                .split(',').map(t => t.trim()).filter(t => t),
            target_queries: document.getElementById('targetQueries').value
                .split(',').map(t => t.trim()).filter(t => t),
            check_ai_visibility: document.getElementById('checkAI').checked
        };
        
        // Make API request
        const response = await fetch(`${API_BASE}/geo/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        displayResults(result);
        
    } catch (error) {
        console.error('Analysis error:', error);
        alert('Error analyzing content. Please try again.');
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        submitText.style.display = 'inline';
        spinner.style.display = 'none';
    }
}

// Display results
function displayResults(data) {
    // Show results section
    document.getElementById('results').style.display = 'block';
    
    // Animate to results
    document.getElementById('results').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
    
    // Display overall score
    displayGeoScore(data.geo_score);
    
    // Display confidence
    document.getElementById('confidence').textContent = data.confidence;
    document.getElementById('confidence').className = `confidence-${data.confidence}`;
    
    // Display individual metrics
    displayMetrics(data.metrics);
    
    // Display recommendations
    displayRecommendations(data.recommendations);
    
    // Display detailed metrics
    if (data.detailed_metrics) {
        displayDetailedMetrics(data.detailed_metrics);
    }
}

// Animate GEO score
function displayGeoScore(score) {
    const scoreElement = document.getElementById('geoScore');
    const circle = document.getElementById('scoreCircle');
    const circumference = 2 * Math.PI * 90;
    
    // Animate number
    animateNumber(scoreElement, 0, score, 1000);
    
    // Animate circle
    const offset = circumference - (score / 100) * circumference;
    circle.style.strokeDashoffset = offset;
    
    // Color based on score
    if (score >= 80) {
        circle.style.stroke = '#4CAF50';
    } else if (score >= 60) {
        circle.style.stroke = '#FF9800';
    } else {
        circle.style.stroke = '#f44336';
    }
}

// Display individual metrics
function displayMetrics(metrics) {
    Object.entries(metrics).forEach(([key, value]) => {
        const scoreElement = document.getElementById(`${key}Score`);
        const barElement = document.getElementById(`${key}Bar`);
        
        if (scoreElement && barElement) {
            scoreElement.textContent = Math.round(value);
            barElement.style.width = `${value}%`;
            
            // Color coding
            if (value >= 80) {
                barElement.style.backgroundColor = '#4CAF50';
            } else if (value >= 60) {
                barElement.style.backgroundColor = '#FF9800';
            } else {
                barElement.style.backgroundColor = '#f44336';
            }
        }
    });
}

// Display recommendations
function displayRecommendations(recommendations) {
    const container = document.getElementById('recommendationsList');
    container.innerHTML = '';
    
    recommendations.forEach(rec => {
        const recElement = document.createElement('div');
        recElement.className = `recommendation ${rec.priority}`;
        recElement.innerHTML = `
            <div class="rec-header">
                <span class="rec-priority">${rec.priority.toUpperCase()}</span>
                <span class="rec-metric">${rec.metric}</span>
            </div>
            <div class="rec-action">${rec.action}</div>
            <div class="rec-impact">${rec.impact}</div>
        `;
        container.appendChild(recElement);
    });
}

// Display detailed metrics
function displayDetailedMetrics(detailed) {
    // Statistics details
    if (detailed.statistics) {
        const statsHtml = `
            <p><strong>Score:</strong> ${Math.round(detailed.statistics.score)}/100</p>
            <p><strong>Statistics Found:</strong> ${detailed.statistics.count}</p>
            <p><strong>Density:</strong> ${detailed.statistics.density.toFixed(2)} per 150 words</p>
            <p><strong>Examples:</strong></p>
            <ul>
                ${detailed.statistics.examples.map(ex => 
                    `<li>${ex.value} (${ex.type})</li>`
                ).join('')}
            </ul>
            <p><strong>Recommendation:</strong> ${detailed.statistics.recommendation}</p>
        `;
        document.getElementById('statisticsDetails').innerHTML = statsHtml;
    }
    
    // Quotations details
    if (detailed.quotation) {
        const quotesHtml = `
            <p><strong>Score:</strong> ${Math.round(detailed.quotation.score)}/100</p>
            <p><strong>Quotes Found:</strong> ${detailed.quotation.count}</p>
            <p><strong>Attributed:</strong> ${detailed.quotation.attributed_count}</p>
            <p><strong>Average Authority:</strong> ${(detailed.quotation.avg_authority * 100).toFixed(0)}%</p>
            <p><strong>Examples:</strong></p>
            <ul>
                ${detailed.quotation.quotes.map(q => 
                    `<li>"${q.text}" - ${q.source} (${q.type})</li>`
                ).join('')}
            </ul>
            <p><strong>Recommendation:</strong> ${detailed.quotation.recommendation}</p>
        `;
        document.getElementById('quotationsDetails').innerHTML = quotesHtml;
    }
    
    // Fluency details
    if (detailed.fluency) {
        const fluencyHtml = `
            <p><strong>Score:</strong> ${Math.round(detailed.fluency.score)}/100</p>
            <p><strong>Average Sentence Length:</strong> ${detailed.fluency.avg_sentence_length.toFixed(1)} words</p>
            <p><strong>Sentence Variety:</strong> ${detailed.fluency.sentence_variance.toFixed(1)}</p>
            <p><strong>Paragraph Count:</strong> ${detailed.fluency.paragraph_count}</p>
            <p><strong>Transition Density:</strong> ${detailed.fluency.transition_density.toFixed(2)}</p>
            <div class="metric-breakdown">
                ${Object.entries(detailed.fluency.metrics).map(([key, value]) => `
                    <div class="mini-metric">
                        <span>${key.replace(/_/g, ' ')}</span>
                        <div class="mini-bar">
                            <div class="mini-fill" style="width: ${value}%"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <p><strong>Recommendation:</strong> ${detailed.fluency.recommendation}</p>
        `;
        document.getElementById('fluencyDetails').innerHTML = fluencyHtml;
    }
    
    // AI Visibility details
    if (detailed.ai_visibility && detailed.ai_visibility.data) {
        const visData = detailed.ai_visibility.data;
        const visHtml = `
            <p><strong>Visibility Score:</strong> ${Math.round(detailed.ai_visibility.score)}/100</p>
            <p><strong>Queries Checked:</strong> ${visData.summary.total_queries}</p>
            <p><strong>Total Mentions:</strong> ${visData.summary.total_mentions}</p>
            <p><strong>Platforms:</strong> ${visData.summary.platforms_checked.join(', ')}</p>
            
            <h4>Platform Breakdown:</h4>
            <div class="platform-results">
                ${visData.details.map(d => `
                    <div class="query-result">
                        <p><strong>Query:</strong> "${d.query}"</p>
                        <ul>
                            ${Object.entries(d.platforms).map(([platform, result]) => `
                                <li>${platform}: ${result.found ? '✓ Found' : '✗ Not Found'}</li>
                            `).join('')}
                        </ul>
                    </div>
                `).join('')}
            </div>
        `;
        document.getElementById('aiVisibilityDetails').innerHTML = visHtml;
    }
}

// Utility: Animate number
function animateNumber(element, start, end, duration) {
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    function update() {
        const now = Date.now();
        const progress = Math.min((now - startTime) / duration, 1);
        
        const currentValue = Math.floor(start + (end - start) * progress);
        element.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}
