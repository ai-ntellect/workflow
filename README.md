# @ai.ntellect/workflow

The **@ai.ntellect/workflow** package is a robust framework for managing and executing workflows, supporting dynamic decision-making, conditional paths, event-driven execution, and state persistence.

## Features

- **Dynamic Workflow Execution:** Manage workflows with complex branching and parallel paths.
- **Conditional Logic:** Execute nodes based on real-time conditions.
- **Event-Driven Execution:** Trigger actions dynamically using events.
- **State Management:** Handle shared and persistent states.
- **Visualization:** Generate workflow diagrams using Mermaid syntax.

## Installation

Install the package via npm:

```bash
npm install @ai.ntellect/workflow
```

Import the `Workflow` class:

```javascript
import { Workflow } from "@ai.ntellect/workflow";
```

## Creating a content pipeline workflow

Here is an example of creating a workflow to manage a content pipeline:

```javascript
import { Workflow } from "@ai.ntellect/workflow";

const contentPipelineDefinition = {
  name: "ContentPipeline",
  entryNode: "fetchContent",
  nodes: {
    fetchContent: {
      name: "fetchContent",
      description: "Fetch content from external APIs",
      execute: async (state) => {
        console.log("Fetching content...");
        state.content = ["Article1", "Article2"];
        return state;
      },
      next: ["processContent"],
    },
    processContent: {
      name: "processContent",
      description: "Process and analyze content",
      execute: async (state) => {
        console.log("Processing content:", state.content);
        state.processedContent = state.content.map((c) => c.toUpperCase());
        return state;
      },
      next: ["publishContent"],
    },
    publishContent: {
      name: "publishContent",
      description: "Publish processed content",
      execute: async (state) => {
        console.log("Publishing content:", state.processedContent);
        state.published = true;
        return state;
      },
    },
  },
};

const workflow = new Workflow(contentPipelineDefinition);
```

## Executing the workflow

Run the content pipeline workflow with an initial state:

```javascript
const initialState = {};
await workflow.execute(initialState, "fetchContent");
```

Example output:

```text
Fetching content...
Processing content: [ 'Article1', 'Article2' ]
Publishing content: [ 'ARTICLE1', 'ARTICLE2' ]
```

## Visualizing the workflow

Generate a visual representation of the content pipeline workflow:

```javascript
workflow.visualize("Content Pipeline Workflow");
```

Output example:

```mermaid
workflow TD
  fetchContent[Fetch Content]
  processContent[Process Content]
  publishContent[Publish Content]
  fetchContent --> processContent
  processContent --> publishContent
```

## Advanced features

### Event-driven execution

Add event-driven nodes to the workflow:

```javascript
workflow.addNode(
  {
    name: "eventDrivenNode",
    description: "Node triggered by a custom event",
    execute: async (state) => {
      console.log("Custom event processed.");
      return state;
    },
  },
  { events: ["customEvent"] }
);

workflow.emit("customEvent", { state: { exampleKey: "exampleValue" } });
```

Example output:

```text
Custom event processed.
```

### Parallel execution

Execute multiple nodes concurrently:

```javascript
await workflow.executeParallel(
  { data: "Parallel Execution" },
  ["nodeA", "nodeB"],
  2
);
```

### Conditional logic

Add conditional nodes to control the workflow path:

```javascript
workflow.addNode(
  {
    name: "conditionalNode",
    description: "Node executed conditionally",
    execute: async (state) => {
      console.log("Condition met, executing node...");
      return state;
    },
  },
  {
    condition: (state) => state.content && state.content.length > 0,
    next: ["publishContent"],
  }
);
```

### Sub-workflows

Embed sub-workflows for modularity:

```javascript
const subWorkflowDefinition = {
  name: "SubWorkflow",
  nodes: {
    subNode: {
      name: "subNode",
      execute: async (state) => {
        console.log("Executing sub-workflow.");
        return state;
      },
    },
  },
};

workflow.addSubWorkflow(
  new Workflow(subWorkflowDefinition),
  "subNode",
  "processContent"
);
```
