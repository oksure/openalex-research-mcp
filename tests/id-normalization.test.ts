import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { OpenAlexClient } from '../src/openalex-client.js';

vi.mock('axios');

function createMockAxios(mockGet: any) {
  return {
    get: mockGet,
    interceptors: {
      response: {
        use: vi.fn(),
      },
    },
  };
}

describe('OpenAlexClient ID normalization', () => {
  it('should pass OpenAlex IDs as-is', async () => {
    const mockGet = vi.fn().mockResolvedValue({ data: { id: 'W12345' } });
    vi.mocked(axios.create).mockReturnValue(createMockAxios(mockGet) as any);

    const client = new OpenAlexClient({ enableCache: false });
    await client.getEntity('works', 'W12345');

    expect(mockGet).toHaveBeenCalledWith('/works/W12345', expect.any(Object));
  });

  it('should prefix bare DOIs with "doi:" to prevent path splitting', async () => {
    const mockGet = vi.fn().mockResolvedValue({ data: { id: 'W99' } });
    vi.mocked(axios.create).mockReturnValue(createMockAxios(mockGet) as any);

    const client = new OpenAlexClient({ enableCache: false });
    await client.getEntity('works', '10.48550/arXiv.2403.13093');

    expect(mockGet).toHaveBeenCalledWith(
      '/works/doi:10.48550/arXiv.2403.13093',
      expect.any(Object)
    );
  });

  it('should prefix standard DOIs with "doi:"', async () => {
    const mockGet = vi.fn().mockResolvedValue({ data: { id: 'W100' } });
    vi.mocked(axios.create).mockReturnValue(createMockAxios(mockGet) as any);

    const client = new OpenAlexClient({ enableCache: false });
    await client.getEntity('works', '10.1371/journal.pone.0000000');

    expect(mockGet).toHaveBeenCalledWith(
      '/works/doi:10.1371/journal.pone.0000000',
      expect.any(Object)
    );
  });

  it('should encode full DOI URLs to prevent absolute URL bypass', async () => {
    const mockGet = vi.fn().mockResolvedValue({ data: { id: 'W200' } });
    vi.mocked(axios.create).mockReturnValue(createMockAxios(mockGet) as any);

    const client = new OpenAlexClient({ enableCache: false });
    await client.getEntity('works', 'https://doi.org/10.48550/arXiv.2403.13093');

    expect(mockGet).toHaveBeenCalledWith(
      `/works/${encodeURIComponent('https://doi.org/10.48550/arXiv.2403.13093')}`,
      expect.any(Object)
    );
  });

  it('should encode arbitrary HTTPS URLs', async () => {
    const mockGet = vi.fn().mockResolvedValue({ data: { id: 'W300' } });
    vi.mocked(axios.create).mockReturnValue(createMockAxios(mockGet) as any);

    const client = new OpenAlexClient({ enableCache: false });
    await client.getEntity('works', 'https://proceedings.mlr.press/v206/pattathil23a.html');

    expect(mockGet).toHaveBeenCalledWith(
      `/works/${encodeURIComponent('https://proceedings.mlr.press/v206/pattathil23a.html')}`,
      expect.any(Object)
    );
  });

  it('should leave "doi:" prefixed IDs as-is', async () => {
    const mockGet = vi.fn().mockResolvedValue({ data: { id: 'W400' } });
    vi.mocked(axios.create).mockReturnValue(createMockAxios(mockGet) as any);

    const client = new OpenAlexClient({ enableCache: false });
    await client.getEntity('works', 'doi:10.48550/arXiv.2403.13093');

    expect(mockGet).toHaveBeenCalledWith(
      '/works/doi:10.48550/arXiv.2403.13093',
      expect.any(Object)
    );
  });
});
