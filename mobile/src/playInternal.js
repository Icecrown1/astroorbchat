import { registerPlugin } from '@capacitor/core';

export const mechanics = import.meta.env.MODE === 'mechanics';
export const authPilot = import.meta.env.MODE === 'auth-pilot';
export const playInternal = authPilot || mechanics || import.meta.env.MODE === 'play-internal';
export const rewardsEnabled = playInternal || import.meta.env.MODE === 'ad-preview';
export const playAds = registerPlugin('PlayAds');
export const playCatalog = registerPlugin('PlayCatalog');
