export interface FaasService {
  createFunction: (id: string, name: string, code: string, appKey: string) => Promise<void>;
  executeFunction: (id: string, args: any[]) => Promise<any>;
  updateFunction: (id: string, apiKey: string) => Promise<void>;
}
