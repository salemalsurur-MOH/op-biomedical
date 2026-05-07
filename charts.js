// ============================================
// Charts & Dashboard Data Visualization
// الرسوم البيانية وعرض البيانات
// ============================================

let latestData = null;
let chartInstances = {};

async function loadDashboardData() {
  try {
    console.log('📊 تحميل بيانات الداشبورد...');

    if (!db) {
      console.warn('⚠️ Firebase لم يتم تهيئته بعد...');
      return;
    }

    const snapshot = await db.collection('maintenance_data')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log('⚠️ لا توجد بيانات حتى الآن');
      document.getElementById('kpis-container').innerHTML = '<p style="text-align: center; color: #999;">لم يتم رفع أي ملفات بعد</p>';
      return;
    }

    latestData = snapshot.docs[0].data();
    console.log('✅ البيانات الجديدة:', latestData);

    renderKPIs();
    renderCharts();

  } catch (err) {
    console.error('❌ خطأ في تحميل البيانات:', err);
  }
}

function renderKPIs() {
  const container = document.getElementById('kpis-container');

  const html = `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-value">${latestData.totalOrders || 0}</div>
        <div class="kpi-label">إجمالي أوامر العمل</div>
        <div class="kpi-month">الشهر: ${latestData.month}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value" style="color: #10b981;">${latestData.efficiencyRate || 0}%</div>
        <div class="kpi-label">نسبة الكفاءة</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value" style="color: #f59e0b;">${latestData.avgRepairTime || 0}</div>
        <div class="kpi-label">متوسط زمن الإصلاح (أيام)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value" style="color: #06b6d4;">${latestData.completedOrders || 0}</div>
        <div class="kpi-label">أوامر مكتملة</div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function renderCharts() {
  const container = document.getElementById('charts-container');
  container.innerHTML = `
    <div class="chart-wrapper">
      <h3>توزيع الأوامر حسب الحالة</h3>
      <canvas id="chart-by-status"></canvas>
    </div>
    <div class="chart-wrapper">
      <h3>توزيع الأوامر حسب النوع</h3>
      <canvas id="chart-by-type"></canvas>
    </div>
    <div class="chart-wrapper">
      <h3>توزيع الأوامر حسب المنشأة</h3>
      <canvas id="chart-by-facility"></canvas>
    </div>
    <div class="chart-wrapper">
      <h3>توزيع الأوامر حسب التصنيف</h3>
      <canvas id="chart-by-classification"></canvas>
    </div>
    <div class="chart-wrapper">
      <h3>أكثر الأقسام طلباً</h3>
      <canvas id="chart-top-departments"></canvas>
    </div>
    <div class="chart-wrapper">
      <h3>أكثر الأجهزة طلباً</h3>
      <canvas id="chart-top-equipment"></canvas>
    </div>
    <div class="chart-wrapper">
      <h3>توزيع حسب الصانع</h3>
      <canvas id="chart-by-manufacturer"></canvas>
    </div>
    <div class="chart-wrapper">
      <h3>نسبة الحالات</h3>
      <canvas id="chart-status-pie"></canvas>
    </div>
  `;

  setTimeout(() => {
    drawChartByStatus();
    drawChartByType();
    drawChartByFacility();
    drawChartByClassification();
    drawTopDepartments();
    drawTopEquipment();
    drawByManufacturer();
    drawStatusPie();
  }, 100);
}

function drawChartByStatus() {
  const ctx = document.getElementById('chart-by-status')?.getContext('2d');
  if (!ctx) return;

  const labels = Object.keys(latestData.byStatus || {});
  const values = Object.values(latestData.byStatus || {});

  if (chartInstances.byStatus) chartInstances.byStatus.destroy();

  chartInstances.byStatus = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'عدد الأوامر',
        data: values,
        backgroundColor: ['#0E5A8A', '#2AA8D8', '#06b6d4', '#10b981', '#f59e0b'],
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function drawChartByType() {
  const ctx = document.getElementById('chart-by-type')?.getContext('2d');
  if (!ctx) return;

  const labels = Object.keys(latestData.byType || {});
  const values = Object.values(latestData.byType || {});

  if (chartInstances.byType) chartInstances.byType.destroy();

  chartInstances.byType = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'عدد الأوامر',
        data: values,
        backgroundColor: '#0E5A8A',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function drawChartByFacility() {
  const ctx = document.getElementById('chart-by-facility')?.getContext('2d');
  if (!ctx) return;

  const labels = Object.keys(latestData.byFacility || {});
  const values = Object.values(latestData.byFacility || {});

  if (chartInstances.byFacility) chartInstances.byFacility.destroy();

  chartInstances.byFacility = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ['#0E5A8A', '#2AA8D8', '#06b6d4', '#10b981', '#f59e0b'],
        borderColor: '#fff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

function drawChartByClassification() {
  const ctx = document.getElementById('chart-by-classification')?.getContext('2d');
  if (!ctx) return;

  const labels = Object.keys(latestData.byClassification || {});
  const values = Object.values(latestData.byClassification || {});

  if (chartInstances.byClassification) chartInstances.byClassification.destroy();

  chartInstances.byClassification = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
        borderColor: '#fff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

function drawTopDepartments() {
  const ctx = document.getElementById('chart-top-departments')?.getContext('2d');
  if (!ctx) return;

  const entries = Object.entries(latestData.byDepartment || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const labels = entries.map(e => e[0]);
  const values = entries.map(e => e[1]);

  if (chartInstances.topDepts) chartInstances.topDepts.destroy();

  chartInstances.topDepts = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'عدد الأوامر',
        data: values,
        backgroundColor: '#2AA8D8',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { beginAtZero: true }
      }
    }
  });
}

function drawTopEquipment() {
  const ctx = document.getElementById('chart-top-equipment')?.getContext('2d');
  if (!ctx) return;

  const entries = Object.entries(latestData.byEquipment || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const labels = entries.map(e => e[0]);
  const values = entries.map(e => e[1]);

  if (chartInstances.topEquip) chartInstances.topEquip.destroy();

  chartInstances.topEquip = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'عدد الأوامر',
        data: values,
        backgroundColor: '#06b6d4',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { beginAtZero: true }
      }
    }
  });
}

function drawByManufacturer() {
  const ctx = document.getElementById('chart-by-manufacturer')?.getContext('2d');
  if (!ctx) return;

  const labels = Object.keys(latestData.byManufacturer || {});
  const values = Object.values(latestData.byManufacturer || {});

  if (chartInstances.byMfr) chartInstances.byMfr.destroy();

  chartInstances.byMfr = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'عدد الأوامر',
        data: values,
        backgroundColor: '#8b5cf6',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { beginAtZero: true }
      }
    }
  });
}

function drawStatusPie() {
  const ctx = document.getElementById('chart-status-pie')?.getContext('2d');
  if (!ctx) return;

  const statuses = latestData.byStatus || {};
  const completed = (statuses['تم التكليف'] || 0) + (statuses['فعال'] || 0);
  const pending = latestData.totalOrders - completed;

  if (chartInstances.statusPie) chartInstances.statusPie.destroy();

  chartInstances.statusPie = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['مكتملة', 'قيد المتابعة'],
      datasets: [{
        data: [completed, pending],
        backgroundColor: ['#10b981', '#f59e0b'],
        borderColor: '#fff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

// Real-time listener with error handling
setTimeout(() => {
  if (db) {
    db.collection('maintenance_data').onSnapshot(
      (snapshot) => {
        console.log('🔄 تحديث جديد في البيانات');
        loadDashboardData();
      },
      (error) => {
        console.error('❌ خطأ في الاستماع إلى البيانات:', error);
      }
    );
  } else {
    console.error('❌ Firebase لم يتم تهيئته بشكل صحيح');
  }
}, 1000);
