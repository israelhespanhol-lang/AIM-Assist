class AimAssist {
  constructor(strength = 0.5, maxDistance = 200, smoothTime = 0.1) {
    this.strength = Math.max(0.0, Math.min(1.0, strength));
    this.maxDistance = maxDistance;
    this.smoothTime = smoothTime;
    this.currentSmooth = 0.0;
  }

  calculateAimCompensation(playerPos, enemyPos, currentCamPos, deltaTime) {
    const dx = enemyPos[0] - playerPos[0];
    const dy = enemyPos[1] - playerPos[1];
    const distance = Math.hypot(dx, dy);

    if (distance > this.maxDistance) {
      return currentCamPos;
    }

    const targetX = playerPos[0] + dx * 0.5;
    const targetY = playerPos[1] + dy * 0.5;

    this.currentSmooth = Math.min(1.0, this.currentSmooth + deltaTime / this.smoothTime);
    const smoothFactor = this.currentSmooth * this.strength;

    const newX = currentCamPos[0] + (targetX - currentCamPos[0]) * smoothFactor;
    const newY = currentCamPos[1] + (targetY - currentCamPos[1]) * smoothFactor;

    return [newX, newY];
  }
}

// Example usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AimAssist;
} else {
  window.AimAssist = AimAssist;
}

// Demo
const aimAssist = new AimAssist(0.7, 300);
const playerPos = [400, 300];
const enemyPos = [600, 400];
let currentCam = [400, 300];

console.log('Demo: Aim Assist Calculation');
for (let i = 0; i < 10; i++) {
  currentCam = aimAssist.calculateAimCompensation(playerPos, enemyPos, currentCam, 0.016);
  console.log(`Frame ${i + 1}: Camera at [${currentCam[0].toFixed(2)}, ${currentCam[1].toFixed(2)}]`);
}