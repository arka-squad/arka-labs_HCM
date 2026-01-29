import { FsAdapter } from './fs/fsAdapter';
import { HindexEngine } from './hindex/HindexEngine';
import { MetaRulesEngine } from './security/MetaRulesEngine';
import { ContractEngine } from './contracts/ContractEngine';
import { PackEngine } from './packs/PackEngine';
import { ArtifactEngine } from './artifacts/ArtifactEngine';
import { ChatEngine } from './chat/ChatEngine'; // NEW
import { MemoryQueryEngine } from './chat/MemoryQueryEngine'; // NEW
import { 
    HcmRequest, 
    HcmResponse, 
    HcmError, 
    JournalEntry, 
    EvidenceInput, 
    NextActionUpdate 
} from './types';
import { getMissionContext } from './ops/getMissionContext';
import { appendJournal } from './ops/appendJournal';
import { addEvidence } from './ops/addEvidence';
import { updateNextActions } from './ops/updateNextActions';
import { search } from './ops/search';
import { listMissions } from './ops/listMissions';
import { getDecisions } from './ops/getDecisions';
import { dayRollup } from './ops/dayRollup';
import { prepareDayContext } from './ops/prepareDayContext';
import { createContractVersion } from './ops/contracts/createVersion';
import { storePack, getPack, listPacks, putArtifact } from './ops/packs/ops';
import { createThread, appendMessage, queryMemory } from './ops/chat/ops'; // NEW
import { getProjectProfile, listProjectProfiles, putProjectProfile } from './ops/projects/projectProfile';

export * from './types';

export class HcmService {
  private fsAdapter: FsAdapter;
  private hindexEngine: HindexEngine;
  private metaRulesEngine: MetaRulesEngine;
  private contractEngine: ContractEngine;
  private packEngine: PackEngine;
  private artifactEngine: ArtifactEngine;
  private chatEngine: ChatEngine; // NEW
  private memoryQueryEngine: MemoryQueryEngine; // NEW

  constructor(rootPath: string) {
    this.fsAdapter = new FsAdapter(rootPath);
    this.hindexEngine = new HindexEngine(this.fsAdapter);
    this.metaRulesEngine = new MetaRulesEngine(this.fsAdapter);
    this.contractEngine = new ContractEngine(this.fsAdapter);
    this.packEngine = new PackEngine(this.fsAdapter);
    this.artifactEngine = new ArtifactEngine(this.fsAdapter);
    this.chatEngine = new ChatEngine(this.fsAdapter); // NEW
    this.memoryQueryEngine = new MemoryQueryEngine(this.hindexEngine); // NEW (depends on Hindex)
  }

  async handle(request: HcmRequest): Promise<HcmResponse> {
    try {
      // 0. Security Check
      const allowed = await this.metaRulesEngine.validateAccess(request.op, request.caller);
      if (!allowed) {
          throw this.createError('ACCESS_DENIED', `Caller ${request.caller.id} does not have permission for ${request.op}`);
      }

      let data: unknown;

      switch (request.op) {
        case 'HCM_GET_MISSION_CONTEXT':
          const missionIdCtx = (request.payload as any).mission_id;
          if (!missionIdCtx) throw this.createError('INVALID_PAYLOAD', 'mission_id required');
          data = await getMissionContext(this.fsAdapter, missionIdCtx);
          break;

        case 'HCM_APPEND_JOURNAL':
           const { mission_id: mIdJournal, entry } = request.payload as { mission_id: string, entry: JournalEntry };
           if (!mIdJournal || !entry) throw this.createError('INVALID_PAYLOAD', 'mission_id and entry required');
           data = await appendJournal(this.fsAdapter, mIdJournal, entry);
           break;

        case 'HCM_ADD_EVIDENCE':
            const { mission_id: mIdEv, evidence } = request.payload as { mission_id: string, evidence: EvidenceInput };
            if (!mIdEv || !evidence) throw this.createError('INVALID_PAYLOAD', 'mission_id and evidence required');
            data = await addEvidence(this.fsAdapter, mIdEv, evidence, request.caller.id);
            break;

        case 'HCM_UPDATE_NEXT_ACTIONS':
             const { mission_id: mIdAct, updates } = request.payload as { mission_id: string, updates: NextActionUpdate[] };
             if (!mIdAct || !updates) throw this.createError('INVALID_PAYLOAD', 'mission_id and updates required');
             await updateNextActions(this.fsAdapter, mIdAct, updates);
             data = { status: 'updated' };
             break;
             
        case 'HCM_SEARCH':
              const { query } = request.payload as { query: string };
              if (!query) throw this.createError('INVALID_PAYLOAD', 'query required');
              data = await search(this.fsAdapter, this.hindexEngine, query, request.caller.id);
              break;

        case 'HCM_SNAPSHOT_MISSION':
              const { mission_id: mIdSnap } = request.payload as { mission_id: string };
              if (!mIdSnap) throw this.createError('INVALID_PAYLOAD', 'mission_id required');
              const today = new Date().toISOString().split('T')[0];
              data = await dayRollup(this.fsAdapter, mIdSnap, today);
              break;
              
        case 'HCM_LIST_MISSIONS':
              {
                const biz =
                  (request.payload as any)?.business_id ||
                  (request.caller as any)?.business_id ||
                  (request.caller as any)?.organization_id ||
                  null;
                data = await listMissions(this.fsAdapter, { business_id: biz });
              }
              break;

        case 'HCM_PROJECT_PROFILE_GET':
              const { project_id: pIdGet } = request.payload as { project_id: string };
              if (!pIdGet) throw this.createError('INVALID_PAYLOAD', 'project_id required');
              data = await getProjectProfile(this.fsAdapter, { project_id: pIdGet });
              break;

        case 'HCM_PROJECT_PROFILE_PUT':
              const { project_id: pIdPut, profile, project_name, expected_base_hash: expected_base_hash_profile } = request.payload as any;
              if (!pIdPut || !profile) throw this.createError('INVALID_PAYLOAD', 'project_id and profile required');
              data = await putProjectProfile(
                this.fsAdapter,
                { project_id: pIdPut, profile, project_name, expected_base_hash: expected_base_hash_profile },
                request.caller,
              );
              break;

        case 'HCM_PROJECT_PROFILE_LIST':
              data = await listProjectProfiles(this.fsAdapter);
              break;

        case 'HCM_GET_DECISIONS':
               const { mission_id: mIdDec, filters } = request.payload as { mission_id: string, filters?: any };
               if (!mIdDec) throw this.createError('INVALID_PAYLOAD', 'mission_id required');
               data = await getDecisions(this.fsAdapter, mIdDec, filters);
               break;

        case 'HCM_DAY_ROLLUP':
               const { mission_id: mIdRoll, date } = request.payload as { mission_id: string, date: string };
               if (!mIdRoll || !date) throw this.createError('INVALID_PAYLOAD', 'mission_id and date required');
               data = await dayRollup(this.fsAdapter, mIdRoll, date);
               break;

        case 'HCM_PREPARE_DAY_CONTEXT':
               const { mission_id: mIdPrep, date: dPrep } = request.payload as { mission_id: string, date: string };
               if (!mIdPrep || !dPrep) throw this.createError('INVALID_PAYLOAD', 'mission_id and date required');
               data = await prepareDayContext(this.fsAdapter, mIdPrep, dPrep);
               break;

        case 'HCM_CONTRACT_GET_LATEST':
               const { mission_id: mIdCont } = request.payload as { mission_id: string };
               if (!mIdCont) throw this.createError('INVALID_PAYLOAD', 'mission_id required');
               data = await this.contractEngine.getLatest(mIdCont);
               break;

        case 'HCM_CONTRACT_CREATE_VERSION':
               const { mission_id: mIdVer, patch, expected_base_hash } = request.payload as { mission_id: string, patch: any, expected_base_hash: string | null };
               if (!mIdVer || !patch) throw this.createError('INVALID_PAYLOAD', 'mission_id and patch required');
               data = await createContractVersion(this.fsAdapter, this.contractEngine, mIdVer, patch, expected_base_hash);
               break;

        case 'HCM_PACK_STORE':
               const { mission_id: mIdPStore, pack } = request.payload as { mission_id: string, pack: any };
               if (!mIdPStore || !pack) throw this.createError('INVALID_PAYLOAD', 'mission_id and pack required');
               data = await storePack(this.fsAdapter, this.packEngine, mIdPStore, pack);
               break;

        case 'HCM_PACK_GET':
               const { mission_id: mIdPGet, pack_id } = request.payload as { mission_id: string, pack_id: string };
               if (!mIdPGet || !pack_id) throw this.createError('INVALID_PAYLOAD', 'mission_id and pack_id required');
               data = await getPack(this.fsAdapter, this.packEngine, mIdPGet, pack_id);
               break;

        case 'HCM_PACK_LIST':
               const { mission_id: mIdPList, pack_type } = request.payload as { mission_id: string, pack_type?: string };
               if (!mIdPList) throw this.createError('INVALID_PAYLOAD', 'mission_id required');
               data = await listPacks(this.fsAdapter, this.packEngine, mIdPList, pack_type);
               break;

        case 'HCM_ARTIFACT_PUT':
               const { mission_id: mIdArt, content, meta } = request.payload as { mission_id: string, content: string, meta: any };
               if (!mIdArt || !content) throw this.createError('INVALID_PAYLOAD', 'mission_id and content required');
               data = await putArtifact(this.fsAdapter, this.artifactEngine, mIdArt, content, meta);
               break;

        // --- Chat & Memory ---
        case 'HCM_CHAT_THREAD_CREATE':
               const { mission_id: mIdTh, thread_meta } = request.payload as { mission_id: string, thread_meta: any };
               if (!mIdTh || !thread_meta) throw this.createError('INVALID_PAYLOAD', 'mission_id and thread_meta required');
               data = await createThread(this.fsAdapter, this.chatEngine, mIdTh, thread_meta);
               break;

        case 'HCM_CHAT_MESSAGE_APPEND':
               const { mission_id: mIdMsg, thread_id, message } = request.payload as { mission_id: string, thread_id: string, message: any };
               if (!mIdMsg || !thread_id || !message) throw this.createError('INVALID_PAYLOAD', 'mission_id, thread_id and message required');
               data = await appendMessage(this.fsAdapter, this.chatEngine, mIdMsg, thread_id, message);
               break;

        case 'HCM_MEMORY_QUERY':
               const { mission_id: mIdQ, query: qMem } = request.payload as { mission_id: string, query: string };
               if (!mIdQ || !qMem) throw this.createError('INVALID_PAYLOAD', 'mission_id and query required');
               data = await queryMemory(this.fsAdapter, this.memoryQueryEngine, qMem, request.caller.id, mIdQ);
               break;

        default:
          throw this.createError('INVALID_PAYLOAD', `Unknown operation: ${request.op}`);
      }

      return {
        request_id: request.request_id,
        op: request.op,
        status: 'ok',
        data
      };

    } catch (err: any) {
        let hcmError: HcmError;
        if (err.code && [
            'MISSION_NOT_FOUND', 
            'INVALID_PAYLOAD', 
            'IO_ERROR', 
            'ACCESS_DENIED', 
            'CONFLICTING_UPDATE', 
            'INTERNAL_ERROR', 
            'NOT_IMPLEMENTED'
        ].includes(err.code)) {
            hcmError = err as HcmError;
        } else {
             hcmError = {
                code: 'INTERNAL_ERROR',
                message: err.message || 'An unexpected error occurred',
                details: { original_error: err }
            };
        }

      return {
        request_id: request.request_id,
        op: request.op,
        status: 'error',
        error: hcmError
      };
    }
  }

  async getMissionContext(missionId: string) { return getMissionContext(this.fsAdapter, missionId); }
  async appendJournal(missionId: string, entry: JournalEntry) { return appendJournal(this.fsAdapter, missionId, entry); }
  async search(query: string, callerId: string) { return search(this.fsAdapter, this.hindexEngine, query, callerId); }

  private createError(code: any, message: string): HcmError {
      return { code, message };
  }
}
