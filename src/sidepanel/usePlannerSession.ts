/**
 * React hook for the autonomous planner session (Phase 4).
 *
 * Opens a `PortName.PLANNER` connection to the background worker and
 * dispatches planner events to a reducer. Exposes `startPlan(goal)`,
 * `cancel()`, and the current planner state.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { PortName, ProviderId } from '@/shared/constants';
import type {
  ChatMessage,
  PlannerEvent,
  ToolCallInfo,
  ToolResultInfo,
} from '@/shared/types';

export interface PlannerStep {
  id: number;
  kind: 'progress' | 'tool_call' | 'tool_result' | 'iteration' | 'done' | 'error';
  text: string;
  toolCall?: ToolCallInfo;
  toolResult?: ToolResultInfo;
  iteration?: { current: number; max: number };
}

export type PlannerStatus = 'idle' | 'running' | 'done' | 'error';

interface State {
  status: PlannerStatus;
  steps: PlannerStep[];
  progressText: string;
  error: string | null;
  summary: string | null;
}

type Action =
  | { type: 'start' }
  | { type: 'progress'; text: string }
  | { type: 'tool_call'; call: ToolCallInfo }
  | { type: 'tool_result'; result: ToolResultInfo }
  | { type: 'iteration'; iteration: number; maxIterations: number }
  | { type: 'done'; summary: string }
  | { type: 'error'; error: string }
  | { type: 'reset' };

let stepCounter = 0;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'start':
      stepCounter = 0;
      return { status: 'running', steps: [], progressText: '', error: null, summary: null };
    case 'progress':
      return { ...state, progressText: state.progressText + action.text };
    case 'tool_call':
      return {
        ...state,
        // Flush accumulated progress text as a step before the tool call
        steps: [
          ...state.steps,
          ...(state.progressText
            ? [
                {
                  id: ++stepCounter,
                  kind: 'progress' as const,
                  text: state.progressText,
                },
              ]
            : []),
          {
            id: ++stepCounter,
            kind: 'tool_call' as const,
            text: `Calling tool: ${action.call.name}`,
            toolCall: action.call,
          },
        ],
        progressText: '',
      };
    case 'tool_result':
      return {
        ...state,
        steps: [
          ...state.steps,
          {
            id: ++stepCounter,
            kind: 'tool_result' as const,
            text: action.result.isError
              ? `❌ ${action.result.name}: ${action.result.result}`
              : `✅ ${action.result.name}: done`,
            toolResult: action.result,
          },
        ],
      };
    case 'iteration':
      return {
        ...state,
        steps: [
          ...state.steps,
          {
            id: ++stepCounter,
            kind: 'iteration' as const,
            text: `Iteration ${action.iteration} / ${action.maxIterations}`,
            iteration: { current: action.iteration, max: action.maxIterations },
          },
        ],
      };
    case 'done':
      return {
        ...state,
        status: 'done',
        summary: action.summary,
        steps: [
          ...state.steps,
          ...(state.progressText
            ? [
                {
                  id: ++stepCounter,
                  kind: 'progress' as const,
                  text: state.progressText,
                },
              ]
            : []),
          {
            id: ++stepCounter,
            kind: 'done' as const,
            text: action.summary,
          },
        ],
        progressText: '',
      };
    case 'error':
      return {
        ...state,
        status: 'error',
        error: action.error,
        steps: [
          ...state.steps,
          {
            id: ++stepCounter,
            kind: 'error' as const,
            text: action.error,
          },
        ],
      };
    case 'reset':
      stepCounter = 0;
      return { status: 'idle', steps: [], progressText: '', error: null, summary: null };
  }
}

export interface PlannerSessionOptions {
  scriptId: string;
  providerId: ProviderId;
  model: string;
  systemPrompt?: string;
  messages: ChatMessage[];
}

export function usePlannerSession(opts: PlannerSessionOptions) {
  const [state, dispatch] = useReducer(reducer, {
    status: 'idle',
    steps: [],
    progressText: '',
    error: null,
    summary: null,
  });

  const portRef = useRef<chrome.runtime.Port | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      portRef.current?.disconnect();
      portRef.current = null;
    };
  }, []);

  /** Opens a fresh planner port, wires up event listeners, and returns it. */
  const openPort = useCallback((): chrome.runtime.Port => {
    // Disconnect any stale port
    portRef.current?.disconnect();

    const port = chrome.runtime.connect({ name: PortName.PLANNER });
    portRef.current = port;

    port.onMessage.addListener((raw: PlannerEvent) => {
      if (!raw || typeof raw !== 'object' || !('type' in raw)) return;
      switch (raw.type) {
        case 'progress':
          dispatch({ type: 'progress', text: raw.text });
          break;
        case 'tool_call':
          dispatch({ type: 'tool_call', call: raw.call });
          break;
        case 'tool_result':
          dispatch({ type: 'tool_result', result: raw.result });
          break;
        case 'iteration':
          dispatch({
            type: 'iteration',
            iteration: raw.iteration,
            maxIterations: raw.maxIterations,
          });
          break;
        case 'done':
          dispatch({ type: 'done', summary: raw.summary });
          // Disconnect port when done — no need to keep it alive
          port.disconnect();
          portRef.current = null;
          break;
        case 'error':
          dispatch({ type: 'error', error: raw.error });
          port.disconnect();
          portRef.current = null;
          break;
      }
    });

    port.onDisconnect.addListener(() => {
      portRef.current = null;
    });

    return port;
  }, []);

  const startPlan = useCallback(
    (goal: string) => {
      dispatch({ type: 'start' });
      const o = optsRef.current;
      const port = openPort();
      port.postMessage({
        conversationId: '',
        scriptId: o.scriptId,
        providerId: o.providerId,
        model: o.model,
        goal,
        messages: o.messages,
        systemPrompt: o.systemPrompt,
        maxIterations: 10,
        maxTokens: 100_000,
      });
    },
    [openPort],
  );

  const cancel = useCallback(() => {
    portRef.current?.postMessage({ type: 'cancel' });
  }, []);

  const reset = useCallback(() => {
    portRef.current?.disconnect();
    portRef.current = null;
    dispatch({ type: 'reset' });
  }, []);

  return { ...state, startPlan, cancel, reset };
}
