/**
 * 3D FPS Aim Trainer & Target Shooting Range for GamepadEmulation
 */

export class AimTrainerRange {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.isRunning = false;
    this.mode = 'gridshot'; // 'gridshot', 'tracking', 'precision'
    this.score = 0;
    this.shots = 0;
    this.hits = 0;
    this.targets = [];
    this.maxTargets = 3;
    this.startTime = 0;
    this.timeLimit = 60; // 60 seconds
    this.timeLeft = 60;

    // First person camera rotation (Yaw, Pitch in radians)
    this.camera = {
      yaw: 0,
      pitch: 0,
      fov: 75 * (Math.PI / 180),
    };

    this.invertPitch = false;
    this.invertYaw = false;

    // Controller input state
    this.stick = { rx: 0, ry: 0, lx: 0, ly: 0 };
    this.isAds = false;

    // Crosshair size
    this.crosshairHit = false;
    this.hitTimer = 0;
    this.lastFrameTime = 0;
    this.lastInputTime = 0;

    // Audio Context for synthetic SFX
    this.audioCtx = null;

    this.initCanvas();
    this.bindEvents();
    this.drawStartScreen();
  }

  initCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width || 800;
    this.height = rect.height || 480;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
  }

  playHitSound() {
    if (!this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.audioCtx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, this.audioCtx.currentTime + 0.08); // A6 ping

      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.08);
    } catch (e) {
      // Audio not permitted yet
    }
  }

  playShootSound() {
    if (!this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(55, this.audioCtx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.05);
    } catch (e) {
      // Audio fallback
    }
  }

  bindEvents() {
    // Mode selector buttons
    document.querySelectorAll('.trainer-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.trainer-mode-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.mode = btn.dataset.mode || 'gridshot';
        if (this.isRunning) {
          this.resetGame();
        } else {
          this.drawStartScreen();
        }
      });
    });

    // Start / Reset button
    const startBtn = document.getElementById('btn-trainer-start');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this.initAudio();
        if (this.isRunning) {
          this.stopGame();
        } else {
          this.startGame();
        }
      });
    }

    // Pointer lock for shooting range click
    this.canvas.addEventListener('click', (e) => {
      this.initAudio();
      if (!this.isRunning) {
        this.startGame();
        return;
      }
      this.shoot();
    });

    // Request pointer lock on click if running
    this.canvas.addEventListener('mousedown', () => {
      if (this.isRunning && document.pointerLockElement !== this.canvas) {
        this.canvas.requestPointerLock?.();
      }
    });
  }

  clampCamera() {
    const maxPitch = Math.PI / 2.2;
    this.camera.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.camera.pitch));
  }

  startGame() {
    this.isRunning = true;
    this.score = 0;
    this.shots = 0;
    this.hits = 0;
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    this.lastInputTime = this.startTime;
    this.timeLeft = this.timeLimit;
    this.camera = { yaw: 0, pitch: 0, fov: 75 * (Math.PI / 180) };
    this.targets = [];

    const btn = document.getElementById('btn-trainer-start');
    if (btn) {
      btn.textContent = '⏹️ Parar Treino';
      btn.classList.add('btn-secondary');
      btn.classList.remove('btn-primary');
    }

    this.spawnInitialTargets();
    this.loop();
  }

  stopGame() {
    this.isRunning = false;
    if (document.exitPointerLock) {
      document.exitPointerLock();
    }

    const btn = document.getElementById('btn-trainer-start');
    if (btn) {
      btn.textContent = '▶️ Iniciar Treino';
      btn.classList.add('btn-primary');
      btn.classList.remove('btn-secondary');
    }

    this.drawGameOverScreen();
  }

  resetGame() {
    this.stopGame();
    this.drawStartScreen();
  }

  spawnInitialTargets() {
    this.targets = [];
    const count = this.mode === 'tracking' ? 1 : this.maxTargets;
    for (let i = 0; i < count; i++) {
      this.spawnTarget();
    }
  }

  spawnTarget() {
    const depth = 12.0; // Distance in meters
    const spanX = this.mode === 'precision' ? 6.0 : 8.0;
    const spanY = this.mode === 'precision' ? 4.0 : 5.0;

    const target = {
      x: (Math.random() - 0.5) * spanX,
      y: (Math.random() - 0.5) * spanY,
      z: depth,
      radius: this.mode === 'precision' ? 0.35 : (this.mode === 'tracking' ? 0.75 : 0.6),
      vx: (Math.random() - 0.5) * 3.5,
      vy: (Math.random() - 0.5) * 2.5,
      hp: 1.0,
      createdAt: performance.now(),
      color: '#00f0ff',
      pulse: 0,
    };

    this.targets.push(target);
  }

  shoot() {
    this.shots++;
    this.playShootSound();

    const cx = this.width / 2;
    const cy = this.height / 2;
    let hitIndex = -1;
    let closestZ = Infinity;

    if (this.projectedTargets && this.projectedTargets.length > 0) {
      for (let i = 0; i < this.projectedTargets.length; i++) {
        const pt = this.projectedTargets[i];
        const dist = Math.sqrt((pt.x - cx) ** 2 + (pt.y - cy) ** 2);
        // Hit check: crosshair center within target radius
        if (dist <= pt.r * 1.2 && pt.z < closestZ) {
          closestZ = pt.z;
          const originalIdx = this.targets.indexOf(pt.target);
          if (originalIdx !== -1) {
            hitIndex = originalIdx;
          }
        }
      }
    }

    if (hitIndex !== -1) {
      this.hits++;
      this.score += this.mode === 'precision' ? 150 : 100;
      this.playHitSound();
      this.crosshairHit = true;
      this.hitTimer = 12;

      // Remove and respawn
      this.targets.splice(hitIndex, 1);
      this.spawnTarget();
    }

    this.updateStatsHud();
  }

  updateStatsHud() {
    const accuracy = this.shots > 0 ? Math.round((this.hits / this.shots) * 100) : 100;
    const scoreEl = document.getElementById('trainer-score');
    const accEl = document.getElementById('trainer-accuracy');
    const hitsEl = document.getElementById('trainer-hits');
    const timeEl = document.getElementById('trainer-time');

    if (scoreEl) scoreEl.textContent = this.score;
    if (accEl) accEl.textContent = `${accuracy}%`;
    if (hitsEl) hitsEl.textContent = `${this.hits} / ${this.shots}`;
    if (timeEl) timeEl.textContent = `${Math.max(0, Math.ceil(this.timeLeft))}s`;
  }

  // Updates camera and trigger inputs coming from real Xbox Gamepad / Interception
  updateInputsFromGamepad(sticks, triggers, buttons) {
    if (!this.isRunning) return;

    // Right Stick Aiming (RX, RY) - smooth FPS turn rate
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - this.lastInputTime) / 1000));
    this.lastInputTime = now;
    // The stick already contains ADS, yaw, pitch and inversion from AimProcessor.
    const turnRate = 2.6;

    let rx = sticks.RX || 0;
    let ry = sticks.RY || 0;

    if (rx !== 0) {
      const normRx = rx / 32767.0;
      this.camera.yaw += normRx * turnRate * dt;
    }
    if (ry !== 0) {
      const normRy = ry / 32767.0;
      this.camera.pitch += normRy * turnRate * dt;
      this.clampCamera();
    }

    // Right Trigger (RT) shooting or Button A
    const isRtPressed = triggers.RT > 140 || buttons.A;
    if (isRtPressed && !this.wasRtDown) {
      this.shoot();
      this.wasRtDown = true;
    } else if (!isRtPressed) {
      this.wasRtDown = false;
    }

    // Left Trigger (LT) ADS zoom
    this.isAds = triggers.LT > 120;
    this.camera.fov = this.isAds ? 45 * (Math.PI / 180) : 75 * (Math.PI / 180);
  }

  loop() {
    if (!this.isRunning) return;

    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;
    const elapsed = (now - this.startTime) / 1000;
    this.timeLeft = this.timeLimit - elapsed;

    if (this.timeLeft <= 0) {
      this.stopGame();
      return;
    }

    this.updateTargets(dt);
    this.render3DScene();
    this.updateStatsHud();

    requestAnimationFrame(() => this.loop());
  }

  updateTargets(dt) {
    for (const t of this.targets) {
      if (this.mode === 'tracking') {
        t.x += t.vx * dt;
        t.y += t.vy * dt;

        // Bounce inside arena box
        if (t.x < -4.5 || t.x > 4.5) t.vx *= -1;
        if (t.y < -3.0 || t.y > 3.0) t.vy *= -1;
      }
      t.pulse = (t.pulse + 0.05) % (Math.PI * 2);
    }
  }

  render3DScene() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Clear background (Dark Cyberpunk Sci-Fi Training Room)
    ctx.fillStyle = '#06090e';
    ctx.fillRect(0, 0, w, h);

    // 3D Perspective Projection Matrix Parameters
    const fov = this.camera.fov;
    const aspect = w / h;
    const near = 0.1;
    const cx = w / 2;
    const cy = h / 2;
    const f = 1.0 / Math.tan(fov / 2);

    // Camera transform vectors
    const cosY = Math.cos(-this.camera.yaw);
    const sinY = Math.sin(-this.camera.yaw);
    const cosP = Math.cos(-this.camera.pitch);
    const sinP = Math.sin(-this.camera.pitch);

    // 1. Draw 3D Grid Walls & Floor
    this.draw3DGrid(ctx, cx, cy, f, aspect, cosY, sinY, cosP, sinP);

    // 2. Project and Sort Targets by Depth (Painter's Algorithm)
    const projectedTargets = [];

    for (const t of this.targets) {
      // Rotate world to camera space
      // Yaw rotation (Y axis)
      const x1 = t.x * cosY - t.z * sinY;
      const z1 = t.x * sinY + t.z * cosY;

      // Pitch rotation (X axis)
      const y2 = t.y * cosP - z1 * sinP;
      const z2 = t.y * sinP + z1 * cosP;

      if (z2 > near) {
        // Perspective projection
        const projX = cx + (x1 / z2) * (f / aspect) * (w / 2);
        const projY = cy - (y2 / z2) * f * (h / 2);
        const projRadius = (t.radius / z2) * f * (h / 2);

        projectedTargets.push({
          x: projX,
          y: projY,
          r: projRadius,
          z: z2,
          pulse: t.pulse,
          target: t,
        });
      }
    }

    // Sort far to near
    projectedTargets.sort((a, b) => b.z - a.z);
    this.projectedTargets = projectedTargets;

    // Render Targets
    for (const pt of projectedTargets) {
      if (pt.r > 2) {
        this.renderTargetDisc(ctx, pt.x, pt.y, pt.r, pt.pulse);
      }
    }

    // 3. Draw FPS Crosshair
    this.renderCrosshair(ctx, cx, cy);

    // 4. Hit Flash Overlay
    if (this.crosshairHit && this.hitTimer > 0) {
      this.hitTimer--;
      ctx.fillStyle = 'rgba(0, 255, 157, 0.08)';
      ctx.fillRect(0, 0, w, h);
    }
  }

  draw3DGrid(ctx, cx, cy, f, aspect, cosY, sinY, cosP, sinP) {
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.lineWidth = 1;

    // Floor & Wall Grid Points
    const project = (wx, wy, wz) => {
      const x1 = wx * cosY - wz * sinY;
      const z1 = wx * sinY + wz * cosY;
      const y2 = wy * cosP - z1 * sinP;
      const z2 = wy * sinP + z1 * cosP;
      if (z2 <= 0.1) return null;
      return {
        x: cx + (x1 / z2) * (f / aspect) * (this.width / 2),
        y: cy - (y2 / z2) * f * (this.height / 2),
      };
    };

    // Draw Back Grid Wall (Z = 12m)
    for (let x = -8; x <= 8; x += 2) {
      const p1 = project(x, -5, 12);
      const p2 = project(x, 5, 12);
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    for (let y = -5; y <= 5; y += 2) {
      const p1 = project(-8, y, 12);
      const p2 = project(8, y, 12);
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  }

  renderTargetDisc(ctx, x, y, r, pulse) {
    const pulseR = r + Math.sin(pulse) * (r * 0.08);

    // Target Glow Ring
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = Math.max(1.5, r * 0.1);
    ctx.beginPath();
    ctx.arc(x, y, pulseR, 0, Math.PI * 2);
    ctx.stroke();

    // Target Outer Body (Cyan Gradient)
    const grad = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, '#00f0ff');
    grad.addColorStop(0.7, '#0078d7');
    grad.addColorStop(1, '#0c1a2d');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Red Center Bullseye
    ctx.fillStyle = '#ff3366';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  renderCrosshair(ctx, cx, cy) {
    const isHit = this.crosshairHit && this.hitTimer > 0;
    const color = isHit ? '#00ff9d' : (this.isAds ? '#00f0ff' : 'rgba(255, 255, 255, 0.85)');
    const size = this.isAds ? 8 : 12;
    const gap = this.isAds ? 4 : 6;

    ctx.strokeStyle = color;
    ctx.lineWidth = isHit ? 2.5 : 1.8;
    ctx.shadowColor = color;
    ctx.shadowBlur = isHit ? 10 : 4;

    // Top
    ctx.beginPath();
    ctx.moveTo(cx, cy - gap);
    ctx.lineTo(cx, cy - gap - size);
    ctx.stroke();

    // Bottom
    ctx.beginPath();
    ctx.moveTo(cx, cy + gap);
    ctx.lineTo(cx, cy + gap + size);
    ctx.stroke();

    // Left
    ctx.beginPath();
    ctx.moveTo(cx - gap, cy);
    ctx.lineTo(cx - gap - size, cy);
    ctx.stroke();

    // Right
    ctx.beginPath();
    ctx.moveTo(cx + gap, cy);
    ctx.lineTo(cx + gap + size, cy);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
  }

  drawStartScreen() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.fillStyle = '#070a0f';
    ctx.fillRect(0, 0, w, h);

    // Futuristic Frame
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.strokeRect(20, 20, w - 40, h - 40);

    ctx.fillStyle = '#00f0ff';
    ctx.font = '700 28px "Rajdhani", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎯 3D AIM TRAINER & GAMEPAD SHOOTING RANGE', w / 2, h / 2 - 40);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 15px "Outfit", sans-serif';
    ctx.fillText('Teste a calibração de sensibilidade, anti-deadzone e curvas de resposta do controle.', w / 2, h / 2 + 5);

    ctx.fillStyle = '#00ff9d';
    ctx.font = '600 16px "JetBrains Mono", monospace';
    ctx.fillText('▶ Clique no botão "Iniciar Treino" ou clique na tela para começar', w / 2, h / 2 + 50);

    ctx.fillStyle = '#64748b';
    ctx.font = '13px "Outfit", sans-serif';
    ctx.fillText('Controles: Analógico Direito (Mira) / Mouse | Gatilho RT / Clique Esquerdo (Atirar) | LT (Mirar ADS)', w / 2, h - 40);
  }

  drawGameOverScreen() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const accuracy = this.shots > 0 ? Math.round((this.hits / this.shots) * 100) : 0;

    ctx.fillStyle = 'rgba(7, 10, 15, 0.9)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#00ff9d';
    ctx.font = '700 32px "Rajdhani", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏆 TREINO FINALIZADO!', w / 2, h / 2 - 60);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 20px "JetBrains Mono", monospace';
    ctx.fillText(`Pontuação Final: ${this.score}`, w / 2, h / 2 - 15);

    ctx.fillStyle = '#00f0ff';
    ctx.font = '600 16px "Outfit", sans-serif';
    ctx.fillText(`Precisão: ${accuracy}% | Alvos Atingidos: ${this.hits} de ${this.shots} disparos`, w / 2, h / 2 + 25);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px "Outfit", sans-serif';
    ctx.fillText('Clique em "Iniciar Treino" para tentar novamente', w / 2, h / 2 + 70);
  }
}
