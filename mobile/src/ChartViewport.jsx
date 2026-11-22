import { useLayoutEffect, useRef, useState } from 'react';

export function ChartViewport({ label, className, children }) {
  const [zoom, setZoom] = useState(false);
  const region = useRef(null);
  useLayoutEffect(() => {
    const viewport = region.current;
    viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
  }, [zoom]);

  return <div className="chart-view">
    <div ref={region} className="chart-viewport" tabIndex={zoom ? 0 : undefined}
      aria-label={label} role={zoom ? 'region' : undefined}>
      <div className={zoom ? 'chart-size chart-size-zoomed' : 'chart-size'}>
        <div className={className}>{children}</div>
      </div>
    </div>
    <button type="button" className="secondary-button chart-zoom" aria-pressed={zoom} onClick={() => setZoom(value => !value)}>
      {zoom ? 'Уменьшить схему' : 'Увеличить схему'}
    </button>
  </div>;
}
