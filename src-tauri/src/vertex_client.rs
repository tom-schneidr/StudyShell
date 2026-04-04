use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::path::Path;
use base64::{Engine as _, engine::general_purpose};

/// Available Gemini models (Updated for April 2026)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub enum GeminiModel {
    #[serde(rename = "gemini-3-flash-preview")]
    Flash3,
    #[serde(rename = "gemini-3.1-pro-preview")]
    Pro31,
    #[serde(rename = "gemini-2.5-pro")]
    Pro25,
    #[serde(rename = "gemini-2.5-flash")]
    Flash25,
}

#[allow(dead_code)]
impl GeminiModel {
    pub fn as_str(&self) -> &str {
        match self {
            GeminiModel::Flash3 => "gemini-3-flash-preview",
            GeminiModel::Pro31 => "gemini-3.1-pro-preview",
            GeminiModel::Pro25 => "gemini-2.5-pro",
            GeminiModel::Flash25 => "gemini-2.5-flash",
        }
    }
}

impl Default for GeminiModel {
    fn default() -> Self {
        GeminiModel::Flash3
    }
}

pub struct VertexState {
    pub project_id: Mutex<Option<String>>,
    pub location: Mutex<String>,
    pub client: Client,
}

impl VertexState {
    pub fn new() -> Self {
        let project_id = std::env::var("PROJECT_ID").ok();
        // Gemini 2.5/3 models use 'global' location for automatic routing
        let location = std::env::var("VERTEX_LOCATION").unwrap_or_else(|_| "global".to_string());
        Self {
            project_id: Mutex::new(project_id),
            location: Mutex::new(location),
            client: Client::new(),
        }
    }
}

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

#[derive(Serialize)]
#[serde(untagged)]
enum RequestPart {
    Text { text: String },
    InlineData {
        #[serde(rename = "inlineData")]
        inline_data: InlineData,
    },
}

#[derive(Serialize)]
struct InlineData {
    #[serde(rename = "mimeType")]
    mime_type: String,
    data: String,
}

async fn call_gemini(
    state: &VertexState,
    model: &str,
    system_prompt: &str,
    parts: Vec<RequestPart>,
) -> Result<String, String> {
    let project_id = state.project_id.lock().unwrap().clone()
        .ok_or_else(|| "PROJECT_ID not configured.".to_string())?;
    let location = state.location.lock().unwrap().clone();

    let provider = gcp_auth::provider().await
        .map_err(|e| format!("Auth error: {}. Use 'gcloud auth application-default login'.", e))?;
    let token = provider.token(&["https://www.googleapis.com/auth/cloud-platform"]).await
        .map_err(|e| format!("Token error: {}", e))?;

    // Most 2026 models support the global endpoint
    let url = if location == "global" {
        format!("https://aiplatform.googleapis.com/v1/projects/{}/locations/{}/publishers/google/models/{}:generateContent", project_id, location, model)
    } else {
        format!("https://{}-aiplatform.googleapis.com/v1/projects/{}/locations/{}/publishers/google/models/{}:generateContent", location, project_id, location, model)
    };

    let body = serde_json::json!({
        "contents": [{ "role": "user", "parts": parts }],
        "systemInstruction": { "parts": [{"text": system_prompt}] },
        "generationConfig": { "temperature": 0.4, "maxOutputTokens": 8192 }
    });

    let resp = state.client.post(url)
        .header("Authorization", format!("Bearer {}", token.as_str()))
        .json(&body)
        .send().await
        .map_err(|e| e.to_string())?;

    let text = resp.text().await.map_err(|e| e.to_string())?;
    let vertex_resp: VertexResponse = serde_json::from_str(&text).map_err(|e| format!("Parse error: {}. Raw: {}", e, text))?;

    if let Some(err) = vertex_resp.error {
        return Err(err.message);
    }

    if let Some(candidates) = vertex_resp.candidates {
        if let Some(candidate) = candidates.first() {
            if let Some(content) = &candidate.content {
                if let Some(parts) = &content.parts {
                    if let Some(part) = parts.first() {
                        if let Some(text) = &part.text {
                            return Ok(text.clone());
                        }
                    }
                }
            }
        }
    }

    Err("No response from AI".to_string())
}

#[tauri::command]
pub async fn chat_with_ai(
    state: tauri::State<'_, VertexState>,
    message: String,
    context: Option<String>,
    model: String,
) -> Result<String, String> {
    let mut parts = Vec::new();
    if let Some(ctx) = context {
        parts.push(RequestPart::Text { text: format!("Context (Reference Material):\n---\n{}\n---\n", ctx) });
    }
    parts.push(RequestPart::Text { text: message });

    call_gemini(&state, &model, "You are StudyShell AI, a professional academic assistant. Support markdown in all responses.", parts).await
}

#[tauri::command]
pub async fn summarize_files(
    state: tauri::State<'_, VertexState>,
    paths: Vec<String>,
    model: String,
) -> Result<String, String> {
    let mut parts = Vec::new();
    for path_str in paths {
        let path = Path::new(&path_str);
        if let Ok(data) = std::fs::read(path) {
            let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if extension == "pdf" {
                parts.push(RequestPart::InlineData {
                    inline_data: InlineData {
                        mime_type: "application/pdf".to_string(),
                        data: general_purpose::STANDARD.encode(data),
                    }
                });
            } else {
                if let Ok(text) = String::from_utf8(data) {
                    parts.push(RequestPart::Text { text: format!("File: {}\n---\n{}\n---\n", path_str, text) });
                }
            }
        }
    }

    parts.push(RequestPart::Text { text: "Provide a structured academic summary of the attached materials.".to_string() });

    call_gemini(&state, &model, "You are an expert academic summarizer.", parts).await
}

#[tauri::command]
pub async fn generate_study_guide(
    state: tauri::State<'_, VertexState>,
    paths: Vec<String>,
    model: String,
) -> Result<String, String> {
    let mut parts = Vec::new();
    for path_str in paths {
        let path = Path::new(&path_str);
        if let Ok(data) = std::fs::read(path) {
            let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if extension == "pdf" {
                parts.push(RequestPart::InlineData {
                    inline_data: InlineData {
                        mime_type: "application/pdf".to_string(),
                        data: general_purpose::STANDARD.encode(data),
                    }
                });
            } else {
                if let Ok(text) = String::from_utf8(data) {
                    parts.push(RequestPart::Text { text: format!("Content: {}\n---\n{}\n---\n", path_str, text) });
                }
            }
        }
    }

    parts.push(RequestPart::Text { text: "Create a detailed study guide from these materials.".to_string() });

    call_gemini(&state, &model, "You are an expert at creating study materials.", parts).await
}

#[tauri::command]
pub fn check_vertex_config(state: tauri::State<'_, VertexState>) -> bool {
    state.project_id.lock().unwrap().is_some()
}
