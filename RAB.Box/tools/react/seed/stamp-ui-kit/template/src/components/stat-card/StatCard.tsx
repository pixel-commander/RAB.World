import './stat-card.css';

interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  direction?: 'up' | 'down';
}

export const StatCard = ({ label, value, delta, direction }: StatCardProps) => (
  <article className="stat-card container-main">
    <span className="stat-card__label">{label}</span>
    <span className="stat-card__value">{value}</span>
    {delta != null && (
      <span className={`stat-card__delta${direction ? ` stat-card__delta--${direction}` : ''}`}>
        {delta}
      </span>
    )}
  </article>
);
