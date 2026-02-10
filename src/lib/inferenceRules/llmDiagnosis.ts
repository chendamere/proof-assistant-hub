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
  // Use relative URL so Vite proxy is used (avoids CORS when app is on localhost:8080)
  const ollamaEndpoint = import.meta.env.VITE_OLLAMA_ENDPOINT || (typeof window !== "undefined" ? "/api/ollama" : "http://localhost:11434");
  const ollamaModel = import.meta.env.VITE_OLLAMA_MODEL || "llama3:8b";
  
  // Check for OpenAI
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const openaiEndpoint = import.meta.env.VITE_OPENAI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
  const openaiModel = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini';
  
  // Check for Gemini
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const geminiEndpoint = import.meta.env.VITE_GEMINI_API_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta/models';
  const geminiModel = import.meta.env.VITE_GEMINI_MODEL || 'gemini-pro';
  
  // Check for Groq
  const groqKey = import.meta.env.VITE_GROQ_API_KEY;
  const groqEndpoint = import.meta.env.VITE_GROQ_API_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions';
  const groqModel = import.meta.env.VITE_GROQ_MODEL || 'llama-3.1-8b-instant';
  
  // LLM diagnosis disabled by default. Set VITE_ENABLE_LLM_DIAGNOSIS=true to enable.
  const llmEnabled = import.meta.env.VITE_ENABLE_LLM_DIAGNOSIS === 'true';
  
  if (!llmEnabled) {
    return {
      type: 'ollama',
      endpoint: ollamaEndpoint,
      model: ollamaModel,
      enabled: false,
    };
  }
  
  // Priority: Ollama (local, free) > Groq (free tier) > Gemini (free tier) > OpenAI
  if (ollamaEndpoint) {
    return {
      type: 'ollama',
      endpoint: ollamaEndpoint,
      model: ollamaModel,
      enabled: true,
    };
  }
  
  if (groqKey) {
    return {
      type: 'groq',
      endpoint: groqEndpoint,
      apiKey: groqKey,
      model: groqModel,
      enabled: true,
    };
  }
  
  if (geminiKey) {
    return {
      type: 'gemini',
      endpoint: geminiEndpoint,
      apiKey: geminiKey,
      model: geminiModel,
      enabled: true,
    };
  }
  
  if (openaiKey) {
    return {
      type: 'openai',
      endpoint: openaiEndpoint,
      apiKey: openaiKey,
      model: openaiModel,
      enabled: true,
    };
  }
  
  // Default to Ollama (will fail gracefully if not running)
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
 * Call Ollama API (local Llama models)
 */
async function callOllamaAPI(
  prompt: string,
  config: LLMProviderConfig
): Promise<string> {
  const endpoint = config.endpoint || 'http://localhost:11434';
  const model = config.model || 'llama3:8b';
  
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
 * Call OpenAI-compatible API (OpenAI, Groq, etc.)
 */
async function callOpenAICompatibleAPI(
  prompt: string,
  config: LLMProviderConfig
): Promise<string> {
  if (!config.apiKey) {
    throw new Error('API key required');
  }

  const response = await fetch(config.endpoint!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert in formal proof verification systems. Analyze proof transition failures and provide clear, actionable diagnostic information. Always respond with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || data.content || '';
}

/**
 * Call Google Gemini API
 */
async function callGeminiAPI(
  prompt: string,
  config: LLMProviderConfig
): Promise<string> {
  if (!config.apiKey) {
    throw new Error('API key required');
  }

  const model = config.model || 'gemini-pro';
  const endpoint = `${config.endpoint}/${model}:generateContent?key=${config.apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1000,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

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
      case 'groq':
        provider = 'Groq';
        response = await callOpenAICompatibleAPI(prompt, config);
        break;
      case 'gemini':
        provider = 'Google Gemini';
        response = await callGeminiAPI(prompt, config);
        break;
      case 'openai':
        provider = 'OpenAI';
        response = await callOpenAICompatibleAPI(prompt, config);
        break;
      default:
        throw new Error(`Unsupported provider: ${config.type}`);
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
