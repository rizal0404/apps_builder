/**
 * Phase 4 — Tool definitions and executor for Autonomous mode.
 *
 * Four tools are available to the AI planner:
 *   - read_file: read a single file's source from the project
 *   - write_file: create or overwrite a file in the project
 *   - run_function: execute a function via the scripts.run API
 *   - deploy_web_app: version + deploy the project as a web app
 *
 * Each tool definition includes both an OpenAI-compatible JSON Schema
 * and a method to convert to Gemini's `functionDeclarations` format.
 */

import {
  getProjectContent,
  updateProjectContent,
  createVersion,
  createDeployment,
  runFunction,
  type AppsScriptFile,
  type AppsScriptFileType,
} from './appsScriptApi';

// ── Tool definition schema (OpenAI-compatible) ─────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'read_file',
    description:
      'Read the source content of a single file from the current Apps Script project. ' +
      'Returns the file content as a string. Use this to inspect existing code before making changes.',
    parameters: {
      type: 'object',
      properties: {
        fileName: {
          type: 'string',
          description:
            'Name of the file to read (without extension), e.g. "Code", "Index", "appsscript".',
        },
      },
      required: ['fileName'],
    },
  },
  {
    name: 'write_file',
    description:
      'Create or overwrite a file in the current Apps Script project. ' +
      'Provide the full source content. The file type is inferred from the fileName: ' +
      '".gs" / no extension → SERVER_JS, ".html" → HTML, "appsscript" → JSON.',
    parameters: {
      type: 'object',
      properties: {
        fileName: {
          type: 'string',
          description:
            'Name of the file (without extension), e.g. "Code", "Index", "Sidebar", "appsscript".',
        },
        fileType: {
          type: 'string',
          enum: ['SERVER_JS', 'HTML', 'JSON'],
          description:
            'The Apps Script file type. SERVER_JS for .gs files, HTML for .html files, JSON for appsscript.json.',
        },
        source: {
          type: 'string',
          description: 'The complete source code content of the file.',
        },
      },
      required: ['fileName', 'fileType', 'source'],
    },
  },
  {
    name: 'run_function',
    description:
      'Execute a function in the Apps Script project via the scripts.run API. ' +
      'The script must be deployed as an API Executable for this to work. ' +
      'Returns the function result as a JSON string, or an error message.',
    parameters: {
      type: 'object',
      properties: {
        functionName: {
          type: 'string',
          description: 'Name of the function to execute, e.g. "doGet", "myFunction".',
        },
        parameters: {
          type: 'array',
          items: {},
          description: 'Optional array of parameters to pass to the function.',
        },
      },
      required: ['functionName'],
    },
  },
  {
    name: 'deploy_web_app',
    description:
      'Create a new version of the project and deploy it as a web app. ' +
      'Returns the deployment URL. The script must have a doGet() or doPost() function.',
    parameters: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'A short description for this deployment version.',
        },
      },
      required: ['description'],
    },
  },
];

// ── Tool executor ───────────────────────────────────────────────────────────────

/**
 * Execute a tool call against the Apps Script API.
 *
 * @returns A human-readable result string (success or error detail).
 */
export async function executeTool(
  scriptId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<{ result: string; isError: boolean }> {
  try {
    switch (toolName) {
      case 'read_file':
        return await execReadFile(scriptId, args);
      case 'write_file':
        return await execWriteFile(scriptId, args);
      case 'run_function':
        return await execRunFunction(scriptId, args);
      case 'deploy_web_app':
        return await execDeployWebApp(scriptId, args);
      default:
        return { result: `Unknown tool: ${toolName}`, isError: true };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { result: `Tool "${toolName}" failed: ${msg}`, isError: true };
  }
}

async function execReadFile(
  scriptId: string,
  args: Record<string, unknown>,
): Promise<{ result: string; isError: boolean }> {
  const fileName = String(args.fileName ?? '');
  if (!fileName) return { result: 'Missing required argument: fileName', isError: true };

  const content = await getProjectContent(scriptId);
  const file = content.files.find((f) => f.name === fileName);
  if (!file) {
    const available = content.files.map((f) => `${f.name} (${f.type})`).join(', ');
    return {
      result: `File "${fileName}" not found. Available files: ${available}`,
      isError: true,
    };
  }
  return { result: file.source, isError: false };
}

async function execWriteFile(
  scriptId: string,
  args: Record<string, unknown>,
): Promise<{ result: string; isError: boolean }> {
  const fileName = String(args.fileName ?? '');
  const fileType = String(args.fileType ?? 'SERVER_JS') as AppsScriptFileType;
  const source = String(args.source ?? '');
  if (!fileName) return { result: 'Missing required argument: fileName', isError: true };
  if (!source) return { result: 'Missing required argument: source', isError: true };

  const content = await getProjectContent(scriptId);
  const existing = content.files.find((f) => f.name === fileName && f.type === fileType);

  let updatedFiles: AppsScriptFile[];
  if (existing) {
    // Update existing file
    updatedFiles = content.files.map((f) =>
      f.name === fileName && f.type === fileType ? { ...f, source } : f,
    );
  } else {
    // Add new file
    updatedFiles = [...content.files, { name: fileName, type: fileType, source }];
  }

  await updateProjectContent(scriptId, updatedFiles);
  return {
    result: `${existing ? 'Updated' : 'Created'} file "${fileName}" (${fileType}) successfully.`,
    isError: false,
  };
}

async function execRunFunction(
  scriptId: string,
  args: Record<string, unknown>,
): Promise<{ result: string; isError: boolean }> {
  const functionName = String(args.functionName ?? '');
  if (!functionName) return { result: 'Missing required argument: functionName', isError: true };

  const params = Array.isArray(args.parameters) ? args.parameters : undefined;
  const res = await runFunction(scriptId, functionName, params);

  if (res.error) {
    return { result: `Function error: ${res.error.message}`, isError: true };
  }
  return {
    result:
      res.response?.result !== undefined
        ? JSON.stringify(res.response.result, null, 2)
        : 'Function executed successfully (no return value).',
    isError: false,
  };
}

async function execDeployWebApp(
  scriptId: string,
  args: Record<string, unknown>,
): Promise<{ result: string; isError: boolean }> {
  const description = String(args.description ?? 'GASPOLL deployment');

  // 1. Create a version
  const version = await createVersion(scriptId, description);

  // 2. Create a deployment from that version
  const deployment = await createDeployment(scriptId, version.versionNumber, description);

  // 3. Extract web app URL
  const webAppEntry = deployment.entryPoints?.find((e) => e.entryPointType === 'WEB_APP');
  const url = webAppEntry?.webApp?.url;

  if (url) {
    return {
      result: `Deployed successfully!\nVersion: ${version.versionNumber}\nDeployment ID: ${deployment.deploymentId}\nWeb App URL: ${url}`,
      isError: false,
    };
  }
  return {
    result: `Deployed version ${version.versionNumber} (deployment ID: ${deployment.deploymentId}). No web app URL found — ensure the script has a doGet() or doPost() function and the deployment is configured as a web app.`,
    isError: false,
  };
}

// ── Gemini format adapter ───────────────────────────────────────────────────────

/** Convert our tool definitions to Gemini's `functionDeclarations` format. */
export function toGeminiFunctionDeclarations(): Array<{
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  return TOOL_DEFINITIONS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

/** Convert our tool definitions to OpenAI-compatible `tools` format. */
export function toOpenAITools(): Array<{
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  return TOOL_DEFINITIONS.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
