export type ComplexScopeVariant = {
  scope: string;
  order: number;
};

type ComplexScopeTrieNode = {
  term?: string;
  children: Map<string, ComplexScopeTrieNode>;
};

function createComplexScopeTrieNode(): ComplexScopeTrieNode {
  return {
    children: new Map<string, ComplexScopeTrieNode>(),
  };
}

export class ComplexScopeTrie {
  readonly depth: number;
  readonly ordered: boolean;

  private readonly root: ComplexScopeTrieNode = createComplexScopeTrieNode();

  constructor(scopes: { [scope: string]: string }) {
    let maxDepth = 0;
    let ordered = false;

    for (const scope in scopes) {
      this.insert(scope, scopes[scope]);

      const depth = scope.split(">").length;
      if (depth > maxDepth) {
        maxDepth = depth;
      }

      if (scope.indexOf("[") >= 0) {
        ordered = true;
      }
    }

    this.depth = Math.max(maxDepth - 1, 0);
    this.ordered = ordered;
  }

  resolve(variants: ComplexScopeVariant[], ancestors: string[], maxDepth = this.depth) {
    let bestTerm: string | undefined;
    let bestDepth = -1;
    let bestOrder = -1;

    for (const variant of variants) {
      let depth = 1;
      let node = this.root.children.get(variant.scope);

      if (!node) {
        continue;
      }

      if (node.term) {
        bestTerm = node.term;
        bestDepth = depth;
        bestOrder = variant.order;
      }

      for (let i = 0; i < ancestors.length && i < maxDepth; i++) {
        node = node.children.get(ancestors[i]);

        if (!node) {
          break;
        }

        depth = i + 2;

        if (node.term && (depth > bestDepth || (depth === bestDepth && variant.order > bestOrder))) {
          bestTerm = node.term;
          bestDepth = depth;
          bestOrder = variant.order;
        }
      }
    }

    return bestTerm;
  }

  private insert(scope: string, term: string) {
    let node = this.root;

    for (const segment of scope.split(" > ").reverse()) {
      let next = node.children.get(segment);

      if (!next) {
        next = createComplexScopeTrieNode();
        node.children.set(segment, next);
      }

      node = next;
    }

    node.term = term;
  }
}
