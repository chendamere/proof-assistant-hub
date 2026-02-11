/**
 * LLM-based error diagnosis for failed proof transitions.
 * Supports multiple providers including local Ollama/Llama models.
 *
 * Currently hidden: not imported anywhere. To re-enable, uncomment the import
 * and UI in ProofSteps.tsx and set VITE_ENABLE_LLM_DIAGNOSIS=true.
 */

import type { DiagnosisResult } from './errorDiagnosis';

export interface LLMDiagnosisResult {
  /** Natural language explanation of why the transition failed */
  explanation: string;
  /** Detailed analysis of the failure */
  analysis: string;
  /** Specific suggestions for fixing the issue */
  suggestions: string[];
  /** Potential root causes */
  rootCauses: string[];
  /** Whether LLM diagnosis was successful */
  success: boolean;
  /** Error message if LLM call failed */
  error?: string;
  /** Provider used */
  provider?: string;
}

export interface LLMProviderConfig {
  /** Provider type */
  type: 'ollama' | 'openai' | 'gemini' | 'groq';
  /** API endpoint */
  endpoint?: string;
  /** API key (if required) */
  apiKey?: string;
  /** Model name */
  model?: string;
  /** Enable this provider */
  enabled?: boolean;
}

/**
 * Get LLM configuration from environment variables
 */
function getLLMConfig(): LLMProviderConfig {
  // LLM diagnosis disabled by default. Set VITE_ENABLE_LLM_DIAGNOSIS=true to enable.
  const llmEnabled = import.meta.env.VITE_ENABLE_LLM_DIAGNOSIS === 'true';

  // Use relative URL so Vite proxy is used (avoids CORS when app is on localhost:8080)
  const ollamaEndpoint = import.meta.env.VITE_OLLAMA_ENDPOINT || (typeof window !== "undefined" ? "/api/ollama" : "http://localhost:11434");
  const ollamaModel = import.meta.env.VITE_OLLAMA_MODEL || "llama3:8b";

  if (!llmEnabled) {
    return {
      type: 'ollama',
      endpoint: ollamaEndpoint,
      model: ollamaModel,
      enabled: false,
    };
  }

  // Only Ollama (local, free) is supported client-side.
  // For cloud LLM providers, use a backend edge function instead.
  return {
    type: 'ollama',
    endpoint: ollamaEndpoint,
    model: ollamaModel,
    enabled: true,
  };
}

/**
 * Format diagnosis data for LLM prompt
 */
function formatDiagnosisForPrompt(
  targetLeft: string,
  targetRight: string,
  diagnosis: DiagnosisResult
): string {
  const char = diagnosis.characteristics;
  const operators = [...char.operatorsAll].join(', ');
  
  const rulesTriedSummary = diagnosis.rulesTried
    .slice(0, 10) // Limit to first 10 rules
    .map((r, idx) => {
      return `${idx + 1}. Rule "${r.ruleId}": ${r.reason}${r.failureReason ? ` (Failed: ${r.failureReason})` : ''}`;
    })
    .join('\n');

  return `You are an expert in formal proof verification systems. Analyze why this proof transition verification failed and provide clear, actionable diagnostic information.

Target Transition:
Left:  ${targetLeft}
Right: ${targetRight}

Transition Characteristics:
- Operation count delta: ${char.delta} (right - left)
- Left side operations: ${char.opCountLeft}
- Right side operations: ${char.opCountRight}
- Operators present: ${operators || 'none'}
- Has branches: ${char.hasBranches ? 'yes' : 'no'}

Rules Attempted: ${diagnosis.totalRulesTried}
Rules Filtered Out: ${diagnosis.rulesFiltered}

Rules Tried:
${rulesTriedSummary || 'None'}

${diagnosis.possibleReasons.length > 0 ? `Possible Reasons:\n${diagnosis.possibleReasons.map(r => `- ${r}`).join('\n')}` : ''}

${diagnosis.suggestions.length > 0 ? `Current Suggestions:\n${diagnosis.suggestions.map(s => `- ${s}`).join('\n')}` : ''}

${diagnosis.similarRules ? `Similar Rules (not tried):\n${diagnosis.similarRules.map(r => `- ${r.ruleId} (${Math.round(r.similarity * 100)}% similar)`).join('\n')}` : ''}

Provide a JSON response with:
1. "explanation": A clear, concise explanation of why this proof transition verification failed (2-3 sentences)
2. "analysis": Detailed analysis of what might be wrong (3-5 sentences)
3. "suggestions": Array of specific, actionable suggestions for fixing the issue
4. "rootCauses": Array of potential root causes (e.g., missing rule, incorrect expression structure, etc.)

Format your response as valid JSON only.`;
}

/**
 * Validate that an endpoint URL points to localhost only (SSRF prevention)
 */
function isAllowedEndpoint(url: string): boolean {
  try {
    const parsed = new URL(url);
    const allowedHosts = ['localhost', '127.0.0.1', '[::1]'];
    return allowedHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Call Ollama API (local Llama models)
 */
async function callOllamaAPI(
  prompt: string,
  config: LLMProviderConfig
): Promise<string> {
  const endpoint = config.endpoint || 'http://localhost:11434';
  const model = config.model || 'llama3:8b';

  if (!isAllowedEndpoint(endpoint)) {
    throw new Error('Ollama endpoint must be a localhost address. External endpoints are not allowed for security reasons.');
  }
  
  const response = await fetch(`${endpoint}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 1000,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.response || '';
}

/**
 * Call OpenAI-compatible API (via backend edge function in future)
 * Currently unused — kept as reference for edge function migration.
 */

/**
 * Parse LLM response into structured format
 */
function parseLLMResponse(response: string): LLMDiagnosisResult {
  try {
    // Try to extract JSON from response (in case there's extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : response;
    
    const parsed = JSON.parse(jsonStr);
    
    return {
      explanation: parsed.explanation || 'No explanation provided',
      analysis: parsed.analysis || parsed.detailedAnalysis || '',
      suggestions: Array.isArray(parsed.suggestions) 
        ? parsed.suggestions 
        : parsed.suggestions 
          ? [parsed.suggestions] 
          : [],
      rootCauses: Array.isArray(parsed.rootCauses)
        ? parsed.rootCauses
        : parsed.rootCauses
          ? [parsed.rootCauses]
          : [],
      success: true,
    };
  } catch (e) {
    // If JSON parsing fails, treat entire response as explanation
    // Try to extract useful information
    const lines = response.split('\n').filter(l => l.trim());
    const explanation = lines.slice(0, 3).join(' ') || response;
    const analysis = lines.slice(3).join('\n') || '';
    
    return {
      explanation: explanation.substring(0, 500),
      analysis: analysis.substring(0, 1000),
      suggestions: [],
      rootCauses: [],
      success: true,
    };
  }
}

/**
 * Generate LLM-based diagnosis for a failed transition
 */
export async function generateLLMDiagnosis(
  targetLeft: string,
  targetRight: string,
  diagnosis: DiagnosisResult
): Promise<LLMDiagnosisResult> {
  const config = getLLMConfig();
  
  if (!config.enabled) {
    return {
      explanation: 'LLM diagnosis is not enabled.',
      analysis: '',
      suggestions: [],
      rootCauses: [],
      success: false,
      error: 'LLM not enabled',
    };
  }

  try {
    const prompt = formatDiagnosisForPrompt(targetLeft, targetRight, diagnosis);
    let response: string;
    let provider: string;

    switch (config.type) {
      case 'ollama':
        provider = 'Ollama (Llama)';
        response = await callOllamaAPI(prompt, config);
        break;
      default:
        throw new Error(`Unsupported provider: ${config.type}. Cloud LLM providers should use a backend edge function.`);
    }

    const parsed = parseLLMResponse(response);
    parsed.provider = provider;
    
    return parsed;
  } catch (error) {
    console.error('LLM diagnosis error:', error);
    
    // Provide helpful error message
    let errorMsg = 'Failed to generate LLM diagnosis.';
    if (config.type === 'ollama') {
      errorMsg += ' Make sure Ollama is running locally (http://localhost:11434). Install from https://ollama.ai';
    } else if (!config.apiKey) {
      errorMsg += ` API key not configured for ${config.type}.`;
    } else {
      errorMsg += ` Error: ${error instanceof Error ? error.message : String(error)}`;
    }
    
    return {
      explanation: errorMsg,
      analysis: '',
      suggestions: [],
      rootCauses: [],
      success: false,
      error: error instanceof Error ? error.message : String(error),
      provider: config.type,
    };
  }
}

/**
 * Check if LLM diagnosis is available
 */
export function isLLMDiagnosisAvailable(): boolean {
  const config = getLLMConfig();
  return config.enabled === true;
}

/**
 * Get current LLM provider info
 */
export function getLLMProviderInfo(): { type: string; model?: string; endpoint?: string } {
  const config = getLLMConfig();
  return {
    type: config.type,
    model: config.model,
    endpoint: config.endpoint,
  };
}
