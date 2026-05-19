import { 
  ChangeDetectionStrategy, 
  Component, 
  HostListener, 
  OnDestroy, 
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';

interface Fighter {
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dir: 'left' | 'right';
  action: 'idle' | 'walk' | 'punch' | 'kick' | 'hit' | 'block' | 'jump';
  velocityY: number;
  isGrounded: boolean;
  lastHitTime: number;
}

@Component({
  selector: 'app-combat-game',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './combat-game.html',
  styleUrl: './combat-game.css',
})
export class CombatGame {
  p = signal<Fighter>(this.createFighter('Nobita', 250, 'right'));
  e = signal<Fighter>(this.createFighter('Gian', 950, 'left'));
  gameState = signal<'idle' | 'playing' | 'win' | 'lose'>('idle');
  sparks = signal<any[]>([]);
  hitTexts = signal<any[]>([]);

  private keys: Record<string, boolean> = {};
  private rafId?: number;
  private lastUpdate = 0;

  @HostListener('window:keydown', ['$event']) onDown(e: KeyboardEvent) { this.keys[e.key.toLowerCase()] = true; }
  @HostListener('window:keyup', ['$event']) onUp(e: KeyboardEvent) { this.keys[e.key.toLowerCase()] = false; }

  private createFighter(name: string, x: number, dir: 'left' | 'right'): Fighter {
    return {
      name, x, y: 0, hp: 100, maxHp: 100, dir, action: 'idle',
      velocityY: 0, isGrounded: true, lastHitTime: 0
    };
  }

  reset() {
    this.p.set(this.createFighter('Nobita', 300, 'right'));
    this.e.set(this.createFighter('Gian', window.innerWidth - 500, 'left'));
    this.gameState.set('playing');
    this.lastUpdate = performance.now();
    this.loop(performance.now());
  }

  private loop = (time: number) => {
    if (this.gameState() !== 'playing') return;
    const dt = Math.min((time - this.lastUpdate) / 16.6, 2.0);
    this.lastUpdate = time;

    this.updateFacing();
    this.updatePlayer(dt);
    this.updateAI(dt);
    this.checkCollisions();
    
    this.rafId = requestAnimationFrame(this.loop);
  };

  private updateFacing() {
    if (this.p().x < this.e().x) {
      this.p.update(v => ({...v, dir: 'right'}));
      this.e.update(v => ({...v, dir: 'left'}));
    } else {
      this.p.update(v => ({...v, dir: 'left'}));
      this.e.update(v => ({...v, dir: 'right'}));
    }
  }

  private updatePlayer(dt: number) {
    const s = this.p();
    let { x, y, velocityY, action, isGrounded } = s;

    if (action === 'hit' && Date.now() - s.lastHitTime < 300) return;

    if (this.keys['k']) {
      action = 'block';
    } else if (this.keys['j'] && action !== 'punch') {
      action = 'punch';
      setTimeout(() => this.checkHit(this.p, this.e, 10), 150);
      setTimeout(() => this.p.update(v => v.action === 'punch' ? ({...v, action: 'idle'}) : v), 450);
    } else if (this.keys['l'] && action !== 'kick') {
      action = 'kick';
      setTimeout(() => this.checkHit(this.p, this.e, 15), 180);
      setTimeout(() => this.p.update(v => v.action === 'kick' ? ({...v, action: 'idle'}) : v), 450);
    } else if (isGrounded) {
      if (this.keys['a']) { x -= 14 * dt; action = 'walk'; }
      else if (this.keys['d']) { x += 14 * dt; action = 'walk'; }
      else { if (action !== 'punch' && action !== 'kick') action = 'idle'; }
    }

    if (this.keys[' '] && isGrounded) {
      velocityY = 35;
      isGrounded = false;
      action = 'jump';
    }

    if (!isGrounded) {
      velocityY -= 1.6 * dt;
      y += velocityY * dt;
      if (y <= 0) { y = 0; velocityY = 0; isGrounded = true; action = 'idle'; }
    }

    this.p.set({ ...s, x: this.clamp(x), y, velocityY, action, isGrounded });
  }

  private updateAI(dt: number) {
    const s = this.e();
    const target = this.p();
    let { x, y, velocityY, action, isGrounded } = s;

    if (action === 'hit' && Date.now() - s.lastHitTime < 400) return;

    const dist = Math.abs(x - target.x);

    if (isGrounded && action !== 'punch') {
      if (dist > 350) {
        x += (x > target.x ? -9 : 9) * dt;
        action = 'walk';
      } else {
        if (Math.random() < 0.035) {
          action = 'punch';
          setTimeout(() => this.checkHit(this.e, this.p, 15), 180);
          setTimeout(() => this.e.update(v => v.action === 'punch' ? ({...v, action: 'idle'}) : v), 700);
        } else {
          action = 'idle';
        }
      }
    }

    if (!isGrounded) {
      velocityY -= 1.6 * dt;
      y += velocityY * dt;
      if (y <= 0) { y = 0; velocityY = 0; isGrounded = true; }
    }

    this.e.set({ ...s, x: this.clamp(x), y, velocityY, action, isGrounded });
  }

  private checkHit(attacker: any, defender: any, damage: number) {
    const a = attacker();
    const d = defender();
    const range = a.action === 'kick' ? 420 : 380; 
    const dist = Math.abs(a.x - d.x);

    if (dist < range && Math.abs(a.y - d.y) < 200) {
      const isBlocked = d.action === 'block';
      const sparkX = d.x + (a.x < d.x ? -50 : 50);
      
      this.spawnSpark(sparkX, 280 + d.y);
      if (isBlocked) return;

      defender.update((v: any) => ({
        ...v,
        hp: Math.max(0, v.hp - damage),
        action: 'hit',
        lastHitTime: Date.now(),
        x: v.x + (a.x < v.x ? 180 : -180)
      }));

      const id = Math.random();
      this.hitTexts.update(t => [...t, { id, val: damage }]);
      setTimeout(() => this.hitTexts.update(t => t.filter(x => x.id !== id)), 800);

      if (defender().hp <= 0) {
        this.gameState.set(a.name === 'Nobita' ? 'win' : 'lose');
      }
    }
  }

  private spawnSpark(x: number, y: number) {
    const id = Math.random();
    this.sparks.update(s => [...s, { id, x, y }]);
    setTimeout(() => this.sparks.update(s => s.filter(i => i.id !== id)), 400);
  }

  private checkCollisions() {
    const p = this.p();
    const e = this.e();
    if (Math.abs(p.x - e.x) < 180 && p.y === e.y) {
      const push = (180 - Math.abs(p.x - e.x)) / 2;
      this.p.update(v => ({ ...v, x: v.x + (p.x < e.x ? -push : push) }));
      this.e.update(v => ({ ...v, x: v.x + (e.x < p.x ? -push : push) }));
    }
  }

  private clamp(x: number) {
    return Math.max(120, Math.min(x, window.innerWidth - 450));
  }

  ngOnDestroy() { if (this.rafId) cancelAnimationFrame(this.rafId); }

}
