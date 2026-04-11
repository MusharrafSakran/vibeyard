import { describe, it, expect } from 'vitest';
import { basename, isAbsolutePath, lastSeparatorIndex } from './platform';

describe('basename', () => {
  it('extracts last segment from POSIX paths', () => {
    expect(basename('/home/user/project')).toBe('project');
    expect(basename('/usr/local/bin')).toBe('bin');
  });

  it('extracts last segment from Windows paths', () => {
    expect(basename('C:\\Users\\me\\MyProject')).toBe('MyProject');
    expect(basename('D:\\dev\\app')).toBe('app');
  });

  it('handles mixed separators', () => {
    expect(basename('C:\\Users/me\\project')).toBe('project');
    expect(basename('/home\\user/project')).toBe('project');
  });

  it('handles trailing separators', () => {
    expect(basename('/home/user/project/')).toBe('project');
    expect(basename('C:\\Users\\me\\project\\')).toBe('project');
  });

  it('handles single segment', () => {
    expect(basename('project')).toBe('project');
  });

  it('returns the path for empty string', () => {
    expect(basename('')).toBe('');
  });

  it('handles root paths', () => {
    expect(basename('/')).toBe('');
    expect(basename('C:\\')).toBe('C:');
  });
});

describe('isAbsolutePath', () => {
  it('recognizes POSIX absolute paths', () => {
    expect(isAbsolutePath('/home/user/x')).toBe(true);
    expect(isAbsolutePath('/')).toBe(true);
  });

  it('recognizes Windows drive-letter paths', () => {
    expect(isAbsolutePath('C:\\Users\\me')).toBe(true);
    expect(isAbsolutePath('c:/Users/me')).toBe(true);
    expect(isAbsolutePath('D:\\dev')).toBe(true);
    expect(isAbsolutePath('z:/x')).toBe(true);
  });

  it('recognizes UNC / rooted backslash paths', () => {
    expect(isAbsolutePath('\\\\server\\share\\x')).toBe(true);
    expect(isAbsolutePath('//server/share/x')).toBe(true);
    expect(isAbsolutePath('\\foo')).toBe(true);
  });

  it('rejects relative paths', () => {
    expect(isAbsolutePath('src\\main\\x.ts')).toBe(false);
    expect(isAbsolutePath('./x')).toBe(false);
    expect(isAbsolutePath('x.ts')).toBe(false);
    expect(isAbsolutePath('home/x')).toBe(false);
  });

  it('rejects drive letter without separator', () => {
    expect(isAbsolutePath('C:')).toBe(false);
    expect(isAbsolutePath('C:file')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isAbsolutePath('')).toBe(false);
  });
});

describe('lastSeparatorIndex', () => {
  it('finds last forward slash', () => {
    expect(lastSeparatorIndex('/home/user/project')).toBe(10);
  });

  it('finds last backslash', () => {
    expect(lastSeparatorIndex('C:\\Users\\me')).toBe(8);
  });

  it('finds whichever separator comes last in mixed paths', () => {
    expect(lastSeparatorIndex('C:\\Users/me')).toBe(8);
    expect(lastSeparatorIndex('C:/Users\\me')).toBe(8);
  });

  it('returns -1 when no separator present', () => {
    expect(lastSeparatorIndex('project')).toBe(-1);
    expect(lastSeparatorIndex('')).toBe(-1);
  });
});
