export type HcmOperation =
  | 'HCM_GET_MISSION_CONTEXT'
  | 'HCM_APPEND_JOURNAL'
  | 'HCM_ADD_EVIDENCE'
  | 'HCM_UPDATE_NEXT_ACTIONS'
  | 'HCM_SNAPSHOT_MISSION'
  | 'HCM_SEARCH'
  | 'HCM_LIST_MISSIONS'
  | 'HCM_PROJECT_PROFILE_GET'
  | 'HCM_PROJECT_PROFILE_PUT'
  | 'HCM_PROJECT_PROFILE_LIST'
  | 'HCM_GET_DECISIONS'
  | 'HCM_DAY_ROLLUP'
  | 'HCM_PREPARE_DAY_CONTEXT'
  | 'HCM_CONTRACT_GET_LATEST'
  | 'HCM_CONTRACT_CREATE_VERSION'
  | 'HCM_PACK_STORE'
  | 'HCM_PACK_GET'
  | 'HCM_PACK_LIST'
  | 'HCM_ARTIFACT_PUT'
  | 'HCM_CHAT_THREAD_CREATE'
  | 'HCM_CHAT_MESSAGE_APPEND'
  | 'HCM_MEMORY_QUERY';

export type HcmErrorCode =
  | 'MISSION_NOT_FOUND'
  | 'INVALID_PAYLOAD'
  | 'IO_ERROR'
  | 'ACCESS_DENIED'
  | 'CONFLICTING_UPDATE'
  | 'INTERNAL_ERROR'
  | 'NOT_IMPLEMENTED';

export interface HcmError {
  code: HcmErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface HcmRequest<T = unknown> {
  op: HcmOperation;
  request_id: string;
  caller: {
    type: 'agent' | 'human' | 'system';
    id: string;
    roles?: string[]; // Added for security
  };
  payload: T;
}

export interface HcmResponse<T = unknown> {
  request_id: string;
  op: HcmOperation;
  status: 'ok' | 'error';
  error?: HcmError;
  data?: T;
}

// --- Data Models ---

export interface JournalEntry {
  timestamp?: string; // ISO-8601, added by system if missing
  author_type: 'agent' | 'human' | 'system';
  author_id: string;
  entry_type: 'event' | 'note' | 'analysis' | 'warning' | 'error' | 'info';
  message: string;
  context?: Record<string, unknown>;
}

export interface MissionContext {
  mission_id: string;
  meta: Record<string, unknown>;
  status: Record<string, unknown>;
  journal_tail: JournalEntry[];
  decisions: Record<string, unknown>[];
  next_actions: Record<string, unknown>[];
}

export interface EvidenceInput {
  type: string;
  title: string;
  content: unknown;
  confidence?: 'low' | 'medium' | 'high';
}

export interface NextActionUpdate {
  action_id?: string;
  title: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  owner_id?: string;
}

export interface Decision {
    decision_id: string;
    title: string;
    status: string;
    // ... other fields
}

export type ProjectStakeholder = {
  role: string;
  name?: string;
  email?: string;
};

export type ProjectContextRef = {
  type: 'repo' | 'doc' | 'link' | 'log' | 'dashboard' | 'other';
  ref: string;
  label?: string;
  classification?: string;
};

export type ProjectPolicy = {
  data_residency?: string;
  data_classification?: string;
  allowed_term_ids?: string[];
  enforce_scope?: boolean;
  allowed_tools?: string[];
  forbidden_tools?: string[];
  retention_policy_ref?: string;
  rgpd?: { store_data?: boolean; pii_allowed?: boolean };
  connectors_enabled?: string[];
  tags?: string[];
};

export type ProjectProfile = {
  project_name: string;
  business_id?: string;
  contract_defaults?: { term_id?: string; [k: string]: unknown };
  description?: string;
  objective?: string;
  success_criteria?: string[];
  stakeholders?: ProjectStakeholder[];
  context_refs?: ProjectContextRef[];
  policy?: ProjectPolicy;
  [k: string]: unknown;
};

export type ProjectProfileDoc = {
  schema_version: string;
  project_id: string;
  profile: ProjectProfile;
  meta: {
    version_hash: string;
    created_at: string;
    created_by: { type: 'agent' | 'human' | 'system'; id: string };
    supersedes?: string | null;
  };
};

export type ProjectProfileSummary = {
  project_id: string;
  project_name: string;
  version_hash: string;
  created_at: string;
};
