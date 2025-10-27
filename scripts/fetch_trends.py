#!/usr/bin/env python3
"""
Fetch trending topics from Google Trends
"""
from pytrends.request import TrendReq
import json

def get_trending_topics():
    """Fetch trending searches from Google Trends for United States"""
    try:
        print("🔍 Fetching trending topics from Google Trends...")
        pytrends = TrendReq()
        trending = pytrends.trending_searches(pn='united_states')

        # Convert to list
        trending_list = trending[0].tolist()

        print(f"✅ Found {len(trending_list)} trending topics:")
        for i, topic in enumerate(trending_list[:20], 1):
            print(f"  {i}. {topic}")

        # Create JSON output
        topics_json = []
        for i, topic in enumerate(trending_list[:12], 1):
            topics_json.append({
                'rank': i,
                'topic': topic,
                'mentions': 0  # Google Trends doesn't provide volume
            })

        # Save to file
        output_file = '/tmp/trending_topics.json'
        with open(output_file, 'w') as f:
            json.dump(topics_json, f, indent=2)

        print(f"\n💾 Saved to {output_file}")
        return topics_json

    except Exception as e:
        print(f"❌ Error fetching trends: {e}")
        return []

if __name__ == '__main__':
    get_trending_topics()
