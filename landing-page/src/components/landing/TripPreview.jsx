const interests = ["Scenic places", "Coffee", "Small towns", "Waterfalls", "Local food"];
const stops = ["Local bakery", "Scenic lookout", "Small-town market", "Waterfall trail", "Independent restaurant"];

export default function TripPreview() {
  return (
    <div className="trip-preview">
      <div className="preview-controls">
        <p className="preview-label">Product preview · example only</p><h3>Build a day around you.</h3>
        <dl className="preview-facts"><div><dt>Starting from</dt><dd>Clinton, Ontario</dd></div><div><dt>Direction</dt><dd>North ↑</dd></div><div><dt>Adventure time</dt><dd>3 hours</dd></div></dl>
        <div><p className="mini-label">Interests</p><div className="chips">{interests.map((item) => <span key={item}>{item}</span>)}</div></div>
      </div>
      <div className="route-result">
        <div className="map-preview" aria-label="Stylized example map with a route and five stops"><span className="road road--one" /><span className="road road--two" /><span className="route-line" />{[1,2,3,4,5].map((item) => <span key={item} className={`map-stop map-stop--${item}`}>{item}</span>)}</div>
        {/* Replace this CSS map with a real route screenshot or animation when approved media is available. */}
        <div className="route-copy"><p className="preview-label">Example route · not live or guaranteed</p><h3>Your Saturday Adventure</h3><ol>{stops.map((stop, index) => <li key={stop}><span>{index + 1}</span>{stop}</li>)}</ol></div>
      </div>
    </div>
  );
}
