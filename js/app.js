/**
 * Light Up (Akari) - Offline Game Application Controller
 */

class LightUpApp {
  constructor() {
    this.width = 7;
    this.height = 7;
    this.board = []; // 2D array: -1=white, -2=black(unnumbered), 0..4=black with clue
    this.task = '';
    this.puzzleTitle = '7x7 Easy';
    this.puzzleID = '';

    this.bulbs = new Set(); // Set of "r,c"
    this.crosses = new Set(); // Set of "r,c"
    this.lastChange = null; // { r, c }
    this.focusedCell = { r: 0, c: 0 };

    this.undoStack = [];
    this.redoStack = [];
    this.checkpoints = [];

    // Drag tracking
    this.isMouseDown = false;
    this.dragAction = null; // 'bulb' | 'cross' | 'erase'
    this.lastDragCell = null; // 'r,c'

    // Timer
    this.timerSeconds = 0;
    this.timerInterval = null;
    this.isPaused = false;
    this.isSolved = false;

    // Zoom & Multi-touch Pinch/Pan
    this.zoomScale = 1.0;
    this.isPinching = false;
    this.pinchStartDistance = null;
    this.pinchStartZoom = 1.0;
    this.pinchCurrentScaleRatio = 1.0;
    this.pinchLastMidX = 0;
    this.pinchLastMidY = 0;
    this.pinchRaf = null;

    // Single-finger / mouse panning
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.panStartScrollLeft = 0;
    this.panStartScrollTop = 0;
    this.isSpacePressed = false;

    // Touch Navigation & Kinetic Momentum (iPad standard behavior)
    this.touchStartTime = 0;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchTargetCell = null;
    this.isTouchPanning = false;
    this.touchVelocityX = 0;
    this.touchVelocityY = 0;
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    this.lastTouchTime = 0;
    this.momentumRaf = null;
    this.justHandledTouchTap = false;

    // Settings
    this.settings = {
      theme: 'light',
      blueLight: false,
      autoCross: false,
      grayCompleted: true,
      markErrors: true,
      showCoordinates: false,
      hideTimer: false,
      sound: true,
      highlightChange: true,
      precisionDrag: true,
      touchDragToPan: true,
      drawStyle: 'cycle' // 'bulb' | 'cross' | 'cycle' | 'erase' | 'pan'
    };

    // Current category & difficulty (restore last active)
    this.currentCat = localStorage.getItem('akari_last_cat') || '7x7';
    this.currentDiff = localStorage.getItem('akari_last_diff') || 'easy';

    this.loadSettings();
    this.initDOM();
    this.bindEvents();
    this.initConfetti();

    // Start with saved or initial puzzle
    this.loadCategoryPuzzle(this.currentCat, this.currentDiff, false);
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('akari_settings');
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
      if (this.settings.precisionDrag === undefined) {
        this.settings.precisionDrag = true;
      }
      if (this.settings.touchDragToPan === undefined) {
        this.settings.touchDragToPan = true;
      }
      // Ensure default drawStyle is cycle
      if (!localStorage.getItem('akari_cycle_default_set')) {
        this.settings.drawStyle = 'cycle';
        localStorage.setItem('akari_cycle_default_set', 'true');
        this.saveSettings();
      }
    } catch (e) {}

    window.soundEngine.enabled = this.settings.sound;
    this.applyTheme();
  }

  saveSettings() {
    try {
      localStorage.setItem('akari_settings', JSON.stringify(this.settings));
    } catch (e) {}
  }

  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.settings.theme);
    document.documentElement.setAttribute('data-blue-light', this.settings.blueLight ? 'true' : 'false');
  }

  initDOM() {
    this.boardEl = document.getElementById('puzzleBoard');
    this.boardViewport = document.getElementById('boardViewport');
    this.timerDisplay = document.getElementById('timerDisplay');
    this.puzzleTitleEl = document.getElementById('puzzleTitle');
    this.puzzleIdEl = document.getElementById('puzzleId');
    this.checkpointsListEl = document.getElementById('checkpointsList');
    this.hintToastEl = document.getElementById('hintToast');
    this.hintMessageEl = document.getElementById('hintMessage');
    this.pauseOverlay = document.getElementById('pauseOverlay');
    this.zoomSlider = document.getElementById('zoomSlider');
    this.zoomLevelLabel = document.getElementById('zoomLevelLabel');
    this.boardContainer = document.getElementById('boardContainer');

    if (window.innerWidth <= 1024) {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.add('collapsed');
    }

    this.updateToolButtons();
  }

  bindEvents() {
    // Top Controls
    document.getElementById('btnUndo').addEventListener('click', () => this.undo());
    document.getElementById('btnRedo').addEventListener('click', () => this.redo());
    document.getElementById('btnPause').addEventListener('click', () => this.togglePause());
    document.getElementById('btnResume').addEventListener('click', () => this.togglePause(false));
    document.getElementById('btnSaveCheckpoint').addEventListener('click', () => this.saveCheckpoint());
    document.getElementById('btnSettings').addEventListener('click', () => this.openModal('settingsModal'));
    document.getElementById('btnRules').addEventListener('click', () => this.openModal('rulesModal'));
    document.getElementById('btnLeaderboard').addEventListener('click', () => this.openLeaderboardModal());
    document.getElementById('btnSidebarToggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });

    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('collapsed');
      });
    }

    const btnSidebarSettings = document.getElementById('btnSidebarSettings');
    if (btnSidebarSettings) {
      btnSidebarSettings.addEventListener('click', () => {
        if (window.innerWidth <= 1024) {
          document.getElementById('sidebar').classList.add('collapsed');
        }
        this.openModal('settingsModal');
      });
    }

    const lbSelect = document.getElementById('leaderboardCategorySelect');
    if (lbSelect) {
      lbSelect.addEventListener('change', (e) => this.renderLeaderboardModal(e.target.value));
    }
    const btnClearLb = document.getElementById('btnClearCategoryLeaderboard');
    if (btnClearLb) {
      btnClearLb.addEventListener('click', () => {
        const cat = document.getElementById('leaderboardCategorySelect').value;
        this.clearCategoryLeaderboard(cat);
      });
    }

    // Auto-pause timer when user clicks out of the webpage / switches tabs
    window.addEventListener('blur', () => this.handleWindowBlur());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.handleWindowBlur();
    });

    // Action tools
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const style = btn.getAttribute('data-tool');
        if (style) {
          this.settings.drawStyle = style;
          this.updateToolButtons();
        }
      });
    });

    // Zoom slider
    if (this.zoomSlider) {
      this.zoomSlider.addEventListener('input', (e) => {
        this.setZoom(parseFloat(e.target.value));
      });
    }
    document.getElementById('btnZoomFit').addEventListener('click', () => this.fitBoard());

    // Ctrl / Cmd + Mousewheel to zoom in / out (regular wheel scrolls naturally)
    if (this.boardContainer) {
      this.boardContainer.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const step = e.deltaY < 0 ? 0.05 : -0.05;
          this.setZoom(Math.round((this.zoomScale + step) * 100) / 100);
        }
      }, { passive: false });
    }

    // Bottom action buttons
    document.getElementById('btnCheckDone').addEventListener('click', () => this.checkSolution(true));
    document.getElementById('btnHint').addEventListener('click', () => this.giveHint());
    document.getElementById('btnStartOver').addEventListener('click', () => this.startOver());
    document.getElementById('btnNewPuzzle').addEventListener('click', () => this.newRandomPuzzle(true));
    const btnSidebarGen = document.getElementById('btnSidebarGenerate');
    if (btnSidebarGen) {
      btnSidebarGen.addEventListener('click', () => {
        this.newRandomPuzzle(true);
        if (window.innerWidth <= 1024) {
          const sidebar = document.getElementById('sidebar');
          if (sidebar) sidebar.classList.add('collapsed');
        }
      });
    }
    document.getElementById('btnPrint').addEventListener('click', () => window.print());
    document.getElementById('btnShare').addEventListener('click', () => this.openShareModal());
    document.getElementById('btnImportExport').addEventListener('click', () => this.openImportModal());

    // Navigation items
    document.querySelectorAll('[data-cat]').forEach(el => {
      el.addEventListener('click', (e) => {
        const cat = el.getAttribute('data-cat');
        const diff = el.getAttribute('data-diff') || 'easy';
        this.loadCategoryPuzzle(cat, diff, false);
        if (window.innerWidth <= 1024) {
          document.getElementById('sidebar').classList.add('collapsed');
        }
      });
    });

    // Hint Toast Close
    document.getElementById('btnHintClose').addEventListener('click', () => {
      this.hintToastEl.classList.remove('show');
    });

    // Modal Close buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) modal.classList.remove('open');
      });
    });

    // Settings inputs
    this.bindSettingsInputs();

    // Global Mouse Events for drag and panning
    window.addEventListener('mouseup', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        if (document.body) document.body.classList.remove('is-panning');
      }
      if (this.isMouseDown && this.dragAction && this.settings.precisionDrag && e && e.clientX !== undefined) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const cell = el ? el.closest('.cell') : null;
        if (cell && cell.dataset.r !== undefined && cell.dataset.c !== undefined) {
          const r = parseInt(cell.dataset.r, 10);
          const c = parseInt(cell.dataset.c, 10);
          if (!isNaN(r) && !isNaN(c) && this.board[r] && this.board[r][c] === -1) {
            this.applyDragToCell(r, c);
          }
        }
      }
      this.isMouseDown = false;
      this.dragAction = null;
      this.lastDragCell = null;
    });

    this.boardEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    window.addEventListener('contextmenu', (e) => {
      if (e.target.closest('#puzzleBoard')) {
        e.preventDefault();
      }
    });

    // Mousedown on board container for panning (Pan tool, Spacebar, middle mouse, or clicking walls/margins)
    if (this.boardContainer) {
      this.boardContainer.addEventListener('mousedown', (e) => {
        if (this.isPaused || this.isSolved) return;
        const target = e.target;
        const cell = target ? target.closest('.cell') : null;
        let isWhiteCell = false;
        if (cell && cell.dataset.r !== undefined && cell.dataset.c !== undefined) {
          const r = parseInt(cell.dataset.r, 10);
          const c = parseInt(cell.dataset.c, 10);
          if (!isNaN(r) && !isNaN(c) && this.board[r] && this.board[r][c] === -1) {
            isWhiteCell = true;
          }
        }

        if (this.settings.drawStyle === 'pan' || this.isSpacePressed || e.button === 1 || !isWhiteCell) {
          if (e.button === 0 || e.button === 1) {
            e.preventDefault();
            this.isPanning = true;
            this.panStartX = e.clientX;
            this.panStartY = e.clientY;
            this.panStartScrollLeft = this.boardContainer.scrollLeft;
            this.panStartScrollTop = this.boardContainer.scrollTop;
            if (document.body) document.body.classList.add('is-panning');
          }
        }
      });
    }

    // Global mousemove for panning
    window.addEventListener('mousemove', (e) => {
      if (this.isPanning && this.boardContainer) {
        const dx = e.clientX - this.panStartX;
        const dy = e.clientY - this.panStartY;
        this.boardContainer.scrollLeft = this.panStartScrollLeft - dx;
        this.boardContainer.scrollTop = this.panStartScrollTop - dy;
      }
    });

    // Mousemove over board for continuous drag with precision hitbox
    this.boardEl.addEventListener('mousemove', (e) => {
      if (this.isPanning) return;
      if (!this.isMouseDown || !this.dragAction) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cell = el ? el.closest('.cell') : null;
      if (cell && cell.dataset.r !== undefined && cell.dataset.c !== undefined) {
        const r = parseInt(cell.dataset.r, 10);
        const c = parseInt(cell.dataset.c, 10);
        if (!isNaN(r) && !isNaN(c)) {
          this.handleDragMove(e.clientX, e.clientY, cell, r, c);
        }
      }
    });

    // Touch support: Natural iPad single-finger drag anywhere & GPU multi-touch pinch-to-zoom
    if (this.boardContainer) {
      this.boardContainer.addEventListener('touchstart', (e) => {
        // Cancel any momentum animation running
        if (this.momentumRaf) {
          cancelAnimationFrame(this.momentumRaf);
          this.momentumRaf = null;
        }

        if (e.touches && e.touches.length >= 2) {
          // Two fingers: initiates fluid multi-touch pinch & pan
          this.isPinching = true;
          this.isTouchPanning = false;
          this.touchTargetCell = null;
          this.isMouseDown = false;
          this.dragAction = null;
          this.lastDragCell = null;
          if (document.body) document.body.classList.remove('is-panning');

          const t1 = e.touches[0];
          const t2 = e.touches[1];
          this.pinchStartDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          this.pinchStartZoom = this.zoomScale;
          this.pinchScaleRatio = 1.0;
          this.pinchLastMidX = (t1.clientX + t2.clientX) / 2;
          this.pinchLastMidY = (t1.clientY + t2.clientY) / 2;
          return;
        }

        if (e.touches && e.touches.length === 1) {
          const touch = e.touches[0];
          this.touchStartTime = Date.now();
          this.touchStartX = touch.clientX;
          this.touchStartY = touch.clientY;
          this.lastTouchX = touch.clientX;
          this.lastTouchY = touch.clientY;
          this.lastTouchTime = this.touchStartTime;
          this.touchVelocityX = 0;
          this.touchVelocityY = 0;
          this.isTouchPanning = false;

          this.panStartScrollLeft = this.boardContainer.scrollLeft;
          this.panStartScrollTop = this.boardContainer.scrollTop;

          // Check if touch landed on a cell
          const el = document.elementFromPoint(touch.clientX, touch.clientY);
          const cell = el ? el.closest('.cell') : null;
          let cellData = null;
          if (cell && cell.dataset.r !== undefined && cell.dataset.c !== undefined) {
            const r = parseInt(cell.dataset.r, 10);
            const c = parseInt(cell.dataset.c, 10);
            if (!isNaN(r) && !isNaN(c) && this.board[r] && this.board[r][c] === -1) {
              cellData = { r, c };
            }
          }

          if (this.settings.touchDragToPan) {
            // Standard iPad behavior: any touch can pan if dragged; taps toggle cell
            this.touchTargetCell = cellData;
          } else {
            // Drag-to-draw fallback if user toggles off touchDragToPan
            if (this.settings.drawStyle === 'pan' || !cellData) {
              this.isPanning = true;
              this.panStartX = touch.clientX;
              this.panStartY = touch.clientY;
              if (document.body) document.body.classList.add('is-panning');
            }
          }
        }
      }, { passive: false });

      this.boardContainer.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches.length >= 2) {
          // Multi-touch pinch & pan active
          if (e.cancelable) e.preventDefault();
          this.isPinching = true;
          this.isTouchPanning = false;
          this.touchTargetCell = null;
          this.isMouseDown = false;
          this.dragAction = null;
          this.lastDragCell = null;

          const t1 = e.touches[0];
          const t2 = e.touches[1];
          const midX = (t1.clientX + t2.clientX) / 2;
          const midY = (t1.clientY + t2.clientY) / 2;

          // Two-finger Pan
          const dx = midX - this.pinchLastMidX;
          const dy = midY - this.pinchLastMidY;
          this.pinchLastMidX = midX;
          this.pinchLastMidY = midY;
          this.boardContainer.scrollLeft -= dx;
          this.boardContainer.scrollTop -= dy;

          // Two-finger GPU-accelerated smooth Pinch Zoom
          const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          if (this.pinchStartDistance && this.pinchStartDistance > 0) {
            this.pinchScaleRatio = dist / this.pinchStartDistance;
            if (!this.pinchRaf) {
              this.pinchRaf = requestAnimationFrame(() => {
                this.pinchRaf = null;
                if (this.isPinching && this.boardViewport) {
                  this.boardViewport.style.transform = `scale(${this.pinchScaleRatio})`;
                  this.boardViewport.style.transformOrigin = 'center center';
                  const previewZoom = Math.round(this.pinchStartZoom * this.pinchScaleRatio * 100);
                  if (this.zoomLevelLabel) {
                    this.zoomLevelLabel.textContent = `${previewZoom}%`;
                  }
                }
              });
            }
          }
          return;
        }

        // Single-finger touch handling
        if (e.touches && e.touches.length === 1) {
          const touch = e.touches[0];

          // Track velocity for kinetic momentum
          const now = Date.now();
          const dt = now - this.lastTouchTime;
          if (dt > 0 && dt < 100) {
            this.touchVelocityX = (touch.clientX - this.lastTouchX) / dt;
            this.touchVelocityY = (touch.clientY - this.lastTouchY) / dt;
          }
          this.lastTouchX = touch.clientX;
          this.lastTouchY = touch.clientY;
          this.lastTouchTime = now;

          if (this.settings.touchDragToPan) {
            const totalDist = Math.hypot(touch.clientX - this.touchStartX, touch.clientY - this.touchStartY);
            // Once finger moves > 7px, enter pan mode and cancel tap
            if (totalDist > 7 || this.isTouchPanning) {
              this.isTouchPanning = true;
              this.touchTargetCell = null;
              if (e.cancelable) e.preventDefault();

              const dx = touch.clientX - this.touchStartX;
              const dy = touch.clientY - this.touchStartY;
              this.boardContainer.scrollLeft = this.panStartScrollLeft - dx;
              this.boardContainer.scrollTop = this.panStartScrollTop - dy;
              return;
            }
            return;
          }

          // Fallback legacy drag (only when touchDragToPan is disabled)
          if (this.isPanning) {
            if (e.cancelable) e.preventDefault();
            const dx = touch.clientX - this.panStartX;
            const dy = touch.clientY - this.panStartY;
            this.boardContainer.scrollLeft = this.panStartScrollLeft - dx;
            this.boardContainer.scrollTop = this.panStartScrollTop - dy;
            return;
          }

          if (this.isPinching || this.settings.drawStyle === 'pan') return;

          if (!this.isMouseDown || !this.dragAction) return;
          const el = document.elementFromPoint(touch.clientX, touch.clientY);
          const cell = el ? el.closest('.cell') : null;
          if (cell && cell.dataset.r !== undefined && cell.dataset.c !== undefined) {
            const r = parseInt(cell.dataset.r, 10);
            const c = parseInt(cell.dataset.c, 10);
            if (!isNaN(r) && !isNaN(c)) {
              this.handleDragMove(touch.clientX, touch.clientY, cell, r, c);
            }
          }
        }
      }, { passive: false });
    }

    window.addEventListener('touchend', (e) => {
      if (this.isPinching) {
        if (!e.touches || e.touches.length < 2) {
          this.isPinching = false;
          if (this.pinchRaf) {
            cancelAnimationFrame(this.pinchRaf);
            this.pinchRaf = null;
          }
          if (this.boardViewport) {
            this.boardViewport.style.transform = '';
            this.boardViewport.style.transformOrigin = '';
          }
          const finalZoom = Math.max(0.3, Math.min(2.5, Math.round(this.pinchStartZoom * (this.pinchScaleRatio || 1.0) * 100) / 100));
          this.setZoom(finalZoom, true);
          this.pinchStartDistance = null;
          this.pinchScaleRatio = 1.0;
        }
        this.isMouseDown = false;
        this.dragAction = null;
        this.lastDragCell = null;
        return;
      }

      // Check for tap when touchDragToPan is active
      if (this.settings.touchDragToPan) {
        if (!this.isTouchPanning && this.touchTargetCell) {
          const { r, c } = this.touchTargetCell;
          this.touchTargetCell = null;
          if (e.cancelable) e.preventDefault();
          this.handleTouchCellTap(r, c);
          return;
        }

        if (this.isTouchPanning) {
          this.isTouchPanning = false;
          this.touchTargetCell = null;

          // Apply kinetic momentum deceleration
          const speed = Math.hypot(this.touchVelocityX, this.touchVelocityY);
          if (speed > 0.15) {
            let vx = this.touchVelocityX * 14;
            let vy = this.touchVelocityY * 14;
            const friction = 0.92;

            const stepMomentum = () => {
              if (Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5) {
                this.momentumRaf = null;
                return;
              }
              if (this.boardContainer) {
                this.boardContainer.scrollLeft -= vx;
                this.boardContainer.scrollTop -= vy;
              }
              vx *= friction;
              vy *= friction;
              this.momentumRaf = requestAnimationFrame(stepMomentum);
            };
            this.momentumRaf = requestAnimationFrame(stepMomentum);
          }
          return;
        }
      }

      if (this.isPanning) {
        this.isPanning = false;
        if (document.body) document.body.classList.remove('is-panning');
      }

      if (this.isMouseDown && this.dragAction && this.settings.precisionDrag && e && e.changedTouches && e.changedTouches[0]) {
        const touch = e.changedTouches[0];
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const cell = el ? el.closest('.cell') : null;
        if (cell && cell.dataset.r !== undefined && cell.dataset.c !== undefined) {
          const r = parseInt(cell.dataset.r, 10);
          const c = parseInt(cell.dataset.c, 10);
          if (!isNaN(r) && !isNaN(c) && this.board[r] && this.board[r][c] === -1) {
            this.applyDragToCell(r, c);
          }
        }
      }
      this.isMouseDown = false;
      this.dragAction = null;
      this.lastDragCell = null;
    }, { passive: false });

    window.addEventListener('beforeunload', () => {
      this.saveCurrentState();
    });

    window.addEventListener('resize', () => {
      if (this.boardContainer) {
        const maxX = this.boardContainer.scrollWidth - this.boardContainer.clientWidth;
        const maxY = this.boardContainer.scrollHeight - this.boardContainer.clientHeight;
        if (maxX > 0) {
          this.boardContainer.scrollLeft = Math.max(0, Math.min(maxX, this.boardContainer.scrollLeft));
        }
        if (maxY > 0) {
          this.boardContainer.scrollTop = Math.max(0, Math.min(maxY, this.boardContainer.scrollTop));
        }
      }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !this.isSpacePressed && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && !this.isPaused) {
        this.isSpacePressed = true;
        if (document.body) document.body.classList.add('is-panning');
      }
      this.handleKeyDown(e);
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        if (!this.isPanning && document.body) {
          document.body.classList.remove('is-panning');
        }
      }
    });

    // Custom Generator modal
    document.getElementById('btnCustomPuzzle').addEventListener('click', () => this.openModal('customModal'));
    document.getElementById('btnGenerateCustom').addEventListener('click', () => this.generateCustomPuzzle());

    // Import modal submit
    document.getElementById('btnSubmitImport').addEventListener('click', () => this.importTaskCode());
    document.getElementById('btnCopyTask').addEventListener('click', () => {
      const code = document.getElementById('exportTaskCode').value;
      navigator.clipboard.writeText(code).then(() => {
        alert('Task code copied to clipboard!');
      });
    });

    // Victory modal buttons
    document.getElementById('btnNextPuzzle').addEventListener('click', () => {
      this.closeModal('victoryModal');
      this.newRandomPuzzle();
    });
  }

  bindSettingsInputs() {
    const bindToggle = (id, prop, callback) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.checked = !!this.settings[prop];
      el.addEventListener('change', () => {
        this.settings[prop] = el.checked;
        this.saveSettings();
        if (callback) callback();
      });
    };

    bindToggle('settingNightMode', 'theme', () => {
      this.settings.theme = document.getElementById('settingNightMode').checked ? 'dark' : 'light';
      this.applyTheme();
    });
    bindToggle('settingBlueLight', 'blueLight', () => this.applyTheme());
    bindToggle('settingPrecisionDrag', 'precisionDrag');
    bindToggle('settingTouchDragToPan', 'touchDragToPan');
    bindToggle('settingAutoCross', 'autoCross');
    bindToggle('settingGrayCompleted', 'grayCompleted', () => this.renderBoard());
    bindToggle('settingMarkErrors', 'markErrors', () => this.renderBoard());
    bindToggle('settingShowCoords', 'showCoordinates', () => this.renderBoard());
    bindToggle('settingHideTimer', 'hideTimer', () => {
      this.timerDisplay.style.visibility = this.settings.hideTimer ? 'hidden' : 'visible';
    });
    bindToggle('settingSound', 'sound', () => {
      window.soundEngine.enabled = this.settings.sound;
    });
    bindToggle('settingHighlightChange', 'highlightChange', () => this.renderBoard());
  }

  updateToolButtons() {
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tool') === this.settings.drawStyle);
    });
    if (document.body) {
      document.body.setAttribute('data-tool', this.settings.drawStyle);
    }
  }

  getCategoryKey(cat = this.currentCat, diff = this.currentDiff) {
    if (cat === 'daily') return 'akari_state_daily';
    if (cat === 'special') return `akari_state_special_${diff}`;
    if (cat === 'custom') return 'akari_state_custom';
    return `akari_state_${cat}_${diff}`;
  }

  saveCurrentState() {
    if (!this.task || !this.board || this.board.length === 0) return;
    try {
      const key = this.getCategoryKey();
      const state = {
        cat: this.currentCat,
        diff: this.currentDiff,
        width: this.width,
        height: this.height,
        task: this.task,
        puzzleTitle: this.puzzleTitle,
        puzzleID: this.puzzleID,
        bulbs: Array.from(this.bulbs),
        crosses: Array.from(this.crosses),
        timerSeconds: this.timerSeconds,
        isSolved: this.isSolved,
        lastChange: this.lastChange,
        checkpoints: this.checkpoints.map(cp => ({
          id: cp.id,
          bulbs: Array.from(cp.bulbs),
          crosses: Array.from(cp.crosses),
          time: cp.time
        })),
        undoStack: this.undoStack.map(u => ({
          prevBulbs: Array.from(u.prevBulbs),
          prevCrosses: Array.from(u.prevCrosses),
          newBulbs: Array.from(u.newBulbs),
          newCrosses: Array.from(u.newCrosses),
          lastChange: u.lastChange
        })),
        redoStack: this.redoStack.map(r => ({
          prevBulbs: Array.from(r.prevBulbs),
          prevCrosses: Array.from(r.prevCrosses),
          newBulbs: Array.from(r.newBulbs),
          newCrosses: Array.from(r.newCrosses),
          lastChange: r.lastChange
        }))
      };
      localStorage.setItem(key, JSON.stringify(state));
      localStorage.setItem('akari_last_cat', this.currentCat);
      localStorage.setItem('akari_last_diff', this.currentDiff);
    } catch (e) {
      console.error('Failed to save state:', e);
    }
  }

  restoreSavedPuzzle(saved) {
    this.width = saved.width;
    this.height = saved.height;
    this.task = saved.task;
    this.puzzleTitle = saved.puzzleTitle || `${this.width}x${this.height}`;
    this.puzzleID = String(saved.puzzleID || '');

    this.board = AkariSolver.decodeTask(this.task, this.width, this.height);
    this.solver = new AkariSolver(this.width, this.height, this.board);

    this.bulbs = new Set(saved.bulbs || []);
    this.crosses = new Set(saved.crosses || []);
    this.lastChange = saved.lastChange || null;
    this.isSolved = !!saved.isSolved;
    this.timerSeconds = saved.timerSeconds || 0;

    this.checkpoints = (saved.checkpoints || []).map(cp => ({
      id: cp.id,
      bulbs: new Set(cp.bulbs),
      crosses: new Set(cp.crosses),
      time: cp.time
    }));

    this.undoStack = (saved.undoStack || []).map(u => ({
      prevBulbs: new Set(u.prevBulbs),
      prevCrosses: new Set(u.prevCrosses),
      newBulbs: new Set(u.newBulbs),
      newCrosses: new Set(u.newCrosses),
      lastChange: u.lastChange
    }));

    this.redoStack = (saved.redoStack || []).map(r => ({
      prevBulbs: new Set(r.prevBulbs),
      prevCrosses: new Set(r.prevCrosses),
      newBulbs: new Set(r.newBulbs),
      newCrosses: new Set(r.newCrosses),
      lastChange: r.lastChange
    }));

    this.puzzleTitleEl.textContent = this.puzzleTitle;
    this.puzzleIdEl.textContent = this.puzzleID;
    this.timerDisplay.textContent = this.formatTime(this.timerSeconds);

    this.stopTimer();
    if (!this.isSolved) {
      this.startTimer();
    }

    this.updateCheckpointsUI();
    this.renderBoard();
    this.applySavedZoom();
    this.centerBoard();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this.centerBoard());
    }
  }

  getPlayedTasks() {
    try {
      const raw = localStorage.getItem('akari_played_tasks');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  markTaskPlayed(task) {
    if (!task) return;
    try {
      const set = this.getPlayedTasks();
      set.add(task);
      const arr = Array.from(set);
      if (arr.length > 10000) arr.splice(0, arr.length - 10000);
      localStorage.setItem('akari_played_tasks', JSON.stringify(arr));
    } catch (e) {}
  }

  getNextLibraryPuzzle(cat, diff, allowRecycle = false) {
    const lib = window.OFFLINE_PUZZLE_LIBRARY || [];
    const matches = lib.filter(p => {
      if (cat === 'special') return p.category === 'special' && p.difficulty === diff;
      return p.category === cat && p.difficulty === diff;
    });

    if (!matches || matches.length === 0) return null;
    if (matches.length === 1) return matches[0];

    const played = this.getPlayedTasks();
    const deckKey = `akari_deck_${cat}_${diff}`;
    let deck = [];
    try {
      const raw = localStorage.getItem(deckKey);
      if (raw) deck = JSON.parse(raw);
    } catch (e) {
      deck = [];
    }

    if (Array.isArray(deck)) {
      deck = deck.filter(i =>
        typeof i === 'number' &&
        i >= 0 &&
        i < matches.length &&
        !played.has(matches[i].task) &&
        matches[i].task !== this.task
      );
    } else {
      deck = [];
    }

    // If deck has no unplayed puzzles left, build a deck of all unplayed puzzles in this category
    if (deck.length === 0) {
      const unplayedIndices = [];
      for (let i = 0; i < matches.length; i++) {
        if (!played.has(matches[i].task) && matches[i].task !== this.task) {
          unplayedIndices.push(i);
        }
      }

      // If all library puzzles in this category have been played:
      // Unless recycling is explicitly requested, return null so caller generates a fresh procedural puzzle!
      if (unplayedIndices.length === 0) {
        if (!allowRecycle) return null;
        for (let i = 0; i < matches.length; i++) {
          if (matches[i].task !== this.task) unplayedIndices.push(i);
        }
        if (unplayedIndices.length === 0) unplayedIndices.push(0);
      }

      for (let i = unplayedIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [unplayedIndices[i], unplayedIndices[j]] = [unplayedIndices[j], unplayedIndices[i]];
      }
      deck = unplayedIndices;
    }

    const chosenIdx = deck.pop();
    try {
      localStorage.setItem(deckKey, JSON.stringify(deck));
    } catch (e) {}

    return matches[chosenIdx];
  }

  isOnline() {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  }

  getLocalDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getDimensionsForCategory(cat, diff) {
    if (cat === 'daily' || (cat === 'special' && diff === 'daily')) return [30, 30];
    if (cat === 'special' && diff === 'weekly') return [30, 40];
    if (cat === 'special' && diff === 'monthly') return [40, 50];
    if (cat === '7x7') return [7, 7];
    if (cat === '10x10') return [10, 10];
    if (cat === '14x14') return [14, 14];
    return [25, 25];
  }

  generateFreshForCategory(cat, diff, seed = null) {
    const [w, h] = this.getDimensionsForCategory(cat, diff);
    const solverDiff = (cat === 'daily' || cat === 'special') ? 'normal' : (diff || 'easy');
    const played = this.getPlayedTasks();

    // First try with optional seed (e.g. for initial Daily Challenge of the day)
    if (seed !== null && seed !== undefined) {
      const seeded = AkariGenerator.generate(w, h, solverDiff, seed);
      if (seeded && !played.has(seeded.task) && seeded.task !== this.task) {
        return seeded;
      }
    }

    // Generate brand-new unseeded puzzle, ensuring it has never been played before
    let fallbackCandidate = null;
    for (let tries = 0; tries < 6; tries++) {
      const candidate = AkariGenerator.generate(w, h, solverDiff);
      if (candidate) {
        if (!played.has(candidate.task) && candidate.task !== this.task) {
          return candidate;
        }
        if (!fallbackCandidate) fallbackCandidate = candidate;
      }
    }
    return fallbackCandidate;
  }

  isOverpopulatedSavedTask(task, width, height) {
    if (!task || !width || !height || width * height < 400) return false;
    let clues = 0;
    for (let i = 0; i < task.length; i++) {
      const ch = task[i];
      if (ch >= '0' && ch <= '4') clues++;
    }
    // Old generator produced ~125-298 numbered clues on 25x25 and 30x30 boards;
    // new open-density boards have ~55-95 numbered clues.
    return clues > Math.floor(width * height * 0.14);
  }

  loadCategoryPuzzle(cat, diff, forceNew = false) {
    // Save current active category before switching
    if (this.task && this.board && this.board.length > 0) {
      this.saveCurrentState();
    }

    this.currentCat = cat;
    this.currentDiff = diff;

    // Update sidebar active item
    document.querySelectorAll('[data-cat]').forEach(item => {
      const iCat = item.getAttribute('data-cat');
      const iDiff = item.getAttribute('data-diff') || 'easy';
      if (iCat === cat && (cat === 'daily' || iDiff === diff)) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    const today = this.getLocalDateString();

    // Check for saved state unless forceNew
    if (!forceNew) {
      try {
        const key = this.getCategoryKey(cat, diff);
        const raw = localStorage.getItem(key);
        if (raw) {
          const saved = JSON.parse(raw);
          const isDailyExpired = (cat === 'daily' && saved.puzzleID !== today);
          // Invalidate legacy static daily puzzle or old overpopulated boards
          const isLegacyStaticDaily = (cat === 'daily' && saved.task && saved.task.startsWith('BcBB2a1B1bBbB1b1a2dBB1Bb2BbBbBBBbBkBb1Bf'));
          const isOverpopulated = this.isOverpopulatedSavedTask(saved.task, saved.width, saved.height);

          if (!isDailyExpired && !isLegacyStaticDaily && !isOverpopulated && saved.task && saved.width && saved.height) {
            // If the saved puzzle was already completed, don't reopen the solved board—start a fresh puzzle!
            if (!saved.isSolved) {
              this.restoreSavedPuzzle(saved);
              return;
            }
          }
        }
      } catch (e) {
        console.error('Error reading saved puzzle:', e);
      }
    }

    const online = this.isOnline();

    // 1. When ONLINE: Always generate a brand-new puzzle on the fly every time!
    if (online) {
      const seed = (cat === 'daily' && !forceNew) ? AkariGenerator.getSeedForDate(today) : null;
      const gen = this.generateFreshForCategory(cat, diff, seed);
      if (gen) {
        const freshID = (cat === 'daily' && !forceNew) ? today : Math.floor(Math.random() * 9000000 + 1000000);
        let title;
        if (cat === 'daily') {
          title = forceNew
            ? `Daily Challenge (${today}) [30x30 Fresh #${String(freshID).slice(-4)}]`
            : `Daily Challenge (${today}) [30x30]`;
        } else if (cat === 'special') {
          title = `${diff.toUpperCase()} Challenge [${gen.width}x${gen.height} Fresh #${String(freshID).slice(-4)}]`;
        } else {
          title = `${cat} ${diff.toUpperCase()} (Fresh #${String(freshID).slice(-4)})`;
        }
        this.loadPuzzle({
          width: gen.width,
          height: gen.height,
          task: gen.task,
          title,
          puzzleID: freshID
        });
        this.markTaskPlayed(gen.task);
        this.saveCurrentState();
        return;
      }
    }

    // 2. When OFFLINE (or if generation fell back): Pivot to the 616-puzzle cached library!
    const libCat = cat === 'daily' ? 'special' : cat;
    const libDiff = cat === 'daily' ? 'daily' : diff;
    const cachedPuz = this.getNextLibraryPuzzle(libCat, libDiff, false);
    if (cachedPuz) {
      const title = cat === 'daily'
        ? `Daily Challenge (${today}) [30x30]`
        : (cachedPuz.title || `${cat.toUpperCase()} ${diff.toUpperCase()}`);
      const puzzleID = (cat === 'daily' && !forceNew)
        ? today
        : (cachedPuz.puzzleID || Math.floor(Math.random() * 9000000 + 1000000));
      this.loadPuzzle({
        width: cachedPuz.width,
        height: cachedPuz.height,
        task: cachedPuz.task,
        title,
        puzzleID
      });
      this.markTaskPlayed(cachedPuz.task);
      this.saveCurrentState();
      return;
    }

    // 3. If offline cache for this category is completely exhausted, generate fresh locally anyway!
    const genFallback = this.generateFreshForCategory(cat, diff, null);
    if (genFallback) {
      const freshID = Math.floor(Math.random() * 9000000 + 1000000);
      this.loadPuzzle({
        width: genFallback.width,
        height: genFallback.height,
        task: genFallback.task,
        title: `${cat.toUpperCase()} ${diff.toUpperCase()} (Fresh #${String(freshID).slice(-4)})`,
        puzzleID: freshID
      });
      this.markTaskPlayed(genFallback.task);
      this.saveCurrentState();
      return;
    }

    // 4. Ultimate fallback
    const recycled = this.getNextLibraryPuzzle(libCat, libDiff, true);
    if (recycled) {
      this.loadPuzzle({
        width: recycled.width,
        height: recycled.height,
        task: recycled.task,
        title: recycled.title || `${cat.toUpperCase()} ${diff.toUpperCase()}`,
        puzzleID: recycled.puzzleID || Math.floor(Math.random() * 9000000 + 1000000)
      });
      this.saveCurrentState();
    }
  }

  loadPuzzle({ width, height, task, title, puzzleID }) {
    this.width = width;
    this.height = height;
    this.task = task;
    this.puzzleTitle = title || `${width}x${height}`;
    this.puzzleID = String(puzzleID || '');

    this.board = AkariSolver.decodeTask(task, width, height);
    this.solver = new AkariSolver(width, height, this.board);

    this.bulbs = new Set();
    this.crosses = new Set();
    this.undoStack = [];
    this.redoStack = [];
    this.checkpoints = [];
    this.lastChange = null;
    this.isSolved = false;

    this.puzzleTitleEl.textContent = this.puzzleTitle;
    this.puzzleIdEl.textContent = this.puzzleID;

    this.resetTimer();
    this.startTimer();
    this.updateCheckpointsUI();
    this.renderBoard();
    this.applySavedZoom();
    this.centerBoard();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this.centerBoard());
    }
  }

  renderBoard() {
    this.boardEl.innerHTML = '';

    // Calculate light rays & clashes
    const { litMap, clashes } = this.calculateLight();

    // Coordinate labels setup
    const showCoords = this.settings.showCoordinates;
    const colCount = showCoords ? this.width + 1 : this.width;
    const rowCount = showCoords ? this.height + 1 : this.height;

    // Ideal cell size based on board dimension and current zoom scale
    this.baseCellSize = Math.max(20, Math.min(56, Math.floor(540 / Math.max(this.width, this.height))));
    const cellSize = Math.max(16, Math.round(this.baseCellSize * this.zoomScale));
    this.boardEl.style.setProperty('--cell-size', `${cellSize}px`);
    this.boardEl.style.gridTemplateColumns = showCoords
      ? `24px repeat(${this.width}, ${cellSize}px)`
      : `repeat(${this.width}, ${cellSize}px)`;
    this.boardEl.style.gridTemplateRows = showCoords
      ? `24px repeat(${this.height}, ${cellSize}px)`
      : `repeat(${this.height}, ${cellSize}px)`;
    if (this.boardViewport) {
      this.boardViewport.style.transform = '';
    }

    // Top coordinates
    if (showCoords) {
      const corner = document.createElement('div');
      corner.className = 'coord-label';
      this.boardEl.appendChild(corner);
      for (let c = 0; c < this.width; c++) {
        const colLbl = document.createElement('div');
        colLbl.className = 'coord-label';
        colLbl.textContent = String.fromCharCode(65 + (c % 26));
        this.boardEl.appendChild(colLbl);
      }
    }

    for (let r = 0; r < this.height; r++) {
      if (showCoords) {
        const rowLbl = document.createElement('div');
        rowLbl.className = 'coord-label';
        rowLbl.textContent = String(r + 1);
        this.boardEl.appendChild(rowLbl);
      }

      for (let c = 0; c < this.width; c++) {
        const cellVal = this.board[r][c];
        const key = `${r},${c}`;
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;

        if (this.focusedCell.r === r && this.focusedCell.c === c) {
          cell.classList.add('keyboard-focus');
        }

        if (this.settings.highlightChange && this.lastChange && this.lastChange.r === r && this.lastChange.c === c) {
          cell.classList.add('last-change');
        }

        if (cellVal >= -2 && cellVal !== -1) {
          // Black wall cell
          cell.classList.add('wall');
          if (cellVal >= 0) {
            const clueSpan = document.createElement('span');
            clueSpan.className = 'clue-number';
            clueSpan.textContent = cellVal;
            cell.appendChild(clueSpan);

            // Check clue status
            const clueState = this.checkClueState(r, c, cellVal, litMap);
            if (this.settings.markErrors && clueState === 'error') {
              cell.classList.add('wall-error');
            } else if (this.settings.grayCompleted && clueState === 'satisfied') {
              cell.classList.add('wall-satisfied');
            }
          }
        } else {
          // White room cell
          const isLit = litMap.has(key);
          const hasBulb = this.bulbs.has(key);
          const hasCross = this.crosses.has(key);
          const isClashing = clashes.has(key);

          if (isLit) {
            cell.classList.add('lit');
          }

          if (hasBulb) {
            cell.classList.add('lit-center');
            if (isClashing) {
              cell.classList.add('bulb-clash');
            }
            cell.innerHTML = this.getBulbSVG();
          } else if (hasCross) {
            const cross = document.createElement('div');
            cross.className = 'cross-mark';
            cell.appendChild(cross);
          }

          // Mouse / Touch Event listeners
          cell.addEventListener('mousedown', (e) => this.handleCellMouseDown(e, r, c));
          cell.addEventListener('mouseenter', (e) => this.handleCellMouseEnter(e, r, c));
          cell.addEventListener('contextmenu', (e) => {
            e.preventDefault();
          });
        }

        this.boardEl.appendChild(cell);
      }
    }
  }

  getBulbSVG() {
    return `<svg class="bulb-icon-svg" viewBox="0 0 24 24">
      <path class="bulb-base" d="M9.5 17.2h5v2.3a1.5 1.5 0 0 1-1.5 1.5h-2a1.5 1.5 0 0 1-1.5-1.5v-2.3z"/>
      <path class="bulb-glass" d="M12 2.8c-3.8 0-6.8 2.9-6.8 6.6 0 2.4 1.3 4.5 3.2 5.7.7.5 1.1 1.2 1.1 2.1h5c0-.9.4-1.6 1.1-2.1 1.9-1.2 3.2-3.3 3.2-5.7 0-3.7-3-6.6-6.8-6.6z"/>
      <path class="bulb-filament" d="M10.3 17v-4.2c0-1.4 3.4-1.4 3.4 0V17"/>
    </svg>`;
  }

  calculateLight() {
    const litMap = new Map(); // "r,c" -> count of rays illuminating it
    const clashes = new Set(); // bulbs that see another bulb

    for (const b of this.bulbs) {
      const [br, bc] = b.split(',').map(Number);
      litMap.set(b, (litMap.get(b) || 0) + 1);

      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (const [dr, dc] of dirs) {
        let nr = br + dr;
        let nc = bc + dc;
        while (nr >= 0 && nr < this.height && nc >= 0 && nc < this.width && this.board[nr][nc] === -1) {
          const key = `${nr},${nc}`;
          litMap.set(key, (litMap.get(key) || 0) + 1);
          if (this.bulbs.has(key)) {
            clashes.add(b);
            clashes.add(key);
          }
          nr += dr;
          nc += dc;
        }
      }
    }

    return { litMap, clashes };
  }

  checkClueState(r, c, clue, litMap) {
    const adj = this.solver.getAdjWhite(r, c);
    let bulbCount = 0;
    let freeCount = 0;
    for (const p of adj) {
      if (this.bulbs.has(p.key)) {
        bulbCount++;
      } else if (!this.crosses.has(p.key)) {
        // If this adjacent square is illuminated by another bulb, a bulb cannot legally be placed here
        const isLitByOther = litMap && litMap.has(p.key);
        if (!isLitByOther) {
          freeCount++;
        }
      }
    }

    if (bulbCount > clue || (bulbCount + freeCount < clue)) {
      return 'error';
    }
    if (bulbCount === clue) {
      return 'satisfied';
    }
    return 'progress';
  }

  handleTouchCellTap(r, c) {
    if (this.isPaused || this.isSolved) return;
    if (!this.board[r] || this.board[r][c] !== -1) return;

    this.justHandledTouchTap = true;
    setTimeout(() => { this.justHandledTouchTap = false; }, 350);

    this.focusedCell = { r, c };
    const key = `${r},${c}`;
    const drawStyle = this.settings.drawStyle;

    if (drawStyle === 'cycle') {
      if (!this.bulbs.has(key) && !this.crosses.has(key)) {
        this.setCellState(r, c, 'bulb');
      } else if (this.bulbs.has(key)) {
        this.setCellState(r, c, 'cross');
      } else {
        this.setCellState(r, c, 'empty');
      }
    } else if (drawStyle === 'bulb') {
      if (this.bulbs.has(key)) {
        this.setCellState(r, c, 'empty');
      } else {
        this.setCellState(r, c, 'bulb');
      }
    } else if (drawStyle === 'cross') {
      if (this.crosses.has(key)) {
        this.setCellState(r, c, 'empty');
      } else {
        this.setCellState(r, c, 'cross');
      }
    } else if (drawStyle === 'erase') {
      this.setCellState(r, c, 'empty');
    }
  }

  handleCellMouseDown(e, r, c) {
    if (this.isPaused || this.isSolved) return;
    if (this.justHandledTouchTap) {
      this.justHandledTouchTap = false;
      return;
    }
    if (this.settings.drawStyle === 'pan' || this.isSpacePressed) {
      if (e) e.preventDefault();
      this.isPanning = true;
      this.panStartX = e.clientX;
      this.panStartY = e.clientY;
      this.panStartScrollLeft = this.boardContainer.scrollLeft;
      this.panStartScrollTop = this.boardContainer.scrollTop;
      if (document.body) document.body.classList.add('is-panning');
      return;
    }
    if (this.board[r][c] !== -1) return;
    if (e) e.preventDefault();

    this.focusedCell = { r, c };
    this.isMouseDown = true;
    this.lastDragCell = `${r},${c}`;

    const isRightClick = (e.button === 2 || (e.button === 0 && e.ctrlKey));

    if (isRightClick) {
      // Right Click
      this.toggleCross(r, c);
      this.dragAction = this.crosses.has(`${r},${c}`) ? 'cross' : 'erase';
      return;
    }

    // Left Click
    const key = `${r},${c}`;
    const drawStyle = this.settings.drawStyle;

    if (drawStyle === 'cycle') {
      // empty -> bulb -> cross -> empty
      if (!this.bulbs.has(key) && !this.crosses.has(key)) {
        this.setCellState(r, c, 'bulb');
        this.dragAction = 'bulb';
      } else if (this.bulbs.has(key)) {
        this.setCellState(r, c, 'cross');
        this.dragAction = 'cross';
      } else {
        this.setCellState(r, c, 'empty');
        this.dragAction = 'erase';
      }
    } else if (drawStyle === 'bulb') {
      if (this.bulbs.has(key)) {
        this.setCellState(r, c, 'empty');
        this.dragAction = 'erase';
      } else {
        this.setCellState(r, c, 'bulb');
        this.dragAction = 'bulb';
      }
    } else if (drawStyle === 'cross') {
      if (this.crosses.has(key)) {
        this.setCellState(r, c, 'empty');
        this.dragAction = 'erase';
      } else {
        this.setCellState(r, c, 'cross');
        this.dragAction = 'cross';
      }
    } else if (drawStyle === 'erase') {
      this.setCellState(r, c, 'empty');
      this.dragAction = 'erase';
    }
  }

  handleCellMouseEnter(e, r, c) {
    if (!this.isMouseDown || !this.dragAction) return;
    if (this.board[r][c] !== -1) return;
    const cell = (e && (e.currentTarget || e.target)) ? (e.currentTarget || e.target).closest('.cell') : null;
    const clientX = e ? e.clientX : undefined;
    const clientY = e ? e.clientY : undefined;
    this.handleDragMove(clientX, clientY, cell, r, c);
  }

  handleDragMove(clientX, clientY, cell, r, c) {
    if (!this.isMouseDown || !this.dragAction) return;
    if (this.board[r][c] !== -1) return;
    const key = `${r},${c}`;
    if (this.lastDragCell === key) return;

    if (this.settings.precisionDrag && cell && clientX !== undefined && clientY !== undefined && typeof cell.getBoundingClientRect === 'function') {
      const rect = cell.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(clientX - cx, clientY - cy);
        const threshold = Math.min(rect.width, rect.height) * 0.42;
        if (dist > threshold) {
          // Cursor is in outer corner fringe - ignore accidental diagonal clipping
          return;
        }
      }
    }

    this.applyDragToCell(r, c);
  }

  applyDragToCell(r, c) {
    if (this.board[r][c] !== -1) return;
    const key = `${r},${c}`;
    if (this.lastDragCell === key) return;
    this.lastDragCell = key;

    if (this.dragAction === 'bulb') {
      if (!this.bulbs.has(key)) {
        this.setCellState(r, c, 'bulb');
      }
    } else if (this.dragAction === 'cross') {
      if (!this.crosses.has(key)) {
        this.setCellState(r, c, 'cross');
      }
    } else if (this.dragAction === 'erase') {
      if (this.bulbs.has(key) || this.crosses.has(key)) {
        this.setCellState(r, c, 'empty');
      }
    }
  }

  handleCellRightClick(r, c) {
    if (this.isPaused || this.isSolved) return;
    if (this.board[r][c] !== -1) return;
    this.toggleCross(r, c);
  }

  toggleBulb(r, c) {
    const key = `${r},${c}`;
    if (this.bulbs.has(key)) {
      this.setCellState(r, c, 'empty');
    } else {
      this.setCellState(r, c, 'bulb');
    }
  }

  toggleCross(r, c) {
    const key = `${r},${c}`;
    if (this.crosses.has(key)) {
      this.setCellState(r, c, 'empty');
    } else {
      this.setCellState(r, c, 'cross');
    }
  }

  setCellState(r, c, newState) {
    const key = `${r},${c}`;
    const prevBulbs = new Set(this.bulbs);
    const prevCrosses = new Set(this.crosses);

    if (newState === 'bulb') {
      this.bulbs.add(key);
      this.crosses.delete(key);
      window.soundEngine.playBulb();
    } else if (newState === 'cross') {
      this.crosses.add(key);
      this.bulbs.delete(key);
      window.soundEngine.playCross();
    } else {
      this.bulbs.delete(key);
      this.crosses.delete(key);
      window.soundEngine.playErase();
    }

    // Auto-cross adjacent numbers if enabled
    if (this.settings.autoCross && newState === 'bulb') {
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < this.height && nc >= 0 && nc < this.width && this.board[nr][nc] >= 0) {
          const clue = this.board[nr][nc];
          const adj = this.solver.getAdjWhite(nr, nc);
          const adjBulbs = adj.filter(p => this.bulbs.has(p.key));
          if (adjBulbs.length === clue) {
            for (const p of adj) {
              if (!this.bulbs.has(p.key)) {
                this.crosses.add(p.key);
              }
            }
          }
        }
      }
    }

    this.undoStack.push({
      prevBulbs,
      prevCrosses,
      newBulbs: new Set(this.bulbs),
      newCrosses: new Set(this.crosses),
      lastChange: { r, c }
    });
    this.redoStack = [];
    this.lastChange = { r, c };

    this.renderBoard();
    this.saveCurrentState();
    this.checkSolution(false); // auto-check silently
  }

  undo() {
    if (this.undoStack.length === 0) return;
    const entry = this.undoStack.pop();
    this.redoStack.push(entry);

    this.bulbs = new Set(entry.prevBulbs);
    this.crosses = new Set(entry.prevCrosses);
    this.lastChange = entry.lastChange;
    this.renderBoard();
    this.saveCurrentState();
    window.soundEngine.playTone(350, 'sine', 0.08, 0.08);
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const entry = this.redoStack.pop();
    this.undoStack.push(entry);

    this.bulbs = new Set(entry.newBulbs);
    this.crosses = new Set(entry.newCrosses);
    this.lastChange = entry.lastChange;
    this.renderBoard();
    this.saveCurrentState();
    window.soundEngine.playTone(450, 'sine', 0.08, 0.08);
  }

  saveCheckpoint() {
    const cp = {
      id: this.checkpoints.length + 1,
      bulbs: new Set(this.bulbs),
      crosses: new Set(this.crosses),
      time: this.timerSeconds
    };
    this.checkpoints.push(cp);
    this.updateCheckpointsUI();
    this.saveCurrentState();
    window.soundEngine.playClueSatisfied();
  }

  restoreCheckpoint(cp) {
    this.undoStack.push({
      prevBulbs: new Set(this.bulbs),
      prevCrosses: new Set(this.crosses),
      newBulbs: new Set(cp.bulbs),
      newCrosses: new Set(cp.crosses),
      lastChange: null
    });
    this.bulbs = new Set(cp.bulbs);
    this.crosses = new Set(cp.crosses);
    this.renderBoard();
    this.saveCurrentState();
  }

  updateCheckpointsUI() {
    this.checkpointsListEl.innerHTML = '';
    for (const cp of this.checkpoints) {
      const badge = document.createElement('span');
      badge.className = 'cp-badge';
      badge.innerHTML = `CP ${cp.id} (${this.formatTime(cp.time)})`;
      badge.addEventListener('click', () => this.restoreCheckpoint(cp));
      this.checkpointsListEl.appendChild(badge);
    }
  }

  handleKeyDown(e) {
    if (this.isPaused) {
      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePause(false);
      }
      return;
    }
    if (this.isSolved) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const { r, c } = this.focusedCell;

    // Tool selection shortcuts
    if (e.key === '1') {
      this.settings.drawStyle = 'bulb';
      this.updateToolButtons();
      return;
    } else if (e.key === '2') {
      this.settings.drawStyle = 'cross';
      this.updateToolButtons();
      return;
    } else if (e.key === '3') {
      this.settings.drawStyle = 'cycle';
      this.updateToolButtons();
      return;
    } else if (e.key === '4') {
      this.settings.drawStyle = 'erase';
      this.updateToolButtons();
      return;
    } else if (e.key === '5') {
      this.settings.drawStyle = 'pan';
      this.updateToolButtons();
      return;
    }

    if (e.key === 'ArrowUp' && r > 0) {
      this.focusedCell.r--;
      this.renderBoard();
      e.preventDefault();
    } else if (e.key === 'ArrowDown' && r < this.height - 1) {
      this.focusedCell.r++;
      this.renderBoard();
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && c > 0) {
      this.focusedCell.c--;
      this.renderBoard();
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && c < this.width - 1) {
      this.focusedCell.c++;
      this.renderBoard();
      e.preventDefault();
    } else if (e.key === ' ' || e.key.toLowerCase() === 'b') {
      if (this.board[r][c] === -1) this.toggleBulb(r, c);
      e.preventDefault();
    } else if (e.key.toLowerCase() === 'x' || e.key.toLowerCase() === 'c') {
      if (this.board[r][c] === -1) this.toggleCross(r, c);
      e.preventDefault();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.board[r][c] === -1) this.setCellState(r, c, 'empty');
      e.preventDefault();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      if (e.shiftKey) this.redo();
      else this.undo();
      e.preventDefault();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      this.redo();
      e.preventDefault();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      this.saveCheckpoint();
      e.preventDefault();
    } else if (e.key.toLowerCase() === 'h') {
      this.giveHint();
    } else if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) {
      this.newRandomPuzzle(true);
      e.preventDefault();
    } else if (e.key === 'Enter') {
      this.checkSolution(true);
    }
  }

  giveHint() {
    if (this.isSolved) return;
    const hint = this.solver.getHint(this.bulbs, this.crosses);
    if (!hint) return;

    this.hintMessageEl.textContent = hint.message;
    this.hintToastEl.classList.add('show');

    if (hint.r !== undefined && hint.c !== undefined) {
      this.focusedCell = { r: hint.r, c: hint.c };
      this.lastChange = { r: hint.r, c: hint.c };
      this.renderBoard();
    }

    if (hint.type === 'error') {
      window.soundEngine.playError();
    } else {
      window.soundEngine.playBulb();
    }
  }

  checkSolution(manualClick = false) {
    const { litMap, clashes } = this.calculateLight();

    // 1. Check clashing bulbs
    if (clashes.size > 0) {
      if (manualClick) {
        window.soundEngine.playError();
        alert('Some light bulbs illuminate each other! Look for the red flashing bulbs.');
      }
      return false;
    }

    // 2. Check all white cells are lit
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        if (this.board[r][c] === -1) {
          if (!litMap.has(`${r},${c}`)) {
            if (manualClick) {
              window.soundEngine.playError();
              alert('Not all squares are lit up yet! Every white square must be illuminated.');
            }
            return false;
          }
        }
      }
    }

    // 3. Check numbered clues
    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        const clue = this.board[r][c];
        if (clue >= 0) {
          const adj = this.solver.getAdjWhite(r, c);
          const adjBulbs = adj.filter(p => this.bulbs.has(p.key)).length;
          if (adjBulbs !== clue) {
            if (manualClick) {
              window.soundEngine.playError();
              alert(`Check number ${clue} at row ${r + 1}, column ${c + 1}. It has ${adjBulbs} bulbs instead of ${clue}.`);
            }
            return false;
          }
        }
      }
    }

    // SUCCESS!
    this.isSolved = true;
    this.stopTimer();
    this.saveCurrentState();
    window.soundEngine.playVictory();
    this.triggerConfetti();

    // Record personal leaderboard solve time
    const recordResult = this.recordSolveTime(this.getLeaderboardCategoryKey(), this.timerSeconds, this.puzzleID);
    this.updateVictoryLeaderboardUI(recordResult);

    document.getElementById('victoryTime').textContent = this.formatTime(this.timerSeconds);
    this.openModal('victoryModal');
    return true;
  }

  startOver() {
    if (!confirm('Start over and clear all marks?')) return;
    this.bulbs.clear();
    this.crosses.clear();
    this.undoStack = [];
    this.redoStack = [];
    this.lastChange = null;
    this.resetTimer();
    this.startTimer();
    this.renderBoard();
    this.centerBoard();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this.centerBoard());
    }
    this.saveCurrentState();
  }

  newRandomPuzzle(announce = true) {
    const online = this.isOnline();
    this.loadCategoryPuzzle(this.currentCat, this.currentDiff, true);

    if (announce && this.hintMessageEl && this.hintToastEl) {
      const label = this.currentCat === 'daily'
        ? 'Daily 30x30'
        : `${this.currentCat} ${this.currentDiff}`;
      this.hintMessageEl.textContent = online
        ? `✨ Generated fresh unique ${label} puzzle!`
        : `✨ Loaded new cached ${label} puzzle (Offline Mode)!`;
      this.hintToastEl.classList.add('show');
      setTimeout(() => this.hintToastEl.classList.remove('show'), 2500);
    }
  }

  getSizeKey() {
    return `${this.width || 0}x${this.height || 0}`;
  }

  getSavedZoomForCurrentSize() {
    try {
      const savedMap = JSON.parse(localStorage.getItem('akari_zoom_by_size') || '{}');
      const key = this.getSizeKey();
      if (savedMap && typeof savedMap[key] === 'number') {
        return Math.max(0.3, Math.min(2.5, savedMap[key]));
      }
    } catch (e) {
      console.warn('Error reading zoom state:', e);
    }
    // Default initial zoom for large boards so they fit comfortably
    if (this.width >= 40 || this.height >= 40) return 0.50;
    if (this.width >= 30 || this.height >= 30) return 0.65;
    if (this.width >= 25 || this.height >= 25) return 0.80;
    return 1.0;
  }

  saveZoomForCurrentSize(scale) {
    if (!this.width || !this.height) return;
    try {
      const savedMap = JSON.parse(localStorage.getItem('akari_zoom_by_size') || '{}');
      savedMap[this.getSizeKey()] = scale;
      localStorage.setItem('akari_zoom_by_size', JSON.stringify(savedMap));
    } catch (e) {
      console.warn('Error saving zoom state:', e);
    }
  }

  centerBoard() {
    if (!this.boardContainer) return;
    const maxScrollLeft = this.boardContainer.scrollWidth - this.boardContainer.clientWidth;
    const maxScrollTop = this.boardContainer.scrollHeight - this.boardContainer.clientHeight;
    if (maxScrollLeft > 0) {
      this.boardContainer.scrollLeft = Math.round(maxScrollLeft / 2);
    }
    if (maxScrollTop > 0) {
      this.boardContainer.scrollTop = Math.round(maxScrollTop / 2);
    }
  }

  setZoom(scale, save = true) {
    this.zoomScale = Math.max(0.3, Math.min(2.5, scale));
    if (this.zoomSlider) this.zoomSlider.value = this.zoomScale;
    if (this.zoomLevelLabel) {
      this.zoomLevelLabel.textContent = `${Math.round(this.zoomScale * 100)}%`;
    }
    // Clear any transform scale so board expands in natural DOM layout
    if (this.boardViewport) {
      this.boardViewport.style.transform = '';
    }

    if (this.boardContainer && this.boardEl && this.width && this.height) {
      const oldMaxX = this.boardContainer.scrollWidth - this.boardContainer.clientWidth;
      const oldMaxY = this.boardContainer.scrollHeight - this.boardContainer.clientHeight;
      const ratioX = oldMaxX > 0 ? this.boardContainer.scrollLeft / oldMaxX : 0.5;
      const ratioY = oldMaxY > 0 ? this.boardContainer.scrollTop / oldMaxY : 0.5;

      const showCoords = this.settings.showCoordinates;
      const base = this.baseCellSize || Math.max(20, Math.min(56, Math.floor(540 / Math.max(this.width, this.height))));
      const cellSize = Math.max(16, Math.round(base * this.zoomScale));
      this.boardEl.style.setProperty('--cell-size', `${cellSize}px`);
      this.boardEl.style.gridTemplateColumns = showCoords
        ? `24px repeat(${this.width}, ${cellSize}px)`
        : `repeat(${this.width}, ${cellSize}px)`;
      this.boardEl.style.gridTemplateRows = showCoords
        ? `24px repeat(${this.height}, ${cellSize}px)`
        : `repeat(${this.height}, ${cellSize}px)`;

      const newMaxX = this.boardContainer.scrollWidth - this.boardContainer.clientWidth;
      const newMaxY = this.boardContainer.scrollHeight - this.boardContainer.clientHeight;
      if (newMaxX > 0) this.boardContainer.scrollLeft = Math.round(ratioX * newMaxX);
      if (newMaxY > 0) this.boardContainer.scrollTop = Math.round(ratioY * newMaxY);
    } else if (this.boardEl && this.width && this.height) {
      const showCoords = this.settings.showCoordinates;
      const base = this.baseCellSize || Math.max(20, Math.min(56, Math.floor(540 / Math.max(this.width, this.height))));
      const cellSize = Math.max(16, Math.round(base * this.zoomScale));
      this.boardEl.style.setProperty('--cell-size', `${cellSize}px`);
      this.boardEl.style.gridTemplateColumns = showCoords
        ? `24px repeat(${this.width}, ${cellSize}px)`
        : `repeat(${this.width}, ${cellSize}px)`;
      this.boardEl.style.gridTemplateRows = showCoords
        ? `24px repeat(${this.height}, ${cellSize}px)`
        : `repeat(${this.height}, ${cellSize}px)`;
    }

    if (save) {
      this.saveZoomForCurrentSize(this.zoomScale);
    }
  }

  applySavedZoom() {
    const saved = this.getSavedZoomForCurrentSize();
    this.setZoom(saved, false);
  }

  fitBoard() {
    this.setZoom(1.0, true);
    this.centerBoard();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this.centerBoard());
    }
  }

  // Timer controls
  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (!this.isPaused && !this.isSolved) {
        this.timerSeconds++;
        this.timerDisplay.textContent = this.formatTime(this.timerSeconds);
        if (this.timerSeconds % 5 === 0) {
          this.saveCurrentState();
        }
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  resetTimer() {
    this.stopTimer();
    this.timerSeconds = 0;
    this.isPaused = false;
    this.timerDisplay.textContent = '00:00';
    this.pauseOverlay.classList.remove('active');
  }

  togglePause(forceState = null) {
    this.isPaused = forceState !== null ? forceState : !this.isPaused;
    this.pauseOverlay.classList.toggle('active', this.isPaused);
    document.getElementById('btnPause').style.display = this.isPaused ? 'none' : 'inline-flex';
    document.getElementById('btnResume').style.display = this.isPaused ? 'inline-flex' : 'none';
  }

  handleWindowBlur() {
    if (!this.isSolved && !this.isPaused && this.timerSeconds > 0) {
      this.togglePause(true);
    }
  }

  // Leaderboard Methods
  getLeaderboardCategoryKey() {
    if (this.currentCat === 'daily') return 'daily';
    if (this.currentCat === 'special') return `special_${this.currentDiff}`;
    return `${this.currentCat}_${this.currentDiff}`;
  }

  getLeaderboardData() {
    try {
      const raw = localStorage.getItem('akari_leaderboard');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  saveLeaderboardData(data) {
    try {
      localStorage.setItem('akari_leaderboard', JSON.stringify(data));
    } catch (e) {}
  }

  recordSolveTime(catKey, timeSec, puzzleID) {
    const data = this.getLeaderboardData();
    if (!data[catKey]) data[catKey] = [];
    const list = data[catKey];
    const prevBest = list.length > 0 ? list[0].time : null;

    const newRecord = {
      time: timeSec,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      id: String(puzzleID || '')
    };

    list.push(newRecord);
    list.sort((a, b) => a.time - b.time);
    const rank = list.indexOf(newRecord) + 1;

    if (list.length > 10) list.splice(10);
    this.saveLeaderboardData(data);

    const isNewBest = (rank === 1);
    const isTop10 = (rank <= 10);
    const diff = (prevBest !== null && isNewBest) ? (prevBest - timeSec) : null;

    return {
      rank,
      isNewBest,
      isTop10,
      diff,
      prevBest,
      currentTime: timeSec,
      records: list
    };
  }

  updateVictoryLeaderboardUI(recordResult) {
    const badgeEl = document.getElementById('victoryRankBadge');
    const bestBox = document.getElementById('victoryBestBox');
    const bestTimeEl = document.getElementById('victoryBestTime');
    const miniLbEl = document.getElementById('victoryMiniLeaderboard');

    if (bestBox && recordResult.records.length > 0) {
      bestBox.style.display = 'block';
      bestTimeEl.textContent = this.formatTime(recordResult.records[0].time);
    }

    if (badgeEl) {
      if (recordResult.isNewBest) {
        badgeEl.style.display = 'block';
        badgeEl.style.background = '#fef3c7';
        badgeEl.style.color = '#92400e';
        badgeEl.style.border = '1px solid #f59e0b';
        badgeEl.innerHTML = `🏆 NEW PERSONAL BEST! (#1 Record)${recordResult.diff && recordResult.diff > 0 ? `<br><span style="font-size:0.85rem; font-weight:600;">Beat your previous best by ${recordResult.diff}s!</span>` : ''}`;
      } else if (recordResult.isTop10) {
        badgeEl.style.display = 'block';
        badgeEl.style.background = '#e0f2fe';
        badgeEl.style.color = '#0369a1';
        badgeEl.style.border = '1px solid #38bdf8';
        badgeEl.innerHTML = `🎉 TOP 10 FINISH! Ranked #${recordResult.rank} on your leaderboard!`;
      } else {
        badgeEl.style.display = 'none';
      }
    }

    if (miniLbEl) {
      const top5 = recordResult.records.slice(0, 5);
      if (top5.length === 0) {
        miniLbEl.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">No records saved yet.</div>';
      } else {
        let html = '<table class="leaderboard-table">';
        html += '<thead><tr><th>Rank</th><th>Time</th><th>Date</th></tr></thead><tbody>';
        top5.forEach((rec, idx) => {
          const rank = idx + 1;
          const isCurrent = (rank === recordResult.rank && rec.time === recordResult.currentTime);
          const medal = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : `#${rank}`));
          html += `<tr class="${isCurrent ? 'highlight-row' : ''}">
            <td><span class="rank-pill ${rank===1?'rank-gold':(rank===2?'rank-silver':(rank===3?'rank-bronze':'rank-other'))}">${medal}</span></td>
            <td><strong>${this.formatTime(rec.time)}</strong></td>
            <td style="color:var(--text-muted); font-size:0.8rem;">${rec.date}</td>
          </tr>`;
        });
        html += '</tbody></table>';
        miniLbEl.innerHTML = html;
      }
    }
  }

  openLeaderboardModal(selectedCategory = null) {
    const cat = selectedCategory || this.getLeaderboardCategoryKey();
    const select = document.getElementById('leaderboardCategorySelect');
    if (select) select.value = cat;
    this.renderLeaderboardModal(cat);
    this.openModal('leaderboardModal');
  }

  renderLeaderboardModal(catKey) {
    const container = document.getElementById('leaderboardListContainer');
    if (!container) return;
    const data = this.getLeaderboardData();
    const records = data[catKey] || [];

    if (records.length === 0) {
      container.innerHTML = `
        <div class="leaderboard-empty">
          <div style="font-size:2.2rem; margin-bottom:8px;">⏱️</div>
          <div style="font-weight:600; margin-bottom:4px;">No records yet for this category</div>
          <div style="font-size:0.85rem;">Complete a puzzle to establish your first personal best!</div>
        </div>
      `;
      return;
    }

    let html = '<table class="leaderboard-table">';
    html += '<thead><tr><th>Rank</th><th>Time</th><th>Date</th><th>Puzzle ID</th></tr></thead><tbody>';
    records.forEach((rec, idx) => {
      const rank = idx + 1;
      const medal = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : `#${rank}`));
      html += `<tr>
        <td><span class="rank-pill ${rank===1?'rank-gold':(rank===2?'rank-silver':(rank===3?'rank-bronze':'rank-other'))}">${medal}</span></td>
        <td><strong>${this.formatTime(rec.time)}</strong></td>
        <td style="color:var(--text-muted); font-size:0.8rem;">${rec.date}</td>
        <td style="color:var(--text-muted); font-size:0.8rem; font-family:monospace;">#${rec.id || '—'}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  clearCategoryLeaderboard(catKey) {
    if (!confirm('Are you sure you want to clear your best times for this category?')) return;
    const data = this.getLeaderboardData();
    delete data[catKey];
    this.saveLeaderboardData(data);
    this.renderLeaderboardModal(catKey);
  }

  formatTime(totalSec) {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // Modals
  openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
  }

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  }

  openShareModal() {
    const el = document.getElementById('shareTaskCode');
    if (el) el.value = this.task;
    this.openModal('shareModal');
  }

  openImportModal() {
    document.getElementById('exportTaskCode').value = this.task;
    this.openModal('importModal');
  }

  importTaskCode() {
    const code = document.getElementById('importTaskCode').value.trim();
    const w = parseInt(document.getElementById('importWidth').value, 10);
    const h = parseInt(document.getElementById('importHeight').value, 10);

    if (!code || isNaN(w) || isNaN(h)) {
      alert('Please enter valid puzzle code and dimensions.');
      return;
    }

    try {
      this.currentCat = 'custom';
      this.currentDiff = 'imported';
      this.loadPuzzle({
        width: w,
        height: h,
        task: code,
        title: `Custom ${w}x${h}`,
        puzzleID: 'Imported'
      });
      this.saveCurrentState();
      this.closeModal('importModal');
    } catch (e) {
      alert('Failed to load puzzle: ' + e.message);
    }
  }

  generateCustomPuzzle() {
    const w = parseInt(document.getElementById('customWidth').value, 10);
    const h = parseInt(document.getElementById('customHeight').value, 10);
    const diff = document.getElementById('customDiff').value;

    const gen = AkariGenerator.generate(w, h, diff);
    if (!gen) {
      alert('Could not generate puzzle with those parameters. Try smaller dimensions.');
      return;
    }

    this.closeModal('customModal');
    this.currentCat = 'custom';
    this.currentDiff = diff;
    this.loadPuzzle({
      width: w,
      height: h,
      task: gen.task,
      title: `Custom ${w}x${h} (${diff.toUpperCase()})`,
      puzzleID: Math.floor(Math.random() * 9000000 + 1000000)
    });
    this.saveCurrentState();
  }

  // Confetti Animation
  initConfetti() {
    this.confettiCanvas = document.getElementById('confettiCanvas');
    this.confettiCtx = this.confettiCanvas ? this.confettiCanvas.getContext('2d') : null;
    this.confettiParticles = [];

    const resize = () => {
      if (this.confettiCanvas) {
        this.confettiCanvas.width = window.innerWidth;
        this.confettiCanvas.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', resize);
    resize();
  }

  triggerConfetti() {
    if (!this.confettiCanvas) return;
    this.confettiParticles = [];
    const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6', '#ef4444'];
    for (let i = 0; i < 150; i++) {
      this.confettiParticles.push({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.5) * 16 - 4,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vr: (Math.random() - 0.5) * 10,
        alpha: 1
      });
    }

    const animate = () => {
      if (this.confettiParticles.length === 0) {
        if (this.confettiCtx) this.confettiCtx.clearRect(0, 0, this.confettiCanvas.width, this.confettiCanvas.height);
        return;
      }

      this.confettiCtx.clearRect(0, 0, this.confettiCanvas.width, this.confettiCanvas.height);
      for (let i = this.confettiParticles.length - 1; i >= 0; i--) {
        const p = this.confettiParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3; // gravity
        p.rotation += p.vr;
        p.alpha -= 0.008;

        if (p.alpha <= 0) {
          this.confettiParticles.splice(i, 1);
          continue;
        }

        this.confettiCtx.save();
        this.confettiCtx.globalAlpha = p.alpha;
        this.confettiCtx.translate(p.x, p.y);
        this.confettiCtx.rotate((p.rotation * Math.PI) / 180);
        this.confettiCtx.fillStyle = p.color;
        this.confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        this.confettiCtx.restore();
      }

      requestAnimationFrame(animate);
    };

    animate();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new LightUpApp();
});
