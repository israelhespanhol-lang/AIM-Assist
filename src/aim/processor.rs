use super::{curve, smoothing::AxisSmoother};
use crate::config::AimingSettings;

const ANALOG_MAX: f64 = i16::MAX as f64;
const INPUT_SCALE: f64 = 10_000.0;
const MIN_DELTA_TIME: f64 = 1.0e-6;

#[derive(Debug, Default, Clone, Copy)]
pub struct AimTelemetry {
    pub raw_dx: f64,
    pub raw_dy: f64,
    pub normalized_x: f64,
    pub normalized_y: f64,
    pub curved_x: f64,
    pub curved_y: f64,
    pub smoothed_x: f64,
    pub smoothed_y: f64,
    pub final_rx: i16,
    pub final_ry: i16,
}

impl AimTelemetry {
    pub fn to_json(self) -> String {
        format!(
            "{{\"raw_dx\":{:.4},\"raw_dy\":{:.4},\"normalized_x\":{:.6},\"normalized_y\":{:.6},\"curved_x\":{:.6},\"curved_y\":{:.6},\"smoothed_x\":{:.6},\"smoothed_y\":{:.6},\"final_rx\":{},\"final_ry\":{}}}",
            self.raw_dx, self.raw_dy, self.normalized_x, self.normalized_y,
            self.curved_x, self.curved_y, self.smoothed_x, self.smoothed_y,
            self.final_rx, self.final_ry
        )
    }
}

#[derive(Debug, Default, Clone, Copy)]
pub struct AimOutput {
    pub stick_x: i16,
    pub stick_y: i16,
    pub telemetry: AimTelemetry,
}

/// The single authoritative mouse-to-right-stick processing pipeline.
///
/// Order: normalization -> sensitivity -> ADS -> alternate sensitivity ->
/// radial response curve -> radial anti-deadzone -> yaw/pitch -> independent
/// time-based axis smoothing -> output clamp.
pub struct AimProcessor {
    config: AimingSettings,
    smoother_x: AxisSmoother,
    smoother_y: AxisSmoother,
}

impl AimProcessor {
    pub fn new(config: &AimingSettings) -> Self {
        Self {
            config: config.clone(),
            smoother_x: AxisSmoother::default(),
            smoother_y: AxisSmoother::default(),
        }
    }

    pub fn update_config(&mut self, config: &AimingSettings) {
        self.config = config.clone();
    }

    pub fn reset(&mut self) {
        self.smoother_x.reset();
        self.smoother_y.reset();
    }

    #[inline]
    pub fn process(
        &mut self,
        delta_x: f64,
        delta_y: f64,
        delta_time: f64,
        ads_active: bool,
        alt_mode_active: bool,
    ) -> AimOutput {
        let dt = delta_time.max(MIN_DELTA_TIME);

        // Normalize counts to counts/second, then to the stick's unit domain.
        let normalized_x = delta_x / dt / INPUT_SCALE;
        let normalized_y = delta_y / dt / INPUT_SCALE;

        let mut sensitivity = self.config.sensitivity.max(0.0);
        if ads_active {
            sensitivity *= self.config.ads_multiplier.clamp(0.0, 5.0);
        }
        if alt_mode_active {
            sensitivity = self.config.alt_sensitivity.max(0.0);
        }

        let sensitive_x = normalized_x * sensitivity;
        let sensitive_y = normalized_y * sensitivity;
        let magnitude = sensitive_x.hypot(sensitive_y);

        let (curved_x, curved_y) = if magnitude <= f64::EPSILON {
            (0.0, 0.0)
        } else {
            let direction_x = sensitive_x / magnitude;
            let direction_y = sensitive_y / magnitude;
            let curved_magnitude =
                curve::apply(magnitude, self.config.curve_exponent.clamp(0.1, 5.0));
            let anti_deadzone = self.config.anti_deadzone.clamp(0.0, 0.95);
            let radius = anti_deadzone + (1.0 - anti_deadzone) * curved_magnitude;
            (direction_x * radius, direction_y * radius)
        };

        let yawed_x = curved_x * self.config.yaw_multiplier.max(0.0);
        let pitch_sign = if self.config.invert_pitch { 1.0 } else { -1.0 };
        let pitched_y = curved_y * self.config.pitch_multiplier.max(0.0) * pitch_sign;

        let smoothing = self.config.mouse_smoothing_level.min(20);
        let smoothed_x = self.smoother_x.update(yawed_x, dt, smoothing);
        let smoothed_y = self.smoother_y.update(pitched_y, dt, smoothing);

        let final_rx = (smoothed_x.clamp(-1.0, 1.0) * ANALOG_MAX).round() as i16;
        let final_ry = (smoothed_y.clamp(-1.0, 1.0) * ANALOG_MAX).round() as i16;

        AimOutput {
            stick_x: final_rx,
            stick_y: final_ry,
            telemetry: AimTelemetry {
                raw_dx: delta_x,
                raw_dy: delta_y,
                normalized_x,
                normalized_y,
                curved_x,
                curved_y,
                smoothed_x,
                smoothed_y,
                final_rx,
                final_ry,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn processor(mut settings: AimingSettings) -> AimProcessor {
        settings.mouse_smoothing_level = 0;
        settings.anti_deadzone = 0.0;
        AimProcessor::new(&settings)
    }

    #[test]
    fn zero_input_is_zero_output() {
        let mut aim = processor(AimingSettings::default());
        let out = aim.process(0.0, 0.0, 0.004, false, false);
        assert_eq!((out.stick_x, out.stick_y), (0, 0));
    }

    #[test]
    fn linear_curve_is_linear() {
        let mut settings = AimingSettings::default();
        settings.curve_exponent = 1.0;
        let mut aim = processor(settings);
        let out = aim.process(20.0, 0.0, 0.004, false, false);
        assert!((out.telemetry.curved_x - 0.5).abs() < 1e-6);
    }

    #[test]
    fn exponential_curve_reduces_midrange() {
        let mut settings = AimingSettings::default();
        settings.curve_exponent = 2.0;
        let mut aim = processor(settings);
        let out = aim.process(20.0, 0.0, 0.004, false, false);
        assert!((out.telemetry.curved_x - 0.25).abs() < 1e-6);
    }

    #[test]
    fn ads_applies_multiplier() {
        let mut settings = AimingSettings::default();
        settings.ads_multiplier = 0.5;
        let mut aim = processor(settings);
        let hip = aim.process(20.0, 0.0, 0.004, false, false).stick_x;
        aim.reset();
        let ads = aim.process(20.0, 0.0, 0.004, true, false).stick_x;
        assert_eq!(ads, hip / 2);
    }

    #[test]
    fn alternate_sensitivity_overrides_ads() {
        let mut settings = AimingSettings::default();
        settings.alt_sensitivity = 2.0;
        settings.ads_multiplier = 0.5;
        let mut aim = processor(settings);
        let out = aim.process(10.0, 0.0, 0.004, true, true);
        assert!((out.telemetry.curved_x - 0.5).abs() < 1e-6);
    }

    #[test]
    fn anti_deadzone_preserves_direction() {
        let mut settings = AimingSettings::default();
        settings.anti_deadzone = 0.2;
        settings.mouse_smoothing_level = 0;
        let mut aim = AimProcessor::new(&settings);
        let out = aim.process(1.0, 1.0, 0.004, false, false);
        assert!((out.telemetry.curved_x - out.telemetry.curved_y).abs() < 1e-6);
        assert!(out.telemetry.curved_x.hypot(out.telemetry.curved_y) >= 0.2);
    }

    #[test]
    fn yaw_pitch_and_inversion_are_applied() {
        let mut settings = AimingSettings::default();
        settings.yaw_multiplier = 0.5;
        settings.pitch_multiplier = 0.25;
        settings.invert_pitch = true;
        let mut aim = processor(settings);
        let out = aim.process(10.0, 10.0, 0.004, false, false);
        assert!(out.stick_x > 0 && out.stick_y > 0);
        assert!(out.stick_x > out.stick_y);
    }

    #[test]
    fn default_pitch_is_inverted() {
        let mut aim = processor(AimingSettings::default());
        assert!(aim.process(0.0, 10.0, 0.004, false, false).stick_y < 0);
    }

    #[test]
    fn smoothing_uses_real_delta_time() {
        let mut settings = AimingSettings::default();
        settings.mouse_smoothing_level = 10;
        settings.anti_deadzone = 0.0;
        let mut aim = AimProcessor::new(&settings);
        let early = aim
            .process(20.0, 0.0, 0.001, false, false)
            .telemetry
            .smoothed_x;
        aim.reset();
        let later = aim
            .process(200.0, 0.0, 0.010, false, false)
            .telemetry
            .smoothed_x;
        assert!(later > early);
    }

    #[test]
    fn output_is_always_clamped() {
        let mut aim = processor(AimingSettings::default());
        let out = aim.process(f64::MAX, -f64::MAX, 0.001, false, false);
        assert!(out.stick_x <= i16::MAX && out.stick_x >= -i16::MAX);
        assert!(out.stick_y <= i16::MAX && out.stick_y >= -i16::MAX);
    }
}
