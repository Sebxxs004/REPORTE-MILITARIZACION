// Tablero de Analítica Institucional - Fiscalía General de la Nación
// Monitoreo de Noticias Criminales - Militarización

(function() {
  'use strict';

  // Global State
  let rawRecords = [];
  let uniqueNoticias = [];
  
  let state = {
    municipio: 'ALL',
    tipoNoticia: 'ALL',
    fechaInicio: '',
    fechaFin: '',
    countMode: 'DISTINCT', // 'DISTINCT' (Noticias Únicas) or 'TOTAL' (Total Hechos)
    searchQuery: '',
    page: 1,
    pageSize: 20
  };

  // Chart instances
  let lineChartInstance = null;
  let barChartInstance = null;
  let donutChartInstance = null;

  // Custom Chart.js Plugin to draw value labels directly on bars & line points
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

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    loadDataset();
    setupEventListeners();
  });

  function loadDataset() {
    if (window.DATASET && window.DATASET.registros) {
      rawRecords = window.DATASET.registros;
      uniqueNoticias = window.DATASET.noticias_unicas;
      initDateRange();
      populateFilterOptions();
      updateDashboard();
    } else {
      console.warn('Dataset precompilado no encontrado.');
    }
  }

  function initDateRange() {
    const dates = rawRecords.map(r => r.fecha_dia).filter(Boolean).sort();
    if (dates.length > 0) {
      state.fechaInicio = dates[0];
      state.fechaFin = dates[dates.length - 1];

      const inputInicio = document.getElementById('filterFechaInicio');
      const inputFin = document.getElementById('filterFechaFin');
      if (inputInicio) inputInicio.value = state.fechaInicio;
      if (inputFin) inputFin.value = state.fechaFin;
    }
  }

  function populateFilterOptions() {
    // Populate Municipios de los Hechos (Reemplaza Departamento)
    const muniSelect = document.getElementById('filterMunicipio');
    if (muniSelect) {
      const munis = [...new Set(rawRecords.map(r => r.municipio_hechos).filter(Boolean))].sort();
      muniSelect.innerHTML = '<option value="ALL">Todos los Municipios</option>';
      munis.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        muniSelect.appendChild(opt);
      });
    }

    // Populate Tipos de Noticia
    const tipoSelect = document.getElementById('filterTipo');
    if (tipoSelect) {
      const tipos = [...new Set(rawRecords.map(r => r.tipo_noticia).filter(Boolean))].sort();
      tipoSelect.innerHTML = '<option value="ALL">Todos los Tipos de Noticia</option>';
      tipos.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        tipoSelect.appendChild(opt);
      });
    }
  }

  function setupEventListeners() {
    // Filter Municipio
    const muniSelect = document.getElementById('filterMunicipio');
    if (muniSelect) {
      muniSelect.addEventListener('change', (e) => {
        state.municipio = e.target.value;
        state.page = 1;
        updateDashboard();
      });
    }

    // Filter Tipos
    const tipoSelect = document.getElementById('filterTipo');
    if (tipoSelect) {
      tipoSelect.addEventListener('change', (e) => {
        state.tipoNoticia = e.target.value;
        state.page = 1;
        updateDashboard();
      });
    }

    // Date filters
    const inputInicio = document.getElementById('filterFechaInicio');
    if (inputInicio) {
      inputInicio.addEventListener('change', (e) => {
        state.fechaInicio = e.target.value;
        state.page = 1;
        updateDashboard();
      });
    }

    const inputFin = document.getElementById('filterFechaFin');
    if (inputFin) {
      inputFin.addEventListener('change', (e) => {
        state.fechaFin = e.target.value;
        state.page = 1;
        updateDashboard();
      });
    }

    // Count mode toggle
    const countToggle = document.getElementById('countModeSelect');
    if (countToggle) {
      countToggle.addEventListener('change', (e) => {
        state.countMode = e.target.value;
        updateDashboard();
      });
    }

    // Search query in table
    const searchInput = document.getElementById('tableSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        state.page = 1;
        renderTable();
      });
    }

    // Reset Filters button
    const btnReset = document.getElementById('btnResetFilters');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        state.municipio = 'ALL';
        state.tipoNoticia = 'ALL';
        state.searchQuery = '';
        state.page = 1;
        initDateRange();
        if (muniSelect) muniSelect.value = 'ALL';
        if (tipoSelect) tipoSelect.value = 'ALL';
        if (searchInput) searchInput.value = '';
        updateDashboard();
      });
    }

    // Excel upload handler
    const fileInput = document.getElementById('excelFileInput');
    if (fileInput) {
      fileInput.addEventListener('change', handleExcelUpload);
    }

    // Export CSV
    const btnExportCSV = document.getElementById('btnExportCSV');
    if (btnExportCSV) {
      btnExportCSV.addEventListener('click', exportToCSV);
    }

    // Print Report
    const btnPrint = document.getElementById('btnPrintReport');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => window.print());
    }

    // Modal close
    const modalClose = document.getElementById('modalCloseBtn');
    const modalOverlay = document.getElementById('detailModal');
    if (modalClose && modalOverlay) {
      modalClose.addEventListener('click', () => modalOverlay.classList.remove('active'));
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) modalOverlay.classList.remove('active');
      });
    }
  }

  // Filter evaluation logic
  function getFilteredRecords() {
    return rawRecords.filter(r => {
      if (state.municipio !== 'ALL' && r.municipio_hechos !== state.municipio) {
        return false;
      }
      if (state.tipoNoticia !== 'ALL' && r.tipo_noticia !== state.tipoNoticia) {
        return false;
      }
      if (state.fechaInicio && r.fecha_dia < state.fechaInicio) {
        return false;
      }
      if (state.fechaFin && r.fecha_dia > state.fechaFin) {
        return false;
      }
      return true;
    });
  }

  function getFilteredDistinctNoticias(filteredRecords) {
    const map = new Map();
    filteredRecords.forEach(r => {
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
          delito_agrupado: r.delito_agrupado,
          delitos: [r.delito],
          unidad_receptora: r.unidad_receptora,
          despacho: r.despacho,
          receptor: r.receptor,
          total_delitos: 1
        });
      } else {
        const item = map.get(r.id);
        if (!item.delitos.includes(r.delito)) {
          item.delitos.push(r.delito);
        }
        item.total_delitos++;
      }
    });
    return Array.from(map.values());
  }

  // Master Dashboard Updater
  function updateDashboard() {
    const filteredRecords = getFilteredRecords();
    const filteredNoticias = getFilteredDistinctNoticias(filteredRecords);

    renderKPIs(filteredRecords, filteredNoticias);
    renderActiveFilterBadges(filteredRecords, filteredNoticias);
    renderLineChart(filteredRecords, filteredNoticias);
    renderBarChart(filteredRecords, filteredNoticias);
    renderDonutChart(filteredRecords, filteredNoticias);
    renderTable(filteredRecords, filteredNoticias);
  }

  // Render KPIs
  function renderKPIs(filteredRecords, filteredNoticias) {
    const totalDistintivo = filteredNoticias.length;
    const totalRegistros = filteredRecords.length;

    // Distinct Noticias (Distintivo!)
    const kpiDistintivoEl = document.getElementById('kpiTotalDistintivo');
    if (kpiDistintivoEl) {
      kpiDistintivoEl.textContent = totalDistintivo.toLocaleString('es-CO');
    }

    // DELITO CON MAYOR NÚMERO DE NOTICIAS (Depende dinámicamente de los filtros)
    const delitoCounts = {};
    filteredRecords.forEach(r => {
      if (r.delito) {
        delitoCounts[r.delito] = (delitoCounts[r.delito] || 0) + 1;
      }
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

    // Total Records
    const kpiTotalEl = document.getElementById('kpiTotalRegistros');
    if (kpiTotalEl) {
      kpiTotalEl.textContent = totalRegistros.toLocaleString('es-CO');
    }

    // Unique Municipios
    const uniqueMunis = new Set(filteredRecords.map(r => r.municipio_hechos).filter(Boolean));
    const kpiMunisEl = document.getElementById('kpiMunicipios');
    if (kpiMunisEl) {
      kpiMunisEl.textContent = uniqueMunis.size;
    }

    // Daily Average
    const uniqueDays = new Set(filteredRecords.map(r => r.fecha_dia).filter(Boolean));
    const avgDaily = uniqueDays.size > 0 ? (totalDistintivo / uniqueDays.size).toFixed(1) : 0;
    const kpiAvgEl = document.getElementById('kpiPromedioDiario');
    if (kpiAvgEl) {
      kpiAvgEl.textContent = avgDaily;
    }

    // Ribbon subtitle
    const ribbonText = document.getElementById('ribbonSummary');
    if (ribbonText) {
      ribbonText.innerHTML = `Mostrando <strong>${totalDistintivo}</strong> noticias únicas y <strong>${totalRegistros}</strong> hechos punibles tipificados.`;
    }
  }

  // Active filters badges
  function renderActiveFilterBadges(filteredRecords, filteredNoticias) {
    const container = document.getElementById('activeFiltersContainer');
    if (!container) return;

    const badges = [];
    if (state.municipio !== 'ALL') {
      badges.push(`<span>Municipio: <strong>${state.municipio}</strong></span>`);
    }
    if (state.tipoNoticia !== 'ALL') {
      badges.push(`<span>Tipo: <strong>${state.tipoNoticia}</strong></span>`);
    }
    if (state.fechaInicio && state.fechaFin) {
      badges.push(`<span>Fechas: <strong>${state.fechaInicio}</strong> a <strong>${state.fechaFin}</strong></span>`);
    }
    badges.push(`<span>Modo: <strong>${state.countMode === 'DISTINCT' ? 'Noticias Únicas' : 'Total Hechos'}</strong></span>`);

    if (badges.length > 0) {
      container.innerHTML = badges.map(b => `<div class="active-filter-pill">${b}</div>`).join('');
    } else {
      container.innerHTML = '<span style="font-size: 0.75rem; color: #94a3b8;">Sin filtros específicos aplicados (Consolidado general)</span>';
    }
  }

  // Render Line Chart (Creación de Noticias por Día en el formato)
  function renderLineChart(records, noticias) {
    const ctx = document.getElementById('lineChartCreacion');
    if (!ctx) return;

    records = records || getFilteredRecords();
    noticias = noticias || getFilteredDistinctNoticias(records);

    const dateCounts = {};
    const datasetToUse = state.countMode === 'DISTINCT' ? noticias : records;

    const allKnownDays = ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'];
    allKnownDays.forEach(day => {
      dateCounts[day] = 0;
    });

    datasetToUse.forEach(item => {
      const d = item.fecha_dia;
      if (d) {
        dateCounts[d] = (dateCounts[d] || 0) + 1;
      }
    });

    const filteredDays = allKnownDays.filter(day => {
      if (state.fechaInicio && day < state.fechaInicio) return false;
      if (state.fechaFin && day > state.fechaFin) return false;
      return true;
    });

    const dataValues = filteredDays.map(d => dateCounts[d] || 0);

    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const displayLabels = filteredDays.map(l => {
      const parts = l.split('-');
      const month = parseInt(parts[1], 10) - 1;
      return `${parts[2]} ${monthNames[month]}`;
    });

    if (lineChartInstance) {
      lineChartInstance.destroy();
    }

    const metricTitle = state.countMode === 'DISTINCT' ? 'Noticias Creadas (SPOA Únicas)' : 'Total Conductas / Delitos';

    const chartContext = ctx.getContext('2d');
    const gradient = chartContext.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(19, 64, 116, 0.28)');
    gradient.addColorStop(1, 'rgba(19, 64, 116, 0.01)');

    lineChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: displayLabels,
        datasets: [{
          label: metricTitle,
          data: dataValues,
          borderColor: '#0b2545',
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.28,
          pointBackgroundColor: '#c59b27',
          pointBorderColor: '#0b2545',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 9,
          pointHoverBackgroundColor: '#c59b27',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 25, right: 15, left: 10, bottom: 5 }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              boxWidth: 14,
              font: { size: 12, weight: 'bold', family: 'system-ui' },
              color: '#0b2545'
            }
          },
          tooltip: {
            backgroundColor: '#0b2545',
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 12 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                return ` ${context.parsed.y} noticias creadas`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(226, 232, 240, 0.8)' },
            ticks: {
              autoSkip: false,
              color: '#1e293b',
              font: { size: 12, weight: '700' }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(226, 232, 240, 0.8)',
              borderDash: [3, 3]
            },
            ticks: {
              color: '#475569',
              font: { size: 11 },
              precision: 0
            }
          }
        }
      }
    });
  }

  // Render Bar Chart: EXCLUSIVAMENTE DE DELITOS
  function renderBarChart(records, noticias) {
    const ctx = document.getElementById('barChartNoticias');
    if (!ctx) return;

    records = records || getFilteredRecords();

    // Group only by Delito
    const counts = {};
    records.forEach(r => {
      const val = r.delito || 'SIN DATO';
      counts[val] = (counts[val] || 0) + 1;
    });

    // Top 8 Delitos descending
    const sortedEntries = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const labels = sortedEntries.map(e => {
      if (e[0].length > 28) return e[0].substring(0, 26) + '...';
      return e[0];
    });

    const dataValues = sortedEntries.map(e => e[1]);
    const totalCount = dataValues.reduce((a, b) => a + b, 0) || 1;

    if (barChartInstance) {
      barChartInstance.destroy();
    }

    const govColors = [
      '#0b2545', '#134074', '#1d4ed8', '#0284c7',
      '#c59b27', '#d97706', '#059669', '#475569'
    ];

    barChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Noticias / Registros por Delito',
          data: dataValues,
          backgroundColor: govColors.slice(0, labels.length),
          borderRadius: 6,
          maxBarThickness: 24,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: 'y', // Horizontal bars for clean readability of crime names
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 15, right: 35, left: 5, bottom: 5 }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0b2545',
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              title: function(items) {
                const idx = items[0].dataIndex;
                return sortedEntries[idx][0];
              },
              label: function(context) {
                const percent = ((context.parsed.x / totalCount) * 100).toFixed(1);
                return ` ${context.parsed.x} noticias (${percent}%)`;
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: {
              color: 'rgba(226, 232, 240, 0.8)',
              borderDash: [3, 3]
            },
            ticks: {
              color: '#475569',
              font: { size: 11 },
              precision: 0
            }
          },
          y: {
            grid: { display: false },
            ticks: {
              color: '#0f172a',
              font: { size: 11, weight: '600' }
            }
          }
        }
      }
    });
  }

  // Render Donut Chart (Distribución de Tipo de Noticia)
  function renderDonutChart(records, noticias) {
    const ctx = document.getElementById('donutChartTipo');
    if (!ctx) return;

    records = records || getFilteredRecords();
    noticias = noticias || getFilteredDistinctNoticias(records);

    const counts = {};
    const datasetToUse = state.countMode === 'DISTINCT' ? noticias : records;

    datasetToUse.forEach(r => {
      const val = r.tipo_noticia || 'SIN DATO';
      counts[val] = (counts[val] || 0) + 1;
    });

    const labels = Object.keys(counts);
    const dataValues = Object.values(counts);

    const donutColors = ['#0b2545', '#1d4ed8', '#c59b27', '#059669', '#7c3aed'];

    if (donutChartInstance) {
      donutChartInstance.destroy();
    }

    donutChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: dataValues,
          backgroundColor: donutColors.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              font: { size: 11, weight: '600' },
              color: '#334155',
              padding: 12
            }
          },
          tooltip: {
            backgroundColor: '#0b2545',
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percent = ((context.parsed / total) * 100).toFixed(1);
                return ` ${context.label}: ${context.parsed} (${percent}%)`;
              }
            }
          }
        },
        cutout: '62%'
      }
    });
  }

  // Render Table
  function renderTable(records, noticias) {
    const tbody = document.getElementById('tableNoticiasBody');
    if (!tbody) return;

    records = records || getFilteredRecords();
    noticias = noticias || getFilteredDistinctNoticias(records);

    let tableItems = noticias;
    if (state.searchQuery) {
      const q = state.searchQuery;
      tableItems = noticias.filter(n => {
        return (
          (n.id && n.id.toLowerCase().includes(q)) ||
          (n.municipio_hechos && n.municipio_hechos.toLowerCase().includes(q)) ||
          (n.departamento_hechos && n.departamento_hechos.toLowerCase().includes(q)) ||
          (n.tipo_noticia && n.tipo_noticia.toLowerCase().includes(q)) ||
          (n.delito_principal && n.delito_principal.toLowerCase().includes(q)) ||
          (n.despacho && n.despacho.toLowerCase().includes(q)) ||
          (n.receptor && n.receptor.toLowerCase().includes(q))
        );
      });
    }

    const totalItems = tableItems.length;
    const totalPages = Math.ceil(totalItems / state.pageSize) || 1;
    if (state.page > totalPages) state.page = totalPages;

    const startIdx = (state.page - 1) * state.pageSize;
    const pageItems = tableItems.slice(startIdx, startIdx + state.pageSize);

    const countInfo = document.getElementById('tableCountInfo');
    if (countInfo) {
      countInfo.textContent = `Mostrando ${totalItems === 0 ? 0 : startIdx + 1} - ${Math.min(startIdx + state.pageSize, totalItems)} de ${totalItems} noticias`;
    }

    if (pageItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px; color: #64748b;">No se encontraron noticias que coincidan con los criterios de búsqueda.</td></tr>`;
      renderPagination(totalPages);
      return;
    }

    tbody.innerHTML = pageItems.map(item => {
      let badgeClass = 'tipo-denuncia';
      if (item.tipo_noticia.includes('QUERELLA')) badgeClass = 'tipo-querella';
      else if (item.tipo_noticia.includes('ACTOS')) badgeClass = 'tipo-actos-urgentes';
      else if (item.tipo_noticia.includes('OFICIO')) badgeClass = 'tipo-oficio';
      else if (item.tipo_noticia.includes('COMPULSACION')) badgeClass = 'tipo-compulsacion';

      const delitosCountBadge = item.total_delitos > 1 
        ? `<span style="font-size: 0.7rem; background: #e2e8f0; color: #334155; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">+${item.total_delitos - 1} delito(s)</span>`
        : '';

      return `
        <tr>
          <td><strong style="color: #0b2545; font-family: monospace; font-size: 0.85rem;">${item.id}</strong></td>
          <td>${item.fecha_noticia ? item.fecha_noticia.substring(0, 16) : '-'}</td>
          <td><span class="badge-tipo ${badgeClass}">${item.tipo_noticia}</span></td>
          <td>${item.departamento_hechos || 'SIN DATO'}</td>
          <td><strong>${item.municipio_hechos || 'SIN DATO'}</strong></td>
          <td>${item.delito_principal} ${delitosCountBadge}</td>
          <td><span class="badge-estado estado-activo">ACTIVO</span></td>
          <td style="text-align: right;">
            <button class="btn-view-detail" data-id="${item.id}">Ver Ficha</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-view-detail').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        showNoticeDetail(id);
      });
    });

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    const container = document.getElementById('paginationControls');
    if (!container) return;

    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = `
      <button class="btn-page" id="btnPagePrev" ${state.page === 1 ? 'disabled' : ''}>Anterior</button>
      <span style="font-size: 0.8rem; font-weight: 600; padding: 0 8px; color: #0b2545;">Página ${state.page} de ${totalPages}</span>
      <button class="btn-page" id="btnPageNext" ${state.page === totalPages ? 'disabled' : ''}>Siguiente</button>
    `;

    container.innerHTML = html;

    const prev = document.getElementById('btnPagePrev');
    const next = document.getElementById('btnPageNext');

    if (prev) {
      prev.addEventListener('click', () => {
        if (state.page > 1) {
          state.page--;
          renderTable();
        }
      });
    }

    if (next) {
      next.addEventListener('click', () => {
        if (state.page < totalPages) {
          state.page++;
          renderTable();
        }
      });
    }
  }

  function showNoticeDetail(noticiaId) {
    const noticeRecords = rawRecords.filter(r => r.id === noticiaId);
    if (!noticeRecords || noticeRecords.length === 0) return;

    const base = noticeRecords[0];
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

    const delitosList = noticeRecords.map(r => r.delito).filter(Boolean);
    const uniqueDelitos = [...new Set(delitosList)];
    document.getElementById('modalDelitosList').innerHTML = uniqueDelitos.map(d => `<li style="margin-bottom: 4px;"><strong>${d}</strong></li>`).join('');

    modal.classList.add('active');
  }

  function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) {
          alert('El archivo no contiene filas de datos.');
          return;
        }

        const newRecords = [];
        json.forEach(row => {
          const getCol = (patterns) => {
            for (let k of Object.keys(row)) {
              for (let p of patterns) {
                if (k.toLowerCase().includes(p.toLowerCase())) return String(row[k] || '').trim();
              }
            }
            return '';
          };

          const id = getCol(['noticia criminal', 'nmero', 'numero']);
          const fechaNoticia = getCol(['fecha noticia']);
          const tipoNoticia = getCol(['tipo noticia']);
          const dpto = getCol(['departamento de los hechos', 'departamento hechos']);
          const muni = getCol(['municipio de los hechos', 'municipio hechos']);
          const delito = getCol(['delito']);

          if (id) {
            newRecords.push({
              id: id,
              fecha_noticia: fechaNoticia,
              fecha_dia: fechaNoticia.substring(0, 10),
              tipo_noticia: tipoNoticia || 'SIN DATO',
              estado: 'ACTIVO',
              departamento_hechos: dpto || 'SIN DATO',
              municipio_hechos: muni || 'SIN DATO',
              delito: delito || 'SIN DATO',
              delito_agrupado: getCol(['delito agrupado']),
              unidad_receptora: getCol(['unidad receptora']),
              despacho: getCol(['despacho']),
              receptor: getCol(['receptor']),
              seccional: getCol(['seccional']),
              direccion: getCol(['direcci']),
              barrio: getCol(['barrio'])
            });
          }
        });

        if (newRecords.length > 0) {
          rawRecords = newRecords;
          initDateRange();
          populateFilterOptions();
          updateDashboard();
          alert(`¡Datos cargados exitosamente! Se procesaron ${rawRecords.length} registros.`);
        } else {
          alert('No se pudieron identificar las columnas requeridas en el archivo Excel.');
        }
      } catch (err) {
        console.error('Error al procesar el archivo Excel:', err);
        alert('Ocurrió un error al leer el archivo Excel.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function exportToCSV() {
    const filteredRecords = getFilteredRecords();
    const filteredNoticias = getFilteredDistinctNoticias(filteredRecords);

    let csvContent = '\uFEFF';
    csvContent += 'Numero Noticia Criminal,Fecha Creacion,Tipo Noticia,Departamento Hechos,Municipio Hechos,Delito Principal,Total Delitos,Despacho,Funcionario Receptor\n';

    filteredNoticias.forEach(n => {
      const escape = (val) => `"${(val || '').replace(/"/g, '""')}"`;
      csvContent += [
        escape(n.id),
        escape(n.fecha_noticia),
        escape(n.tipo_noticia),
        escape(n.departamento_hechos),
        escape(n.municipio_hechos),
        escape(n.delito_principal),
        n.total_delitos,
        escape(n.despacho),
        escape(n.receptor)
      ].join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_Noticias_Militarizacion_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

})();
