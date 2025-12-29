document.addEventListener('DOMContentLoaded', () => {
    const { jsPDF } = window.jspdf;
    const recordTree = document.getElementById('record-tree');
    const deleteAllBtn = document.getElementById('delete-all-btn');
    const customerList = document.getElementById('customer-list');
    const selectedDateDisplay = document.getElementById('selected-date-display');
    const detailsContent = document.getElementById('details-content');
    const detailsActions = document.getElementById('details-actions');

    let allData = {};

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
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const week = `Week ${getWeekOfMonth(date)}`;
            if (!allData[year]) allData[year] = {};
            if (!allData[year][month]) allData[year][month] = {};
            if (!allData[year][month][week]) allData[year][month][week] = {};
            allData[year][month][week][dateStr] = {
                dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' }),
                records: JSON.parse(localStorage.getItem(key) || '[]')
            };
        });
    }

    function buildTree() {
        recordTree.innerHTML = '';
        const years = Object.keys(allData).sort().reverse();
        const mainUl = document.createElement('ul');
        if (years.length === 0) return;

        const createToggler = (element) => {
            element.addEventListener('click', (e) => {
                e.stopPropagation();
                e.target.classList.toggle('open');
                const siblingUl = e.target.nextElementSibling;
                if (siblingUl && siblingUl.classList.contains('nested')) {
                    siblingUl.classList.toggle('visible');
                }
            });
        };
        
        const createDownloadBtn = (onClick) => {
            const btn = document.createElement('button');
            btn.textContent = '↓';
            btn.className = 'download-btn';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                onClick();
            });
            return btn;
        };

        years.forEach(year => {
            const yearLi = document.createElement('li');
            const yearSpan = document.createElement('span');
            yearSpan.className = 'tree-toggler';
            yearSpan.textContent = year;
            createToggler(yearSpan);
            yearLi.appendChild(yearSpan);
            yearLi.appendChild(createDownloadBtn(() => generatePdf({ year })));
            
            const yearUl = document.createElement('ul');
            yearUl.className = 'nested';
            const months = Object.keys(allData[year]).sort().reverse();

            months.forEach(month => {
                const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
                const monthLi = document.createElement('li');
                const monthSpan = document.createElement('span');
                monthSpan.className = 'tree-toggler';
                monthSpan.textContent = monthName;
                createToggler(monthSpan);
                monthLi.appendChild(monthSpan);
                monthLi.appendChild(createDownloadBtn(() => generatePdf({ year, month })));

                const monthUl = document.createElement('ul');
                monthUl.className = 'nested';
                const weeks = Object.keys(allData[year][month]).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

                weeks.forEach(week => {
                    const weekLi = document.createElement('li');
                    const weekSpan = document.createElement('span');
                    weekSpan.className = 'tree-toggler';
                    weekSpan.textContent = week;
                    createToggler(weekSpan);
                    weekLi.appendChild(weekSpan);
                    weekLi.appendChild(createDownloadBtn(() => generatePdf({ year, month, week })));
                    
                    const weekUl = document.createElement('ul');
                    weekUl.className = 'nested';
                    const dates = Object.keys(allData[year][month][week]).sort().reverse();
                    dates.forEach(date => {
                        const dateLi = document.createElement('li');
                        const dateLink = document.createElement('a');
                        dateLink.className = 'date-link';
                        dateLink.textContent = `${date} (${allData[year][month][week][date].dayOfWeek})`;
                        dateLink.dataset.date = date;
                        dateLink.addEventListener('click', (e) => displayCustomersForDate(e.target.dataset.date));
                        dateLi.appendChild(dateLink);
                        weekUl.appendChild(dateLi);
                    });
                    weekLi.appendChild(weekUl);
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
    
    function autoExpandLatest() {
        const latestYearSpan = recordTree.querySelector('ul > li:first-child > span.tree-toggler');
        if (!latestYearSpan) return;
        latestYearSpan.classList.add('open');
        latestYearSpan.nextElementSibling.classList.add('visible');

        const latestMonthSpan = latestYearSpan.nextElementSibling.querySelector('li:first-child > span.tree-toggler');
        if (!latestMonthSpan) return;
        latestMonthSpan.classList.add('open');
        latestMonthSpan.nextElementSibling.classList.add('visible');

        const latestWeekSpan = latestMonthSpan.nextElementSibling.querySelector('li:last-child > span.tree-toggler');
        if (!latestWeekSpan) return;
        latestWeekSpan.classList.add('open');
        latestWeekSpan.nextElementSibling.classList.add('visible');
    }

    function getFormattedGenerationDate() {
        const now = new Date();
        const day = now.getDate();
        const monthName = now.toLocaleString('default', { month: 'long' });
        const year = now.getFullYear();
        const week = getWeekOfMonth(now);
        let daySuffix;
        if (day > 3 && day < 21) daySuffix = 'th';
        else {
            switch (day % 10) {
                case 1: daySuffix = "st"; break;
                case 2: daySuffix = "nd"; break;
                case 3: daySuffix = "rd"; break;
                default: daySuffix = "th"; break;
            }
        }
        return `Generated: ${day}${daySuffix} ${monthName}, Week-${week}, ${year}`;
    }

    function generatePdf(context) {
        const doc = new jsPDF();
        const head = [['Name', 'Khata', 'Deposit', 'LOAN', 'FINE', 'DUE', 'INTEREST', 'PARISODH', 'TOTAL', 'TOTAL LOAN']];
        const body = [];
        let title = 'Samity Report';
        let filename = 'Samity_Report';

        const addRecordsToBody = (records) => {
            records.forEach(r => body.push([r.name, r.khata, r.deposit, r.loan, r.fine, r.due, r.interest, r.parisodh, r.total, r.totalLoan]));
        };

        if (context.year && !context.month) {
            title = `Yearly Report: ${context.year}`;
            filename = `Yearly_Report_${context.year}`;
            Object.keys(allData[context.year]).sort().forEach(month => {
                Object.keys(allData[context.year][month]).sort((a,b) => a.localeCompare(b, undefined, { numeric: true })).forEach(week => {
                    Object.keys(allData[context.year][month][week]).sort().forEach(date => {
                        addRecordsToBody(allData[context.year][month][week][date].records);
                    });
                });
            });
        } else if (context.year && context.month && !context.week) {
            const monthName = new Date(context.year, context.month - 1).toLocaleString('default', { month: 'long' });
            title = `Monthly Report: ${monthName}, ${context.year}`;
            filename = `Monthly_Report_${monthName}_${context.year}`;
            Object.keys(allData[context.year][context.month]).sort((a,b) => a.localeCompare(b, undefined, { numeric: true })).forEach(week => {
                Object.keys(allData[context.year][context.month][week]).sort().forEach(date => {
                    addRecordsToBody(allData[context.year][context.month][week][date].records);
                });
            });
        } else if (context.year && context.month && context.week) {
            const monthName = new Date(context.year, context.month - 1).toLocaleString('default', { month: 'long' });
            title = `Weekly Report: ${context.week}, ${monthName}`;
            filename = `Weekly_Report_${context.week.replace(' ','_')}_${monthName}_${context.year}`;
            Object.keys(allData[context.year][context.month][context.week]).sort().forEach(date => {
                addRecordsToBody(allData[context.year][context.month][context.week][date].records);
            });
        }
        
        const generationDateStr = getFormattedGenerationDate();
        doc.setFont(undefined, 'bold');
        doc.text(title, 14, 15);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.text(generationDateStr, 14, 20);
        doc.autoTable({ head, body, startY: 25 });
        doc.save(`${filename}.pdf`);
    }

    function displayCustomersForDate(date) {
        selectedDateDisplay.textContent = date;
        customerList.innerHTML = '';
        detailsContent.innerHTML = '<p>Select a customer to see their details.</p>';
        detailsActions.innerHTML = '';
        const tempDate = new Date(date);
        tempDate.setMinutes(tempDate.getMinutes() + tempDate.getTimezoneOffset());
        const year = tempDate.getFullYear().toString();
        const month = (tempDate.getMonth() + 1).toString().padStart(2, '0');
        const week = `Week ${getWeekOfMonth(tempDate)}`;
        const records = allData[year]?.[month]?.[week]?.[date]?.records;
        if (records && records.length > 0) {
            records.forEach(customer => {
                const li = document.createElement('li');
                li.textContent = customer.name;
                li.dataset.date = date;
                li.dataset.name = customer.name;
                customerList.appendChild(li);
            });
        } else {
            customerList.innerHTML = '<li>No customers found for this date.</li>';
        }
    }

    function handleCustomerClick(event) {
        const target = event.target;
        if (target.tagName === 'LI' && target.dataset.name) {
            Array.from(target.parentElement.children).forEach(child => child.classList.remove('active'));
            target.classList.add('active');
            displayCustomerDetails(target.dataset.date, target.dataset.name);
        }
    }

    function displayCustomerDetails(date, name) {
        const tempDate = new Date(date);
        tempDate.setMinutes(tempDate.getMinutes() + tempDate.getTimezoneOffset());
        const year = tempDate.getFullYear().toString();
        const month = (tempDate.getMonth() + 1).toString().padStart(2, '0');
        const week = `Week ${getWeekOfMonth(tempDate)}`;
        const customer = allData[year]?.[month]?.[week]?.[date]?.records.find(c => c.name === name);
        if (customer) {
            detailsContent.innerHTML = `<p><strong>Name:</strong> ${customer.name}</p><p><strong>Khata:</strong> ${customer.khata || ''}</p><p><strong>Deposit:</strong> ${customer.deposit.toFixed(2)}</p><p><strong>Loan:</strong> ${customer.loan.toFixed(2)}</p><p><strong>Fine:</strong> ${customer.fine.toFixed(2)}</p><p><strong>Due:</strong> ${customer.due.toFixed(2)}</p><p><strong>Interest:</strong> ${customer.interest.toFixed(2)}</p><p><strong>Parisodh:</strong> ${customer.parisodh.toFixed(2)}</p><p><strong>Total:</strong> ${customer.total.toFixed(2)}</p><p><strong>Total Loan:</strong> ${customer.totalLoan.toFixed(2)}</p>`;
            detailsActions.innerHTML = `<button id="edit-record-btn">Edit</button><button id="delete-record-btn">Delete</button><button id="download-record-btn">Download</button>`;
            document.getElementById('edit-record-btn').onclick = () => editRecord(date, name);
            document.getElementById('delete-record-btn').onclick = () => deleteRecord(date, name);
            document.getElementById('download-record-btn').onclick = () => downloadRecord(customer, date);
        }
    }
    
    function editRecord(date, name) {
        localStorage.setItem('edit-request', JSON.stringify({ date, name }));
        window.location.href = 'index.html';
    }

    function deleteRecord(date, name) {
        if (!confirm(`Are you sure you want to delete the record for ${name} on ${date}?`)) return;
        const dateKey = `samity-data-${date}`;
        let savedData = JSON.parse(localStorage.getItem(dateKey) || '[]');
        const updatedData = savedData.filter(c => c.name !== name);
        if (updatedData.length === 0) {
            localStorage.removeItem(dateKey);
        } else {
            localStorage.setItem(dateKey, JSON.stringify(updatedData));
        }
        loadAndGroupData();
        buildTree();
        autoExpandLatest();
        customerList.innerHTML = '';
        detailsContent.innerHTML = '<p>Record deleted.</p>';
        detailsActions.innerHTML = '';
        selectedDateDisplay.textContent = '...';
        alert('Record deleted successfully.');
    }
    
    function downloadRecord(customer, date) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text(`Report for ${customer.name} on ${date}`, 14, 15);
        const customerData = Object.entries(customer).map(([key, value]) => [key, value.toString()]);
        doc.autoTable({ startY: 20, head: [['Field', 'Value']], body: customerData });
        doc.save(`report-${customer.name}-${date}.pdf`);
    }

    function deleteAllData() {
        if (confirm("ARE YOU SURE you want to delete ALL saved data? This cannot be undone.")) {
            if (confirm("FINAL CONFIRMATION: Delete absolutely everything?")) {
                Object.keys(localStorage).filter(k => k.startsWith('samity-data-')).forEach(key => localStorage.removeItem(key));
                loadAndGroupData();
                buildTree();
                customerList.innerHTML = '';
                detailsContent.innerHTML = '<p>All data has been deleted.</p>';
                detailsActions.innerHTML = '';
                alert("All Samity data has been deleted.");
            }
        }
    }

    deleteAllBtn.addEventListener('click', deleteAllData);
    customerList.addEventListener('click', handleCustomerClick);

    loadAndGroupData();
    buildTree();
    autoExpandLatest();
});