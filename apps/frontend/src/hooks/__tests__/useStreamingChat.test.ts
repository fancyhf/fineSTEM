/**
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useStreamingChat } from '../useStreamingChat';
import { streamLogger } from '../../lib/streamLogger';

// Mock WebSocket
class MockWebSocket {
  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: ((this: WebSocket, ev: Event) => any) | null = null;
  onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null = null;
  onclose: ((this: WebSocket, ev: CloseEvent) => any) | null = null;
  onerror: ((this: WebSocket, ev: Event) => any) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  send(data: string) {
    const msg = JSON.parse(data);
    if (msg.type === 'connect') {
      setTimeout(() => {
        this.onmessage?.(new MessageEvent('message', {
          data: JSON.stringify({ type: 'connected' })
        }));
      }, 10);
    }
  }

  close() {
    this.readyState = WebSocket.CLOSED;
  }
}

// @ts-ignore
global.WebSocket = MockWebSocket;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock streamLogger
jest.mock('../../lib/streamLogger', () => ({
  streamLogger: {
    startSession: jest.fn(),
    logToken: jest.fn(),
    logContentUpdate: jest.fn(),
    logEnd: jest.fn(),
    logError: jest.fn(),
    log: jest.fn(),
  },
  enableStreamLog: jest.fn(),
  disableStreamLog: jest.fn(),
  isStreamLogEnabled: jest.fn(),
}));

describe('useStreamingChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('finish_reason detection', () => {
    it('should detect length truncation from done event', async () => {
      const { result } = renderHook(() => useStreamingChat());
      const onEndMock = jest.fn();

      // Simulate WebSocket messages
      const ws = new MockWebSocket('ws://test');

      act(() => {
        result.current.stream({
          message: 'test',
          sessionId: 'test-session',
        }, {
          onEnd: onEndMock,
        });
      });

      // Wait for connection
      await waitFor(() => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
      });

      // Simulate done event with length truncation
      act(() => {
        ws.onmessage?.(new MessageEvent('message', {
          data: JSON.stringify({
            type: 'done',
            full_response: 'Truncated content...',
            finish_reason: 'length',
          }),
        }));
      });

      await waitFor(() => {
        expect(onEndMock).toHaveBeenCalled();
      });

      // Verify the content includes truncation warning
      const finalContent = onEndMock.mock.calls[0][0];
      expect(finalContent).toContain('[输出可能不完整');
    });

    it('should not add truncation warning for normal completion', async () => {
      const { result } = renderHook(() => useStreamingChat());
      const onEndMock = jest.fn();

      const ws = new MockWebSocket('ws://test');

      act(() => {
        result.current.stream({
          message: 'test',
          sessionId: 'test-session',
        }, {
          onEnd: onEndMock,
        });
      });

      await waitFor(() => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
      });

      // Simulate done event with stop reason
      act(() => {
        ws.onmessage?.(new MessageEvent('message', {
          data: JSON.stringify({
            type: 'done',
            full_response: 'Complete content.',
            finish_reason: 'stop',
          }),
        }));
      });

      await waitFor(() => {
        expect(onEndMock).toHaveBeenCalled();
      });

      const finalContent = onEndMock.mock.calls[0][0];
      expect(finalContent).not.toContain('[输出可能不完整');
    });
  });

  describe('content_update handling', () => {
    it('should use content_update content even if shorter than accumulated', async () => {
      const { result } = renderHook(() => useStreamingChat());
      const onContentUpdateMock = jest.fn();

      const ws = new MockWebSocket('ws://test');

      act(() => {
        result.current.stream({
          message: 'test',
          sessionId: 'test-session',
        }, {
          onContentUpdate: onContentUpdateMock,
        });
      });

      await waitFor(() => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
      });

      // Simulate streaming tokens (with XML tags making it longer)
      act(() => {
        ws.onmessage?.(new MessageEvent('message', {
          data: JSON.stringify({
            type: 'chunk',
            content: '<question>Option A</question> Some text',
          }),
        }));
      });

      // Simulate content_update (XML stripped, shorter)
      act(() => {
        ws.onmessage?.(new MessageEvent('message', {
          data: JSON.stringify({
            type: 'content_update',
            content: 'Some text', // Shorter but cleaned
          }),
        }));
      });

      await waitFor(() => {
        expect(onContentUpdateMock).toHaveBeenCalled();
      });

      // Should use the cleaned content from content_update
      const lastCall = onContentUpdateMock.mock.calls[onContentUpdateMock.mock.calls.length - 1];
      expect(lastCall[0]).toContain('Some text');
    });

    it('should handle empty content_update gracefully', async () => {
      const { result } = renderHook(() => useStreamingChat());
      const onContentUpdateMock = jest.fn();

      const ws = new MockWebSocket('ws://test');

      act(() => {
        result.current.stream({
          message: 'test',
          sessionId: 'test-session',
        }, {
          onContentUpdate: onContentUpdateMock,
        });
      });

      await waitFor(() => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
      });

      // Simulate empty content_update
      act(() => {
        ws.onmessage?.(new MessageEvent('message', {
          data: JSON.stringify({
            type: 'content_update',
            content: '',
          }),
        }));
      });

      // Should not throw or cause issues
      await waitFor(() => {
        expect(onContentUpdateMock).toHaveBeenCalledWith('');
      });
    });
  });

  describe('stream logging', () => {
    it('should log stream events when logging is enabled', async () => {
      localStorageMock.getItem.mockReturnValue('true');

      const { result } = renderHook(() => useStreamingChat());
      const ws = new MockWebSocket('ws://test');

      act(() => {
        result.current.stream({
          message: 'test',
          sessionId: 'test-session',
          projectId: 'test-project',
        }, {});
      });

      await waitFor(() => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
      });

      // Simulate token
      act(() => {
        ws.onmessage?.(new MessageEvent('message', {
          data: JSON.stringify({
            type: 'chunk',
            content: 'test token',
          }),
        }));
      });

      await waitFor(() => {
        expect(streamLogger.logToken).toHaveBeenCalled();
      });
    });

    it('should start session with correct parameters', async () => {
      localStorageMock.getItem.mockReturnValue('true');

      const { result } = renderHook(() => useStreamingChat());

      act(() => {
        result.current.stream({
          message: 'test',
          sessionId: 'test-session',
          projectId: 'test-project',
        }, {});
      });

      await waitFor(() => {
        expect(streamLogger.startSession).toHaveBeenCalledWith(
          'test-session',
          'test-project'
        );
      });
    });
  });

  describe('incomplete content detection', () => {
    it('should detect incomplete code blocks', async () => {
      const { result } = renderHook(() => useStreamingChat());
      const onEndMock = jest.fn();

      const ws = new MockWebSocket('ws://test');

      act(() => {
        result.current.stream({
          message: 'test',
          sessionId: 'test-session',
        }, {
          onEnd: onEndMock,
        });
      });

      await waitFor(() => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
      });

      // Simulate content with unclosed code block
      act(() => {
        ws.onmessage?.(new MessageEvent('message', {
          data: JSON.stringify({
            type: 'done',
            full_response: '```python\nprint("hello")',
            finish_reason: 'stop',
          }),
        }));
      });

      await waitFor(() => {
        expect(onEndMock).toHaveBeenCalled();
      });

      // Should detect incomplete content and add warning
      const finalContent = onEndMock.mock.calls[0][0];
      expect(finalContent).toContain('[输出可能不完整');
    });

    it('should detect incomplete XML tags', async () => {
      const { result } = renderHook(() => useStreamingChat());
      const onEndMock = jest.fn();

      const ws = new MockWebSocket('ws://test');

      act(() => {
        result.current.stream({
          message: 'test',
          sessionId: 'test-session',
        }, {
          onEnd: onEndMock,
        });
      });

      await waitFor(() => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
      });

      // Simulate content with unclosed XML tag
      act(() => {
        ws.onmessage?.(new MessageEvent('message', {
          data: JSON.stringify({
            type: 'done',
            full_response: '<question>未闭合的问题',
            finish_reason: 'stop',
          }),
        }));
      });

      await waitFor(() => {
        expect(onEndMock).toHaveBeenCalled();
      });

      const finalContent = onEndMock.mock.calls[0][0];
      expect(finalContent).toContain('[输出可能不完整');
    });
  });
});
