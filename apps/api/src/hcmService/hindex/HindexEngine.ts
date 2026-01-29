import { FsAdapter } from '../fs/fsAdapter';
import { HcmError } from '../types';

interface ClassificationConfig {
  classifications: {
    class: string;
    keywords: string[];
    targets: string[];
    priority: number;
  }[];
}

interface ScopeConfig {
  scopes: Record<string, {
    include: string[];
    exclude: string[];
  }>;
}

interface RoutingConfig {
    routing: Record<string, string>;
}

export class HindexEngine {
  private fsAdapter: FsAdapter;
  private classifications: ClassificationConfig | null = null;
  private scopes: ScopeConfig | null = null;
  private routing: RoutingConfig | null = null;

  constructor(fsAdapter: FsAdapter) {
    this.fsAdapter = fsAdapter;
  }

  async init(): Promise<void> {
    try {
      this.classifications = await this.fsAdapter.readJson<ClassificationConfig>('hindex/classification.json');
      this.scopes = await this.fsAdapter.readJson<ScopeConfig>('hindex/scopes.json');
      this.routing = await this.fsAdapter.readJson<RoutingConfig>('hindex/routing.json');
    } catch (err) {
       const error: HcmError = {
          code: 'INTERNAL_ERROR',
          message: 'Hindex engine initialization failed: configuration missing',
          details: { error: err }
      };
      throw error;
    }
  }

  classify(query: string): string {
    if (!this.classifications) throw new Error('Hindex not initialized');

    const lowerQuery = query.toLowerCase();
    let bestMatch = 'default';
    let maxPriority = -1;

    for (const cls of this.classifications.classifications) {
      const match = cls.keywords.some(kw => lowerQuery.includes(kw.toLowerCase()));
      if (match && cls.priority > maxPriority) {
        maxPriority = cls.priority;
        bestMatch = cls.class;
      }
    }
    
    if (maxPriority === -1) return 'domain_knowledge'; 

    return bestMatch;
  }

  getScope(classification: string) {
    if (!this.scopes) throw new Error('Hindex not initialized');
    return this.scopes.scopes[classification];
  }

  getRouting(classification: string): string {
      if (!this.routing) throw new Error('Hindex not initialized');
      return this.routing.routing[classification] || 'vector';
  }

  private patternToRegex(pattern: string): RegExp {
    let regexStr = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '___DBL_WILD___')
      .replace(/\*/g, '[^/]+')
      .replace(/___DBL_WILD___/g, '.*');
      
    return new RegExp(`^${regexStr}$`);
  }

  async search(query: string, _callerId: string): Promise<any> {
    if (!this.classifications) await this.init();

    const classification = this.classify(query);
    const scope = this.getScope(classification);
    if (!scope) {
        return { results: [], metadata: { classification, note: 'No scope defined' } };
    }
    const route = this.getRouting(classification);

    const roots = new Set<string>();
    scope.include.forEach(p => {
        const parts = p.split('/');
        if (parts.length > 0 && parts[0] !== '*') {
             roots.add(parts[0]);
        }
    });

    let allFiles: string[] = [];
    for (const root of roots) {
       const files = await this.fsAdapter.listFilesRecursive(root); 
       allFiles = allFiles.concat(files);
    }

    const includeRegexes = scope.include.map(p => this.patternToRegex(p));
    const excludeRegexes = scope.exclude.map(p => this.patternToRegex(p));

    const matchedFiles = allFiles.filter(file => {
        const included = includeRegexes.some(r => r.test(file));
        const excluded = excludeRegexes.some(r => r.test(file));
        return included && !excluded;
    });

    const results = [];
    for (const file of matchedFiles) {
        try {
            let content;
            if (file.endsWith('.jsonl')) {
                // HOTFIX: Use readJsonLines for .jsonl files
                content = await this.fsAdapter.readJsonLines(file);
            } else {
                content = await this.fsAdapter.readJson(file);
            }
            
            results.push({
                source: file,
                content: content
            });
        } catch (e) {
             // ignore read errors (directories, permissions)
             // Console log in debug mode would be useful here
        }
    }

    return {
        query,
        classification,
        routing: route,
        count: results.length,
        results
    };
  }
}