import { registerPlugin } from '@capacitor/core';

export const mechanics = import.meta.env.MODE === 'mechanics';
export const playInternal = mechanics || import.meta.env.MODE === 'play-internal';
export const rewardsEnabled = playInternal || import.meta.env.MODE === 'ad-preview';
export const playAds = registerPlugin('PlayAds');
export const playCatalog = registerPlugin('PlayCatalog');
