#!/usr/bin/env node

// Quick test script to debug OpenAlex API calls
import axios from 'axios';

const email = process.env.OPENALEX_EMAIL || 'test@example.com';

async function testOpenAlexAPI() {
  console.log('Testing OpenAlex API...\n');

  // Test 1: Simple search with year filter
  console.log('Test 1: Simple search with year filter');
  try {
    const params = {
      search: 'AI safety',
      filter: 'from_publication_date:2020-01-01',
      per_page: 5,
      mailto: email
    };
    console.log('Request params:', JSON.stringify(params, null, 2));

    const response1 = await axios.get('https://api.openalex.org/works', { params });
    console.log('✓ Success! Status:', response1.status);
    console.log('  Results count:', response1.data.meta.count);
    console.log('  First result:', response1.data.results[0]?.title);
    console.log('');
  } catch (error) {
    console.log('✗ Failed!');
    if (error.response) {
      console.log('  Status:', error.response.status);
      console.log('  Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('  Error:', error.message);
    }
    console.log('');
  }

  // Test 2: Search with sort
  console.log('Test 2: Search with year filter and sort by citations');
  try {
    const params = {
      search: 'AI safety',
      filter: 'from_publication_date:2020-01-01',
      sort: 'cited_by_count:desc',
      per_page: 5,
      mailto: email
    };
    console.log('Request params:', JSON.stringify(params, null, 2));

    const response2 = await axios.get('https://api.openalex.org/works', { params });
    console.log('✓ Success! Status:', response2.status);
    console.log('  Results count:', response2.data.meta.count);
    console.log('  First result:', response2.data.results[0]?.title);
    console.log('  Citations:', response2.data.results[0]?.cited_by_count);
    console.log('');
  } catch (error) {
    console.log('✗ Failed!');
    if (error.response) {
      console.log('  Status:', error.response.status);
      console.log('  Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('  Error:', error.message);
    }
    console.log('');
  }

  // Test 3: Just year (no date)
  console.log('Test 3: Using just year format');
  try {
    const params = {
      search: 'AI safety',
      filter: 'from_publication_date:2020',
      per_page: 5,
      mailto: email
    };
    console.log('Request params:', JSON.stringify(params, null, 2));

    const response3 = await axios.get('https://api.openalex.org/works', { params });
    console.log('✓ Success! Status:', response3.status);
    console.log('  Results count:', response3.data.meta.count);
    console.log('');
  } catch (error) {
    console.log('✗ Failed!');
    if (error.response) {
      console.log('  Status:', error.response.status);
      console.log('  Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('  Error:', error.message);
    }
    console.log('');
  }

  // Test 4: No search, just filter
  console.log('Test 4: No search query, just filter');
  try {
    const params = {
      filter: 'from_publication_date:2020,cited_by_count:>100',
      sort: 'cited_by_count:desc',
      per_page: 5,
      mailto: email
    };
    console.log('Request params:', JSON.stringify(params, null, 2));

    const response4 = await axios.get('https://api.openalex.org/works', { params });
    console.log('✓ Success! Status:', response4.status);
    console.log('  Results count:', response4.data.meta.count);
    console.log('');
  } catch (error) {
    console.log('✗ Failed!');
    if (error.response) {
      console.log('  Status:', error.response.status);
      console.log('  Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('  Error:', error.message);
    }
    console.log('');
  }
}

testOpenAlexAPI().catch(console.error);
