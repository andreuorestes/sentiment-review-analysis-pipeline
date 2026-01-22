import os
import pandas as pd
from flask import Flask, jsonify, render_template

app = Flask(__name__, template_folder='templates', static_folder='static')

# Global variable to store reviews
REVIEWS_DATA = []

def load_data():
    """Loads review data from the CSV file and groups by review."""
    global REVIEWS_DATA
    try:
        csv_path = 'data/dummy_data.csv' 
        if not os.path.exists(csv_path):
            print(f"Error: Data file not found at {csv_path}")
            return

        df = pd.read_csv(csv_path)
        df = df.fillna('')

        # Define columns that identify a unique review
        # Based on user input: review, name, etc.
        # We'll use a subset of columns that should be unique to the review content
        group_cols = ['review', 'translated_review', 'name', 'sex', 'date', 'rate', 'review_title', 'image', 'num_reviews_usuario']
        
        # Check which of these actually exist in the dataframe to avoid errors
        available_cols = [c for c in group_cols if c in df.columns]
        
        # Group by the available identifying columns
        # We want to aggregate fragments and sentiments into lists
        aggregated = df.groupby(available_cols).agg({
            'subcategory_fragment': lambda x: list(x),
            'subcategory_sentiment': lambda x: list(x),
            'category': lambda x: list(x),
            'subcategory': lambda x: list(x)
        }).reset_index()

        # Convert to list of dictionaries
        REVIEWS_DATA = aggregated.to_dict(orient='records')
        
        # Clean up the lists (remove empty strings if any)
        for r in REVIEWS_DATA:
            fragments = []
            # Zip the lists to keep them synchronized
            for frag, sent, cat, subcat in zip(r['subcategory_fragment'], r['subcategory_sentiment'], r['category'], r['subcategory']):
                if frag: # Only add if fragment is not empty
                    fragments.append({
                        'text': frag,
                        'sentiment': sent,
                        'category': cat,
                        'subcategory': subcat
                    })
            r['fragments'] = fragments
            
            # Remove the raw lists to clean up the object
            del r['subcategory_fragment']
            del r['subcategory_sentiment']
            del r['category']
            del r['subcategory']

        print(f"Successfully loaded and grouped {len(REVIEWS_DATA)} unique reviews.")
    except Exception as e:
        print(f"Error loading data: {e}")


@app.route('/')
def home():
    """Serves the main page."""
    return render_template('index.html')

@app.route('/api/reviews')
def get_reviews():
    """Returns reviews data as JSON."""
    return jsonify(REVIEWS_DATA)

if __name__ == '__main__':
    load_data()
    # Run slightly different config for local vs cloud
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=True)
