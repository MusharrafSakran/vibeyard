import { beforeEach, describe, expect, it, vi } from 'vitest';
import { attachClipboardCopyHandler } from './terminal-utils.js';

const mockClipboardWrite = vi.fn().mockResolvedValue(undefined);
const mockClipboardRead = vi.fn();

class FakeTerminal {
  private keyHandler: ((e: KeyboardEvent) => boolean) | null = null;
  private _selection = '';
  modes = { bracketedPasteMode: false };

  attachCustomKeyEventHandler(handler: (e: KeyboardEvent) => boolean): void {
    this.keyHandler = handler;
  }
  simulateKey(event: Partial<KeyboardEvent>): boolean {
    return this.keyHandler ? this.keyHandler(event as KeyboardEvent) : true;
  }
  getSelection(): string { return this._selection; }
  setSelection(s: string): void { this._selection = s; }
}

function stubPlatform(platform: string) {
  vi.stubGlobal('navigator', {
    platform,
    clipboard: { writeText: mockClipboardWrite, readText: mockClipboardRead },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockClipboardRead.mockResolvedValue('');
});

describe('attachClipboardCopyHandler (macOS)', () => {
  beforeEach(() => stubPlatform('MacIntel'));

  it('copies selected text to clipboard on Ctrl+Shift+C keydown', () => {
    const terminal = new FakeTerminal();
    attachClipboardCopyHandler(terminal as any);

    terminal.setSelection('hello');
    terminal.simulateKey({ ctrlKey: true, shiftKey: true, key: 'C', type: 'keydown' });

    expect(mockClipboardWrite).toHaveBeenCalledWith('hello');
  });

  it('does not copy on keyup', () => {
    const terminal = new FakeTerminal();
    attachClipboardCopyHandler(terminal as any);

    terminal.setSelection('hello');
    terminal.simulateKey({ ctrlKey: true, shiftKey: true, key: 'C', type: 'keyup' });

    expect(mockClipboardWrite).not.toHaveBeenCalled();
  });

  it('does not copy when nothing is selected', () => {
    const terminal = new FakeTerminal();
    attachClipboardCopyHandler(terminal as any);

    terminal.setSelection('');
    terminal.simulateKey({ ctrlKey: true, shiftKey: true, key: 'C', type: 'keydown' });

    expect(mockClipboardWrite).not.toHaveBeenCalled();
  });

  it('returns false on Ctrl+Shift+C to prevent default', () => {
    const terminal = new FakeTerminal();
    attachClipboardCopyHandler(terminal as any);

    const result = terminal.simulateKey({ ctrlKey: true, shiftKey: true, key: 'C', type: 'keydown' });

    expect(result).toBe(false);
  });

  it('returns false on Ctrl+F to let document handle search', () => {
    const terminal = new FakeTerminal();
    attachClipboardCopyHandler(terminal as any);

    const result = terminal.simulateKey({ ctrlKey: true, key: 'f', type: 'keydown' });

    expect(result).toBe(false);
  });

  it('returns true for unhandled keys', () => {
    const terminal = new FakeTerminal();
    attachClipboardCopyHandler(terminal as any);

    const result = terminal.simulateKey({ key: 'a', type: 'keydown' });

    expect(result).toBe(true);
  });

  it('delegates unhandled keys to extend handler', () => {
    const terminal = new FakeTerminal();
    const extend = vi.fn().mockReturnValue(false);
    attachClipboardCopyHandler(terminal as any, extend);

    terminal.simulateKey({ key: 'Enter', shiftKey: true, type: 'keydown' });

    expect(extend).toHaveBeenCalled();
  });

  it('returns true when extend handler returns undefined', () => {
    const terminal = new FakeTerminal();
    attachClipboardCopyHandler(terminal as any, () => undefined);

    const result = terminal.simulateKey({ key: 'a', type: 'keydown' });

    expect(result).toBe(true);
  });

  it('does not intercept Ctrl+C (lets xterm send SIGINT)', () => {
    const terminal = new FakeTerminal();
    attachClipboardCopyHandler(terminal as any);

    terminal.setSelection('hello');
    const result = terminal.simulateKey({ ctrlKey: true, key: 'c', type: 'keydown' });

    expect(result).toBe(true);
    expect(mockClipboardWrite).not.toHaveBeenCalled();
  });

  it('does not intercept Ctrl+V (lets xterm send control char)', () => {
    const terminal = new FakeTerminal();
    const writeToPty = vi.fn();
    attachClipboardCopyHandler(terminal as any, undefined, writeToPty);

    const result = terminal.simulateKey({ ctrlKey: true, key: 'v', type: 'keydown' });

    expect(result).toBe(true);
    expect(writeToPty).not.toHaveBeenCalled();
  });
});

describe('attachClipboardCopyHandler (Windows)', () => {
  beforeEach(() => stubPlatform('Win32'));

  it('Ctrl+C copies selection and returns false', () => {
    const terminal = new FakeTerminal();
    attachClipboardCopyHandler(terminal as any);

    terminal.setSelection('selected text');
    const result = terminal.simulateKey({ ctrlKey: true, key: 'c', type: 'keydown' });

    expect(result).toBe(false);
    expect(mockClipboardWrite).toHaveBeenCalledWith('selected text');
  });

  it('Ctrl+C without selection returns true (SIGINT passthrough)', () => {
    const terminal = new FakeTerminal();
    attachClipboardCopyHandler(terminal as any);

    terminal.setSelection('');
    const result = terminal.simulateKey({ ctrlKey: true, key: 'c', type: 'keydown' });

    expect(result).toBe(true);
    expect(mockClipboardWrite).not.toHaveBeenCalled();
  });

  it('Ctrl+C does not copy on keyup', () => {
    const terminal = new FakeTerminal();
    attachClipboardCopyHandler(terminal as any);

    terminal.setSelection('text');
    const result = terminal.simulateKey({ ctrlKey: true, key: 'c', type: 'keyup' });

    expect(result).toBe(false);
    expect(mockClipboardWrite).not.toHaveBeenCalled();
  });

  it('Ctrl+V returns false and pastes clipboard to PTY', async () => {
    const terminal = new FakeTerminal();
    const writeToPty = vi.fn();
    mockClipboardRead.mockResolvedValue('pasted text');
    attachClipboardCopyHandler(terminal as any, undefined, writeToPty);

    const result = terminal.simulateKey({ ctrlKey: true, key: 'v', type: 'keydown' });

    expect(result).toBe(false);
    await vi.waitFor(() => expect(writeToPty).toHaveBeenCalledWith('pasted text'));
  });

  it('Ctrl+V wraps text in bracketed paste escapes when mode is enabled', async () => {
    const terminal = new FakeTerminal();
    terminal.modes.bracketedPasteMode = true;
    const writeToPty = vi.fn();
    mockClipboardRead.mockResolvedValue('pasted');
    attachClipboardCopyHandler(terminal as any, undefined, writeToPty);

    terminal.simulateKey({ ctrlKey: true, key: 'v', type: 'keydown' });

    await vi.waitFor(() => expect(writeToPty).toHaveBeenCalledWith('\x1b[200~pasted\x1b[201~'));
  });

  it('Ctrl+V does not paste empty clipboard', async () => {
    const terminal = new FakeTerminal();
    const writeToPty = vi.fn();
    mockClipboardRead.mockResolvedValue('');
    attachClipboardCopyHandler(terminal as any, undefined, writeToPty);

    terminal.simulateKey({ ctrlKey: true, key: 'v', type: 'keydown' });

    await Promise.resolve();
    expect(writeToPty).not.toHaveBeenCalled();
  });

  it('Ctrl+V without writeToPty falls through to default', () => {
    const terminal = new FakeTerminal();
    attachClipboardCopyHandler(terminal as any);

    const result = terminal.simulateKey({ ctrlKey: true, key: 'v', type: 'keydown' });

    expect(result).toBe(true);
  });

  it('Ctrl+V does not call writeToPty on keyup', async () => {
    const terminal = new FakeTerminal();
    const writeToPty = vi.fn();
    mockClipboardRead.mockResolvedValue('text');
    attachClipboardCopyHandler(terminal as any, undefined, writeToPty);

    terminal.simulateKey({ ctrlKey: true, key: 'v', type: 'keyup' });

    await Promise.resolve();
    expect(writeToPty).not.toHaveBeenCalled();
  });

  it('Ctrl+Shift+C still works for copy', () => {
    const terminal = new FakeTerminal();
    attachClipboardCopyHandler(terminal as any);

    terminal.setSelection('shift-copy');
    const result = terminal.simulateKey({ ctrlKey: true, shiftKey: true, key: 'C', type: 'keydown' });

    expect(result).toBe(false);
    expect(mockClipboardWrite).toHaveBeenCalledWith('shift-copy');
  });
});
