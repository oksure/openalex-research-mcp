import { describe, it, expect } from 'vitest';
import { validateInput } from '../src/validation.js';
describe('Validation', () => {
    describe('validateInput', () => {
        it('should validate correct input', async () => {
            const { searchWorksSchema } = await import('../src/validation.js');
            const result = validateInput(searchWorksSchema, {
                query: 'machine learning',
                from_publication_year: 2020,
                to_publication_year: 2023,
            }, 'test');
            expect(result.query).toBe('machine learning');
            expect(result.from_publication_year).toBe(2020);
        });
        it('should throw on invalid input', async () => {
            const { searchWorksSchema } = await import('../src/validation.js');
            expect(() => {
                validateInput(searchWorksSchema, {
                    from_publication_year: 'not a number',
                }, 'test');
            }).toThrow();
        });
        it('should handle optional fields', async () => {
            const { searchWorksSchema } = await import('../src/validation.js');
            const result = validateInput(searchWorksSchema, {}, 'test');
            expect(result).toBeDefined();
        });
        it('should validate enum values', async () => {
            const { autocompleteSearchSchema } = await import('../src/validation.js');
            expect(() => {
                validateInput(autocompleteSearchSchema, {
                    query: 'test',
                    entity_type: 'invalid',
                }, 'test');
            }).toThrow();
            const valid = validateInput(autocompleteSearchSchema, {
                query: 'test',
                entity_type: 'works',
            }, 'test');
            expect(valid.entity_type).toBe('works');
        });
        it('should validate array fields', async () => {
            const { compareResearchAreasSchema } = await import('../src/validation.js');
            expect(() => {
                validateInput(compareResearchAreasSchema, {
                    topics: ['only one'],
                }, 'test');
            }).toThrow();
            const valid = validateInput(compareResearchAreasSchema, {
                topics: ['AI', 'ML'],
            }, 'test');
            expect(valid.topics).toHaveLength(2);
        });
    });
});
//# sourceMappingURL=validation.test.js.map