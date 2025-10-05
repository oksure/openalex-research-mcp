#!/usr/bin/env node

// Test if User-Agent is causing issues
import axios from 'axios';

async function testUserAgent() {
  console.log('Test 1: Default axios (no custom headers)');
  try {
    const response = await axios.get('https://api.openalex.org/works', {
      params: { per_page: 1 }
    });
    console.log('✓ Success! Status:', response.status);
    console.log('');
  } catch (error) {
    console.log('✗ Failed:', error.response?.status, error.response?.data || error.message);
    console.log('');
  }

  console.log('Test 2: With custom User-Agent like our client');
  try {
    const client = axios.create({
      headers: {
        'User-Agent': 'OpenAlexMCP/1.0 (mailto:test@example.com)'
      }
    });
    const response = await client.get('https://api.openalex.org/works', {
      params: { per_page: 1 }
    });
    console.log('✓ Success! Status:', response.status);
    console.log('');
  } catch (error) {
    console.log('✗ Failed:', error.response?.status, error.response?.data || error.message);
    console.log('');
  }

  console.log('Test 3: With baseURL like our client');
  try {
    const client = axios.create({
      baseURL: 'https://api.openalex.org',
      headers: {
        'User-Agent': 'OpenAlexMCP/1.0'
      }
    });
    const response = await client.get('/works', {
      params: { per_page: 1 }
    });
    console.log('✓ Success! Status:', response.status);
    console.log('');
  } catch (error) {
    console.log('✗ Failed:', error.response?.status, error.response?.data || error.message);
    console.log('');
  }

  console.log('Test 4: With search parameter');
  try {
    const response = await axios.get('https://api.openalex.org/works', {
      params: {
        search: 'AI',
        per_page: 1
      }
    });
    console.log('✓ Success! Status:', response.status);
    console.log('  Title:', response.data.results[0]?.title);
    console.log('');
  } catch (error) {
    console.log('✗ Failed:', error.response?.status, error.response?.data || error.message);
    console.log('');
  }
}

testUserAgent().catch(console.error);
