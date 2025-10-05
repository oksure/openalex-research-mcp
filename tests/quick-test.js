#!/usr/bin/env node

/**
 * Quick smoke test - validates core functionality
 * Use this before releases to ensure basic operations work
 */

import axios from 'axios';

const API_BASE = 'https://api.openalex.org';
const DELAY = 2000; // 2 seconds between requests

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test(name, fn) {
  try {
    process.stdout.write(`${name}... `);
    await fn();
    console.log('✅');
    return true;
  } catch (error) {
    console.log(`❌`);
    console.log(`  Error: ${error.message}`);
    if (error.response) {
      console.log(`  Status: ${error.response.status}`);
      console.log(`  Data:`, error.response.data);
    }
    return false;
  }
}

async function runQuickTests() {
  console.log('\n🧪 Running Quick Smoke Tests\n');

  const results = [];

  // Test 1: Basic search
  await sleep(DELAY);
  results.push(await test('Basic search works', async () => {
    const response = await axios.get(`${API_BASE}/works`, {
      params: { search: 'quantum', per_page: 1 }
    });
    if (!response.data.results[0]) throw new Error('No results');
  }));

  // Test 2: Filter by year
  await sleep(DELAY);
  results.push(await test('Year filter works', async () => {
    const response = await axios.get(`${API_BASE}/works`, {
      params: {
        filter: 'publication_year:>2020',
        per_page: 1
      }
    });
    if (response.data.results[0].publication_year <= 2020) {
      throw new Error('Year filter not working');
    }
  }));

  // Test 3: Search + Filter + Sort (the full combo)
  await sleep(DELAY);
  results.push(await test('Search + filter + sort combo works', async () => {
    const response = await axios.get(`${API_BASE}/works`, {
      params: {
        search: 'machine learning',
        filter: 'publication_year:>2019',
        sort: 'cited_by_count:desc',
        per_page: 2
      }
    });
    if (response.data.results.length < 2) throw new Error('Not enough results');
    // Check citations are descending
    const first = response.data.results[0].cited_by_count;
    const second = response.data.results[1].cited_by_count;
    if (first < second) throw new Error('Sort not working');
  }));

  // Test 4: Get single entity
  await sleep(DELAY);
  results.push(await test('Get single work by ID', async () => {
    const response = await axios.get(`${API_BASE}/works/W2741809807`);
    if (!response.data.title) throw new Error('No title returned');
  }));

  // Print summary
  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log(`\n📊 Results: ${passed}/${total} passed`);

  if (passed === total) {
    console.log('🎉 All critical tests passed!\n');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Review errors above.\n');
    process.exit(1);
  }
}

console.log('⏳ Note: Tests run slowly to respect OpenAlex rate limits');
runQuickTests().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
