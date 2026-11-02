// Tablero de Analítica Institucional - Fiscalía General de la Nación
// Monitoreo Integral: Noticias Criminales (SPOA) y Control de Ingresos Casos URI

(function() {
  'use strict';

  // Global Active Module ('noticias' or 'uri')
  let currentModule = 'noticias';

  // ==========================================
  // MODULE 1 STATE: NOTICIAS CRIMINALES
  // ==========================================
  let rawNoticias = [];
  let uniqueNoticias = [];
  let noticiasState = {
    municipio: 'ALL',
    tipoNoticia: 'ALL',
    fechaInicio: '',
    fechaFin: '',
    countMode: 'DISTINCT',
    searchQuery: '',
    delitoQuery: '',
    barDelitoQuery: '',
    page: 1,
    pageSize: 20
  };

  let chartNoticiasLine = null;
  let chartNoticiasBar = null;
  let chartNoticiasDonut = null;

  // ==========================================
  // MODULE 2 STATE: CASOS INGRESO URI
  // ==========================================
  let rawUriCases = [];
  let uriState = {
    delito: 'ALL',
    delitoQuery: '',
    barDelitoQuery: '',
    tipoCaptura: 'ALL',
    medida: 'ALL',
    imputacion: 'ALL',
    searchQuery: '',
    page: 1,
    pageSize: 20
  };

  let chartUriTimeline = null;
  let chartUriDelitos = null;
  let chartUriTipoCaptura = null;
  let chartUriMedida = null;
  let chartUriImputacion = null;

  // ==========================================
  // GLOBAL CHART.JS DATALABELS PLUGIN
  // ==========================================
  const datalabelsPlugin = {
    id: 'datalabelsPlugin',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const chartType = chart.config.type;
      const isHorizontal = chart.config.options?.indexAxis === 'y';

      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (meta.hidden) return;

        meta.data.forEach((element, index) => {
          const val = dataset.data[index];
          if (val === undefined || val === null || val === 0) return;

          ctx.save();
          ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
          ctx.fillStyle = '#0b2545';
          ctx.textBaseline = 'middle';

          if (chartType === 'line') {
            ctx.textAlign = 'center';
            ctx.fillText(val, element.x, element.y - 14);
          } else if (chartType === 'bar') {
            if (isHorizontal) {
              ctx.textAlign = 'left';
              ctx.fillText(` ${val}`, element.x + 6, element.y);
            } else {
              ctx.textAlign = 'center';
              ctx.fillText(val, element.x, element.y - 10);
            }
          }
          ctx.restore();
        });
      });
    }
  };

  if (typeof Chart !== 'undefined') {
    Chart.register(datalabelsPlugin);
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================
  document.addEventListener('DOMContentLoaded', () => {
    initDatasets();
    setupNavigation();
    setupNoticiasListeners();
    setupUriListeners();
    updateNoticiasDashboard();
    updateUriDashboard();
  });

  function initDatasets() {
    // 1. Noticias dataset
    if (window.DATASET_NOTICIAS && window.DATASET_NOTICIAS.registros) {
      rawNoticias = window.DATASET_NOTICIAS.registros;
      uniqueNoticias = window.DATASET_NOTICIAS.noticias_unicas;
      initNoticiasDateRange();
      populateNoticiasFilters();
    }

    // 2. URI dataset
    if (window.DATASET_URI && window.DATASET_URI.casos) {
      rawUriCases = window.DATASET_URI.casos;
      populateUriFilters();
    }
  }

  // ==========================================
  // NAVIGATION BETWEEN MODULES
  // ==========================================
  function setupNavigation() {
    const btnNoticias = document.getElementById('btnTabNoticias');
    const btnUri = document.getElementById('btnTabUri');

    if (btnNoticias) {
      btnNoticias.addEventListener('click', () => switchModule('noticias'));
    }
    if (btnUri) {
      btnUri.addEventListener('click', () => switchModule('uri'));
    }

    // Export CSV handles active module
    const btnExportCSV = document.getElementById('btnExportCSV');
    if (btnExportCSV) {
      btnExportCSV.addEventListener('click', () => {
        if (currentModule === 'noticias') exportNoticiasCSV();
        else exportUriCSV();
      });
    }

    // Print
    const btnPrint = document.getElementById('btnPrintReport');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => window.print());
    }

    // Modal
    const modalClose = document.getElementById('modalCloseBtn');
    const modalOverlay = document.getElementById('detailModal');
    if (modalClose && modalOverlay) {
      modalClose.addEventListener('click', () => modalOverlay.classList.remove('active'));
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) modalOverlay.classList.remove('active');
      });
    }
  }

  function switchModule(moduleName) {
    currentModule = moduleName;

    const modNoticias = document.getElementById('moduleNoticias');
    const modUri = document.getElementById('moduleUri');
    const btnNoticias = document.getElementById('btnTabNoticias');
    const btnUri = document.getElementById('btnTabUri');
    const titleEl = document.getElementById('mainHeaderTitle');

    if (moduleName === 'noticias') {
      modNoticias.classList.add('active');
      modUri.classList.remove('active');
      btnNoticias.classList.add('active');
      btnUri.classList.remove('active');
      if (titleEl) titleEl.textContent = 'Tablero de Analítica: Noticias Criminales Creadas';
      updateNoticiasDashboard();
    } else {
      modNoticias.classList.remove('active');
      modUri.classList.add('active');
      btnNoticias.classList.remove('active');
      btnUri.classList.add('active');
      if (titleEl) titleEl.textContent = 'Tablero de Analítica: Control de Ingresos Casos URI';
      updateUriDashboard();
    }
  }
  window.switchModule = switchModule;

  // ==========================================
  // MÓDULO 1: NOTICIAS LOGIC
  // ==========================================
  function initNoticiasDateRange() {
    const dates = rawNoticias.map(r => r.fecha_dia).filter(Boolean).sort();
    if (dates.length > 0) {
      noticiasState.fechaInicio = dates[0];
      noticiasState.fechaFin = dates[dates.length - 1];

      const inputInicio = document.getElementById('filterFechaInicio');
      const inputFin = document.getElementById('filterFechaFin');
      if (inputInicio) inputInicio.value = noticiasState.fechaInicio;
      if (inputFin) inputFin.value = noticiasState.fechaFin;
    }
  }

  function populateNoticiasFilters() {
    const muniSelect = document.getElementById('filterMunicipio');
    if (muniSelect) {
      const munis = [...new Set(rawNoticias.map(r => r.municipio_hechos).filter(Boolean))].sort();
      muniSelect.innerHTML = '<option value="ALL">Todos los Municipios</option>';
      munis.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        muniSelect.appendChild(opt);
      });
    }

    const tipoSelect = document.getElementById('filterTipo');
    if (tipoSelect) {
      const tipos = [...new Set(rawNoticias.map(r => r.tipo_noticia).filter(Boolean))].sort();
      tipoSelect.innerHTML = '<option value="ALL">Todos los Tipos de Noticia</option>';
      tipos.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        tipoSelect.appendChild(opt);
      });
    }
  }

  function setupNoticiasListeners() {
    const muniSelect = document.getElementById('filterMunicipio');
    if (muniSelect) {
      muniSelect.addEventListener('change', (e) => {
        noticiasState.municipio = e.target.value;
        noticiasState.page = 1;
        updateNoticiasDashboard();
      });
    }

    const tipoSelect = document.getElementById('filterTipo');
    if (tipoSelect) {
      tipoSelect.addEventListener('change', (e) => {
        noticiasState.tipoNoticia = e.target.value;
        noticiasState.page = 1;
        updateNoticiasDashboard();
      });
    }

    const inputInicio = document.getElementById('filterFechaInicio');
    if (inputInicio) {
      inputInicio.addEventListener('change', (e) => {
        noticiasState.fechaInicio = e.target.value;
        noticiasState.page = 1;
        updateNoticiasDashboard();
      });
    }

    const inputFin = document.getElementById('filterFechaFin');
    if (inputFin) {
      inputFin.addEventListener('change', (e) => {
        noticiasState.fechaFin = e.target.value;
        noticiasState.page = 1;
        updateNoticiasDashboard();
      });
    }

    const countToggle = document.getElementById('countModeSelect');
    if (countToggle) {
      countToggle.addEventListener('change', (e) => {
        noticiasState.countMode = e.target.value;
        updateNoticiasDashboard();
      });
    }

    // Delito text filter
    const delitoInput = document.getElementById('filterDelitoInput');
    if (delitoInput) {
      delitoInput.addEventListener('input', (e) => {
        noticiasState.delitoQuery = e.target.value.toLowerCase().trim();
        noticiasState.page = 1;
        updateNoticiasDashboard();
      });
    }

    // Delito bar chart live search
    const barDelitoInput = document.getElementById('barDelitoSearch');
    if (barDelitoInput) {
      barDelitoInput.addEventListener('input', (e) => {
        noticiasState.barDelitoQuery = e.target.value.toLowerCase().trim();
        renderNoticiasBarChart(getFilteredNoticias());
      });
    }

    const searchInput = document.getElementById('tableSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        noticiasState.searchQuery = e.target.value.toLowerCase().trim();
        noticiasState.page = 1;
        renderNoticiasTable();
      });
    }

    const btnReset = document.getElementById('btnResetFilters');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        noticiasState.municipio = 'ALL';
        noticiasState.tipoNoticia = 'ALL';
        noticiasState.delitoQuery = '';
        noticiasState.barDelitoQuery = '';
        noticiasState.searchQuery = '';
        noticiasState.page = 1;
        initNoticiasDateRange();
        if (muniSelect) muniSelect.value = 'ALL';
        if (tipoSelect) tipoSelect.value = 'ALL';
        if (delitoInput) delitoInput.value = '';
        if (barDelitoInput) barDelitoInput.value = '';
        if (searchInput) searchInput.value = '';
        updateNoticiasDashboard();
      });
    }
  }

  function getFilteredNoticias() {
    return rawNoticias.filter(r => {
      if (noticiasState.municipio !== 'ALL' && r.municipio_hechos !== noticiasState.municipio) return false;
      if (noticiasState.tipoNoticia !== 'ALL' && r.tipo_noticia !== noticiasState.tipoNoticia) return false;
      if (noticiasState.fechaInicio && r.fecha_dia < noticiasState.fechaInicio) return false;
      if (noticiasState.fechaFin && r.fecha_dia > noticiasState.fechaFin) return false;
      if (noticiasState.delitoQuery && (!r.delito || !r.delito.toLowerCase().includes(noticiasState.delitoQuery))) return false;
      return true;
    });
  }

  function getDistinctFilteredNoticias(records) {
    const map = new Map();
    records.forEach(r => {
      if (!map.has(r.id)) {
        map.set(r.id, {
          id: r.id,
          fecha_noticia: r.fecha_noticia,
          fecha_dia: r.fecha_dia,
          fecha_denuncia: r.fecha_denuncia,
          fecha_hechos: r.fecha_hechos,
          tipo_noticia: r.tipo_noticia,
          estado: r.estado,
          departamento_hechos: r.departamento_hechos,
          municipio_hechos: r.municipio_hechos,
          direccion: r.direccion,
          delito_principal: r.delito,
          delitos: [r.delito],
          despacho: r.despacho,
          receptor: r.receptor,
          total_delitos: 1
        });
      } else {
        const item = map.get(r.id);
        if (!item.delitos.includes(r.delito)) item.delitos.push(r.delito);
        item.total_delitos++;
      }
    });
    return Array.from(map.values());
  }

  function updateNoticiasDashboard() {
    const filteredRecords = getFilteredNoticias();
    const filteredDistinct = getDistinctFilteredNoticias(filteredRecords);

    // KPIs
    const totalDistintivo = filteredDistinct.length;
    const totalRegistros = filteredRecords.length;

    const kpiDistintivoEl = document.getElementById('kpiTotalDistintivo');
    if (kpiDistintivoEl) kpiDistintivoEl.textContent = totalDistintivo.toLocaleString('es-CO');

    // Delito Mayor Incidencia
    const delitoCounts = {};
    filteredRecords.forEach(r => {
      if (r.delito) delitoCounts[r.delito] = (delitoCounts[r.delito] || 0) + 1;
    });

    let topDelitoName = 'SIN DATO';
    let topDelitoCount = 0;
    for (const [delito, count] of Object.entries(delitoCounts)) {
      if (count > topDelitoCount) {
        topDelitoCount = count;
        topDelitoName = delito;
      }
    }

    const kpiTopDelitoCountEl = document.getElementById('kpiTopDelitoCount');
    const kpiTopDelitoNameEl = document.getElementById('kpiTopDelitoName');
    if (kpiTopDelitoCountEl && kpiTopDelitoNameEl) {
      if (topDelitoCount > 0) {
        kpiTopDelitoCountEl.textContent = `${topDelitoCount} noticias`;
        kpiTopDelitoNameEl.textContent = topDelitoName;
        kpiTopDelitoNameEl.title = topDelitoName;
      } else {
        kpiTopDelitoCountEl.textContent = '0';
        kpiTopDelitoNameEl.textContent = 'Sin datos coincidentes';
      }
    }

    // Municipios
    const uniqueMunis = new Set(filteredRecords.map(r => r.municipio_hechos).filter(Boolean));
    const kpiMunisEl = document.getElementById('kpiMunicipios');
    if (kpiMunisEl) kpiMunisEl.textContent = uniqueMunis.size;

    // Daily Average
    const uniqueDays = new Set(filteredRecords.map(r => r.fecha_dia).filter(Boolean));
    const avgDaily = uniqueDays.size > 0 ? (totalDistintivo / uniqueDays.size).toFixed(1) : 0;
    const kpiAvgEl = document.getElementById('kpiPromedioDiario');
    if (kpiAvgEl) kpiAvgEl.textContent = avgDaily;

    const ribbonText = document.getElementById('ribbonSummary');
    if (ribbonText) ribbonText.innerHTML = `Mostrando <strong>${totalDistintivo}</strong> noticias únicas y <strong>${totalRegistros}</strong> hechos punibles tipificados.`;

    // Active filters
    const container = document.getElementById('activeFiltersContainer');
    if (container) {
      const badges = [];
      if (noticiasState.municipio !== 'ALL') badges.push(`<span>Municipio: <strong>${noticiasState.municipio}</strong></span>`);
      if (noticiasState.tipoNoticia !== 'ALL') badges.push(`<span>Tipo: <strong>${noticiasState.tipoNoticia}</strong></span>`);
      if (noticiasState.fechaInicio && noticiasState.fechaFin) badges.push(`<span>Fechas: <strong>${noticiasState.fechaInicio}</strong> a <strong>${noticiasState.fechaFin}</strong></span>`);
      badges.push(`<span>Modo: <strong>${noticiasState.countMode === 'DISTINCT' ? 'Noticias Únicas' : 'Total Hechos'}</strong></span>`);
      container.innerHTML = badges.map(b => `<div class="active-filter-pill">${b}</div>`).join('');
    }

    renderNoticiasLineChart(filteredRecords, filteredDistinct);
    renderNoticiasBarChart(filteredRecords);
    renderNoticiasDonutChart(filteredRecords, filteredDistinct);
    renderNoticiasTable(filteredRecords, filteredDistinct);
  }

  function renderNoticiasLineChart(records, noticias) {
    const ctx = document.getElementById('lineChartCreacion');
    if (!ctx) return;

    const dateCounts = {};
    const datasetToUse = noticiasState.countMode === 'DISTINCT' ? noticias : records;
    const allKnownDays = ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'];
    allKnownDays.forEach(d => { dateCounts[d] = 0; });

    datasetToUse.forEach(item => {
      if (item.fecha_dia) dateCounts[item.fecha_dia] = (dateCounts[item.fecha_dia] || 0) + 1;
    });

    const filteredDays = allKnownDays.filter(d => {
      if (noticiasState.fechaInicio && d < noticiasState.fechaInicio) return false;
      if (noticiasState.fechaFin && d > noticiasState.fechaFin) return false;
      return true;
    });

    const dataValues = filteredDays.map(d => dateCounts[d] || 0);
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const displayLabels = filteredDays.map(l => {
      const parts = l.split('-');
      return `${parts[2]} ${monthNames[parseInt(parts[1], 10) - 1]}`;
    });

    if (chartNoticiasLine) chartNoticiasLine.destroy();

    const chartContext = ctx.getContext('2d');
    const gradient = chartContext.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(19, 64, 116, 0.28)');
    gradient.addColorStop(1, 'rgba(19, 64, 116, 0.01)');

    chartNoticiasLine = new Chart(ctx, {
      type: 'line',
      data: {
        labels: displayLabels,
        datasets: [{
          label: noticiasState.countMode === 'DISTINCT' ? 'Noticias Creadas (SPOA Únicas)' : 'Total Conductas / Delitos',
          data: dataValues,
          borderColor: '#0b2545',
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.28,
          pointBackgroundColor: '#c59b27',
          pointBorderColor: '#0b2545',
          pointBorderWidth: 2,
          pointRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 25, right: 15, left: 10, bottom: 5 } },
        scales: {
          x: { ticks: { autoSkip: false, color: '#1e293b', font: { size: 12, weight: '700' } } },
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  function renderNoticiasBarChart(records) {
    const ctx = document.getElementById('barChartNoticias');
    if (!ctx) return;

    const counts = {};
    records.forEach(r => {
      if (r.delito) counts[r.delito] = (counts[r.delito] || 0) + 1;
    });

    let entries = Object.entries(counts);
    if (noticiasState.barDelitoQuery) {
      entries = entries.filter(e => e[0].toLowerCase().includes(noticiasState.barDelitoQuery));
    }

    const sorted = entries.sort((a, b) => b[1] - a[1]).slice(0, 8);
    const labels = sorted.map(e => e[0].length > 28 ? e[0].substring(0, 26) + '...' : e[0]);
    const dataValues = sorted.map(e => e[1]);
    const totalCount = dataValues.reduce((a, b) => a + b, 0) || 1;

    if (chartNoticiasBar) chartNoticiasBar.destroy();

    const colors = ['#0b2545', '#134074', '#1d4ed8', '#0284c7', '#c59b27', '#d97706', '#059669', '#475569'];

    chartNoticiasBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: dataValues,
          backgroundColor: colors.slice(0, labels.length),
          borderRadius: 6,
          maxBarThickness: 24
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 15, right: 35, left: 5, bottom: 5 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: items => sorted[items[0].dataIndex][0],
              label: ctx => ` ${ctx.parsed.x} noticias (${((ctx.parsed.x / totalCount) * 100).toFixed(1)}%)`
            }
          }
        },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 } },
          y: { grid: { display: false }, ticks: { color: '#0f172a', font: { size: 11, weight: '600' } } }
        }
      }
    });
  }

  function renderNoticiasDonutChart(records, noticias) {
    const ctx = document.getElementById('donutChartTipo');
    if (!ctx) return;

    const counts = {};
    const datasetToUse = noticiasState.countMode === 'DISTINCT' ? noticias : records;
    datasetToUse.forEach(r => {
      const val = r.tipo_noticia || 'SIN DATO';
      counts[val] = (counts[val] || 0) + 1;
    });

    if (chartNoticiasDonut) chartNoticiasDonut.destroy();

    chartNoticiasDonut = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(counts),
        datasets: [{
          data: Object.values(counts),
          backgroundColor: ['#0b2545', '#1d4ed8', '#c59b27', '#059669', '#7c3aed'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        cutout: '62%'
      }
    });
  }

  function renderNoticiasTable(records, noticias) {
    const tbody = document.getElementById('tableNoticiasBody');
    if (!tbody) return;

    records = records || getFilteredNoticias();
    noticias = noticias || getDistinctFilteredNoticias(records);

    let items = noticias;
    if (noticiasState.searchQuery) {
      const q = noticiasState.searchQuery;
      items = noticias.filter(n => (
        (n.id && n.id.toLowerCase().includes(q)) ||
        (n.municipio_hechos && n.municipio_hechos.toLowerCase().includes(q)) ||
        (n.delito_principal && n.delito_principal.toLowerCase().includes(q))
      ));
    }

    const total = items.length;
    const totalPages = Math.ceil(total / noticiasState.pageSize) || 1;
    if (noticiasState.page > totalPages) noticiasState.page = totalPages;

    const start = (noticiasState.page - 1) * noticiasState.pageSize;
    const pageItems = items.slice(start, start + noticiasState.pageSize);

    const countInfo = document.getElementById('tableCountInfo');
    if (countInfo) countInfo.textContent = `Mostrando ${total === 0 ? 0 : start + 1} - ${Math.min(start + noticiasState.pageSize, total)} de ${total} noticias`;

    tbody.innerHTML = pageItems.map(item => {
      let badgeClass = 'tipo-denuncia';
      if (item.tipo_noticia.includes('QUERELLA')) badgeClass = 'tipo-querella';
      else if (item.tipo_noticia.includes('ACTOS')) badgeClass = 'tipo-actos-urgentes';

      return `
        <tr>
          <td><strong style="color: #0b2545; font-family: monospace;">${item.id}</strong></td>
          <td>${item.fecha_noticia ? item.fecha_noticia.substring(0, 16) : '-'}</td>
          <td><span class="badge-tipo ${badgeClass}">${item.tipo_noticia}</span></td>
          <td>${item.departamento_hechos || 'SIN DATO'}</td>
          <td><strong>${item.municipio_hechos || 'SIN DATO'}</strong></td>
          <td>${item.delito_principal}</td>
          <td><span class="badge-estado estado-activo">ACTIVO</span></td>
          <td style="text-align: right;">
            <button class="btn-view-detail" onclick="showNoticiaDetail('${item.id}')">Ver Ficha</button>
          </td>
        </tr>
      `;
    }).join('');

    renderNoticiasPagination(totalPages);
  }

  function renderNoticiasPagination(totalPages) {
    const container = document.getElementById('paginationControls');
    if (!container) return;
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    container.innerHTML = `
      <button class="btn-page" ${noticiasState.page === 1 ? 'disabled' : ''} onclick="changeNoticiasPage(-1)">Anterior</button>
      <span style="font-size: 0.8rem; font-weight: 600; padding: 0 8px;">Página ${noticiasState.page} de ${totalPages}</span>
      <button class="btn-page" ${noticiasState.page === totalPages ? 'disabled' : ''} onclick="changeNoticiasPage(1)">Siguiente</button>
    `;
  }

  window.changeNoticiasPage = function(delta) {
    noticiasState.page += delta;
    renderNoticiasTable();
  };

  window.showNoticiaDetail = function(noticiaId) {
    const list = rawNoticias.filter(r => r.id === noticiaId);
    if (!list.length) return;
    const base = list[0];
    const modal = document.getElementById('detailModal');
    if (!modal) return;

    document.getElementById('modalNoticiaId').textContent = base.id;
    document.getElementById('modalTipo').textContent = base.tipo_noticia;
    document.getElementById('modalFechaCreacion').textContent = base.fecha_noticia || 'SIN DATO';
    document.getElementById('modalFechaDenuncia').textContent = base.fecha_denuncia || 'SIN DATO';
    document.getElementById('modalFechaHechos').textContent = base.fecha_hechos || 'SIN DATO';
    document.getElementById('modalDepartamento').textContent = base.departamento_hechos || 'SIN DATO';
    document.getElementById('modalMunicipio').textContent = base.municipio_hechos || 'SIN DATO';
    document.getElementById('modalDireccion').textContent = base.direccion || 'SIN DATO';
    document.getElementById('modalBarrio').textContent = base.barrio || 'SIN DATO';
    document.getElementById('modalDespacho').textContent = base.despacho || 'SIN DATO';
    document.getElementById('modalUnidad').textContent = base.unidad_receptora || 'SIN DATO';
    document.getElementById('modalReceptor').textContent = base.receptor || 'SIN DATO';
    document.getElementById('modalSeccional').textContent = base.seccional || 'SIN DATO';

    const uniqueDelitos = [...new Set(list.map(r => r.delito).filter(Boolean))];
    document.getElementById('modalDelitosList').innerHTML = uniqueDelitos.map(d => `<li><strong>${d}</strong></li>`).join('');
    modal.classList.add('active');
  };

  function exportNoticiasCSV() {
    const distinct = getDistinctFilteredNoticias(getFilteredNoticias());
    let csv = '\uFEFFNumero Noticia,Fecha Creacion,Tipo Noticia,Municipio,Delito Principal\n';
    distinct.forEach(n => {
      csv += `"${n.id}","${n.fecha_noticia}","${n.tipo_noticia}","${n.municipio_hechos}","${n.delito_principal}"\n`;
    });
    downloadBlob(csv, `Reporte_Noticias_${new Date().toISOString().substring(0, 10)}.csv`);
  }

  // ==========================================
  // MÓDULO 2: CASOS INGRESO URI LOGIC
  // ==========================================
  function populateUriFilters() {
    const delitoSelect = document.getElementById('filterUriDelito');
    if (delitoSelect) {
      const delitos = [...new Set(rawUriCases.map(r => r.delito).filter(Boolean))].sort();
      delitoSelect.innerHTML = '<option value="ALL">Todos los Delitos</option>';
      delitos.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d.length > 40 ? d.substring(0, 38) + '...' : d;
        delitoSelect.appendChild(opt);
      });
    }

    const capSelect = document.getElementById('filterUriTipoCaptura');
    if (capSelect) {
      const tipos = [...new Set(rawUriCases.map(r => r.tipo_captura).filter(t => t && t !== 'Pendiente' && !t.toLowerCase().includes('pendiente')))].sort();
      capSelect.innerHTML = '<option value="ALL">Todos los Tipos de Captura</option>';
      tipos.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        capSelect.appendChild(opt);
      });
    }

    const medSelect = document.getElementById('filterUriMedida');
    if (medSelect) {
      const medidas = [...new Set(rawUriCases.map(r => r.imposicion_medida).filter(Boolean))].sort();
      medSelect.innerHTML = '<option value="ALL">Todas las Medidas</option>';
      medidas.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        medSelect.appendChild(opt);
      });
    }

    const impSelect = document.getElementById('filterUriImputacion');
    if (impSelect) {
      const imputaciones = [...new Set(rawUriCases.map(r => r.formulacion_imputacion).filter(Boolean))].sort();
      impSelect.innerHTML = '<option value="ALL">Todas las Situaciones</option>';
      imputaciones.forEach(i => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
        impSelect.appendChild(opt);
      });
    }
  }

  function setupUriListeners() {
    const delitoSelect = document.getElementById('filterUriDelito');
    if (delitoSelect) {
      delitoSelect.addEventListener('change', (e) => {
        uriState.delito = e.target.value;
        uriState.page = 1;
        updateUriDashboard();
      });
    }

    // URI Delito text search
    const uriDelitoInput = document.getElementById('filterUriDelitoInput');
    if (uriDelitoInput) {
      uriDelitoInput.addEventListener('input', (e) => {
        uriState.delitoQuery = e.target.value.toLowerCase().trim();
        uriState.page = 1;
        updateUriDashboard();
      });
    }

    // URI Delito bar chart live search
    const barUriDelitoInput = document.getElementById('barUriDelitoSearch');
    if (barUriDelitoInput) {
      barUriDelitoInput.addEventListener('input', (e) => {
        uriState.barDelitoQuery = e.target.value.toLowerCase().trim();
        renderUriDelitosChart(getFilteredUriCases());
      });
    }

    const capSelect = document.getElementById('filterUriTipoCaptura');
    if (capSelect) {
      capSelect.addEventListener('change', (e) => {
        uriState.tipoCaptura = e.target.value;
        uriState.page = 1;
        updateUriDashboard();
      });
    }

    const medSelect = document.getElementById('filterUriMedida');
    if (medSelect) {
      medSelect.addEventListener('change', (e) => {
        uriState.medida = e.target.value;
        uriState.page = 1;
        updateUriDashboard();
      });
    }

    const impSelect = document.getElementById('filterUriImputacion');
    if (impSelect) {
      impSelect.addEventListener('change', (e) => {
        uriState.imputacion = e.target.value;
        uriState.page = 1;
        updateUriDashboard();
      });
    }

    const searchInput = document.getElementById('tableUriSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        uriState.searchQuery = e.target.value.toLowerCase().trim();
        uriState.page = 1;
        renderUriTable();
      });
    }

    const btnReset = document.getElementById('btnResetUriFilters');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        uriState.delito = 'ALL';
        uriState.delitoQuery = '';
        uriState.barDelitoQuery = '';
        uriState.tipoCaptura = 'ALL';
        uriState.medida = 'ALL';
        uriState.imputacion = 'ALL';
        uriState.searchQuery = '';
        uriState.page = 1;
        if (delitoSelect) delitoSelect.value = 'ALL';
        if (uriDelitoInput) uriDelitoInput.value = '';
        if (barUriDelitoInput) barUriDelitoInput.value = '';
        if (capSelect) capSelect.value = 'ALL';
        if (medSelect) medSelect.value = 'ALL';
        if (impSelect) impSelect.value = 'ALL';
        if (searchInput) searchInput.value = '';
        updateUriDashboard();
      });
    }
  }

  function getFilteredUriCases() {
    return rawUriCases.filter(c => {
      if (uriState.delito !== 'ALL' && c.delito !== uriState.delito) return false;
      if (uriState.delitoQuery && (!c.delito || !c.delito.toLowerCase().includes(uriState.delitoQuery))) return false;
      if (uriState.tipoCaptura !== 'ALL' && c.tipo_captura !== uriState.tipoCaptura) return false;
      if (uriState.medida !== 'ALL' && c.imposicion_medida !== uriState.medida) return false;
      if (uriState.imputacion !== 'ALL' && c.formulacion_imputacion !== uriState.imputacion) return false;
      return true;
    });
  }

  function updateUriDashboard() {
    const filtered = getFilteredUriCases();

    // 1. KPIs
    const totalProcesados = filtered.length;
    const kpiTotalEl = document.getElementById('kpiUriTotalProcesados');
    if (kpiTotalEl) kpiTotalEl.textContent = totalProcesados;

    // Top delito
    const delitoCounts = {};
    filtered.forEach(c => {
      if (c.delito) delitoCounts[c.delito] = (delitoCounts[c.delito] || 0) + 1;
    });
    let topName = 'SIN DATO';
    let topCount = 0;
    for (const [d, cnt] of Object.entries(delitoCounts)) {
      if (cnt > topCount) { topCount = cnt; topName = d; }
    }
    const kpiTopCountEl = document.getElementById('kpiUriTopDelitoCount');
    const kpiTopNameEl = document.getElementById('kpiUriTopDelitoName');
    if (kpiTopCountEl && kpiTopNameEl) {
      kpiTopCountEl.textContent = `${topCount} casos`;
      kpiTopNameEl.textContent = topName;
      kpiTopNameEl.title = topName;
    }

    // Flagrancias
    const flagrancias = filtered.filter(c => c.tipo_captura === 'Flagrancia').length;
    const kpiFlagEl = document.getElementById('kpiUriFlagrancias');
    if (kpiFlagEl) kpiFlagEl.textContent = flagrancias;

    // Carcelarias
    const carcelarias = filtered.filter(c => c.imposicion_medida === 'Carcelaria').length;
    const kpiCarcEl = document.getElementById('kpiUriCarcelarias');
    if (kpiCarcEl) kpiCarcEl.textContent = carcelarias;

    // Active filters
    const container = document.getElementById('activeUriFiltersContainer');
    if (container) {
      const badges = [];
      if (uriState.delito !== 'ALL') badges.push(`<span>Delito: <strong>${uriState.delito.substring(0, 25)}...</strong></span>`);
      if (uriState.tipoCaptura !== 'ALL') badges.push(`<span>Captura: <strong>${uriState.tipoCaptura}</strong></span>`);
      if (uriState.medida !== 'ALL') badges.push(`<span>Medida: <strong>${uriState.medida}</strong></span>`);
      if (uriState.imputacion !== 'ALL') badges.push(`<span>Imputación: <strong>${uriState.imputacion}</strong></span>`);
      container.innerHTML = badges.length ? badges.map(b => `<div class="active-filter-pill">${b}</div>`).join('') : '<span style="font-size:0.75rem; color:#94a3b8;">Sin filtros activos (Consolidado general)</span>';
    }

    renderUriTimeline(filtered);
    renderUriDelitosChart(filtered);
    renderUriTipoCapturaChart(filtered);
    renderUriMedidaChart(filtered);
    renderUriImputacionChart(filtered);
    renderUriTable(filtered);
  }

  // 1. Línea del tiempo por fechas de captura
  function renderUriTimeline(filtered) {
    const ctx = document.getElementById('lineChartUriCaptura');
    if (!ctx) return;

    const days = ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'];
    const counts = {};
    days.forEach(d => { counts[d] = 0; });

    filtered.forEach(c => {
      if (c.fecha_captura && counts[c.fecha_captura] !== undefined) {
        counts[c.fecha_captura]++;
      }
    });

    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const labels = days.map(d => {
      const p = d.split('-');
      return `${p[2]} ${monthNames[parseInt(p[1], 10) - 1]}`;
    });
    const values = days.map(d => counts[d]);

    if (chartUriTimeline) chartUriTimeline.destroy();

    const chartContext = ctx.getContext('2d');
    const gradient = chartContext.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(197, 155, 39, 0.35)');
    gradient.addColorStop(1, 'rgba(197, 155, 39, 0.02)');

    chartUriTimeline = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Personas Capturadas',
          data: values,
          borderColor: '#b45309',
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.28,
          pointBackgroundColor: '#0b2545',
          pointBorderColor: '#c59b27',
          pointBorderWidth: 2,
          pointRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 25, right: 15, left: 10, bottom: 5 } },
        scales: {
          x: { ticks: { autoSkip: false, color: '#0b2545', font: { size: 12, weight: '700' } } },
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  // 2. Delitos: cuántos por cada delito
  function renderUriDelitosChart(filtered) {
    const ctx = document.getElementById('barChartUriDelitos');
    if (!ctx) return;

    const counts = {};
    filtered.forEach(c => {
      if (c.delito) counts[c.delito] = (counts[c.delito] || 0) + 1;
    });

    let entries = Object.entries(counts);
    if (uriState.barDelitoQuery) {
      entries = entries.filter(e => e[0].toLowerCase().includes(uriState.barDelitoQuery));
    }

    const sorted = entries.sort((a, b) => b[1] - a[1]).slice(0, 7);
    const labels = sorted.map(e => e[0].length > 28 ? e[0].substring(0, 26) + '...' : e[0]);
    const values = sorted.map(e => e[1]);
    const total = values.reduce((a, b) => a + b, 0) || 1;

    if (chartUriDelitos) chartUriDelitos.destroy();

    const colors = ['#0b2545', '#134074', '#1d4ed8', '#c59b27', '#d97706', '#059669', '#7c3aed'];

    chartUriDelitos = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Procesados por Delito',
          data: values,
          backgroundColor: colors.slice(0, labels.length),
          borderRadius: 6,
          maxBarThickness: 24
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 15, right: 35, left: 5, bottom: 5 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: items => sorted[items[0].dataIndex][0],
              label: ctx => ` ${ctx.parsed.x} procesados (${((ctx.parsed.x / total) * 100).toFixed(1)}%)`
            }
          }
        },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 } },
          y: { grid: { display: false }, ticks: { color: '#0f172a', font: { size: 11, weight: '600' } } }
        }
      }
    });
  }

  // 3. Gráfica de barra por tipos de captura (excluye 'Pendiente')
  function renderUriTipoCapturaChart(filtered) {
    const ctx = document.getElementById('barChartUriTipoCaptura');
    if (!ctx) return;

    const counts = {};
    filtered.forEach(c => {
      const t = c.tipo_captura;
      if (t && t !== 'Pendiente' && !t.toLowerCase().includes('pendiente') && !t.toLowerCase().includes('sin clasificar')) {
        counts[t] = (counts[t] || 0) + 1;
      }
    });

    const labels = Object.keys(counts);
    const values = Object.values(counts);

    if (chartUriTipoCaptura) chartUriTipoCaptura.destroy();

    const colors = ['#0b2545', '#c59b27', '#1d4ed8'];

    chartUriTipoCaptura = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors.slice(0, labels.length),
          borderRadius: { topLeft: 6, topRight: 6 },
          maxBarThickness: 45
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 22, right: 10, left: 5, bottom: 5 } },
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#0f172a', font: { size: 11, weight: '700' } } },
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  // 4. Gráfica de barras por imposición de medida
  function renderUriMedidaChart(filtered) {
    const ctx = document.getElementById('barChartUriMedida');
    if (!ctx) return;

    const counts = {};
    filtered.forEach(c => {
      const m = c.imposicion_medida || 'En Trámite';
      counts[m] = (counts[m] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(e => e[0]);
    const values = sorted.map(e => e[1]);

    if (chartUriMedida) chartUriMedida.destroy();

    const colors = ['#64748b', '#0369a1', '#15803d', '#b91c1c', '#c59b27'];

    chartUriMedida = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors.slice(0, labels.length),
          borderRadius: { topLeft: 6, topRight: 6 },
          maxBarThickness: 42
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 22, right: 10, left: 5, bottom: 5 } },
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#0f172a', font: { size: 10.5, weight: '700' } } },
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  // 5. Gráfica de barras por formulación de imputación
  function renderUriImputacionChart(filtered) {
    const ctx = document.getElementById('barChartUriImputacion');
    if (!ctx) return;

    const counts = {};
    filtered.forEach(c => {
      const imp = c.formulacion_imputacion || 'Pendiente';
      counts[imp] = (counts[imp] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(e => e[0]);
    const values = sorted.map(e => e[1]);

    if (chartUriImputacion) chartUriImputacion.destroy();

    const colors = ['#64748b', '#0284c7', '#b91c1c', '#c59b27'];

    chartUriImputacion = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors.slice(0, labels.length),
          borderRadius: { topLeft: 6, topRight: 6 },
          maxBarThickness: 42
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 22, right: 10, left: 5, bottom: 5 } },
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#0f172a', font: { size: 10, weight: '700' } } },
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  // Table of Processed Persons
  function renderUriTable(filtered) {
    const tbody = document.getElementById('tableUriBody');
    if (!tbody) return;

    filtered = filtered || getFilteredUriCases();

    let items = filtered;
    if (uriState.searchQuery) {
      const q = uriState.searchQuery;
      items = filtered.filter(c => (
        (c.procesado && c.procesado.toLowerCase().includes(q)) ||
        (c.numero_documento && c.numero_documento.toLowerCase().includes(q)) ||
        (c.noticia_criminal && c.noticia_criminal.toLowerCase().includes(q)) ||
        (c.delito && c.delito.toLowerCase().includes(q)) ||
        (c.fiscal && c.fiscal.toLowerCase().includes(q))
      ));
    }

    const total = items.length;
    const totalPages = Math.ceil(total / uriState.pageSize) || 1;
    if (uriState.page > totalPages) uriState.page = totalPages;

    const start = (uriState.page - 1) * uriState.pageSize;
    const pageItems = items.slice(start, start + uriState.pageSize);

    const countInfo = document.getElementById('tableUriCountInfo');
    if (countInfo) countInfo.textContent = `Mostrando ${total === 0 ? 0 : start + 1} - ${Math.min(start + uriState.pageSize, total)} de ${total} casos`;

    tbody.innerHTML = pageItems.map(c => {
      let capBadge = 'tipo-denuncia';
      if (c.tipo_captura === 'Flagrancia') capBadge = 'tipo-actos-urgentes';
      else if (c.tipo_captura === 'Orden de Captura') capBadge = 'tipo-querella';

      let medBadge = 'estado-activo';
      if (c.imposicion_medida === 'Carcelaria') medBadge = 'tipo-actos-urgentes';
      else if (c.imposicion_medida.includes('Libertad')) medBadge = 'tipo-compulsacion';

      return `
        <tr>
          <td><strong>${c.num}</strong></td>
          <td>${c.fecha_captura} <span style="font-size:0.75rem; color:#64748b;">${c.hora_captura}</span></td>
          <td><strong style="color: #0b2545;">${c.procesado}</strong></td>
          <td><span style="font-family: monospace;">${c.tipo_documento} ${c.numero_documento || 'S/D'}</span></td>
          <td style="font-size: 0.8rem;">${c.delito}</td>
          <td>${(c.tipo_captura && c.tipo_captura !== 'Pendiente') ? `<span class="badge-tipo ${capBadge}">${c.tipo_captura}</span>` : '<span style="color:#94a3b8; font-size:0.8rem;">-</span>'}</td>
          <td><span class="badge-tipo ${medBadge}">${c.imposicion_medida}</span></td>
          <td><span style="font-size:0.76rem; font-weight:600;">${c.formulacion_imputacion}</span></td>
          <td style="font-size: 0.78rem;">${c.despacho}</td>
        </tr>
      `;
    }).join('');

    renderUriPagination(totalPages);
  }

  function renderUriPagination(totalPages) {
    const container = document.getElementById('paginationUriControls');
    if (!container) return;
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    container.innerHTML = `
      <button class="btn-page" ${uriState.page === 1 ? 'disabled' : ''} onclick="changeUriPage(-1)">Anterior</button>
      <span style="font-size: 0.8rem; font-weight: 600; padding: 0 8px;">Página ${uriState.page} de ${totalPages}</span>
      <button class="btn-page" ${uriState.page === totalPages ? 'disabled' : ''} onclick="changeUriPage(1)">Siguiente</button>
    `;
  }

  window.changeUriPage = function(delta) {
    uriState.page += delta;
    renderUriTable();
  };

  function exportUriCSV() {
    const filtered = getFilteredUriCases();
    let csv = '\uFEFFN,Fecha Captura,Hora,Procesado,Tipo Doc,Numero Doc,Delito,Tipo Captura,Medida,Imputacion,Fiscal\n';
    filtered.forEach(c => {
      csv += `"${c.num}","${c.fecha_captura}","${c.hora_captura}","${c.procesado}","${c.tipo_documento}","${c.numero_documento}","${c.delito}","${c.tipo_captura}","${c.imposicion_medida}","${c.formulacion_imputacion}","${c.fiscal}"\n`;
    });
    downloadBlob(csv, `Reporte_Casos_URI_${new Date().toISOString().substring(0, 10)}.csv`);
  }

  function downloadBlob(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

})();
