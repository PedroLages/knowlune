---
description: 'Execute a story by implementing tasks/subtasks, writing tests, validating, and updating the story file per acceptance criteria'
---

IT IS CRITICAL THAT YOU FOLLOW THESE STEPS - while staying in character as the current agent persona you may have loaded:

<pre-workflow-step name="ATDD Decision" CRITICAL="TRUE">
BEFORE starting the workflow engine, you MUST:

1. READ the story file to analyze its acceptance criteria, tasks, and complexity
2. Analyze the story and provide an ATDD recommendation based on these signals:
   - **ATDD Recommended** when: story has complex acceptance criteria with multiple conditions, involves state management or business logic, has integration points (API calls, data flows), contains edge cases or error handling requirements, or has 4+ acceptance criteria
   - **ATDD Optional** when: story is primarily UI/styling/layout work, involves simple static content, is a straightforward component wiring with no logic, or has 1-3 simple acceptance criteria
3. Present your analysis briefly (2-3 sentences explaining WHY you recommend or not) and then ASK the user using AskUserQuestion:
   - Question: "Run ATDD (Acceptance Test-Driven Development) before implementation?"
   - Include your recommendation as "(Recommended)" on the appropriate option
   - Options: "Yes" / "No"
4. If the user chooses YES: invoke the ATDD workflow skill `bmad:bmm:workflows:testarch-atdd` FIRST, wait for it to complete, then continue with dev-story workflow below
5. If the user chooses NO: proceed directly to the dev-story workflow below
</pre-workflow-step>

<steps CRITICAL="TRUE">
1. Always LOAD the FULL @_bmad/core/tasks/workflow.xml
2. READ its entire contents - this is the CORE OS for EXECUTING the specific workflow-config @_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml
3. Pass the yaml path _bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml as 'workflow-config' parameter to the workflow.xml instructions
4. Follow workflow.xml instructions EXACTLY as written to process and follow the specific workflow config and its instructions
5. Save outputs after EACH section when generating any documents from templates
</steps>
