import './activity.css';

export interface ActivityItem {
  text: string;
  meta: string;
}

export const Activity = ({ items = [] }: { items?: ActivityItem[] }) => (
  <div className="activity">
    {items.map(({ text, meta }) => (
      <div key={`${text}·${meta}`} className="activity__item">
        <span className="activity__text">{text}</span>
        <span className="activity__meta">{meta}</span>
      </div>
    ))}
  </div>
);
