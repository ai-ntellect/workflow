import { Workflow } from "..";

export class Executor {
  private workflows: Record<string, Workflow<any>>;

  constructor() {
    this.workflows = {};
  }

  addWorkflow(workflowName: string, workflowInstance: Workflow<any>) {
    this.workflows[workflowName] = workflowInstance;
  }

  async executeWorkflowsInParallel(
    workflowNames: string[],
    initialState: any,
    concurrencyLimit: number = 5
  ) {
    console.log(
      `\n🚀 Starting parallel execution of workflows: ${workflowNames.join(
        ", "
      )}`
    );

    const workflowPromises = workflowNames.map(async (workflowName) => {
      const workflow = this.workflows[workflowName];
      if (!workflow) {
        console.error(`❌ Workflow not found: ${workflowName}`);
        return;
      }

      console.log(`➡️ Starting execution of workflow: ${workflowName}`);
      const nodeNames = Array.from(workflow.nodes.keys());
      await workflow.executeParallel(initialState, nodeNames, concurrencyLimit);
      console.log(`✔️ Workflow "${workflowName}" completed.`);
    });

    await Promise.all(workflowPromises);

    console.log("\n✅ All workflows executed successfully.");
  }
}
