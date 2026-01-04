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
    const dateSelectionModal = document.getElementById('date-selection-modal');
    const modalDatePicker = document.getElementById('modal-date-picker');
    const modalDateConfirmBtn = document.getElementById('modal-date-confirm-btn');
    const saveAnimationModal = document.getElementById('save-animation-modal');
    const paperPlane = document.querySelector('.paper-plane');
    const clouds = document.querySelectorAll('.cloud');
    const successAnimation = document.querySelector('.success-animation');
    const checkmarkCircle = document.querySelector('.checkmark__circle');
    const checkmarkCheck = document.querySelector('.checkmark__check');

    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];

    // --- Date Prompting Logic ---
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
    const lastDatePromptTimestamp = localStorage.getItem('lastDatePromptTimestamp');
    const now = new Date().getTime();
    const lastSavedDate = localStorage.getItem('lastSavedDate');
    const selectedDateFromStorage = localStorage.getItem('selectedDate');

    if (!lastDatePromptTimestamp || (now - parseInt(lastDatePromptTimestamp)) > FOUR_HOURS_MS) {
        // Show modal if it's the first time or 4 hours passed since last prompt
        Object.assign(dateSelectionModal.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        });
        modalDatePicker.value = todayISO; // Set modal picker to today
    } else {
        // Proceed normally, ensure datePicker is set and data loaded
        // Prioritize lastSavedDate if available, otherwise use selectedDateFromStorage or today
        datePicker.value = lastSavedDate || selectedDateFromStorage || todayISO;
        localStorage.setItem('selectedDate', datePicker.value); // Ensure selectedDate is up-to-date
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
        saveBtn.addEventListener('click', () => saveData(false)); // Wrap to prevent event object being passed
        reportBtn.addEventListener('click', () => {
            const expenseData = {
                name: document.getElementById('expense-name').value,
                amount: document.getElementById('expense-amount').value,
                outstanding: document.getElementById('outstanding-amount').textContent
            };
            localStorage.setItem('temp-expense-data', JSON.stringify(expenseData));

            const summaryData = {
                totalKhata: document.getElementById('total-khata').textContent,
                totalDeposit: document.getElementById('total-deposit').textContent,
                totalLoanIssued: document.getElementById('total-loan-issued').textContent,
                totalFine: document.getElementById('total-fine').textContent,
                totalDue: document.getElementById('total-due').textContent,
                totalInterest: document.getElementById('total-interest').textContent,
                totalParisodh: document.getElementById('total-parisodh').textContent,
                totalTotal: document.getElementById('total-total').textContent,
                totalTotalLoan: document.getElementById('total-total-loan').textContent
            };
            localStorage.setItem('temp-summary-data', JSON.stringify(summaryData));

            window.location.href = 'report/report.html';
        });
        searchBar.addEventListener('input', filterTable);
        datePicker.addEventListener('change', loadData);
        samityTableBody.addEventListener('input', handleTableInput);
        document.getElementById('expense-amount').addEventListener('input', updateOutstanding);
        document.getElementById('backup-btn').addEventListener('click', backupData);
        document.getElementById('restore-btn').addEventListener('click', restoreData);
        document.getElementById('clear-data-btn').addEventListener('click', clearAllData);
        samityTableBody.addEventListener('focusin', (event) => {
            if (event.target.tagName === 'INPUT' && event.target.type === 'number') {
                event.target.select();
            }
        });

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
            <td data-field="name" class="name-cell">
                <span class="customer-name-display">${data.name}</span>
                <input type="text" class="customer-name-edit" value="${data.name}" style="display:none;">
                <span class="action-btn edit-name-btn" title="Edit Name">✏️</span>
            </td>
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
                saveData(true); // Save the data silently to make the deletion permanent
            }
        });

        // Event listener for editing customer name
        const editNameBtn = row.querySelector('.edit-name-btn');
        const customerNameDisplay = row.querySelector('.customer-name-display');
        const customerNameEditInput = row.querySelector('.customer-name-edit');

        editNameBtn.addEventListener('click', () => {
            if (editNameBtn.title === 'Edit Name') {
                customerNameDisplay.style.display = 'none';
                customerNameEditInput.style.display = 'inline-block';
                customerNameEditInput.focus();
                editNameBtn.title = 'Save Name';
            } else { // Save Name
                const oldName = row.dataset.name;
                const newName = customerNameEditInput.value.trim();

                if (newName && newName !== oldName) {
                    const existingNames = Array.from(samityTableBody.querySelectorAll('tr'))
                                            .filter(r => r !== row) // Exclude current row
                                            .map(r => r.dataset.name.toLowerCase());
                    if (existingNames.includes(newName.toLowerCase())) {
                        alert("A customer with this name already exists.");
                        customerNameEditInput.value = oldName; // Revert to old name
                        return;
                    }

                    // Update all occurrences of the name in the current view
                    // This is crucial if name is used as an identifier for other operations
                    row.dataset.name = newName;
                    customerNameDisplay.textContent = newName;
                    customerNameEditInput.value = newName;
                    // Note: Actual saving to localStorage for all affected dates
                    // will happen when the main 'Save' button is clicked.
                    // This change only affects the current session's table view.
                } else if (!newName) {
                    alert("Customer name cannot be empty.");
                    customerNameEditInput.value = oldName;
                    return;
                }

                customerNameDisplay.style.display = 'inline-block';
                customerNameEditInput.style.display = 'none';
                editNameBtn.title = 'Edit Name';
            }
        });

        return row;
    }

    function handleTableInput(event) {
        if (event.target.tagName === 'INPUT') {
            const row = event.target.closest('tr');
            
            // Remove highlight on input, indicating the row has been worked on.
            row.classList.remove('highlight-row');

            // Round off numeric inputs
            if (event.target.type === 'number') {
                event.target.value = Math.round(event.target.value);
            }

            const previousData = getPreviousDayData();
            const customerName = row.dataset.name;
            const lastWeekData = previousData.find(c => c.name.toLowerCase() === customerName.toLowerCase());
            
            const newLoanInput = row.querySelector('[data-field="loan"]');
            if(event.target === newLoanInput && parseFloat(newLoanInput.value) > 0 && !row.dataset.loanIssueDate) {
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
            khata: 0, deposit: 0, loan: 0, fine: 0, due: 0,
            interest: 0, parisodh: 0, total: 0, totalLoan: 0
        };

        allRows.forEach(row => {
            if (row.style.display !== 'none') { // Only include visible rows in summary
                summary.khata += parseFloat(row.querySelector('[data-field="khata"]').value) || 0;
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

        document.getElementById('total-khata').textContent = summary.khata.toFixed(0);
        document.getElementById('total-deposit').textContent = summary.deposit.toFixed(2);
        document.getElementById('total-loan-issued').textContent = summary.loan.toFixed(2);
        document.getElementById('total-fine').textContent = summary.fine.toFixed(2);
        document.getElementById('total-due').textContent = summary.due.toFixed(2);
        document.getElementById('total-interest').textContent = summary.interest.toFixed(2);
        document.getElementById('total-parisodh').textContent = summary.parisodh.toFixed(2);
        document.getElementById('total-total').textContent = summary.total.toFixed(2);
        document.getElementById('total-total-loan').textContent = summary.totalLoan.toFixed(2);

        updateOutstanding();
    }

    function updateOutstanding() {
        const totalTotal = parseFloat(document.getElementById('total-total').textContent) || 0;
        const expenseAmount = parseFloat(document.getElementById('expense-amount').value) || 0;
        const outstandingAmount = totalTotal - expenseAmount;
        document.getElementById('outstanding-amount').textContent = outstandingAmount.toFixed(2);
    }

    function saveData(silent = false) {
        const dateKey = `samity-data-${datePicker.value}`;
        const dataToSave = [];
        const rows = samityTableBody.querySelectorAll('tr');
        const previousData = getPreviousDayData();

        rows.forEach(row => {
            // Re-calculate all values at the moment of saving to ensure data integrity
            const lastWeekData = previousData.find(c => c.name.toLowerCase() === row.dataset.name.toLowerCase());

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
                if (dayDiff >= 7) {
                    interest = previousTotalLoan * 0.01;
                }
            }

            const total = deposit + fine + due + interest + parisodh;
            const currentTotalLoan = previousTotalLoan + newLoan - parisodh;

            const rowData = {
                name: row.dataset.name,
                khata: row.querySelector('[data-field="khata"]').value,
                deposit: deposit,
                loan: newLoan,
                fine: fine,
                due: due,
                interest: interest,
                parisodh: parisodh,
                total: total,
                totalLoan: currentTotalLoan,
                loanIssueDate: row.dataset.loanIssueDate,
            };
            dataToSave.push(rowData);
        });

        localStorage.setItem(dateKey, JSON.stringify(dataToSave));
        localStorage.setItem('lastSavedDate', datePicker.value); // Store the last saved date
        
        if (!silent) {
            playSaveAnimation();
        }

        updateWeeksDisplay();
        
        // Add saved-row class for visual feedback
        rows.forEach(row => {
            row.classList.add('saved-row');
            setTimeout(() => {
                row.classList.remove('saved-row');
            }, 1000); // Remove class after 1 second
        });
    }

    function playSaveAnimation() {
        if (typeof gsap === 'undefined') {
            alert('GSAP not loaded');
            return;
        }
        saveAnimationModal.style.display = 'flex';

        clouds.forEach(cloud => {
            gsap.set(cloud, {
                y: Math.random() * 150 - 50, // Random y between -50 and 100
                scale: Math.random() * 0.8 + 0.4 // Random scale between 0.4 and 1.2
            });
        });

        const tl = gsap.timeline();

        tl.to(paperPlane, {
            duration: 3,
            x: 350,
            ease: 'power1.inOut',
        })
        .to(paperPlane, {
            duration: 0.2,
            rotation: 10,
            yoyo: true,
            repeat: 15,
            ease: 'power1.inOut'
        }, 0)
        .to(paperPlane, {
            opacity: 0,
            duration: 0.5
        }, '-=0.5')
        .to(clouds, {
            x: 400,
            duration: 4,
            ease: 'linear',
            stagger: 0.2,
            opacity: 0
        }, 0)
        .to(successAnimation, {
            opacity: 1,
            visibility: 'visible',
            duration: 0.5
        })
        .fromTo(checkmarkCircle, {
            strokeDashoffset: 166
        }, {
            strokeDashoffset: 0,
            duration: 1,
            ease: 'power1.in'
        })
        .fromTo(checkmarkCheck, {
            strokeDashoffset: 48
        }, {
            strokeDashoffset: 0,
            duration: 0.8,
            ease: 'power1.in'
        }, '-=0.5')
        .to(saveAnimationModal, {
            opacity: 0,
            duration: 0.5,
            delay: 1,
            onComplete: () => {
                saveAnimationModal.style.display = 'none';
                saveAnimationModal.style.opacity = 1; // Reset for next time
                // Reset animation states
                gsap.set(paperPlane, { x: 0, y: 0, opacity: 1, rotation: 0 });
                gsap.set(clouds, { x: 0, opacity: 1 });
                gsap.set(successAnimation, { opacity: 0, visibility: 'hidden' });
                gsap.set(checkmarkCircle, { strokeDashoffset: 166 });
                gsap.set(checkmarkCheck, { strokeDashoffset: 48 });
            }
        });
    }

    function loadData() {
        const dateKey = `samity-data-${datePicker.value}`;
        const savedData = JSON.parse(localStorage.getItem(dateKey) || '[]');
        const previousData = getPreviousDayData();

        samityTableBody.innerHTML = ''; // Clear current table

        // Clear any existing saved-row or highlight-row classes before loading new data
        samityTableBody.querySelectorAll('tr').forEach(row => {
            row.classList.remove('saved-row', 'highlight-row');
        });

        let dataToLoad = savedData;

        if (savedData.length === 0) {
            // If no data for today, load previous week's customers but reset daily fields.
            dataToLoad = previousData.map(customerData => ({
                // Explicitly define the object for a new day to prevent data leakage
                name: customerData.name,
                khata: customerData.khata,
                totalLoan: customerData.totalLoan, // Carry over the running total loan
                loanIssueDate: customerData.loanIssueDate, // Carry over for interest calculation
                // Reset all daily transaction fields
                deposit: 0,
                loan: 0,
                fine: 0,
                due: 0,
                parisodh: 0,
                interest: 0,
                total: 0,
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

    function backupData() {
        const backupData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('samity-data-')) {
                backupData[key] = localStorage.getItem(key);
            }
        }

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'samity-backup.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('Backup created successfully!');
    }

    function restoreData() {
        if (!confirm('Are you sure you want to restore data? This will overwrite all current data.')) {
            return;
        }

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const restoredData = JSON.parse(e.target.result);
                        
                        // Clear existing data
                        const keysToRemove = [];
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key.startsWith('samity-data-')) {
                                keysToRemove.push(key);
                            }
                        }
                        keysToRemove.forEach(key => localStorage.removeItem(key));

                        // Restore new data
                        for (const key in restoredData) {
                            if (key.startsWith('samity-data-')) {
                                localStorage.setItem(key, restoredData[key]);
                            }
                        }
                        alert('Data restored successfully! The page will now reload.');
                        location.reload();
                    } catch (error) {
                        alert('Error reading or parsing backup file. Please ensure it is a valid backup file.');
                    }
                };
                reader.readAsText(file);
            }
        };
        fileInput.click();
    }

    function clearAllData() {
        if (!confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
            return;
        }
        if (!confirm('FINAL WARNING: This will delete everything. Are you absolutely sure?')) {
            return;
        }

        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('samity-data-')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        alert('All data has been cleared. The page will now reload.');
        location.reload();
    }
});
