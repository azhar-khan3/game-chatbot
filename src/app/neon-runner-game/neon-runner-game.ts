import { 
  Component, 
  signal, 
  computed, 
  effect, 
  OnDestroy, 
  HostListener,
  ChangeDetectionStrategy 
} from '@angular/core';

interface Obstacle {
  id: number;
  x: number;
  width: number;
  height: number;
  type: 'spike' | 'block';
}

@Component({
  selector: 'app-neon-runner-game',
  imports: [],
  templateUrl: './neon-runner-game.html',
  styleUrl: './neon-runner-game.css',
})
export class NeonRunnerGame {
  
  gameState = signal<'idle' | 'playing' | 'gameover'>('idle');
  distance = signal(0);
  highScore = signal(Number(localStorage.getItem('neonrun-best') || 0));
  
  // Player Physics
  playerY = signal(0);
  playerVelocity = 0;
  playerRotation = signal(0);
  isJumping = signal(false);
  
  // Game World
  obstacles = signal<Obstacle[]>([]);
  currentSpeed = signal(8);
  
  private animationId: number | null = null;
  private lastTime = 0;
  private idCounter = 0;
  private spawnTimer = 0;

  constructor() {
    effect(() => {
      if (this.distance() > this.highScore()) {
        this.highScore.set(this.distance());
        localStorage.setItem('neonrun-best', this.distance().toString());
      }
    });
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (event.code === 'Space') {
      this.handleAction();
    }
  }

  handleAction() {
    if (this.gameState() === 'idle') {
      this.startGame();
    } else if (this.gameState() === 'playing' && !this.isJumping()) {
      this.jump();
    }
  }

  startGame(event?: Event) {
    event?.stopPropagation();
    this.gameState.set('playing');
    this.distance.set(0);
    this.obstacles.set([]);
    this.playerY.set(0);
    this.playerVelocity = 0;
    this.currentSpeed.set(8);
    this.spawnTimer = 0;
    
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.lastTime = performance.now();
    this.gameLoop(this.lastTime);
  }

  private jump() {
    this.playerVelocity = 15;
    this.isJumping.set(true);
  }

  private gameLoop = (time: number) => {
    if (this.gameState() !== 'playing') return;

    const deltaTime = (time - this.lastTime) / 16.67; // Normalize to 60fps
    this.lastTime = time;

    this.updatePhysics(deltaTime);
    this.updateObstacles(deltaTime);
    this.checkCollisions();
    
    // Increment distance and speed
    this.distance.update(d => d + 1);
    if (this.distance() % 500 === 0) {
      this.currentSpeed.update(s => Math.min(s + 0.5, 18));
    }

    this.animationId = requestAnimationFrame(this.gameLoop);
  };

  private updatePhysics(delta: number) {
    const gravity = -0.8;
    this.playerVelocity += gravity * delta;
    this.playerY.update(y => Math.max(0, y + this.playerVelocity * delta));

    if (this.playerY() === 0) {
      this.isJumping.set(false);
      this.playerVelocity = 0;
      this.playerRotation.set(0);
    } else {
      // Rotate while jumping
      this.playerRotation.update(r => r + 5 * delta);
    }
  }

  private updateObstacles(delta: number) {
    // Move existing obstacles
    this.obstacles.update(obs => {
      return obs
        .map(o => ({ ...o, x: o.x - this.currentSpeed() * delta }))
        .filter(o => o.x > -100);
    });

    // Spawn new obstacles
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnObstacle();
      // Random spawn interval based on speed
      this.spawnTimer = 40 + Math.random() * 60;
    }
  }

  private spawnObstacle() {
    const type = Math.random() > 0.4 ? 'spike' : 'block';
    const newObs: Obstacle = {
      id: ++this.idCounter,
      x: 1000,
      width: 40 + Math.random() * 30,
      height: type === 'spike' ? 45 : 60,
      type: type
    };
    this.obstacles.update(current => [...current, newObs]);
  }

  private checkCollisions() {
    const py = this.playerY();
    const px = 80; // Player X fixed at 80 (plus width 48)
    const pw = 48;
    const ph = 48;

    const hit = this.obstacles().some(obs => {
      return (
        px < obs.x + obs.width &&
        px + pw > obs.x &&
        py < obs.height &&
        py + ph > 0
      );
    });

    if (hit) {
      this.gameOver();
    }
  }

  private gameOver() {
    this.gameState.set('gameover');
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }

  ngOnDestroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }



}
