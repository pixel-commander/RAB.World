import './app-header.css';
import { data } from '../../data.ts';
import { useURL } from '../../hooks/useURL/useURL.ts';
import { NavItem } from './nav-item/NavItem.tsx';

const wordmark = 'rraabbiitt';

export const AppHeader = () => {
  const [url, handleURL] = useURL();
  const current = (url.page as string) || 'home';
  return (
    <>
      <div data-area="side">
        <div className="app-header__brand inner pad">
          <span className="app-header__mark">{data.brand.mark}</span>
          <span className="app-header__wordmark" aria-label={data.brand.title}>
            {Array.from(wordmark).map((letter, index) => (
              <span
                key={`${letter}-${index}`}
                className={index % 2 === 1 ? 'app-header__brand-letter--muted' : undefined}
                aria-hidden="true"
              >
                {letter}
              </span>
            ))}
            <span aria-hidden="true">.labs</span>
          </span>
        </div>
      </div>
      <div data-area="main">
        <div className="app-header__right inner pad">
          <nav className="app-header__nav container-cell container-cell--inset">
            {data.siteNav.map(({ label, page }) => (
              <NavItem
                key={page}
                label={label}
                current={page === current}
                onClick={() => handleURL({ page }, 'set-path')}
              />
            ))}
          </nav>
          <select className="app-header__model action-main" name="rabbit-model"
            data-id="rabbit-model" aria-label="Background model" defaultValue="rabbit">
            <option value="rabbit-lo">Rabbit · low</option>
            <option value="rabbit">Rabbit</option>
            <option value="rabbit-hi">Rabbit · high</option>
            <option value="robot">Robot</option>
            <option value="skull">Skull</option>
            <option value="brain">Brain</option>
          </select>
          <div className="app-header__user">
            <span className="app-header__user-name">{data.brand.user}</span>
            <span className="app-header__avatar">{data.brand.initials}</span>
          </div>
        </div>
      </div>
    </>
  );
};
