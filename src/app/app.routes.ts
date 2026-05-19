import { Routes } from '@angular/router';
import { Chatbot } from './chatbot/chatbot';
import { CombatGame } from './combat-game/combat-game';
import { NeonRunnerGame } from './neon-runner-game/neon-runner-game';
import { NeonShapesGame } from './neon-shapes-game/neon-shapes-game';

export const routes: Routes = [
    { path: '', component: Chatbot },
    { path: 'game', component: NeonShapesGame },
    { path: 'running-game', component: NeonRunnerGame },
    { path: 'combat-game', component: CombatGame}
];
