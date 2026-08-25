use crate::types::*;
use interception as ic;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use std::time::Duration;

fn default_toggle_key() -> ic::ScanCode {
    ic::ScanCode::Grave
}

fn default_excluded_keys() -> Vec<ic::ScanCode> {
    vec![
        ic::ScanCode::X,
        ic::ScanCode::J,
        ic::ScanCode::L,
        ic::ScanCode::Z,
        ic::ScanCode::LeftAlt,
        ic::ScanCode::LeftShift,
        ic::ScanCode::Tab,
    ]
}

fn default_sensitivity() -> f64 {
    1.0
}

fn default_alt_sensitivity() -> f64 {
    3.0
}

fn default_ads_multiplier() -> f64 {
    0.75
}

fn default_yaw_multiplier() -> f64 {
    1.0
}

fn default_pitch_multiplier() -> f64 {
    1.0
}

fn default_anti_deadzone() -> f64 {
    0.10 // 10% anti-deadzone to overcome gamepad deadzones in FPS games
}

fn default_curve_exponent() -> f64 {
    1.0 // 1.0 = linear, 1.2-1.6 = gentle exponential curve
}

fn default_smoothing_level() -> u8 {
    5
}

fn default_tick_rate_hz() -> u32 {
    250 // 250Hz provides 4ms update cycle, ultra smooth and negligible CPU usage
}

fn default_key_w() -> ic::ScanCode {
    ic::ScanCode::W
}

fn default_key_s() -> ic::ScanCode {
    ic::ScanCode::S
}

fn default_key_a() -> ic::ScanCode {
    ic::ScanCode::A
}

fn default_key_d() -> ic::ScanCode {
    ic::ScanCode::D
}

fn default_alt_sensitivity_key() -> Option<ic::ScanCode> {
    Some(ic::ScanCode::X)
}

fn default_ads_button() -> Option<MouseButton> {
    Some(MouseButton::Right)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DispatcherSettings {
    #[serde(default = "default_toggle_key", alias = "Toggle_Key")]
    pub toggle_key: ic::ScanCode,

    #[serde(default = "default_excluded_keys", alias = "Excluded_Keys")]
    pub excluded_keys: Vec<ic::ScanCode>,
}

impl Default for DispatcherSettings {
    fn default() -> Self {
        Self {
            toggle_key: default_toggle_key(),
            excluded_keys: default_excluded_keys(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AimingSettings {
    #[serde(default = "default_sensitivity", alias = "Sensitivity")]
    pub sensitivity: f64,

    #[serde(default = "default_alt_sensitivity", alias = "Parachute_Sensitivity")]
    pub alt_sensitivity: f64,

    #[serde(default = "default_ads_multiplier")]
    pub ads_multiplier: f64,

    #[serde(default = "default_yaw_multiplier")]
    pub yaw_multiplier: f64,

    #[serde(default = "default_pitch_multiplier")]
    pub pitch_multiplier: f64,

    #[serde(default)]
    pub invert_pitch: bool,

    #[serde(default = "default_anti_deadzone")]
    pub anti_deadzone: f64,

    #[serde(default = "default_curve_exponent")]
    pub curve_exponent: f64,

    #[serde(default = "default_smoothing_level", alias = "Mouse_Smoothing_Level")]
    pub mouse_smoothing_level: u8,

    #[serde(default, skip_serializing)]
    pub binds: HashMap<Bind, ControllerAction>,
}

impl Default for AimingSettings {
    fn default() -> Self {
        Self {
            sensitivity: default_sensitivity(),
            alt_sensitivity: default_alt_sensitivity(),
            ads_multiplier: default_ads_multiplier(),
            yaw_multiplier: default_yaw_multiplier(),
            pitch_multiplier: default_pitch_multiplier(),
            invert_pitch: false,
            anti_deadzone: default_anti_deadzone(),
            curve_exponent: default_curve_exponent(),
            mouse_smoothing_level: default_smoothing_level(),
            binds: HashMap::new(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MovementSettings {
    #[serde(default = "default_key_w")]
    pub forward: ic::ScanCode,
    #[serde(default = "default_key_s")]
    pub backward: ic::ScanCode,
    #[serde(default = "default_key_a")]
    pub left: ic::ScanCode,
    #[serde(default = "default_key_d")]
    pub right: ic::ScanCode,
}

impl Default for MovementSettings {
    fn default() -> Self {
        Self {
            forward: default_key_w(),
            backward: default_key_s(),
            left: default_key_a(),
            right: default_key_d(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ControlsSettings {
    #[serde(default = "default_alt_sensitivity_key", alias = "Alt_Sensitivity_Key")]
    pub alt_sensitivity_key: Option<ic::ScanCode>,

    #[serde(default = "default_ads_button")]
    pub ads_button: Option<MouseButton>,

    #[serde(default)]
    pub movement: MovementSettings,
}

impl Default for ControlsSettings {
    fn default() -> Self {
        Self {
            alt_sensitivity_key: default_alt_sensitivity_key(),
            ads_button: default_ads_button(),
            movement: MovementSettings::default(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Settings {
    #[serde(default, alias = "event_dispatcher")]
    pub dispatcher: DispatcherSettings,

    #[serde(default, alias = "event_handler")]
    pub aiming: AimingSettings,

    #[serde(default)]
    pub controls: ControlsSettings,

    #[serde(default = "default_tick_rate_hz")]
    pub tick_rate_hz: u32,

    #[serde(default)]
    pub binds: HashMap<Bind, ControllerAction>,
}

impl Default for Settings {
    fn default() -> Self {
        let mut default_binds = HashMap::new();
        // Useful standard default bindings
        default_binds.insert(
            Bind::Keyboard(ic::ScanCode::Space),
            ControllerAction::Button(ControllerButton::A),
        );
        default_binds.insert(
            Bind::Keyboard(ic::ScanCode::C),
            ControllerAction::Button(ControllerButton::B),
        );
        default_binds.insert(
            Bind::Keyboard(ic::ScanCode::R),
            ControllerAction::Button(ControllerButton::X),
        );
        default_binds.insert(
            Bind::Keyboard(ic::ScanCode::E),
            ControllerAction::Button(ControllerButton::Y),
        );
        default_binds.insert(
            Bind::Keyboard(ic::ScanCode::LeftShift),
            ControllerAction::Button(ControllerButton::LeftThumb),
        );
        default_binds.insert(
            Bind::Keyboard(ic::ScanCode::V),
            ControllerAction::Button(ControllerButton::RightThumb),
        );
        default_binds.insert(
            Bind::Keyboard(ic::ScanCode::Q),
            ControllerAction::Button(ControllerButton::LeftShoulder),
        );
        default_binds.insert(
            Bind::Keyboard(ic::ScanCode::F),
            ControllerAction::Button(ControllerButton::RightShoulder),
        );
        default_binds.insert(
            Bind::Mouse(MouseButton::Left),
            ControllerAction::Button(ControllerButton::RightTrigger),
        );
        default_binds.insert(
            Bind::Mouse(MouseButton::Right),
            ControllerAction::Button(ControllerButton::LeftTrigger),
        );

        Self {
            dispatcher: DispatcherSettings::default(),
            aiming: AimingSettings::default(),
            controls: ControlsSettings::default(),
            tick_rate_hz: default_tick_rate_hz(),
            binds: default_binds,
        }
    }
}

impl Settings {
    pub fn get_all_binds(&self) -> HashMap<Bind, ControllerAction> {
        let mut all = self.binds.clone();
        for (k, v) in &self.aiming.binds {
            all.insert(*k, *v);
        }
        all
    }

    pub fn tick_interval(&self) -> Duration {
        let hz = self.tick_rate_hz.clamp(60, 1000) as u64;
        Duration::from_micros(1_000_000 / hz)
    }

    pub fn load_or_create<P: AsRef<Path>>(path: P) -> Self {
        let path_ref = path.as_ref();
        let path_str = path_ref.to_string_lossy();

        if !path_ref.exists() {
            info!(
                "Config file not found. Creating default at \"{}\"...",
                path_str
            );
            let default_settings = Self::default();
            if let Err(e) = default_settings.save_to_file(path_ref) {
                warn!(
                    "Could not save default configuration to \"{}\": {}",
                    path_str, e
                );
            }
            return default_settings;
        }

        match File::open(path_ref).map(ron::de::from_reader) {
            Ok(Ok(settings)) => {
                info!("Loaded configuration from: \"{}\"", path_str);
                settings
            }
            Ok(Err(e)) => {
                error!("Error parsing configuration file \"{}\": {}", path_str, e);
                warn!("Using default configuration fallback.");
                Self::default()
            }
            Err(e) => {
                error!("Error reading configuration file \"{}\": {}", path_str, e);
                warn!("Using default configuration fallback.");
                Self::default()
            }
        }
    }

    pub fn save_to_file<P: AsRef<Path>>(&self, path: P) -> std::io::Result<()> {
        let ron_str = self.to_documented_ron();
        if let Some(parent) = path.as_ref().parent() {
            if !parent.as_os_str().is_empty() {
                fs::create_dir_all(parent)?;
            }
        }
        let mut file = File::create(path)?;
        file.write_all(ron_str.as_bytes())?;
        Ok(())
    }

    pub fn to_documented_ron(&self) -> String {
        let ron_pretty = ron::ser::to_string_pretty(
            self,
            ron::ser::PrettyConfig::default()
                .depth_limit(6)
                .new_line("\n".to_string())
                .indentor("    ".to_string()),
        )
        .unwrap_or_else(|_| "()".to_string());

        format!(
            "// ====================================================================\n\
             // GamepadEmulation Configuration (Xbox 360 Controller Remapper)\n\
             // ====================================================================\n\
             // - toggle_key: Key used to enable/disable emulation (Default: Grave / `)\n\
             // - anti_deadzone: Offset to overcome in-game controller deadzones (0.05 - 0.20)\n\
             // - curve_exponent: 1.0 is Linear, 1.2-1.6 gives finer micro-adjustments\n\
             // - ads_multiplier: Sensitivity multiplier when holding Right Click\n\
             // - alt_sensitivity: Sensitivity multiplier when pressing Alt Sensitivity Key (Default: X)\n\
             // ====================================================================\n\n\
             {}\n",
            ron_pretty
        )
    }
}
