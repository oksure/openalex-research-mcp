// ─────────────────────────────────────────────────────────────────────────────
// VENUE PRESETS — curated journal & conference lists by academic ranking system
// ISSNs are used for journals (exact matches via | OR filter in OpenAlex).
// source_names are used for conferences (display_name OR filter).
// These lists match the official rankings as of 2025/2026.
// ─────────────────────────────────────────────────────────────────────────────

export interface VenuePreset {
  name: string;
  description: string;
  issns?: string[];
  source_names?: string[];
  note?: string;
}

export interface InstitutionGroup {
  name: string;
  description: string;
  institutions: string[];
}

export const VENUE_PRESETS: Record<string, VenuePreset> = {

  // ── UT Dallas 24 (UTD) ─────────────────────────────────────────────────────
  'utd24': {
    name: 'UT Dallas 24 (UTD)',
    description: 'Official UT Dallas journal list used for global business school research rankings',
    issns: [
      '0001-4826', '0001-8392', '0011-7315', '1042-2587', '0090-4848',
      '1047-7047', '0165-4101', '0021-8456', '0167-4544', '0883-9026',
      '1057-7408', '0093-5301', '0022-1082', '0022-1090', '0304-405X',
      '0047-2506', '0149-2063', '0742-1222', '0022-2380', '0022-2429',
      '0022-2437', '0272-6963', '0022-3808', '0022-4359', '0276-7783',
      '0025-1909', '1523-4614', '0732-2399', '0030-364X', '1047-7039',
      '1059-1478', '1380-6653', '0893-9454', '0143-2095',
    ],
  },

  // ── Financial Times 50 (FT50) ──────────────────────────────────────────────
  'ft50': {
    name: 'FT50 Journals',
    description: 'Financial Times 50 journals — used for FT global MBA/business school rankings',
    issns: [
      '0001-4826', '0361-3682', '0001-8392', '0002-8282', '0823-9150',
      '0011-7315', '0012-9682', '1042-2587', '0018-7267', '0090-4848',
      '1047-7047', '0165-4101', '0021-8456', '0021-9010', '0167-4544',
      '0883-9026', '1057-7408', '0093-5301', '1058-6407', '0022-1082',
      '0022-1090', '0304-405X', '0047-2506', '0149-2063', '0742-1222',
      '0022-2380', '0022-2429', '0022-2437', '0272-6963', '0022-3808',
      '0022-4359', '0092-0703', '0276-7783', '0025-1909', '1523-4614',
      '0732-2399', '0030-364X', '1047-7039', '0170-8406', '1059-1478',
      '0033-5533', '0741-6261', '0048-7333', '1380-6653', '0034-6527',
      '1572-3097', '0893-9454', '1532-9194', '0143-2095', '0734-306X',
      '0008-1256',
    ],
  },

  // ── AJG / ABS 4* ────────────────────────────────────────────────────────────
  'abs4star': {
    name: 'AJG/ABS 4* (World Elite)',
    description: 'Chartered ABS Academic Journal Guide 4* — world elite journals, the most prestigious tier',
    issns: [
      '0001-8392', '0002-8282', '0012-9682', '0021-9010', '1057-7408',
      '0093-5301', '0022-1082', '0304-405X', '0149-2063', '0022-2429',
      '0276-7783', '0025-1909', '0030-364X', '1047-7039', '0022-3808',
      '0033-5533', '0741-6261', '0034-6527', '0893-9454', '0143-2095',
      '0022-2380', '0047-2506', '1047-7047', '0165-4101',
    ],
    note: 'Representative 4* journals. The full AJG list covers 100+ categories — add ISSNs for your specific subfield.',
  },

  // ── AJG / ABS 4 ─────────────────────────────────────────────────────────────
  'abs4': {
    name: 'AJG/ABS 4 (Top International)',
    description: 'ABS Academic Journal Guide 4 — top international journals, excellent quality',
    issns: [
      '0001-4826', '0823-9150', '0011-7315', '1042-2587', '0018-7267',
      '0090-4848', '0021-8456', '0167-4544', '0883-9026', '0022-1090',
      '0742-1222', '0022-2437', '0272-6963', '0022-4359', '1523-4614',
      '0732-2399', '0170-8406', '1059-1478', '0048-7333', '1380-6653',
      '1572-3097', '0165-4101', '0092-0703', '1058-6407', '0361-3682',
      '0734-306X',
    ],
    note: 'Representative AJG 4 journals. The full AJG list covers 100+ categories.',
  },

  // ── AJG / ABS 3 ─────────────────────────────────────────────────────────────
  'abs3': {
    name: 'AJG/ABS 3 (Internationally Recognised)',
    description: 'ABS Academic Journal Guide 3 — internationally recognised, solid quality journals',
    issns: [
      '0008-1256', '1532-9194', '0017-8012', '0022-2399', '1462-8732',
      '0925-5273', '0969-7012', '0263-2373', '0305-0483', '1366-4387',
      '0148-2963', '1059-1478', '0020-7543', '1757-5818',
    ],
    note: 'Representative AJG 3 journals. The AJG 3 tier has 500+ journals — these are key examples across business disciplines.',
  },

  // ── Management Science + Operations Journals ────────────────────────────────
  'ms_misq_ops': {
    name: 'Management Science + IS + Operations Core',
    description: 'Management Science, M&SOM, MIS Quarterly, ISR, JMIS, Operations Research, POM — the core quant-methods journals in business',
    issns: [
      '0025-1909', '1523-4614', '0276-7783', '1047-7047', '0742-1222',
      '0030-364X', '1059-1478', '0272-6963', '0732-2399',
    ],
  },

  // ── Top AI Conferences ──────────────────────────────────────────────────────
  'top_ai_conferences': {
    name: 'Top AI Conferences',
    description: 'Leading AI/ML conference proceedings: NeurIPS, ICML, ICLR, AAAI, CVPR, ICCV, ECCV, ACL, EMNLP, KDD, IJCAI',
    source_names: [
      'Advances in Neural Information Processing Systems',
      'International Conference on Machine Learning',
      'International Conference on Learning Representations',
      'Proceedings of the AAAI Conference on Artificial Intelligence',
      'IEEE/CVF Conference on Computer Vision and Pattern Recognition',
      'International Conference on Computer Vision',
      'European Conference on Computer Vision',
      'Proceedings of the Annual Meeting of the Association for Computational Linguistics',
      'Proceedings of the Conference on Empirical Methods in Natural Language Processing',
      'Proceedings of the ACM SIGKDD Conference on Knowledge Discovery and Data Mining',
      'International Joint Conference on Artificial Intelligence',
      'The Web Conference',
    ],
    note: 'Conference names match OpenAlex display_name. If a conference is missing, look it up via search_sources.',
  },

  // ── Top CS/Systems Conferences ─────────────────────────────────────────────
  'top_cs_conferences': {
    name: 'Top CS Systems & HCI Conferences',
    description: 'Top systems, HCI, and networking conferences: SOSP, OSDI, SIGCOMM, CHI, UIST, VLDB, SIGMOD, PLDI, POPL',
    source_names: [
      'Symposium on Operating Systems Principles',
      'USENIX Symposium on Operating Systems Design and Implementation',
      'ACM SIGCOMM Conference',
      'Proceedings of the ACM CHI Conference on Human Factors in Computing Systems',
      'UIST',
      'Proceedings of the VLDB Endowment',
      'International Conference on Management of Data',
      'Programming Language Design and Implementation',
      'Principles of Programming Languages',
    ],
  },

  // ── Nature / Science family ─────────────────────────────────────────────────
  'nature_science': {
    name: 'Nature & Science Family',
    description: 'Nature, Science, and their branded sub-journals — highest prestige multidisciplinary outlets',
    issns: [
      '0028-0836', '0036-8075', '1745-2473', '1745-2481', '2041-1723',
      '1755-4330', '1087-0156', '1548-7091', '1476-4687', '2052-4463',
    ],
    note: 'Core Nature/Science family. Sub-journal ISSNs vary — verify via check_venue_quality for specific sub-journals.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// INSTITUTION GROUPS — named presets for filtering by author affiliation.
// Institution names match OpenAlex display_name (case-insensitive exact match).
// Use | separator for OR across multiple institutions in one API call.
// ─────────────────────────────────────────────────────────────────────────────
export const INSTITUTION_GROUPS: Record<string, InstitutionGroup> = {
  'harvard_stanford_mit': {
    name: 'Harvard / Stanford / MIT',
    description: 'Big Three US research universities',
    institutions: ['Harvard University', 'Stanford University', 'Massachusetts Institute of Technology'],
  },
  'ivy_league': {
    name: 'Ivy League',
    description: 'All eight Ivy League universities',
    institutions: [
      'Harvard University', 'Yale University', 'Princeton University',
      'Columbia University', 'University of Pennsylvania', 'Brown University',
      'Dartmouth College', 'Cornell University',
    ],
  },
  'top_us': {
    name: 'Top US Research Universities',
    description: 'Top 10 US research universities by research output',
    institutions: [
      'Harvard University', 'Stanford University', 'Massachusetts Institute of Technology',
      'University of California, Berkeley', 'California Institute of Technology',
      'University of Chicago', 'Princeton University', 'Yale University',
      'Columbia University', 'University of Pennsylvania',
    ],
  },
  'top_us_business': {
    name: 'Top US Business Schools',
    description: 'Harvard, Stanford, Wharton, Booth, Kellogg, Sloan, Columbia, Stern, Darden, Tuck',
    institutions: [
      'Harvard University', 'Stanford University', 'University of Pennsylvania',
      'University of Chicago', 'Northwestern University', 'Massachusetts Institute of Technology',
      'Columbia University', 'New York University', 'University of Virginia',
      'Dartmouth College',
    ],
  },
  'insead_london': {
    name: 'INSEAD + London Schools',
    description: 'INSEAD, London Business School, Imperial, LSE, Oxford, Cambridge',
    institutions: [
      'INSEAD', 'London Business School', 'Imperial College London',
      'London School of Economics and Political Science', 'University of Oxford',
      'University of Cambridge',
    ],
  },
  'top_global_business': {
    name: 'Top Global Business Schools',
    description: 'Elite global business schools for management research',
    institutions: [
      'Harvard University', 'Stanford University', 'University of Pennsylvania',
      'INSEAD', 'London Business School', 'University of Chicago',
      'Massachusetts Institute of Technology', 'Northwestern University',
      'Columbia University', 'University of Oxford', 'University of Cambridge',
    ],
  },
  'top_china': {
    name: 'Top Chinese Universities',
    description: 'Peking University, Tsinghua, Fudan, Shanghai Jiao Tong, ZJU, CUHK',
    institutions: [
      'Peking University', 'Tsinghua University', 'Fudan University',
      'Shanghai Jiao Tong University', 'Zhejiang University',
      'Chinese University of Hong Kong', 'University of Hong Kong',
    ],
  },
};
