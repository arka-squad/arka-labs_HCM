import { promises as fs } from 'fs';
import * as path from 'path';
import { HcmError, HcmErrorCode } from '../types';

export class FsAdapter {
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = path.resolve(rootPath);
  }

  private resolvePath(relativePath: string): string {
    const normalized = path.normalize(String(relativePath || ''));
    const resolved = path.resolve(this.rootPath, normalized);

    const rel = path.relative(this.rootPath, resolved);
    const isOutsideRoot = rel === '..' || rel.startsWith(`..${path.sep}`);
    if (isOutsideRoot || path.isAbsolute(rel)) {
      throw this.createError('ACCESS_DENIED', `Path traversal attempt: ${relativePath}`);
    }
    return resolved;
  }

  private mapFsError(err: any): HcmError {
    if (err && (err as any).code) { // Type guard to check if 'code' property exists
       const code = (err as any).code; // Safe access
       if (code === 'ENOENT') {
        return this.createError('MISSION_NOT_FOUND', 'File or directory not found', { original_error: err });
      }
      if (code === 'EACCES' || code === 'EPERM') {
        return this.createError('ACCESS_DENIED', 'Permission denied', { original_error: err });
      }
    }
    // Check if it's already an HcmError
    if (err && (err as any).code && Object.values({} as any).includes((err as any).code)) {
         return err as HcmError;
    }

    return this.createError('IO_ERROR', 'Filesystem operation failed', { original_error: err });
  }

  private createError(code: HcmErrorCode, message: string, details?: Record<string, unknown>): HcmError {
    return { code, message, details };
  }

  async readJson<T>(filePath: string): Promise<T> {
    try {
      const fullPath = this.resolvePath(filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (err: any) {
        if (err instanceof SyntaxError) {
             throw this.createError('IO_ERROR', 'Invalid JSON syntax', { path: filePath });
        }
      throw this.mapFsError(err);
    }
  }

  /**
   * Atomic JSON writer:
   * - Writes to "<file>.tmp"
   * - Renames to final path (atomic at OS level)
   */
  async writeJsonAtomic<T>(filePath: string, data: T): Promise<void> {
    try {
      const fullPath = this.resolvePath(filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      const tmpPath = `${fullPath}.tmp`;
      const json = JSON.stringify(data, null, 2);
      await fs.writeFile(tmpPath, json, 'utf-8');
      await fs.rename(tmpPath, fullPath);
    } catch (err) {
      throw this.mapFsError(err);
    }
  }

  async writeJson<T>(filePath: string, data: T): Promise<void> {
    try {
      await this.writeJsonAtomic(filePath, data);
    } catch (err) {
      throw this.mapFsError(err);
    }
  }

  async appendJsonLine<T>(filePath: string, data: T): Promise<void> {
    try {
      const fullPath = this.resolvePath(filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      const line = JSON.stringify(data) + '\n';
      await fs.appendFile(fullPath, line, 'utf-8');
    } catch (err) {
      throw this.mapFsError(err);
    }
  }

  async readJsonLines<T>(filePath: string, limit?: number): Promise<T[]> {
    try {
      const fullPath = this.resolvePath(filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.trim().split('\n');
      
      const parsedLines = lines
        .filter(line => line.trim() !== '')
        .map(line => {
             try {
                 return JSON.parse(line);
             } catch (e) {
                 return null; // Skip invalid lines or handle differently
             }
        })
        .filter(item => item !== null) as T[];

      if (limit && limit > 0) {
        return parsedLines.slice(-limit);
      }
      return parsedLines;
    } catch (err: any) {
       // Graceful degradation if file doesn't exist for journals (empty list)
       if (err.code === 'ENOENT') return [];
       throw this.mapFsError(err);
    }
  }
  
  async exists(filePath: string): Promise<boolean> {
      try {
          const fullPath = this.resolvePath(filePath);
          await fs.access(fullPath);
          return true;
      } catch {
          return false;
      }
  }

  async listFilesRecursive(dirPath: string): Promise<string[]> {
      try {
          const fullDirPath = this.resolvePath(dirPath);
          let results: string[] = [];
          
          const dirents = await fs.readdir(fullDirPath, { withFileTypes: true });
          
          for (const dirent of dirents) {
              const res = path.resolve(fullDirPath, dirent.name);
              // Calculate relative path from root to return clean paths like 'state/missions/x/y.json'
              const relative = path.relative(this.rootPath, res);

              if (dirent.isDirectory()) {
                  const subFiles = await this.listFilesRecursive(relative);
                  results = results.concat(subFiles);
              } else {
                  results.push(relative);
              }
          }
          return results;
      } catch (err: any) {
          if (err.code === 'ENOENT') return [];
          throw this.mapFsError(err);
      }
  }

  /**
   * Ensure directory exists (mkdir -p semantics) for a relative path.
   */
  async ensureDir(dirPath: string): Promise<void> {
    try {
      const fullDirPath = this.resolvePath(dirPath);
      await fs.mkdir(fullDirPath, { recursive: true });
    } catch (err) {
      throw this.mapFsError(err);
    }
  }
}
