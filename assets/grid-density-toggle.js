// Lets the visitor pick how many columns the product grid uses on desktop.
// Choice persists in localStorage so it carries across collection/search
// pages, matching the reference site's grid-density control.
if (!customElements.get('grid-density-toggle')) {
  customElements.define(
    'grid-density-toggle',
    class GridDensityToggle extends HTMLElement {
      constructor() {
        super();
        this.storageKey = 'grid-density-columns';
      }

      connectedCallback() {
        this.grid = document.getElementById('product-grid');
        if (!this.grid) return;

        const stored = Number(localStorage.getItem(this.storageKey));
        if (stored >= 1 && stored <= 5) this.setColumns(stored, false);
        else this.markActive(this.currentColumns());

        this.addEventListener('click', (event) => {
          const button = event.target.closest('.grid-density-toggle__button');
          if (!button) return;
          this.setColumns(Number(button.dataset.columns), true);
        });
      }

      currentColumns() {
        const match = [...this.grid.classList].find((c) => /^grid--\d-col-desktop$/.test(c));
        return match ? Number(match.match(/\d/)[0]) : 4;
      }

      setColumns(columns, persist) {
        [...this.grid.classList]
          .filter((c) => /^grid--\d-col-desktop$/.test(c))
          .forEach((c) => this.grid.classList.remove(c));
        this.grid.classList.add(`grid--${columns}-col-desktop`);
        if (persist) localStorage.setItem(this.storageKey, String(columns));
        this.markActive(columns);
      }

      markActive(columns) {
        this.querySelectorAll('.grid-density-toggle__button').forEach((button) => {
          const isActive = Number(button.dataset.columns) === columns;
          button.classList.toggle('grid-density-toggle__button--active', isActive);
          button.setAttribute('aria-pressed', isActive);
        });
      }
    }
  );
}
