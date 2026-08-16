// "Find Your Clan" search sidebar: a searchable, alphabetised directory of
// Scottish clan and Irish county names. Historical/genealogical names are
// public information, not reproduced from any site — this is an original
// list assembled from general knowledge of Scottish clans and the 32
// traditional Irish counties.
//
// Selecting a name (or submitting the search box) sends the visitor to the
// storefront search results for that name, so every entry resolves against
// the real catalog rather than a page that may not exist.
(() => {
  const SCOTTISH = [
    'Armstrong', 'Baird', 'Barclay', 'Bell', 'Boyd', 'Boyle', 'Bruce', 'Buchan', 'Buchanan', 'Burnett',
    'Cameron', 'Campbell', 'Carmichael', 'Carnegie', 'Chisholm', 'Colquhoun', 'Cranstoun', 'Crawford', 'Cumming',
    'Dalziel', 'Davidson', 'Douglas', 'Drummond', 'Dunbar', 'Dundas',
    'Elliot', 'Erskine',
    'Farquharson', 'Fergusson', 'Forbes', 'Forsyth', 'Fraser',
    'Gordon', 'Graham', 'Grant', 'Gunn', 'Guthrie',
    'Hamilton', 'Hay', 'Henderson', 'Home', 'Hume',
    'Innes', 'Irvine',
    'Johnstone',
    'Keith', 'Kennedy', 'Kerr', 'Kincaid',
    'Lamont', 'Leask', 'Leslie', 'Lindsay', 'Lockhart', 'Logan',
    'MacAlister', 'MacArthur', 'MacAulay', 'MacBean', 'MacBeth', 'MacColl', 'MacDonald', 'MacDonell', 'MacDougall',
    'MacDuff', 'MacEwen', 'MacFarlane', 'MacFie', 'MacGillivray', 'MacGregor', 'MacInnes', 'MacIntyre', 'MacKay',
    'MacKenzie', 'MacKinnon', 'MacKintosh', 'MacLachlan', 'MacLaren', 'MacLean', 'MacLellan', 'MacLeod',
    'MacMillan', 'MacNab', 'MacNaughton', 'MacNeil', 'MacNicol', 'MacPherson', 'MacQuarrie', 'MacQueen',
    'MacRae', 'MacTavish', 'MacThomas', 'Maitland', 'Malcolm', 'Matheson', 'Maxwell', 'Melville', 'Menzies',
    'Moffat', 'Moncreiffe', 'Montgomery', 'Morrison', 'Munro', 'Murray',
    'Nairn', 'Napier',
    'Ogilvie', 'Oliphant',
    'Ramsay', 'Robertson', 'Rollo', 'Rose', 'Ross', 'Rutherford',
    'Scott', 'Scrymgeour', 'Sempill', 'Shaw', 'Sinclair', 'Skene', 'Stewart', 'Stirling', 'Sutherland', 'Swinton',
    'Turnbull',
    'Urquhart',
    'Wallace', 'Wemyss',
  ].map((name) => ({ name, group: 'scottish' }));

  const IRISH = [
    'Antrim', 'Armagh', 'Carlow', 'Cavan', 'Clare', 'Cork', 'Derry', 'Donegal', 'Down', 'Dublin',
    'Fermanagh', 'Galway', 'Kerry', 'Kildare', 'Kilkenny', 'Laois', 'Leitrim', 'Limerick', 'Longford', 'Louth',
    'Mayo', 'Meath', 'Monaghan', 'Offaly', 'Roscommon', 'Sligo', 'Tipperary', 'Tyrone', 'Waterford', 'Westmeath',
    'Wexford', 'Wicklow',
  ].map((name) => ({ name, group: 'irish' }));

  const ALL_NAMES = [...SCOTTISH, ...IRISH].sort((a, b) => a.name.localeCompare(b.name));

  class ClanFinder extends HTMLElement {
    connectedCallback() {
      this.panel = this.querySelector('[data-clan-finder-panel]');
      this.backdrop = this.querySelector('[data-clan-finder-backdrop]');
      this.list = this.querySelector('[data-clan-finder-list]');
      this.searchInput = this.querySelector('[data-clan-finder-search]');
      this.alphabet = this.querySelector('[data-clan-finder-alphabet]');
      this.tabs = [...this.querySelectorAll('[data-clan-finder-tab]')];
      this.activeGroup = 'scottish';
      this.activeLetter = null;

      this.buildAlphabet();
      this.renderList();

      this.querySelectorAll('[data-clan-finder-open]').forEach((btn) =>
        btn.addEventListener('click', () => this.open())
      );
      this.querySelectorAll('[data-clan-finder-close]').forEach((btn) =>
        btn.addEventListener('click', () => this.close())
      );
      this.backdrop?.addEventListener('click', () => this.close());
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && this.classList.contains('clan-finder--open')) this.close();
      });

      this.tabs.forEach((tab) =>
        tab.addEventListener('click', () => {
          this.activeGroup = tab.dataset.clanFinderTab;
          this.activeLetter = null;
          this.tabs.forEach((t) => t.classList.toggle('clan-finder__tab--active', t === tab));
          this.buildAlphabet();
          this.renderList();
        })
      );

      this.searchInput?.addEventListener('input', () => {
        this.activeLetter = null;
        this.renderList();
      });

      this.searchInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          this.search(this.searchInput.value);
        }
      });

      this.querySelector('[data-clan-finder-search-button]')?.addEventListener('click', () => {
        this.search(this.searchInput.value);
      });
    }

    open() {
      this.classList.add('clan-finder--open');
      document.body.style.overflow = 'hidden';
      this.searchInput?.focus();
    }

    close() {
      this.classList.remove('clan-finder--open');
      document.body.style.overflow = '';
    }

    namesInGroup() {
      return ALL_NAMES.filter((entry) => entry.group === this.activeGroup);
    }

    buildAlphabet() {
      if (!this.alphabet) return;
      const letters = [...new Set(this.namesInGroup().map((entry) => entry.name[0].toUpperCase()))].sort();
      this.alphabet.innerHTML = '';
      const allButton = document.createElement('button');
      allButton.type = 'button';
      allButton.textContent = 'All';
      allButton.className = 'clan-finder__letter clan-finder__letter--active';
      allButton.addEventListener('click', () => this.selectLetter(null, allButton));
      this.alphabet.appendChild(allButton);
      for (const letter of letters) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = letter;
        button.className = 'clan-finder__letter';
        button.addEventListener('click', () => this.selectLetter(letter, button));
        this.alphabet.appendChild(button);
      }
    }

    selectLetter(letter, button) {
      this.activeLetter = letter;
      if (this.searchInput) this.searchInput.value = '';
      this.alphabet.querySelectorAll('.clan-finder__letter').forEach((b) =>
        b.classList.toggle('clan-finder__letter--active', b === button)
      );
      this.renderList();
    }

    renderList() {
      if (!this.list) return;
      const query = (this.searchInput?.value || '').trim().toLowerCase();
      let names = this.namesInGroup();
      if (this.activeLetter) names = names.filter((entry) => entry.name.toUpperCase().startsWith(this.activeLetter));
      if (query) names = names.filter((entry) => entry.name.toLowerCase().includes(query));

      this.list.innerHTML = '';
      if (!names.length) {
        const empty = document.createElement('li');
        empty.className = 'clan-finder__empty';
        empty.textContent = 'No matches — try a different search or letter.';
        this.list.appendChild(empty);
        return;
      }
      for (const entry of names) {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = `/search?q=${encodeURIComponent(`"${entry.name} tartan"`)}`;
        link.textContent = entry.name;
        item.appendChild(link);
        this.list.appendChild(item);
      }
    }

    search(term) {
      const trimmed = term.trim();
      if (!trimmed) return;
      window.location.href = `/search?q=${encodeURIComponent(`"${trimmed} tartan"`)}`;
    }
  }

  customElements.define('clan-finder', ClanFinder);
})();
