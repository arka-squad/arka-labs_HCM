import { FsAdapter } from '../fs/fsAdapter';

type MetaRulesLevel =
  | string[]
  | {
      required_roles?: unknown;
      requiredRoles?: unknown;
      roles?: unknown;
    };

interface MetaRulesFile {
  rules?: {
    sensitivity_levels?: Record<string, MetaRulesLevel>;
    default_visibility?: unknown;
  };
}

interface NormalizedMetaRules {
  sensitivity_roles: Record<string, string[]>;
  default_visibility: string;
}

export class MetaRulesEngine {
    private fsAdapter: FsAdapter;
    private rules: NormalizedMetaRules | null = null;

    constructor(fsAdapter: FsAdapter) {
        this.fsAdapter = fsAdapter;
    }

    private normalizeRules(raw: MetaRulesFile): NormalizedMetaRules {
      const sensitivityLevels = raw?.rules?.sensitivity_levels || {};

      const toStringArray = (value: unknown): string[] => {
        if (!Array.isArray(value)) return [];
        return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim());
      };

      const toRoles = (value: MetaRulesLevel | undefined): string[] => {
        if (!value) return [];
        if (Array.isArray(value)) return toStringArray(value);
        if (typeof value === 'object') {
          const v = value as any;
          const candidates = [toStringArray(v.required_roles), toStringArray(v.requiredRoles), toStringArray(v.roles)];
          return candidates.find((c) => c.length > 0) ?? [];
        }
        return [];
      };

      const defaultVisibility =
        typeof raw?.rules?.default_visibility === 'string' && raw.rules.default_visibility.trim()
          ? raw.rules.default_visibility.trim()
          : 'restricted';

      return {
        sensitivity_roles: {
          public: toRoles(sensitivityLevels.public),
          internal: toRoles(sensitivityLevels.internal),
          restricted: toRoles(sensitivityLevels.restricted),
          confidential: toRoles((sensitivityLevels as any).confidential),
        },
        default_visibility: defaultVisibility,
      };
    }

    async init() {
        if (this.rules) return;
        try {
            // Path relative to HCM ROOT
            const raw = await this.fsAdapter.readJson<MetaRulesFile>('hindex/meta_rules.json');
            this.rules = this.normalizeRules(raw);
        } catch (e) {
            // Fallback safe defaults if file missing or corrupt
            console.warn('MetaRulesEngine: Failed to load rules, using strict defaults.');
            this.rules = {
              sensitivity_roles: {
                public: [],
                internal: [],
                restricted: ['admin', 'security_officer'],
                confidential: [],
              },
              default_visibility: 'restricted', // Fail safe
            };
        }
    }

    async validateAccess(op: string, caller: { id: string; roles?: string[] }): Promise<boolean> {
        await this.init();
        if (!this.rules) return false;

        // 1. Determine Op Sensitivity (Hardcoded mapping for V1)
        const opSensitivity: Record<string, string> = {
            'HCM_GET_MISSION_CONTEXT': 'internal',
            'HCM_APPEND_JOURNAL': 'internal',
            'HCM_ADD_EVIDENCE': 'internal',
            'HCM_UPDATE_NEXT_ACTIONS': 'internal',
            'HCM_SEARCH': 'internal',
            'HCM_LIST_MISSIONS': 'public',
            'HCM_PROJECT_PROFILE_GET': 'internal',
            'HCM_PROJECT_PROFILE_PUT': 'internal',
            'HCM_PROJECT_PROFILE_LIST': 'internal',
            'HCM_CONTRACT_GET_LATEST': 'internal',
            'HCM_CONTRACT_CREATE_VERSION': 'internal',
            'HCM_PACK_STORE': 'internal',
            'HCM_PACK_GET': 'internal',
            'HCM_PACK_LIST': 'internal',
            'HCM_ARTIFACT_PUT': 'internal',
            'HCM_GET_DECISIONS': 'internal',
            'HCM_SNAPSHOT_MISSION': 'internal',
            'HCM_DAY_ROLLUP': 'internal',
            'HCM_PREPARE_DAY_CONTEXT': 'internal'
        };

        const level = opSensitivity[op] || this.rules.default_visibility;

        // 2. Check Caller Roles against Level
        if (level === 'public') return true;

        const allowedRoles = this.rules.sensitivity_roles[level] || [];
        if (allowedRoles.includes('*')) return true;
        const userRoles = caller.roles || [];
        
        // Check intersection
        const hasAccess = userRoles.some(role => allowedRoles.includes(role));
        
        return hasAccess;
    }
}
