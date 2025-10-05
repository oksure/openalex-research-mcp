#!/usr/bin/env node

// Test different filter formats
import axios from 'axios';

const email = 'test@example.com';

async function testFilters() {
  console.log('Testing different filter formats...\n');

  // Test 1: No filter at all
  console.log('Test 1: No filter, just search');
  try {
    const params = {
      search: 'artificial intelligence',
      per_page: 3,
      mailto: email
    };
    const response = await axios.get('https://api.openalex.org/works', { params });
    console.log('✓ Success!');
    console.log('  First result:', response.data.results[0]?.title);
    console.log('');
  } catch (error) {
    console.log('✗ Failed:', error.response?.data || error.message);
    console.log('');
  }

  // Test 2: Try publication_year instead of from_publication_date
  console.log('Test 2: Using publication_year');
  try {
    const params = {
      search: 'AI',
      filter: 'publication_year:2020',
      per_page: 3,
      mailto: email
    };
    const response = await axios.get('https://api.openalex.org/works', { params });
    console.log('✓ Success!');
    console.log('  First result:', response.data.results[0]?.title);
    console.log('');
  } catch (error) {
    console.log('✗ Failed:', error.response?.data || error.message);
    console.log('');
  }

  // Test 3: Try with > operator for year
  console.log('Test 3: Using publication_year with > operator');
  try {
    const params = {
      search: 'AI',
      filter: 'publication_year:>2020',
      per_page: 3,
      mailto: email
    };
    const response = await axios.get('https://api.openalex.org/works', { params });
    console.log('✓ Success!');
    console.log('  First result:', response.data.results[0]?.title);
    console.log('  Year:', response.data.results[0]?.publication_year);
    console.log('');
  } catch (error) {
    console.log('✗ Failed:', error.response?.data || error.message);
    console.log('');
  }

  // Test 4: Direct URL query
  console.log('Test 4: Testing direct URL');
  try {
    const url = 'https://api.openalex.org/works?search=AI&filter=publication_year:>2020&per_page=3&mailto=' + email;
    console.log('  URL:', url);
    const response = await axios.get(url);
    console.log('✓ Success!');
    console.log('  Count:', response.data.meta.count);
    console.log('');
  } catch (error) {
    console.log('✗ Failed:', error.response?.data || error.message);
    console.log('');
  }

  // Test 5: From OpenAlex docs example
  console.log('Test 5: Using from_publication_date with just year');
  try {
    const url = 'https://api.openalex.org/works?filter=from_publication_date:2020&per_page=3&mailto=' + email;
    console.log('  URL:', url);
    const response = await axios.get(url);
    console.log('✓ Success!');
    console.log('  Count:', response.data.meta.count);
    console.log('');
  } catch (error) {
    console.log('✗ Failed:', error.response?.data || error.message);
    console.log('');
  }
}

testFilters().catch(console.error);
