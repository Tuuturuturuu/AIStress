# AIStress workspace instructions

- The application scaffold lives in the `AIStress/` subdirectory.
- Frontend: React with Vite and Material UI; run checks with `npm --prefix AIStress/frontend run lint` and `npm --prefix AIStress/frontend run build`.
- Backend: FastAPI in `AIStress/backend/app`; keep CORS aligned with the frontend development origin (`localhost:5173`).
- Keep user-facing text and documentation in Spanish unless requested otherwise.
- Do not launch long-running development servers unless the user explicitly asks.

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->
- [ ] Verify that the copilot-instructions.md file in the .github directory is created.

- [ ] Clarify Project Requirements
	<!-- Ask for project type, language, and frameworks if not specified. Skip if already provided. -->

- [ ] Scaffold the Project
	<!--
	Ensure that the previous step has been marked as completed.
	Call project setup tool with projectType parameter.
	Run scaffolding command to create project files and folders.
	Use '.' as the working directory.
	If no appropriate projectType is available, search documentation using available tools.
	Otherwise, create the project structure manually using available file creation tools.
	-->

- [ ] Customize the Project
	<!--
	Verify that all previous steps have been completed successfully and you have marked the step as completed.
	Develop a plan to modify codebase according to user requirements.
	Apply modifications using appropriate tools and user-provided references.
	Skip this step for "Hello World" projects.
	-->

- [ ] Install Required Extensions
	<!-- ONLY install extensions mentioned in the project setup information. Skip this step otherwise and mark as completed. -->

- [ ] Compile the Project
	<!--
	Verify that all previous steps have been completed.
	Install any missing dependencies.
	Run diagnostics and resolve any issues.
	Check for markdown files in project folder for relevant instructions on how to do this.
	-->

- [ ] Create and Run Task
	<!--
	Verify that all previous steps have been completed.
	Check https://code.visualstudio.com/docs/debugtest/tasks to determine if the project needs a task. If so, use the create_and_run_task to create and launch a task based on package.json, README.md, and project structure.
	Skip this step otherwise.
	-->

- [ ] Launch the Project
	<!--
	Verify that all previous steps have been completed.
	Prompt user for debug mode, launch only if confirmed.
	-->

- [ ] Ensure Documentation is Complete
	<!--
	Verify that all previous steps have been completed.
	Verify that README.md and the copilot-instructions.md file in the .github directory exists and contains current project information.
	Clean up the copilot-instructions.md file in the .github directory by removing all HTML comments.
	-->

<!--
## Execution Guidelines
PROGRESS TRACKING:
- If any tools are available to manage the above todo list, use it to track progress through this checklist.
- After completing each step, mark it complete and add a summary.
- Read current todo list status before starting each new step.

COMMUNICATION RULES:
- Avoid verbose explanations or printing full command outputs.
- Do not explain project structure unless asked.
- Keep explanations concise and focused.

DEVELOPMENT RULES:
- Use '.' as the working directory unless user specifies otherwise.
- Avoid adding media or external links unless explicitly requested.
- Do not add unrequested integrations.
- Once the project is created, it is already opened in Visual Studio Code—do not suggest commands to open this project in Visual Studio again.
- If the project setup information has additional rules, follow them strictly.

FOLDER CREATION RULES:
- Always use the current directory as the project root.
- Do not create a new folder unless the user explicitly requests it besides a .vscode folder for a tasks.json file.
- If scaffolding reports the folder name is not correct, let the user know to create a new folder with the correct name and reopen it in VS Code.

EXTENSION INSTALLATION RULES:
- Only install extensions specified by the project setup information. Do not install any other extensions.

PROJECT CONTENT RULES:
- If project details are specified, follow them; otherwise start with a minimal Hello World project.
- Ensure generated components serve the requested workflow.
- If a feature is assumed but not confirmed, ask before including it.
- For VS Code extensions, use the VS Code API tool with a query for relevant references and samples.

TASK COMPLETION RULES:
- Project should be scaffolded and compile without errors.
- README.md and this file should exist and be up to date.
- Provide clear instructions to run and debug the project.

Before starting a new task in the above plan, update progress in the plan.
-->
- Work through each checklist item systematically.
- Keep communication concise and focused.
- Follow development best practices.
