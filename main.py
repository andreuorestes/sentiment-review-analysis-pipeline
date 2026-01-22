import os
import logging
from flask import Flask, jsonify, render_template

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variables
REVIEWS_DATA = []
STARTUP_ERROR = None

try:
    import pandas as pd
except ImportError as e:
    STARTUP_ERROR = f"Failed to import pandas: {str(e)}"
    logger.error(STARTUP_ERROR)
    pd = None

app = Flask(__name__, template_folder='templates', static_folder='static')

def load_data():
    """Loads review data from the CSV file and groups by review."""
    global REVIEWS_DATA, STARTUP_ERROR
    
    if pd is None:
        return

    try:
        csv_path = 'data/dummy_data.csv' 
        # Check absolute path just in case
        abs_path = os.path.abspath(csv_path)
        logger.info(f"Attempting to load data from: {abs_path}")

        if not os.path.exists(csv_path):
            STARTUP_ERROR = f"Data file not found at {abs_path}"
            logger.error(STARTUP_ERROR)
            return

        df = pd.read_csv(csv_path)
        df = df.fillna('')

        # Define core columns that identify a unique review strictly
        # We exclude metadata like 'review_title', 'rate', 'image' from grouping key 
        # because slight variations or unique URLs in them can cause duplication.
        group_cols = ['review', 'translated_review', 'name', 'sex', 'date']
        
        # Check which of these actually exist in the dataframe
        available_cols = [c for c in group_cols if c in df.columns]
        
        # Group by the available identifying columns
        # For metadata fields that might vary or be missing, we take the first value (.iloc[0])
        aggregated = df.groupby(available_cols).agg({
            'rate': lambda x: x.iloc[0] if len(x) > 0 else '',
            'review_title': lambda x: x.iloc[0] if len(x) > 0 else '',
            'image': lambda x: x.iloc[0] if len(x) > 0 else '',
            'num_reviews_usuario': lambda x: x.iloc[0] if len(x) > 0 else '',
            'subcategory_fragment': lambda x: list(x),
            'subcategory_sentiment': lambda x: list(x),
            'category': lambda x: list(x),
            'subcategory': lambda x: list(x)
        }).reset_index()

        # Convert to list of dictionaries
        REVIEWS_DATA = aggregated.to_dict(orient='records')
        
        # Clean up the lists
        for r in REVIEWS_DATA:
            fragments = []
            for frag, sent, cat, subcat in zip(r['subcategory_fragment'], r['subcategory_sentiment'], r['category'], r['subcategory']):
                if frag: 
                    fragments.append({
                        'text': frag,
                        'sentiment': sent,
                        'category': cat,
                        'subcategory': subcat
                    })
            r['fragments'] = fragments
            
            del r['subcategory_fragment']
            del r['subcategory_sentiment']
            del r['category']
            del r['subcategory']

        logger.info(f"Successfully loaded {len(REVIEWS_DATA)} reviews.")
        STARTUP_ERROR = None # Clear any previous error

    except Exception as e:
        STARTUP_ERROR = f"Error loading data: {str(e)}"
        logger.error(STARTUP_ERROR)
        import traceback
        logger.error(traceback.format_exc())


@app.route('/')
def home():
    """Serves the main page."""
    return render_template('index.html')

@app.route('/api/reviews')
def get_reviews():
    """Returns reviews data as JSON or error info."""
    if STARTUP_ERROR:
        return jsonify({"error": STARTUP_ERROR, "details": "Check server logs for more info"}), 500
    return jsonify(REVIEWS_DATA)

@app.route('/health')
def health_check():
    return jsonify({
        "status": "ok" if not STARTUP_ERROR else "error",
        "reviews_count": len(REVIEWS_DATA),
        "startup_error": STARTUP_ERROR
    })

# Load data on startup
load_data()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=True)
