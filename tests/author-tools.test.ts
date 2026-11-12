import { describe, it, expect, vi } from 'vitest';
import { getAuthorCollaborators, getAuthorProfile, getAuthorWorks, resolveAuthorId } from '../src/author-tools.js';

const AUTHOR = {
  id: 'https://openalex.org/A1234567890',
  display_name: 'Josiah Carberry',
  orcid: 'https://orcid.org/0000-0002-1825-0097',
  works_count: 10,
  cited_by_count: 100,
  summary_stats: { h_index: 5 },
  affiliations: [{ institution: { display_name: 'Example University', country_code: 'US' }, years: [2024] }],
};
const WORK = {
  id: 'https://openalex.org/W1',
  title: 'A work',
  authorships: [
    { author: { id: 'https://openalex.org/A1234567890', display_name: 'Josiah Carberry' } },
    { author: { id: 'https://openalex.org/A2', display_name: 'Coauthor' } },
  ],
};

function mockClient(author: any = AUTHOR) {
  return {
    getAuthor: vi.fn(async (_id: string) => author),
    getWorks: vi.fn(async (_options: any) => ({ meta: { count: 1 }, results: [WORK] })),
  };
}

const ORCID_FORMS = ['0000-0002-1825-0097', 'https://orcid.org/0000-0002-1825-0097'];
const OPENALEX_FORMS = ['A1234567890', 'https://openalex.org/A1234567890'];
const worksAuthorIds = (client: ReturnType<typeof mockClient>) =>
  client.getWorks.mock.calls.map(([options]) => options.filter['authorships.author.id']);

describe('resolveAuthorId', () => {
  it.each(OPENALEX_FORMS)('uses an OpenAlex ID as it is, without a lookup: %s', async (id) => {
    const client = mockClient();
    await expect(resolveAuthorId(client, id)).resolves.toEqual({ id: 'A1234567890' });
    expect(client.getAuthor).not.toHaveBeenCalled();
  });

  it('looks a bare ORCID up with the orcid: prefix', async () => {
    const client = mockClient();
    const resolved = await resolveAuthorId(client, '0000-0002-1825-0097');
    expect(client.getAuthor).toHaveBeenCalledWith('orcid:0000-0002-1825-0097');
    expect(resolved).toEqual({ id: 'A1234567890', author: AUTHOR });
  });

  it('fails when the lookup finds no author', async () => {
    const client = mockClient(null);
    await expect(resolveAuthorId(client, '0000-0000-0000-0000')).rejects.toThrow('Unable to resolve author ID');
  });
});

describe('author tool handlers', () => {
  it.each([...ORCID_FORMS, ...OPENALEX_FORMS])('get_author_profile sends the resolved ID for %s', async (id) => {
    const client = mockClient();
    const profile = await getAuthorProfile(client, { author_id: id, top_works_count: 1, recent_works_count: 1 });
    expect(worksAuthorIds(client)).toEqual(['A1234567890', 'A1234567890']);
    expect(profile.top_cited_works).toHaveLength(1);
    expect(profile.affiliations[0].institution).toBe('Example University');
  });

  it('get_author_profile reuses the author record fetched by the ORCID lookup', async () => {
    const client = mockClient();
    await getAuthorProfile(client, { author_id: '0000-0002-1825-0097' });
    expect(client.getAuthor).toHaveBeenCalledTimes(1);
  });

  it('get_author_profile fetches the record once for an OpenAlex ID', async () => {
    const client = mockClient();
    await getAuthorProfile(client, { author_id: 'A1234567890' });
    expect(client.getAuthor).toHaveBeenCalledTimes(1);
    expect(client.getAuthor).toHaveBeenCalledWith('A1234567890');
  });

  it.each([...ORCID_FORMS, ...OPENALEX_FORMS])('get_author_works sends the resolved ID for %s', async (id) => {
    const client = mockClient();
    await getAuthorWorks(client, { author_id: id, from_year: 2020 }, 10);
    expect(worksAuthorIds(client)).toEqual(['A1234567890']);
    expect(client.getWorks.mock.calls[0][0].filter.publication_year).toBe('>2019');
  });

  it.each(ORCID_FORMS)('get_author_collaborators resolves %s and leaves the author out', async (id) => {
    const client = mockClient();
    const result = await getAuthorCollaborators(client, { author_id: id }, 200);
    expect(worksAuthorIds(client)).toEqual(['A1234567890']);
    expect(result.collaborators.map((c) => c.id)).toEqual(['https://openalex.org/A2']);
  });

  it.each([
    ['get_author_profile', (c: any) => getAuthorProfile(c, { author_id: '0000-0000-0000-0000' })],
    ['get_author_works', (c: any) => getAuthorWorks(c, { author_id: '0000-0000-0000-0000' }, 10)],
    ['get_author_collaborators', (c: any) => getAuthorCollaborators(c, { author_id: '0000-0000-0000-0000' }, 200)],
  ])('%s fails without a works request when the lookup fails', async (_name, run) => {
    const client = mockClient();
    client.getAuthor.mockRejectedValueOnce(new Error('Request failed with status code 404'));
    await expect(run(client)).rejects.toThrow('404');
    expect(client.getWorks).not.toHaveBeenCalled();
  });
});
