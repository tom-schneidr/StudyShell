use base64::{engine::general_purpose, Engine as _};
use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::path::Path;
use std::sync::Mutex;
use tauri::Emitter;

const DEFAULT_BASE_URL: &str = "http://127.0.0.1:8000/v1";

pub struct AiClientState {
    pub base_url: Mutex<String>,
    pub client: Client,
}

impl AiClientState {
    pub fn new() -> Self {
        let base_url =
            std::env::var("FREEROUTER_BASE_URL").unwrap_or_else(|_| DEFAULT_BASE_URL.to_string());
        Self {
            base_url: Mutex::new(normalize_base_url(&base_url)),
            client: Client::new(),
        }
    }
}

fn normalize_base_url(url: &str) -> String {
    url.trim().trim_end_matches('/').to_string()
}

fn resolve_model(model: &str) -> &str {
    if model.trim().is_empty() || model == "auto" {
        "auto"
    } else {
        // Legacy Gemini model ids from older StudyShell builds map to FreeRouter auto-routing.
        "auto"
    }
}

fn chat_completions_url(base_url: &str, use_search: bool) -> String {
    if use_search {
        format!("{base_url}/chat/completions/web-search")
    } else {
        format!("{base_url}/chat/completions")
    }
}

fn build_chat_payload(
    system_prompt: &str,
    user_content: serde_json::Value,
    model: &str,
    stream: bool,
) -> serde_json::Value {
    json!({
        "model": resolve_model(model),
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_content },
        ],
        "temperature": 0.4,
        "max_tokens": 8192,
        "stream": stream,
    })
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Option<Vec<ChatChoice>>,
    error: Option<ApiErrorBody>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: Option<ChatMessage>,
}

#[derive(Debug, Deserialize)]
struct ChatMessage {
    content: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct ApiErrorBody {
    message: Option<String>,
    code: Option<String>,
}

#[derive(Debug, Deserialize)]
struct StreamChunk {
    choices: Option<Vec<StreamChoice>>,
    error: Option<ApiErrorBody>,
}

#[derive(Debug, Deserialize)]
struct StreamChoice {
    delta: Option<StreamDelta>,
}

#[derive(Debug, Deserialize)]
struct StreamDelta {
    content: Option<String>,
}

fn content_to_string(content: &serde_json::Value) -> String {
    match content {
        serde_json::Value::String(text) => text.clone(),
        serde_json::Value::Array(parts) => parts
            .iter()
            .filter_map(|part| {
                part.get("text")
                    .or_else(|| part.get("content"))
                    .and_then(|value| value.as_str())
                    .map(str::to_string)
            })
            .collect::<Vec<_>>()
            .join("\n"),
        _ => String::new(),
    }
}

fn extract_assistant_text(resp: &ChatCompletionResponse) -> Option<String> {
    let content = resp
        .choices
        .as_ref()?
        .first()?
        .message
        .as_ref()?
        .content
        .as_ref()?;
    let text = content_to_string(content);
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

fn extract_stream_delta(chunk: &StreamChunk) -> Option<String> {
    let content = chunk
        .choices
        .as_ref()?
        .first()?
        .delta
        .as_ref()?
        .content
        .as_deref()?;
    if content.is_empty() {
        None
    } else {
        Some(content.to_string())
    }
}

fn api_error_message(error: &ApiErrorBody, raw: &str) -> String {
    if let Some(message) = error.message.as_deref() {
        if let Some(code) = error.code.as_deref() {
            return format!("{code}: {message}");
        }
        return message.to_string();
    }
    raw.to_string()
}

/// Parse OpenAI-style SSE (`data: {...}`) lines from a streaming chat completion.
pub fn extract_openai_stream_deltas(buffer: &str) -> Vec<String> {
    let mut deltas = Vec::new();

    for line in buffer.lines() {
        let line = line.trim();
        if !line.starts_with("data:") {
            continue;
        }
        let payload = line.strip_prefix("data:").unwrap_or("").trim();
        if payload.is_empty() || payload == "[DONE]" {
            continue;
        }
        if let Ok(chunk) = serde_json::from_str::<StreamChunk>(payload) {
            if let Some(error) = chunk.error.as_ref() {
                deltas.push(api_error_message(error, payload));
                continue;
            }
            if let Some(delta) = extract_stream_delta(&chunk) {
                deltas.push(delta);
            }
        }
    }

    deltas
}

async fn call_chat_completion(
    state: &AiClientState,
    model: &str,
    system_prompt: &str,
    user_content: serde_json::Value,
    use_search: bool,
) -> Result<String, String> {
    let base_url = state.base_url.lock().unwrap().clone();
    let url = chat_completions_url(&base_url, use_search);
    let body = build_chat_payload(system_prompt, user_content, model, false);

    let resp = state
        .client
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("FreeRouter request failed: {e}"))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        if let Ok(err) = serde_json::from_str::<serde_json::Value>(&text) {
            if let Some(error) = err.get("error") {
                if let Ok(parsed) = serde_json::from_value::<ApiErrorBody>(error.clone()) {
                    return Err(api_error_message(&parsed, &text));
                }
            }
            if let Some(detail) = err.get("detail").and_then(|value| value.as_str()) {
                return Err(detail.to_string());
            }
        }
        return Err(format!("FreeRouter returned HTTP {status}: {text}"));
    }

    let completion: ChatCompletionResponse =
        serde_json::from_str(&text).map_err(|e| format!("Parse error: {e}. Raw: {text}"))?;

    if let Some(error) = completion.error.as_ref() {
        return Err(api_error_message(error, &text));
    }

    extract_assistant_text(&completion).ok_or_else(|| "No response from AI".to_string())
}

fn build_file_user_content(paths: &[String], closing_prompt: &str) -> serde_json::Value {
    let mut parts: Vec<serde_json::Value> = Vec::new();

    for path_str in paths {
        let path = Path::new(path_str);
        if let Ok(data) = std::fs::read(path) {
            let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if extension.eq_ignore_ascii_case("pdf") {
                let encoded = general_purpose::STANDARD.encode(data);
                parts.push(json!({
                    "type": "text",
                    "text": format!("File: {path_str}\n---\n[PDF attachment]\n---\n"),
                }));
                parts.push(json!({
                    "type": "image_url",
                    "image_url": {
                        "url": format!("data:application/pdf;base64,{encoded}")
                    }
                }));
            } else if let Ok(text) = String::from_utf8(data) {
                parts.push(json!({
                    "type": "text",
                    "text": format!("File: {path_str}\n---\n{text}\n---\n"),
                }));
            }
        }
    }

    parts.push(json!({ "type": "text", "text": closing_prompt }));

    if parts.len() == 1 {
        closing_prompt.into()
    } else {
        serde_json::Value::Array(parts)
    }
}

#[tauri::command]
pub async fn chat_with_ai(
    state: tauri::State<'_, AiClientState>,
    message: String,
    context: Option<String>,
    model: String,
    use_search: bool,
    system_prompt: String,
) -> Result<String, String> {
    let mut user_text = String::new();
    if let Some(ctx) = context {
        user_text.push_str(&format!(
            "Context (Reference Material):\n---\n{ctx}\n---\n\n"
        ));
    }
    user_text.push_str(&message);

    call_chat_completion(
        &state,
        &model,
        &system_prompt,
        serde_json::Value::String(user_text),
        use_search,
    )
    .await
}

#[derive(Clone, serde::Serialize)]
struct StreamPayload {
    chunk: String,
    done: bool,
    error: Option<String>,
}

#[tauri::command]
pub async fn stream_chat_with_ai(
    app: tauri::AppHandle,
    state: tauri::State<'_, AiClientState>,
    message: String,
    context: Option<String>,
    model: String,
    use_search: bool,
    system_prompt: String,
) -> Result<(), String> {
    let mut user_text = String::new();
    if let Some(ctx) = context {
        user_text.push_str(&format!(
            "Context (Reference Material):\n---\n{ctx}\n---\n\n"
        ));
    }
    user_text.push_str(&message);

    let base_url = state.base_url.lock().unwrap().clone();
    let url = chat_completions_url(&base_url, use_search);
    let body = build_chat_payload(
        &system_prompt,
        serde_json::Value::String(user_text),
        &model,
        true,
    );

    let response = state
        .client
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("FreeRouter request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("FreeRouter returned HTTP {status}: {text}"));
    }

    let mut buffer = String::new();
    let mut stream = response.bytes_stream();
    let mut emitted_length = 0usize;

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        if let Ok(text) = String::from_utf8(chunk.to_vec()) {
            buffer.push_str(&text);
            let deltas = extract_openai_stream_deltas(&buffer);
            for delta in deltas.iter().skip(emitted_length) {
                if delta.contains("waterfall_exhausted") {
                    app.emit(
                        "ai-stream-chunk",
                        StreamPayload {
                            chunk: String::new(),
                            done: true,
                            error: Some(delta.clone()),
                        },
                    )
                    .map_err(|e| e.to_string())?;
                    return Ok(());
                }
                app.emit(
                    "ai-stream-chunk",
                    StreamPayload {
                        chunk: delta.clone(),
                        done: false,
                        error: None,
                    },
                )
                .map_err(|e| e.to_string())?;
            }
            emitted_length = deltas.len();
        }
    }

    app.emit(
        "ai-stream-chunk",
        StreamPayload {
            chunk: String::new(),
            done: true,
            error: None,
        },
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn summarize_files(
    state: tauri::State<'_, AiClientState>,
    paths: Vec<String>,
    model: String,
    use_search: bool,
) -> Result<String, String> {
    let user_content = build_file_user_content(
        &paths,
        "Provide a structured academic summary of the attached materials.",
    );

    call_chat_completion(
        &state,
        &model,
        "You are an expert academic summarizer.",
        user_content,
        use_search,
    )
    .await
}

#[tauri::command]
pub async fn generate_study_guide(
    state: tauri::State<'_, AiClientState>,
    paths: Vec<String>,
    model: String,
    use_search: bool,
) -> Result<String, String> {
    let user_content = build_file_user_content(
        &paths,
        "Create a detailed study guide from these materials.",
    );

    call_chat_completion(
        &state,
        &model,
        "You are an expert at creating study materials.",
        user_content,
        use_search,
    )
    .await
}

#[derive(Clone, Serialize)]
pub struct AiStatus {
    pub base_url: String,
    pub reachable: bool,
    pub model: &'static str,
}

async fn probe_freerouter(state: &AiClientState) -> AiStatus {
    let base_url = state.base_url.lock().unwrap().clone();
    let url = format!("{base_url}/models");
    let reachable = match state.client.get(url).send().await {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    };
    AiStatus {
        base_url,
        reachable,
        model: "auto",
    }
}

#[tauri::command]
pub async fn get_ai_status(state: tauri::State<'_, AiClientState>) -> Result<AiStatus, String> {
    Ok(probe_freerouter(&state).await)
}

#[tauri::command]
pub async fn check_ai_config(state: tauri::State<'_, AiClientState>) -> Result<bool, String> {
    Ok(probe_freerouter(&state).await.reachable)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_base_url_trims_trailing_slash() {
        assert_eq!(
            normalize_base_url("http://127.0.0.1:8000/v1/"),
            "http://127.0.0.1:8000/v1"
        );
    }

    #[test]
    fn resolve_model_maps_legacy_gemini_ids_to_auto() {
        assert_eq!(resolve_model("gemini-2.5-flash"), "auto");
        assert_eq!(resolve_model("auto"), "auto");
    }

    #[test]
    fn extract_openai_stream_deltas_reads_content_chunks() {
        let chunk = json!({
            "choices": [{ "delta": { "content": "Hello" } }]
        });
        let buffer = format!("data: {}\n\ndata: [DONE]\n\n", chunk);
        assert_eq!(extract_openai_stream_deltas(&buffer), vec!["Hello"]);
    }

    #[test]
    fn extract_openai_stream_deltas_accumulates_multiple_events() {
        let first = json!({ "choices": [{ "delta": { "content": "Hel" } }] });
        let second = json!({ "choices": [{ "delta": { "content": "lo" } }] });
        let buffer = format!("data: {}\n\ndata: {}\n\n", first, second);
        assert_eq!(extract_openai_stream_deltas(&buffer), vec!["Hel", "lo"]);
    }

    #[test]
    fn extract_assistant_text_handles_string_content() {
        let resp = ChatCompletionResponse {
            choices: Some(vec![ChatChoice {
                message: Some(ChatMessage {
                    content: Some(json!("Complete answer")),
                }),
            }]),
            error: None,
        };
        assert_eq!(
            extract_assistant_text(&resp).as_deref(),
            Some("Complete answer")
        );
    }
}
