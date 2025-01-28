import EventEmitter from "events";
import {
  Node,
  Persistence,
  RealTimeNotifier,
  SharedState,
  WorkflowDefinition,
  mergeState,
} from "./types";

/**
 * Represents a directed worflow structure capable of executing nodes in sequence or parallel.
 * The worflow can handle state management, event emissions, and conditional execution paths.
 *
 * @template T - The type of data stored in the worflow's context
 */
export class Workflow<T> {
  /** Stores global context data accessible to all nodes */
  public globalContext: Map<string, any>;

  /** Event emitter for handling worflow-wide events */
  private eventEmitter: EventEmitter;

  /** Map of all nodes in the worflow */
  public nodes: Map<string, Node<T>>;

  /** Set of nodes that have been executed */
  public executedNodes: Set<string>;

  /** Name identifier for the worflow */
  public name: string;

  /** Optional persistence layer for saving worflow state */
  private persistence: Persistence<T> | null;

  /** Optional notifier for real-time updates */
  private notifier: RealTimeNotifier | null;

  /**
   * Creates a new Workflow instance.
   *
   * @param {WorkflowDefinition<T>} [definition] - Initial worflow structure and configuration
   * @param {Object} [config] - Additional configuration options
   * @param {boolean} [config.autoDetectCycles] - Whether to check for cycles during initialization
   * @throws {Error} If cycles are detected when autoDetectCycles is true
   */
  constructor(
    definition?: WorkflowDefinition<T>,
    config?: { autoDetectCycles?: boolean }
  ) {
    this.name = definition?.name || "anonymous";
    this.eventEmitter = new EventEmitter();
    this.globalContext = new Map();
    this.nodes = new Map();
    this.executedNodes = new Set();
    this.persistence = null;
    this.notifier = null;

    if (definition) {
      this.loadFromDefinition(definition);
    }

    if (config?.autoDetectCycles && this.checkForCycles()) {
      throw new Error("Cycle detected in the worflow");
    }
  }
  /**
   * Loads a worflow structure from a definition object.
   * @private
   * @param {WorkflowDefinition<T>} definition - The worflow definition
   */
  private loadFromDefinition(definition: WorkflowDefinition<T>): void {
    Object.entries(definition.nodes).forEach(([_, nodeConfig]) => {
      this.addNode(nodeConfig, {
        condition: nodeConfig.condition,
        next: nodeConfig.next,
      });
    });
  }

  /**
   * Recursively checks if a node is part of a cycle.
   * @private
   * @param {string} nodeName - The name of the node to check
   * @param {Set<string>} visited - Set of visited nodes
   * @param {Set<string>} recStack - Set of nodes in the current recursion stack
   * @returns {boolean} True if a cycle is detected, false otherwise
   */
  private isCyclic(
    nodeName: string,
    visited: Set<string>,
    recStack: Set<string>
  ): boolean {
    if (!visited.has(nodeName)) {
      visited.add(nodeName);
      recStack.add(nodeName);

      const currentNode = this.nodes.get(nodeName);
      if (currentNode?.next) {
        for (const nextNode of currentNode.next) {
          if (
            !visited.has(nextNode) &&
            this.isCyclic(nextNode, visited, recStack)
          ) {
            return true;
          } else if (recStack.has(nextNode)) {
            return true;
          }
        }
      }
    }
    recStack.delete(nodeName);
    return false;
  }

  /**
   * Checks if the worflow contains any cycles.
   * @returns {boolean} True if cycles are detected, false otherwise
   */
  checkForCycles(): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    for (const nodeName of this.nodes.keys()) {
      if (this.isCyclic(nodeName, visited, recStack)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Adds a new node to the worflow.
   * @param {Node<T>} node - The node to add
   * @param {Object} options - Node configuration options
   * @param {Function} [options.condition] - Condition function for node execution
   * @param {string[]} [options.next] - Array of next node names
   * @param {string[]} [options.events] - Array of event names to listen for
   */
  addNode(
    node: Node<T>,
    {
      condition,
      next,
      events,
    }: {
      condition?: (state: SharedState<T>) => boolean;
      next?: string[];
      events?: string[];
    }
  ): void {
    node.next = next;
    node.condition = condition;

    if (events) {
      events.forEach((event) => {
        this.eventEmitter.on(event, async (data) => {
          console.log(`Event "${event}" received by node "${node.name}"`);
          const state = data.state || {};
          await this.execute(state, node.name);
        });
      });
    }

    this.nodes.set(node.name, node);
  }

  /**
   * Emits an event to the worflow's event emitter.
   * @param {string} eventName - Name of the event to emit
   * @param {any} data - Data to pass with the event
   */
  emit(eventName: string, data: any): void {
    console.log(`Event "${eventName}" emitted with data:`, data);
    this.eventEmitter.emit(eventName, data);
  }

  /**
   * Adds a subworflow as a node in the current worflow.
   * @param {Workflow<T>} subWorkflow - The subworflow to add
   * @param {string} entryNode - The entry node name in the subworflow
   * @param {string} name - The name for the subworflow node
   */
  addSubWorkflow(
    subWorkflow: Workflow<T>,
    entryNode: string,
    name: string
  ): void {
    const subWorkflowNode: Node<T> = {
      name,
      execute: async (state) => {
        console.log(`Executing subworflow: ${name}`);
        await subWorkflow.execute(state, entryNode);
        return state;
      },
    };
    this.nodes.set(name, subWorkflowNode);
  }

  /**
   * Updates the worflow structure with a new definition.
   * @param {WorkflowDefinition<T>} definition - The new worflow definition
   */
  updateWorkflow(definition: WorkflowDefinition<T>): void {
    Object.entries(definition.nodes).forEach(([_, nodeConfig]) => {
      if (this.nodes.has(nodeConfig.name)) {
        const existingNode = this.nodes.get(nodeConfig.name)!;
        existingNode.next = nodeConfig.next || existingNode.next;
        existingNode.condition = nodeConfig.condition || existingNode.condition;
      } else {
        this.addNode(nodeConfig, {
          condition: nodeConfig.condition,
          next: nodeConfig.next,
        });
      }
    });
  }

  /**
   * Replace the worflow with a new definition.
   * @param {WorkflowDefinition<T>} definition - The new worflow definition
   */
  replaceWorkflow(definition: WorkflowDefinition<T>): void {
    this.nodes.clear();
    this.loadFromDefinition(definition);
  }

  /**
   * Executes the worflow starting from a specific node.
   * @param {SharedState<T>} state - The initial state
   * @param {string} startNode - The name of the starting node
   * @param {Function} [onStream] - Callback for streaming state updates
   * @param {Function} [onError] - Callback for handling errors
   */
  async execute(
    state: SharedState<T>,
    startNode: string,
    onStream?: (state: SharedState<T>) => void,
    onError?: (error: Error, nodeName: string, state: SharedState<T>) => void
  ): Promise<void> {
    let currentNodeName = startNode;

    while (currentNodeName) {
      this.executedNodes.add(currentNodeName);

      const currentNode = this.nodes.get(currentNodeName);
      if (!currentNode) throw new Error(`Node ${currentNodeName} not found.`);

      if (currentNode.condition && !currentNode.condition(state)) {
        console.log(
          `Condition for node "${currentNodeName}" not met. Ending Workflow.`
        );
        break;
      }

      try {
        if (this.notifier) {
          this.notifier.notify("nodeExecutionStarted", {
            worflow: this.name,
            node: currentNodeName,
          });
        }

        console.log(`Executing node: ${currentNodeName}`);
        const newState = await currentNode.execute(state);
        Object.assign(state, mergeState(state, newState));

        if (onStream) onStream(state);

        if (this.persistence) {
          await this.persistence.saveState(this.name, state, currentNodeName);
        }

        if (this.notifier) {
          await this.notifier.notify("nodeExecutionCompleted", {
            worflow: this.name,
            node: currentNodeName,
            state,
          });
        }
      } catch (error) {
        console.error(`Error in node ${currentNodeName}:`, error);
        if (onError) onError(error as Error, currentNodeName, state);
        if (this.notifier) {
          this.notifier.notify("nodeExecutionFailed", {
            worflow: this.name,
            node: currentNodeName,
            state,
            error,
          });
        }
        break;
      }

      const nextNodes = currentNode.next || [];
      if (nextNodes.length > 1) {
        await Promise.all(
          nextNodes.map((nextNode) =>
            this.execute(state, nextNode, onStream, onError)
          )
        );
        break;
      } else {
        currentNodeName = nextNodes[0] || "";
      }
    }

    console.log(`Workflow completed for node: ${startNode}`);
  }

  /**
   * Executes multiple nodes in parallel with a concurrency limit.
   * @param {SharedState<T>} state - The shared state
   * @param {string[]} nodeNames - Array of node names to execute
   * @param {number} [concurrencyLimit=5] - Maximum number of concurrent executions
   * @param {Function} [onStream] - Callback for streaming state updates
   * @param {Function} [onError] - Callback for handling errors
   */
  async executeParallel(
    state: SharedState<T>,
    nodeNames: string[],
    concurrencyLimit: number = 5,
    onStream?: (state: SharedState<T>) => void,
    onError?: (error: Error, nodeName: string, state: SharedState<T>) => void
  ): Promise<void> {
    console.log(`Executing nodes in parallel: ${nodeNames.join(", ")}`);

    const executeWithLimit = async (nodeName: string) => {
      await this.execute(state, nodeName, onStream, onError);
    };

    const chunks = [];
    for (let i = 0; i < nodeNames.length; i += concurrencyLimit) {
      chunks.push(nodeNames.slice(i, i + concurrencyLimit));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map(executeWithLimit));
    }
  }

  /**
   * Adds a value to the global context.
   * @param {string} key - The key to store the value under
   * @param {any} value - The value to store
   */
  addToContext(key: string, value: any): void {
    this.globalContext.set(key, value);
  }

  /**
   * Retrieves a value from the global context.
   * @param {string} key - The key to retrieve
   * @returns {any} The stored value, or undefined if not found
   */
  getContext(key: string): any {
    return this.globalContext.get(key);
  }

  /**
   * Removes a value from the global context.
   * @param {string} key - The key to remove
   */
  removeFromContext(key: string): void {
    this.globalContext.delete(key);
  }

  /**
   * Sets the persistence layer for the worflow.
   * @param {Persistence<T>} persistence - The persistence implementation
   */
  setPersistence(persistence: Persistence<T>): void {
    this.persistence = persistence;
  }

  /**
   * Sets the real-time notifier for the worflow.
   * @param {RealTimeNotifier} notifier - The notifier implementation
   */
  setNotifier(notifier: RealTimeNotifier): void {
    this.notifier = notifier;
  }

  /**
   * Generates a visual representation of the worflow using Mermaid diagram syntax.
   * The diagram shows all nodes and their connections, with special highlighting for:
   * - Entry nodes (green)
   * - Event nodes (yellow)
   * - Conditional nodes (orange)
   *
   * @param {string} [title] - Optional title for the diagram
   * @returns {string} Mermaid diagram syntax representing the worflow
   */
  generateMermaidDiagram(title?: string): string {
    const lines: string[] = ["worflow TD"];

    if (title) {
      lines.push(`  subworflow ${title}`);
    }

    // Add nodes with styling
    this.nodes.forEach((node, nodeName) => {
      const hasEvents = node.events && node.events.length > 0;
      const hasCondition = !!node.condition;

      // Style nodes based on their properties
      let style = "";
      if (hasEvents) {
        style = "style " + nodeName + " fill:#FFD700,stroke:#DAA520"; // Yellow for event nodes
      } else if (hasCondition) {
        style = "style " + nodeName + " fill:#FFA500,stroke:#FF8C00"; // Orange for conditional nodes
      }

      // Add node definition
      lines.push(`  ${nodeName}[${nodeName}]`);
      if (style) {
        lines.push(`  ${style}`);
      }
    });

    // Add connections
    this.nodes.forEach((node, nodeName) => {
      if (node.next) {
        node.next.forEach((nextNode) => {
          let connectionStyle = "";
          if (node.condition) {
            connectionStyle = "---|condition|"; // Add label for conditional connections
          } else {
            connectionStyle = "-->"; // Normal connection
          }
          lines.push(`  ${nodeName} ${connectionStyle} ${nextNode}`);
        });
      }

      // Add event connections if any
      if (node.events && node.events.length > 0) {
        node.events.forEach((event) => {
          const eventNodeId = `${event}_event`;
          lines.push(`  ${eventNodeId}((${event})):::event`);
          lines.push(`  ${eventNodeId} -.->|trigger| ${nodeName}`);
        });
        // Add style class for event nodes
        lines.push("  classDef event fill:#FFD700,stroke:#DAA520");
      }
    });

    if (title) {
      lines.push("  end");
    }

    return lines.join("\n");
  }

  /**
   * Renders the worflow visualization using Mermaid syntax.
   * This method can be used to visualize the worflow structure in supported environments.
   *
   * @param {string} [title] - Optional title for the visualization
   */
  visualize(title?: string): void {
    const diagram = this.generateMermaidDiagram(title);
    console.log(
      "To visualize this worflow, use a Mermaid-compatible renderer with this syntax:"
    );
    console.log("\n```mermaid");
    console.log(diagram);
    console.log("```\n");
  }
}
