import { 
  Component, 
  signal, 
  computed, 
  effect, 
  OnDestroy,
  ChangeDetectionStrategy 
} from '@angular/core';

interface GameItem {
  id: number;
  x: number;
  y: number;
  type: 'circle' | 'square' | 'triangle';
  color: string;
  speed: number;
  size: number;
  points: number;
}


@Component({
  selector: 'app-neon-shapes-game',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './neon-shapes-game.html',
  styleUrl: './neon-shapes-game.css',
})
export class NeonShapesGame {
  
  gameState = signal<'idle' | 'playing' | 'gameover'>('idle');
  score = signal(0);
  lives = signal(3);
  highScore = signal(Number(localStorage.getItem('neonfall-highscore') || 0));
  items = signal<GameItem[]>([]);
  
  private gameLoop: any;
  private spawnLoop: any;
  private idCounter = 0;

  constructor() {
    effect(() => {
      if (this.score() > this.highScore()) {
        this.highScore.set(this.score());
        localStorage.setItem('neonfall-highscore', this.score().toString());
      }
    });
  }

  startGame() {
    this.score.set(0);
    this.lives.set(3);
    this.items.set([]);
    this.gameState.set('playing');
    this.startLoops();
  }

  private startLoops() {
    this.stopLoops();
    
    // Update movement loop (60fps-ish)
    this.gameLoop = setInterval(() => this.updateItems(), 16);
    
    // Spawn loop (variable frequency)
    this.scheduleNextSpawn();
  }

  private scheduleNextSpawn() {
    if (this.gameState() !== 'playing') return;
    
    // Difficulty curve: spawn faster as score increases
    const delay = Math.max(400, 1200 - (this.score() * 10));
    this.spawnLoop = setTimeout(() => {
      this.spawnItem();
      this.scheduleNextSpawn();
    }, delay);
  }

  private spawnItem() {
    const types: ('circle' | 'square' | 'triangle')[] = ['circle', 'square', 'triangle'];
    const colors = ['#818cf8', '#f43f5e', '#2dd4bf', '#fbbf24', '#a855f7'];
    
    // Difficulty curve: move faster as score increases
    const baseSpeed = 2 + (this.score() / 15);
    
    const newItem: GameItem = {
      id: ++this.idCounter,
      x: Math.random() * 85 + 5, // Keep within horizontal bounds
      y: -50,
      type: types[Math.floor(Math.random() * types.length)],
      color: colors[Math.floor(Math.random() * colors.length)],
      speed: baseSpeed + Math.random() * 2,
      size: 40 + Math.random() * 20,
      points: 1
    };

    this.items.update(current => [...current, newItem]);
  }

  private updateItems() {
    if (this.gameState() !== 'playing') return;

    let lostLife = false;
    
    this.items.update(current => {
      const updated = current.map(item => ({ ...item, y: item.y + item.speed }));
      
      // Check for items that hit the bottom
      const remaining = updated.filter(item => {
        if (item.y > 800) { // Off bottom of arena
          lostLife = true;
          return false;
        }
        return true;
      });

      return remaining;
    });

    if (lostLife) {
      this.lives.update(l => l - 1);
      if (this.lives() <= 0) {
        this.gameOver();
      }
    }
  }

  onHit(id: number, event: Event) {
    event.preventDefault();
    if (this.gameState() !== 'playing') return;

    this.items.update(current => {
      const filtered = current.filter(i => i.id !== id);
      if (filtered.length < current.length) {
        this.score.update(s => s + 1);
      }
      return filtered;
    });
  }

  private gameOver() {
    this.gameState.set('gameover');
    this.stopLoops();
  }

  private stopLoops() {
    if (this.gameLoop) clearInterval(this.gameLoop);
    if (this.spawnLoop) clearTimeout(this.spawnLoop);
  }

  ngOnDestroy() {
    this.stopLoops();
  }

}
