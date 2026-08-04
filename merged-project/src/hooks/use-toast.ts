"use client";

import * as React from "react";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const actionTypes = {
  ADD: "ADD",
  UPDATE: "UPDATE",
  DISMISS: "DISMISS",
  REMOVE: "REMOVE",
} as const;

let count = 0;

function genId() {
  return Math.floor(Math.random() * 1000000).toString(36) + Date.now().toString(36);
}

type ActionType = typeof actionTypes;

type Action =
  | { type: ActionType["ADD"]; toast: ToasterToast }
  | { type: ActionType["UPDATE"]; toast: ToasterToast }
  | { type: ActionType["DISMISS"]; toastId?: string }
  | { type: ActionType["REMOVE"]; toastId?: string };

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }
  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({ type: "REMOVE", toastId });
  }, TOAST_REMOVE_DELAY);
  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };
    case "UPDATE":
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };
    case "DISMISS":
      if (action.toastId) {
        addToRemoveQueue(action.toastId);
      } else {
        state.toasts.forEach((toast) => addToRemoveQueue(toast.id));
      }
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toastId || action.toastId === undefined ? { ...t, open: false } : t)),
      };
    case "REMOVE":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
    default:
      return state;
  }
};

type State = {
  toasts: ToasterToast[];
};

type Listener = React.Dispatch<React.SetStateAction<State>>;

const listeners = new Set<Listener>();

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return {
    toasts: state.toasts,
    toast: (props: Omit<ToasterToast, "id">) => {
      const id = genId();
      const toast = { ...props, id, open: true };
      dispatch({ type: "ADD", toast });
      return id;
    },
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS", toastId }),
  };
}
