#!/usr/bin/env node

/**
 * Integration tests for OpenAlex MCP Server
 * Tests actual API calls to OpenAlex
 */

import axios from 'axios';

const API_BASE = 'https://api.openalex.org';
const EMAIL = 'test@example.com';

// Track test results
const results = {
  passed: 0,
  failed: 0,
  errors: []
};

// Helper to make API calls with rate limiting
async function callAPI(path, params) {
  await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit: 1 req/sec to be safe
  try {
    const response = await axios.get(`${API_BASE}${path}`, {
      params: { ...params, mailto: EMAIL },
      headers: {
        'User-Agent': 'OpenAlexMCP-Test/1.0'
      }
    });
    return response;
  } catch (error) {
    console.log(`   Request URL: ${API_BASE}${path}`);
    console.log(`   Params:`, JSON.stringify(params));
    throw error;
  }
}

// Test runner
async function test(name, fn) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    await fn();
    console.log(`✅ PASS: ${name}`);
    results.passed++;
  } catch (error) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data:`, JSON.stringify(error.response.data));
    }
    results.failed++;
    results.errors.push({ test: name, error: error.message });
  }
}

// Main test suite
async function runTests() {
  console.log('🚀 Running OpenAlex MCP Integration Tests\n');
  console.log('=' .repeat(60));

  // Test 1: Basic search
  await test('Basic work search', async () => {
    const response = await callAPI('/works', {
      search: 'artificial intelligence',
      per_page: 5
    });
    if (response.data.meta.count === 0) throw new Error('No results returned');
    if (!response.data.results[0].title) throw new Error('Missing title in results');
  });

  // Test 2: Search with year filter (from_year only)
  await test('Search with from_year filter', async () => {
    const response = await callAPI('/works', {
      search: 'AI safety',
      filter: 'publication_year:>2019',
      per_page: 5
    });
    if (response.data.meta.count === 0) throw new Error('No results returned');
    const year = response.data.results[0].publication_year;
    if (year < 2020) throw new Error(`Expected year >= 2020, got ${year}`);
  });

  // Test 3: Search with year range
  await test('Search with year range filter', async () => {
    const response = await callAPI('/works', {
      search: 'machine learning',
      filter: 'publication_year:2020-2023',
      per_page: 5
    });
    if (response.data.meta.count === 0) throw new Error('No results returned');
    const year = response.data.results[0].publication_year;
    if (year < 2020 || year > 2023) {
      throw new Error(`Expected year 2020-2023, got ${year}`);
    }
  });

  // Test 4: Sort by citations
  await test('Sort by citation count', async () => {
    const response = await callAPI('/works', {
      search: 'neural networks',
      filter: 'publication_year:>2019',
      sort: 'cited_by_count:desc',
      per_page: 5
    });
    if (response.data.results.length < 2) throw new Error('Need at least 2 results');
    const first = response.data.results[0].cited_by_count;
    const second = response.data.results[1].cited_by_count;
    if (first < second) {
      throw new Error(`Citations not sorted: ${first} < ${second}`);
    }
  });

  // Test 5: Get single work by ID
  await test('Get single work by ID', async () => {
    const response = await callAPI('/works/W2741809807', {});
    if (!response.data.id) throw new Error('Missing ID in response');
    if (!response.data.title) throw new Error('Missing title in response');
  });

  // Test 6: Search authors
  await test('Search authors', async () => {
    const response = await callAPI('/authors', {
      search: 'Geoffrey Hinton',
      per_page: 5
    });
    if (response.data.meta.count === 0) throw new Error('No authors found');
    if (!response.data.results[0].display_name) throw new Error('Missing display_name');
  });

  // Test 7: Filter by citation count
  await test('Filter works by citation count', async () => {
    const response = await callAPI('/works', {
      filter: 'publication_year:2020,cited_by_count:>100',
      per_page: 5
    });
    if (response.data.meta.count === 0) throw new Error('No results returned');
    const citations = response.data.results[0].cited_by_count;
    if (citations <= 100) throw new Error(`Expected >100 citations, got ${citations}`);
  });

  // Test 8: Search institutions
  await test('Search institutions', async () => {
    const response = await callAPI('/institutions', {
      search: 'MIT',
      per_page: 5
    });
    if (response.data.meta.count === 0) throw new Error('No institutions found');
  });

  // Test 9: Filter by open access
  await test('Filter by open access', async () => {
    const response = await callAPI('/works', {
      filter: 'is_oa:true,publication_year:2023',
      per_page: 5
    });
    if (response.data.meta.count === 0) throw new Error('No OA works found');
    const isOA = response.data.results[0].open_access.is_oa;
    if (!isOA) throw new Error('Expected open access work');
  });

  // Test 10: Group by year (for trend analysis)
  await test('Group by publication year', async () => {
    const response = await callAPI('/works', {
      filter: 'publication_year:2020-2023',
      group_by: 'publication_year'
    });
    if (!response.data.group_by) throw new Error('No group_by data returned');
    if (response.data.group_by.length === 0) throw new Error('Empty group_by results');
  });

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Results:');
  console.log(`   ✅ Passed: ${results.passed}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log(`   Total:  ${results.passed + results.failed}`);

  if (results.failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.errors.forEach((e, i) => {
      console.log(`   ${i + 1}. ${e.test}: ${e.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
