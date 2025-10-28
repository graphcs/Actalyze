/**
 * Example script to test SERPAPI trending topics
 *
 * Setup:
 * 1. Create .env file with: SERPAPI_KEY=your_key_here
 * 2. Build: npm run build
 * 3. Run: node --env-file=.env dist/trending/example.js
 *
 * Or use tsx directly:
 * SERPAPI_KEY=your_key tsx src/trending/example.ts
 */

import { getTrendingPoliticsUS } from './index';

async function run() {
  console.log('🚀 Fetching trending political topics from SERPAPI...\n');

  try {
    const items = await getTrendingPoliticsUS({
      maxItems: 15,
      minScore: 10,
    });

    console.log('\n📊 Results:\n');
    console.log(JSON.stringify(items, null, 2));

    console.log(`\n✅ Successfully fetched ${items.length} trending political topics`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

run();
