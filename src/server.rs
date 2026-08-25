use crate::aim::AimTelemetry;
use crate::config::Settings;
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, RwLock};
use std::thread;

pub struct WebDashboardServer {
    port: u16,
    is_active: Arc<AtomicBool>,
    settings_path: String,
    settings_tx: mpsc::Sender<Settings>,
    telemetry: Arc<RwLock<AimTelemetry>>,
}

impl WebDashboardServer {
    pub fn new(
        port: u16,
        is_active: Arc<AtomicBool>,
        settings_path: String,
        settings_tx: mpsc::Sender<Settings>,
        telemetry: Arc<RwLock<AimTelemetry>>,
    ) -> Self {
        Self {
            port,
            is_active,
            settings_path,
            settings_tx,
            telemetry,
        }
    }

    pub fn start(self) {
        let port = self.port;
        let is_active = self.is_active.clone();
        let settings_path = self.settings_path.clone();
        let settings_tx = self.settings_tx.clone();
        let telemetry = self.telemetry.clone();

        thread::spawn(move || {
            let addr = format!("127.0.0.1:{}", port);
            let listener = match TcpListener::bind(&addr) {
                Ok(l) => {
                    info!("🚀 Gamer UI Dashboard running at: http://{}", addr);
                    l
                }
                Err(e) => {
                    warn!("Could not bind Web Dashboard on {}: {}", addr, e);
                    return;
                }
            };

            // Launch as a dedicated standalone Native Desktop App Window
            #[cfg(windows)]
            {
                let url = format!("http://{}", addr);
                let app_arg = format!("--app={}", url);
                let size_arg = "--window-size=1240,840";

                let known_executables = [
                    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                    "msedge",
                    "chrome",
                ];

                let mut launched = false;
                for exe in &known_executables {
                    if exe.contains('\\') && !Path::new(exe).exists() {
                        continue;
                    }
                    if std::process::Command::new(exe)
                        .args([&app_arg, size_arg])
                        .spawn()
                        .is_ok()
                    {
                        launched = true;
                        break;
                    }
                }

                if !launched {
                    let _ = std::process::Command::new("cmd")
                        .args(["/C", "start", &url])
                        .spawn();
                }
            }

            for stream in listener.incoming() {
                match stream {
                    Ok(stream) => {
                        let is_active = is_active.clone();
                        let settings_path = settings_path.clone();
                        let settings_tx = settings_tx.clone();
                        let telemetry = telemetry.clone();
                        thread::spawn(move || {
                            handle_client(stream, is_active, settings_path, settings_tx, telemetry);
                        });
                    }
                    Err(e) => {
                        debug!("Connection failed: {}", e);
                    }
                }
            }
        });
    }
}

fn handle_client(
    mut stream: TcpStream,
    is_active: Arc<AtomicBool>,
    settings_path: String,
    settings_tx: mpsc::Sender<Settings>,
    telemetry: Arc<RwLock<AimTelemetry>>,
) {
    let mut buffer = [0u8; 8192];
    let bytes_read = match stream.read(&mut buffer) {
        Ok(n) if n > 0 => n,
        _ => return,
    };

    let request_str = String::from_utf8_lossy(&buffer[..bytes_read]);
    let mut lines = request_str.lines();
    let first_line = match lines.next() {
        Some(l) => l,
        None => return,
    };

    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 2 {
        return;
    }

    let method = parts[0];
    let path = parts[1];

    if path.starts_with("/api/aim/telemetry") {
        let json = telemetry
            .read()
            .map(|value| value.to_json())
            .unwrap_or_else(|_| "{}".to_string());
        send_response(&mut stream, "application/json", json.as_bytes());
    } else if path.starts_with("/api/status") {
        let active = is_active.load(Ordering::SeqCst);
        let json = format!(
            r#"{{"active": {}, "vigem": true, "interception": true, "version": "0.2.0"}}"#,
            active
        );
        send_response(&mut stream, "application/json", json.as_bytes());
    } else if path.starts_with("/api/settings") && method == "GET" {
        let content = fs::read_to_string(&settings_path).unwrap_or_else(|_| "".to_string());
        send_response(&mut stream, "text/plain; charset=utf-8", content.as_bytes());
    } else if path.starts_with("/api/settings") && method == "POST" {
        if let Some(body_start) = request_str.find("\r\n\r\n") {
            let body = &request_str[body_start + 4..];
            if !body.trim().is_empty() {
                let parsed = ron::de::from_str::<Settings>(body);
                if let Err(e) = &parsed {
                    warn!("Rejected invalid settings update: {}", e);
                    send_bad_request(&mut stream, "Invalid Settings.ron");
                    return;
                }
                if let Err(e) = fs::write(&settings_path, body) {
                    error!("Failed to write settings file: {}", e);
                } else {
                    info!("Successfully updated settings on disk ({})", settings_path);
                    let _ = settings_tx.send(parsed.expect("settings were validated"));
                }
            }
        }
        send_response(&mut stream, "application/json", b"{\"status\": \"ok\"}");
    } else if path.starts_with("/api/toggle") && method == "POST" {
        let current = is_active.load(Ordering::SeqCst);
        is_active.store(!current, Ordering::SeqCst);
        let new_state = !current;
        let json = format!(r#"{{"active": {}}}"#, new_state);
        send_response(&mut stream, "application/json", json.as_bytes());
    } else {
        // Serve static assets from ui/dist or ui
        serve_static_file(&mut stream, path);
    }
}

fn serve_static_file(stream: &mut TcpStream, raw_path: &str) {
    let clean_path = if raw_path == "/" || raw_path.is_empty() {
        "index.html"
    } else {
        raw_path.trim_start_matches('/')
    };

    let dist_file = Path::new("ui/dist").join(clean_path);
    let raw_ui_file = Path::new("ui").join(clean_path);

    let (content_type, file_path) = if dist_file.exists() {
        (get_mime_type(clean_path), dist_file)
    } else if raw_ui_file.exists() {
        (get_mime_type(clean_path), raw_ui_file)
    } else {
        let index_dist = Path::new("ui/dist/index.html");
        let index_raw = Path::new("ui/index.html");
        if index_dist.exists() {
            ("text/html; charset=utf-8", index_dist.to_path_buf())
        } else if index_raw.exists() {
            ("text/html; charset=utf-8", index_raw.to_path_buf())
        } else {
            send_404(stream);
            return;
        }
    };

    match fs::read(file_path) {
        Ok(data) => {
            send_response(stream, content_type, &data);
        }
        Err(_) => {
            send_404(stream);
        }
    }
}

fn get_mime_type(path: &str) -> &'static str {
    if path.ends_with(".html") {
        "text/html; charset=utf-8"
    } else if path.ends_with(".css") {
        "text/css; charset=utf-8"
    } else if path.ends_with(".js") {
        "application/javascript; charset=utf-8"
    } else if path.ends_with(".json") {
        "application/json"
    } else if path.ends_with(".svg") {
        "image/svg+xml"
    } else if path.ends_with(".png") {
        "image/png"
    } else if path.ends_with(".ico") {
        "image/x-icon"
    } else {
        "application/octet-stream"
    }
}

fn send_response(stream: &mut TcpStream, content_type: &str, body: &[u8]) {
    let header = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n",
        content_type,
        body.len()
    );
    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(body);
    let _ = stream.flush();
}

fn send_404(stream: &mut TcpStream) {
    let body = b"404 Not Found";
    let header = format!(
        "HTTP/1.1 404 NOT FOUND\r\nContent-Type: text/plain\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(body);
    let _ = stream.flush();
}

fn send_bad_request(stream: &mut TcpStream, message: &str) {
    let header = format!(
        "HTTP/1.1 400 BAD REQUEST\r\nContent-Type: text/plain\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        message.len()
    );
    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(message.as_bytes());
    let _ = stream.flush();
}
