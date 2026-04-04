
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// Available Gemini models
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub enum GeminiModel {
    #[serde(rename = "gemini-2.5-pro")]
    Pro25,
    #[serde(rename = "gemini-2.5-flash")]
    Flash25,
    #[serde(rename = "gemini-2.5-flash-lite")]
    FlashLite25,
    #[serde(rename = "gemini-3-flash")]
    Flash3,
}

#[allow(dead_code)]
impl GeminiModel {
    pub fn as_str(&self) -> &str {
        match self {
            GeminiModel::Pro25 => "gemini-2.5-pro",
            GeminiModel::Flash25 => "gemini-2.5-flash",
            GeminiModel::FlashLite25 => "gemini-2.5-flash-lite",
            GeminiModel::Flash3 => "gemini-3-flash",
        }
    }
}

impl Default for GeminiModel {
    fn default() -> Self {
        GeminiModel::Flash25
    }
}

/// State for the Vertex AI client
pub struct VertexState {
    pub project_id: Mutex<Option<String>>,
    pub location: Mutex<String>,
    pub client: Client,
}

impl VertexState {
    pub fn new() -> Self {
        let project_id = std::env::var("PROJECT_ID").ok();
        // Gemini 2.5+ models require 'global' location on Vertex AI
        let location = std::env::var("VERTEX_LOCATION").unwrap_or_else(|_| "global".to_string());

        Self {
            project_id: Mutex::new(project_id),
            location: Mutex::new(location),
            client: Client::new(),
        }
    }
}

/// Response from Vertex AI
#[derive(Debug, Deserialize)]
struct VertexResponse {
    candidates: Option<Vec<Candidate>>,
    error: Option<VertexError>,
}

#[derive(Debug, Deserialize)]
struct Candidate {
    content: Option<ContentBlock>,
}

#[derive(Debug, Deserialize)]
struct ContentBlock {
    parts: Option<Vec<Part>>,
}

#[derive(Debug, Deserialize)]
struct Part {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct VertexError {
    message: String,
}

/// Internal helper to call the Vertex AI Gemini API
async fn call_gemini(
    state: &VertexState,
    model: &str,
    system_prompt: &str,
    user_prompt: &str,
) -> Result<String, String> {
    let project_id = state
        .project_id
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or_else(|| "PROJECT_ID not configured. Set it in .env file.".to_string())?;

    let location = state.location.lock().map_err(|e| e.to_string())?.clone();

    // Get auth token
    let provider = gcp_auth::provider()
        .await
        .map_err(|e| format!("Failed to get auth provider: {}. Run `gcloud auth application-default login` first.", e))?;

    let scopes = &["https://www.googleapis.com/auth/cloud-platform"];
    let token = provider
        .token(scopes)
        .await
        .map_err(|e| format!("Failed to get auth token: {}", e))?;

    // Build the API URL — 'global' uses a different hostname pattern
    let url = if location == "global" {
        format!(
            "https://aiplatform.googleapis.com/v1/projects/{}/locations/{}/publishers/google/models/{}:generateContent",
            project_id, location, model
        )
    } else {
        format!(
            "https://{}-aiplatform.googleapis.com/v1/projects/{}/locations/{}/publishers/google/models/{}:generateContent",
            location, project_id, location, model
        )
    };

    let body = serde_json::json!({
        "contents": [
            {
                "role": "user",
                "parts": [{"text": user_prompt}]
            }
        ],
        "systemInstruction": {
            "parts": [{"text": system_prompt}]
        },
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 8192,
        }
    });

    let response = state
        .client
        .post(&url)
        .bearer_auth(token.as_str())
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();
    let response_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if !status.is_success() {
        return Err(format!("API error ({}): {}", status, response_text));
    }

    // Parse response - handle both single response and array response
    let text = if response_text.trim_start().starts_with('[') {
        // Streaming response returns an array
        let responses: Vec<VertexResponse> =
            serde_json::from_str(&response_text).map_err(|e| format!("Parse error: {}", e))?;
        responses
            .iter()
            .filter_map(|r| {
                r.candidates.as_ref()?.first()?.content.as_ref()?.parts.as_ref()?.first()?.text.as_ref()
            })
            .cloned()
            .collect::<Vec<_>>()
            .join("")
    } else {
        let response: VertexResponse =
            serde_json::from_str(&response_text).map_err(|e| format!("Parse error: {}", e))?;
        if let Some(err) = response.error {
            return Err(format!("API error: {}", err.message));
        }
        response
            .candidates
            .and_then(|c| c.into_iter().next())
            .and_then(|c| c.content)
            .and_then(|c| c.parts)
            .and_then(|p| p.into_iter().next())
            .and_then(|p| p.text)
            .ok_or_else(|| "Empty response from API".to_string())?
    };

    Ok(text)
}

/// Send a chat message to the AI with context
#[tauri::command]
pub async fn chat_with_ai(
    state: tauri::State<'_, VertexState>,
    message: String,
    context: Option<String>,
    model: String,
) -> Result<String, String> {
    let system_prompt = "You are StudyShell AI, an intelligent academic assistant. You help students understand their course materials, summarize content, create study guides, and answer questions about their files. Be concise, clear, and academically rigorous. Use markdown formatting in your responses.";

    let user_prompt = if let Some(ctx) = context {
        format!(
            "Context from the currently open file:\n---\n{}\n---\n\nUser question: {}",
            ctx, message
        )
    } else {
        message
    };

    call_gemini(&state, &model, system_prompt, &user_prompt).await
}

/// Summarize the content of multiple files
#[tauri::command]
pub async fn summarize_files(
    state: tauri::State<'_, VertexState>,
    paths: Vec<String>,
    model: String,
) -> Result<String, String> {
    let mut file_contents = Vec::new();

    for path in &paths {
        let content = std::fs::read_to_string(path)
            .map_err(|e| format!("Failed to read {}: {}", path, e))?;
        let filename = std::path::Path::new(path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy();
        file_contents.push(format!("### File: {}\n{}", filename, content));
    }

    let combined = file_contents.join("\n\n---\n\n");
    let system_prompt = "You are an academic summarization engine. Given the content of multiple files from a student's coursework, create a comprehensive summary in Markdown format. Include: key concepts, important definitions, main arguments, and connections between the files. Structure the summary with clear headings and bullet points.";
    let user_prompt = format!(
        "Please summarize the following {} files:\n\n{}",
        paths.len(),
        combined
    );

    call_gemini(&state, &model, system_prompt, &user_prompt).await
}

/// Generate a study guide from multiple files
#[tauri::command]
pub async fn generate_study_guide(
    state: tauri::State<'_, VertexState>,
    paths: Vec<String>,
    model: String,
) -> Result<String, String> {
    let mut file_contents = Vec::new();

    for path in &paths {
        let content = std::fs::read_to_string(path)
            .map_err(|e| format!("Failed to read {}: {}", path, e))?;
        let filename = std::path::Path::new(path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy();
        file_contents.push(format!("### File: {}\n{}", filename, content));
    }

    let combined = file_contents.join("\n\n---\n\n");
    let system_prompt = "You are an expert academic tutor. Given course materials, create a comprehensive study guide in Markdown format. Include:\n1. **Key Topics** — List and explain main topics\n2. **Core Concepts** — Define important terms and concepts\n3. **Summary Notes** — Concise notes for each topic\n4. **Review Questions** — Practice questions to test understanding\n5. **Key Formulas/Theorems** — If applicable\n6. **Study Tips** — Specific advice for mastering this material";
    let user_prompt = format!(
        "Create a study guide from the following {} files:\n\n{}",
        paths.len(),
        combined
    );

    call_gemini(&state, &model, system_prompt, &user_prompt).await
}

/// Check if Vertex AI is configured
#[tauri::command]
pub fn check_vertex_config(state: tauri::State<'_, VertexState>) -> Result<bool, String> {
    let project_id = state.project_id.lock().map_err(|e| e.to_string())?;
    Ok(project_id.is_some())
}
