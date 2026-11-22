export function ReadingText({ text }) {
  if (typeof text !== 'string' || !text.trim()) return null;

  return text.trim().split(/\r?\n\s*\r?\n/).map((section, index) => {
    const [first, ...rest] = section.split(/\r?\n/);
    const heading = first.match(/^#{1,4}\s+(.+)$|^\*\*(.+)\*\*$/);
    if (!heading) return <p key={index}>{section}</p>;
    return <div className="reading-section" key={index}>
      <h3>{heading[1] ?? heading[2]}</h3>
      {rest.length > 0 && <p>{rest.join('\n')}</p>}
    </div>;
  });
}
