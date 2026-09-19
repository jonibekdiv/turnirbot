// Qidiruv va filtr yordamchilari

// Turnir qidirish
function searchTournaments(tours, query) {
  if (!query) return tours;
  const q = query.toLowerCase().trim();
  return tours.filter((t) =>
    (t.title || '').toLowerCase().includes(q) ||
    (t.mode || '').toLowerCase().includes(q) ||
    (t.map || '').toLowerCase().includes(q) ||
    (t.etapa || '').toLowerCase().includes(q) ||
    (t.id || '').toLowerCase().includes(q)
  );
}

// Komanda qidirish
function searchTeams(teams, query) {
  if (!query) return teams;
  const q = query.toLowerCase().trim();
  return teams.filter((t) =>
    (t.name || '').toLowerCase().includes(q) ||
    (t.tag || '').toLowerCase().includes(q)
  );
}

// Turnir filtrlash
function filterTournaments(tours, filters = {}) {
  let result = tours;

  if (filters.mode) {
    result = result.filter((t) => (t.mode || '').toLowerCase() === filters.mode.toLowerCase());
  }
  if (filters.map) {
    result = result.filter((t) => (t.map || '').toLowerCase().includes(filters.map.toLowerCase()));
  }
  if (filters.dateFrom) {
    result = result.filter((t) => t.date >= filters.dateFrom);
  }
  if (filters.dateTo) {
    result = result.filter((t) => t.date <= filters.dateTo);
  }
  if (filters.status === 'open') {
    result = result.filter((t) => t.registeredTeams.length < t.maxTeams && t.status !== 'cancelled');
  }
  if (filters.status === 'full') {
    result = result.filter((t) => t.registeredTeams.length >= t.maxTeams);
  }
  if (filters.status === 'cancelled') {
    result = result.filter((t) => t.status === 'cancelled');
  }

  return result;
}

// Filtr tugmalarini chiqarish
function getFilterModes() {
  return ['Solo', 'Duo', 'Squad'];
}

function getFilterMaps() {
  return ['Erangel', 'Miramar', 'Sanhok', 'Vikendi', 'Taego', 'Deston'];
}

module.exports = {
  searchTournaments,
  searchTeams,
  filterTournaments,
  getFilterModes,
  getFilterMaps,
};