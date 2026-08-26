/**
 * Interactive Aim Response Curve & Anti-Deadzone Canvas Graph
 */

export class AimCurveRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.params = {
      sensitivity: 1.0,
      adsMultiplier: 0.75,
      altSensitivity: 3.0,
      antiDeadzone: 0.10, // 10%
      curveExponent: 1.0,
      isAds: false,
      isAlt: false,
    };

    this.livePoint = { in: 0, out: 0 };

    this.initCanvasDpi();
    this.draw();
  }

  initCanvasDpi() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width || 600;
    this.height = rect.height || 320;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  updateParams(newParams) {
    Object.assign(this.params, newParams);
    this.draw();
  }

  setLivePoint(mouseIn, stickOut) {
    this.livePoint = { in: mouseIn, out: stickOut };
  }

  // Drawing-only approximation. src/aim is the authoritative implementation.
  // The UI intentionally duplicates only the normalized radial graph formula.
  computeOutput(normalizedInput, antiDeadzone, exponent) {
    if (normalizedInput <= 0.0001) return 0;
    const curved = Math.pow(Math.min(1.0, normalizedInput), exponent);
    return Math.min(1.0, antiDeadzone + curved * (1.0 - antiDeadzone));
  }

  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const p = this.params;

    // Clear
    ctx.clearRect(0, 0, w, h);

    const paddingLeft = 45;
    const paddingBottom = 35;
    const paddingTop = 20;
    const paddingRight = 20;

    const graphW = w - paddingLeft - paddingRight;
    const graphH = h - paddingTop - paddingBottom;

    // Background
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(paddingLeft, paddingTop, graphW, graphH);

    // Grid lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    const gridSteps = 5;

    for (let i = 0; i <= gridSteps; i++) {
      const x = paddingLeft + (graphW / gridSteps) * i;
      const y = paddingTop + (graphH / gridSteps) * i;

      // Vertical
      ctx.beginPath();
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, paddingTop + graphH);
      ctx.stroke();

      // Horizontal
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(paddingLeft + graphW, y);
      ctx.stroke();

      // Axis labels
      ctx.fillStyle = '#64748b';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      const yVal = ((gridSteps - i) / gridSteps).toFixed(1);
      ctx.fillText(yVal, paddingLeft - 8, y + 4);

      ctx.textAlign = 'center';
      const xVal = ((i / gridSteps) * 25).toFixed(0);
      ctx.fillText(xVal, x, paddingTop + graphH + 18);
    }

    // Axes captions
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Velocidade do Mouse (Entrada)', paddingLeft + graphW / 2, h - 4);

    ctx.save();
    ctx.translate(14, paddingTop + graphH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Saída Analógico (0.0 - 1.0)', 0, 0);
    ctx.restore();

    // Deadzone shaded area (game deadzone threshold)
    const deadzoneY = paddingTop + graphH - p.antiDeadzone * graphH;
    ctx.fillStyle = 'rgba(0, 229, 255, 0.05)';
    ctx.fillRect(paddingLeft, deadzoneY, graphW, p.antiDeadzone * graphH);

    ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, deadzoneY);
    ctx.lineTo(paddingLeft + graphW, deadzoneY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#64748b';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Deadzone: ${(p.antiDeadzone * 100).toFixed(0)}%`, paddingLeft + 10, deadzoneY - 6);

    // 1. Draw Alt / Parachute Curve (Subtle Slate)
    this.plotCurve(ctx, paddingLeft, paddingTop, graphW, graphH, p.altSensitivity, 1.0, false, p.antiDeadzone, p.curveExponent, '#64748b', 1.2, [2, 2]);

    // 2. Draw ADS Curve (Precision Blue)
    this.plotCurve(ctx, paddingLeft, paddingTop, graphW, graphH, p.sensitivity, p.adsMultiplier, true, p.antiDeadzone, p.curveExponent, '#3b82f6', 1.8);

    // 3. Draw Normal Base Curve (Clean Signature Cyan)
    this.plotCurve(ctx, paddingLeft, paddingTop, graphW, graphH, p.sensitivity, 1.0, false, p.antiDeadzone, p.curveExponent, '#00e5ff', 2.2);

    // Live Tracking Point
    if (this.livePoint && this.livePoint.in > 0) {
      const ptX = paddingLeft + Math.min(graphW, (this.livePoint.in / 25.0) * graphW);
      const ptY = paddingTop + graphH - Math.min(1.0, this.livePoint.out) * graphH;

      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(ptX, ptY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  plotCurve(ctx, ox, oy, gw, gh, sens, adsMult, isAds, antiDeadzone, exponent, color, strokeWidth, dash = []) {
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.setLineDash(dash);
    ctx.beginPath();

    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const inVal = (i / steps) * 25.0; // mouse speed up to 25
      const effectiveSensitivity = isAds ? sens * adsMult : sens;
      const normalizedInput = Math.min(1.0, (inVal / 25.0) * effectiveSensitivity);
      const outVal = this.computeOutput(normalizedInput, antiDeadzone, exponent);

      const x = ox + (i / steps) * gw;
      const y = oy + gh - outVal * gh;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
