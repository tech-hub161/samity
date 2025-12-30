document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const datePicker = document.getElementById('date-picker');
    const weeksDisplay = document.getElementById('weeks-display');
    const searchBar = document.getElementById('search-bar');
    const samityTableBody = document.querySelector('#samity-table tbody');
    const addNewBtn = document.getElementById('add-new-btn');
    const editBtn = document.getElementById('edit-btn');
    const saveBtn = document.getElementById('save-btn');
    const reportBtn = document.getElementById('report-btn');

    // Modal Elements
    const dateSelectionModal = document.getElementById('date-selection-modal');
    const modalDatePicker = document.getElementById('modal-date-picker');
    const modalDateConfirmBtn = document.getElementById('modal-date-confirm-btn');

    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];

    // --- Date Prompting Logic ---
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
    const lastDatePromptTimestamp = localStorage.getItem('lastDatePromptTimestamp');
    const now = new Date().getTime();

    if (!lastDatePromptTimestamp || (now - parseInt(lastDatePromptTimestamp)) > FOUR_HOURS_MS) {
        // Show modal
        dateSelectionModal.style.display = 'flex';
        modalDatePicker.value = todayISO; // Set modal picker to today
    } else {
        // Proceed normally, ensure datePicker is set and data loaded
        datePicker.value = localStorage.getItem('selectedDate') || todayISO; // Use stored date or today
        initializeDataEntry();
    }

    modalDateConfirmBtn.addEventListener('click', () => {
        const selectedDate = modalDatePicker.value;
        if (selectedDate) {
            datePicker.value = selectedDate;
            localStorage.setItem('selectedDate', selectedDate); // Store the selected date
            localStorage.setItem('lastDatePromptTimestamp', new Date().getTime().toString());
            dateSelectionModal.style.display = 'none';
            initializeDataEntry(); // Load data for the newly selected date
        } else {
            alert('Please select a date.');
        }
    });

    function initializeDataEntry() {
        // --- Event Listeners ---
        addNewBtn.addEventListener('click', addNewCustomer);
        editBtn.addEventListener('click', editCustomerData);
        saveBtn.addEventListener('click', saveData);
        reportBtn.addEventListener('click', () => {
            window.location.href = 'report/report.html';
        });
        searchBar.addEventListener('input', filterTable);
        datePicker.addEventListener('change', loadData);
        samityTableBody.addEventListener('input', handleTableInput);

        // Initial Load
        checkForEditRequest();
        loadData();
    }

    function checkForEditRequest() {
        const editRequest = localStorage.getItem('edit-request');
        if (editRequest) {
            const { date, name } = JSON.parse(editRequest);
            
            // Set the date picker to the requested date
            datePicker.value = date;
            
            // The loadData function will now automatically load the data for this date.
            // We can remove the request from localStorage now.
            localStorage.removeItem('edit-request');

            // Optional: alert the user
            alert(`Loading data for "${name}" on ${date} for editing.`);
        }
    }

    function addNewCustomer() {
        const name = prompt("Enter the new customer's name:");
        if (name && name.trim() !== '') {
            const existingNames = Array.from(samityTableBody.querySelectorAll('td[data-field="name"]')).map(td => td.textContent.toLowerCase());
            if (existingNames.includes(name.trim().toLowerCase())) {
                alert("A customer with this name already exists.");
                return;
            }

            const previousData = getPreviousDayData();
            const lastWeekData = previousData.find(c => c.name.toLowerCase() === name.trim().toLowerCase());

            const newRowData = {
                name: name.trim(),
                khata: lastWeekData ? lastWeekData.khata : '',
                deposit: 0, loan: 0, fine: 0, due: 0, parisodh: 0,
                interest: 0, total: 0,
                totalLoan: lastWeekData ? lastWeekData.totalLoan : 0,
                loanIssueDate: lastWeekData ? lastWeekData.loanIssueDate : null,
            };

            const newRow = createCustomerRow(newRowData);
            samityTableBody.appendChild(newRow);
            calculateRow(newRow, lastWeekData);
            updateSummary();
        }
    }

    function createCustomerRow(data) {
        const row = document.createElement('tr');
        row.dataset.name = data.name;
        row.dataset.loanIssueDate = data.loanIssueDate || '';

        row.innerHTML = `
            <td data-field="name">${data.name}</td>
            <td><input type="text" data-field="khata" value="${data.khata || ''}"></td>
            <td><input type="number" data-field="deposit" value="${data.deposit || 0}" min="0"></td>
            <td><input type="number" data-field="loan" value="${data.loan || 0}" min="0"></td>
            <td><input type="number" data-field="fine" value="${data.fine || 0}" min="0"></td>
            <td><input type="number" data-field="due" value="${data.due || 0}" min="0"></td>
            <td data-field="interest" class="non-editable">${(data.interest || 0).toFixed(2)}</td>
            <td><input type="number" data-field="parisodh" value="${data.parisodh || 0}" min="0"></td>
            <td data-field="total" class="non-editable">${(data.total || 0).toFixed(2)}</td>
            <td data-field="totalLoan" class="non-editable">${(data.totalLoan || 0).toFixed(2)}</td>
            <td><button class="action-btn delete-btn">Delete</button></td>
        `;

        row.querySelector('.delete-btn').addEventListener('click', (e) => {
            if (confirm(`Are you sure you want to delete ${data.name}? This is permanent.`)) {
                e.target.closest('tr').remove();
                updateSummary();
            }
        });

        return row;
    }

    function handleTableInput(event) {
        if (event.target.tagName === 'INPUT') {
            const row = event.target.closest('tr');
            const previousData = getPreviousDayData();
            const customerName = row.dataset.name;
            const lastWeekData = previousData.find(c => c.name.toLowerCase() === customerName.toLowerCase());
            
            // If a new loan is entered, store today's date
            const newLoanInput = row.querySelector('[data-field="loan"]');
            if(event.target === newLoanInput && parseFloat(newLoanInput.value) > 0) {
                row.dataset.loanIssueDate = datePicker.value;
            }

            calculateRow(row, lastWeekData);
            updateSummary();
        }
    }

    function calculateRow(row, lastWeekData) {
        const deposit = parseFloat(row.querySelector('[data-field="deposit"]').value) || 0;
        const newLoan = parseFloat(row.querySelector('[data-field="loan"]').value) || 0;
        const fine = parseFloat(row.querySelector('[data-field="fine"]').value) || 0;
        const due = parseFloat(row.querySelector('[data-field="due"]').value) || 0;
        const parisodh = parseFloat(row.querySelector('[data-field="parisodh"]').value) || 0;

        const previousTotalLoan = lastWeekData ? lastWeekData.totalLoan : 0;
        const loanIssueDate = row.dataset.loanIssueDate ? new Date(row.dataset.loanIssueDate) : null;
        const currentDate = new Date(datePicker.value);

        let interest = 0;
        if (previousTotalLoan > 0 && loanIssueDate) {
            const timeDiff = currentDate.getTime() - loanIssueDate.getTime();
            const dayDiff = timeDiff / (1000 * 3600 * 24);
            // Interest starts from the next week (>= 7 days)
            if (dayDiff >= 7) {
                interest = previousTotalLoan * 0.01;
            }
        }

        const total = deposit + fine + due + interest + parisodh;
        const currentTotalLoan = previousTotalLoan + newLoan - parisodh;

        row.querySelector('[data-field="interest"]').textContent = interest.toFixed(2);
        row.querySelector('[data-field="total"]').textContent = total.toFixed(2);
        row.querySelector('[data-field="totalLoan"]').textContent = currentTotalLoan.toFixed(2);
    }

    function updateSummary() {
        const allRows = samityTableBody.querySelectorAll('tr');
        const summary = {
            deposit: 0, loan: 0, fine: 0, due: 0,
            interest: 0, parisodh: 0, total: 0, totalLoan: 0
        };

        allRows.forEach(row => {
            if (row.style.display !== 'none') { // Only include visible rows in summary
                summary.deposit += parseFloat(row.querySelector('[data-field="deposit"]').value) || 0;
                summary.loan += parseFloat(row.querySelector('[data-field="loan"]').value) || 0;
                summary.fine += parseFloat(row.querySelector('[data-field="fine"]').value) || 0;
                summary.due += parseFloat(row.querySelector('[data-field="due"]').value) || 0;
                summary.interest += parseFloat(row.querySelector('[data-field="interest"]').textContent) || 0;
                summary.parisodh += parseFloat(row.querySelector('[data-field="parisodh"]').value) || 0;
                summary.total += parseFloat(row.querySelector('[data-field="total"]').textContent) || 0;
                summary.totalLoan += parseFloat(row.querySelector('[data-field="totalLoan"]').textContent) || 0;
            }
        });

        document.getElementById('total-deposit').textContent = summary.deposit.toFixed(2);
        document.getElementById('total-loan-issued').textContent = summary.loan.toFixed(2);
        document.getElementById('total-fine').textContent = summary.fine.toFixed(2);
        document.getElementById('total-due').textContent = summary.due.toFixed(2);
        document.getElementById('total-interest').textContent = summary.interest.toFixed(2);
        document.getElementById('total-parisodh').textContent = summary.parisodh.toFixed(2);
        document.getElementById('total-total').textContent = summary.total.toFixed(2);
        document.getElementById('total-total-loan').textContent = summary.totalLoan.toFixed(2);
    }

    function saveData() {
        const dateKey = `samity-data-${datePicker.value}`;
        const dataToSave = [];
        const rows = samityTableBody.querySelectorAll('tr');

        rows.forEach(row => {
            const rowData = {
                name: row.dataset.name,
                khata: row.querySelector('[data-field="khata"]').value,
                deposit: parseFloat(row.querySelector('[data-field="deposit"]').value) || 0,
                loan: parseFloat(row.querySelector('[data-field="loan"]').value) || 0,
                fine: parseFloat(row.querySelector('[data-field="fine"]').value) || 0,
                due: parseFloat(row.querySelector('[data-field="due"]').value) || 0,
                interest: parseFloat(row.querySelector('[data-field="interest"]').textContent) || 0,
                parisodh: parseFloat(row.querySelector('[data-field="parisodh"]').value) || 0,
                total: parseFloat(row.querySelector('[data-field="total"]').textContent) || 0,
                totalLoan: parseFloat(row.querySelector('[data-field="totalLoan"]').textContent) || 0,
                loanIssueDate: row.dataset.loanIssueDate,
            };
            dataToSave.push(rowData);
        });

        localStorage.setItem(dateKey, JSON.stringify(dataToSave));
        alert(`Data for ${datePicker.value} saved successfully!`);
        updateWeeksDisplay();
    }

    function loadData() {
        const dateKey = `samity-data-${datePicker.value}`;
        const savedData = JSON.parse(localStorage.getItem(dateKey) || '[]');
        const previousData = getPreviousDayData();

        samityTableBody.innerHTML = ''; // Clear current table

        let dataToLoad = savedData;

        if (savedData.length === 0) {
            // If no data for today, load previous week's customers
            dataToLoad = previousData.map(customerData => ({
                ...customerData,
                deposit: 0, loan: 0, fine: 0, due: 0, parisodh: 0,
                interest: 0, total: 0,
                // totalLoan and loanIssueDate are carried over
            }));
        }

        dataToLoad.forEach(customerData => {
            const lastWeekData = previousData.find(c => c.name.toLowerCase() === customerData.name.toLowerCase());
            const row = createCustomerRow(customerData);
            samityTableBody.appendChild(row);
            calculateRow(row, lastWeekData);

            // Highlighting logic
            if (lastWeekData) {
                 const noChange = customerData.deposit === 0 && customerData.loan === 0 && customerData.fine === 0 && customerData.due === 0 && customerData.parisodh === 0;
                if(noChange) {
                    const prevDate = new Date(datePicker.value);
                    prevDate.setDate(prevDate.getDate() - 7);
                    const prevDateKey = `samity-data-${prevDate.toISOString().split('T')[0]}`;
                    
                    // Highlight only if there was saved data for the previous week (meaning it's not the first week)
                    if(localStorage.getItem(prevDateKey)) {
                        row.classList.add('highlight-row');
                    }
                }
            }
        });

        updateSummary();
        updateWeeksDisplay();
    }
    
    function getPreviousDayData() {
        const currentDate = new Date(datePicker.value);
        currentDate.setDate(currentDate.getDate() - 7); // Go back 7 days for weekly logic
        const previousDateKey = `samity-data-${currentDate.toISOString().split('T')[0]}`;
        return JSON.parse(localStorage.getItem(previousDateKey) || '[]');
    }

    function filterTable() {
        const searchTerm = searchBar.value.toLowerCase();
        const rows = samityTableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const name = row.dataset.name.toLowerCase();
            if (name.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
        updateSummary(); // Recalculate summary based on visible rows
    }
    
    function editCustomerData() {
        const customerName = prompt("Enter the name of the customer to edit:");
        if (!customerName || customerName.trim() === '') return;

        const dateToEdit = prompt("Enter the date to edit (YYYY-MM-DD):");
        if (!dateToEdit || !/^\d{4}-\d{2}-\d{2}$/.test(dateToEdit)) {
            alert("Invalid date format. Please use YYYY-MM-DD.");
            return;
        }

        const dateKey = `samity-data-${dateToEdit}`;
        const savedData = JSON.parse(localStorage.getItem(dateKey) || '[]');
        const customerData = savedData.find(c => c.name.toLowerCase() === customerName.trim().toLowerCase());

        if (!customerData) {
            alert(`No data found for "${customerName}" on ${dateToEdit}.`);
            return;
        }

        // Set the date picker to the selected date and load the data
        datePicker.value = dateToEdit;
        loadData();
        alert(`Now editing data for "${customerName}" for the date ${dateToEdit}. Make your changes and click "Save".`);
    }

    function updateWeeksDisplay() {
        const allKeys = Object.keys(localStorage).filter(k => k.startsWith('samity-data-'));
        weeksDisplay.textContent = allKeys.length;
    }
});
