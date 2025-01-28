export interface SharedState<T> {
  messages?: { [key: string]: any }[]; // Historique des interactions
  context: T;
}

export function mergeState<T>(
  current: SharedState<T>,
  updates: Partial<SharedState<T>>
): SharedState<T> {
  const uniqueMessages = new Map(
    [...(current.messages || []), ...(updates.messages || [])].map((msg) => [
      JSON.stringify(msg),
      msg,
    ])
  );
  return {
    ...current,
    context: { ...current.context, ...updates.context },
    messages: Array.from(uniqueMessages.values()), // Messages uniques
  };
}
export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  shouldRetry?: (error: Error) => boolean;
}

export interface Node<T> {
  name: string;
  description?: string;
  execute: (state: SharedState<T>) => Promise<Partial<SharedState<T>>>;
  condition?: (state: SharedState<T>) => boolean;
  next?: string[];
  events?: string[];
  retry?: RetryConfig;
}

export interface Persistence<T> {
  saveState(
    graphName: string,
    state: SharedState<T>,
    currentNode: string
  ): Promise<void>;
  loadState(
    graphName: string
  ): Promise<{ state: SharedState<T>; currentNode: string } | null>;
}

export interface RealTimeNotifier {
  notify(event: string, data: any): void;
}

export interface WorkflowDefinition<T> {
  name: string;
  nodes: {
    [key: string]: Node<T> & {
      condition?: (state: SharedState<T>) => boolean;
      next?: string[];
    };
  };
  entryNode: string;
}
