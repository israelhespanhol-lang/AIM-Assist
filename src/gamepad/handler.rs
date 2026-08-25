use crate::aim::{AimProcessor, AimTelemetry};
use crate::config::Settings;
use crate::types::*;
use anyhow::Result;
use std::collections::HashMap;
use std::sync::{mpsc, Arc, RwLock};
use std::thread;
use std::time::Instant;
use vigem::*;

pub struct GamepadHandler {
    settings: Settings,
    rx: mpsc::Receiver<Event>,
    settings_rx: mpsc::Receiver<Settings>,
    vigem: Vigem,
    target: Target,
    report: XUSBReport,
    aim_processor: AimProcessor,
    telemetry: Arc<RwLock<AimTelemetry>>,
    pending_mouse_x: i64,
    pending_mouse_y: i64,
    is_alt_sensitivity_active: bool,
    is_ads_active: bool,
    w_down: bool,
    a_down: bool,
    s_down: bool,
    d_down: bool,
    binds: HashMap<Bind, ControllerAction>,
}

impl GamepadHandler {
    pub fn new(
        rx: mpsc::Receiver<Event>,
        settings_rx: mpsc::Receiver<Settings>,
        settings: Settings,
        telemetry: Arc<RwLock<AimTelemetry>>,
    ) -> Result<Self> {
        let mut vigem = Vigem::new();
        vigem.connect()?;

        let mut target = Target::new(TargetType::Xbox360);
        vigem.target_add(&mut target)?;

        info!(
            "Virtual Xbox 360 Controller connected (Index: {})",
            target.index()
        );
        info!(
            "Aim Config -> Sens: {:.2}, ADS Multiplier: {:.2}, Anti-Deadzone: {:.2}, Curve Exponent: {:.2}, Smoothing: {}ms",
            settings.aiming.sensitivity,
            settings.aiming.ads_multiplier,
            settings.aiming.anti_deadzone,
            settings.aiming.curve_exponent,
            settings.aiming.mouse_smoothing_level
        );

        if let Some(key) = settings.controls.alt_sensitivity_key {
            info!("Alt/Parachute Mode Key: {:?}", key);
        }

        let aim_processor = AimProcessor::new(&settings.aiming);
        let binds = settings.get_all_binds();

        Ok(Self {
            settings,
            rx,
            settings_rx,
            vigem,
            target,
            report: XUSBReport::default(),
            aim_processor,
            telemetry,
            pending_mouse_x: 0,
            pending_mouse_y: 0,
            is_alt_sensitivity_active: false,
            is_ads_active: false,
            w_down: false,
            a_down: false,
            s_down: false,
            d_down: false,
            binds,
        })
    }

    pub fn run(&mut self) -> Result<()> {
        let mut tick_interval = self.settings.tick_interval();
        let mut previous_tick = Instant::now();
        let mut last_telemetry_publish = previous_tick;
        info!(
            "Gamepad update loop started at {}Hz (tick interval: {:?})",
            self.settings.tick_rate_hz, tick_interval
        );

        loop {
            let start_tick = Instant::now();

            while let Ok(new_settings) = self.settings_rx.try_recv() {
                self.aim_processor.update_config(&new_settings.aiming);
                self.binds = new_settings.get_all_binds();
                self.settings = new_settings;
                tick_interval = self.settings.tick_interval();
                info!(
                    "Applied updated settings without restart ({}Hz)",
                    self.settings.tick_rate_hz
                );
            }

            // Drain all pending events from the channel (Zero lock contention!)
            while let Ok(event) = self.rx.try_recv() {
                self.process_event(event);
            }

            let delta_time = start_tick.duration_since(previous_tick).as_secs_f64();
            previous_tick = start_tick;
            let output = self.aim_processor.process(
                self.pending_mouse_x as f64,
                self.pending_mouse_y as f64,
                delta_time,
                self.is_ads_active,
                self.is_alt_sensitivity_active,
            );
            self.pending_mouse_x = 0;
            self.pending_mouse_y = 0;

            self.report.s_thumb_rx = output.stick_x;
            self.report.s_thumb_ry = output.stick_y;

            // Debug telemetry is sampled at 20Hz, never locked on every hot-path tick.
            if start_tick
                .duration_since(last_telemetry_publish)
                .as_millis()
                >= 50
            {
                if let Ok(mut telemetry) = self.telemetry.try_write() {
                    *telemetry = output.telemetry;
                }
                last_telemetry_publish = start_tick;
            }

            // Send updated controller report
            if let Err(e) = self.vigem.update(&self.target, &self.report) {
                error!("Error updating ViGEm controller report: {}", e);
            }

            // Sleep remaining duration of tick to keep CPU usage minimal
            let elapsed = start_tick.elapsed();
            if elapsed < tick_interval {
                thread::sleep(tick_interval - elapsed);
            }
        }
    }

    fn process_event(&mut self, event: Event) {
        match event {
            Event::MouseMove(x, y) => {
                self.pending_mouse_x = self.pending_mouse_x.saturating_add(i64::from(x));
                self.pending_mouse_y = self.pending_mouse_y.saturating_add(i64::from(y));
            }
            Event::MouseButton(button, state) => {
                if Some(button) == self.settings.controls.ads_button {
                    self.is_ads_active = state == KeyState::Down;
                }
                self.handle_bind(Bind::Mouse(button), state);
            }
            Event::Keyboard(scancode, state) => {
                // Toggle Alt Sensitivity
                if Some(scancode) == self.settings.controls.alt_sensitivity_key {
                    if state == KeyState::Down {
                        self.is_alt_sensitivity_active = !self.is_alt_sensitivity_active;
                        info!(
                            "Alt/Parachute Mode: {}",
                            if self.is_alt_sensitivity_active {
                                "ACTIVE"
                            } else {
                                "DEACTIVATED"
                            }
                        );
                    }
                }

                // Handle directional movement
                let mov = &self.settings.controls.movement;
                if scancode == mov.forward {
                    self.w_down = state == KeyState::Down;
                } else if scancode == mov.backward {
                    self.s_down = state == KeyState::Down;
                } else if scancode == mov.left {
                    self.a_down = state == KeyState::Down;
                } else if scancode == mov.right {
                    self.d_down = state == KeyState::Down;
                }

                self.update_left_stick();
                self.handle_bind(Bind::Keyboard(scancode), state);
            }
            Event::Reset => {
                self.pending_mouse_x = 0;
                self.pending_mouse_y = 0;
                self.aim_processor.reset();
                self.report = XUSBReport::default();
                self.is_ads_active = false;
                self.is_alt_sensitivity_active = false;
                self.w_down = false;
                self.a_down = false;
                self.s_down = false;
                self.d_down = false;
                let _ = self.vigem.update(&self.target, &self.report);
            }
        }
    }

    fn update_left_stick(&mut self) {
        self.report.s_thumb_ly = if self.w_down == self.s_down {
            0
        } else if self.w_down {
            i16::MAX
        } else {
            i16::MIN
        };

        self.report.s_thumb_lx = if self.a_down == self.d_down {
            0
        } else if self.d_down {
            i16::MAX
        } else {
            i16::MIN
        };
    }

    fn handle_bind(&mut self, bind: Bind, state: KeyState) {
        if let Some(action) = self.binds.get(&bind) {
            match action {
                ControllerAction::Button(controller_button) => match controller_button {
                    ControllerButton::LeftTrigger => {
                        self.report.b_left_trigger =
                            if state == KeyState::Down { u8::MAX } else { 0 };
                    }
                    ControllerButton::RightTrigger => {
                        self.report.b_right_trigger =
                            if state == KeyState::Down { u8::MAX } else { 0 };
                    }
                    button => {
                        if let Some(button_flag) = XButton::from_bits(*button as u16) {
                            if state == KeyState::Down {
                                self.report.w_buttons |= button_flag;
                            } else {
                                self.report.w_buttons &= !button_flag;
                            }
                        }
                    }
                },
                ControllerAction::Analog(_, _) => {}
            }
        }
    }
}

impl Drop for GamepadHandler {
    fn drop(&mut self) {
        info!("Disconnecting virtual Xbox 360 controller...");
        let _ = self.vigem.target_remove(&mut self.target);
        self.vigem.disconnect();
    }
}
