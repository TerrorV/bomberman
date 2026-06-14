// ui.js — HUD rendering, start screen, game over/win overlays, high score

class UI {
  constructor(ctx, canvas) {
    this.ctx = ctx;
    this.canvas = canvas;
  }

  // --- HUD ---
  renderHUD(state) {
    if (state.gameState !== 'playing') return;

    if (CONFIG.MULTIPLAYER_MODE) {
      this._renderMultiplayerHUD(state);
    } else {
      this._renderSinglePlayerHUD(state);
    }
  }

  _renderSinglePlayerHUD(state) {
    const ctx = this.ctx;
    const fontSize = 18;
    ctx.font = `bold ${fontSize}px Segoe UI, Arial`;
    ctx.textBaseline = 'top';

    // Score (top-left)
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${state.score}`, 16, 16);

    // Right-side stats
    ctx.textAlign = 'right';
    const statsY = 16;
    let statsX = this.canvas.width - 16;
    let statsArr = [
      `🔥 ${state.player.fireRange}/${CONFIG.FIRE_RANGE_MAX}`,
      `💣 ${state.player.bombsPlaced}/${state.player.bombCount}`,
    ];
    if (state.player.speedBoostTimer > 0) {
      statsArr.push(`⚡ ${Math.ceil(state.player.speedBoostTimer)}s`);
    } else {
      statsArr.push(`👾 ${state.enemies.filter(e => e.alive).length}`);
    }
    statsArr.push(state.lives > 0 ? '❤️'.repeat(state.lives) : '');
    ctx.fillText(statsArr.filter(Boolean).join(' '), statsX, statsY);

    // Timer with urgency coloring
    const mins = Math.floor(state.timeLeft / 60);
    const secs = Math.floor(state.timeLeft) % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    const urgent = state.timeLeft <= 30;
    ctx.fillStyle = urgent ? '#e74c3c' : '#fff';
    ctx.font = urgent ? `bold ${fontSize + 4}px Segoe UI, Arial` : `bold ${fontSize}px Segoe UI, Arial`;
    ctx.textAlign = 'right';
    ctx.fillText(timeStr, statsX, statsY + 30);
  }

  _renderMultiplayerHUD(state) {
    const ctx = this.ctx;
    const canvas = this.canvas;
    const numPlayers = state.players.length;
    const sectionWidth = canvas.width / numPlayers;

    // Top bar background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, 50);

    for (let i = 0; i < numPlayers; i++) {
      const player = state.players[i];
      const x = sectionWidth * i;

      // Background strip in player color
      ctx.fillStyle = CONFIG.PLAYER_COLORS[i] + '40'; // 40 = ~25% opacity hex
      ctx.fillRect(x, 0, sectionWidth, 50);

      // Border between players
      if (i > 0) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 50);
        ctx.stroke();
      }

      // Player label + eliminated status
      ctx.fillStyle = CONFIG.PLAYER_COLORS[i];
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      const label = player.eliminated ? `P${i + 1} ✗` : `P${i + 1}`;
      ctx.fillText(label, x + 4, 12);

      // Score
      ctx.fillStyle = '#fff';
      ctx.font = '13px monospace';
      ctx.fillText(`Score: ${player.score || 0}`, x + 4, 28);

      // Lives
      ctx.fillText(`Lives: ${player.lives || 0}`, x + 4, 42);
    }

    // Timer centered at bottom
    const fontSize = 18;
    const mins = Math.floor(state.timeLeft / 60);
    const secs = Math.floor(state.timeLeft) % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    const urgent = state.timeLeft <= 30;
    ctx.fillStyle = urgent ? '#e74c3c' : '#fff';
    ctx.font = urgent ? `bold ${fontSize + 4}px Segoe UI, Arial` : `bold ${fontSize}px Segoe UI, Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(timeStr, canvas.width / 2, canvas.height - 8);
  }

  // --- Start screen ---
  renderStartScreen() {
    const ctx = this.ctx;
    const canvas = this.canvas;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 64px Segoe UI, Arial';
    ctx.fillText('BOMBERMAN', canvas.width / 2, canvas.height / 2 - 100);

    // Mode indicator
    ctx.font = 'bold 20px Segoe UI, Arial';
    ctx.fillStyle = CONFIG.MULTIPLAYER_MODE ? '#3498db' : '#2ecc71';
    ctx.fillText(
      CONFIG.MULTIPLAYER_MODE ? '2-Player Mode' : '1-Player Mode',
      canvas.width / 2, canvas.height / 2 - 50
    );

    if (Math.floor(Date.now() / 500) % 2) {
      ctx.font = 'bold 22px Segoe UI, Arial';
      ctx.fillStyle = '#f1c40f';
      ctx.fillText('Press ENTER to play!', canvas.width / 2, canvas.height / 2);
    }

    ctx.font = '16px Segoe UI, Arial';
    ctx.fillStyle = '#bbb';
    ctx.fillText('TAB or tap mode above — Toggle 1P / 2P', canvas.width / 2, canvas.height / 2 + 50);

    if (CONFIG.MULTIPLAYER_MODE) {
      ctx.fillStyle = '#2ecc71';
      ctx.fillText('P1: WASD + Space', canvas.width / 2, canvas.height / 2 + 80);
      ctx.fillStyle = '#3498db';
      ctx.fillText('P2: Arrows + Enter', canvas.width / 2, canvas.height / 2 + 100);
    } else {
      ctx.fillStyle = '#bbb';
      ctx.fillText('WASD / Arrows — Move  |  Space — Bomb  |  R — Restart', canvas.width / 2, canvas.height / 2 + 80);
    }

    // Online multiplayer button - visible touch zone at bottom
    const btnY = canvas.height / 2 + 140;
    const btnW = 280;
    const btnH = 44;

    // Button background
    ctx.fillStyle = 'rgba(231, 76, 60, 0.2)';
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(canvas.width / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
    ctx.fill();
    ctx.stroke();

    // Button text
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 18px Segoe UI, Arial';
    ctx.fillText('🌐  Online Multiplayer', canvas.width / 2, btnY);

    // Keyboard hint
    ctx.fillStyle = '#666';
    ctx.font = '13px Segoe UI, Arial';
    ctx.fillText('(Press O key)', canvas.width / 2, btnY + btnH / 2 + 10);
  }

  // --- Game over / win text ---
  renderStateText(state) {
    if (state.gameState === 'finalWin') {
      this.renderGameComplete(state);
      return;
    }
    if (state.gameState !== 'gameover' && state.gameState !== 'win') return;
    const ctx = this.ctx;
    const canvas = this.canvas;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Segoe UI, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (CONFIG.MULTIPLAYER_MODE && state.gameState === 'gameover') {
      // In multiplayer, show who survived
      const alivePlayers = state.players.filter(p => p.alive && !p.eliminated);
      if (alivePlayers.length === 1) {
        ctx.fillText(`PLAYER ${alivePlayers[0].playerIndex + 1} WINS!`, canvas.width / 2, canvas.height / 2 - 40);
      } else if (alivePlayers.length > 1) {
        const names = alivePlayers.map(p => `P${p.playerIndex + 1}`).join(' & ');
        ctx.fillText(`${names} WIN!`, canvas.width / 2, canvas.height / 2 - 40);
      } else {
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 40);
      }
      // Show final scores
      ctx.font = '24px Segoe UI, Arial';
      for (let i = 0; i < state.players.length; i++) {
        ctx.fillStyle = CONFIG.PLAYER_COLORS[i];
        ctx.fillText(`P${i + 1}: ${state.players[i].score || 0} pts`, canvas.width / 2, canvas.height / 2 + i * 30);
      }
    } else {
      ctx.fillText(state.gameState === 'gameover' ? 'GAME OVER' : 'YOU WIN!', canvas.width / 2, canvas.height / 2);
    }
    this.renderHighScore(state);
  }

  // --- Game complete (all levels cleared) ---
  renderGameComplete(state) {
    const ctx = this.ctx;
    const canvas = this.canvas;
    const w = canvas.width / 2;
    const h = canvas.height / 2;

    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 52px Segoe UI, Arial';
    ctx.fillText('🏆 GAME COMPLETE! 🏆', w, h - 100);

    // Final score
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Segoe UI, Arial';
    ctx.fillText(`Final Score: ${state.score}`, w, h - 30);

    // High score
    ctx.fillStyle = '#2ecc71';
    ctx.font = '24px Segoe UI, Arial';
    const isNew = state.score >= state.highScore;
    if (isNew) {
      ctx.fillText('⭐ NEW HIGH SCORE! ⭐', w, h + 20);
    } else {
      ctx.fillText(`High Score: ${state.highScore}`, w, h + 20);
    }

    // Restart prompt
    ctx.fillStyle = '#f1c40f';
    ctx.font = '20px Segoe UI, Arial';
    if (Math.floor(Date.now() / 600) % 2) {
      ctx.fillText('Press ENTER to play again', w, h + 75);
    }
  }

  // --- Level transition ---
  renderLevelTransition(state) {
    if (state.gameState !== 'levelwin') return;
    const ctx = this.ctx;
    const canvas = this.canvas;

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Level cleared
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 48px Segoe UI, Arial';
    ctx.fillText(`LEVEL ${state.level} CLEARED!`, canvas.width / 2, canvas.height / 2 - 60);

    // Score gained
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 28px Segoe UI, Arial';
    ctx.fillText(`+${state._levelTransitionScore} pts`, canvas.width / 2, canvas.height / 2 - 10);

    // Total score
    ctx.fillStyle = '#fff';
    ctx.font = '22px Segoe UI, Arial';
    ctx.fillText(`Total: ${state.score}`, canvas.width / 2, canvas.height / 2 + 30);

    // Countdown
    const secs = Math.ceil(state._levelTimer);
    ctx.fillStyle = '#bbb';
    ctx.font = '18px Segoe UI, Arial';
    ctx.fillText(`Next level in ${secs}s...`, canvas.width / 2, canvas.height / 2 + 70);
  }

  // --- High score ---
  renderHighScore(state) {
    const ctx = this.ctx;
    const canvas = this.canvas;
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 16px Segoe UI, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`High Score: ${state.highScore}`, canvas.width / 2, canvas.height - 12);
  }
}
