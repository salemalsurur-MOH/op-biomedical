// ============================================
// Excel File Handler & Data Processing
// معالج ملفات Excel وإرسال البيانات
// ============================================

async function handleExcelUpload(file) {
  try {
    console.log('📂 معالجة الملف:', file.name);

    // قراءة الملف
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // استخراج البيانات من الشيت الأول
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // قراءة كل البيانات مع الرؤوس
        const allData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        console.log('🔍 عدد الصفوف الخام:', allData.length);
        console.log('🔍 الصف الأول:', allData[0]);
        console.log('🔍 الصف الثاني (الرؤوس):', allData[1]);

        // معالجة الملف - تخطي الصف الأول الفارغ، واستخدام الصف الثاني كرؤوس
        let headers = [];
        let rawData = [];

        if (allData.length > 1) {
          // الصف الثاني يحتوي على الرؤوس
          headers = allData[1];

          // من الصف الثالث فما بعده هي البيانات
          for (let i = 2; i < allData.length; i++) {
            const row = allData[i];
            const obj = {};
            headers.forEach((header, index) => {
              obj[header] = row[index];
            });
            rawData.push(obj);
          }
        }

        console.log('📊 عدد الصفوف المعالجة:', rawData.length);
        console.log('📋 الأعمدة المستخرجة:', headers);
        console.log('📋 أول صف معالج:', rawData[0]);

        // حساب الـ KPIs
        const kpis = calculateKPIs(rawData);
        console.log('📈 KPIs:', kpis);

        // حفظ في Firestore
        await saveToFirestore(file.name, rawData, kpis);

        // إظهار رسالة النجاح
        showNotification('✅ تم رفع الملف بنجاح!', 'success');

        // تحديث الرسوم البيانية
        loadDashboardData();

      } catch (err) {
        console.error('❌ خطأ في معالجة الملف:', err);
        showNotification('❌ حدث خطأ في المعالجة', 'error');
      }
    };
    reader.readAsArrayBuffer(file);

  } catch (err) {
    console.error('❌ خطأ في الرفع:', err);
    showNotification('❌ حدث خطأ في الرفع', 'error');
  }
}

function calculateKPIs(data) {
  if (!data || data.length === 0) return {};

  const totalOrders = data.length;

  // الحالات المكتملة: "تم التكليف" و "فعال"
  const completedOrders = data.filter(d => {
    const status = d['الحالة'];
    return status === 'تم التكليف' || status === 'فعال';
  }).length;

  const pendingOrders = data.filter(d => {
    const status = d['الحالة'];
    return status === 'موافقة العميل' || status === 'في انتظار لموافقة' || status === 'Pending for Spare Part';
  }).length;

  // حساب متوسط زمن الإصلاح من ايام العطل
  const repairTimes = data
    .map(d => {
      const days = parseFloat(d['ايام العطل']) || 0;
      return days;
    })
    .filter(t => t >= 0);

  const avgRepairTime = repairTimes.length > 0
    ? (repairTimes.reduce((a, b) => a + b, 0) / repairTimes.length).toFixed(2)
    : 0;

  const efficiencyRate = totalOrders > 0
    ? ((completedOrders / totalOrders) * 100).toFixed(1)
    : 0;

  // توزيع حسب الحالة
  const byStatus = {};
  data.forEach(d => {
    const status = d['الحالة'] || 'غير محدد';
    byStatus[status] = (byStatus[status] || 0) + 1;
  });

  // توزيع حسب نوع الأمر
  const byType = {};
  data.forEach(d => {
    const type = d['نوع امر العمل'] || 'غير محدد';
    byType[type] = (byType[type] || 0) + 1;
  });

  // توزيع حسب المنشأة
  const byFacility = {};
  data.forEach(d => {
    const facility = d['المنشأة'] || 'غير محدد';
    byFacility[facility] = (byFacility[facility] || 0) + 1;
  });

  // توزيع حسب القسم
  const byDepartment = {};
  data.forEach(d => {
    const dept = d['قسم'] || 'غير محدد';
    byDepartment[dept] = (byDepartment[dept] || 0) + 1;
  });

  // توزيع حسب الصانع (Top 10)
  const byManufacturer = {};
  data.forEach(d => {
    const mfr = d['الصانع'] || 'غير محدد';
    byManufacturer[mfr] = (byManufacturer[mfr] || 0) + 1;
  });
  const topManufacturers = Object.entries(byManufacturer)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});

  // توزيع حسب تعريف المعدة (Top 10)
  const byEquipment = {};
  data.forEach(d => {
    const eq = d['تعريف المعدة'] || 'غير محدد';
    byEquipment[eq] = (byEquipment[eq] || 0) + 1;
  });
  const topEquipment = Object.entries(byEquipment)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});

  // توزيع حسب التصنيف
  const byClassification = {};
  data.forEach(d => {
    const cls = d['تصنيف'] || 'غير محدد';
    byClassification[cls] = (byClassification[cls] || 0) + 1;
  });

  return {
    totalOrders,
    completedOrders,
    pendingOrders,
    avgRepairTime: parseFloat(avgRepairTime),
    efficiencyRate: parseFloat(efficiencyRate),
    byStatus,
    byType,
    byFacility,
    byDepartment,
    byManufacturer: topManufacturers,
    byEquipment: topEquipment,
    byClassification
  };
}

async function saveToFirestore(fileName, rawData, kpis) {
  try {
    // تأكد من أن Firebase تم تهيئته
    if (!db) {
      throw new Error('Firebase لم يتم تهيئته - انتظر لحظة وحاول مرة أخرى');
    }

    // استخراج الشهر من اسم الملف (مثل: 3-2026.xlsx)
    const monthMatch = fileName.match(/(\d+)-(\d+)/);
    const month = monthMatch ? `${monthMatch[1]}-${monthMatch[2]}` : new Date().toISOString().split('T')[0];

    const docId = `data_${month.replace('-', '_')}`;

    const payload = {
      month,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      fileName,
      totalOrders: kpis.totalOrders,
      completedOrders: kpis.completedOrders,
      pendingOrders: kpis.pendingOrders,
      avgRepairTime: kpis.avgRepairTime,
      efficiencyRate: kpis.efficiencyRate,
      byType: kpis.byType,
      byFacility: kpis.byFacility,
      byDepartment: kpis.byDepartment,
      dataCount: rawData.length
    };

    await db.collection('maintenance_data').doc(docId).set(payload);
    console.log('✅ تم الحفظ في Firestore:', docId);

  } catch (err) {
    console.error('❌ خطأ في الحفظ:', err);
    throw err;
  }
}

function showNotification(message, type = 'info') {
  const notif = document.createElement('div');
  notif.className = `notification notification-${type}`;
  notif.textContent = message;
  notif.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 25px;
    border-radius: 8px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    z-index: 9999;
    animation: slideIn 0.3s ease;
    max-width: 400px;
  `;
  document.body.appendChild(notif);

  setTimeout(() => notif.remove(), 4000);
}
