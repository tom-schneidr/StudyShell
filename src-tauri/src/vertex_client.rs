use base64::{engine::general_purpose, Engine as _};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;
use tauri::Emitter;
use futures_util::StreamExt;

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
    Text {
        text: String,
    },
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

// ── Private helpers ──────────────────────────────────────────────────────────

/// Build the Vertex AI endpoint URL for a given location and model.
fn build_endpoint_url(location: &str, project_id: &str, model: &str, streaming: bool) -> String {
    let method = if streaming {
        "streamGenerateContent"
    } else {
        "generateContent"
    };

    if location == "global" {
        format!(
            "https://aiplatform.googleapis.com/v1/projects/{}/locations/{}/publishers/google/models/{}:{}",
            project_id, location, model, method
        )
    } else {
        format!(
            "https://{}-aiplatform.googleapis.com/v1/projects/{}/locations/{}/publishers/google/models/{}:{}",
            location, project_id, location, model, method
        )
    }
}

/// Build the JSON request body shared by both chat commands.
fn build_request_body(
    parts: &[RequestPart],
    system_prompt: &str,
    use_search: bool,
) -> serde_json::Value {
    let mut body = serde_json::json!({
        "contents": [{ "role": "user", "parts": parts }],
        "systemInstruction": { "parts": [{"text": system_prompt}] },
        "generationConfig": { "temperature": 0.4, "maxOutputTokens": 8192 }
    });

    if use_search {
        body["tools"] = serde_json::json!([{ "google_search": {} }]);
    }

    body
}

/// Extract the text content from a parsed `VertexResponse` candidate.
fn extract_text_from_response(resp: &VertexResponse) -> Option<&str> {
    resp.candidates
        .as_ref()?
        .first()?
        .content
        .as_ref()?
        .parts
        .as_ref()?
        .first()?
        .text
        .as_deref()
}

/// Split a raw streaming buffer into candidate JSON object slices.
///
/// Google's `streamGenerateContent` endpoint returns a JSON array:
///
/// ```text
/// [
/// {"candidates":[...]}
/// ,
/// {"candidates":[...]}
/// ]
/// ```
///
/// Records are separated by a line whose first non-whitespace character is `,`
/// followed by either another `{`, `[`, or end-of-content.  We split on those
/// boundaries so each slice contains exactly one JSON object.
fn split_stream_records(buffer: &str) -> Vec<&str> {
    let mut records: Vec<&str> = Vec::new();
    let mut start = 0;

    for (i, ch) in buffer.char_indices() {
        if ch == '\n' || ch == '\r' {
            let rest = &buffer[i..];
            let after_newline = rest.trim_start_matches(['\n', '\r', ' ']);
            if after_newline.starts_with(',') {
                let after_comma = after_newline[1..].trim_start();
                if after_comma.starts_with('{')
                    || after_comma.starts_with('[')
                    || after_comma.is_empty()
                {
                    let segment = &buffer[start..i];
                    if !segment.trim().is_empty() {
                        records.push(segment);
                    }
                    start = i + (rest.len() - after_comma.len());
                }
            }
        }
    }

    let remainder = &buffer[start..];
    if !remainder.trim().is_empty() {
        records.push(remainder);
    }

    records
}

/// Extract all parseable text chunks from an accumulated streaming buffer.
///
/// Strips the outer `[` / `]` array brackets, splits into record segments, and
/// attempts to deserialise each as a `VertexResponse`.  Incomplete records
/// (e.g. a buffer ending mid-object) are silently skipped — they will be
/// retried once more data has been appended.
pub fn extract_stream_chunks(buffer: &str) -> Vec<String> {
    let trimmed = buffer.trim().trim_start_matches('[').trim_end_matches(']');
    let mut chunks = Vec::new();

    for record in split_stream_records(trimmed) {
        let candidate = record.trim().trim_start_matches(',').trim();
        if candidate.is_empty() {
            continue;
        }
        if let Ok(resp) = serde_json::from_str::<VertexResponse>(candidate) {
            if let Some(text) = extract_text_from_response(&resp) {
                if !text.is_empty() {
                    chunks.push(text.to_string());
                }
            }
        }
    }

    chunks
}

// ── Shared auth helper ───────────────────────────────────────────────────────

async fn acquire_bearer_token() -> Result<String, String> {
    let provider = gcp_auth::provider()
        .await
        .map_err(|e| format!("Auth error: {}. Use 'gcloud auth application-default login'.", e))?;
    provider
        .token(&["https://www.googleapis.com/auth/cloud-platform"])
        .await
        .map_err(|e| format!("Token error: {}", e))
        .map(|t| t.as_str().to_string())
}

// ── Core Gemini call (non-streaming) ─────────────────────────────────────────

async fn call_gemini(
    state: &VertexState,
    model: &str,
    system_prompt: &str,
    parts: Vec<RequestPart>,
    use_search: bool,
) -> Result<String, String> {
    let project_id = state
        .project_id
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| "PROJECT_ID not configured.".to_string())?;
    let location = state.location.lock().unwrap().clone();

    let token = acquire_bearer_token().await?;
    let url = build_endpoint_url(&location, &project_id, model, false);
    let body = build_request_body(&parts, system_prompt, use_search);

    let resp = state
        .client
        .post(url)
        .header("Authorization", format!("Bearer {}", token))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = resp.text().await.map_err(|e| e.to_string())?;
    let vertex_resp: VertexResponse =
        serde_json::from_str(&text).map_err(|e| format!("Parse error: {}. Raw: {}", e, text))?;

    if let Some(err) = vertex_resp.error {
        return Err(err.message);
    }

    extract_text_from_response(&vertex_resp)
        .map(|t| t.to_string())
        .ok_or_else(|| "No response from AI".to_string())
}

// ── Tauri commands ───────────────────────────────────────────────────────────

/// Non-streaming chat.  `system_prompt` is passed from the frontend Settings.
#[tauri::command]
pub async fn chat_with_ai(
    state: tauri::State<'_, VertexState>,
    message: String,
    context: Option<String>,
    model: String,
    use_search: bool,
    system_prompt: String,
) -> Result<String, String> {
    let mut parts = Vec::new();
    if let Some(ctx) = context {
        parts.push(RequestPart::Text {
            text: format!("Context (Reference Material):\n---\n{}\n---\n", ctx),
        });
    }
    parts.push(RequestPart::Text { text: message });

    call_gemini(&*state, &model, &system_prompt, parts, use_search).await
}

#[derive(Clone, Serialize)]
struct StreamPayload {
    chunk: String,
    done: bool,
    error: Option<String>,
}

/// Streaming chat.  Accumulates the full JSON array body before extracting
/// chunks, because TCP frames are not aligned to JSON object boundaries.
/// Emits `"ai-stream-chunk"` events incrementally as each record completes.
#[tauri::command]
pub async fn stream_chat_with_ai(
    app: tauri::AppHandle,
    state: tauri::State<'_, VertexState>,
    message: String,
    context: Option<String>,
    model: String,
    use_search: bool,
    system_prompt: String,
) -> Result<(), String> {
    let mut parts = Vec::new();
    if let Some(ctx) = context {
        parts.push(RequestPart::Text {
            text: format!("Context (Reference Material):\n---\n{}\n---\n", ctx),
        });
    }
    parts.push(RequestPart::Text { text: message });

    let project_id = state
        .project_id
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| "PROJECT_ID not configured.".to_string())?;
    let location = state.location.lock().unwrap().clone();

    let token = acquire_bearer_token().await?;
    let url = build_endpoint_url(&location, &project_id, &model, true);
    let body = build_request_body(&parts, &system_prompt, use_search);

    let response = state
        .client
        .post(url)
        .header("Authorization", format!("Bearer {}", token))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    // Accumulate raw bytes into a buffer.  The Vertex AI streaming endpoint
    // returns a JSON array delivered across multiple HTTP/2 DATA frames that
    // are NOT aligned to JSON object boundaries.  We buffer everything and use
    // `extract_stream_chunks` to pull out complete records incrementally.
    let mut buffer = String::new();
    let mut stream = response.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        if let Ok(text) = String::from_utf8(chunk.to_vec()) {
            buffer.push_str(&text);

            for text_chunk in extract_stream_chunks(&buffer) {
                app.emit("ai-stream-chunk", StreamPayload {
                    chunk: text_chunk,
                    done: false,
                    error: None,
                })
                .map_err(|e| e.to_string())?;
            }
        }
    }

    app.emit("ai-stream-chunk", StreamPayload {
        chunk: String::new(),
        done: true,
        error: None,
    })
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn summarize_files(
    state: tauri::State<'_, VertexState>,
    paths: Vec<String>,
    model: String,
    use_search: bool,
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
                    },
                });
            } else if let Ok(text) = String::from_utf8(data) {
                parts.push(RequestPart::Text {
                    text: format!("File: {}\n---\n{}\n---\n", path_str, text),
                });
            }
        }
    }

    parts.push(RequestPart::Text {
        text: "Provide a structured academic summary of the attached materials.".to_string(),
    });

    call_gemini(
        &*state,
        &model,
        "You are an expert academic summarizer.",
        parts,
        use_search,
    )
    .await
}

#[tauri::command]
pub async fn generate_study_guide(
    state: tauri::State<'_, VertexState>,
    paths: Vec<String>,
    model: String,
    use_search: bool,
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
                    },
                });
            } else if let Ok(text) = String::from_utf8(data) {
                parts.push(RequestPart::Text {
                    text: format!("Content: {}\n---\n{}\n---\n", path_str, text),
                });
            }
        }
    }

    parts.push(RequestPart::Text {
        text: "Create a detailed study guide from these materials.".to_string(),
    });

    call_gemini(
        &*state,
        &model,
        "You are an expert at creating study materials.",
        parts,
        use_search,
    )
    .await
}

#[tauri::command]
pub fn check_vertex_config(state: tauri::State<'_, VertexState>) -> bool {
    state.project_id.lock().unwrap().is_some()
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn make_stream_record(text: &str) -> String {
        serde_json::json!({
            "candidates": [{
                "content": {
                    "parts": [{ "text": text }]
                }
            }]
        })
        .to_string()
    }

    #[test]
    fn build_endpoint_url_global_non_streaming() {
        let url = build_endpoint_url("global", "my-project", "gemini-2.5-flash", false);
        assert!(url.contains("aiplatform.googleapis.com"));
        assert!(url.contains("generateContent"));
        assert!(!url.contains("streamGenerateContent"));
        assert!(url.contains("my-project"));
        assert!(url.contains("gemini-2.5-flash"));
    }

    #[test]
    fn build_endpoint_url_regional_streaming() {
        let url = build_endpoint_url("us-central1", "proj", "gemini-2.5-pro", true);
        assert!(url.starts_with("https://us-central1-aiplatform"));
        assert!(url.contains("streamGenerateContent"));
    }

    #[test]
    fn extract_stream_chunks_single_record() {
        let buffer = format!("[\n{}\n]", make_stream_record("Hello"));
        let chunks = extract_stream_chunks(&buffer);
        assert_eq!(chunks, vec!["Hello"]);
    }

    #[test]
    fn extract_stream_chunks_two_records() {
        let r1 = make_stream_record("Hello");
        let r2 = make_stream_record(" world");
        let buffer = format!("[\n{}\n,\n{}\n]", r1, r2);
        let chunks = extract_stream_chunks(&buffer);
        assert_eq!(chunks, vec!["Hello", " world"]);
    }

    #[test]
    fn extract_stream_chunks_ignores_empty_text() {
        let buffer = format!("[\n{}\n]", make_stream_record(""));
        let chunks = extract_stream_chunks(&buffer);
        assert!(chunks.is_empty());
    }

    #[test]
    fn extract_stream_chunks_partial_buffer_returns_what_it_can() {
        // A buffer that ends mid-record should not panic and should return
        // whatever complete records exist before the truncation.
        let r1 = make_stream_record("First chunk");
        let partial = format!("[\n{}\n,\n{{\"candidates\":[{{\"content", r1);
        let chunks = extract_stream_chunks(&partial);
        assert!(chunks.contains(&"First chunk".to_string()));
    }

    #[test]
    fn extract_stream_chunks_handles_no_outer_brackets() {
        // Some chunk windows may not include the leading `[`.
        let record = make_stream_record("Standalone");
        let chunks = extract_stream_chunks(&record);
        assert_eq!(chunks, vec!["Standalone"]);
    }

    #[test]
    fn extract_text_from_response_returns_none_for_empty_candidates() {
        let resp = VertexResponse {
            candidates: Some(vec![]),
            error: None,
        };
        assert!(extract_text_from_response(&resp).is_none());
    }

    #[test]
    fn extract_text_from_response_surfaces_error_correctly() {
        // A response with an error field and no candidates should have no text.
        let resp = VertexResponse {
            candidates: None,
            error: Some(VertexError {
                message: "Quota exceeded".to_string(),
            }),
        };
        assert!(extract_text_from_response(&resp).is_none());
    }
}
