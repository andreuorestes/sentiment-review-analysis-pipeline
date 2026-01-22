document.addEventListener('DOMContentLoaded', () => {
    fetchReviews();
});

async function fetchReviews() {
    const container = document.getElementById('reviews-container');
    try {
        constresponse = await fetch('/api/reviews');
        if (!response.ok) throw new Error('Failed to fetch reviews');

        const reviews = await response.json(); // These are now grouped reviews

        container.innerHTML = '';
        if (reviews.length === 0) {
            container.innerHTML = '<div class="loading">No reviews found.</div>';
            return;
        }

        reviews.forEach(review => {
            const card = createReviewCard(review);
            container.appendChild(card);
        });

    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<div class="loading">Error loading reviews. Is the backend running?</div>';
    }
}

function createReviewCard(data) {
    const template = document.getElementById('review-card-template');
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('.review-card');

    // -- Bind Data --

    // User Profile
    const nameStr = data.name || 'Anonymous';
    clone.querySelector('.user-name').textContent = nameStr;
    clone.querySelector('.avatar-initials').textContent = nameStr.charAt(0).toUpperCase();

    // Logic for Image/Sex if available, otherwise defaults
    if (data.image && data.image.startsWith('http')) {
        const avatarDiv = clone.querySelector('.avatar-circle');
        avatarDiv.style.backgroundImage = `url('${data.image}')`;
        avatarDiv.style.backgroundSize = 'cover';
        avatarDiv.style.backgroundPosition = 'center';
        avatarDiv.textContent = ''; // remove initials
    }

    const sex = data.sex || 'Unknown';
    // Country logic - 'idiom' might be the language/country code
    const lang = data.idiom || 'en';
    clone.querySelector('.country-text').textContent = lang.toUpperCase();
    // Just using a generic flag icon for now, could map lang to flag classes
    clone.querySelector('.flag-icon').classname = 'flag-icon'; // Reset if needed

    clone.querySelector('.user-sex').textContent = sex;
    clone.querySelector('.user-reviews-count').textContent = data.num_reviews_usuario || '1';

    // Review Content
    const rating = data.rate || data.nota_media || 0;
    clone.querySelector('.rating-score').textContent = rating;

    clone.querySelector('.review-title').textContent = data.review_title || 'Review';
    clone.querySelector('.review-date').textContent = data.date || '';

    const originalText = data.review || '';
    const translatedText = data.translated_review || originalText; // Fallback

    const textP = clone.querySelector('.review-text');
    textP.textContent = originalText;

    // -- Actions --

    const btnApplyAI = clone.querySelector('.btn-apply-ai');
    const btnAnalysis = clone.querySelector('.btn-analysis');
    const analysisPanel = clone.querySelector('.ai-analysis-panel');

    btnApplyAI.addEventListener('click', () => {
        // Toggle Logic
        // 1. Switch text to Translated Review
        // 2. Apply Highlights

        // Check if already applied
        if (btnApplyAI.classList.contains('active')) {
            // Revert? user didn't specify revert, but good UX
            // keeping it simple: just re-render highlights or do nothing
            return;
        }

        btnApplyAI.classList.add('active');
        btnApplyAI.innerHTML = '<i class="fa-solid fa-check"></i> AI Applied';

        // Process text with highlights
        const highlightedHTML = generateHighlightedText(translatedText, data.fragments);
        textP.innerHTML = highlightedHTML;

        // Show analysis panel if we have categories (optional, user asked for highlighting)
        // User said: "subrayar los distintos fragmentos... y luego abajo, clicaremos... se categorizaran (analysis)"
        // Let's keep Analysis button for metrics/categories list
    });

    btnAnalysis.addEventListener('click', () => {
        analysisPanel.classList.toggle('hidden');
        if (!analysisPanel.classList.contains('hidden')) {
            renderAnalysis(analysisPanel, data.fragments);
        }
    });

    return card;
}

function generateHighlightedText(fullText, fragments) {
    if (!fragments || fragments.length === 0) return fullText;

    // We need to replace occurrences of fragment text with spans
    // Challenge: Overlapping fragments or repeated substrings. 
    // Simplest approach: Replace substrings. 
    // Better approach: Find all indices, sort, and construct string.

    // Sort substrings by length descending to replace longest first (avoid partial replace issues)
    // BUT naive replaceAll might hit parts of other tags if we inserted tags.
    // So we should be careful. 

    // Let's use a robust approach: "Mark" the spots in the string.
    // or just assume fragments are distinct enough for a demo.

    let processedText = fullText;

    // We iterate specific fragments. 
    // Note: If multiple fragments are identical text but different sentiments, replaceAll handles all.
    // Ideally we'd map "subcategory_fragment" to the sentiment needed.

    fragments.forEach(frag => {
        if (!frag.text || frag.text.length < 2) return; // Skip empty/tiny

        const sentimentClass = getSentimentClass(frag.sentiment);
        const span = `<span class="${sentimentClass}" title="${frag.category} - ${frag.subcategory}">${frag.text}</span>`;

        // Replace: This is case-sensitive usually
        // Using split/join is safe for basic replacement
        processedText = processedText.split(frag.text).join(span);
    });

    return processedText;
}

function getSentimentClass(sentiment) {
    if (!sentiment) return 'highlight-neutral';
    const s = sentiment.toString().toLowerCase();
    if (s.includes('pos') || s === '1' || s === 'positive') return 'highlight-positive';
    if (s.includes('neg') || s === '0' || s === '-1' || s === 'negative') return 'highlight-negative';
    return 'highlight-neutral';
}

function renderAnalysis(panel, fragments) {
    // Show metrics or a list of categories
    if (!fragments || fragments.length === 0) {
        panel.innerHTML = 'No analysis data available.';
        return;
    }

    // Count sentiments
    let pos = 0, neg = 0, neu = 0;
    const cats = new Set();

    fragments.forEach(f => {
        const s = (f.sentiment || '').toLowerCase();
        if (s.includes('pos')) pos++;
        else if (s.includes('neg')) neg++;
        else neu++;

        if (f.category) cats.add(f.category);
    });

    const html = `
        <div style="display: flex; gap: 15px; flex-wrap: wrap;">
            <div><strong>Categories:</strong> ${Array.from(cats).join(', ')}</div>
            <div><strong>Metrics:</strong> 
                <span style="color: green">${pos} Positive</span>, 
                <span style="color: red">${neg} Negative</span>, 
                <span style="color: orange">${neu} Neutral</span>
            </div>
        </div>
    `;
    panel.innerHTML = html;
}
