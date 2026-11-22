import { registerPlugin } from '@capacitor/core';

export const androidSandbox = import.meta.env.MODE === 'android-sandbox';
export const playInternal = import.meta.env.MODE === 'play-internal';
export const rewardsEnabled = playInternal || import.meta.env.MODE === 'ad-preview';
export const playAds = registerPlugin('PlayAds');
export const playCatalog = registerPlugin('PlayCatalog');
