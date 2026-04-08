import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';

import * as jsonc from 'jsonc-parser';

import { ComplexScopeTrie, ComplexScopeVariant } from '../src/ComplexScopeTrie';

type ComplexScopes = { [scope: string]: string };

type BenchmarkQuery = {
  grammar: string;
  scope: string;
  expected: string;
  variants: ComplexScopeVariant[];
  ancestors: string[];
};

const WARMUP_RUNS = 3;
const SAMPLE_RUNS = 5;
const DEFAULT_ITERATIONS = 5000;

function loadGrammarScopes() {
  const grammarsDir = path.resolve(__dirname, '../grammars');
  const grammarFiles = fs.readdirSync(grammarsDir)
    .filter(name => name.endsWith('.json'))
    .sort();

  return grammarFiles.map(fileName => {
    const filePath = path.join(grammarsDir, fileName);
    const grammarJson = jsonc.parse(fs.readFileSync(filePath, 'utf8')) as { complexScopes?: ComplexScopes };

    return {
      grammar: fileName,
      scopes: grammarJson.complexScopes || {},
    };
  });
}

function buildVariants(leaf: string): ComplexScopeVariant[] {
  const match = /^(.*?)(\[(-?\d+)\])?$/.exec(leaf);
  if (!match) {
    return [{ scope: leaf, order: 0 }];
  }

  const base = match[1];
  const indexText = match[3];

  if (!indexText) {
    return [{ scope: base, order: 0 }];
  }

  const index = Number(indexText);
  return [
    { scope: base, order: 0 },
    { scope: index >= 0 ? leaf : `${base}[0]`, order: 1 },
    { scope: index < 0 ? leaf : `${base}[-1]`, order: 2 },
  ];
}

function buildQueries(scopesByGrammar: { grammar: string; scopes: ComplexScopes }[]) {
  const queries: BenchmarkQuery[] = [];

  for (const entry of scopesByGrammar) {
    for (const scope in entry.scopes) {
      const segments = scope.split(' > ');
      const leaf = segments[segments.length - 1];

      queries.push({
        grammar: entry.grammar,
        scope,
        expected: entry.scopes[scope],
        variants: buildVariants(leaf),
        ancestors: segments.slice(0, -1).reverse(),
      });
    }
  }

  return queries;
}

function legacyResolve(scopes: ComplexScopes, query: BenchmarkQuery) {
  let term: string | undefined;

  for (const variant of query.variants) {
    let desc = variant.scope;

    if (desc in scopes) {
      term = scopes[desc];
    }

    for (let i = 0; i < query.ancestors.length; i++) {
      desc = `${query.ancestors[i]} > ${desc}`;

      if (desc in scopes) {
        term = scopes[desc];
      }
    }
  }

  return term;
}

function verifyQueries(scopesByGrammar: { grammar: string; scopes: ComplexScopes }[], queries: BenchmarkQuery[]) {
  const trieByGrammar = new Map<string, ComplexScopeTrie>();
  const scopeMapByGrammar = new Map<string, ComplexScopes>();

  for (const entry of scopesByGrammar) {
    trieByGrammar.set(entry.grammar, new ComplexScopeTrie(entry.scopes));
    scopeMapByGrammar.set(entry.grammar, entry.scopes);
  }

  for (const query of queries) {
    const trie = trieByGrammar.get(query.grammar)!;
    const scopes = scopeMapByGrammar.get(query.grammar)!;

    const legacyTerm = legacyResolve(scopes, query);
    const trieTerm = trie.resolve(query.variants, query.ancestors);

    if (legacyTerm !== query.expected || trieTerm !== query.expected) {
      throw new Error(
        [
          `Mismatch for ${query.grammar}: ${query.scope}`,
          `expected: ${query.expected}`,
          `legacy: ${legacyTerm}`,
          `trie: ${trieTerm}`,
        ].join('\n'));
    }
  }

  return { trieByGrammar, scopeMapByGrammar };
}

function runLegacy(scopeMapByGrammar: Map<string, ComplexScopes>, queries: BenchmarkQuery[], iterations: number) {
  let checksum = 0;

  for (let i = 0; i < iterations; i++) {
    for (const query of queries) {
      const term = legacyResolve(scopeMapByGrammar.get(query.grammar)!, query);
      checksum += term ? term.length : 0;
    }
  }

  return checksum;
}

function runTrie(trieByGrammar: Map<string, ComplexScopeTrie>, queries: BenchmarkQuery[], iterations: number) {
  let checksum = 0;

  for (let i = 0; i < iterations; i++) {
    for (const query of queries) {
      const term = trieByGrammar.get(query.grammar)!.resolve(query.variants, query.ancestors);
      checksum += term ? term.length : 0;
    }
  }

  return checksum;
}

function measure(name: string, run: () => number) {
  for (let i = 0; i < WARMUP_RUNS; i++) {
    run();
  }

  const samples: number[] = [];
  let checksum = 0;

  for (let i = 0; i < SAMPLE_RUNS; i++) {
    const start = performance.now();
    checksum = run();
    samples.push(performance.now() - start);
  }

  const averageMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const minMs = Math.min(...samples);
  const maxMs = Math.max(...samples);

  return {
    name,
    checksum,
    averageMs,
    minMs,
    maxMs,
  };
}

function main() {
  const iterations = Number(process.env.COMPLEX_SCOPE_BENCH_ITERATIONS || DEFAULT_ITERATIONS);
  const scopesByGrammar = loadGrammarScopes().filter(entry => Object.keys(entry.scopes).length > 0);
  const queries = buildQueries(scopesByGrammar);
  const { trieByGrammar, scopeMapByGrammar } = verifyQueries(scopesByGrammar, queries);

  const legacy = measure('legacy-flat-map', () => runLegacy(scopeMapByGrammar, queries, iterations));
  const trie = measure('trie', () => runTrie(trieByGrammar, queries, iterations));

  console.log(`Verified ${queries.length} benchmark queries across ${scopesByGrammar.length} grammars.`);
  console.log(`Iterations per sample: ${iterations}`);
  console.table([
    {
      implementation: legacy.name,
      averageMs: Number(legacy.averageMs.toFixed(2)),
      minMs: Number(legacy.minMs.toFixed(2)),
      maxMs: Number(legacy.maxMs.toFixed(2)),
      checksum: legacy.checksum,
    },
    {
      implementation: trie.name,
      averageMs: Number(trie.averageMs.toFixed(2)),
      minMs: Number(trie.minMs.toFixed(2)),
      maxMs: Number(trie.maxMs.toFixed(2)),
      checksum: trie.checksum,
    },
  ]);
  console.log(`Speedup: ${(legacy.averageMs / trie.averageMs).toFixed(2)}x`);
}

main();
