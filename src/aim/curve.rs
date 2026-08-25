/// Applies the canonical radial response curve used by the remapper.
///
/// The input and output magnitudes are normalized to `[0.0, 1.0]`.
#[inline]
pub(super) fn apply(magnitude: f64, exponent: f64) -> f64 {
    let magnitude = magnitude.clamp(0.0, 1.0);
    if (exponent - 1.0).abs() < 1.0e-6 {
        magnitude
    } else {
        magnitude.powf(exponent)
    }
}
