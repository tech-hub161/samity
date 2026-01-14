document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration & Elements ---
    const datePicker = document.getElementById('date-picker');
    const weeksDisplay = document.getElementById('weeks-display');
    const searchBar = document.getElementById('search-bar');
    const samityTableBody = document.querySelector('#samity-table tbody');
    
    // Buttons
    const addNewBtn = document.getElementById('add-new-btn');
    const editBtn = document.getElementById('edit-btn');
    const saveBtn = document.getElementById('save-btn');
    const reportBtn = document.getElementById('report-btn');
    const backupBtn = document.getElementById('backup-btn');
    const restoreBtn = document.getElementById('restore-btn');
    const clearDataBtn = document.getElementById('clear-data-btn');
    
    // Modals
    const dateSelectionModalEl = document.getElementById('dateSelectionModal');
    const dateSelectionModal = new bootstrap.Modal(dateSelectionModalEl);
    const modalDatePicker = document.getElementById('modal-date-picker');
    const modalDateConfirmBtn = document.getElementById('modal-date-confirm-btn');
    const saveAnimationModal = document.getElementById('save-animation-modal');
    
    // Absent Details Modal
    const absentDetailsModalEl = document.getElementById('absent-details-modal');
    const absentDetailsModal = new bootstrap.Modal(absentDetailsModalEl);

    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

    let currentOpeningBalance = 0;
    let isCurrentDaySaved = false;

    // --- Initialization Logic ---

    function init() {
        checkDatePrompt();
        setupEventListeners();
    }

    function checkDatePrompt() {
        const lastDatePromptTimestamp = localStorage.getItem('lastDatePromptTimestamp');
        const now = new Date().getTime();
        const lastSavedDate = localStorage.getItem('lastSavedDate');
        const selectedDateFromStorage = localStorage.getItem('selectedDate');

        if (!lastDatePromptTimestamp || (now - parseInt(lastDatePromptTimestamp)) > FOUR_HOURS_MS) {
            modalDatePicker.value = todayISO;
            dateSelectionModal.show();
        } else {
            datePicker.value = lastSavedDate || selectedDateFromStorage || todayISO;
            localStorage.setItem('selectedDate', datePicker.value);
            initializeDataEntry();
        }
    }

    function setupEventListeners() {
        modalDateConfirmBtn.addEventListener('click', () => {
            const selectedDate = modalDatePicker.value;
            if (selectedDate) {
                datePicker.value = selectedDate;
                localStorage.setItem('selectedDate', selectedDate);
                localStorage.setItem('lastDatePromptTimestamp', new Date().getTime().toString());
                dateSelectionModal.hide();
                initializeDataEntry();
            } else {
                Swal.fire('Error', 'Please select a date.', 'error');
            }
        });

        addNewBtn.addEventListener('click', addNewCustomer);
        editBtn.addEventListener('click', editCustomerData);
        saveBtn.addEventListener('click', () => saveData(false));
        
        reportBtn.addEventListener('click', generateReport);
        searchBar.addEventListener('input', filterTable);
        datePicker.addEventListener('change', loadData);
        
        samityTableBody.addEventListener('input', handleTableInput);
        samityTableBody.addEventListener('focusin', (event) => {
            if (event.target.tagName === 'INPUT' && event.target.type === 'number') {
                event.target.select();
            }
        });

        document.getElementById('expense-amount').addEventListener('input', updateOutstanding);
        
        backupBtn.addEventListener('click', backupData);
        restoreBtn.addEventListener('click', restoreData);
        clearDataBtn.addEventListener('click', clearAllData);
    }

    function initializeDataEntry() {
        checkForEditRequest();
        loadData();
    }

    function checkForEditRequest() {
        const editRequest = localStorage.getItem('edit-request');
        if (editRequest) {
            const { date, name } = JSON.parse(editRequest);
            datePicker.value = date;
            localStorage.removeItem('edit-request');
            Swal.fire({
                icon: 'info',
                title: 'Edit Mode',
                text: `Loading data for "${name}" on ${date}.`,
                timer: 2000,
                showConfirmButton: false
            });
        }
    }

    async function addNewCustomer() {
        const result = await Swal.fire({
            title: 'New Customer',
            input: 'text',
            inputLabel: "Enter the customer's name",
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value || value.trim() === '') {
                    return 'Name cannot be empty!';
                }
            }
        });

        if (result.isConfirmed) {
            const name = result.value.trim();
            const existingNames = Array.from(samityTableBody.querySelectorAll('td[data-field="name"]')).map(td => td.querySelector('.customer-name-display').textContent.toLowerCase());
            
            if (existingNames.includes(name.toLowerCase())) {
                Swal.fire('Error', "A customer with this name already exists.", 'error');
                return;
            }

            const previousData = getPreviousDayData();
            const lastWeekData = previousData.find(c => c.name.toLowerCase() === name.toLowerCase());

            const newRowData = {
                name: name,
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
            
            Swal.fire({
                icon: 'success',
                title: 'Added!',
                text: `${name} has been added.`,
                timer: 1500,
                showConfirmButton: false
            });
        }
    }

    function createCustomerRow(data) {
        const row = document.createElement('tr');
        row.dataset.name = data.name;
        row.dataset.loanIssueDate = data.loanIssueDate || '';
        
        // Helper to create input with Bootstrap styling
        const createInput = (field, val, type = 'number') => `
            <input type="${type}" data-field="${field}" 
                   class="form-control form-control-sm text-end border-0 bg-transparent" 
                   value="${val || (type === 'number' ? 0 : '')}" 
                   ${type === 'number' ? 'min="0"' : ''}>`;

        row.innerHTML = `
            <td data-field="name" class="name-cell fw-bold">
                <div class="d-flex align-items-center justify-content-center position-relative w-100">
                    <div class="text-center text-wrap" style="padding-right: 25px; word-break: break-word;">
                        <span class="customer-name-display">${data.name}</span>
                        <input type="text" class="customer-name-edit form-control form-control-sm text-center" value="${data.name}" style="display:none;">
                    </div>
                    <span class="action-btn edit-name-btn text-warning position-absolute end-0" style="cursor:pointer;" title="Edit Name"><i class="fas fa-pencil-alt"></i></span>
                </div>
            </td>
            <td>${createInput('khata', data.khata, 'text')}</td>
            <td>${createInput('deposit', data.deposit)}</td>
            <td>${createInput('loan', data.loan)}</td>
            <td>${createInput('fine', data.fine)}</td>
            <td>${createInput('due', data.due)}</td>
            <td data-field="interest" class="text-muted">${Math.round(data.interest || 0)}</td>
            <td>${createInput('parisodh', data.parisodh)}</td>
            <td data-field="total" class="fw-bold text-dark">${Math.round(data.total || 0)}</td>
            <td data-field="totalLoan" class="text-danger fw-bold">${Math.round(data.totalLoan || 0)}</td>
            <td>
                <div class="d-flex justify-content-center align-items-center gap-2">
                    <button class="btn btn-sm btn-info info-btn rounded-circle" style="display: none;" title="View Absence Details"><i class="fas fa-info-circle text-white"></i></button>
                    <button class="btn btn-sm btn-outline-warning absent-btn rounded-circle" title="Mark Absent"><i class="fas fa-user-times"></i></button>
                    <button class="btn btn-sm btn-outline-danger delete-btn rounded-circle"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;

        // Absent Handler
        const absentBtn = row.querySelector('.absent-btn');
        const infoBtn = row.querySelector('.info-btn');

        // Check if loading saved data that was absent
        if (data.isAbsent) {
            row.classList.add('missing-row');
            absentBtn.classList.replace('btn-outline-warning', 'btn-warning');
            absentBtn.innerHTML = '<i class="fas fa-ban"></i>';
            infoBtn.style.display = 'inline-block';
        } else if (data.wasPreviouslyAbsent) {
            infoBtn.style.display = 'inline-block';
        }

        absentBtn.addEventListener('click', () => {
            row.classList.toggle('missing-row');
            const inputs = row.querySelectorAll('input[type="number"]');
            
            if (row.classList.contains('missing-row')) {
                const depositInput = row.querySelector('[data-field="deposit"]');
                row.dataset.originalDeposit = depositInput.value;

                inputs.forEach(input => input.value = 0);
                absentBtn.classList.replace('btn-outline-warning', 'btn-warning');
                absentBtn.innerHTML = '<i class="fas fa-ban"></i>';
                infoBtn.style.display = 'inline-block';
            } else {
                const depositInput = row.querySelector('[data-field="deposit"]');
                if (row.dataset.originalDeposit) {
                    depositInput.value = row.dataset.originalDeposit;
                } else {
                    depositInput.value = data.deposit || 0; 
                }
                
                absentBtn.classList.replace('btn-warning', 'btn-outline-warning');
                absentBtn.innerHTML = '<i class="fas fa-user-times"></i>';
                infoBtn.style.display = 'none';
            }
            
            const previousDataObj = getPreviousDayData(); 
            const lastWeekData = previousDataObj.data.find(c => c.name.toLowerCase() === data.name.toLowerCase());
            calculateRow(row, lastWeekData);
            updateSummary();
        });

        // Info Handler
        infoBtn.addEventListener('click', () => {
            showAbsentDetails(data.name, row);
        });

        // Delete Handler
        row.querySelector('.delete-btn').addEventListener('click', async (e) => {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: `Delete ${data.name}? This is permanent.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, delete it!'
            });

            if (result.isConfirmed) {
                e.target.closest('tr').remove();
                updateSummary();
                saveData(true);
                Swal.fire('Deleted!', 'Customer has been removed.', 'success');
            }
        });

        // Edit Name Handler
        const editNameBtn = row.querySelector('.edit-name-btn');
        const customerNameDisplay = row.querySelector('.customer-name-display');
        const customerNameEditInput = row.querySelector('.customer-name-edit');
        const icon = editNameBtn.querySelector('i');

        editNameBtn.addEventListener('click', () => {
            if (editNameBtn.title === 'Edit Name') {
                customerNameDisplay.style.display = 'none';
                customerNameEditInput.style.display = 'inline-block';
                customerNameEditInput.focus();
                editNameBtn.title = 'Save Name';
                icon.className = 'fas fa-check text-success';
            } else { // Save Name
                const oldName = row.dataset.name;
                const newName = customerNameEditInput.value.trim();

                if (newName && newName !== oldName) {
                    const existingNames = Array.from(samityTableBody.querySelectorAll('tr'))
                                            .filter(r => r !== row)
                                            .map(r => r.dataset.name.toLowerCase());
                    if (existingNames.includes(newName.toLowerCase())) {
                        Swal.fire('Error', "Name already exists.", 'error');
                        customerNameEditInput.value = oldName;
                        return;
                    }

                    row.dataset.name = newName;
                    customerNameDisplay.textContent = newName;
                    customerNameEditInput.value = newName;
                } else if (!newName) {
                    Swal.fire('Error', "Name cannot be empty.", 'error');
                    customerNameEditInput.value = oldName;
                    return;
                }

                customerNameDisplay.style.display = 'inline-block';
                customerNameEditInput.style.display = 'none';
                editNameBtn.title = 'Edit Name';
                icon.className = 'fas fa-pencil-alt';
            }
        });

        return row;
    }

    function handleTableInput(event) {
        if (event.target.tagName === 'INPUT') {
            const row = event.target.closest('tr');
            row.classList.remove('highlight-row');

            // Visual feedback on edit
            event.target.classList.add('bg-light'); // Highlight active input slightly

            if (event.target.type === 'number') {
                // Ensure value is not empty string for calc
                if(event.target.value === '') event.target.value = 0;
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
        const getVal = (field) => parseFloat(row.querySelector(`[data-field="${field}"]`).value) || 0;
        
        const deposit = getVal('deposit');
        const newLoan = getVal('loan');
        const fine = getVal('fine');
        const due = getVal('due');
        const parisodh = getVal('parisodh');

        const previousTotalLoan = lastWeekData ? lastWeekData.totalLoan : 0;
        const loanIssueDate = row.dataset.loanIssueDate ? new Date(row.dataset.loanIssueDate) : null;
        const currentDate = new Date(datePicker.value);

        let interest = 0;
        if (previousTotalLoan > 0 && loanIssueDate) {
            const timeDiff = currentDate.getTime() - loanIssueDate.getTime();
            const dayDiff = timeDiff / (1000 * 3600 * 24);
            if (dayDiff >= 7) {
                interest = Math.round(previousTotalLoan * 0.01);
            }
        }

        const total = Math.round(deposit + fine + due + interest + parisodh);
        const currentTotalLoan = Math.round(previousTotalLoan + newLoan - parisodh);

        row.querySelector('[data-field="interest"]').textContent = interest;
        row.querySelector('[data-field="total"]').textContent = total;
        row.querySelector('[data-field="totalLoan"]').textContent = currentTotalLoan;
    }

    function updateSummary() {
        const allRows = samityTableBody.querySelectorAll('tr');
        const summary = {
            khata: 0, deposit: 0, loan: 0, fine: 0, due: 0,
            interest: 0, parisodh: 0, total: 0, totalLoan: 0
        };

        allRows.forEach(row => {
            if (row.style.display !== 'none') {
                const getVal = (sel) => parseFloat(row.querySelector(sel).value || row.querySelector(sel).textContent) || 0;
                
                summary.khata += getVal('[data-field="khata"]');
                summary.deposit += getVal('[data-field="deposit"]');
                summary.loan += getVal('[data-field="loan"]');
                summary.fine += getVal('[data-field="fine"]');
                summary.due += getVal('[data-field="due"]');
                summary.interest += getVal('[data-field="interest"]');
                summary.parisodh += getVal('[data-field="parisodh"]');
                summary.total += getVal('[data-field="total"]');
                summary.totalLoan += getVal('[data-field="totalLoan"]');
            }
        });

        const setSummary = (id, val) => document.getElementById(id).textContent = Math.round(val);
        
        document.getElementById('total-khata').textContent = Math.round(summary.khata);
        setSummary('total-deposit', summary.deposit);
        setSummary('total-loan-issued', summary.loan);
        setSummary('total-fine', summary.fine);
        setSummary('total-due', summary.due);
        setSummary('total-interest', summary.interest);
        setSummary('total-parisodh', summary.parisodh);
        setSummary('total-total', summary.total);
        setSummary('total-total-loan', summary.totalLoan);

        updateOutstanding();
    }

    function updateOutstanding() {
        const totalTotal = parseFloat(document.getElementById('total-total').textContent) || 0;
        const expenseAmount = parseFloat(document.getElementById('expense-amount').value) || 0;
        
        // Calculate Outstanding (Current Balance)
        // If not saved, we only show the balance carried from previous days.
        // Once saved, we show Opening + Today's Net.
        let outstandingVal;
        if (isCurrentDaySaved) {
            outstandingVal = currentOpeningBalance + totalTotal - expenseAmount;
        } else {
            outstandingVal = currentOpeningBalance;
        }
        
        // Format to INR
        const inrFormatter = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        
        const formattedBalance = inrFormatter.format(outstandingVal);
        
        document.getElementById('outstanding-amount').textContent = Math.round(outstandingVal);
        
        const headerBalance = document.getElementById('header-balance-display');
        headerBalance.textContent = formattedBalance;
        
        // Update color based on balance state
        if (outstandingVal < 0) {
            headerBalance.classList.replace('text-success', 'text-danger');
        } else {
            headerBalance.classList.replace('text-danger', 'text-success');
             const footerOutstanding = document.getElementById('outstanding-amount');
             footerOutstanding.className = outstandingVal < 0 ? 'text-danger fw-bold' : 'text-success fw-bold';
        }
    }

    function generateReport() {
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
    }

    function showAbsentDetails(customerName, currentRow) {
        let missedDays = 0;
        let missedDeposit = 0;
        let totalFine = 0;
        
        // Scan history
        const allKeys = Object.keys(localStorage).filter(k => k.startsWith('samity-data-')).sort();
        
        // We need to estimate what the "Regular" deposit is for this customer to calculate missed amount.
        // We'll look for the last non-zero deposit in history.
        let regularDeposit = 0;
        // Search backwards for the last valid deposit
        for (let i = allKeys.length - 1; i >= 0; i--) {
            const records = JSON.parse(localStorage.getItem(allKeys[i]) || '[]');
            const record = records.find(r => r.name.toLowerCase() === customerName.toLowerCase());
            if (record && record.deposit > 0) {
                regularDeposit = record.deposit;
                break;
            }
        }
        
        // If still 0, check the current row's original/draft deposit if available
        if (regularDeposit === 0 && currentRow.dataset.originalDeposit) {
            regularDeposit = parseFloat(currentRow.dataset.originalDeposit) || 0;
        }

        allKeys.forEach(key => {
            const records = JSON.parse(localStorage.getItem(key) || '[]');
            const record = records.find(r => r.name.toLowerCase() === customerName.toLowerCase());
            
            if (record) {
                // Check if marked absent explicitly OR if deposit was 0 (implicit absence)
                if (record.isAbsent || record.deposit === 0) {
                    missedDays++;
                    missedDeposit += regularDeposit; // Add the estimated regular deposit
                }
                totalFine += (parseFloat(record.fine) || 0); // Accumulate historical fines
            }
        });

        // Current values from the row (for "Pending Interest" which is calculated live)
        const currentInterest = currentRow.querySelector('[data-field="interest"]').textContent;
        
        // Populate Modal
        document.getElementById('absent-customer-name').textContent = customerName;
        document.getElementById('absent-days-count').textContent = missedDays;
        document.getElementById('absent-missed-deposit').textContent = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(missedDeposit);
        document.getElementById('absent-pending-interest').textContent = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(currentInterest);
        document.getElementById('absent-total-fine').textContent = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(totalFine);

        absentDetailsModal.show();
    }

    function saveData(silent = false) {
        const dateKey = `samity-data-${datePicker.value}`;
        const dataToSave = [];
        const rows = samityTableBody.querySelectorAll('tr');
        const previousData = getPreviousDayData();

        rows.forEach(row => {
             // Re-calculate to be safe
             const lastWeekData = previousData.find(c => c.name.toLowerCase() === row.dataset.name.toLowerCase());
             calculateRow(row, lastWeekData);

             const getVal = (field) => parseFloat(row.querySelector(`[data-field="${field}"]`).value) || 0;
             const getText = (field) => parseFloat(row.querySelector(`[data-field="${field}"]`).textContent) || 0;

             const rowData = {
                name: row.dataset.name,
                khata: row.querySelector('[data-field="khata"]').value,
                deposit: getVal('deposit'),
                loan: getVal('loan'),
                fine: getVal('fine'),
                due: getVal('due'),
                interest: getText('interest'),
                parisodh: getVal('parisodh'),
                total: getText('total'),
                totalLoan: getText('totalLoan'),
                loanIssueDate: row.dataset.loanIssueDate,
                isAbsent: row.classList.contains('missing-row') // Save status
            };
            dataToSave.push(rowData);
        });

        localStorage.setItem(dateKey, JSON.stringify(dataToSave));

        // Save Expense Data for this date
        const expenseKey = `samity-expense-${datePicker.value}`;
        const expenseData = {
            name: document.getElementById('expense-name').value,
            amount: document.getElementById('expense-amount').value
        };
        localStorage.setItem(expenseKey, JSON.stringify(expenseData));

        localStorage.setItem('lastSavedDate', datePicker.value);
        
        // Mark as saved so the balance updates
        isCurrentDaySaved = true;
        updateSummary();

        if (!silent) {
            playSaveAnimation();
        }

        updateWeeksDisplay();
        
        // Feedback
        rows.forEach(row => {
            row.classList.add('saved-row');
            setTimeout(() => row.classList.remove('saved-row'), 1000);
        });
    }

    // --- Three.js Logic for Save Animation ---
    let renderer, scene, camera, saveMesh, animationId;
    let particles = [];

    function initThreeSaveScene() {
        const canvas = document.getElementById('three-canvas');
        if (!canvas) return;
        const container = document.querySelector('.modern-save-container');
        
        // Scene Setup
        scene = new THREE.Scene();
        
        camera = new THREE.PerspectiveCamera(75, container.offsetWidth / container.offsetHeight, 0.1, 1000);
        camera.position.z = 5;

        renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
        renderer.setSize(container.offsetWidth, container.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        // Main Object: Glowing Data Crystal
        const geometry = new THREE.IcosahedronGeometry(1.8, 0);
        const material = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            emissive: 0x4400aa,
            side: THREE.DoubleSide,
            flatShading: true,
            transparent: true,
            opacity: 0.9
        });
        saveMesh = new THREE.Mesh(geometry, material);
        scene.add(saveMesh);

        // Wireframe Overlay
        const wiregeo = new THREE.WireframeGeometry(geometry);
        const wiremat = new THREE.LineBasicMaterial({ color: 0x00ffff });
        const wireframe = new THREE.LineSegments(wiregeo, wiremat);
        saveMesh.add(wireframe);

        // Lights
        const ambientLight = new THREE.AmbientLight(0x404040);
        scene.add(ambientLight);

        const pointLight1 = new THREE.PointLight(0xff00cc, 2, 50); // Pink
        pointLight1.position.set(-5, 5, 5);
        scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x00f2fe, 2, 50); // Cyan
        pointLight2.position.set(5, -5, 5);
        scene.add(pointLight2);
    }

    function animateThree() {
        if (!scene || !camera || !renderer) return;
        animationId = requestAnimationFrame(animateThree);
        
        if (saveMesh) {
            saveMesh.rotation.x += 0.01;
            saveMesh.rotation.y += 0.02;
        }
        
        // Animate Success Particles
        particles.forEach((p, i) => {
            p.mesh.position.add(p.velocity);
            p.mesh.rotation.x += 0.1;
            p.mesh.rotation.y += 0.1;
            p.life -= 0.02;
            p.mesh.material.opacity = p.life;
            if (p.life <= 0) {
                scene.remove(p.mesh);
                particles.splice(i, 1);
            }
        });

        renderer.render(scene, camera);
    }

    function trigger3DSuccess() {
        if (!scene || !saveMesh) return;
        
        // Change Mesh to "Success" State
        saveMesh.material.color.setHex(0x00e676); // Green
        saveMesh.material.emissive.setHex(0x004400);
        saveMesh.children[0].material.color.setHex(0xccffcc); // Wireframe to light green
        
        // "Explosion" of particles
        const particleGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const colors = [0x00e676, 0x00f2fe, 0xffd700]; // Green, Cyan, Gold
        
        for (let i = 0; i < 50; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: colors[Math.floor(Math.random() * colors.length)],
                transparent: true
            });
            const p = new THREE.Mesh(particleGeo, mat);
            
            // Random direction
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            const speed = Math.random() * 0.2 + 0.1;
            
            p.position.copy(saveMesh.position);
            p.velocity = new THREE.Vector3(
                speed * Math.sin(phi) * Math.cos(theta),
                speed * Math.sin(phi) * Math.sin(theta),
                speed * Math.cos(phi)
            );
            p.life = 1.0;
            
            scene.add(p);
            particles.push({ mesh: p, velocity: p.velocity, life: p.life });
        }
    }

    function playSaveAnimation() {
        // Fallback if libraries missing
        if (typeof gsap === 'undefined' || typeof THREE === 'undefined') {
            console.warn('GSAP or Three.js not loaded');
            alert('Saved Successfully!'); // Fallback feedback
            return;
        }
        
        const modal = document.getElementById('save-animation-modal');
        const statusText = document.getElementById('save-status');
        const subtext = document.querySelector('.save-subtext');
        
        modal.style.display = 'flex';
        
        // Reset Text
        statusText.textContent = "ENCRYPTING DATA...";
        statusText.classList.remove('text-gradient-success');
        statusText.style.color = "#fff";
        subtext.textContent = "Securely storing blocks...";

        try {
            // Initialize / Reset 3D Scene
            if (!renderer) {
                initThreeSaveScene();
                animateThree();
            } else {
                // Reset Mesh State if reused
                if (saveMesh) {
                    saveMesh.material.color.setHex(0xffffff);
                    saveMesh.material.emissive.setHex(0x4400aa);
                    saveMesh.children[0].material.color.setHex(0x00ffff);
                    saveMesh.scale.set(1, 1, 1);
                }
                // Clear old particles
                particles.forEach(p => scene.remove(p.mesh));
                particles = [];
            }
        } catch (e) {
            console.error("3D Init Failed", e);
        }

        // Sequence
        setTimeout(() => {
            trigger3DSuccess();
            statusText.textContent = "DATA SECURED!";
            statusText.classList.add('text-gradient-success');
            subtext.textContent = "Transaction block verified.";
            
            // Pulse Effect
            if (saveMesh) {
                gsap.to(saveMesh.scale, { x: 1.5, y: 1.5, z: 1.5, duration: 0.2, yoyo: true, repeat: 1 });
            }
        }, 1500);

        setTimeout(() => {
            gsap.to(modal, {
                opacity: 0,
                duration: 0.5,
                onComplete: () => {
                    modal.style.display = 'none';
                    modal.style.opacity = 1;
                    // Stop animation loop to save resources
                    if (animationId) cancelAnimationFrame(animationId);
                }
            });
        }, 3000);
    }

    function loadData() {
        const dateKey = `samity-data-${datePicker.value}`;
        const expenseKey = `samity-expense-${datePicker.value}`;
        const savedDataRaw = localStorage.getItem(dateKey);
        const savedData = JSON.parse(savedDataRaw || '[]');
        const savedExpense = JSON.parse(localStorage.getItem(expenseKey) || 'null');
        const previousData = getPreviousDayData();

        // Check if data for the current date is already saved in storage
        isCurrentDaySaved = !!savedDataRaw;

        // Calculate Opening Balance (Cumulative from all previous dates)
        currentOpeningBalance = 0;
        const currentPickerDate = datePicker.value;
        const allKeys = Object.keys(localStorage).filter(k => k.startsWith('samity-data-'));
        
        allKeys.forEach(key => {
            const dateStr = key.replace('samity-data-', '');
            if (dateStr < currentPickerDate) {
                const dayData = JSON.parse(localStorage.getItem(key) || '[]');
                const dayTotal = dayData.reduce((acc, row) => acc + (parseFloat(row.total) || 0), 0);
                
                const expKey = `samity-expense-${dateStr}`;
                const expData = JSON.parse(localStorage.getItem(expKey) || 'null');
                const dayExpense = expData ? (parseFloat(expData.amount) || 0) : 0;
                
                currentOpeningBalance += (dayTotal - dayExpense);
            }
        });

        samityTableBody.innerHTML = '';
        
        // Handle Expense Loading
        if (savedExpense) {
            document.getElementById('expense-name').value = savedExpense.name;
            document.getElementById('expense-amount').value = savedExpense.amount;
        } else {
            // Explicitly reset expense if no data saved for this date (Draft Mode)
            document.getElementById('expense-name').value = '';
            document.getElementById('expense-amount').value = 0;
        }
        
        let dataToLoad = savedData;

        if (savedData.length === 0) {
            // If no data for today, load previous available data as draft
            // We carry over the Deposit amount for fast entry, but reset variable fields like New Loan, Fine, Parisodh
            dataToLoad = previousData.map(customerData => ({
                name: customerData.name,
                khata: customerData.khata,
                totalLoan: customerData.totalLoan, // Carry over the running total loan
                loanIssueDate: customerData.loanIssueDate, // Carry over for interest calculation
                
                deposit: customerData.deposit || 0, // Carry over deposit for recurring payments
                loan: 0, // Reset new loan issue
                fine: 0, // Reset fine
                due: 0, // Reset due
                parisodh: 0, // Reset repayment
                interest: 0,
                total: 0, // Will be recalculated
                wasPreviouslyAbsent: customerData.isAbsent || (customerData.deposit === 0) // Flag for info button
            }));
        }

        dataToLoad.forEach(customerData => {
            const lastWeekData = previousData.find(c => c.name.toLowerCase() === customerData.name.toLowerCase());
            const row = createCustomerRow(customerData);
            samityTableBody.appendChild(row);
            calculateRow(row, lastWeekData);

            if (lastWeekData) {
                 const noChange = customerData.deposit === lastWeekData.deposit && customerData.loan === 0 && customerData.fine === 0 && customerData.due === 0 && customerData.parisodh === 0;
                if(noChange) {
                    // Logic for highlighting can be adjusted if needed, currently highlights if strictly no change from previous week
                    // row.classList.add('highlight-row'); 
                }
            }
        });

        updateSummary();
        updateWeeksDisplay();
    }
    
    function getPreviousDayData() {
        const currentPickerDate = datePicker.value;
        // Filter for any saved data key that is strictly before the current selected date
        const allKeys = Object.keys(localStorage).filter(k => k.startsWith('samity-data-'));
        const previousKeys = allKeys.filter(k => {
            const dateStr = k.replace('samity-data-', '');
            return dateStr < currentPickerDate;
        });

        if (previousKeys.length === 0) return [];

        // Sort to get the most recent one
        previousKeys.sort(); 
        const latestKey = previousKeys[previousKeys.length - 1];
        
        return JSON.parse(localStorage.getItem(latestKey) || '[]');
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
        updateSummary();
    }
    
    async function editCustomerData() {
        const { value: customerName } = await Swal.fire({
            title: 'Edit Customer',
            input: 'text',
            inputLabel: 'Enter customer name',
            showCancelButton: true
        });

        if (!customerName) return;

        const { value: dateToEdit } = await Swal.fire({
            title: 'Select Date',
            html: '<input type="date" id="swal-date" class="swal2-input">',
            preConfirm: () => {
                return document.getElementById('swal-date').value;
            }
        });

        if (!dateToEdit) return;

        const dateKey = `samity-data-${dateToEdit}`;
        const savedData = JSON.parse(localStorage.getItem(dateKey) || '[]');
        const customerData = savedData.find(c => c.name.toLowerCase() === customerName.trim().toLowerCase());

        if (!customerData) {
            Swal.fire('Error', `No data found for "${customerName}" on ${dateToEdit}.`, 'error');
            return;
        }

        datePicker.value = dateToEdit;
        loadData();
        Swal.fire('Ready', `Now editing data for "${customerName}" for ${dateToEdit}.`, 'success');
    }

    function updateWeeksDisplay() {
        const allKeys = Object.keys(localStorage).filter(k => k.startsWith('samity-data-'));
        weeksDisplay.textContent = allKeys.length;
    }

    function backupData() {
        const backupData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('samity-')) { // Updated to include expense data
                backupData[key] = localStorage.getItem(key);
            }
        }

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `samity-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Swal.fire('Success', 'Backup file downloaded!', 'success');
    }

    function restoreData() {
        Swal.fire({
            title: 'Restore Data',
            text: "This will overwrite ALL current data. Are you sure?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, Restore it!'
        }).then((result) => {
            if (result.isConfirmed) {
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
                                const keysToRemove = [];
                                for (let i = 0; i < localStorage.length; i++) {
                                    const key = localStorage.key(i);
                                    if (key.startsWith('samity-')) { // Updated to include expense data
                                        keysToRemove.push(key);
                                    }
                                }
                                keysToRemove.forEach(key => localStorage.removeItem(key));

                                for (const key in restoredData) {
                                    if (key.startsWith('samity-')) { // Updated
                                        localStorage.setItem(key, restoredData[key]);
                                    }
                                }

                                // Find the most recent date from restored data
                                const restoredKeys = Object.keys(restoredData).filter(k => k.startsWith('samity-data-'));
                                if (restoredKeys.length > 0) {
                                    restoredKeys.sort(); // Sorts strings: "samity-data-2023-01-01" < "samity-data-2023-01-02"
                                    const latestKey = restoredKeys[restoredKeys.length - 1];
                                    const latestDate = latestKey.replace('samity-data-', '');
                                    
                                    localStorage.setItem('lastSavedDate', latestDate);
                                    localStorage.setItem('selectedDate', latestDate);
                                }

                                Swal.fire('Restored!', 'Data restored. Reloading...', 'success')
                                    .then(() => location.reload());
                            } catch (error) {
                                Swal.fire('Error', 'Invalid backup file.', 'error');
                            }
                        };
                        reader.readAsText(file);
                    }
                };
                fileInput.click();
            }
        });
    }

    function clearAllData() {
        Swal.fire({
            title: 'Clear ALL Data?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete everything!'
        }).then((result) => {
            if (result.isConfirmed) {
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.startsWith('samity-')) { // Updated
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => localStorage.removeItem(key));
                
                Swal.fire('Cleared!', 'All data has been deleted.', 'success')
                    .then(() => location.reload());
            }
        });
    }
    
    // Start App
    init();
    initHeader3D();
});

// --- Header 3D Background ---
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