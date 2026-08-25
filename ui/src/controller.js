/**
 * Photorealistic Shock Blue Xbox Controller Visualizer & Real-time Telemetry
 */

export class XboxControllerRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.state = {
      buttons: {
        A: false,
        B: false,
        X: false,
        Y: false,
        LB: false,
        RB: false,
        Back: false,
        Start: false,
        Guide: false,
        L3: false,
        R3: false,
        DPadUp: false,
        DPadDown: false,
        DPadLeft: false,
        DPadRight: false,
      },
      triggers: {
        LT: 0, // 0 to 255
        RT: 0, // 0 to 255
      },
      sticks: {
        LX: 0, // -32768 to 32767
        LY: 0, // -32768 to 32767
        RX: 0, // -32768 to 32767
        RY: 0, // -32768 to 32767
      }
    };

    this.render();
    this.cacheElements();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="controller-visualizer-wrapper" style="position: relative; width: 100%; max-width: 620px; margin: 0 auto;">
        <svg class="xbox-svg" viewBox="0 0 1000 670" style="width: 100%; height: auto; display: block;" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <!-- Glow Filters -->
            <filter id="glowCyan" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="glowGreen" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="glowRed" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="glowYellow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="glowWhite" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="10" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <!-- Photorealistic Base Controller Render -->
          <image href="/xbox_controller.png" x="0" y="0" width="1000" height="670" />

          <!-- ================= INTERACTIVE GLOW OVERLAYS ================= -->

          <!-- Left Trigger (LT) Wing Overlay -->
          <path id="btn-lt-top" class="ctrl-btn-overlay" d="M 160 30 Q 230 15 310 32 L 285 65 Q 220 50 170 58 Z" 
                fill="none" stroke="#00f0ff" stroke-width="4" opacity="0" filter="url(#glowCyan)"/>

          <!-- Right Trigger (RT) Wing Overlay -->
          <path id="btn-rt-top" class="ctrl-btn-overlay" d="M 690 32 Q 770 15 840 30 L 830 58 Q 780 50 715 65 Z" 
                fill="none" stroke="#ff5e3a" stroke-width="4" opacity="0" filter="url(#glowCyan)"/>

          <!-- Left Bumper (LB) -->
          <path id="btn-lb" class="ctrl-btn-overlay" d="M 195 55 Q 315 35 375 75 L 355 105 Q 295 72 205 85 Z" 
                fill="rgba(0, 240, 255, 0.45)" stroke="#00f0ff" stroke-width="3" opacity="0" filter="url(#glowCyan)"/>

          <!-- Right Bumper (RB) -->
          <path id="btn-rb" class="ctrl-btn-overlay" d="M 805 55 Q 685 35 625 75 L 645 105 Q 705 72 795 85 Z" 
                fill="rgba(0, 240, 255, 0.45)" stroke="#00f0ff" stroke-width="3" opacity="0" filter="url(#glowCyan)"/>

          <!-- Nexus / Xbox Guide Button (Top Center) -->
          <circle id="btn-guide" class="ctrl-btn-overlay" cx="500" cy="102" r="30" 
                  fill="rgba(255, 255, 255, 0.55)" stroke="#ffffff" stroke-width="4" opacity="0" filter="url(#glowWhite)"/>

          <!-- View Button (Back - Left of Guide) -->
          <circle id="btn-back" class="ctrl-btn-overlay" cx="431" cy="186" r="19" 
                  fill="rgba(0, 240, 255, 0.4)" stroke="#00f0ff" stroke-width="3" opacity="0" filter="url(#glowCyan)"/>

          <!-- Menu Button (Start - Right of Guide) -->
          <circle id="btn-start" class="ctrl-btn-overlay" cx="568" cy="186" r="19" 
                  fill="rgba(0, 240, 255, 0.4)" stroke="#00f0ff" stroke-width="3" opacity="0" filter="url(#glowCyan)"/>

          <!-- ================= D-PAD DIRECTION CHEVRONS ================= -->
          <g id="group-dpad-overlays">
            <!-- D-Pad Up -->
            <path id="btn-dpad-up" class="ctrl-btn-overlay" d="M 356 318 L 404 318 L 404 345 L 356 345 Z" 
                  fill="rgba(0, 240, 255, 0.6)" stroke="#00f0ff" stroke-width="2" opacity="0" filter="url(#glowCyan)"/>
            <!-- D-Pad Down -->
            <path id="btn-dpad-down" class="ctrl-btn-overlay" d="M 356 385 L 404 385 L 404 412 L 356 412 Z" 
                  fill="rgba(0, 240, 255, 0.6)" stroke="#00f0ff" stroke-width="2" opacity="0" filter="url(#glowCyan)"/>
            <!-- D-Pad Left -->
            <path id="btn-dpad-left" class="ctrl-btn-overlay" d="M 324 350 L 351 350 L 351 398 L 324 398 Z" 
                  fill="rgba(0, 240, 255, 0.6)" stroke="#00f0ff" stroke-width="2" opacity="0" filter="url(#glowCyan)"/>
            <!-- D-Pad Right -->
            <path id="btn-dpad-right" class="ctrl-btn-overlay" d="M 409 350 L 436 350 L 436 398 L 409 398 Z" 
                  fill="rgba(0, 240, 255, 0.6)" stroke="#00f0ff" stroke-width="2" opacity="0" filter="url(#glowCyan)"/>
          </g>

          <!-- ================= ACTION BUTTONS (A, B, X, Y) ================= -->
          <!-- Y Button (Top - Amber / Yellow) -->
          <circle id="btn-y" class="ctrl-btn-overlay" cx="742" cy="130" r="28" 
                  fill="rgba(255, 215, 0, 0.45)" stroke="#ffd700" stroke-width="3.5" opacity="0" filter="url(#glowYellow)"/>

          <!-- X Button (Left - Electric Blue) -->
          <circle id="btn-x" class="ctrl-btn-overlay" cx="675" cy="196" r="28" 
                  fill="rgba(0, 120, 215, 0.5)" stroke="#00f0ff" stroke-width="3.5" opacity="0" filter="url(#glowCyan)"/>

          <!-- B Button (Right - Vivid Red) -->
          <circle id="btn-b" class="ctrl-btn-overlay" cx="808" cy="196" r="28" 
                  fill="rgba(232, 17, 35, 0.5)" stroke="#ff3366" stroke-width="3.5" opacity="0" filter="url(#glowRed)"/>

          <!-- A Button (Bottom - Emerald Green) -->
          <circle id="btn-a" class="ctrl-btn-overlay" cx="742" cy="262" r="28" 
                  fill="rgba(16, 124, 16, 0.5)" stroke="#00ff9d" stroke-width="3.5" opacity="0" filter="url(#glowGreen)"/>

          <!-- ================= DYNAMIC THUMBSTICK POINTERS ================= -->
          <!-- Left Stick Movable Ring (Movement / WASD) -->
          <g id="stick-left-cap" transform="translate(0, 0)">
            <circle cx="260" cy="192" r="42" fill="none" stroke="#38bdf8" stroke-width="3" opacity="0.8" filter="url(#glowCyan)"/>
            <circle cx="260" cy="192" r="14" fill="#38bdf8" opacity="0.9" filter="url(#glowCyan)"/>
          </g>

          <!-- Right Stick Movable Ring (Aim Mouse / RX, RY) -->
          <g id="stick-right-cap" transform="translate(0, 0)">
            <circle cx="625" cy="330" r="42" fill="none" stroke="#00f0ff" stroke-width="3" opacity="0.8" filter="url(#glowCyan)"/>
            <circle cx="625" cy="330" r="14" fill="#00f0ff" opacity="0.9" filter="url(#glowCyan)"/>
          </g>
        </svg>
      </div>
    `;
  }

  cacheElements() {
    this.dom = {
      btnA: document.getElementById('btn-a'),
      btnB: document.getElementById('btn-b'),
      btnX: document.getElementById('btn-x'),
      btnY: document.getElementById('btn-y'),
      btnLB: document.getElementById('btn-lb'),
      btnRB: document.getElementById('btn-rb'),
      btnLTTop: document.getElementById('btn-lt-top'),
      btnRTTop: document.getElementById('btn-rt-top'),
      btnBack: document.getElementById('btn-back'),
      btnStart: document.getElementById('btn-start'),
      btnGuide: document.getElementById('btn-guide'),
      dpadUp: document.getElementById('btn-dpad-up'),
      dpadDown: document.getElementById('btn-dpad-down'),
      dpadLeft: document.getElementById('btn-dpad-left'),
      dpadRight: document.getElementById('btn-dpad-right'),
      stickLeftCap: document.getElementById('stick-left-cap'),
      stickRightCap: document.getElementById('stick-right-cap'),
      // External UI gauges
      gaugeLT: document.getElementById('gauge-lt'),
      gaugeRT: document.getElementById('gauge-rt'),
      valLT: document.getElementById('val-lt'),
      valRT: document.getElementById('val-rt'),
      valLX: document.getElementById('val-lx'),
      valLY: document.getElementById('val-ly'),
      valRX: document.getElementById('val-rx'),
      valRY: document.getElementById('val-ry'),
    };
  }

  updateState(newState) {
    if (!newState) return;

    if (newState.buttons) {
      Object.assign(this.state.buttons, newState.buttons);
    }
    if (newState.triggers) {
      Object.assign(this.state.triggers, newState.triggers);
    }
    if (newState.sticks) {
      Object.assign(this.state.sticks, newState.sticks);
    }

    this.applyVisuals();
  }

  applyVisuals() {
    const { buttons, triggers, sticks } = this.state;
    const d = this.dom;
    if (!d.btnA) return;

    // Face buttons highlight with ultra-bright neon overlays
    this.toggleOverlay(d.btnA, buttons.A);
    this.toggleOverlay(d.btnB, buttons.B);
    this.toggleOverlay(d.btnX, buttons.X);
    this.toggleOverlay(d.btnY, buttons.Y);

    // Bumpers (LB & RB)
    this.toggleOverlay(d.btnLB, buttons.LB);
    this.toggleOverlay(d.btnRB, buttons.RB);

    // Start / Back / Guide
    this.toggleOverlay(d.btnBack, buttons.Back);
    this.toggleOverlay(d.btnStart, buttons.Start);
    this.toggleOverlay(d.btnGuide, buttons.Guide);

    // DPad Directional Highlights
    this.toggleOverlay(d.dpadUp, buttons.DPadUp);
    this.toggleOverlay(d.dpadDown, buttons.DPadDown);
    this.toggleOverlay(d.dpadLeft, buttons.DPadLeft);
    this.toggleOverlay(d.dpadRight, buttons.DPadRight);

    // Triggers (LT / RT)
    const ltPercent = Math.min(100, Math.round((triggers.LT / 255) * 100));
    const rtPercent = Math.min(100, Math.round((triggers.RT / 255) * 100));

    if (d.gaugeLT) d.gaugeLT.style.width = `${ltPercent}%`;
    if (d.gaugeRT) d.gaugeRT.style.width = `${rtPercent}%`;
    if (d.valLT) d.valLT.textContent = `${triggers.LT} (${ltPercent}%)`;
    if (d.valRT) d.valRT.textContent = `${triggers.RT} (${rtPercent}%)`;

    if (d.btnLTTop) {
      d.btnLTTop.style.opacity = triggers.LT > 0 ? (triggers.LT / 255).toString() : '0';
    }
    if (d.btnRTTop) {
      d.btnRTTop.style.opacity = triggers.RT > 0 ? (triggers.RT / 255).toString() : '0';
    }

    // Sticks displacement (range: -32768 to 32767 -> max 22px visual delta in 1000px SVG space)
    const maxPixelOffset = 22;
    const lxOffset = (sticks.LX / 32768) * maxPixelOffset;
    const lyOffset = -(sticks.LY / 32768) * maxPixelOffset; // invert Y for standard SVG coordinates
    const rxOffset = (sticks.RX / 32768) * maxPixelOffset;
    const ryOffset = -(sticks.RY / 32768) * maxPixelOffset;

    if (d.stickLeftCap) {
      d.stickLeftCap.setAttribute('transform', `translate(${lxOffset.toFixed(1)}, ${lyOffset.toFixed(1)})`);
      d.stickLeftCap.style.filter = buttons.L3 ? 'url(#glowWhite)' : 'none';
      d.stickLeftCap.style.opacity = (Math.abs(sticks.LX) > 500 || Math.abs(sticks.LY) > 500 || buttons.L3) ? '1' : '0.4';
    }

    if (d.stickRightCap) {
      d.stickRightCap.setAttribute('transform', `translate(${rxOffset.toFixed(1)}, ${ryOffset.toFixed(1)})`);
      d.stickRightCap.style.filter = buttons.R3 ? 'url(#glowWhite)' : 'none';
      d.stickRightCap.style.opacity = (Math.abs(sticks.RX) > 500 || Math.abs(sticks.RY) > 500 || buttons.R3) ? '1' : '0.4';
    }

    if (d.valLX) d.valLX.textContent = `LX: ${sticks.LX}`;
    if (d.valLY) d.valLY.textContent = `LY: ${sticks.LY}`;
    if (d.valRX) d.valRX.textContent = `RX: ${sticks.RX}`;
    if (d.valRY) d.valRY.textContent = `RY: ${sticks.RY}`;
  }

  toggleOverlay(elem, isPressed) {
    if (!elem) return;
    elem.style.opacity = isPressed ? '1' : '0';
    elem.style.transition = 'opacity 0.1s ease';
  }
}
