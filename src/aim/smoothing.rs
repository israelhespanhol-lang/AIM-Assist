#[derive(Debug, Default, Clone, Copy)]
pub(super) struct AxisSmoother {
    value: f64,
}

impl AxisSmoother {
    #[inline]
    pub(super) fn update(&mut self, input: f64, delta_time: f64, smoothing_ms: u8) -> f64 {
        if smoothing_ms == 0 {
            self.value = input;
            return input;
        }

        let tau = f64::from(smoothing_ms) / 1000.0;
        let alpha = 1.0 - (-delta_time.max(0.0) / tau).exp();
        self.value += (input - self.value) * alpha.clamp(0.0, 1.0);
        self.value
    }

    pub(super) fn reset(&mut self) {
        self.value = 0.0;
    }
}
