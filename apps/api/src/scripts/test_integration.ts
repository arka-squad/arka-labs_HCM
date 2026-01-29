import { HcmService } from '../hcmService';
import { HcmController } from '../api/controllers/HcmController';
import * as path from 'path';

// Mock Express Request/Response
const mockRequest = (body: any): any => ({
  body
});

const mockResponse = (): any => {
  const res: any = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.body = data;
    console.log('--- HTTP Response ---');
    console.log(`Status: ${res.statusCode}`);
    console.log('Body:', JSON.stringify(data, null, 2));
    return res;
  };
  return res;
};

async function runTest() {
  console.log('--- Starting Integration Test ---');
  
  // Setup
  const hcmRoot = path.join(process.cwd(), 'hcm');
  const service = new HcmService(hcmRoot);
  const controller = new HcmController(service);

  // Payload: Search
  const req = mockRequest({
    op: 'HCM_SEARCH',
    request_id: 'integ-test-001',
    caller: { type: 'system', id: 'test-runner' },
    payload: { query: 'historique mission test' }
  });

  const res = mockResponse();

  // Execute
  await controller.execute(req, res);
}

runTest().catch(err => console.error(err));
