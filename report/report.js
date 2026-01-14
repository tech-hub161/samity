document.addEventListener('DOMContentLoaded', () => {
    const { jsPDF } = window.jspdf;
    
    // UI Elements
    const recordTree = document.getElementById('record-tree');
    const reportContent = document.getElementById('report-content');
    const selectedPeriodDisplay = document.getElementById('selected-period-display');
    const downloadReportBtn = document.getElementById('download-report-btn');
    const reportChartCanvas = document.getElementById('report-chart');
    const downloadRangeBtn = document.getElementById('download-range-btn');
    const downloadCustomerReportBtn = document.getElementById('download-customer-report-btn');
    const customerSelect = document.getElementById('customer-select');

    // Modal elements
    const weekDetailsModalEl = document.getElementById('week-details-modal');
    const weekDetailsModal = new bootstrap.Modal(weekDetailsModalEl);
    const weekDetailsModalLabel = document.getElementById('weekDetailsModalLabel');
    const weekTableContainer = document.getElementById('week-table-container');

    // Data State
    let allData = {};
    let currentReport = {};
    let yearlySummary = {};
    let chartInstance;

    // --- Helpers ---
    
    function getWeekOfMonth(date) {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
        return Math.ceil((date.getDate() + firstDay) / 7);
    }

    // --- Data Loading ---

    function loadAndGroupData() {
        allData = {};
        const keys = Object.keys(localStorage).filter(k => k.startsWith('samity-data-')).sort();
        
        if (keys.length === 0) {
            recordTree.innerHTML = '<div class="text-center p-4 text-muted"><i class="fas fa-folder-open fa-2x mb-2"></i><p>No records found.</p></div>';
            return;
        }

        keys.forEach(key => {
            const dateStr = key.replace('samity-data-', '');
            const date = new Date(dateStr);
            // Handle timezone offset to ensure correct local date
            date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
            
            const year = date.getFullYear().toString();
            const month = date.toLocaleString('default', { month: 'long' });
            const week = `Week ${getWeekOfMonth(date)}`;

            if (!allData[year]) allData[year] = { _records: [] };
            if (!allData[year][month]) allData[year][month] = { _records: [] };
            if (!allData[year][month][week]) allData[year][month][week] = { _records: [] };
            
            const records = JSON.parse(localStorage.getItem(key) || '[]');
            allData[year][month][week][dateStr] = { records };
            
            allData[year]._records.push(...records);
            allData[year][month]._records.push(...records);
            allData[year][month][week]._records.push(...records);
        });
    }

    function buildHistoryList() {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('samity-data-')).sort().reverse();
        
        if (keys.length === 0) {
            recordTree.innerHTML = '<div class="text-center p-4 text-muted"><i class="fas fa-folder-open fa-2x mb-2"></i><p>No records found.</p></div>';
            return;
        }

        recordTree.innerHTML = '';
        const container = document.createElement('div');
        container.className = 'list-group list-group-flush';

        keys.forEach(key => {
            const dateStr = key.replace('samity-data-', '');
            const item = document.createElement('button');
            item.className = 'list-group-item list-group-item-action d-flex align-items-center border-0 rounded mb-2 py-3 shadow-sm';
            item.innerHTML = `<i class="fas fa-calendar-check text-primary fs-5 me-3"></i> <span class="fw-bold">${dateStr}</span>`;
            
            item.addEventListener('click', () => {
                // Highlight selection
                document.querySelectorAll('.list-group-item').forEach(el => el.classList.remove('active', 'bg-primary', 'text-white'));
                item.classList.add('active', 'bg-primary', 'text-white');
                item.querySelector('i').classList.replace('text-primary', 'text-white');
                
                const date = new Date(dateStr);
                date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
                const year = date.getFullYear().toString();
                const month = date.toLocaleString('default', { month: 'long' });
                const week = `Week ${getWeekOfMonth(date)}`;
                
                displayReport({ level: 'day', year, month, week, date: dateStr });
            });
            container.appendChild(item);
        });
        recordTree.appendChild(container);
    }
    
    // --- Table Generation ---

    const createTable = (records, isSummary = false) => {
        let tableHtml = `
        <div class="table-responsive shadow-sm rounded">
            <table class="table table-hover table-bordered customer-table mb-0 align-middle">
                <thead class="table-light">
                    <tr>
                        <th>Name</th><th>Khata</th><th>Deposit</th><th>LOAN</th>
                        <th>FINE</th><th>DUE</th><th>INTEREST</th><th>PARISODH</th>
                        <th>TOTAL</th><th>TOTAL LOAN</th>
                    </tr>
                </thead>
                <tbody>`;
        
        records.forEach(r => {
            tableHtml += `<tr>
                <td class="fw-bold text-primary">${r.name}</td>
                <td>${r.khata || ''}</td>
                <td>${Math.round(r.deposit)}</td>
                <td>${Math.round(r.loan)}</td>
                <td>${Math.round(r.fine)}</td>
                <td>${Math.round(r.due)}</td>
                <td>${Math.round(r.interest)}</td>
                <td>${Math.round(r.parisodh)}</td>
                <td class="fw-bold">${Math.round(r.total)}</td>
                <td class="text-danger fw-bold">${isSummary && r.totalLoan === undefined ? '-' : Math.round(r.totalLoan || 0)}</td>
            </tr>`;
        });

        if (isSummary) {
            const sum = (field) => records.reduce((acc, r) => acc + (parseFloat(r[field]) || 0), 0);
            const totalKhata = records.reduce((acc, r) => acc + (parseFloat(r.khata) || 0), 0);
            
            tableHtml += `</tbody>
                <tfoot class="table-dark">
                    <tr>
                        <td>SUMMARY</td>
                        <td>${Math.round(totalKhata)}</td>
                        <td>${Math.round(sum('deposit'))}</td>
                        <td>${Math.round(sum('loan'))}</td>
                        <td>${Math.round(sum('fine'))}</td>
                        <td>${Math.round(sum('due'))}</td>
                        <td>${Math.round(sum('interest'))}</td>
                        <td>${Math.round(sum('parisodh'))}</td>
                        <td>${Math.round(sum('total'))}</td>
                        <td></td>
                    </tr>
                </tfoot>`;
        } else {
            tableHtml += '</tbody>';
        }
        tableHtml += '</table></div>';
        return tableHtml;
    };

    // --- Report Display Logic ---

    function displayReport(context) {
        currentReport = context;
        reportContent.innerHTML = ''; 
        
        // Reset Chart
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        reportChartCanvas.style.display = 'none';
        
        let title = '';

        if (context.level === 'day') {
            title = context.date;
            const records = allData[context.year][context.month][context.week][context.date].records;
            let content = `<h3 class="mb-4">Daily Report: <span class="text-primary">${title}</span></h3>`;
            content += createTable(records, true);
            reportContent.innerHTML = content;
            selectedPeriodDisplay.textContent = title;
            return;
        }

        // Calculate Summary for Month/Year
        const customerSummary = {};
        const recordsToSummarize = context.level === 'year' 
            ? allData[context.year]._records 
            : allData[context.year][context.month]._records;

        if (context.level === 'year') {
            title = context.year;
            let content = `<h3 class="mb-4">Yearly Summary: <span class="text-primary">${title}</span></h3>`;
            content += createTable(yearlySummary, true);
            reportContent.innerHTML = content;

        } else if (context.level === 'month') {
            title = `${context.month} ${context.year}`;
            reportChartCanvas.style.display = 'block';
            reportContent.appendChild(reportChartCanvas); // Move canvas to be first child if needed, or re-append

            const weeks = Object.keys(allData[context.year][context.month]).filter(k => k !== '_records').sort();
            const chartData = {
                labels: weeks,
                datasets: [
                    { label: 'Deposit', data: [], backgroundColor: 'rgba(52, 152, 219, 0.7)', borderRadius: 5 },
                    { label: 'Loan', data: [], backgroundColor: 'rgba(231, 76, 60, 0.7)', borderRadius: 5 },
                ]
            };
            
            let gridHtml = '<div class="week-grid row g-3 mt-4">';

            weeks.forEach(week => {
                const weekRecords = allData[context.year][context.month][week]._records;
                const weeklyTotals = { deposit: 0, loan: 0 };
                weekRecords.forEach(r => {
                    weeklyTotals.deposit += r.deposit;
                    weeklyTotals.loan += r.loan;
                });

                chartData.datasets[0].data.push(weeklyTotals.deposit);
                chartData.datasets[1].data.push(weeklyTotals.loan);

                gridHtml += `
                    <div class="col-md-4 col-sm-6">
                        <div class="card week-card h-100 shadow-sm border-0 hover-lift" data-year="${context.year}" data-month="${context.month}" data-week="${week}">
                            <div class="card-body text-center">
                                <h5 class="card-title text-primary"><i class="fas fa-calendar-check mb-2"></i><br>${week}</h5>
                                <hr>
                                <div class="d-flex justify-content-between">
                                    <span class="text-success fw-bold">Dep: ${weeklyTotals.deposit.toFixed(0)}</span>
                                    <span class="text-danger fw-bold">Loan: ${weeklyTotals.loan.toFixed(0)}</span>
                                </div>
                            </div>
                        </div>
                    </div>`;
            });

            gridHtml += '</div>';
            
            const titleEl = document.createElement('h3');
            titleEl.className = 'mb-3';
            titleEl.innerHTML = `Monthly Overview: <span class="text-primary">${title}</span>`;
            reportContent.prepend(titleEl);
            
            const gridContainer = document.createElement('div');
            gridContainer.innerHTML = gridHtml;
            reportContent.appendChild(gridContainer);

            chartInstance = new Chart(reportChartCanvas, {
                type: 'bar',
                data: chartData,
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: 'top' },
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#f0f0f0' } },
                        x: { grid: { display: false } }
                    }
                }
            });

        } else if (context.level === 'week') {
            title = `${context.week}, ${context.month} ${context.year}`;
            let content = `<h3 class="mb-4">Weekly Report: <span class="text-primary">${title}</span></h3>`;
            const dates = Object.keys(allData[context.year][context.month][context.week]).filter(k => k !== '_records');
            dates.forEach(date => {
                content += `<h5 class="mt-4 text-secondary"><i class="fas fa-calendar-day me-2"></i>${date}</h5>`;
                content += createTable(allData[context.year][context.month][context.week][date].records);
            });
            reportContent.innerHTML = content;
        }

        selectedPeriodDisplay.textContent = title;
    }

    function showWeekDetails(year, month, week) {
        const weekData = allData[year][month][week];
        const dates = Object.keys(weekData).filter(k => k !== '_records').sort();
        
        let tableHtml = `
            <div class="table-responsive">
                <table class="table table-sm table-striped table-bordered align-middle">
                    <thead class="table-dark">
                        <tr><th>Name</th><th>Khata</th><th>Deposit</th><th>LOAN</th><th>FINE</th><th>DUE</th><th>INTEREST</th><th>PARISODH</th><th>TOTAL</th><th>TOTAL LOAN</th></tr>
                    </thead>
                    <tbody>`;
        
        const allRecords = [];

        dates.forEach(date => {
            tableHtml += `<tr><td colspan="10" class="text-center bg-info bg-opacity-10 fw-bold py-2">Date: ${date}</td></tr>`;
            const dayRecords = weekData[date].records;
            allRecords.push(...dayRecords);
            
            dayRecords.forEach(r => {
                tableHtml += `<tr>
                    <td>${r.name}</td>
                    <td>${r.khata || ''}</td>
                    <td>${Math.round(r.deposit)}</td>
                    <td>${Math.round(r.loan)}</td>
                    <td>${Math.round(r.fine)}</td>
                    <td>${Math.round(r.due)}</td>
                    <td>${Math.round(r.interest)}</td>
                    <td>${Math.round(r.parisodh)}</td>
                    <td>${Math.round(r.total)}</td>
                    <td>${Math.round(r.totalLoan)}</td>
                </tr>`;
            });
        });

        tableHtml += '</tbody>';
        
        // Calculate Totals for Week Details
        const sum = (field) => allRecords.reduce((acc, r) => acc + (parseFloat(r[field]) || 0), 0);
        const totalTotal = sum('deposit') + sum('fine') + sum('due') + sum('interest') + sum('parisodh');
        
        tableHtml += `<tfoot class="table-secondary fw-bold border-top-2">
            <tr>
                <td>SUMMARY</td>
                <td>${allRecords.reduce((acc, r) => acc + (parseFloat(r.khata) || 0), 0).toFixed(0)}</td>
                <td>${Math.round(sum('deposit'))}</td>
                <td>${Math.round(sum('loan'))}</td>
                <td>${Math.round(sum('fine'))}</td>
                <td>${Math.round(sum('due'))}</td>
                <td>${Math.round(sum('interest'))}</td>
                <td>${Math.round(sum('parisodh'))}</td>
                <td>${Math.round(sum('total'))}</td>
                <td>${Math.round(sum('totalLoan'))}</td>
            </tr>`;

        const expenseDataString = localStorage.getItem('temp-expense-data');
        if (expenseDataString) {
            const expenseData = JSON.parse(expenseDataString);
            if (expenseData && (expenseData.name || expenseData.amount > 0)) {
                const outstanding = totalTotal - expenseData.amount;
                tableHtml += `
                    <tr class="table-danger">
                        <td>Expense: ${expenseData.name || ''}</td>
                        <td colspan="1" class="text-end">Amount:</td>
                        <td class="text-danger">-${expenseData.amount || 0}</td>
                        <td colspan="5" class="text-end">Outstanding:</td>
                        <td class="text-success fw-bold">${outstanding.toFixed(2)}</td>
                        <td></td>
                    </tr>
                `;
            }
        }
        
        tableHtml += '</tfoot></table></div>';

        weekTableContainer.innerHTML = tableHtml;
        
        weekDetailsModalLabel.textContent = `Details: ${week}, ${month} ${year}`;
        weekDetailsModal.show();
    }

    // --- PDF Generation ---

    // --- Helper: Modern Header ---
    function addModernHeader(doc, title, subtitle = '') {
        const pageWidth = doc.internal.pageSize.width;
        
        // Header Background
        doc.setFillColor(44, 62, 80); // Dark Blue #2c3e50
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        // Title
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 14, 20);
        
        // Subtitle (Date/Info)
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(subtitle || `Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
        
        // Reset
        doc.setTextColor(0, 0, 0);
    }

    // --- PDF Generation ---

    function generatePdf() {
        if (!currentReport.level) {
            Swal.fire('Info', "Please select a report period first.", 'info');
            return;
        }

        const doc = new jsPDF();
        const head = [['Name', 'Khata', 'Deposit', 'LOAN', 'FINE', 'DUE', 'INTEREST', 'PARISODH', 'TOTAL', 'TOTAL LOAN']];
        let title = selectedPeriodDisplay.textContent;
        let filename = `Report_${title.replace(/ /g, '_')}`;

        addModernHeader(doc, `Report: ${title}`);

        let startY = 50;

        if (currentReport.level === 'day') {
            const records = allData[currentReport.year][currentReport.month][currentReport.week][currentReport.date].records;
            const body = records.map(r => [
                r.name, 
                r.khata || '', 
                Math.round(r.deposit), 
                Math.round(r.loan), 
                Math.round(r.fine), 
                Math.round(r.due), 
                Math.round(r.interest), 
                Math.round(r.parisodh), 
                Math.round(r.total), 
                Math.round(r.totalLoan)
            ]);
            
            doc.autoTable({ 
                head, 
                body, 
                startY, 
                theme: 'striped',
                headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' }, // Bright Blue
                alternateRowStyles: { fillColor: [240, 248, 255] } // Alice Blue
            });
        } else if (currentReport.level === 'year') {
            const body = yearlySummary.map(r => [
                r.name, 
                r.khata || '', 
                Math.round(r.deposit), 
                Math.round(r.loan), 
                Math.round(r.fine), 
                Math.round(r.due), 
                Math.round(r.interest), 
                Math.round(r.parisodh), 
                Math.round(r.total), 
                '-'
            ]);
            doc.autoTable({ 
                head, 
                body, 
                startY, 
                theme: 'striped',
                headStyles: { fillColor: [44, 62, 80] }, // Dark
            });
        } else if (currentReport.level === 'month') {
            // Summary First
             const summaryBody = yearlySummary.map(r => [
                 r.name, 
                 r.khata || '', 
                 Math.round(r.deposit), 
                 Math.round(r.loan), 
                 Math.round(r.fine), 
                 Math.round(r.due), 
                 Math.round(r.interest), 
                 Math.round(r.parisodh), 
                 Math.round(r.total), 
                 '-'
             ]);
            doc.setFontSize(14);
            doc.text('Monthly Summary', 14, startY);
            doc.autoTable({ 
                head, 
                body: summaryBody, 
                startY: startY + 5, 
                theme: 'grid', 
                headStyles: {fillColor: [41, 128, 185]} 
            });
            
            // Detailed Weeks
            const monthData = allData[currentReport.year][currentReport.month];
            const weeks = Object.keys(monthData).filter(k => k !== '_records').sort();
            
            let lastY = doc.lastAutoTable.finalY + 15;

            weeks.forEach(week => {
                if (lastY > 250) { doc.addPage(); lastY = 20; }
                
                // Week Header
                doc.setFillColor(236, 240, 241); // Light Gray
                doc.rect(14, lastY, 182, 8, 'F');
                doc.setFontSize(14);
                doc.setTextColor(44, 62, 80);
                doc.setFont('helvetica', 'bold');
                doc.text(week, 16, lastY + 6);
                lastY += 15;
                
                const weekData = monthData[week];
                const dates = Object.keys(weekData).filter(k => k !== '_records').sort();
                 dates.forEach(date => {
                    doc.addPage(); // Force page break for every date
                    lastY = 20;
                    
                    // Date Header
                    doc.setFillColor(52, 73, 94); // Dark Background
                    doc.rect(14, lastY, 182, 10, 'F');
                    doc.setFontSize(12);
                    doc.setTextColor(255, 255, 255);
                    doc.text(`Date: ${date}`, 16, lastY + 7);
                    doc.setTextColor(0, 0, 0); // Reset
                    
                    const dailyBody = weekData[date].records.map(r => [
                        r.name, 
                        r.khata || '', 
                        Math.round(r.deposit), 
                        Math.round(r.loan), 
                        Math.round(r.fine), 
                        Math.round(r.due), 
                        Math.round(r.interest), 
                        Math.round(r.parisodh), 
                        Math.round(r.total), 
                        Math.round(r.totalLoan)
                    ]);
                    doc.autoTable({ 
                        head, 
                        body: dailyBody, 
                        startY: lastY + 12,
                        theme: 'striped',
                        headStyles: { fillColor: [52, 73, 94] }
                    });
                    lastY = doc.lastAutoTable.finalY + 10;
                 });
            });

        } else if (currentReport.level === 'week') {
            const body = [];
            const weekData = allData[currentReport.year][currentReport.month][currentReport.week];
            const dates = Object.keys(weekData).filter(k => k !== '_records').sort();
            dates.forEach(date => {
                 body.push([{content: `Date: ${date}`, colSpan: 10, styles: { fontStyle: 'bold', fillColor: [220, 220, 220], textColor: 0 }}]);
                 weekData[date].records.forEach(r => {
                    body.push([
                        r.name, 
                        r.khata || '', 
                        Math.round(r.deposit), 
                        Math.round(r.loan), 
                        Math.round(r.fine), 
                        Math.round(r.due), 
                        Math.round(r.interest), 
                        Math.round(r.parisodh), 
                        Math.round(r.total), 
                        Math.round(r.totalLoan)
                    ]);
                 });
            });
            doc.autoTable({ 
                head, 
                body, 
                startY, 
                theme: 'striped',
                headStyles: { fillColor: [41, 128, 185] }
            });
        }
        
        // Append Expense info if available
        const expenseDataString = localStorage.getItem('temp-expense-data');
        if (expenseDataString) {
            const expenseData = JSON.parse(expenseDataString);
            if (expenseData && (expenseData.name || expenseData.amount > 0)) {
                let finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : startY;
                if (finalY > 250) { doc.addPage(); finalY = 20; }
                
                doc.autoTable({
                    head: [['Expense Name', 'Amount', 'Outstanding']],
                    body: [[expenseData.name, expenseData.amount, expenseData.outstanding]],
                    startY: finalY + 10,
                    theme: 'plain',
                    styles: { textColor: [192, 57, 43], fontStyle: 'bold' }, // Red Text
                    headStyles: { fillColor: [255, 255, 255], textColor: [44, 62, 80] } // Clean head
                });
            }
             localStorage.removeItem('temp-expense-data');
        }
        
        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} of ${pageCount} - GSS System`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
        }

        doc.save(`${filename}.pdf`);
    }

    // --- Interaction ---

    reportContent.addEventListener('click', (e) => {
        const weekCard = e.target.closest('.week-card');
        if (weekCard) {
            const { year, month, week } = weekCard.dataset;
            showWeekDetails(year, month, week);
        }
    });

    const dateRangePicker = flatpickr("#date-range-picker", {
        mode: "range",
        dateFormat: "Y-m-d",
    });

    function generateRangePdf() {
        const selectedDates = dateRangePicker.selectedDates;
        if (selectedDates.length < 2) {
            Swal.fire('Info', 'Please select a start and end date.', 'info');
            return;
        }

        const start = selectedDates[0];
        const end = selectedDates[1];
        const startDate = start.toISOString().split('T')[0];
        const endDate = end.toISOString().split('T')[0];
        end.setHours(23, 59, 59, 999); 

        const filteredRecords = [];
        const keys = Object.keys(localStorage).filter(k => k.startsWith('samity-data-'));
        keys.forEach(key => {
            const dateStr = key.replace('samity-data-', '');
            const recordDate = new Date(dateStr);
            if (recordDate >= start && recordDate <= end) {
                const records = JSON.parse(localStorage.getItem(key) || '[]');
                filteredRecords.push(...records.map(r => ({...r, date: dateStr})));
            }
        });

        if (filteredRecords.length === 0) {
            Swal.fire('Info', 'No records found for the selected date range.', 'info');
            return;
        }
        
        const doc = new jsPDF();
        const head = [['Name', 'Khata', 'Deposit', 'LOAN', 'FINE', 'DUE', 'INTEREST', 'PARISODH', 'TOTAL', 'TOTAL LOAN']];
        const title = `Range Report`;
        const subtitle = `${startDate} to ${endDate}`;
        const filename = `Range_Report_${startDate}_to_${endDate}.pdf`;

        addModernHeader(doc, title, subtitle);

        // Group by Date
        const groupedByDate = {};
        filteredRecords.forEach(r => {
            if (!groupedByDate[r.date]) groupedByDate[r.date] = [];
            groupedByDate[r.date].push(r);
        });

        const sortedDates = Object.keys(groupedByDate).sort((a,b) => new Date(a) - new Date(b));
        
        let startY = 50;

        sortedDates.forEach((date, index) => {
            if (index > 0) {
                doc.addPage();
                startY = 20; // Reset Y for new page
            }

            // Date Header
            doc.setFillColor(52, 73, 94); // Dark Background for Date
            doc.rect(14, startY, 182, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(`Date: ${date}`, 16, startY + 7);
            doc.setTextColor(0, 0, 0); // Reset text color

            const dailyBody = groupedByDate[date].map(r => [
                r.name, 
                r.khata || '', 
                Math.round(r.deposit), 
                Math.round(r.loan), 
                Math.round(r.fine), 
                Math.round(r.due), 
                Math.round(r.interest), 
                Math.round(r.parisodh), 
                Math.round(r.total), 
                Math.round(r.totalLoan)
            ]);
            
            doc.autoTable({ 
                head, 
                body: dailyBody, 
                startY: startY + 12,
                theme: 'striped',
                headStyles: { fillColor: [41, 128, 185] }
            });
        });

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} of ${pageCount} - GSS System`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
        }
        
        doc.save(filename);
    }

    function populateCustomerDropdown() {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('samity-data-'));
        const customerNames = new Set();
        keys.forEach(key => {
            const records = JSON.parse(localStorage.getItem(key) || '[]');
            records.forEach(r => customerNames.add(r.name));
        });
        
        customerSelect.innerHTML = '<option value="">Select a Customer...</option>';
        Array.from(customerNames).sort().forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            customerSelect.appendChild(option);
        });
    }

    function generateCustomerReportPdf() {
        const customerName = customerSelect.value;
        if (!customerName) {
            Swal.fire('Info', 'Please select a customer.', 'info');
            return;
        }
        
         const doc = new jsPDF();
         const title = `Customer History`;
         const subtitle = customerName;
         addModernHeader(doc, title, subtitle);

         const head = [['Date', 'Khata', 'Deposit', 'LOAN', 'FINE', 'DUE', 'INTEREST', 'PARISODH', 'TOTAL', 'TOTAL LOAN']];
         const body = [];
         
         const keys = Object.keys(localStorage).filter(k => k.startsWith('samity-data-')).sort();
         keys.forEach(key => {
             const date = key.replace('samity-data-', '');
             const records = JSON.parse(localStorage.getItem(key) || '[]');
             const r = records.find(rec => rec.name === customerName);
             if(r) {
                 body.push([
                     date, 
                     r.khata || '', 
                     Math.round(r.deposit), 
                     Math.round(r.loan), 
                     Math.round(r.fine), 
                     Math.round(r.due), 
                     Math.round(r.interest), 
                     Math.round(r.parisodh), 
                     Math.round(r.total), 
                     Math.round(r.totalLoan)
                 ]);
             }
         });
         
         if(body.length === 0) {
             Swal.fire('Info', 'No records found for this customer.', 'info');
             return;
         }
         
         doc.autoTable({ 
             head, 
             body, 
             startY: 50,
             theme: 'striped',
             headStyles: { fillColor: [41, 128, 185] }
         });

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} of ${pageCount} - GSS System`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
        }

         doc.save(`Customer_Report_${customerName}.pdf`);
    }

    downloadCustomerReportBtn.addEventListener('click', generateCustomerReportPdf);
    downloadReportBtn.addEventListener('click', generatePdf);
    downloadRangeBtn.addEventListener('click', generateRangePdf);

    // Initial Load
    loadAndGroupData();
    buildHistoryList();
    populateCustomerDropdown();
    initHeader3D();
});

// --- Header 3D Background (Shared Logic) ---
function initHeader3D() {
    const canvas = document.getElementById('header-3d-canvas');
    if (!canvas || typeof THREE === 'undefined') return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Particles (Icosahedrons)
    const geometry = new THREE.IcosahedronGeometry(1, 0);
    const material = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        flatShading: true,
        transparent: true,
        opacity: 0.8
    });

    const particles = [];
    for (let i = 0; i < 30; i++) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.x = (Math.random() - 0.5) * 40;
        mesh.position.y = (Math.random() - 0.5) * 20;
        mesh.position.z = (Math.random() - 0.5) * 20;
        mesh.rotation.x = Math.random() * Math.PI;
        mesh.rotation.y = Math.random() * Math.PI;
        
        const scale = Math.random() * 0.5 + 0.2;
        mesh.scale.set(scale, scale, scale);
        
        scene.add(mesh);
        particles.push({
            mesh: mesh,
            speedX: (Math.random() - 0.5) * 0.02,
            speedY: (Math.random() - 0.5) * 0.02,
            rotX: (Math.random() - 0.5) * 0.02,
            rotY: (Math.random() - 0.5) * 0.02
        });
    }

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const light1 = new THREE.PointLight(0xff00cc, 1, 50);
    light1.position.set(10, 10, 10);
    scene.add(light1);
    
    const light2 = new THREE.PointLight(0x00f2fe, 1, 50);
    light2.position.set(-10, -10, 10);
    scene.add(light2);

    camera.position.z = 15;

    function animate() {
        requestAnimationFrame(animate);
        
        particles.forEach(p => {
            p.mesh.position.x += p.speedX;
            p.mesh.position.y += p.speedY;
            p.mesh.rotation.x += p.rotX;
            p.mesh.rotation.y += p.rotY;
            
            // Loop bounds
            if (p.mesh.position.x > 20) p.mesh.position.x = -20;
            if (p.mesh.position.x < -20) p.mesh.position.x = 20;
            if (p.mesh.position.y > 10) p.mesh.position.y = -10;
            if (p.mesh.position.y < -10) p.mesh.position.y = 10;
        });

        renderer.render(scene, camera);
    }
    
    animate();
    
    // Handle Resize
    window.addEventListener('resize', () => {
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    });
}
