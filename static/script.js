document.addEventListener('DOMContentLoaded', () => {
    fetchReviews();
});

async function fetchReviews() {
    const container = document.getElementById('reviews-container');
    try {
        const response = await fetch('/api/reviews');
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
    const card = document.createElement('div');
    card.className = 'review-card';

    // -- Make whole card clickable --
    if (data.review_url) {
        card.onclick = (e) => {
            // Prevent navigation if clicking buttons or interactions
            if (e.target.closest('button') || e.target.closest('.btn')) return;
            window.open(data.review_url, '_blank');
        };
        card.title = "View original review";
    }

    // 1. Title
    const titleDiv = document.createElement('div');
    titleDiv.className = 'review-card-title';
    titleDiv.textContent = data.review_title || 'Review';
    card.appendChild(titleDiv);

    // 2. User Info Row (Avatar + Name/Meta)
    const userRow = document.createElement('div');
    userRow.className = 'review-user-row';

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'avatar-circle';
    if (data.image && data.image.startsWith('http')) {
        avatar.style.backgroundImage = `url('${data.image}')`;
        avatar.style.backgroundSize = 'cover';
        avatar.style.backgroundPosition = 'center';
    } else {
        const initial = (data.name || 'A').charAt(0).toUpperCase();
        avatar.innerHTML = `<span class="avatar-initials">${initial}</span>`;
    }

    // Name + Meta
    const infoCol = document.createElement('div');
    infoCol.className = 'user-info-text';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'user-name';
    nameDiv.textContent = data.name || 'Anonymous';

    const metaDiv = document.createElement('div');
    metaDiv.className = 'user-meta-sub';

    // Gender Sign Logic
    let sexDisplay = data.sex || '?';
    if (sexDisplay === 'F') sexDisplay = '♀';
    if (sexDisplay === 'M') sexDisplay = '♂';

    // Idiom
    const lang = (data.idiom || 'en').toUpperCase();

    metaDiv.textContent = `${sexDisplay} • ${lang}`;

    infoCol.appendChild(nameDiv);
    infoCol.appendChild(metaDiv);

    userRow.appendChild(avatar);
    userRow.appendChild(infoCol);
    card.appendChild(userRow);

    // 3. URL Text (Visible link as requested "que puedas clicar su URL")
    if (data.review_url) {
        const urlDiv = document.createElement('div');
        urlDiv.className = 'review-url-tiny';
        urlDiv.textContent = data.review_url;
        card.appendChild(urlDiv);
    }

    // 4. Review Body
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'review-body';

    const textP = document.createElement('div');
    textP.className = 'review-text';
    textP.textContent = data.review || '';
    bodyDiv.appendChild(textP);
    card.appendChild(bodyDiv);

    // 5. Actions
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'review-actions';

    const btnApplyAI = document.createElement('button');
    btnApplyAI.className = 'btn btn-primary btn-apply-ai';
    btnApplyAI.innerHTML = 'Apply AI';

    btnApplyAI.onclick = (e) => {
        e.stopPropagation(); // Don't trigger card link
        btnApplyAI.classList.add('active');
        btnApplyAI.innerHTML = '<i class="fa-solid fa-check"></i> AI Applied';

        // Apply highlights
        const content = data.translated_review || data.review;
        const highlighted = generateHighlightedText(content, data.fragments);
        textP.innerHTML = highlighted;
    };

    const btnAnalysis = document.createElement('button');
    btnAnalysis.className = 'btn btn-secondary btn-analysis';
    btnAnalysis.innerHTML = '<i class="fa-solid fa-chart-line"></i> Analysis';

    actionsDiv.appendChild(btnApplyAI);
    actionsDiv.appendChild(btnAnalysis);
    card.appendChild(actionsDiv);

    // 6. Analysis Panel
    const analysisPanel = document.createElement('div');
    analysisPanel.className = 'ai-analysis-panel hidden';
    card.appendChild(analysisPanel);

    btnAnalysis.onclick = (e) => {
        e.stopPropagation();
        analysisPanel.classList.toggle('hidden');
        if (!analysisPanel.classList.contains('hidden')) {
            renderAnalysis(analysisPanel, data.fragments);
        }
    };

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
    // CRITICAL: Sort by length descending to ensure longer phrases are wrapped first.
    // This allows shorter phrases inside (or identical phrases) to nest correctly,
    // increasing opacity due to RGBA stacking.
    fragments.sort((a, b) => (b.text || '').length - (a.text || '').length);

    fragments.forEach(frag => {
        if (!frag.text || frag.text.length < 2) return; // Skip empty/tiny

        const sentimentClass = getSentimentClass(frag.sentiment);
        const span = `<span class="${sentimentClass}" title="${frag.category}"> ${frag.text} </span>`;

        // Replace: This is case-sensitive usually
        // Using split/join is safe for basic replacement
        // Note: nesting works because split finds text even inside existing tags if tags aren't inside the text
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
