#[macro_use]
extern crate log;

mod aim;
mod config;
mod gamepad;
mod input;
mod server;
mod types;

use aim::AimTelemetry;
use clap::Parser;
use colored::*;
use config::Settings;
use gamepad::GamepadHandler;
use input::EventDispatcher;
use server::WebDashboardServer;
use std::io::Write;
use std::process;
use std::sync::atomic::AtomicBool;
use std::sync::{mpsc, Arc, RwLock};
use std::thread;
use thread_priority::{set_current_thread_priority, ThreadPriority};

#[derive(Parser, Debug)]
#[clap(
    name = "GamepadEmulation",
    version = "0.2.0",
    about = "High-performance Keyboard & Mouse to Virtual Gamepad (Xbox 360) Remapper"
)]
struct Opts {
    #[clap(
        short,
        long,
        default_value = "Settings.ron",
        help = "Path to the configuration file (RON format)"
    )]
    settings: String,

    #[clap(
        short,
        long,
        help = "Generate a fresh default configuration file and exit"
    )]
    create_config: bool,

    #[clap(
        short,
        long,
        default_value = "4545",
        help = "Port for the Gamer UI Dashboard (Default: 4545)"
    )]
    port: u16,

    #[clap(long, help = "Disable automatically opening the UI in the browser")]
    no_ui: bool,
}

fn print_banner() {
    println!(
        "{}",
        "===============================================================".bright_cyan()
    );
    println!(
        "{}",
        "   🎮 GamepadEmulation v0.2.0 (Keyboard & Mouse -> Xbox 360)   "
            .bright_yellow()
            .bold()
    );
    println!(
        "{}",
        "===============================================================".bright_cyan()
    );
}

fn main() {
    env_logger::Builder::from_env(
        env_logger::Env::default().filter_or(env_logger::DEFAULT_FILTER_ENV, "info"),
    )
    .format(|buf, record| {
        let level_str = match record.level() {
            log::Level::Error => record.level().to_string().bright_red().bold(),
            log::Level::Warn => record.level().to_string().bright_yellow().bold(),
            log::Level::Info => record.level().to_string().bright_green(),
            log::Level::Debug => record.level().to_string().bright_blue(),
            log::Level::Trace => record.level().to_string().bright_purple(),
        };
        writeln!(buf, "[{}] {}", level_str, record.args())
    })
    .format_timestamp(None)
    .init();

    let opts = Opts::parse();

    print_banner();

    if opts.create_config {
        let default_settings = Settings::default();
        match default_settings.save_to_file(&opts.settings) {
            Ok(_) => {
                info!(
                    "Successfully created default configuration at '{}'",
                    opts.settings
                );
            }
            Err(e) => {
                error!(
                    "Failed to create configuration file '{}': {}",
                    opts.settings, e
                );
            }
        }
        process::exit(0);
    }

    let settings = Settings::load_or_create(&opts.settings);
    let dispatcher_settings = settings.dispatcher.clone();

    let is_emulation_active = Arc::new(AtomicBool::new(false));

    let (settings_tx, settings_rx) = mpsc::channel();
    let aim_telemetry = Arc::new(RwLock::new(AimTelemetry::default()));

    // Start Gamer UI Dashboard Server
    if !opts.no_ui {
        let server = WebDashboardServer::new(
            opts.port,
            is_emulation_active.clone(),
            opts.settings.clone(),
            settings_tx,
            aim_telemetry.clone(),
        );
        server.start();
    }

    let (tx, rx) = mpsc::channel();

    // Spawn GamepadHandler on a dedicated high-priority thread
    let gamepad_thread = thread::spawn(move || {
        let _ = set_current_thread_priority(ThreadPriority::Max);
        match GamepadHandler::new(rx, settings_rx, settings, aim_telemetry) {
            Ok(mut handler) => {
                if let Err(e) = handler.run() {
                    error!("Gamepad handler loop terminated with error: {}", e);
                }
            }
            Err(e) => {
                error!("Failed to initialize GamepadHandler: {}", e);
            }
        }
    });

    // Run EventDispatcher on the main thread
    let _ = set_current_thread_priority(ThreadPriority::Max);
    match EventDispatcher::new(tx, dispatcher_settings) {
        Some(mut dispatcher) => {
            dispatcher.run();
        }
        None => {
            error!("Could not start input interception dispatcher.");
        }
    }

    let _ = gamepad_thread.join();
}
