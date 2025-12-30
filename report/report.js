document.addEventListener('DOMContentLoaded', () => {
    const { jsPDF } = window.jspdf;
    const recordTree = document.getElementById('record-tree');
    const reportContent = document.getElementById('report-content');
    const selectedPeriodDisplay = document.getElementById('selected-period-display');
    const downloadReportBtn = document.getElementById('download-report-btn');
    const reportChartCanvas = document.getElementById('report-chart');

    // Modal elements
    const weekDetailsModalEl = document.getElementById('week-details-modal');
    const weekDetailsModal = new bootstrap.Modal(weekDetailsModalEl);
    const weekDetailsModalLabel = document.getElementById('weekDetailsModalLabel');
    const weekTableContainer = document.getElementById('week-table-container');

    let allData = {};
    let currentReport = {};
    let yearlySummary = {};
    let chartInstance; // Chart for monthly report

    function getWeekOfMonth(date) {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
        return Math.ceil((date.getDate() + firstDay) / 7);
    }

    function loadAndGroupData() {
        allData = {};
        const keys = Object.keys(localStorage).filter(k => k.startsWith('samity-data-')).sort();
        keys.forEach(key => {
            const dateStr = key.replace('samity-data-', '');
            const date = new Date(dateStr);
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

    function buildTree() {
        recordTree.innerHTML = '';
        const years = Object.keys(allData).sort().reverse();
        const mainUl = document.createElement('ul');

        if (years.length === 0) {
            recordTree.innerHTML = '<p>No records found.</p>';
            return;
        }

        const createToggler = (element) => {
            element.addEventListener('click', (e) => {
                e.stopPropagation();
                e.target.classList.toggle('open');
                e.target.nextElementSibling?.classList.toggle('visible');
            });
        };

        const createLink = (text, context, onClick) => {
            const link = document.createElement('a');
            link.className = 'period-link';
            link.textContent = text;
            link.addEventListener('click', () => onClick(context));
            return link;
        };

        years.forEach(year => {
            const yearLi = document.createElement('li');
            const yearSpan = document.createElement('span');
            yearSpan.className = 'tree-toggler';
            createToggler(yearSpan);
            yearSpan.appendChild(createLink(year, { level: 'year', year }, displayReport));
            yearLi.appendChild(yearSpan);

            const yearUl = document.createElement('ul');
            yearUl.className = 'nested';
            const months = Object.keys(allData[year]).filter(k => k !== '_records').sort((a,b) => new Date(Date.parse(b + " 1, 2012")) - new Date(Date.parse(a + " 1, 2012")));
            months.forEach(month => {
                const monthLi = document.createElement('li');
                const monthSpan = document.createElement('span');
                monthSpan.className = 'tree-toggler';
                createToggler(monthSpan);
                monthSpan.appendChild(createLink(month, { level: 'month', year, month }, displayReport));
                monthLi.appendChild(monthSpan);
                
                const monthUl = document.createElement('ul');
                monthUl.className = 'nested';
                const weeks = Object.keys(allData[year][month]).filter(k => k !== '_records').sort();
                weeks.forEach(week => {
                    const weekLi = document.createElement('li');
                    weekLi.appendChild(createLink(week, { level: 'week', year, month, week }, displayReport));
                    weekLi.style.paddingLeft = "20px";
                    monthUl.appendChild(weekLi);
                });
                monthLi.appendChild(monthUl);
                yearUl.appendChild(monthLi);
            });
            yearLi.appendChild(yearUl);
            mainUl.appendChild(yearLi);
        });
        recordTree.appendChild(mainUl);
    }
    
    const createTable = (records, isSummary = false) => {
        let tableHtml = '<div class="table-responsive"><table class="table table-striped table-bordered customer-table"><thead><tr><th>Name</th><th>Khata</th><th>Deposit</th><th>LOAN</th><th>FINE</th><th>DUE</th><th>INTEREST</th><th>PARISODH</th><th>TOTAL</th><th>TOTAL LOAN</th></tr></thead><tbody>';
        records.forEach(r => {
            tableHtml += `<tr>
                <td>${r.name}</td><td>${r.khata || ''}</td><td>${r.deposit.toFixed(2)}</td><td>${r.loan.toFixed(2)}</td>
                <td>${r.fine.toFixed(2)}</td><td>${r.due.toFixed(2)}</td><td>${r.interest.toFixed(2)}</td>
                <td>${r.parisodh.toFixed(2)}</td><td>${r.total.toFixed(2)}</td><td>${isSummary ? '-' : r.totalLoan.toFixed(2)}</td>
            </tr>`;
        });
        tableHtml += '</tbody></table></div>';
        return tableHtml;
    };

    function displayReport(context) {
        currentReport = context;
        reportContent.innerHTML = ''; // Clear content
        if (chartInstance) {
            chartInstance.destroy();
        }
        reportChartCanvas.style.display = 'none';
        let title = '';

        const customerSummary = {};
        const recordsToSummarize = context.level === 'year' 
            ? allData[context.year]._records 
            : (context.level === 'month' 
                ? allData[context.year][context.month]._records 
                : allData[context.year][context.month][context.week]._records);
        
        recordsToSummarize.forEach(record => {
            if (!customerSummary[record.name]) {
                customerSummary[record.name] = { name: record.name, khata: record.khata, deposit: 0, loan: 0, fine: 0, due: 0, interest: 0, parisodh: 0, total: 0 };
            }
            const summary = customerSummary[record.name];
            summary.deposit += record.deposit;
            summary.loan += record.loan;
            summary.fine += record.fine;
            summary.due += record.due;
            summary.interest += record.interest;
            summary.parisodh += record.parisodh;
            summary.total += record.total;
        });
        yearlySummary = Object.values(customerSummary);

        if (context.level === 'year') {
            title = context.year;
            let content = `<h2>Yearly Summary for ${context.year}</h2>`;
            content += createTable(yearlySummary, true);
            reportContent.innerHTML = content;

        } else if (context.level === 'month') {
            title = `${context.month} ${context.year}`;
            reportChartCanvas.style.display = 'block';

            const weeks = Object.keys(allData[context.year][context.month]).filter(k => k !== '_records').sort();
            const chartData = {
                labels: weeks,
                datasets: [
                    { label: 'Total Deposit', data: [], backgroundColor: 'rgba(75, 192, 192, 0.6)' },
                    { label: 'Total Loan', data: [], backgroundColor: 'rgba(255, 99, 132, 0.6)' },
                ]
            };
            
            let gridHtml = '<div class="week-grid">';

            weeks.forEach(week => {
                const weekRecords = allData[context.year][context.month][week]._records;
                const weeklyTotals = { deposit: 0, loan: 0 };
                weekRecords.forEach(r => {
                    weeklyTotals.deposit += r.deposit;
                    weeklyTotals.loan += r.loan;
                });

                chartData.datasets[0].data.push(weeklyTotals.deposit);
                chartData.datasets[1].data.push(weeklyTotals.loan);

                gridHtml += `<div class="week-card" data-year="${context.year}" data-month="${context.month}" data-week="${week}"><h4>${week}</h4>`;
                gridHtml += `<p><strong>Total Deposit:</strong> ${weeklyTotals.deposit.toFixed(2)}</p>`;
                gridHtml += `<p><strong>Total Loan:</strong> ${weeklyTotals.loan.toFixed(2)}</p>`;
                gridHtml += '</div>';
            });

            gridHtml += '</div>';
            reportContent.innerHTML = gridHtml;

            chartInstance = new Chart(reportChartCanvas, {
                type: 'bar',
                data: chartData,
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: 'top' },
                        title: { display: true, text: `Weekly Summary for ${title}` }
                    }
                }
            });

        } else if (context.level === 'week') {
            title = `${context.week}, ${context.month} ${context.year}`;
            let content = `<h2>Weekly Report for ${title}</h2>`;
            const dates = Object.keys(allData[context.year][context.month][context.week]).filter(k => k !== '_records');
            dates.forEach(date => {
                content += `<h4 class="mt-3">${date}</h4>`;
                content += createTable(allData[context.year][context.month][context.week][date].records);
            });
            reportContent.innerHTML = content;
        }

        selectedPeriodDisplay.textContent = title;
    }

    function showWeekDetails(year, month, week) {
        const weekData = allData[year][month][week];
        const dates = Object.keys(weekData).filter(k => k !== '_records').sort();
        
        let tableHtml = '';
        dates.forEach(date => {
            const dayRecords = weekData[date].records;
            tableHtml += `<h4>${date}</h4>`;
            tableHtml += createTable(dayRecords);
        });

        weekTableContainer.innerHTML = tableHtml;
        
        weekDetailsModalLabel.textContent = `Details for ${week}, ${month} ${year}`;
        weekDetailsModal.show();
    }

    function generatePdf() {
        if (!currentReport.level) {
            alert("Please select a report to download.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const head = [['Name', 'Khata', 'Deposit', 'LOAN', 'FINE', 'DUE', 'INTEREST', 'PARISODH', 'TOTAL', 'TOTAL LOAN']];
        let title = selectedPeriodDisplay.textContent;
        let filename = `Report_${title.replace(/ /g, '_')}`;

        doc.setFont(undefined, 'bold');
        doc.text(`Report for ${title}`, 14, 15);
        doc.setFont(undefined, 'normal');

        if (currentReport.level === 'year') {
            const body = [];
            yearlySummary.forEach(r => body.push([r.name, r.khata || '', r.deposit, r.loan, r.fine, r.due, r.interest, r.parisodh, r.total, '-']));
            doc.autoTable({ head, body, startY: 25 });
        } else if (currentReport.level === 'month') {
            const monthData = allData[currentReport.year][currentReport.month];
            
            // Customer Summary
            const summaryBody = yearlySummary.map(r => [r.name, r.khata || '', r.deposit, r.loan, r.fine, r.due, r.interest, r.parisodh, r.total, '-']);
            
            // Define colors for the summary table
            const colors = [
                [0, 0, 0],    // Black
                [0, 0, 200],  // Blue
                [200, 0, 0],  // Red
                [0, 150, 0],  // Green
                [150, 0, 150] // Purple
            ];

            // Define header styles for the summary table
            const summaryHeadStyles = {
                fillColor: [100, 100, 100], // Grey background
                textColor: [255, 255, 255],   // White text
                lineColor: [0, 0, 0],
                lineWidth: 0.1
            };

            doc.text('Customer Summary', 14, 25);
            doc.autoTable({
                head,
                body: summaryBody,
                startY: 30,
                headStyles: summaryHeadStyles,
                bodyStyles: {
                    fontStyle: 'bold',
                    lineColor: [0, 0, 0],
                    lineWidth: 0.1
                },
                alternateRowStyles: {
                    fillColor: [240, 240, 240]
                },
                didParseCell: function(data) {
                    if (data.section === 'body') {
                        data.cell.styles.textColor = colors[data.row.index % colors.length];
                    }
                }
            });

            // Define colors for the weekly tables
            const weeklyColors = [
                [0, 100, 0],   // Dark Green
                [100, 0, 0],   // Dark Red
                [0, 0, 100],   // Dark Blue
                [100, 100, 0], // Dark Yellow
                [100, 0, 100]  // Dark Magenta
            ];
            
            // Define header styles for the weekly tables
            const weeklyHeadStyles = {
                fillColor: [50, 50, 150], // Darker Blue background
                textColor: [255, 255, 255],   // White text
                lineColor: [0, 0, 0],
                lineWidth: 0.1
            };

            // Weekly data
            const weeks = Object.keys(monthData).filter(k => k !== '_records').sort();
            weeks.forEach(week => {
                doc.addPage();
                doc.text(`${week}`, 14, 15);
                const weekData = monthData[week];
                const dates = Object.keys(weekData).filter(k => k !== '_records').sort();
                
                let lastY = 25; // Keep track of the last y position

                dates.forEach(date => {
                    doc.text(`Date: ${date}`, 14, lastY);
                    lastY += 5; // Add some space before the table

                    const weeklyBody = [];
                    weekData[date].records.forEach(r => {
                        weeklyBody.push([r.name, r.khata || '', r.deposit, r.loan, r.fine, r.due, r.interest, r.parisodh, r.total, r.totalLoan]);
                    });

                    doc.autoTable({
                        head,
                        body: weeklyBody,
                        startY: lastY,
                        headStyles: weeklyHeadStyles,
                        bodyStyles: {
                            fontStyle: 'bold',
                            lineColor: [0, 0, 0],
                            lineWidth: 0.1
                        },
                        alternateRowStyles: {
                            fillColor: [240, 240, 240]
                        },
                        didParseCell: function(data) {
                            if (data.section === 'body') {
                                data.cell.styles.textColor = weeklyColors[data.row.index % weeklyColors.length];
                            }
                        }
                    });

                    lastY = doc.lastAutoTable.finalY + 10; // Update lastY to the end of the table
                });
            });

        } else if (currentReport.level === 'week') {
            const body = [];
            const weekData = allData[currentReport.year][currentReport.month][currentReport.week];
            const dates = Object.keys(weekData).filter(k => k !== '_records').sort();
            dates.forEach(date => {
                body.push([{content: `Date: ${date}`, colSpan: 10, styles: { fontStyle: 'bold' }}]);
                weekData[date].records.forEach(r => {
                    body.push([r.name, r.khata || '', r.deposit, r.loan, r.fine, r.due, r.interest, r.parisodh, r.total, r.totalLoan]);
                });
            });
            doc.autoTable({ head, body, startY: 25 });
        }
        
        doc.save(`${filename}.pdf`);
    }

    reportContent.addEventListener('click', (e) => {
        const weekCard = e.target.closest('.week-card');
        if (weekCard) {
            const { year, month, week } = weekCard.dataset;
            showWeekDetails(year, month, week);
        }
    });

    // Removed: weekDetailsModalEl.addEventListener('hidden.bs.modal', () => { ... });

    const downloadRangeBtn = document.getElementById('download-range-btn');

    const dateRangePicker = flatpickr("#date-range-picker", {
        mode: "range",
        dateFormat: "Y-m-d",
    });

    function generateRangePdf() {
        const selectedDates = dateRangePicker.selectedDates;
        if (selectedDates.length < 2) {
            alert('Please select a start and end date.');
            return;
        }

        const start = selectedDates[0];
        const end = selectedDates[1];
        const startDate = start.toISOString().split('T')[0];
        const endDate = end.toISOString().split('T')[0];

        end.setHours(23, 59, 59, 999); // Include the entire end day

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
            alert('No records found for the selected date range.');
            return;
        }
        
        const doc = new jsPDF();
        const head = [['Name', 'Khata', 'Deposit', 'LOAN', 'FINE', 'DUE', 'INTEREST', 'PARISODH', 'TOTAL', 'TOTAL LOAN']];
        const title = `Report for ${startDate} to ${endDate}`;
        const filename = `Report_${startDate}_to_${endDate}.pdf`;

        doc.setFont(undefined, 'bold');
        doc.text(title, 14, 15);
        doc.setFont(undefined, 'normal');

        // Customer Summary
        const customerSummary = {};
        filteredRecords.forEach(record => {
            if (!customerSummary[record.name]) {
                customerSummary[record.name] = { name: record.name, khata: record.khata, deposit: 0, loan: 0, fine: 0, due: 0, interest: 0, parisodh: 0, total: 0 };
            }
            const summary = customerSummary[record.name];
            summary.deposit += record.deposit;
            summary.loan += record.loan;
            summary.fine += record.fine;
            summary.due += record.due;
            summary.interest += record.interest;
            summary.parisodh += record.parisodh;
            summary.total += record.total;
        });
        const summaryBody = Object.values(customerSummary).map(r => [r.name, r.khata || '', r.deposit, r.loan, r.fine, r.due, r.interest, r.parisodh, r.total, '-']);
        
        doc.text('Customer Summary', 14, 25);
        doc.autoTable({
            head,
            body: summaryBody,
            startY: 30,
            headStyles: {
                fillColor: [100, 100, 100],
                textColor: [255, 255, 255],
                lineColor: [0, 0, 0],
                lineWidth: 0.1
            },
            bodyStyles: {
                fontStyle: 'bold',
                lineColor: [0, 0, 0],
                lineWidth: 0.1
            },
            alternateRowStyles: {
                fillColor: [240, 240, 240]
            }
        });
        
        // Group records by week and date
        const groupedByWeek = {};
        filteredRecords.forEach(record => {
            const date = new Date(record.date);
            date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
            const week = `Week ${getWeekOfMonth(date)}`;
            if (!groupedByWeek[week]) {
                groupedByWeek[week] = {};
            }
            if (!groupedByWeek[week][record.date]) {
                groupedByWeek[week][record.date] = [];
            }
            groupedByWeek[week][record.date].push(record);
        });

        const weeks = Object.keys(groupedByWeek).sort();
        weeks.forEach(week => {
            doc.addPage();
            doc.text(`${week}`, 14, 15);
            const weekData = groupedByWeek[week];
            const dates = Object.keys(weekData).sort();
            
            let lastY = 25;

            dates.forEach(date => {
                doc.text(`Date: ${date}`, 14, lastY);
                lastY += 5;

                const weeklyBody = [];
                weekData[date].forEach(r => {
                    weeklyBody.push([r.name, r.khata || '', r.deposit, r.loan, r.fine, r.due, r.interest, r.parisodh, r.total, r.totalLoan]);
                });

                doc.autoTable({
                    head,
                    body: weeklyBody,
                    startY: lastY,
                    headStyles: {
                        fillColor: [50, 50, 150],
                        textColor: [255, 255, 255],
                        lineColor: [0, 0, 0],
                        lineWidth: 0.1
                    },
                    bodyStyles: {
                        fontStyle: 'bold',
                        lineColor: [0, 0, 0],
                        lineWidth: 0.1
                    },
                    alternateRowStyles: {
                        fillColor: [240, 240, 240]
                    }
                });
                lastY = doc.lastAutoTable.finalY + 10;
            });
        });
        
        doc.save(filename);
    }

    const downloadCustomerReportBtn = document.getElementById('download-customer-report-btn');
    const customerSelect = document.getElementById('customer-select');

    function populateCustomerDropdown() {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('samity-data-'));
        const customerNames = new Set();
        keys.forEach(key => {
            const records = JSON.parse(localStorage.getItem(key) || '[]');
            records.forEach(r => customerNames.add(r.name));
        });
        
        customerSelect.innerHTML = '<option value="">Select a Customer</option>';
        customerNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            customerSelect.appendChild(option);
        });
    }

    function generateCustomerReportPdf() {
        const customerName = customerSelect.value;
        const selectedDates = dateRangePicker.selectedDates;

        if (!customerName || selectedDates.length < 2) {
            alert('Please select a customer, start date, and end date.');
            return;
        }

        const start = selectedDates[0];
        const end = selectedDates[1];
        const startDate = start.toISOString().split('T')[0];
        const endDate = end.toISOString().split('T')[0];

        end.setHours(23, 59, 59, 999); // Include the entire end day

        const filteredRecords = [];
        const keys = Object.keys(localStorage).filter(k => k.startsWith('samity-data-'));
        keys.forEach(key => {
            const dateStr = key.replace('samity-data-', '');
            const recordDate = new Date(dateStr);
            if (recordDate >= start && recordDate <= end) {
                const records = JSON.parse(localStorage.getItem(key) || '[]');
                const customerRecords = records.filter(r => r.name === customerName);
                if (customerRecords.length > 0) {
                    filteredRecords.push(...customerRecords.map(r => ({...r, date: dateStr})));
                }
            }
        });

        if (filteredRecords.length === 0) {
            alert('No records found for the selected customer and date range.');
            return;
        }

        const doc = new jsPDF();
        const head = [['Khata', 'Deposit', 'LOAN', 'FINE', 'DUE', 'INTEREST', 'PARISODH', 'TOTAL', 'TOTAL LOAN']];
        const title = `Report for ${customerName} from ${startDate} to ${endDate}`;
        const filename = `Report_${customerName}_${startDate}_to_${endDate}.pdf`;

        doc.setFont(undefined, 'bold');
        doc.text(title, 14, 15);
        doc.setFont(undefined, 'normal');

        // Customer Summary
        const customerSummary = { name: customerName, khata: filteredRecords[0].khata, deposit: 0, loan: 0, fine: 0, due: 0, interest: 0, parisodh: 0, total: 0 };
        filteredRecords.forEach(record => {
            customerSummary.deposit += record.deposit;
            customerSummary.loan += record.loan;
            customerSummary.fine += record.fine;
            customerSummary.due += record.due;
            customerSummary.interest += record.interest;
            customerSummary.parisodh += record.parisodh;
            customerSummary.total += record.total;
        });
        const summaryBody = [[customerSummary.name, customerSummary.khata || '', customerSummary.deposit, customerSummary.loan, customerSummary.fine, customerSummary.due, customerSummary.interest, customerSummary.parisodh, customerSummary.total, '-']];
        
        doc.text('Customer Summary', 14, 25);
        doc.autoTable({
            head: [['Name', 'Khata', 'Total Deposit', 'Total LOAN', 'Total FINE', 'Total DUE', 'Total INTEREST', 'Total PARISODH', 'Total TOTAL', '']],
            body: summaryBody,
            startY: 30
        });

        let lastY = doc.lastAutoTable.finalY + 10; // Start detailed transactions after summary
        doc.text(`Detailed Records: ${customerName}`, 14, lastY);
        lastY += 10; // Space after heading
        
        const groupedByDate = {};
        filteredRecords.forEach(record => {
            if (!groupedByDate[record.date]) {
                groupedByDate[record.date] = [];
            }
            groupedByDate[record.date].push(record);
        });

        const dates = Object.keys(groupedByDate).sort();
        dates.forEach(date => {
            if (lastY + 30 > doc.internal.pageSize.height) { // Check if new page is needed for date heading + table
                doc.addPage();
                lastY = 15; // Reset Y for new page
            }
            doc.text(`Date: ${date}`, 14, lastY);
            lastY += 5;

            const dailyBody = groupedByDate[date].map(r => [r.khata || '', r.deposit, r.loan, r.fine, r.due, r.interest, r.parisodh, r.total, r.totalLoan]);
            
            doc.autoTable({
                head,
                body: dailyBody,
                startY: lastY,
                headStyles: {
                    fillColor: [50, 50, 150],
                    textColor: [255, 255, 255],
                    lineColor: [0, 0, 0],
                    lineWidth: 0.1
                },
                bodyStyles: {
                    fontStyle: 'bold',
                    lineColor: [0, 0, 0],
                    lineWidth: 0.1
                },
                alternateRowStyles: {
                    fillColor: [240, 240, 240]
                }
            });
            lastY = doc.lastAutoTable.finalY + 10;
        });
        
        doc.save(filename);
    }
    
    downloadCustomerReportBtn.addEventListener('click', generateCustomerReportPdf);
    downloadReportBtn.addEventListener('click', generatePdf);
    downloadRangeBtn.addEventListener('click', generateRangePdf);

    loadAndGroupData();
    buildTree();
    populateCustomerDropdown();
});