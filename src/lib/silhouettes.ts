// src/lib/silhouettes.ts
import type { AircraftFamily } from '../types/aircraft';

// All paths use viewBox="-50 -100 100 200"
// Nose points up (-Y). Aircraft is outline-only (stroke, no fill).
// Scale/rotate at render time.
export const SILHOUETTE_PATHS: Record<AircraftFamily, string> = {
  // A319, A320, B737-700/800
  'narrowbody-short': `M 0,-85 C 3,-82 5,-58 5,-10 L 44,22 42,33 7,15 7,65 17,72 16,80 0,76 -16,80 -17,72 -7,65 -7,15 -42,33 -44,22 -5,-10 C -5,-58 -3,-82 0,-85 Z`,

  // A321, B737-900, B757
  'narrowbody-long': `M 0,-92 C 3,-88 4,-60 4,-10 L 43,22 41,33 6,15 6,74 16,81 15,89 0,85 -15,89 -16,81 -6,74 -6,15 -41,33 -43,22 -4,-10 C -4,-60 -3,-88 0,-92 Z`,

  // A330, B767, B787-8
  'widebody-medium': `M 0,-84 C 7,-78 9,-52 9,-5 L 53,28 50,40 11,18 11,65 22,73 20,82 0,78 -20,82 -22,73 -11,65 -11,18 -50,40 -53,28 -9,-5 C -9,-52 -7,-78 0,-84 Z`,

  // A350, B777, B787-10
  'widebody-large': `M 0,-84 C 9,-78 11,-52 11,-5 L 57,30 54,44 13,18 13,65 26,73 24,82 0,78 -24,82 -26,73 -13,65 -13,18 -54,44 -57,30 -11,-5 C -11,-52 -9,-78 0,-84 Z`,

  // A380, B747
  'very-large': `M 0,-84 C 12,-77 14,-50 14,-5 L 62,32 58,48 16,20 16,65 30,73 28,82 0,78 -28,82 -30,73 -16,65 -16,20 -58,48 -62,32 -14,-5 C -14,-50 -12,-77 0,-84 Z`,

  // CRJ200, ERJ145
  'regional-small': `M 0,-78 C 2,-75 3,-52 3,-15 L 30,12 29,20 5,8 5,55 13,62 12,70 0,66 -12,70 -13,62 -5,55 -5,8 -29,20 -30,12 -3,-15 C -3,-52 -2,-75 0,-78 Z`,

  // CRJ700/900, E170/175
  'regional-medium': `M 0,-80 C 3,-76 4,-52 4,-12 L 36,18 34,28 6,10 6,58 15,66 14,74 0,70 -14,74 -15,66 -6,58 -6,10 -34,28 -36,18 -4,-12 C -4,-52 -3,-76 0,-80 Z`,

  // E190/195
  'regional-large': `M 0,-82 C 3,-78 5,-53 5,-10 L 40,20 38,30 7,13 7,63 17,71 16,79 0,75 -16,79 -17,71 -7,63 -7,13 -38,30 -40,20 -5,-10 C -5,-53 -3,-78 0,-82 Z`,

  // ATR42/72, Q400
  'turboprop': `M 0,-70 C 3,-67 4,-46 4,-10 L 38,8 36,18 7,6 7,58 15,65 14,73 0,69 -14,73 -15,65 -7,58 -7,6 -36,18 -38,8 -4,-10 C -4,-46 -3,-67 0,-70 Z`,

  // Citation, Phenom
  'bizjet-small': `M 0,-82 C 2,-78 3,-52 3,-10 L 34,26 31,34 5,10 5,60 12,68 11,76 0,72 -11,76 -12,68 -5,60 -5,10 -31,34 -34,26 -3,-10 C -3,-52 -2,-78 0,-82 Z`,

  // Gulfstream, Global
  'bizjet-large': `M 0,-85 C 3,-80 5,-53 5,-8 L 46,28 43,38 7,12 7,64 18,72 17,80 0,76 -17,80 -18,72 -7,64 -7,12 -43,38 -46,28 -5,-8 C -5,-53 -3,-80 0,-85 Z`,

  // Generic delta/fighter silhouette
  'military': `M 0,-85 L 5,-72 L 47,55 L 20,46 L 9,78 L 0,82 L -9,78 L -20,46 L -47,55 L -5,-72 Z`,

  // Fallback
  'generic': `M 0,-80 C 4,-75 5,-47 5,-10 L 38,22 37,32 7,14 7,63 16,70 15,78 0,74 -15,78 -16,70 -7,63 -7,14 -37,32 -38,22 -5,-10 C -5,-47 -4,-75 0,-80 Z`,
};

export function getAircraftFamily(typeCode: string): AircraftFamily {
  if (!typeCode) return 'generic';
  const t = typeCode.toUpperCase();

  if (/^(A38[02]|B74[278S]|AN12[45])/.test(t)) return 'very-large';
  if (/^(A35[09X]|B77[7-9LWF]|B78X|IL96)/.test(t)) return 'widebody-large';
  if (/^(A33[09]|A34[05]|B76[2-9]|B78[789]|DC10|MD11|L101)/.test(t)) return 'widebody-medium';
  if (/^(A321|B735|B739|B75[27]|MD8[02])/.test(t)) return 'narrowbody-long';
  if (/^(A31[89]|A32[02N]|B73[0-8]|B73M|MD8[0-9])/.test(t)) return 'narrowbody-short';
  if (/^(E19[05]|E290|E295|ERJ19[05])/.test(t)) return 'regional-large';
  if (/^(CRJ7|CRJ9|E170|E175|E17[05]|ERJ17[05])/.test(t)) return 'regional-medium';
  if (/^(CRJ[12]|CRJ2|E135|E145|ERJ13[45]|ERJ14[05])/.test(t)) return 'regional-small';
  if (/^(AT[47][27]|DH8[ABCD0-4]|Q[34]00|SF34|E120|BE19|BE20|SW4|PC12|TBM|PAY)/.test(t)) return 'turboprop';
  if (/^(GL[56789]|GV|G[456]|GLF[456]|F9[0X]|F2TH|CL6[05]|CL30|BD700)/.test(t)) return 'bizjet-large';
  if (/^(C25[0-9A-Z]|C5[0-9]|C68[0-9]|LJ[2-7][0-9]|BE40|FA[27]0|PC24|E50[0-9])/.test(t)) return 'bizjet-small';
  if (/^(F1[456789]|F22|F35|B2B|AV8|A10|C130|C17|MQ9|U2)/.test(t)) return 'military';

  return 'generic';
}

export const SILHOUETTE_VIEWBOX = '-50 -100 100 200';
