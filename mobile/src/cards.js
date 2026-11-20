const images = import.meta.glob('../../client/public/tarot/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

export function cardImage(id) {
  return images[`../../client/public/tarot/${id}.webp`];
}
