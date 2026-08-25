/**
 * GamepadEmulation Pro - Main Frontend Application Logic
 */

import { XboxControllerRenderer } from './controller.js';
import { AimCurveRenderer } from './curve_editor.js';
import { AimTrainerRange } from './aim_trainer.js';

class GamepadApp {
  constructor() {
    this.settings = {
      dispatcher: {
        toggle_key: 'Grave',
        excluded_keys: ['X', 'J', 'L', 'Z', 'LeftAlt', 'LeftShift', 'Tab'],
      },
      aiming: {
        sensitivity: 1.0,
        alt_sensitivity: 3.0,
        ads_multiplier: 0.75,
        yaw_multiplier: 1.0,
        pitch_multiplier: 1.0,
        invert_pitch: false,
        anti_deadzone: 0.10,
        curve_exponent: 1.0,
        mouse_smoothing_level: 5,
      },
      controls: {
        alt_sensitivity_key: 'X',
        ads_button: 'Right',
        movement: {
          forward: 'W',
          backward: 'S',
          left: 'A',
          right: 'D',
        },
      },
      tick_rate_hz: 250,
      binds: {
        'Keyboard(Space)': 'Button(A)',
        'Keyboard(C)': 'Button(B)',
        'Keyboard(R)': 'Button(X)',
        'Keyboard(E)': 'Button(Y)',
        'Keyboard(LeftShift)': 'Button(LeftThumb)',
        'Keyboard(V)': 'Button(RightThumb)',
        'Keyboard(Q)': 'Button(LeftShoulder)',
        'Keyboard(F)': 'Button(RightShoulder)',
        'Mouse(Left)': 'Button(RightTrigger)',
        'Mouse(Right)': 'Button(LeftTrigger)',
      },
    };

    this.profiles = [
      {
        id: 'cod_warzone',
        name: 'Call of Duty: Warzone & BO6',
        desc: 'Sensibilidade de precisão com anti-deadzone agressivo e ADS reduzido para mira de longa distância.',
        settings: {
          ...this.settings,
          aiming: {
            ...this.settings.aiming,
            sensitivity: 1.15,
            alt_sensitivity: 3.5,
            ads_multiplier: 0.65,
            anti_deadzone: 0.12,
            curve_exponent: 1.1,
            mouse_smoothing_level: 4,
          },
        },
      },
      {
        id: 'apex_legends',
        name: 'Apex Legends',
        desc: 'Sensibilidade balanceada com curva dinâmica para rastreamento suave de alvos rápidos.',
        settings: {
          ...this.settings,
          aiming: {
            ...this.settings.aiming,
            sensitivity: 1.3,
            alt_sensitivity: 4.0,
            ads_multiplier: 0.8,
            anti_deadzone: 0.08,
            curve_exponent: 1.25,
            mouse_smoothing_level: 5,
          },
        },
      },
      {
        id: 'halo_infinite',
        name: 'Halo Infinite',
        desc: 'Curva linear estrita com anti-deadzone médio para maximizar o magnetismo da mira do controle.',
        settings: {
          ...this.settings,
          aiming: {
            ...this.settings.aiming,
            sensitivity: 1.0,
            alt_sensitivity: 2.5,
            ads_multiplier: 0.85,
            anti_deadzone: 0.06,
            curve_exponent: 1.0,
            mouse_smoothing_level: 6,
          },
        },
      },
      {
        id: 'fortnite',
        name: 'Fortnite & Outros',
        desc: 'Sensibilidade alta para giros rápidos de construção e modo alternativo para paraquedas.',
        settings: {
          ...this.settings,
          aiming: {
            ...this.settings.aiming,
            sensitivity: 1.5,
            alt_sensitivity: 5.0,
            ads_multiplier: 0.7,
            anti_deadzone: 0.10,
            curve_exponent: 1.3,
            mouse_smoothing_level: 4,
          },
        },
      },
    ];

    this.activeProfileId = 'cod_warzone';
    this.isEmulationActive = true;
    this.isAdsActive = false;
    this.isAltActive = false;
    this.activeModalCallback = null;

    this.init();
  }

  init() {
    this.controller = new XboxControllerRenderer('controller-stage');
    this.curveEditor = new AimCurveRenderer('curve-canvas');
    this.aimTrainer = new AimTrainerRange('aim-trainer-canvas');

    this.bindTabs();
    this.bindSliders();
    this.bindButtons();
    this.bindKeyListeners();
    this.renderBindsTable();
    this.renderProfiles();
    this.syncUiWithSettings();

    // Start live input monitor and animation loop
    this.startInputLoop();
  }

  bindTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));

        tab.classList.add('active');
        const target = tab.dataset.tab;
        const targetPane = document.getElementById(target);
        if (targetPane) {
          targetPane.classList.add('active');
        }

        // Redraw Aim Trainer when entering its tab
        if (target === 'tab-aim-trainer') {
          setTimeout(() => {
            this.aimTrainer.initCanvas();
            if (!this.aimTrainer.isRunning) {
              this.aimTrainer.drawStartScreen();
            }
          }, 50);
        }

        // Redraw curve canvas when entering aiming tab
        if (target === 'tab-aiming') {
          setTimeout(() => {
            this.curveEditor.initCanvasDpi();
            this.curveEditor.draw();
          }, 50);
        }
      });
    });
  }

  bindSliders() {
    // Quick tweak sliders
    this.connectSlider('quick-sens', 'quick-sens-val', (v) => {
      this.settings.aiming.sensitivity = parseFloat(v);
      this.syncInputs('aim-sens', v);
      this.updateCurve();
    }, (v) => parseFloat(v).toFixed(2));

    this.connectSlider('quick-ads', 'quick-ads-val', (v) => {
      this.settings.aiming.ads_multiplier = parseFloat(v);
      this.syncInputs('aim-ads', v);
      this.updateCurve();
    }, (v) => `${parseFloat(v).toFixed(2)}x`);

    this.connectSlider('quick-deadzone', 'quick-deadzone-val', (v) => {
      this.settings.aiming.anti_deadzone = parseFloat(v);
      this.syncInputs('aim-deadzone', v);
      this.updateCurve();
    }, (v) => `${Math.round(parseFloat(v) * 100)}%`);

    this.connectSlider('quick-alt-sens', 'quick-alt-sens-val', (v) => {
      this.settings.aiming.alt_sensitivity = parseFloat(v);
      this.syncInputs('aim-alt-sens', v);
      this.updateCurve();
    }, (v) => parseFloat(v).toFixed(2));

    // Detailed aiming sliders
    this.connectSlider('aim-sens', 'aim-sens-val', (v) => {
      this.settings.aiming.sensitivity = parseFloat(v);
      this.syncInputs('quick-sens', v);
      this.syncInputs('trainer-sens', v);
      this.updateCurve();
    }, (v) => parseFloat(v).toFixed(2));

    this.connectSlider('trainer-sens', 'trainer-sens-val', (v) => {
      this.settings.aiming.sensitivity = parseFloat(v);
      this.syncInputs('quick-sens', v);
      this.syncInputs('aim-sens', v);
      this.updateCurve();
    }, (v) => parseFloat(v).toFixed(2));

    this.connectSlider('trainer-deadzone', 'trainer-deadzone-val', (v) => {
      this.settings.aiming.anti_deadzone = parseFloat(v);
      this.syncInputs('quick-deadzone', v);
      this.syncInputs('aim-deadzone', v);
      this.updateCurve();
    }, (v) => `${Math.round(parseFloat(v) * 100)}%`);

    this.connectSlider('aim-alt-sens', 'aim-alt-sens-val', (v) => {
      this.settings.aiming.alt_sensitivity = parseFloat(v);
      this.syncInputs('quick-alt-sens', v);
      this.updateCurve();
    }, (v) => parseFloat(v).toFixed(2));

    this.connectSlider('aim-ads', 'aim-ads-val', (v) => {
      this.settings.aiming.ads_multiplier = parseFloat(v);
      this.syncInputs('quick-ads', v);
      this.updateCurve();
    }, (v) => `${parseFloat(v).toFixed(2)}x`);

    this.connectSlider('aim-curve', 'aim-curve-val', (v) => {
      this.settings.aiming.curve_exponent = parseFloat(v);
      this.updateCurve();
    }, (v) => parseFloat(v).toFixed(2));

    this.connectSlider('aim-deadzone', 'aim-deadzone-val', (v) => {
      this.settings.aiming.anti_deadzone = parseFloat(v);
      this.syncInputs('quick-deadzone', v);
      this.updateCurve();
    }, (v) => parseFloat(v).toFixed(2));

    this.connectSlider('aim-smoothing', 'aim-smoothing-val', (v) => {
      this.settings.aiming.mouse_smoothing_level = parseInt(v);
    }, (v) => `${v}ms`);

    this.connectSlider('aim-yaw', 'aim-yaw-val', (v) => {
      this.settings.aiming.yaw_multiplier = parseFloat(v);
    }, (v) => `${parseFloat(v).toFixed(2)}x`);

    this.connectSlider('aim-pitch', 'aim-pitch-val', (v) => {
      this.settings.aiming.pitch_multiplier = parseFloat(v);
    }, (v) => `${parseFloat(v).toFixed(2)}x`);

    // Invert Pitch & Yaw Checkboxes
    const invertPitchCheckbox = document.getElementById('aim-invert-pitch');
    const trainerInvertPitch = document.getElementById('trainer-invert-pitch');
    const trainerInvertYaw = document.getElementById('trainer-invert-yaw');

    const setInvertPitch = (val) => {
      this.settings.aiming.invert_pitch = val;
      if (invertPitchCheckbox) invertPitchCheckbox.checked = val;
      if (trainerInvertPitch) trainerInvertPitch.checked = val;
      if (this.aimTrainer) this.aimTrainer.invertPitch = val;
    };

    if (invertPitchCheckbox) {
      invertPitchCheckbox.addEventListener('change', (e) => setInvertPitch(e.target.checked));
    }
    if (trainerInvertPitch) {
      trainerInvertPitch.addEventListener('change', (e) => setInvertPitch(e.target.checked));
    }
    if (trainerInvertYaw) {
      trainerInvertYaw.addEventListener('change', (e) => {
        if (this.aimTrainer) this.aimTrainer.invertYaw = e.target.checked;
      });
    }

    // Tick Rate selector
    const tickRateSelect = document.getElementById('set-tick-rate');
    if (tickRateSelect) {
      tickRateSelect.addEventListener('change', (e) => {
        this.settings.tick_rate_hz = parseInt(e.target.value);
        const ms = (1000 / this.settings.tick_rate_hz).toFixed(1);
        document.getElementById('telemetry-tickrate').textContent = `${this.settings.tick_rate_hz}Hz (${ms}ms)`;
      });
    }

    // Curve presets buttons
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const curveVal = parseFloat(btn.dataset.curve);
        this.settings.aiming.curve_exponent = curveVal;
        this.syncInputs('aim-curve', curveVal);
        document.getElementById('aim-curve-val').textContent = curveVal.toFixed(2);
        this.updateCurve();
      });
    });
  }

  connectSlider(sliderId, labelId, onInput, formatFn) {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(labelId);
    if (!slider || !label) return;

    slider.addEventListener('input', (e) => {
      const val = e.target.value;
      label.textContent = formatFn ? formatFn(val) : val;
      onInput(val);
    });
  }

  syncInputs(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
    const label = document.getElementById(`${id}-val`);
    if (label) {
      if (id.includes('ads')) label.textContent = `${parseFloat(val).toFixed(2)}x`;
      else if (id.includes('deadzone')) label.textContent = `${Math.round(parseFloat(val) * 100)}%`;
      else label.textContent = parseFloat(val).toFixed(2);
    }
  }

  updateCurve() {
    this.curveEditor.updateParams({
      sensitivity: this.settings.aiming.sensitivity,
      adsMultiplier: this.settings.aiming.ads_multiplier,
      altSensitivity: this.settings.aiming.alt_sensitivity,
      antiDeadzone: this.settings.aiming.anti_deadzone,
      curveExponent: this.settings.aiming.curve_exponent,
    });
  }

  bindButtons() {
    // Master Emulation Toggle Switch
    const masterBtn = document.getElementById('btn-master-toggle');
    if (masterBtn) {
      masterBtn.addEventListener('click', () => {
        this.toggleEmulation();
      });
    }

    // Save buttons
    const saveHandler = async () => {
      const saved = await this.saveRonConfig();
      this.showToast(saved
        ? 'Configurações aplicadas e salvas em Settings.ron! 🚀'
        : 'Não foi possível aplicar as configurações.');
    };

    document.getElementById('btn-quick-save')?.addEventListener('click', saveHandler);
    document.getElementById('btn-save-aiming')?.addEventListener('click', saveHandler);
    document.getElementById('btn-save-binds')?.addEventListener('click', saveHandler);
    document.getElementById('btn-save-general')?.addEventListener('click', saveHandler);

    // Reset default
    document.getElementById('btn-quick-reset')?.addEventListener('click', () => {
      if (confirm('Deseja restaurar todas as configurações para o padrão original?')) {
        this.resetToDefaults();
        this.showToast('Restaurado para as configurações padrão.');
      }
    });

    // Add bind
    document.getElementById('btn-add-bind')?.addEventListener('click', () => {
      this.openKeyModal((detectedInput) => {
        this.settings.binds[detectedInput] = 'Button(A)';
        this.renderBindsTable();
      });
    });

    // Export RON
    document.getElementById('btn-export-ron')?.addEventListener('click', () => {
      this.exportRonFile();
    });

    // Modal cancel
    document.getElementById('btn-cancel-modal')?.addEventListener('click', () => {
      this.closeKeyModal();
    });
  }

  toggleEmulation() {
    this.isEmulationActive = !this.isEmulationActive;
    const btn = document.getElementById('btn-master-toggle');
    const stateText = document.getElementById('master-state-text');
    const bottomText = document.getElementById('bottom-status-text');

    if (this.isEmulationActive) {
      btn.classList.remove('inactive');
      btn.classList.add('active');
      stateText.textContent = 'EMULAÇÃO ONLINE';
      bottomText.textContent = 'Pronto para jogar. Emulação operacional (Interceptação ativa).';
    } else {
      btn.classList.remove('active');
      btn.classList.add('inactive');
      stateText.textContent = 'PASS-THROUGH (STANDBY)';
      bottomText.textContent = 'Emulação desativada. Teclado e mouse operando em modo normal no Windows.';
    }
  }

  bindKeyListeners() {
    // Movement WASD keys
    ['forward', 'backward', 'left', 'right'].forEach((dir) => {
      const btn = document.getElementById(`bind-mov-${dir}`);
      if (btn) {
        btn.addEventListener('click', () => {
          this.openKeyModal((keyName) => {
            const cleanKey = keyName.replace('Keyboard(', '').replace(')', '');
            this.settings.controls.movement[dir] = cleanKey;
            btn.textContent = cleanKey;
          });
        });
      }
    });

    // Alt sensitivity key
    const altBtn = document.getElementById('bind-alt-key');
    if (altBtn) {
      altBtn.addEventListener('click', () => {
        this.openKeyModal((keyName) => {
          const cleanKey = keyName.replace('Keyboard(', '').replace(')', '');
          this.settings.controls.alt_sensitivity_key = cleanKey;
          altBtn.textContent = cleanKey;
        });
      });
    }

    // Toggle master key
    const toggleKeyBtn = document.getElementById('btn-toggle-key-select');
    if (toggleKeyBtn) {
      toggleKeyBtn.addEventListener('click', () => {
        this.openKeyModal((keyName) => {
          const cleanKey = keyName.replace('Keyboard(', '').replace(')', '');
          this.settings.dispatcher.toggle_key = cleanKey;
          toggleKeyBtn.textContent = `${cleanKey}`;
          document.getElementById('toggle-key-display').textContent = `${cleanKey}`;
        });
      });
    }

    // ADS button selector
    const adsSelect = document.getElementById('bind-ads-button');
    if (adsSelect) {
      adsSelect.addEventListener('change', (e) => {
        this.settings.controls.ads_button = e.target.value;
      });
    }
  }

  openKeyModal(callback) {
    this.activeModalCallback = callback;
    const modal = document.getElementById('key-modal');
    const preview = document.getElementById('modal-detected-key');
    preview.textContent = 'Pressione qualquer tecla ou botão...';
    modal.classList.remove('hidden');

    const keyHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();

      let detected = `Keyboard(${e.code.replace('Key', '')})`;
      if (e.code === 'Space') detected = 'Keyboard(Space)';
      if (e.code === 'ShiftLeft') detected = 'Keyboard(LeftShift)';
      if (e.code === 'ControlLeft') detected = 'Keyboard(LeftControl)';
      if (e.code === 'AltLeft') detected = 'Keyboard(LeftAlt)';
      if (e.code === 'Backquote') detected = 'Keyboard(Grave)';

      preview.textContent = detected;
      window.removeEventListener('keydown', keyHandler);
      window.removeEventListener('mousedown', mouseHandler);

      setTimeout(() => {
        this.closeKeyModal();
        if (this.activeModalCallback) {
          this.activeModalCallback(detected);
        }
      }, 300);
    };

    const mouseHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();

      let detected = 'Mouse(Left)';
      if (e.button === 0) detected = 'Mouse(Left)';
      else if (e.button === 1) detected = 'Mouse(Middle)';
      else if (e.button === 2) detected = 'Mouse(Right)';
      else if (e.button === 3) detected = 'Mouse(Button4)';
      else if (e.button === 4) detected = 'Mouse(Button5)';

      preview.textContent = detected;
      window.removeEventListener('keydown', keyHandler);
      window.removeEventListener('mousedown', mouseHandler);

      setTimeout(() => {
        this.closeKeyModal();
        if (this.activeModalCallback) {
          this.activeModalCallback(detected);
        }
      }, 300);
    };

    window.addEventListener('keydown', keyHandler, { once: true });
    window.addEventListener('mousedown', mouseHandler, { once: true });
  }

  closeKeyModal() {
    const modal = document.getElementById('key-modal');
    modal.classList.add('hidden');
    this.activeModalCallback = null;
  }

  renderBindsTable() {
    const tbody = document.getElementById('binds-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const actionsList = [
      'Button(A)',
      'Button(B)',
      'Button(X)',
      'Button(Y)',
      'Button(LeftShoulder)',
      'Button(RightShoulder)',
      'Button(LeftTrigger)',
      'Button(RightTrigger)',
      'Button(LeftThumb)',
      'Button(RightThumb)',
      'Button(Back)',
      'Button(Start)',
      'Button(DPadUp)',
      'Button(DPadDown)',
      'Button(DPadLeft)',
      'Button(DPadRight)',
    ];

    Object.entries(this.settings.binds).forEach(([inputKey, actionVal]) => {
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>
          <span class="key-tag" title="Clique para remapear">${inputKey}</span>
        </td>
        <td>
          <select class="gamer-select action-select">
            ${actionsList
              .map(
                (act) =>
                  `<option value="${act}" ${act === actionVal ? 'selected' : ''}>${act.replace('Button(', '').replace(')', '')}</option>`
              )
              .join('')}
          </select>
        </td>
        <td>
          <button class="btn-icon-delete" title="Remover mapeamento">🗑️</button>
        </td>
      `;

      // Change action
      tr.querySelector('.action-select').addEventListener('change', (e) => {
        this.settings.binds[inputKey] = e.target.value;
      });

      // Change input key
      tr.querySelector('.key-tag').addEventListener('click', () => {
        this.openKeyModal((newInput) => {
          const currentAction = this.settings.binds[inputKey];
          delete this.settings.binds[inputKey];
          this.settings.binds[newInput] = currentAction;
          this.renderBindsTable();
        });
      });

      // Delete
      tr.querySelector('.btn-icon-delete').addEventListener('click', () => {
        delete this.settings.binds[inputKey];
        this.renderBindsTable();
      });

      tbody.appendChild(tr);
    });
  }

  renderProfiles() {
    const grid = document.getElementById('profiles-grid');
    if (!grid) return;
    grid.innerHTML = '';

    this.profiles.forEach((profile) => {
      const card = document.createElement('div');
      card.className = `profile-card-item ${profile.id === this.activeProfileId ? 'active' : ''}`;
      card.innerHTML = `
        <div class="profile-card-title">${profile.name}</div>
        <div class="profile-card-desc">${profile.desc}</div>
      `;

      card.addEventListener('click', () => {
        this.loadProfile(profile.id);
      });

      grid.appendChild(card);
    });
  }

  loadProfile(profileId) {
    const found = this.profiles.find((p) => p.id === profileId);
    if (!found) return;

    this.activeProfileId = profileId;
    this.settings = JSON.parse(JSON.stringify(found.settings));
    this.renderProfiles();
    this.syncUiWithSettings();

    document.getElementById('selected-profile-name').textContent = `Perfil: ${found.name}`;
    document.getElementById('profile-sens-display').textContent = `${this.settings.aiming.sensitivity.toFixed(2)} (ADS: ${this.settings.aiming.ads_multiplier.toFixed(2)}x)`;
    document.getElementById('profile-deadzone-display').textContent = `${Math.round(this.settings.aiming.anti_deadzone * 100)}%`;

    this.showToast(`Perfil "${found.name}" carregado! 🎮`);
    this.saveRonConfig();
  }

  syncUiWithSettings() {
    const a = this.settings.aiming;
    const c = this.settings.controls;

    // Sliders
    this.syncInputs('quick-sens', a.sensitivity);
    this.syncInputs('aim-sens', a.sensitivity);
    this.syncInputs('quick-ads', a.ads_multiplier);
    this.syncInputs('aim-ads', a.ads_multiplier);
    this.syncInputs('quick-deadzone', a.anti_deadzone);
    this.syncInputs('aim-deadzone', a.anti_deadzone);
    this.syncInputs('quick-alt-sens', a.alt_sensitivity);
    this.syncInputs('aim-alt-sens', a.alt_sensitivity);
    this.syncInputs('aim-curve', a.curve_exponent);
    this.syncInputs('aim-smoothing', a.mouse_smoothing_level);
    this.syncInputs('aim-yaw', a.yaw_multiplier);
    this.syncInputs('aim-pitch', a.pitch_multiplier);

    // Invert Pitch
    const invertCb = document.getElementById('aim-invert-pitch');
    if (invertCb) invertCb.checked = a.invert_pitch;
    const trainerInvertCb = document.getElementById('trainer-invert-pitch');
    if (trainerInvertCb) trainerInvertCb.checked = a.invert_pitch;
    if (this.aimTrainer) this.aimTrainer.invertPitch = a.invert_pitch;

    // Movement WASD
    if (c.movement) {
      document.getElementById('bind-mov-forward').textContent = c.movement.forward || 'W';
      document.getElementById('bind-mov-backward').textContent = c.movement.backward || 'S';
      document.getElementById('bind-mov-left').textContent = c.movement.left || 'A';
      document.getElementById('bind-mov-right').textContent = c.movement.right || 'D';
    }

    if (c.alt_sensitivity_key) {
      document.getElementById('bind-alt-key').textContent = c.alt_sensitivity_key;
    }

    if (c.ads_button) {
      const adsSelect = document.getElementById('bind-ads-button');
      if (adsSelect) adsSelect.value = c.ads_button;
    }

    // Tick Rate
    const tickSelect = document.getElementById('set-tick-rate');
    if (tickSelect) tickSelect.value = this.settings.tick_rate_hz || 250;

    // Dispatcher keys
    document.getElementById('toggle-key-display').textContent = this.settings.dispatcher.toggle_key || 'Grave';
    document.getElementById('btn-toggle-key-select').textContent = this.settings.dispatcher.toggle_key || 'Grave';

    this.updateCurve();
    this.renderBindsTable();
  }

  generateRonString() {
    const s = this.settings;
    const bindsEntries = Object.entries(s.binds)
      .map(([k, v]) => `        ${k}: ${v},`)
      .join('\n');

    const excludedList = s.dispatcher.excluded_keys.join(', ');

    return `// ====================================================================
// GamepadEmulation Configuration (Xbox 360 Controller Remapper)
// ====================================================================
(
    dispatcher: (
        toggle_key: ${s.dispatcher.toggle_key},
        excluded_keys: [
            ${excludedList}
        ],
    ),
    aiming: (
        sensitivity: ${s.aiming.sensitivity.toFixed(2)},
        alt_sensitivity: ${s.aiming.alt_sensitivity.toFixed(2)},
        ads_multiplier: ${s.aiming.ads_multiplier.toFixed(2)},
        yaw_multiplier: ${s.aiming.yaw_multiplier.toFixed(2)},
        pitch_multiplier: ${s.aiming.pitch_multiplier.toFixed(2)},
        invert_pitch: ${s.aiming.invert_pitch},
        anti_deadzone: ${s.aiming.anti_deadzone.toFixed(2)},
        curve_exponent: ${s.aiming.curve_exponent.toFixed(2)},
        mouse_smoothing_level: ${s.aiming.mouse_smoothing_level},
    ),
    controls: (
        alt_sensitivity_key: Some(${s.controls.alt_sensitivity_key}),
        ads_button: Some(${s.controls.ads_button}),
        movement: (
            forward: ${s.controls.movement.forward},
            backward: ${s.controls.movement.backward},
            left: ${s.controls.movement.left},
            right: ${s.controls.movement.right},
        ),
    ),
    tick_rate_hz: ${s.tick_rate_hz},
    binds: {
${bindsEntries}
    },
)
`;
  }

  async saveRonConfig() {
    const ronText = this.generateRonString();
    // If running inside Tauri, invoke Tauri command:
    if (window.__TAURI__) {
      await window.__TAURI__.core.invoke('save_config_file', { content: ronText });
      return true;
    } else {
      try {
        const response = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          body: ronText,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        localStorage.setItem('gamepad_settings_ron', ronText);
        return true;
      } catch (error) {
        console.error('Falha ao aplicar Settings.ron:', error);
        return false;
      }
    }
  }

  exportRonFile() {
    const ronText = this.generateRonString();
    const blob = new Blob([ronText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Settings.ron';
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Arquivo Settings.ron exportado! 📥');
  }

  resetToDefaults() {
    this.settings = {
      dispatcher: {
        toggle_key: 'Grave',
        excluded_keys: ['X', 'J', 'L', 'Z', 'LeftAlt', 'LeftShift', 'Tab'],
      },
      aiming: {
        sensitivity: 1.0,
        alt_sensitivity: 3.0,
        ads_multiplier: 0.75,
        yaw_multiplier: 1.0,
        pitch_multiplier: 1.0,
        invert_pitch: false,
        anti_deadzone: 0.10,
        curve_exponent: 1.0,
        mouse_smoothing_level: 5,
      },
      controls: {
        alt_sensitivity_key: 'X',
        ads_button: 'Right',
        movement: {
          forward: 'W',
          backward: 'S',
          left: 'A',
          right: 'D',
        },
      },
      tick_rate_hz: 250,
      binds: {
        'Keyboard(Space)': 'Button(A)',
        'Keyboard(C)': 'Button(B)',
        'Keyboard(R)': 'Button(X)',
        'Keyboard(E)': 'Button(Y)',
        'Keyboard(LeftShift)': 'Button(LeftThumb)',
        'Keyboard(V)': 'Button(RightThumb)',
        'Keyboard(Q)': 'Button(LeftShoulder)',
        'Keyboard(F)': 'Button(RightShoulder)',
        'Mouse(Left)': 'Button(RightTrigger)',
        'Mouse(Right)': 'Button(LeftTrigger)',
      },
    };
    this.syncUiWithSettings();
  }

  showToast(message) {
    const bottomText = document.getElementById('bottom-status-text');
    if (bottomText) {
      const original = bottomText.textContent;
      bottomText.textContent = `✨ ${message}`;
      setTimeout(() => {
        bottomText.textContent = original;
      }, 3500);
    }
  }

  // Real-time Gamepad API loop reading directly from Windows ViGEm / XInput (HardwareTester style)
  startInputLoop() {
    let lastInText = '';
    let lastOutText = '';
    let isGamepadActive = false;

    const liveInEl = document.getElementById('live-mouse-in');
    const liveOutEl = document.getElementById('live-stick-out');
    const aimingTab = document.getElementById('tab-aiming');
    const bottomStatus = document.getElementById('bottom-status-text');
    const vigemStatusPill = document.getElementById('status-vigem');

    // Backend telemetry is sampled at 20Hz; it is the source of raw/pipeline values.
    setInterval(async () => {
      try {
        const response = await fetch('/api/aim/telemetry', { cache: 'no-store' });
        if (!response.ok) return;
        const telemetry = await response.json();
        const rawMagnitude = Math.hypot(telemetry.raw_dx || 0, telemetry.raw_dy || 0);
        const outputMagnitude = Math.min(1, Math.hypot(telemetry.final_rx || 0, telemetry.final_ry || 0) / 32767);
        this.curveEditor.setLivePoint(Math.min(25, rawMagnitude), outputMagnitude);
        if (liveInEl) liveInEl.textContent = rawMagnitude.toFixed(1);
        if (liveOutEl) liveOutEl.textContent = outputMagnitude.toFixed(2);
      } catch (_) {
        // The dashboard remains usable when the native backend is unavailable.
      }
    }, 50);

    // Listen to native Windows Gamepad events
    window.addEventListener('gamepadconnected', (e) => {
      console.log('🎮 Gamepad conectado:', e.gamepad.id);
      isGamepadActive = true;
      if (vigemStatusPill) {
        vigemStatusPill.innerHTML = `
          <span class="status-dot dot-green"></span>
          <span class="status-label">Controle:</span>
          <span class="status-val">${e.gamepad.id.includes('Xbox') ? 'Xbox 360 (ViGEm)' : e.gamepad.id.substring(0, 16)}</span>
        `;
      }
      if (bottomStatus) {
        bottomStatus.textContent = `Controle detectado: ${e.gamepad.id}. Pronto para emulação.`;
      }
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      console.log('❌ Gamepad desconectado:', e.gamepad.id);
      isGamepadActive = false;
      if (vigemStatusPill) {
        vigemStatusPill.innerHTML = `
          <span class="status-dot dot-red"></span>
          <span class="status-label">Controle:</span>
          <span class="status-val">DESCONECTADO</span>
        `;
      }
    });

    // Toggle emulation with Grave key
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') {
        this.toggleEmulation();
      }
    });

    // Main animation frame tick (Reading true OS hardware Gamepad state directly from Windows)
    const updateTick = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      let activeGamepad = null;

      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
          activeGamepad = gamepads[i];
          break;
        }
      }

      if (activeGamepad) {
        if (!isGamepadActive) {
          isGamepadActive = true;
          if (vigemStatusPill) {
            vigemStatusPill.innerHTML = `
              <span class="status-dot dot-green"></span>
              <span class="status-label">Controle:</span>
              <span class="status-val">Xbox 360 (ViGEm)</span>
            `;
          }
        }

        const gp = activeGamepad;
        // Standard Gamepad Mapping (XInput / Xbox 360 layout)
        const lxRaw = gp.axes[0] || 0;
        const lyRaw = gp.axes[1] || 0;
        const rxRaw = gp.axes[2] || 0;
        const ryRaw = gp.axes[3] || 0;

        const lx = Math.round(lxRaw * 32767);
        const ly = Math.round(-lyRaw * 32767);
        const rx = Math.round(rxRaw * 32767);
        const ry = Math.round(-ryRaw * 32767);

        const ltVal = gp.buttons[6] ? (gp.buttons[6].value !== undefined ? gp.buttons[6].value : (gp.buttons[6].pressed ? 1 : 0)) : 0;
        const rtVal = gp.buttons[7] ? (gp.buttons[7].value !== undefined ? gp.buttons[7].value : (gp.buttons[7].pressed ? 1 : 0)) : 0;

        const controllerState = {
          buttons: {
            A: gp.buttons[0]?.pressed || false,
            B: gp.buttons[1]?.pressed || false,
            X: gp.buttons[2]?.pressed || false,
            Y: gp.buttons[3]?.pressed || false,
            LB: gp.buttons[4]?.pressed || false,
            RB: gp.buttons[5]?.pressed || false,
            Back: gp.buttons[8]?.pressed || false,
            Start: gp.buttons[9]?.pressed || false,
            L3: gp.buttons[10]?.pressed || false,
            R3: gp.buttons[11]?.pressed || false,
            DPadUp: gp.buttons[12]?.pressed || false,
            DPadDown: gp.buttons[13]?.pressed || false,
            DPadLeft: gp.buttons[14]?.pressed || false,
            DPadRight: gp.buttons[15]?.pressed || false,
            Guide: gp.buttons[16]?.pressed || false,
          },
          triggers: {
            LT: Math.round(ltVal * 255),
            RT: Math.round(rtVal * 255),
          },
          sticks: {
            LX: lx,
            LY: ly,
            RX: rx,
            RY: ry,
          },
        };

        this.controller.updateState(controllerState);

        // Update Aim Trainer range with active gamepad sticks and triggers
        if (this.aimTrainer && this.aimTrainer.isRunning) {
          this.aimTrainer.updateInputsFromGamepad(controllerState.sticks, controllerState.triggers, controllerState.buttons);
        }

        // Draw the live point supplied by backend pipeline telemetry.
        if (aimingTab && aimingTab.classList.contains('active')) {
          this.curveEditor.draw();
        }
      } else {
        // No gamepad poll received yet (Browser waiting for initial interaction)
        if (isGamepadActive) {
          isGamepadActive = false;
        }
      }

      requestAnimationFrame(updateTick);
    };

    requestAnimationFrame(updateTick);
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new GamepadApp();
});
